// Détection déterministe des moyens de paiement AFFICHÉS publiquement par un site.
//
// Limite structurelle, à répéter partout où ces données sortent : un tunnel de paiement
// vit derrière un compte. Ce qu'on relève ici, ce sont les moyens qu'un site annonce sur
// ses pages publiques — badges de pied de page, mentions « nous acceptons », widgets de
// paiement chargés sur la page de tarifs. Ne rien trouver ne veut donc PAS dire que le
// site n'accepte que la carte : ça veut dire qu'il n'affiche rien. Les écarts construits
// là-dessus parlent d'affichage, jamais de capacité (voir detect-gaps.ts).

export const PAYMENT_METHODS = [
  {
    id: "card",
    label: "Carte bancaire",
    // Aucun hôte ici : la présence de Stripe ne prouve pas « carte », elle prouve
    // « prestataire de paiement ». Les deux sont relevés séparément — voir
    // PAYMENT_PROVIDERS plus bas.
    hosts: [],
    textPatterns: [
      /\bvisa\b/i,
      /\bmastercard\b/i,
      /american\s+express/i,
      /\bamex\b/i,
      /carte\s+(?:bancaire|de\s+crédit)/i,
      /credit\s+card/i,
    ],
  },
  {
    id: "paypal",
    label: "PayPal",
    hosts: ["paypal.com", "paypalobjects.com"],
    textPatterns: [/\bpaypal\b/i],
  },
  {
    id: "apple_pay",
    label: "Apple Pay",
    hosts: ["applepay.cdn-apple.com"],
    textPatterns: [/apple\s?pay/i],
  },
  {
    id: "google_pay",
    label: "Google Pay",
    hosts: ["pay.google.com"],
    textPatterns: [/google\s?pay/i],
  },
  {
    id: "sepa",
    label: "Virement / SEPA",
    hosts: [],
    textPatterns: [/\bsepa\b/i, /virement\s+bancaire/i, /prélèvement\s+(?:sepa|automatique)/i, /bank\s+transfer/i],
  },
  {
    id: "bnpl",
    label: "Paiement fractionné",
    hosts: ["klarna.com", "alma.eu"],
    textPatterns: [/\bklarna\b/i, /paiement\s+en\s+(?:\d+|plusieurs)\s+fois/i, /pay\s+in\s+\d+/i],
  },
  {
    id: "invoice",
    label: "Facture / bon de commande",
    hosts: [],
    textPatterns: [
      /paiement\s+sur\s+facture/i,
      /pay\s+by\s+invoice/i,
      /bon\s+de\s+commande/i,
      /purchase\s+order/i,
    ],
  },
] as const;

export type PaymentMethodId = (typeof PAYMENT_METHODS)[number]["id"];

const PAYMENT_LABEL_BY_ID = new Map<string, string>(PAYMENT_METHODS.map((m) => [m.id, m.label]));

function matchesHost(link: string, fragments: readonly string[]): boolean {
  if (fragments.length === 0) return false;
  try {
    const parsed = new URL(link);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    return fragments.some((fragment) => host === fragment || host.endsWith(`.${fragment}`));
  } catch {
    return false;
  }
}

/**
 * Moyens de paiement observés, dans l'ordre stable de PAYMENT_METHODS.
 *
 * Le texte confronté est celui de la page de tarifs quand elle existe, sinon celui de la
 * page d'accueil : c'est là que les badges de paiement sont affichés. Les libellés visés
 * sont des noms propres (« Apple Pay », « Klarna ») ou des formules de paiement — assez
 * spécifiques pour qu'une mention hors contexte reste rare.
 */
