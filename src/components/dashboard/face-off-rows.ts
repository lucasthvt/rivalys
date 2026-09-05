import { labelAuthMethods, } from "@/lib/compare/auth-methods";
import { labelPaymentMethods, labelPaymentProviders } from "@/lib/compare/payment-methods";
import type { ExtractedSiteData, GapCategory } from "@/lib/supabase/database.types";

/**
 * Les lignes du relevé coté, calculées à partir des deux derniers relevés.
 *
 * Fonction pure, hors composant, pour deux raisons. Elle est testable — c'est elle qui
 * décide si une ligne annonce un écart ou un alignement, et se tromper là fait afficher un
 * retard qui n'existe pas. Et elle tourne côté serveur : le composant client ne reçoit que
 * des chaînes déjà formées, pas les relevés bruts.
 *
 * Trois états par ligne, jamais deux. « Aligné » et « non relevé » se ressemblent à
 * l'écran si on n'y prend pas garde, alors qu'ils disent le contraire l'un de l'autre :
 * l'un affirme qu'il n'y a rien à rattraper, l'autre qu'on n'en sait rien. La même
 * distinction que null vs [] dans site-data.ts.
 */
export type RowState = "gap" | "aligned" | "unmeasured";

export interface FaceOffRow {
  key: string;
  label: string;
  /** Famille d'écarts à laquelle la ligne se rattache, pour le survol lié. */
  category: GapCategory;
  own: { value: string; detail?: string };
  competitor: { value: string; detail?: string };
  state: RowState;
  /** Valeur cotée entre les deux colonnes. Absente hors de l'état « gap ». */
  gapLabel: string | null;
  /** Vrai quand c'est le concurrent qui mène sur cette ligne. */
  behind: boolean;
}

const NOT_MEASURED = "Pas de relevé";

/** Une cellule déjà formée, avec le nombre qui sert à coter la ligne. */
interface Cell {
  /** `null` = non observé. Zéro est une mesure, pas une absence. */
  count: number | null;
  value: string;
  detail?: string;
}

function countRow({
  key,
  label,
  category,
  own,
  competitor,
  unit,
}: {
  key: string;
  label: string;
  category: GapCategory;
  own: Cell;
  competitor: Cell;
  /** Nom de ce qu'on compte, au singulier. Pluralisé ici. */
  unit: string;
}): FaceOffRow {
  const cells = {
    key,
    label,
    category,
    own: { value: own.value, detail: own.detail },
    competitor: { value: competitor.value, detail: competitor.detail },
  };

  if (own.count === null || competitor.count === null) {
    return { ...cells, state: "unmeasured", gapLabel: null, behind: false };
  }

  const diff = Math.abs(competitor.count - own.count);
  if (diff === 0) {
    return { ...cells, state: "aligned", gapLabel: null, behind: false };
  }

  return {
    ...cells,
    state: "gap",
    gapLabel: `${diff} ${unit}${diff > 1 ? "s" : ""}`,
    behind: competitor.count > own.count,
  };
}

function boolRow({
  key,
  label,
  ownValue,
  competitorValue,
}: {
  key: string;
  label: string;
  ownValue: boolean | null;
  competitorValue: boolean | null;
}): FaceOffRow {
  const render = (value: boolean | null) => ({
    value: value === null ? NOT_MEASURED : value ? "Oui" : "Non",
  });

  const base = {
    key,
    label,
    category: "pricing" as GapCategory,
    own: render(ownValue),
    competitor: render(competitorValue),
  };

  if (ownValue === null || competitorValue === null) {
    return { ...base, state: "unmeasured", gapLabel: null, behind: false };
  }
  if (ownValue === competitorValue) {
    return { ...base, state: "aligned", gapLabel: null, behind: false };
  }

  // Un booléen ne se cote pas en unités : ce qui manque est la chose elle-même. Le libellé
  // nomme donc le fait, il ne compte pas.
  return {
    ...base,
    state: "gap",
    gapLabel: competitorValue ? "Manquant chez toi" : "Tu es devant",
    behind: competitorValue,
  };
}

