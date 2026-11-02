/**
 * Le budget de temps d'une analyse.
 *
 * Le pipeline enchaîne une dizaine d'appels réseau vers trois prestataires (Firecrawl,
 * Claude, Perplexity). Chacun avait son propre délai d'attente, généreux et indépendant des
 * autres : additionnés, ils autorisaient une analyse de plus de deux minutes. L'utilisateur,
 * lui, regarde un écran de chargement.
 *
 * Un délai par appel ne peut pas borner un total — seule une horloge partagée le peut. Elle
 * est démarrée une fois par COMPARAISON (notre site contre un concurrent) et traverse le
 * pipeline ; chaque appel reçoit comme délai le plus court entre le sien et ce qui reste du
 * budget, et chaque étage OPTIONNEL se saute quand il ne reste plus de quoi l'exécuter
 * utilement.
 *
 * Par comparaison et non par requête : un compte Growth suit jusqu'à trois concurrents,
 * traités l'un après l'autre. Une horloge unique pour toute la requête serait épuisée au
 * deuxième, dont les relevés échoueraient tous — on aurait troqué des analyses lentes
 * contre des analyses absentes. Ce que la promesse des 30 s borne, c'est l'attente devant
 * UNE comparaison ; /api/compare déclare sa propre durée maximale pour la boucle.
 *
 * Sauter un étage ne produit jamais de donnée inventée : le contrat null-vs-[] de
 * site-data.ts distingue déjà « on n'a pas mesuré » de « on a mesuré et il n'y a rien », et
 * un relevé non effectué reste du premier côté. Une analyse plus rapide est donc une analyse
 * parfois moins complète, jamais une analyse moins honnête.
 */

/**
 * Budget total d'une analyse visible par un utilisateur qui attend.
 *
 * 26 s et non 30 : au budget s'ajoutent le temps de la requête HTTP, les écritures en base
 * et le démarrage de la fonction. C'est la part réseau du pipeline qui est bornée ici, pas
 * la réponse complète — et la promesse porte sur la réponse complète.
 */
export const ANALYSIS_BUDGET_MS = 26_000;

/**
 * Plancher d'un appel OBLIGATOIRE. Avec un budget épuisé, `capTimeout` renverrait zéro et
 * l'appel serait annulé avant d'être parti : autant ne pas l'avoir tenté. On lui laisse de
 * quoi aboutir dans le meilleur des cas plutôt que de garantir son échec.
 *
 * Les étages optionnels n'en ont pas besoin : ils se gardent avec `hasRoomFor`, qui dit non
 * franchement au lieu de tenter un appel condamné.
 */
const MIN_REQUIRED_TIMEOUT_MS = 1_500;

export interface Deadline {
  /** Millisecondes restantes, jamais négatif. */
  remainingMs(): number;
  /**
   * Délai à passer à un appel qui demanderait `wantedMs` : le plus court des deux, avec le
   * plancher ci-dessus pour ne jamais annuler un appel obligatoire avant son départ.
   *
   * `attempts` est le nombre TOTAL de tentatives que l'appelant autorise, réessais compris.
   * Il compte : le SDK Anthropic applique le délai à chacune, et il le reçoit une seule
   * fois, calculé au départ. Un appel à deux tentatives et 16 s de délai peut donc occuper
   * 32 s — plus que le budget entier. On divise ce qui reste par le nombre de tentatives,
   * pour que le pire cas de l'appel COMPLET tienne dedans.
   */
  capTimeout(wantedMs: number, attempts?: number): number;
  /**
   * Reste-t-il de quoi exécuter un étage optionnel qui a besoin de `ms` ? Un `false` fait
   * sauter l'étage, et le relevé correspondant reste « non observé ».
   */
  hasRoomFor(ms: number): boolean;
}

/**
 * Démarre une horloge. `now` est injectable pour les tests — c'est la seule dépendance de
 * ce module, et la rendre explicite évite d'avoir à manipuler le temps réel pour vérifier
 * les bornes.
 */
export function startDeadline(
  budgetMs: number = ANALYSIS_BUDGET_MS,
  now: () => number = Date.now,
): Deadline {
  const startedAt = now();
  const remaining = () => Math.max(0, budgetMs - (now() - startedAt));

  return {
    remainingMs: remaining,
    // Math.floor et non une simple division : le SDK Anthropic REFUSE un délai à virgule
    // (« timeout must be an integer ») et l'appel part en erreur réseau. La division par le
    // nombre de tentatives en produisait un dès que les millisecondes restantes étaient
    // impaires — soit une extraction sur deux, au hasard de l'horloge. En arrondissant vers
    // le bas, le pire cas de l'appel complet reste sous le budget.
    capTimeout: (wantedMs, attempts = 1) =>
      Math.max(
        MIN_REQUIRED_TIMEOUT_MS,
        Math.floor(Math.min(wantedMs, remaining() / Math.max(1, attempts))),
      ),
    hasRoomFor: (ms) => remaining() >= ms,
  };
}

/**
 * Horloge sans borne, pour les appelants qui n'ont personne devant un écran de chargement
 * (scripts, tests). Explicite plutôt que l'absence d'argument : « pas de budget » doit être
 * un choix écrit, pas un oubli.
 */
export const UNBOUNDED: Deadline = {
  remainingMs: () => Number.POSITIVE_INFINITY,
  capTimeout: (wantedMs: number) => wantedMs,
  hasRoomFor: () => true,
};
