"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { dismissGap, markGapDone } from "@/app/tasks/actions";
import { DimensionLine } from "@/components/ui/DimensionLine";
import { CATEGORY_LABEL, PRIORITY_COLOR, PRIORITY_LABEL, sortGapsByPriority } from "@/components/tasks/priority";
import { computeScore, countByPriority, POINTS_PER_PRIORITY } from "@/lib/compare/score";
import type { GapCategory, GapPriority } from "@/lib/supabase/database.types";
import type { DetectedGap } from "@/components/tasks/priority";
import type { FaceOffRow } from "./face-off-rows";
import { ScoreRing } from "./score-ring";

/**
 * Le plateau du tableau de bord.
 *
 * Trois objets qui se répondent, au lieu de trois blocs empilés qui s'ignorent :
 *
 *   le score      →  cliquer une priorité filtre la file d'écarts qui la compose
 *   la file       →  cocher un écart le retire ici et fait bouger le score projeté
 *   le relevé coté →  survoler une ligne éclaire les écarts de la même famille
 *
 * C'est un seul composant client parce que ces trois vues partagent le même état : le
 * découper en trois obligerait à faire remonter filtre, survol et liste optimiste dans un
 * parent qui ne ferait que les redistribuer.
 *
 * Les enfants purement présentationnels vivent en bas du fichier.
 */

type Action = "done" | "dismiss";

