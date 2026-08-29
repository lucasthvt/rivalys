/**
 * Constantes partagées entre l'action serveur de suppression et son écran.
 *
 * Elles vivent hors de `actions.ts` parce qu'un module « use server » ne peut exporter que
 * des fonctions asynchrones : toute autre valeur y casse la compilation.
 */

/** Mot exact que l'utilisateur doit taper pour confirmer la suppression de son compte. */
export const DELETE_CONFIRMATION = "SUPPRIMER";
