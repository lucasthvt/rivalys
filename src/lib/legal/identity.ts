/**
 * Identité légale de l'éditeur, à un seul endroit.
 *
 * Ces valeurs apparaissent dans les mentions légales, les CGU et la politique de
 * confidentialité. Les tenir en trois copies garantissait qu'un jour l'une des trois
 * mentionne une ancienne adresse — ici, une correction se fait une fois.
 *
 * ────────────────────────────────────────────────────────────────────────────
 *  À COMPLÉTER AVANT LA MISE EN LIGNE PUBLIQUE. Tant qu'un champ vaut `null`,
 *  les pages légales affichent un avertissement visible plutôt qu'une identité
 *  inventée : des mentions légales incomplètes sont une infraction (article 6
 *  de la LCEN), des mentions légales fausses en sont une plus grave.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Obligations qui pèsent sur ces champs :
 *  - LCEN art. 6-III : dénomination, adresse, contact, responsable de publication.
 *  - RGPD art. 13 : identité et coordonnées du responsable de traitement (`contactEmail`
 *    est l'adresse par laquelle les droits s'exercent — elle doit être relevée).
 *  - Un DPO n'est PAS obligatoire ici (pas de suivi systématique à grande échelle, pas de
 *    données sensibles). Laisser `dpoEmail` à null est un choix valide et assumé.
 */

export type LegalIdentity = {
  /**
   * L'ÉDITEUR au sens juridique.
   *
   * Pour une société, sa raison sociale. Pour une entreprise individuelle, le nom civil de
   * l'entrepreneur — une EI n'a pas de personnalité morale distincte, donc pas de raison
   * sociale : le nom légal de l'entreprise EST celui de la personne. C'est d'ailleurs sous
   * ce nom qu'elle figure déjà au répertoire SIRENE, consultable publiquement.
   *
   * Y écrire un nom de marque rendrait la mention légale fausse.
   */
  companyName: string | null;
  /**
   * Nom commercial / enseigne, si différent du nom de l'éditeur. « Rivalys » pour une EI
   * exploitée sous cette marque. Purement informatif : il complète l'identité légale, il ne
   * la remplace jamais.
   */
  tradeName: string | null;
  /** Forme juridique : « SASU », « entreprise individuelle », … */
  legalForm: string | null;
  siret: string | null;
  /**
   * `true` tant que l'immatriculation est déposée mais que le SIRET n'est pas attribué.
   * Les pages légales écrivent alors « immatriculation en cours » — c'est un état réel et
   * annonçable, pas un trou. Repasser à `false` en renseignant `siret`.
   */
  registrationPending: boolean;
  /** Capital social, si société. `null` pour une entreprise individuelle. */
  shareCapital: string | null;
  /** Ville du greffe pour l'immatriculation au RCS, si société. */
  rcsCity: string | null;
  /**
   * Numéro de TVA intracommunautaire. `null` = franchise en base de TVA (cas par défaut
   * d'une micro-entreprise sous les seuils) : les prix affichés sont alors les prix payés,
   * aucune TVA n'est ajoutée, et la mention « TVA non applicable, article 293 B du CGI »
   * doit figurer sur les factures. Les CGU s'adaptent à cette valeur — ne pas la laisser à
   * `null` une fois le seuil franchi.
   */
  vatNumber: string | null;
  address: string | null;
  /**
   * Directeur de la publication (LCEN, article 6-III).
   *
   * Doit être une personne physique nommée : c'est elle qui répond du contenu publié. Un nom
   * de marque ou de société n'en tient pas lieu.
   *
   * Laisser à `null` pour une entreprise individuelle : la fonction revient forcément à
   * l'entrepreneur, et `publicationDirectorName()` reprend alors `companyName`. Ne le
   * renseigner que si la personne diffère de l'éditeur — cas d'une société.
   */
  publicationDirector: string | null;
  /** Adresse par laquelle s'exercent les droits RGPD. Doit être relevée. */
  contactEmail: string | null;
  /** Délégué à la protection des données, si désigné. Non obligatoire ici. */
  dpoEmail: string | null;
  /** Domaine de production, tel qu'il apparaîtra dans la barre d'adresse. */
  domain: string;
};

export const LEGAL_IDENTITY: LegalIdentity = {
  // Nom civil de l'entrepreneur, PAS « Rivalys » : voir le commentaire de `companyName`.
  companyName: null,
  tradeName: "Rivalys",
  legalForm: "entrepreneur individuel (micro-entreprise)",
  siret: null,
  registrationPending: true,
  shareCapital: null,
  rcsCity: null,
  vatNumber: null,
  address: null,
  publicationDirector: null,
  contactEmail: "rivalysai.contact@gmail.com",
  dpoEmail: null,
  domain: "rivalys.com",
};

/**
 * Champs sans lesquels les pages légales ne sont pas conformes.
 *
 * `siret` n'y figure pas : il est traité à part, parce qu'une immatriculation en cours est
 * un état légitime qui s'annonce, alors qu'une adresse manquante n'est qu'un oubli.
 */
const REQUIRED_FIELDS = [
  "companyName",
  "legalForm",
  "address",
  "contactEmail",
] as const satisfies readonly StringField[];

export function missingLegalFields(): string[] {
  const missing: string[] = REQUIRED_FIELDS.filter((field) => !LEGAL_IDENTITY[field]);
  // Un SIRET absent n'est acceptable que le temps de l'immatriculation. Sans ce drapeau,
  // c'est un champ manquant comme un autre.
  if (!LEGAL_IDENTITY.siret && !LEGAL_IDENTITY.registrationPending) missing.push("siret");
  return missing;
}

/**
 * Le directeur de la publication.
 *
 * Dérivé plutôt que saisi quand il n'est pas renseigné : en entreprise individuelle, la
 * fonction ne peut revenir qu'à l'entrepreneur. Une valeur à saisir de plus, c'est une
 * valeur de plus à saisir de travers — et l'erreur typique est justement d'y mettre le nom
 * de la marque.
 */
export function publicationDirectorName(): string {
  return LEGAL_IDENTITY.publicationDirector ?? legalField("companyName");
}

/** Comment nommer l'immatriculation, selon qu'elle est faite ou en cours. */
export function registrationLine(): string {
  if (LEGAL_IDENTITY.siret) return `SIRET ${LEGAL_IDENTITY.siret}`;
  if (LEGAL_IDENTITY.registrationPending) {
    return "immatriculation en cours, SIRET en attente d'attribution";
  }
  return "[siret — À COMPLÉTER]";
}

/** Assujettissement à la TVA. Détermine aussi ce que les CGU annoncent sur les prix. */
export function isVatRegistered(): boolean {
  return LEGAL_IDENTITY.vatNumber !== null;
}

export function isLegalIdentityComplete(): boolean {
  return missingLegalFields().length === 0;
}

/**
 * Valeur d'un champ, ou un marqueur explicite quand il manque.
 *
 * Le marqueur est volontairement laid et lisible : personne ne doit pouvoir mettre le site
 * en ligne sans le voir.
 */
type StringField = {
  [K in keyof LegalIdentity]: LegalIdentity[K] extends string | null ? K : never;
}[keyof LegalIdentity];

export function legalField(field: StringField): string {
  return LEGAL_IDENTITY[field] ?? `[${field} — À COMPLÉTER]`;
}

/** Adresse de contact pour l'exercice des droits, DPO en priorité s'il existe. */
export function privacyContact(): string {
  return LEGAL_IDENTITY.dpoEmail ?? legalField("contactEmail");
}
