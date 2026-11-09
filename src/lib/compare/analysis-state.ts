import { ANALYSIS_COOLDOWN_MS, formatRetryDelay } from "@/lib/compare/rate-limit";

/**
 * Pourquoi ce face-à-face n'a pas de relevé, quand il n'en a pas.
 *
 * Le tableau de bord lisait cette absence d'une seule façon : « aucune analyse pour ce
 * concurrent ». Or elle recouvre deux situations opposées, et l'écran annonçait la mauvaise.
 *
 * Une analyse lit NOTRE site puis celui d'en face. Quand le second échoue — site qui bloque,
 * page injoignable, extraction qui n'aboutit pas — le premier relevé est quand même écrit,
 * et c'est lui qui arme la limite de 7 jours (voir rate-limit.ts, qui compte le relevé le plus
 * récent du compte, quel que soit le côté). L'écran disait donc « aucune analyse » pendant
 * que le bouton répondait « analyse déjà effectuée il y a moins de 7 jours ». Deux phrases qui
 * se contredisent à trois centimètres d'écart, sur un produit qui vend la justesse d'un
 * relevé : l'utilisateur conclut, à raison, que quelque chose est cassé.
 *
 * Ce module ne décide de rien — il nomme ce qui s'est passé pour que l'écran le dise.
 */

export type MissingSnapshotReason =
  /** Jamais analysé, et rien ne s'y oppose : le bouton va marcher. */
  | { kind: "pending" }
  /**
   * Une analyse a bien tourné, après l'ajout de ce concurrent, et n'a produit aucun relevé
   * de son côté. Son site n'a pas pu être lu. La limite de 7 jours court depuis cette analyse.
   */
  | { kind: "failed"; lastRunAt: Date; retryAt: Date; retryIn: string };

/**
 * `lastRunAt` est le relevé le plus récent du COMPTE, tous côtés confondus — exactement la
 * valeur dont /api/compare se sert pour appliquer la limite. C'est ce qui garantit que
 * l'écran et le bouton racontent la même histoire.
 *
 * `trackedSince` est la date à laquelle ce concurrent est devenu celui qu'on suit
 * (`url_changed_at`, sinon `created_at`) : une analyse antérieure à cette date ne portait
 * pas sur lui, et son absence de relevé n'est donc pas un échec.
 */
export function explainMissingSnapshot({
  lastRunAt,
  trackedSince,
  now,
}: {
  lastRunAt: Date | null;
  trackedSince: Date | null;
  now: Date;
}): MissingSnapshotReason {
  if (lastRunAt === null) return { kind: "pending" };

  // Concurrent ajouté (ou changé) après la dernière analyse : elle ne le concernait pas.
  // Même test que `isNewPair` dans /api/compare, qui lève la limite dans ce cas précis.
  if (trackedSince !== null && trackedSince.getTime() > lastRunAt.getTime()) {
    return { kind: "pending" };
  }

  const retryAt = new Date(lastRunAt.getTime() + ANALYSIS_COOLDOWN_MS);

  // La limite est déjà passée : rien n'empêche de relancer, inutile d'annoncer un délai.
  if (now.getTime() >= retryAt.getTime()) {
    return { kind: "pending" };
  }

  return {
    kind: "failed",
    lastRunAt,
    retryAt,
    retryIn: formatRetryDelay(retryAt, now),
  };
}
