"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { canonicalHostname, canonicalUrl, isLikelyUrl, normalizeUrl } from "@/lib/url";
import {
  canAddCompetitor,
  checkCompetitorChange,
  COMPETITOR_CHANGE_COOLDOWN_DAYS,
  formatNextChangeDate,
} from "@/lib/billing/competitor-slots";

export type SetCompetitorResult = { ok: true } | { ok: false; error: string };

/**
 * Les vérifications communes à tout écrit d'URL de concurrent.
 *
 * Trois refus, tous factuels : une adresse illisible, sa propre adresse, et une
 * adresse déjà suivie. Le troisième est nouveau avec le multi-concurrent — deux
 * lignes sur le même site occuperaient deux places pour un seul relevé, et le
 * sélecteur afficherait deux entrées indiscernables.
 */
async function validateCompetitorUrl(
  rawInput: string,
  options: { userId: string; ignoreCompetitorId?: string },
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const raw = rawInput.trim();

  if (!raw) {
    return { ok: false, error: "Renseigne l'URL du site de ton concurrent." };
  }
  if (!isLikelyUrl(raw)) {
    return {
      ok: false,
      error: "Cette URL ne semble pas valide. Exemple attendu : concurrent.com",
    };
  }

  const nextUrl = normalizeUrl(raw);
  const supabase = await createClient();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("saas_url")
    .eq("id", options.userId)
    .maybeSingle();

  if (profileError) {
    return { ok: false, error: "Impossible de lire ton profil. Réessaie." };
  }

  // Comparing a SaaS to itself produces no usable écart — every rule would
  // find both sides identical. Compared on the canonical hostname so
  // `tonsaas.com` and `https://www.tonsaas.com/pricing` are caught as the
  // same site; a different subdomain is left alone, it can legitimately be a
  // different product.
  const ownHost = profile?.saas_url ? canonicalHostname(profile.saas_url) : null;
  const nextHost = canonicalHostname(nextUrl);
  if (ownHost !== null && nextHost !== null && ownHost === nextHost) {
    return {
      ok: false,
      error: "C'est l'adresse de ton propre SaaS. Renseigne le site d'un concurrent.",
    };
  }

  const { data: tracked, error: trackedError } = await supabase
    .from("competitors")
    .select("id, url")
    .eq("user_id", options.userId);

  if (trackedError) {
    return { ok: false, error: "Impossible de lire tes concurrents. Réessaie." };
  }

  const duplicate = (tracked ?? []).some(
    (competitor) =>
      competitor.id !== options.ignoreCompetitorId &&
      canonicalUrl(competitor.url) === canonicalUrl(nextUrl),
  );
  if (duplicate) {
    return { ok: false, error: "Tu suis déjà ce site. Choisis-en un autre." };
  }

  return { ok: true, url: nextUrl };
}

/**
 * Ajoute un concurrent, dans la limite des places du palier.
 *
 * Le premier ajouté devient le concurrent principal : c'est celui que les écrans
 * ouvrent par défaut, et il en faut un dès qu'il existe une ligne — sinon la
 * sélection retomberait sur un ordre arbitraire.
 */
export async function addCompetitor(url: string): Promise<SetCompetitorResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Session expirée. Reconnecte-toi." };
  }

  const validated = await validateCompetitorUrl(url, { userId: user.id });
  if (!validated.ok) return validated;

  const [{ data: profile, error: profileError }, { count, error: countError }] =
    await Promise.all([
      supabase.from("profiles").select("subscription_tier").eq("id", user.id).maybeSingle(),
      supabase
        .from("competitors")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
    ]);

  if (profileError || countError) {
    return { ok: false, error: "Impossible de vérifier tes places de concurrent. Réessaie." };
  }

  const tracked = count ?? 0;
  const allowance = canAddCompetitor(profile?.subscription_tier ?? "starter", tracked);
  if (!allowance.allowed) {
    return { ok: false, error: allowance.reason };
  }

  const { error: insertError } = await supabase.from("competitors").insert({
    user_id: user.id,
    url: validated.url,
    is_primary: tracked === 0,
  });

  if (insertError) {
    return { ok: false, error: "Impossible d'enregistrer ce concurrent. Réessaie." };
  }

  revalidateCompetitorRoutes();
  return { ok: true };
}

