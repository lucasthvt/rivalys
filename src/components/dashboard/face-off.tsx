import { EmptyState } from "@/components/tasks/empty-state";
import type { ExtractedSiteData } from "@/lib/supabase/database.types";

/**
 * Le comparatif public, présenté en face-à-face plutôt qu'en tableau.
 *
 * L'ancienne mise en forme (Critère | Toi | Concurrent) donnait un tiers de la largeur à
 * une colonne de libellés, et alignait les deux offres dans le même sens de lecture — donc
 * on les comparait mal. Ici tes valeurs sont à gauche, les siennes à droite, le critère au
 * centre en petit : les deux colonnes se font face, ce qui est exactement le sujet.
 *
 * Le marquage couleur reste strictement adossé aux faits : une valeur passe en flare
 * uniquement quand elle correspond à un écart réellement détecté (il l'a, pas toi), en mint
 * quand c'est l'inverse. Jamais décoratif.
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

  const tone = isBehind ? "text-flare" : isAhead ? "text-mint" : "text-foreground";
  return (
    <span className={`${align} font-mono text-xl ${tone}`}>{value ? "Oui" : "Non"}</span>
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
  loadError = false,
}: {
  own: ExtractedSiteData | null;
  competitor: ExtractedSiteData | null;
  competitorLabel: string;
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
                isBehind={false}
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
                isBehind={false}
                isAhead={tierBehind}
              />
            }
          />
        </div>
      )}

      {loadError && !noData && (
        <p className="border-t border-white/[0.06] px-5 py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-flare">
          Erreur de chargement — données possiblement incomplètes
        </p>
      )}
    </section>
  );
}
