import { EmptyState } from "@/components/tasks/empty-state";
import type { ExtractedSiteData } from "@/lib/supabase/database.types";
import { labelAuthMethods } from "@/lib/compare/auth-methods";
import { labelPaymentMethods, labelPaymentProviders } from "@/lib/compare/payment-methods";

/**
 * Le comparatif public, présenté en face-à-face plutôt qu'en tableau.
 *
 * L'ancienne mise en forme (Critère | Toi | Concurrent) donnait un tiers de la largeur à
 * une colonne de libellés, et alignait les deux offres dans le même sens de lecture — donc
 * on les comparait mal. Ici tes valeurs sont à gauche, les siennes à droite, le critère au
 * centre en petit : les deux colonnes se font face, ce qui est exactement le sujet.
 *
 * Aucune valeur n'est colorée en rouge ou en vert. Un « Non » en rouge de ton côté
 * face à un « Oui » en vert du sien transforme un relevé factuel en bulletin de notes,
 * ce que le produit s'interdit (CLAUDE.md : jamais de classement qui humilie). Le seul
 * marquage est une étiquette sous la valeur, qui nomme le fait — écart détecté d'un
 * côté, avance de l'autre — sans le teinter.
 */

function formatTiers(data: ExtractedSiteData | null): string {
  if (!data) return "Pas encore de données";
  if (data.pricing_tiers.length === 0) return "Aucun palier détecté";
  return data.pricing_tiers.map((t) => `${t.name} (${t.price})`).join(" · ");
}

type Side = "own" | "competitor";

function BoolValue({
  value,
  side,
  isBehind,
  isAhead,
}: {
  value: boolean | null;
  side: Side;
  isBehind: boolean;
  isAhead: boolean;
}) {
  const align = side === "own" ? "text-left" : "text-right";

  if (value === null) {
    return <span className={`${align} text-sm text-foreground-muted/70`}>Pas de données</span>;
  }

  // L'étiquette ne s'affiche que sous TA valeur : un « écart détecté » est une ligne
  // de ta liste de tâches, pas une remarque sur le concurrent. Le mettre des deux
  // côtés lui inventerait un manque qu'on ne mesure pas.
  const labelled = side === "own" && (isBehind || isAhead);

  return (
    <div className={align}>
      <span className="font-mono text-xl text-foreground">{value ? "Oui" : "Non"}</span>
      {labelled && (
        <span
          className={`mt-1 block font-mono text-[10px] uppercase tracking-[0.14em] ${
            isBehind ? "text-accent-strong" : "text-foreground-muted/70"
          }`}
        >
          {isBehind ? "Écart détecté" : "Tu es devant"}
        </span>
      )}
    </div>
  );
}


/**
 * Une liste d'observations, ou l'aveu qu'il n'y en a pas eu.
 *
 * `null` et `[]` ne se rendent pas pareil : « pas de relevé » dit qu'on n'a rien lu,
 * « rien d'affiché » dit qu'on a lu et que le site n'annonce rien. Les confondre
 * présenterait une absence de mesure comme un fait établi.
 */
function ListValue({
  values,
  side,
  emptyLabel,
}: {
  values: string[] | null;
  side: Side;
  emptyLabel: string;
}) {
  const align = side === "own" ? "text-left" : "text-right";

  if (values === null) {
    return <span className={`${align} text-sm text-foreground-muted/70`}>Pas de relevé</span>;
  }
  if (values.length === 0) {
    return <span className={`${align} text-sm text-foreground-muted`}>{emptyLabel}</span>;
  }
  return (
    <span className={`${align} block text-sm leading-relaxed text-foreground`}>
      {values.join(" · ")}
    </span>
  );
}

/**
 * La valeur « paiement », par ordre de ce qu'on sait réellement.
 *
 * Trois états, et le second est celui qui manquait : savoir que le paiement passe par
 * Stripe est vrai, vérifiable et utile — « rien d'affiché publiquement » était exact mais
 * ne servait à rien, alors même que le prestataire était visible dans le balisage.
 */
function PaymentValue({
  methods,
  providers,
  side,
}: {
  methods: string[] | null;
  providers: string[] | null;
  side: Side;
}) {
  const align = side === "own" ? "text-left" : "text-right";

  if (methods === null && providers === null) {
    return <span className={`${align} text-sm text-foreground-muted/70`}>Pas de relevé</span>;
  }

  if (methods && methods.length > 0) {
    return (
      <span className={`${align} block text-sm leading-relaxed text-foreground`}>
        {labelPaymentMethods(methods).join(" · ")}
      </span>
    );
  }

  if (providers && providers.length > 0) {
    return (
      <div className={align}>
        <span className="block text-sm leading-relaxed text-foreground">
          Paiement via {labelPaymentProviders(providers).join(" · ")}
        </span>
        <span className="font-mono mt-1 block text-[10px] uppercase tracking-[0.14em] text-foreground-muted/70">
          Moyens non listés publiquement
        </span>
      </div>
    );
  }

  return (
    <span className={`${align} text-sm text-foreground-muted`}>Rien d&rsquo;affiché publiquement</span>
  );
}

