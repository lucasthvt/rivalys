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
    aliases: ["google"],
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
    aliases: ["apple"],
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
    aliases: ["microsoft"],
    label: "Microsoft",
    hosts: ["login.microsoftonline.com", "login.live.com"],
    textPatterns: [
      /(?:continuer|connecter|connexion|inscrire)\s+(?:\w+\s+){0,2}?avec\s+microsoft/i,
      /(?:continue|sign\s?in|sign\s?up|log\s?in)\s+with\s+microsoft/i,
    ],
  },
  {
    id: "github",
    aliases: ["github"],
    label: "GitHub",
    hosts: ["github.com/login/oauth"],
    textPatterns: [
      /(?:continuer|connecter|connexion|inscrire)\s+(?:\w+\s+){0,2}?avec\s+github/i,
      /(?:continue|sign\s?in|sign\s?up|log\s?in)\s+with\s+github/i,
    ],
  },
  {
    id: "facebook",
    aliases: ["facebook"],
    label: "Facebook",
    hosts: ["facebook.com/dialog/oauth", "facebook.com/v"],
    textPatterns: [
      /(?:continuer|connecter|connexion|inscrire)\s+(?:\w+\s+){0,2}?avec\s+facebook/i,
      /(?:continue|sign\s?in|sign\s?up|log\s?in)\s+with\s+facebook/i,
    ],
  },
  {
    id: "linkedin",
    aliases: ["linkedin"],
    label: "LinkedIn",
    hosts: ["linkedin.com/oauth"],
    textPatterns: [
      /(?:continuer|connecter|connexion|inscrire)\s+(?:\w+\s+){0,2}?avec\s+linkedin/i,
      /(?:continue|sign\s?in|sign\s?up|log\s?in)\s+with\s+linkedin/i,
    ],
  },
  {
    id: "openai",
    aliases: ["chatgpt", "openai"],
    label: "ChatGPT",
    hosts: ["auth.openai.com", "auth0.openai.com"],
    textPatterns: [
      /(?:continuer|connecter|connexion|inscrire)\s+(?:\w+\s+){0,2}?avec\s+(?:chatgpt|openai)/i,
      /(?:continue|sign\s?in|sign\s?up|log\s?in)\s+with\s+(?:chatgpt|openai)/i,
    ],
  },
  {
    id: "slack",
    aliases: ["slack"],
    label: "Slack",
    hosts: ["slack.com/openid", "slack.com/oauth"],
    textPatterns: [
      /(?:continuer|connecter|connexion|inscrire)\s+(?:\w+\s+){0,2}?avec\s+slack/i,
      /(?:continue|sign\s?in|sign\s?up|log\s?in)\s+with\s+slack/i,
    ],
  },
  {
    id: "passkey",
    aliases: [] as string[],
    label: "Clé d'accès",
    hosts: [],
    textPatterns: [/\bpasskeys?\b/i, /clés?\s+d[e']\s?accès/i],
  },
  {
    id: "email_code",
    aliases: [] as string[],
    label: "Code par email",
    hosts: [],
    textPatterns: [
      /code\s+(?:de\s+)?(?:connexion|vérification|à\s+usage\s+unique)/i,
      /(?:one[-\s]?time|login|verification)\s+code/i,
    ],
  },
  {
    id: "sso",
    aliases: [] as string[],
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
    aliases: [] as string[],
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

/**
 * Segments qui suivent une amorce de connexion tierce.
 *
 * Notion écrit « or continue with Google ChatGPT Apple Microsoft Passkey SSO » : une
 * seule amorce, puis la liste des boutons. Exiger « with » collé à chaque nom ne
 * reconnaissait que le premier. On isole donc ce qui suit l'amorce, et c'est là — et
 * seulement là — qu'un nom nu vaut preuve.
 *
 * La fenêtre est courte (160 caractères) et limitée au texte de la page de connexion :
 * un « Apple » de pied de page ou un lien vers l'App Store reste hors d'atteinte.
 */
const CONTINUE_WITH_RE =
  /(?:continue|continuer|sign\s?in|sign\s?up|log\s?in|se\s+connecter|s'inscrire)\s+(?:with|avec)\b([\s\S]{0,160})/gi;

function continuationWindows(text: string): string[] {
  return [...text.matchAll(CONTINUE_WITH_RE)].map((match) => match[1]);
}

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
  const text = input.loginPageText ?? "";
  const windows = text ? continuationWindows(text) : [];

  for (const provider of AUTH_PROVIDERS) {
    if (input.links.some((link) => matchesHost(link, provider.hosts))) {
      found.add(provider.id);
      continue;
    }
    if (text && provider.textPatterns.some((re) => re.test(text))) {
      found.add(provider.id);
      continue;
    }
    // Nom nu, mais uniquement dans la liste qui suit « continue with ».
    if (
      provider.aliases.length > 0 &&
      windows.some((window) =>
        provider.aliases.some((alias) => new RegExp(`\\b${alias}\\b`, "i").test(window)),
      )
    ) {
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