/**
 * Remplace l'URL d'un concurrent déjà suivi.
 *
 * C'est l'ancienne action `setCompetitor` rendue explicite sur sa cible : avec
 * plusieurs places, « le concurrent » ne désigne plus rien tout seul.
 */
export async function replaceCompetitorUrl(
  competitorId: string,
  url: string,
): Promise<SetCompetitorResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Session expirée. Reconnecte-toi." };
  }

  const validated = await validateCompetitorUrl(url, {
    userId: user.id,
    ignoreCompetitorId: competitorId,
  });
  if (!validated.ok) return validated;

  const { data: existing, error: existingError } = await supabase
    .from("competitors")
    .select("id, url, url_changed_at")
    .eq("id", competitorId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingError) {
    return { ok: false, error: "Impossible de lire ce concurrent. Réessaie." };
  }
  if (!existing) {
    return { ok: false, error: "Ce concurrent n'existe plus. Recharge la page." };
  }

  const urlChanged = canonicalUrl(existing.url) !== canonicalUrl(validated.url);

  if (urlChanged) {
    // Une place de concurrent se remplace, mais pas en boucle : sans ce délai,
    // une place servirait de scanner illimité, et chaque remplacement relance un
    // cycle d'analyse payant.
    //
    // Comme la limite de 7 jours sur /api/compare, le délai ne s'applique qu'en
    // production : en développement il rendrait le produit intestable.
    const cooldownEnforced = process.env.NODE_ENV === "production";
    const allowance = checkCompetitorChange(
      existing.url_changed_at ? new Date(existing.url_changed_at) : null,
      new Date(),
    );

    if (cooldownEnforced && !allowance.allowed) {
      return {
        ok: false,
        error:
          `Ce concurrent a déjà été remplacé il y a moins de ${COMPETITOR_CHANGE_COOLDOWN_DAYS} jours. ` +
          `Prochain changement possible le ${formatNextChangeDate(allowance.nextChangeAt)}.`,
      };
    }

    const cleanup = await clearCompetitorHistory(existing.id, user.id);
    if (!cleanup.ok) return cleanup;
  }

  // `name` is reset only on a real change: it was the old competitor's name
  // and would otherwise label the new site. RLS already scopes this update to
  // the caller's rows; the explicit user_id filter is defense in depth.
  // Écriture via service_role : la migration guard_user_writes interdit au navigateur de
  // modifier url et url_changed_at, sans quoi le cooldown de remplacement tomberait.
  // Le filtre user_id reste obligatoire : c'est lui qui borne l'écriture à ce compte.
  const service = createServiceClient();
  const { error: updateError } = await service
    .from("competitors")
    .update(
      urlChanged
        ? { url: validated.url, name: null, url_changed_at: new Date().toISOString() }
        : { url: validated.url },
    )
    .eq("id", existing.id)
    .eq("user_id", user.id);

  if (updateError) {
    return { ok: false, error: "Impossible d'enregistrer ce concurrent. Réessaie." };
  }

  revalidateCompetitorRoutes();
  return { ok: true };
}

/**
 * Désigne le concurrent que les écrans ouvrent par défaut.
 *
 * Deux écritures sans transaction : on éteint d'abord, on rallume ensuite. Dans cet
 * ordre, un échec au milieu laisse l'utilisateur sans concurrent principal — la
 * sélection retombe alors sur le plus ancien (voir selection.ts) et rien n'est perdu.
 * L'ordre inverse pourrait laisser DEUX principaux, et le sélecteur afficherait deux
 * fois le même état par défaut.
 */
