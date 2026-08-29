"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getStripe, isStripeConfigured } from "@/lib/billing/stripe";
import { DELETE_CONFIRMATION } from "./constants";

/**
 * Droits RGPD exerçables sans écrire à personne.
 *
 * L'article 15 (accès), l'article 20 (portabilité) et l'article 17 (effacement) n'imposent
 * pas un bouton — une demande par email suffit légalement. Mais la CNIL recommande le
 * libre-service, et surtout : un « écris-nous à cette adresse » suppose que quelqu'un lise
 * cette boîte et réponde sous un mois. Un bouton tient la promesse tout seul.
 */

export type ExportResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: string };

/**
 * Tout ce que la base sait de cette personne, dans un format lisible par une machine
 * comme demandé par l'article 20.
 *
 * Chaque lecture est filtrée sur l'identifiant de l'appelant en plus de la RLS : la RLS
 * suffit, mais un export est exactement l'endroit où une politique mal écrite se
 * transformerait en fuite de masse. Deux verrous valent mieux qu'un.
 *
 * Les colonnes `raw_homepage_html` / `raw_pricing_html` sont volontairement exclues : ce
 * sont des copies de pages publiques de sites tiers, pas des données personnelles
 * concernant l'utilisateur, et elles pèsent des mégaoctets qui rendraient le fichier
 * inexploitable. Les données qui en ont été extraites, elles, sont incluses.
 */
export async function exportMyData(): Promise<ExportResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Session expirée. Reconnecte-toi." };

  const [profile, competitors, snapshots, gaps, scores] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("competitors").select("*").eq("user_id", user.id),
    supabase
      .from("site_snapshots")
      .select("id, target_type, competitor_id, extracted_data, fetched_at")
      .eq("user_id", user.id),
    supabase.from("detected_gaps").select("*").eq("user_id", user.id),
    supabase.from("score_history").select("*").eq("user_id", user.id),
  ]);

  const failure =
    profile.error ?? competitors.error ?? snapshots.error ?? gaps.error ?? scores.error;
  if (failure) {
    console.error("[compte] export échoué", failure);
    return { ok: false, error: "Impossible de rassembler tes données. Réessaie." };
  }

  return {
    ok: true,
    data: {
      _export: {
        genere_le: new Date().toISOString(),
        service: "Rivalys",
        note: "Export des données personnelles au titre des articles 15 et 20 du RGPD. Le HTML brut des pages tierces récupérées n'est pas inclus : ce sont des copies de pages publiques, pas des données te concernant.",
      },
      compte: {
        id: user.id,
        email: user.email ?? null,
        cree_le: user.created_at,
        derniere_connexion: user.last_sign_in_at ?? null,
        fournisseurs: user.app_metadata?.providers ?? null,
      },
      profil: profile.data,
      concurrents: competitors.data,
      releves: snapshots.data,
      ecarts: gaps.data,
      historique_du_score: scores.data,
    },
  };
}

export type DeleteResult = { ok: true } | { ok: false; error: string };

/**
 * Efface le compte et tout ce qui y est rattaché.
 *
 * L'ordre compte. L'abonnement Stripe est résilié AVANT la suppression : une fois la ligne
 * `profiles` partie, plus rien ne relie ce client Stripe à qui que ce soit, et il
 * continuerait d'être débité tous les mois sans qu'aucun écran ne puisse le montrer. Si la
 * résiliation échoue, on s'arrête là et on le dit — mieux vaut un compte encore vivant
 * qu'un prélèvement orphelin.
 *
 * La suppression elle-même passe par `auth.admin.deleteUser` : toutes les tables du
 * produit descendent de `profiles.id`, lui-même en `on delete cascade` sur `auth.users`.
 * Une seule instruction efface donc profil, concurrents, relevés, écarts et historique.
 */
export async function deleteMyAccount(confirmation: string): Promise<DeleteResult> {
  if (confirmation.trim() !== DELETE_CONFIRMATION) {
    return { ok: false, error: `Tape ${DELETE_CONFIRMATION} pour confirmer.` };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Session expirée. Reconnecte-toi." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_subscription_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.stripe_subscription_id && isStripeConfigured()) {
    try {
      await getStripe().subscriptions.cancel(profile.stripe_subscription_id);
    } catch (error) {
      // `resource_missing` = l'abonnement n'existe plus chez Stripe (déjà résilié, ou
      // compte de test nettoyé). Rien à résilier, donc rien qui empêche de continuer.
      const code = (error as { code?: string })?.code;
      if (code !== "resource_missing") {
        console.error("[compte] résiliation Stripe avant suppression échouée", error);
        return {
          ok: false,
          error:
            "Ton abonnement n'a pas pu être résilié, donc le compte n'a pas été supprimé — sinon tu continuerais d'être débité. Réessaie dans un instant.",
        };
      }
    }
  }

  const service = createServiceClient();
  const { error } = await service.auth.admin.deleteUser(user.id);

  if (error) {
    console.error("[compte] suppression du compte échouée", error);
    return { ok: false, error: "La suppression a échoué. Rien n'a été supprimé." };
  }

  return { ok: true };
}
