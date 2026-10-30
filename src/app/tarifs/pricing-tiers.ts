/**
 * Contenu affiché de la page tarifs, par palier et par périodicité.
 *
 * Ces montants sont de l'affichage, pas la source de vérité de la facturation : ce qui
 * est réellement débité vient de l'identifiant de prix Stripe résolu côté serveur
 * (STRIPE_PRICE_*, voir src/lib/billing/stripe.ts). Les deux doivent être tenus
 * cohérents à la main — c'est le prix de ne jamais laisser un identifiant de prix
 * descendre dans le navigateur.
 *
 * L'annuel est facturé en une fois : le montant mensuel indiqué en dessous est un
 * équivalent, pas un débit mensuel. La mention le dit explicitement, sinon elle promet
 * un prélèvement qui n'aura pas lieu.
 */

export type BillingPeriod = "monthly" | "yearly";

type PlanPricing = {
  price: string;
  period: string;
  /** Mention secondaire sous le prix. Absente pour le palier gratuit. */
  note?: string;
};

export type PricingTier = {
  name: string;
  tagline: string;
  features: string[];
  cta: string;
  plans: Record<BillingPeriod, PlanPricing>;
  /** Palier facturable. Absent = carte non payable (gratuit, ou pas encore ouvert). */
  checkout?: "pro" | "growth";
  highlighted?: boolean;
};

const FREE_PLAN: PlanPricing = { price: "0 €", period: "pour toujours" };

export const PRICING_TIERS: PricingTier[] = [
  {
    name: "Starter",
    tagline: "L'analyse tourne. Ses résultats restent fermés.",
    features: [
      "1 concurrent suivi",
      "Première analyse lancée automatiquement",
      "Nombre d'écarts détectés et date de l'analyse",
      "Détail des résultats verrouillé",
    ],
    cta: "Créer mon compte",
    plans: { monthly: FREE_PLAN, yearly: FREE_PLAN },
  },
  {
    name: "Pro",
    tagline: "Tout ce que l'analyse a trouvé, et quoi en faire.",
    features: [
      "1 concurrent suivi, remplaçable tous les 30 jours",
      "Tous les écarts détectés, en tâches priorisées",
      "Score, comparatif des tarifs et face-à-face complet",
      "Connexion et moyens de paiement comparés",
      "Historique du score et statistiques",
      "Analyse relançable à la demande",
    ],
    cta: "Commencer avec Pro",
    checkout: "pro",
    highlighted: true,
    plans: {
      monthly: { price: "14,50 €", period: "par mois", note: "Sans engagement, résiliable en un clic." },
      yearly: {
        price: "145 €",
        period: "par an",
        note: "Soit 12,08 € par mois — deux mois offerts, facturés en une fois.",
      },
    },
  },
  {
    name: "Growth",
    tagline: "Plusieurs fronts à surveiller en même temps.",
    features: [
      "Tout le contenu de Pro",
      "3 concurrents suivis en parallèle",
      "Écarts, tâches et score séparés par concurrent",
      "Une seule analyse relit ton SaaS pour les trois",
      "Support prioritaire",
    ],
    cta: "Commencer avec Growth",
    checkout: "growth",
    plans: {
      monthly: { price: "39,50 €", period: "par mois", note: "Sans engagement, résiliable en un clic." },
      yearly: {
        price: "395 €",
        period: "par an",
        note: "Soit 32,92 € par mois — deux mois offerts, facturés en une fois.",
      },
    },
  },
];