function Row({
  label,
  own,
  competitor,
}: {
  label: string;
  own: React.ReactNode;
  competitor: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 border-b border-white/[0.06] px-5 py-5 last:border-b-0 sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-6">
      <div className="min-w-0 sm:text-left">{own}</div>
      <div className="order-first font-mono text-[10px] uppercase tracking-[0.16em] text-foreground-muted/60 sm:order-none sm:px-2 sm:text-center">
        {label}
      </div>
      <div className="min-w-0 sm:text-right">{competitor}</div>
    </div>
  );
}

export function FaceOff({
  own,
  competitor,
  competitorLabel,
  ownMethods,
  competitorMethods,
  loadError = false,
}: {
  own: ExtractedSiteData | null;
  competitor: ExtractedSiteData | null;
  competitorLabel: string;
  /** Moyens de connexion et de paiement relevés de notre côté (null = non observé). */
  ownMethods?: {
    auth: string[] | null;
    payment: string[] | null;
    paymentProviders: string[] | null;
  };
  competitorMethods?: {
    auth: string[] | null;
    payment: string[] | null;
    paymentProviders: string[] | null;
  };
  loadError?: boolean;
}) {
  const noData = !own && !competitor;

  const trialBehind = Boolean(own && competitor && competitor.has_free_trial && !own.has_free_trial);
  const trialAhead = Boolean(own && competitor && own.has_free_trial && !competitor.has_free_trial);
  const tierBehind = Boolean(own && competitor && competitor.has_free_tier && !own.has_free_tier);
  const tierAhead = Boolean(own && competitor && own.has_free_tier && !competitor.has_free_tier);

  return (
    <section aria-labelledby="face-off-title" className="panel overflow-hidden">
      <div className="grid grid-cols-1 items-baseline gap-1 border-b border-white/[0.06] px-5 py-4 sm:grid-cols-[1fr_auto_1fr] sm:gap-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-foreground">Toi</p>
        <h2
          id="face-off-title"
          className="font-mono text-[10px] uppercase tracking-[0.16em] text-foreground-muted/60 sm:px-2 sm:text-center"
        >
          Face à face
        </h2>
        <p className="truncate font-mono text-[11px] uppercase tracking-[0.16em] text-foreground sm:text-right">
          {competitorLabel}
        </p>
      </div>

      {noData ? (
        <div className="px-5 py-8">
          <EmptyState
            title={loadError ? "Impossible de charger les données" : "Pas encore de données"}
            description={
              loadError
                ? "Une erreur est survenue pendant la récupération des relevés. Réessaie dans un instant."
                : `Lance une première analyse pour comparer ton offre à celle de ${competitorLabel}.`
            }
          />
        </div>
      ) : (
        <div>
          <Row
            label="Paliers"
            own={<span className="text-sm leading-relaxed text-foreground">{formatTiers(own)}</span>}
            competitor={
              <span className="text-sm leading-relaxed text-foreground">
                {formatTiers(competitor)}
              </span>
            }
          />
          <Row
            label="Essai gratuit"
            own={
              <BoolValue
                value={own ? own.has_free_trial : null}
                side="own"
                isBehind={trialBehind}
                isAhead={trialAhead}
              />
            }
            competitor={
              <BoolValue
                value={competitor ? competitor.has_free_trial : null}
                side="competitor"
                isBehind={trialAhead}
                isAhead={trialBehind}
              />
            }
          />
          <Row
            label="Palier gratuit"
            own={
              <BoolValue
                value={own ? own.has_free_tier : null}
                side="own"
                isBehind={tierBehind}
                isAhead={tierAhead}
              />
            }
            competitor={
              <BoolValue
                value={competitor ? competitor.has_free_tier : null}
                side="competitor"
                isBehind={tierAhead}
                isAhead={tierBehind}
              />
            }
          />
          <Row
            label="Connexion"
            own={
              <ListValue
                values={ownMethods?.auth ? labelAuthMethods(ownMethods.auth) : ownMethods?.auth ?? null}
                side="own"
                emptyLabel="Email et mot de passe seulement"
              />
            }
            competitor={
              <ListValue
                values={
                  competitorMethods?.auth
                    ? labelAuthMethods(competitorMethods.auth)
                    : competitorMethods?.auth ?? null
                }
                side="competitor"
                emptyLabel="Email et mot de passe seulement"
              />
            }
          />
          <Row
            label="Paiement"
            own={
              <PaymentValue
                methods={ownMethods?.payment ?? null}
                providers={ownMethods?.paymentProviders ?? null}
                side="own"
              />
            }
            competitor={
              <PaymentValue
                methods={competitorMethods?.payment ?? null}
                providers={competitorMethods?.paymentProviders ?? null}
                side="competitor"
              />
            }
          />
        </div>
      )}

      {!noData && (
        <p className="border-t border-white/[0.06] px-5 py-3 text-xs leading-relaxed text-foreground-muted/70">
          La ligne « Paiement » ne dit que ce qui est visible publiquement : les moyens
          annoncés, ou à défaut le prestataire chargé sur les pages. Le tunnel lui-même est
          derrière un compte des deux côtés — un site sous Stripe peut accepter la carte
          seule ou aussi Apple Pay et PayPal, et cette configuration n&rsquo;est pas
          observable de l&rsquo;extérieur.
        </p>
      )}

      {loadError && !noData && (
        <p className="border-t border-white/[0.06] px-5 py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-flare">
          Erreur de chargement — données possiblement incomplètes
        </p>
      )}
    </section>
  );
}