export function Board({
  gaps,
  rows,
  competitorLabel,
  scoreFromHistory,
  previousScoreFromHistory,
  analysed,
  snapshotLoadError = false,
}: {
  gaps: DetectedGap[];
  rows: FaceOffRow[];
  competitorLabel: string;
  scoreFromHistory: number | null;
  previousScoreFromHistory: number | null;
  analysed: boolean;
  /** Un des deux relevés n'a pas pu être lu : le relevé coté est possiblement incomplet. */
  snapshotLoadError?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<GapPriority | null>(null);

  /**
   * La famille survolée, partagée par le relevé et la file.
   *
   * Le lien est établi par catégorie et pas par ligne : une ligne « Essai gratuit » ne
   * pointe pas vers UN écart précis, elle appartient à la famille pricing. Prétendre à
   * plus de précision qu'on n'en a serait inventer une traçabilité que le moteur ne
   * produit pas.
   */
  const [linked, setLinked] = useState<GapCategory | null>(null);

  /**
   * La liste retire l'écart avant la réponse du serveur. Le geste « c'est fait » doit
   * répondre à la vitesse de la pensée ; l'aller-retour dure quelques centaines de
   * millisecondes pendant lesquelles un bouton figé donne l'impression d'un clic perdu.
   * En cas d'échec, React rejoue l'état serveur tout seul et le message ci-dessous dit
   * pourquoi l'écart est revenu.
   */
  const [optimisticGaps, removeGap] = useOptimistic(gaps, (current: DetectedGap[], id: string) =>
    current.filter((gap) => gap.id !== id),
  );

  const counts = countByPriority(optimisticGaps);

  /**
   * Le score que la PROCHAINE analyse enregistrera si les écarts fermés le restent.
   *
   * Distinct de `scoreFromHistory`, qui est un relevé daté : l'anneau continue d'afficher
   * celui-là. Écraser l'un par l'autre ferait passer une projection pour une mesure — la
   * même confusion que le produit refuse partout ailleurs.
   */
  const projected = computeScore(counts);
  const projectionMoves = analysed && scoreFromHistory !== null && projected !== scoreFromHistory;

  const visible = sortGapsByPriority(
    filter ? optimisticGaps.filter((gap) => gap.priority === filter) : optimisticGaps,
  );

  function resolve(id: string, action: Action) {
    setError(null);
    startTransition(async () => {
      removeGap(id);
      const result = action === "done" ? await markGapDone(id) : await dismissGap(id);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {error && (
        <p role="status" className="panel px-6 py-4 text-sm text-flare">
          {error}
        </p>
      )}

      {/*
        Grille asymétrique : le score tient une colonne étroite et fixe, la file prend tout
        le reste. C'est la file qu'on vient consulter — lui donner la même largeur qu'au
        score dirait qu'ils comptent autant.
      */}
      {/*
        `items-start` : sans lui, la grille étire la carte du score à la hauteur de la file
        et laisse un vide sous les filtres proportionnel au nombre d'écarts. Le score
        garde sa hauteur propre ; l'asymétrie qui en résulte est la bonne, elle dit
        laquelle des deux colonnes on vient lire.
      */}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[19rem_minmax(0,1fr)]">
        <ScorePanel
          score={scoreFromHistory}
          previous={previousScoreFromHistory}
          projected={projected}
          projectionMoves={projectionMoves}
          analysed={analysed}
          counts={counts}
          filter={filter}
          onFilter={setFilter}
        />

        <GapQueue
          gaps={visible}
          total={optimisticGaps.length}
          filter={filter}
          onClearFilter={() => setFilter(null)}
          linked={linked}
          onLink={setLinked}
          onResolve={resolve}
          busy={isPending}
          analysed={analysed}
        />
      </div>

      <CotedFaceOff
        rows={rows}
        competitorLabel={competitorLabel}
        linked={linked}
        onLink={setLinked}
        loadError={snapshotLoadError}
      />
    </div>
  );
}

/* --------------------------------------------------------------------------
   Le score, et ses segments cliquables
   -------------------------------------------------------------------------- */

function ScorePanel({
  score,
  previous,
  projected,
  projectionMoves,
  analysed,
  counts,
  filter,
  onFilter,
}: {
  score: number | null;
  previous: number | null;
  projected: number;
  projectionMoves: boolean;
  analysed: boolean;
  counts: Record<GapPriority, number>;
  filter: GapPriority | null;
  onFilter: (next: GapPriority | null) => void;
}) {
  const delta = analysed && score !== null && previous !== null ? score - previous : null;
  const priorities: GapPriority[] = ["high", "medium", "low"];

  // Point focal du tableau de bord — la seule surface de l'écran à porter la lueur.
  // Le plateau n'en avait aucune : six panneaux au même niveau de lumière ne disent
  // pas par où commencer, et c'est exactement ce que l'écran doit dire.
  return (
    <section className="panel-focal flex flex-col items-center px-6 py-7" aria-label="Score">
      <ScoreRing score={analysed ? score : null} delta={delta} size={150} />

      {projectionMoves && (
        <p className="mt-5 text-center text-xs leading-relaxed text-mist">
          Prochaine analyse :{" "}
          <span className="font-mono tabular-nums text-signal-bright">{projected}</span>
          <span className="block text-mist/60">si ces fermetures tiennent</span>
        </p>
      )}

      {/*
        Chaque priorité est un bouton, pas une ligne de légende : le chiffre affiché est
        exactement la population qu'il filtre, donc cliquer dessus pour n'en voir que
        celle-là est le geste que le chiffre appelle déjà.
      */}
      <div className="mt-7 w-full border-t border-white/[0.08] pt-5">
        <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-mist/60">
          {filter ? "Filtre actif" : "Filtrer la file"}
        </p>

        <ul className="mt-3 flex flex-col gap-1.5">
          {priorities.map((priority) => {
            const count = counts[priority];
            const selected = filter === priority;
            const lost = count * POINTS_PER_PRIORITY[priority];

            return (
              <li key={priority}>
                <button
                  type="button"
                  aria-pressed={selected}
                  disabled={count === 0}
                  onClick={() => onFilter(selected ? null : priority)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors disabled:cursor-default disabled:opacity-35 ${
                    selected
                      ? "bg-signal/15 ring-1 ring-signal-bright/40"
                      : "hover:bg-white/[0.035] disabled:hover:bg-transparent"
                  }`}
                >
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: PRIORITY_COLOR[priority] }}
                  />
                  <span className="flex-1 text-sm text-paper">{PRIORITY_LABEL[priority]}</span>
                  <span className="font-mono text-sm tabular-nums text-paper">{count}</span>
                  <span className="font-mono w-12 text-right text-[0.7rem] tabular-nums text-mist/60">
                    {lost === 0 ? "—" : `−${lost}`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------
   La file d'écarts, actionnable sur place
   -------------------------------------------------------------------------- */

function GapQueue({
  gaps,
  total,
  filter,
  onClearFilter,
  linked,
  onLink,
  onResolve,
  busy,
  analysed,
}: {
  gaps: DetectedGap[];
  total: number;
  filter: GapPriority | null;
  onClearFilter: () => void;
  linked: GapCategory | null;
  onLink: (next: GapCategory | null) => void;
  onResolve: (id: string, action: Action) => void;
  busy: boolean;
  analysed: boolean;
}) {
  return (
    <section className="panel flex flex-col overflow-hidden" aria-label="Écarts ouverts">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] px-6 py-4">
        <h2 className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-mist/60">
          {filter ? `${PRIORITY_LABEL[filter]} · ${gaps.length} sur ${total}` : `À traiter · ${total}`}
        </h2>
        {filter && (
          <button
            type="button"
            onClick={onClearFilter}
            className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-signal-bright transition-colors hover:text-paper"
          >
            Tout voir
          </button>
        )}
      </header>

      {gaps.length === 0 ? (
        <div className="px-6 py-14 text-center">
          <p className="text-sm text-mist">
            {!analysed
              ? "Lance une première analyse pour voir apparaître tes écarts."
              : filter
                ? `Aucun écart en priorité ${PRIORITY_LABEL[filter].toLowerCase()}.`
                : "Aucun écart ouvert. Rien à rattraper sur ce qu'on sait mesurer."}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-white/[0.08]">
          {gaps.map((gap) => {
            const highlighted = linked !== null && gap.category === linked;

            return (
              <li
                key={gap.id}
                onMouseEnter={() => onLink(gap.category)}
                onMouseLeave={() => onLink(null)}
                className={`px-6 py-5 transition-colors ${
                  highlighted ? "bg-signal/[0.09]" : "hover:bg-white/[0.022]"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <span
                        aria-hidden
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: PRIORITY_COLOR[gap.priority] }}
                      />
                      <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-mist">
                        {PRIORITY_LABEL[gap.priority]}
                      </span>
                      <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-mist/45">
                        {CATEGORY_LABEL[gap.category]}
                      </span>
                    </p>
                    <p className="mt-2.5 font-brand text-[1.02rem] font-medium leading-snug tracking-[-0.01em] text-paper">
                      {gap.title}
                    </p>
                  </div>

                  {/*
                    Les actions vivent ici et pas seulement sur /tasks : fermer un écart
                    qu'on vient de lire ne devrait pas coûter deux navigations.
                  */}
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onResolve(gap.id, "done")}
                      className="rounded-full border border-white/[0.14] px-3.5 py-1.5 font-mono text-[0.64rem] uppercase tracking-[0.1em] text-paper transition-colors hover:border-signal-bright/50 hover:bg-signal/15 hover:text-signal-bright disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Fait
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onResolve(gap.id, "dismiss")}
                      className="rounded-full px-3 py-1.5 font-mono text-[0.64rem] uppercase tracking-[0.1em] text-mist/70 transition-colors hover:text-paper disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Ignorer
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <footer className="mt-auto border-t border-white/[0.08] px-6 py-4">
        <Link
          href="/tasks"
          className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-signal-bright transition-colors hover:text-paper"
        >
          Toutes les tâches, description comprise →
        </Link>
      </footer>
    </section>
  );
}

/* --------------------------------------------------------------------------
   Le relevé coté — l'élément signature
   -------------------------------------------------------------------------- */

function CotedFaceOff({
  rows,
  competitorLabel,
  linked,
  onLink,
  loadError,
}: {
  rows: FaceOffRow[];
  competitorLabel: string;
  linked: GapCategory | null;
  onLink: (next: GapCategory | null) => void;
  loadError: boolean;
}) {
  return (
    <section className="panel overflow-hidden" aria-labelledby="releve-title">
      <div className="grid grid-cols-[minmax(0,1fr)_6rem_minmax(0,1fr)] items-baseline gap-x-3 border-b border-white/[0.08] px-6 py-4 sm:grid-cols-[minmax(0,1fr)_9rem_minmax(0,1fr)] sm:gap-x-5">
        <p className="text-right font-mono text-[0.62rem] uppercase tracking-[0.14em] text-signal-bright">
          Toi
        </p>
        <h2
          id="releve-title"
          className="text-center font-mono text-[0.62rem] uppercase tracking-[0.14em] text-mist/60"
        >
          Relevé coté
        </h2>
        <p
          className="truncate font-mono text-[0.62rem] uppercase tracking-[0.14em] text-mist"
          title={competitorLabel}
        >
          {competitorLabel}
        </p>
      </div>

      <ul className="flex flex-col divide-y divide-white/[0.08]">
        {rows.map((row) => {
          const highlighted = linked !== null && row.category === linked;

          return (
            <li
              key={row.key}
              onMouseEnter={() => onLink(row.category)}
              onMouseLeave={() => onLink(null)}
              className={`grid grid-cols-[minmax(0,1fr)_6rem_minmax(0,1fr)] items-center gap-x-3 px-6 py-5 transition-colors sm:grid-cols-[minmax(0,1fr)_9rem_minmax(0,1fr)] sm:gap-x-5 ${
                highlighted ? "bg-signal/[0.09]" : "hover:bg-white/[0.022]"
              }`}
            >
              {/*
                La valeur qui ouvre l'écart est teintée, comme dans la carte de relevé
                du hero de la landing : sans ça, les deux colonnes se lisent à poids
                égal et il faut relire l'annotation centrale pour savoir de quel côté
                penche la ligne. Le flare ne sort que quand c'est toi qui es derrière —
                c'est le seul emploi que le projet lui accorde.
              */}
              <Cell
                value={row.own.value}
                detail={row.own.detail}
                align="right"
                tone={row.state === "gap" && row.behind ? "flare" : "default"}
              />

              <div className="flex flex-col items-center gap-1.5">
                <span className="text-center font-mono text-[0.56rem] uppercase leading-tight tracking-[0.1em] text-mist/60">
                  {row.label}
                </span>
                <DimensionLine measured={row.state === "gap"} />
                <span
                  className={`text-center font-mono text-[0.62rem] uppercase leading-tight tracking-[0.06em] ${
                    row.state === "gap"
                      ? row.behind
                        ? "text-flare"
                        : "text-mint"
                      : "text-mist/45"
                  }`}
                >
                  {row.state === "gap"
                    ? row.gapLabel
                    : row.state === "aligned"
                      ? "Aligné"
                      : "Non relevé"}
                </span>
              </div>

              <Cell
                value={row.competitor.value}
                detail={row.competitor.detail}
                align="left"
                tone={row.state === "gap" && !row.behind ? "mint" : "default"}
              />
            </li>
          );
        })}
      </ul>

      <p className="border-t border-white/[0.08] px-6 py-4 text-xs leading-relaxed text-mist/70">
        Une ligne cotée annonce un écart mesuré ; un trait pointillé, deux valeurs égales.
        « Non relevé » veut dire qu&rsquo;un des deux côtés n&rsquo;a pas pu être lu — ce
        n&rsquo;est pas un alignement.
        {/*
          La phrase sur le survol n'apparaît qu'à partir de sm : sur un écran tactile il
          n'y a pas de survol, et promettre un geste qui n'existe pas est pire que se taire.
        */}
        <span className="hidden sm:inline">
          {" "}
          Survole une ligne pour voir les écarts qu&rsquo;elle a produits.
        </span>
      </p>

      {loadError && (
        <p className="border-t border-white/[0.08] px-6 py-4 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-flare">
          Erreur de chargement — relevé possiblement incomplet
        </p>
      )}
    </section>
  );
}

function Cell({
  value,
  detail,
  align,
  tone = "default",
}: {
  value: string;
  detail?: string;
  align: "left" | "right";
  /** Teinte le fait qui ouvre l'écart : `flare` de ton côté, `mint` du sien. */
  tone?: "default" | "flare" | "mint";
}) {
  const alignment = align === "right" ? "text-right" : "text-left";
  const color = tone === "flare" ? "text-flare" : tone === "mint" ? "text-mint" : "text-paper";
  return (
    <div className={`min-w-0 ${alignment}`}>
      <p className={`truncate text-sm font-medium sm:text-[0.95rem] ${color}`} title={value}>
        {value}
      </p>
      {detail && (
        <p className="mt-1 truncate text-[0.7rem] text-mist/60" title={detail}>
          {detail}
        </p>
      )}
    </div>
  );
}
