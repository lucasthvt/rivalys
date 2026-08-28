// Détection déterministe des moyens de connexion proposés publiquement par un site.
// Aucun LLM, aucune supposition : soit la page de connexion affiche « continuer avec
// Google », soit elle pointe vers un point d'entrée OAuth du fournisseur, soit on
// n'affirme rien.
//
// La revendication est volontairement étroite. « La page de connexion publique propose
// Google » n'est PAS « ce produit gère Google » : un SSO d'entreprise peut n'exister que
// sur une page dédiée aux comptes payants, invisible ici. Tout écart construit là-dessus
// doit dire exactement ce qui a été observé, et rien de plus (voir detect-gaps.ts).

export const AUTH_PROVIDERS = [
  {
    id: "google",
    label: "Google",
    hosts: ["accounts.google.com"],
    // Le mot « Google » seul ne prouve rien (Google Analytics, intégration Workspace) :
    // il ne compte que collé à un verbe de connexion.
    textPatterns: [
      /(?:continuer|connecter|connexion|inscrire|s'identifier)\s+(?:\w+\s+){0,2}?avec\s+google/i,
      /(?:continue|sign\s?in|sign\s?up|log\s?in)\s+with\s+google/i,
      /google\s+(?:sign[-\s]?in|oauth|login)/i,
    ],
  },
  {
    id: "apple",
    label: "Apple",
    hosts: ["appleid.apple.com"],
    textPatterns: [
      /(?:continuer|connecter|connexion|inscrire|s'identifier)\s+(?:\w+\s+){0,2}?avec\s+apple/i,
      /(?:continue|sign\s?in|sign\s?up|log\s?in)\s+with\s+apple/i,
      /sign\s?in\s+with\s+apple/i,
    ],
  },
  {
    id: "microsoft",
    label: "Microsoft",
    hosts: ["login.microsoftonline.com", "login.live.com"],
    textPatterns: [
      /(?:continuer|connecter|connexion|inscrire)\s+(?:\w+\s+){0,2}?avec\s+microsoft/i,
      /(?:continue|sign\s?in|sign\s?up|log\s?in)\s+with\s+microsoft/i,
    ],
  },
  {
    id: "github",
    label: "GitHub",
    hosts: ["github.com/login/oauth"],
    textPatterns: [
      /(?:continuer|connecter|connexion|inscrire)\s+(?:\w+\s+){0,2}?avec\s+github/i,
      /(?:continue|sign\s?in|sign\s?up|log\s?in)\s+with\s+github/i,
    ],
  },
  {
    id: "facebook",
    label: "Facebook",
    hosts: ["facebook.com/dialog/oauth", "facebook.com/v"],
    textPatterns: [
      /(?:continuer|connecter|connexion|inscrire)\s+(?:\w+\s+){0,2}?avec\s+facebook/i,
      /(?:continue|sign\s?in|sign\s?up|log\s?in)\s+with\s+facebook/i,
    ],
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    hosts: ["linkedin.com/oauth"],
    textPatterns: [
      /(?:continuer|connecter|connexion|inscrire)\s+(?:\w+\s+){0,2}?avec\s+linkedin/i,
      /(?:continue|sign\s?in|sign\s?up|log\s?in)\s+with\s+linkedin/i,
    ],
  },
  {
    id: "sso",
    label: "SSO / SAML",
    hosts: [],
    textPatterns: [
      /\bsaml\b/i,
      /\bsso\b/i,
      /single\s+sign[-\s]?on/i,
      /(?:connexion|connecter)\s+(?:\w+\s+){0,2}?entreprise/i,
    ],
  },
  {
    id: "magic_link",
    label: "Lien magique",
    hosts: [],
    textPatterns: [
      /lien\s+magique/i,
      /magic\s+link/i,
      /(?:connexion|se\s+connecter)\s+sans\s+mot\s+de\s+passe/i,
      /passwordless/i,
    ],
  },
] as const;

export type AuthProviderId = (typeof AUTH_PROVIDERS)[number]["id"];

const AUTH_LABEL_BY_ID = new Map<string, string>(AUTH_PROVIDERS.map((p) => [p.id, p.label]));

function matchesHost(link: string, fragments: readonly string[]): boolean {
  if (fragments.length === 0) return false;
  let normalized: string;
  try {
    const parsed = new URL(link);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    normalized = `${parsed.hostname.toLowerCase().replace(/^www\./, "")}${parsed.pathname}`;
  } catch {
    return false;
  }
  return fragments.some((fragment) => normalized.includes(fragment.replace(/^www\./, "")));
}

/**
 * Moyens de connexion observés, dans l'ordre stable d'AUTH_PROVIDERS (la sortie alimente
 * un titre d'écart, dédupliqué par chaîne exacte).
 *
 * `loginPageText` est le texte de la page de connexion, et lui seul est confronté aux
 * motifs textuels : sur une page d'accueil, « avec Google » parle d'une intégration
 * Workspace neuf fois sur dix. Les liens, eux, peuvent venir de n'importe quelle page —
 * un lien vers accounts.google.com est un point d'entrée OAuth, pas une mention.
 */
export function detectAuthMethods(input: {
  loginPageText: string | null;
  links: readonly string[];
}): AuthProviderId[] {
  const found = new Set<AuthProviderId>();

  for (const provider of AUTH_PROVIDERS) {
    if (input.links.some((link) => matchesHost(link, provider.hosts))) {
      found.add(provider.id);
      continue;
    }
    if (input.loginPageText && provider.textPatterns.some((re) => re.test(input.loginPageText!))) {
      found.add(provider.id);
    }
  }

  return AUTH_PROVIDERS.filter((p) => found.has(p.id)).map((p) => p.id);
}

export function labelAuthMethods(ids: readonly string[]): string[] {
  return ids.map((id) => AUTH_LABEL_BY_ID.get(id) ?? id);
}

/** Moyens présents chez le concurrent et absents chez nous, ordre stable conservé. */
export function missingAuthMethods(
  own: readonly string[],
  competitor: readonly string[],
): string[] {
  const mine = new Set(own);
  return competitor.filter((id) => !mine.has(id));
}
