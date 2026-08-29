/**
 * Politique de mot de passe, côté navigateur.
 *
 * Elle DOUBLE la règle serveur, elle ne la remplace pas : la vérité est dans
 * `supabase/config.toml` (`minimum_password_length`, `password_requirements`) et dans le
 * réglage correspondant du tableau de bord Supabase en production. Ce fichier existe pour
 * dire à la personne ce qui manque pendant qu'elle tape, plutôt que de lui renvoyer une
 * erreur anglaise après l'envoi du formulaire.
 *
 * Le seuil vient de la recommandation CNIL (délibération 2022-100) pour un mot de passe
 * utilisé seul, sans second facteur ni blocage de compte après échecs : 12 caractères
 * minimum, avec majuscules, minuscules, chiffres et caractères spéciaux.
 */

export const PASSWORD_MIN_LENGTH = 12;

export type PasswordRule = {
  id: string;
  label: string;
  test: (value: string) => boolean;
};

export const PASSWORD_RULES: PasswordRule[] = [
  {
    id: "length",
    label: `${PASSWORD_MIN_LENGTH} caractères minimum`,
    test: (value) => value.length >= PASSWORD_MIN_LENGTH,
  },
  {
    id: "lower",
    label: "une minuscule",
    test: (value) => /[a-z]/.test(value),
  },
  {
    id: "upper",
    label: "une majuscule",
    test: (value) => /[A-Z]/.test(value),
  },
  {
    id: "digit",
    label: "un chiffre",
    test: (value) => /\d/.test(value),
  },
  {
    id: "symbol",
    label: "un caractère spécial",
    // Tout ce qui n'est ni lettre, ni chiffre, ni espace. Défini par exclusion plutôt que
    // par une liste : une liste finit toujours par refuser un symbole légitime.
    test: (value) => /[^\p{L}\p{N}\s]/u.test(value),
  },
];

export function passwordFailures(value: string): PasswordRule[] {
  return PASSWORD_RULES.filter((rule) => !rule.test(value));
}

export function isPasswordAcceptable(value: string): boolean {
  return passwordFailures(value).length === 0;
}
