/**
 * Quel concurrent l'écran affiche-t-il ?
 *
 * Depuis le multi-concurrent, tous les écrans de résultat (tableau de bord, tâches,
 * score, statistiques) parlent d'UN face-à-face à la fois. Lequel se décide ici, et
 * nulle part ailleurs : cinq écrans qui résolvent chacun leur sélection finissent par
 * ne pas être d'accord, et l'utilisateur voit alors des écarts qui ne correspondent
 * pas au concurrent nommé en haut de la page.
 *
 * Fonction pure, séparée des requêtes, pour que ces règles soient testables sans base.
 */

export interface SelectableCompetitor {
  id: string;
  is_primary: boolean;
  created_at: string;
}

/**
 * Ordre d'affichage du sélecteur : le concurrent principal d'abord, puis du plus
 * ancien au plus récent. L'ordre est stable d'un écran à l'autre — une liste qui se
 * réordonne en naviguant fait cliquer à côté.
 */
export function orderCompetitors<T extends SelectableCompetitor>(competitors: T[]): T[] {
  return [...competitors].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

/**
 * Résout la sélection demandée par l'URL (`?concurrent=<id>`).
 *
 * Un identifiant inconnu retombe sur le concurrent principal au lieu de vider l'écran.
 * C'est le cas d'un lien partagé, d'un signet, ou d'un concurrent dont l'URL a changé
 * de place : afficher « aucun résultat » laisserait croire que l'analyse n'a rien
 * trouvé, alors que la sélection est simplement caduque.
 */
export function resolveSelectedCompetitor<T extends SelectableCompetitor>(
  competitors: T[],
  requestedId?: string | null,
): T | null {
  const ordered = orderCompetitors(competitors);
  if (ordered.length === 0) return null;

  if (requestedId) {
    const requested = ordered.find((competitor) => competitor.id === requestedId);
    if (requested) return requested;
  }

  return ordered[0];
}
