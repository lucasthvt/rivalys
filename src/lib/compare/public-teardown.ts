import { createHmac } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";
import type { GapCandidate } from "@/lib/compare/detect-gaps";
import type { CoverageNotice } from "@/lib/compare/comparability";
import type { GapPriority, Json } from "@/lib/supabase/database.types";

/**
 * L'essai gratuit de la page d'accueil : ce qui le rend tenable financièrement.
 *
 * Une analyse coûte de vrais crédits Firecrawl, Claude et Perplexity. Offerte sans compte,
 * elle doit être bornée par trois choses, dans cet ordre de valeur :
 *
 *   1. le cache par paire — le levier principal. Le cinquantième visiteur qui compare les
 *      deux mêmes sites ne coûte rien, et il voit le résultat tout de suite ;
 *   2. le quota par visiteur — une analyse neuve, définitive. Une paire déjà en cache n'y
 *      est jamais décomptée : elle ne coûte rien, la refuser ne protégerait rien et
 *      fermerait la porte sans raison ;
 *   3. le plafond global journalier — le coupe-circuit. Il ne protège pas d'un visiteur,
 *      il protège d'un incident : une campagne, un lien viral, un script qui tourne les IP.
 *
 * Rien ici n'est un crawl autonome : on ne relève que des paires qu'un visiteur a saisies
 * lui-même, une par une.
 */

/** Analyses NEUVES autorisées par jour, tous visiteurs confondus. Coupe-circuit. */
export const DAILY_NEW_ANALYSES_CEILING = 60;

interface CachedRow {
  pair_key: string;
  own_url: string;
  competitor_url: string;
  result: FullResult;
  hit_count: number;
  created_at: string;
}

/** Ce que le pipeline produit, et qu'on conserve en entier côté serveur. */
export interface FullResult {
  ownLabel: string;
  competitorLabel: string;
  score: number;
  gaps: GapCandidate[];
  coverage: CoverageNotice | null;
}

/**
 * Ce qui part réellement au navigateur.
 *
 * Le reste n'est pas flouté : il n'est PAS ENVOYÉ. Un flou CSS reste lisible dans le
 * HTML — c'est déjà la règle de LockedResults, et elle vaut d'autant plus ici que la page
 * est publique. `hiddenCount` suffit à dessiner le bon nombre de lignes de gabarit.
 */
export interface PublicResult {
  ownLabel: string;
  competitorLabel: string;
  score: number;
  gapCount: number;
  counts: Record<GapPriority, number>;
  categories: string[];
  /** L'écart le plus prioritaire, en clair. La preuve que l'analyse est réelle. */
  featuredGap: GapCandidate | null;
  hiddenCount: number;
  /**
   * Les familles auxquelles appartiennent les écarts MASQUÉS, et elles seules.
   *
   * Envoyer toutes les catégories, celle de l'écart déjà montré comprise, faisait dire à
   * l'écran « les écarts restants touchent pricing et avis » là où le seul écart restant
   * portait sur les avis. Une phrase fausse sur un produit qui vend la justesse du relevé.
   */
  hiddenCategories: string[];
  coverage: CoverageNotice | null;
  /** Vrai quand le résultat vient du cache : aucun crédit dépensé, aucun quota consommé. */
  cached: boolean;
}

const PRIORITY_RANK: Record<GapPriority, number> = { high: 0, medium: 1, low: 2 };

