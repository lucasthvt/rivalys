"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canonicalHostname, canonicalUrl, isLikelyUrl, normalizeUrl } from "@/lib/url";

export type SetCompetitorResult = { ok: true } | { ok: false; error: string };

/**
 * Adds the user's primary competitor, or replaces the one already tracked.
 *
 * There is exactly one primary competitor per user in the MVP, so this is an
 * upsert-by-hand: insert when none exists, update the existing row otherwise.
 * The row is never deleted and recreated — `detected_gaps.competitor_id` and
 * `site_snapshots.competitor_id` are foreign keys onto `competitors.id`, and
 * dropping the row would either cascade their history away or fail outright.
 */
export async function setCompetitor(url: string): Promise<SetCompetitorResult> {
  const raw = url.trim();

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Session expirée. Reconnecte-toi." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("saas_url")
    .eq("id", user.id)
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

  const { data: existing, error: existingError } = await supabase
    .from("competitors")
    .select("id, url")
    .eq("user_id", user.id)
    .eq("is_primary", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    return { ok: false, error: "Impossible de lire ton concurrent actuel. Réessaie." };
  }

  if (!existing) {
    const { error: insertError } = await supabase.from("competitors").insert({
      user_id: user.id,
      url: nextUrl,
      is_primary: true,
    });

    if (insertError) {
      return { ok: false, error: "Impossible d'enregistrer ce concurrent. Réessaie." };
    }

    revalidateCompetitorRoutes();
    return { ok: true };
  }

  const urlChanged = canonicalUrl(existing.url) !== canonicalUrl(nextUrl);

  if (urlChanged) {
    // The rows below describe the OLD competitor. Once the URL points
    // somewhere else they stop being true, and they are attributed to the
    // competitor the user now tracks — so they cannot silently survive the
    // change.
    //
    // Cleaned up BEFORE the URL is written, not after: there is no
    // transaction across these statements, and of the two possible partial
    // failures only this order is safe. Cleaning first and then failing to
    // update leaves the old competitor in place with its écarts closed —
    // recoverable, since a new analysis re-detects them (the dedup in
    // /api/compare only looks at gaps still `open`). Updating first and then
    // failing to clean would display old findings as if they were about the
    // new site: a fabricated claim, which the product must never make.

    // Écarts are dismissed rather than deleted: the user's history of what
    // was once detected stays intact and countable in /statistiques, they
    // just leave the open list. resolved_at is stamped in the same statement
    // as the status it describes (same rule as /tasks/actions.ts) so the
    // closure date can never drift from the status.
    const { error: gapsError } = await supabase
      .from("detected_gaps")
      .update({ status: "dismissed", resolved_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("competitor_id", existing.id)
      .eq("status", "open");

    if (gapsError) {
      return {
        ok: false,
        error: "Impossible de clôturer les écarts de l'ancien concurrent. Rien n'a été modifié.",
      };
    }

    // Snapshots ARE deleted. They keep pointing at the same competitor_id
    // while describing a site the user no longer tracks, and the comparator
    // reads the LATEST snapshot per side — so until a fresh analysis runs,
    // the dashboard's comparison table would present the old site's pricing
    // under the new competitor's name. They are re-fetchable public pages,
    // not user-authored data, so deleting them loses nothing and removes the
    // possibility of showing something false in the meantime.
    const { error: snapshotsError } = await supabase
      .from("site_snapshots")
      .delete()
      .eq("user_id", user.id)
      .eq("competitor_id", existing.id);

    if (snapshotsError) {
      return {
        ok: false,
        error: "Impossible de supprimer les relevés de l'ancien concurrent. Réessaie.",
      };
    }
  }

  // `name` is reset only on a real change: it was the old competitor's name
  // and would otherwise label the new site. RLS already scopes this update to
  // the caller's rows; the explicit user_id filter is defense in depth.
  const { error: updateError } = await supabase
    .from("competitors")
    .update(urlChanged ? { url: nextUrl, name: null } : { url: nextUrl })
    .eq("id", existing.id)
    .eq("user_id", user.id);

  if (updateError) {
    return { ok: false, error: "Impossible d'enregistrer ce concurrent. Réessaie." };
  }

  revalidateCompetitorRoutes();
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
