/**
 * Sector list offered during onboarding. Deliberately broad: the founder
 * still types their own wording if nothing fits — `profiles.industry` is a
 * free text column, this list only removes the blank-page problem.
 *
 * Grouped rather than flat so ~60 options stay scannable.
 */
export type IndustryGroup = {
  label: string;
  items: string[];
};

export const INDUSTRY_GROUPS: IndustryGroup[] = [
  {
    label: "Ventes & marketing",
    items: [
      "CRM",
      "Prospection / lead gen",
      "Marketing automation",
      "Emailing",
      "SEO & contenu",
      "Publicité",
      "Réseaux sociaux",
      "Affiliation",
    ],
  },
  {
    label: "Produit & tech",
    items: [
      "Outils développeur",
      "No-code / automatisation",
      "API & infrastructure",
      "Hébergement",
      "Cybersécurité",
      "Data & analytics",
      "IA / machine learning",
      "Tests & QA",
    ],
  },
  {
    label: "Gestion d'entreprise",
    items: [
      "Productivité",
      "Gestion de projet",
      "Facturation & devis",
      "Comptabilité",
      "Paie",
      "RH & recrutement",
      "Juridique",
      "Signature électronique",
      "ERP",
      "Achats & notes de frais",
    ],
  },
  {
    label: "Finance",
    items: [
      "Fintech",
      "Paiement",
      "Banque & néobanque",
      "Assurance",
      "Investissement",
      "Crypto & web3",
    ],
  },
  {
    label: "Commerce",
    items: [
      "E-commerce",
      "Marketplace",
      "Point de vente (POS)",
      "Logistique & livraison",
      "Abonnements & rétention",
      "Gestion de stock",
    ],
  },
  {
    label: "Relation client",
    items: [
      "Support & helpdesk",
      "Chat & messagerie",
      "Visio & réunions",
      "Téléphonie",
      "Avis & feedback",
      "Communauté",
    ],
  },
  {
    label: "Secteurs métier",
    items: [
      "Santé",
      "Éducation & e-learning",
      "Immobilier",
      "Restauration",
      "Voyage & tourisme",
      "Événementiel",
      "Bâtiment & BTP",
      "Agriculture",
      "Sport & fitness",
      "Associations & ONG",
      "Industrie & production",
      "Transport & mobilité",
    ],
  },
  {
    label: "Création",
    items: [
      "Design",
      "Vidéo",
      "Audio & podcast",
      "Photo",
      "Écriture & rédaction",
      "Impression & print",
      "Jeux vidéo",
    ],
  },
];

/** Accent- and case-insensitive, so "evenementiel" matches "Événementiel". */
export function normalizeIndustry(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export function filterIndustryGroups(query: string): IndustryGroup[] {
  const needle = normalizeIndustry(query);
  if (!needle) return INDUSTRY_GROUPS;

  return INDUSTRY_GROUPS.map((group) => ({
    label: group.label,
    items: group.items.filter((item) => normalizeIndustry(item).includes(needle)),
  })).filter((group) => group.items.length > 0);
}

export function isKnownIndustry(value: string): boolean {
  const needle = normalizeIndustry(value);
  return INDUSTRY_GROUPS.some((group) =>
    group.items.some((item) => normalizeIndustry(item) === needle),
  );
}
