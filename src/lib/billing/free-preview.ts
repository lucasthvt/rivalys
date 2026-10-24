import { sortGapsByPriority, type DetectedGap, type GapPriority } from "@/components/tasks/priority";

/**
 * Ce qu'un compte au palier gratuit voit de son propre relevé.
 *
 * Avant, rien : le tableau de bord affichait un nombre d'écarts et un mur. L'utilisateur
 * avait donné deux URL, attendu l'analyse, et obtenu un chiffre qu'il n'avait aucun moyen
 * de croire. Le même doute se posait sur la page d'accueil, où l'analyse sans compte y
 * répondait en montrant UN écart en clair — la preuve que le relevé porte vraiment sur son
 * site. Ce module reprend cette règle et l'applique au relevé du compte, qui est la même
 * donnée en mieux : rattachée à un utilisateur, suivie dans le temps, convertible en tâches.
 *
 * La règle de non-divulgation est celle de LockedResults, et elle compte double ici : les
 * écarts masqués ne sont pas floutés, ils ne sont PAS ENVOYÉS. Un flou CSS reste lisible
 * dans le HTML. Ne sortent d'ici que l'écart offert, des décomptes et des noms de familles —
 * jamais le titre ni la description de ce qui reste derrière le mur.
 */

/** Un écart réduit à ce qui s'affiche. Pas la ligne complète : elle porte des identifiants. */
export interface PreviewGap {
  category: DetectedGap["category"];
  title: string;
  description: string;
  priority: GapPriority;
}

export interface FreePreview {
  /** Nombre total d'écarts ouverts sur ce face-à-face. */
  gapCount: number;
  /** Répartition par priorité de TOUS les écarts, offert compris. */
  counts: Record<GapPriority, number>;
  /**
   * L'écart le PLUS prioritaire, en clair.
   *
   * Le plus fort et non le plus faible : un aperçu mineur prouve seulement que le moteur
   * tourne, pas qu'il trouve. L'utilisateur doit repartir avec quelque chose qui vaut la
   * peine, c'est ce qui rend crédible l'idée qu'il en reste.
   */
  featuredGap: PreviewGap | null;
  hiddenCount: number;
  /**
   * Répartition par priorité des écarts MASQUÉS, et d'eux seuls.
   *
   * Calculé ici et non déduit de `counts` côté écran : quand tous les écarts partagent une
   * priorité, celui qu'on montre en fait partie, et `counts.high` surestimerait d'une unité
   * ce qui reste caché. L'écran annoncerait un écart prioritaire qui n'existe pas.
   */
  hiddenCounts: Record<GapPriority, number>;
  /**
   * Les familles des écarts MASQUÉS, et elles seules.
   *
   * Envoyer toutes les catégories, celle de l'écart déjà montré comprise, fait dire à
   * l'écran « les écarts restants touchent pricing et avis » là où le seul écart restant
   * porte sur les avis. Une phrase fausse sur un produit qui vend la justesse d'un relevé.
   */
  hiddenCategories: DetectedGap["category"][];
}

const EMPTY_COUNTS = (): Record<GapPriority, number> => ({ high: 0, medium: 0, low: 0 });

/**
 * Attend les écarts OUVERTS du face-à-face affiché. Un écart fermé ou ignoré n'est plus une
 * chose à rattraper : le compter ici gonflerait l'aperçu d'un travail déjà fait.
 */
export function buildFreePreview(
  gaps: readonly (Pick<DetectedGap, "category" | "title" | "description" | "priority"> & {
    created_at: string;
  })[],
): FreePreview {
  // Même tri que /tasks et que le plateau du tableau de bord : les trois écrans doivent
  // s'accorder sur lequel est « le plus prioritaire », sinon l'aperçu nomme un écart que la
  // liste payante classe ailleurs.
  const sorted = sortGapsByPriority([...gaps]);

  const counts = EMPTY_COUNTS();
  for (const gap of sorted) counts[gap.priority] += 1;

  const featured = sorted[0] ?? null;
  const hidden = sorted.slice(1);

  const hiddenCounts = EMPTY_COUNTS();
  for (const gap of hidden) hiddenCounts[gap.priority] += 1;

  return {
    gapCount: sorted.length,
    counts,
    featuredGap: featured
      ? {
          category: featured.category,
          title: featured.title,
          description: featured.description,
          priority: featured.priority,
        }
      : null,
    hiddenCount: hidden.length,
    hiddenCounts,
    hiddenCategories: [...new Set(hidden.map((gap) => gap.category))],
  };
}