/** Longueur d'une liste observée. `null` = non observée, à ne pas confondre avec zéro. */
function len(values: string[] | null | undefined): number | null {
  return values == null ? null : values.length;
}

export function buildFaceOffRows({
  own,
  competitor,
  ownMethods,
  competitorMethods,
}: {
  own: ExtractedSiteData | null;
  competitor: ExtractedSiteData | null;
  ownMethods?: { auth: string[] | null; payment: string[] | null; paymentProviders: string[] | null };
  competitorMethods?: {
    auth: string[] | null;
    payment: string[] | null;
    paymentProviders: string[] | null;
  };
}): FaceOffRow[] {
  const tierCell = (data: ExtractedSiteData | null): Cell => {
    if (!data) return { count: null, value: NOT_MEASURED };
    const count = data.pricing_tiers.length;
    if (count === 0) return { count: 0, value: "Aucun palier" };
    return {
      count,
      value: `${count} palier${count > 1 ? "s" : ""}`,
      detail: data.pricing_tiers.map((tier) => `${tier.name} (${tier.price})`).join(" · "),
    };
  };

  const methodCell = (
    values: string[] | null | undefined,
    unit: string,
    emptyLabel: string,
    detail?: string,
  ): Cell => {
    const count = len(values);
    if (count === null) return { count: null, value: NOT_MEASURED };
    if (count === 0) return { count: 0, value: emptyLabel, detail };
    return { count, value: `${count} ${unit}${count > 1 ? "s" : ""}`, detail };
  };

  return [
    countRow({
      key: "tiers",
      label: "Paliers publiés",
      category: "pricing",
      unit: "palier",
      own: tierCell(own),
      competitor: tierCell(competitor),
    }),
    boolRow({
      key: "trial",
      label: "Essai gratuit",
      ownValue: own ? own.has_free_trial : null,
      competitorValue: competitor ? competitor.has_free_trial : null,
    }),
    boolRow({
      key: "free-tier",
      label: "Palier gratuit",
      ownValue: own ? own.has_free_tier : null,
      competitorValue: competitor ? competitor.has_free_tier : null,
    }),
    countRow({
      key: "auth",
      label: "Connexion",
      category: "auth",
      unit: "méthode",
      own: methodCell(ownMethods?.auth, "méthode", "Email seulement", describeMethods(ownMethods?.auth, "auth")),
      competitor: methodCell(
        competitorMethods?.auth,
        "méthode",
        "Email seulement",
        describeMethods(competitorMethods?.auth, "auth"),
      ),
    }),
    countRow({
      key: "payment",
      label: "Paiement",
      category: "payment",
      unit: "moyen",
      own: methodCell(
        ownMethods?.payment,
        "moyen",
        "Rien d'affiché",
        describeMethods(ownMethods?.payment, "payment") ?? describeProviders(ownMethods?.paymentProviders),
      ),
      competitor: methodCell(
        competitorMethods?.payment,
        "moyen",
        "Rien d'affiché",
        describeMethods(competitorMethods?.payment, "payment") ??
          describeProviders(competitorMethods?.paymentProviders),
      ),
    }),
  ];
}
/** Détails textuels, gardés hors de buildFaceOffRows pour ne pas l'alourdir. */
export function describeMethods(
  methods: string[] | null | undefined,
  kind: "auth" | "payment",
): string | undefined {
  if (!methods || methods.length === 0) return undefined;
  return (kind === "auth" ? labelAuthMethods(methods) : labelPaymentMethods(methods)).join(" · ");
}

export function describeProviders(providers: string[] | null | undefined): string | undefined {
  if (!providers || providers.length === 0) return undefined;
  return `via ${labelPaymentProviders(providers).join(" · ")}`;
}