export async function setPrimaryCompetitor(competitorId: string): Promise<SetCompetitorResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Session expirée. Reconnecte-toi." };
  }

  const { error: clearError } = await supabase
    .from("competitors")
    .update({ is_primary: false })
    .eq("user_id", user.id)
    .eq("is_primary", true);

  if (clearError) {
    return { ok: false, error: "Impossible de changer de concurrent principal. Réessaie." };
  }

  const { error: setError } = await supabase
    .from("competitors")
    .update({ is_primary: true })
    .eq("id", competitorId)
    .eq("user_id", user.id);

  if (setError) {
    return { ok: false, error: "Impossible de changer de concurrent principal. Réessaie." };
  }

  revalidateCompetitorRoutes();
  return { ok: true };
}

/**
 * Le premier concurrent, écrit à la fin de l'onboarding.
 *
 * Alias d'`addCompetitor`, gardé pour que le parcours d'inscription n'ait pas à
 * connaître le vocabulaire des places : à ce moment-là le compte n'en occupe aucune,
 * et le palier le plus bas en ouvre une.
 */
export async function setCompetitor(url: string): Promise<SetCompetitorResult> {
  return addCompetitor(url);
}

/**
 * Efface ce qui décrivait le site précédent d'une place de concurrent.
 *
 * Nettoyé AVANT que l'URL ne soit écrite, jamais après : il n'y a pas de transaction
 * entre ces requêtes, et des deux échecs partiels possibles seul cet ordre est sûr.
 * Nettoyer puis échouer à écrire laisse l'ancien concurrent en place avec ses écarts
 * fermés — récupérable, une nouvelle analyse les redétecte (le dédoublonnage de
 * /api/compare ne regarde que les écarts encore `open`). Écrire puis échouer à
 * nettoyer afficherait d'anciens constats sous le nom du nouveau site : une
 * affirmation fabriquée, que le produit ne doit jamais faire.
 */
async function clearCompetitorHistory(
  competitorId: string,
  userId: string,
): Promise<SetCompetitorResult> {
  const supabase = await createClient();

  // Écarts passés en « ignoré » plutôt que supprimés : l'historique de ce qui a été
  // détecté reste intact et comptable dans /statistiques, il quitte seulement la file
  // ouverte. resolved_at est écrit dans la même requête que le statut qu'il décrit
  // (même règle que /tasks/actions.ts) pour que la date de clôture ne puisse pas
  // diverger du statut.
  const { error: gapsError } = await supabase
    .from("detected_gaps")
    .update({ status: "dismissed", resolved_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("competitor_id", competitorId)
    .eq("status", "open");

  if (gapsError) {
    return {
      ok: false,
      error: "Impossible de clôturer les écarts de l'ancien concurrent. Rien n'a été modifié.",
    };
  }

  // Les relevés, eux, sont supprimés. Ils continueraient de pointer le même
  // competitor_id en décrivant un site que l'utilisateur ne suit plus, et le
  // comparateur lit le DERNIER relevé de chaque côté — donc, jusqu'à la prochaine
  // analyse, le tableau afficherait les tarifs de l'ancien site sous le nom du
  // nouveau. Ce sont des pages publiques refetchables, pas des données écrites par
  // l'utilisateur : les supprimer ne perd rien et supprime la possibilité d'afficher
  // quelque chose de faux entre-temps.
  const { error: snapshotsError } = await supabase
    .from("site_snapshots")
    .delete()
    .eq("user_id", userId)
    .eq("competitor_id", competitorId);

  if (snapshotsError) {
    return {
      ok: false,
      error: "Impossible de supprimer les relevés de l'ancien concurrent. Réessaie.",
    };
  }

  return { ok: true };
}

/** Every screen that reads the competitor, its écarts, or its snapshots. */
function revalidateCompetitorRoutes(): void {
  revalidatePath("/concurrent");
  revalidatePath("/dashboard");
  revalidatePath("/tasks");
  revalidatePath("/score");
  revalidatePath("/statistiques");
}