export function toPublicResult(full: FullResult, cached: boolean): PublicResult {
  const gaps = [...full.gaps].sort(
    (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
  );

  const counts: Record<GapPriority, number> = { high: 0, medium: 0, low: 0 };
  for (const gap of gaps) counts[gap.priority] += 1;

  return {
    ownLabel: full.ownLabel,
    competitorLabel: full.competitorLabel,
    score: full.score,
    gapCount: gaps.length,
    counts,
    categories: [...new Set(gaps.map((g) => g.category))],
    featuredGap: gaps[0] ?? null,
    hiddenCount: Math.max(0, gaps.length - 1),
    hiddenCategories: [...new Set(gaps.slice(1).map((g) => g.category))],
    coverage: full.coverage,
    cached,
  };
}

/**
 * Deux écritures de la même adresse doivent produire la même clé, sinon le cache ne sert
 * à rien et chaque variante se repaye. On retire donc ce qui ne change pas le site visé :
 * casse, `www.`, slash final, requête et ancre.
 *
 * La clé reste DIRECTIONNELLE : « A comparé à B » n'est pas « B comparé à A », puisque le
 * score porte sur le premier des deux.
 */
export function normalizeUrl(raw: string): string {
  const url = new URL(raw);
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const path = url.pathname.replace(/\/+$/, "");
  return `${host}${path}`;
}

export function pairKey(ownUrl: string, competitorUrl: string): string {
  return `${normalizeUrl(ownUrl)}|${normalizeUrl(competitorUrl)}`;
}

/**
 * L'IP n'est jamais stockée en clair. Elle est une donnée personnelle, et le besoin se
 * limite à reconnaître « ce visiteur a déjà eu son essai » — un condensat le fait sans
 * conserver de quoi remonter à quelqu'un.
 *
 * HMAC plutôt qu'un simple SHA : l'espace des adresses IPv4 se parcourt entièrement en
 * quelques minutes, donc un condensat sans secret se renverse par force brute. Le secret
 * est donc ce qui tient toute la protection, et il ne doit jamais atteindre le navigateur.
 * D'où le nom : TEARDOWN_IP_SALT et non PUBLIC_TEARDOWN_IP_SALT, où le « PUBLIC » désignait
 * la fonctionnalité et se lisait comme une autorisation d'exposition.
 *
 * Sans secret configuré, la fonction renvoie null et l'appelant refuse de servir l'essai —
 * un garde-fou absent doit fermer, jamais ouvrir.
 */
export function hashIp(ip: string): string | null {
  const secret = process.env.TEARDOWN_IP_SALT?.trim();
  if (!secret) return null;
  return createHmac("sha256", secret).update(ip).digest("hex").slice(0, 32);
}

/**
 * L'adresse du visiteur derrière le proxy Vercel. `x-forwarded-for` peut contenir une
 * chaîne d'adresses : la première est le client d'origine.
 */
export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || null;
}

export async function readCachedResult(key: string): Promise<FullResult | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("public_teardowns")
    .select("result, hit_count")
    .eq("pair_key", key)
    .maybeSingle<Pick<CachedRow, "result" | "hit_count">>();

  if (error || !data) return null;

  // Le compteur mesure ce que le cache économise, et quelles comparaisons intéressent le
  // marché. Volontairement non attendu : un échec de comptage ne doit pas retarder ni
  // faire échouer la réponse du visiteur.
  void supabase
    .from("public_teardowns")
    .update({ hit_count: data.hit_count + 1 })
    .eq("pair_key", key);

  return data.result;
}

export async function writeCachedResult(
  key: string,
  ownUrl: string,
  competitorUrl: string,
  result: FullResult,
): Promise<void> {
  const supabase = createServiceClient();
  // upsert plutôt qu'insert : deux visiteurs peuvent lancer la même paire à la seconde
  // près, et le second ne doit pas échouer sur la clé primaire après avoir payé l'analyse.
  await supabase.from("public_teardowns").upsert(
    {
      pair_key: key,
      own_url: ownUrl,
      competitor_url: competitorUrl,
      // La colonne est en jsonb, donc typée `Json` côté client : une interface TypeScript
      // n'a pas d'index signature et ne s'y assigne pas directement. La forme est celle de
      // FullResult, relue telle quelle par readCachedResult.
      result: result as unknown as Json,
    },
    { onConflict: "pair_key" },
  );
}

export async function hasUsedFreeAnalysis(ipHash: string): Promise<boolean> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("public_teardown_quota")
    .select("ip_hash")
    .eq("ip_hash", ipHash)
    .maybeSingle();

  // En cas d'erreur de lecture, on considère le quota consommé. Impossible de savoir si le
  // visiteur y a droit ⇒ ne pas dépenser. Le message l'oriente vers l'inscription plutôt
  // que vers un mur.
  if (error) return true;
  return data !== null;
}

export async function markFreeAnalysisUsed(ipHash: string): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from("public_teardown_quota")
    .upsert({ ip_hash: ipHash }, { onConflict: "ip_hash" });
}

/**
 * Le coupe-circuit. Compte les analyses neuves des 24 dernières heures — celles-là seules
 * ont coûté quelque chose, les lectures de cache n'écrivent aucune ligne.
 */
export async function dailyCeilingReached(now: Date): Promise<boolean> {
  const supabase = createServiceClient();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const { count, error } = await supabase
    .from("public_teardowns")
    .select("pair_key", { count: "exact", head: true })
    .gte("created_at", since);

  // Même posture que le quota : si on ne peut pas mesurer la dépense, on ne dépense pas.
  if (error || count === null) return true;
  return count >= DAILY_NEW_ANALYSES_CEILING;
}
