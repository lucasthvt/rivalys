/**
 * Bornes du formulaire d'avis, partagées entre le composant client et la route.
 *
 * Fichier séparé de queries.ts, et c'est structurel : queries.ts importe le client
 * Supabase serveur, donc `next/headers`. Un composant client qui aurait besoin des
 * bornes tirerait tout ça dans son bundle — ce que le build refuse, à juste titre.
 * Ici, il n'y a que des nombres.
 *
 * Elles doublent les contraintes CHECK de la migration 20260904000000 : le navigateur
 * les applique pour donner un message utile, la base les applique pour de vrai. Écrites
 * une seule fois pour qu'elles ne divergent pas — un formulaire qui accepte ce que la
 * base refuse produit une erreur incompréhensible pour la personne qui écrivait.
 */
export const TESTIMONIAL_LIMITS = {
  quote: { min: 20, max: 400 },
  author: { min: 2, max: 40 },
  role: { min: 2, max: 60 },
} as const;
