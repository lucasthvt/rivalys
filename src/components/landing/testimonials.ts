/**
 * Avis clients affichés sur la landing.
 *
 * Deux tableaux, et la distinction entre les deux est le point important de ce
 * fichier.
 *
 * `TESTIMONIALS` — les vrais. Vide tant qu'aucun retour réel n'a été collecté.
 * Depuis la transposition de la directive Omnibus (2019/2161) en mai 2022,
 * afficher un avis client suppose de pouvoir démontrer qu'il émane d'un
 * utilisateur réel du produit ; un avis fabriqué relève de la pratique
 * commerciale trompeuse (art. L121-2 du code de la consommation). Ne remplis
 * ce tableau qu'avec des retours réellement reçus, et garde la trace de leur
 * origine ailleurs (email, ticket, formulaire).
 *
 * `DEMO_TESTIMONIALS` — du faux, pour voir le rendu de la bande pendant qu'on
 * la dessine. Il n'est lu qu'en `NODE_ENV === "development"` (voir ProofBand),
 * donc un `next build` le supprime purement et simplement : le bundle de
 * production ne le contient pas. C'est ce qui empêche du contenu inventé de
 * partir en ligne par oubli.
 *
 * Le champ `author` est ce que la personne accepte de voir publié — prénom,
 * pseudo, nom de son SaaS. Pas d'identité complète sans son accord explicite.
 */
export type Testimonial = {
  quote: string;
  author: string;
  /** Contexte court : « fondateur, <SaaS> ». Facultatif. */
  role?: string;
};

export const TESTIMONIALS: Testimonial[] = [];

/**
 * Faux avis — aperçu de mise en page uniquement, jamais servis en production.
 *
 * Longueurs volontairement inégales : c'est le cas qui casse une bande mal
 * construite, et celui qu'on aura en vrai. Les pseudos suivent la forme qu'on
 * voit réellement sur ce genre de page (prénom collé à des chiffres, handle en
 * minuscules), pour que le rendu typographique soit représentatif.
 */
export const DEMO_TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "J'ai découvert en trente secondes que mon concurrent proposait un essai gratuit depuis six mois. Personne ne me l'avait dit.",
    author: "VictorH718",
    role: "fondateur, outil de facturation",
  },
  {
    quote: "Quatre paliers chez lui, deux chez moi. J'ai arrêté de deviner pourquoi je perdais des deals.",
    author: "kykyleroi",
    role: "fondateur solo",
  },
  {
    quote:
      "Ce que j'aime, c'est que ça ne me sort pas un plan growth de trois pages. Cinq lignes, chacune reliée à un truc vérifiable sur son site.",
    author: "yanisbgd",
  },
  {
    quote: "La fiche G2 qui me manquait, je l'ai créée le soir même. Le score est remonté à l'analyse suivante.",
    author: "Marion_L",
    role: "fondatrice, SaaS RH",
  },
  {
    quote:
      "Zéro chiffre inventé sur mon concurrent, et c'est exactement pour ça que je fais confiance au reste.",
    author: "thomas.dev",
    role: "CTO, plateforme e-commerce",
  },
  {
    quote: "J'ai relancé l'analyse un mois après. Deux écarts refermés, un nouveau apparu. C'est le seul suivi que je regarde.",
    author: "Nass2210",
    role: "fondateur, SaaS marketing",
  },
];