export function detectPaymentMethods(input: {
  pricingText: string | null;
  homepageText: string;
  links: readonly string[];
  /**
   * HTML brut des pages lues, quand il est disponible.
   *
   * Indispensable : un SDK de paiement se charge par `<script src="https://js.stripe.com/v3">`,
   * et un script n'est pas un lien. En ne regardant que les `href`, on ratait le signal le
   * plus fiable qui soit — la présence du prestataire de paiement sur la page elle-même.
   */
  html?: string | null;
}): PaymentMethodId[] {
  const haystack = [input.pricingText ?? "", input.homepageText].join("\n");
  const markup = input.html ?? "";
  const found = new Set<PaymentMethodId>();

  for (const method of PAYMENT_METHODS) {
    if (input.links.some((link) => matchesHost(link, method.hosts))) {
      found.add(method.id);
      continue;
    }
    // Le domaine du prestataire cité n'importe où dans le balisage : attribut src,
    // preconnect, iframe. On ne cherche que des noms d'hôtes techniques, pas des mots
    // courants, donc une mention de passage reste improbable.
    if (method.hosts.some((host) => markup.includes(host))) {
      found.add(method.id);
      continue;
    }
    if (method.textPatterns.some((re) => re.test(haystack))) {
      found.add(method.id);
    }
  }

  return PAYMENT_METHODS.filter((m) => found.has(m.id)).map((m) => m.id);
}

export function labelPaymentMethods(ids: readonly string[]): string[] {
  return ids.map((id) => PAYMENT_LABEL_BY_ID.get(id) ?? id);
}

/** Moyens affichés par le concurrent et pas par nous, ordre stable conservé. */
export function missingPaymentMethods(
  own: readonly string[],
  competitor: readonly string[],
): string[] {
  const mine = new Set(own);
  return competitor.filter((id) => !mine.has(id));
}

/**
 * Prestataires de paiement repérables sur des pages publiques.
 *
 * C'est un relevé DIFFÉRENT des moyens de paiement, et il faut le garder distinct :
 * voir Stripe chargé sur une page dit qui encaisse, pas avec quoi on peut payer. Un site
 * sous Stripe peut accepter la carte seule ou la carte plus Apple Pay, PayPal et le
 * prélèvement — cette configuration vit dans le Dashboard de son propriétaire, hors de
 * portée de toute observation publique.
 *
 * L'intérêt est ailleurs : « paiement géré par Stripe » est une information utile et
 * vraie, là où « rien d'affiché publiquement » est exact mais inutile.
 */
export const PAYMENT_PROVIDERS = [
  { id: "stripe", label: "Stripe", hosts: ["js.stripe.com", "checkout.stripe.com", "stripe.com"] },
  { id: "paddle", label: "Paddle", hosts: ["checkout.paddle.com", "paddle.com"] },
  { id: "chargebee", label: "Chargebee", hosts: ["js.chargebee.com", "chargebee.com"] },
  { id: "lemonsqueezy", label: "Lemon Squeezy", hosts: ["lemonsqueezy.com"] },
  { id: "whop", label: "Whop", hosts: ["whop.com"] },
  { id: "gumroad", label: "Gumroad", hosts: ["gumroad.com"] },
  { id: "mollie", label: "Mollie", hosts: ["mollie.com"] },
  { id: "gocardless", label: "GoCardless", hosts: ["gocardless.com"] },
  { id: "paypal", label: "PayPal", hosts: ["paypal.com", "paypalobjects.com"] },
] as const;

export type PaymentProviderId = (typeof PAYMENT_PROVIDERS)[number]["id"];

const PROVIDER_LABEL_BY_ID = new Map<string, string>(PAYMENT_PROVIDERS.map((p) => [p.id, p.label]));

/**
 * Prestataires cités dans le balisage ou les liens des pages publiques.
 *
 * Le balisage compte autant que les liens : un SDK s'inclut par `<script src>`, et un
 * script n'est pas un `href`.
 */
export function detectPaymentProviders(input: {
  links: readonly string[];
  html?: string | null;
}): PaymentProviderId[] {
  const markup = input.html ?? "";
  const found = new Set<PaymentProviderId>();

  for (const provider of PAYMENT_PROVIDERS) {
    const inLinks = input.links.some((link) => matchesHost(link, provider.hosts));
    const inMarkup = provider.hosts.some((host) => markup.includes(host));
    if (inLinks || inMarkup) found.add(provider.id);
  }

  return PAYMENT_PROVIDERS.filter((p) => found.has(p.id)).map((p) => p.id);
}

export function labelPaymentProviders(ids: readonly string[]): string[] {
  return ids.map((id) => PROVIDER_LABEL_BY_ID.get(id) ?? id);
}
