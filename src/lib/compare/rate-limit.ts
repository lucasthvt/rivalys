// Cost guard for POST /api/compare. Per CLAUDE.md ("Mise à jour périodique, pas temps réel
// […] jamais un fetch complet à chaque clic utilisateur"), the refresh stays MANUAL — no
// cron — but a user cannot pay for a full pipeline run (4 Firecrawl credits, 2-3 Claude
// calls, sometimes a Perplexity call) more than once a day.
//
// Everything here is pure: the route handler reads the last-run timestamp from the DB and
// hands it over, so no clock arithmetic lives in the route and every branch is unit-tested.
//
// --- Which timestamp counts as "the last run"? --------------------------------------
// We use the most recent site_snapshots.fetched_at for the user, whichever side wrote it.
//
// Not score_history: a score row is also written on runs where one side's fetch failed and
// the comparison fell back to a cached snapshot, and on runs that produced nothing new.
//
// Not "the last run where BOTH sides produced a snapshot" either, which would be the
// forgiving option. That escape hatch has a hole big enough to defeat the whole limit: a
// competitor site that permanently blocks fetching never forms a pair, so the limit would
// never engage and the user could burn credits without bound — exactly the spend this
// guard exists to cap. The mirror risk (a run wrote one side then failed, and the user is
// still blocked 24 h) is real but bounded, and much smaller in practice: the route re-reads
// the latest snapshot per side and falls back to the cached one, so a half-failed run still
// yields a comparison as soon as any earlier snapshot exists. Only a brand-new user whose
// very first run half-failed waits without a result — and that run still cost real money,
// which is what we are metering.

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_MINUTE = 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/**
 * Une analyse par semaine, tous paliers confondus.
 *
 * Chaque exécution coûte de vrais crédits (voir plus haut), et les pages de tarifs d'un
 * concurrent bougent rarement : relire une page inchangée chaque jour ne rend rien à
 * l'utilisateur, mais coûte 30 exécutions par mois au lieu de 4. Le palier gratuit en
 * relance aussi depuis le tableau de bord, donc la limite le borne autant que Pro.
 *
 * `ANALYSIS_COOLDOWN_LABEL` dit la même durée en français, pour les messages : les deux
 * sont déclarés côte à côte pour qu'on ne change pas l'une sans l'autre.
 */
export const ANALYSIS_COOLDOWN_MS = 7 * MS_PER_DAY;
export const ANALYSIS_COOLDOWN_LABEL = "7 jours";

export type AnalysisRateLimitDecision =
  | { allowed: true }
  | { allowed: false; retryAt: Date };

/**
 * Parses a Postgres timestamptz string (site_snapshots.fetched_at) into a Date.
 * Returns null for a missing or unparseable value, which callers treat as "no known
 * previous run" — a corrupt timestamp must never lock a user out of their own product.
 */
export function parseLastRunAt(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Decides whether this user may trigger a new analysis now.
 *
 * The cooldown window is closed at its end: a run is allowed again once exactly
 * ANALYSIS_COOLDOWN_MS has elapsed, not a millisecond later.
 *
 * A last-run timestamp in the future (clock skew between the DB and the app) simply keeps
 * the user waiting until it plus the cooldown — safe by construction, and it cannot be used
 * to bypass the limit.
 */
export function checkAnalysisRateLimit(
  lastRunAt: Date | null,
  now: Date,
): AnalysisRateLimitDecision {
  if (lastRunAt === null || Number.isNaN(lastRunAt.getTime())) return { allowed: true };

  const retryAt = new Date(lastRunAt.getTime() + ANALYSIS_COOLDOWN_MS);
  if (now.getTime() >= retryAt.getTime()) return { allowed: true };

  return { allowed: false, retryAt };
}

/** Value for the standard `Retry-After` HTTP header, in whole seconds (always >= 1). */
export function retryAfterSeconds(retryAt: Date, now: Date): number {
  return Math.max(1, Math.ceil((retryAt.getTime() - now.getTime()) / 1000));
}

/**
 * Human-readable remaining wait: days from 24 h up, hours from 1 h up, minutes below that.
 *
 * Always rounded UP, so the announced delay is never shorter than the real one — telling
 * someone "dans 7 h" and refusing them again at 7 h would be the annoying kind of wrong.
 * No raw timestamp is ever exposed to the user.
 */
export function formatRetryDelay(retryAt: Date, now: Date): string {
  const remainingMs = Math.max(0, retryAt.getTime() - now.getTime());

  if (remainingMs >= MS_PER_DAY) {
    const days = Math.ceil(remainingMs / MS_PER_DAY);
    return days === 1 ? "1 jour" : `${days} jours`;
  }
  if (remainingMs >= MS_PER_HOUR) {
    return `${Math.ceil(remainingMs / MS_PER_HOUR)} h`;
  }
  return `${Math.max(1, Math.ceil(remainingMs / MS_PER_MINUTE))} min`;
}

/** User-facing French message returned with the 429. */
export function rateLimitMessage(retryAt: Date, now: Date): string {
  return `Analyse déjà effectuée il y a moins de ${ANALYSIS_COOLDOWN_LABEL}. La prochaine sera possible dans ${formatRetryDelay(retryAt, now)}.`;
}
