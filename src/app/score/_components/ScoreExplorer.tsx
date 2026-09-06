"use client";

import { useState } from "react";
import { PanelHeader } from "@/components/layout/Panel";
import { PriorityBadge } from "@/components/tasks/priority-badge";
import { CATEGORY_LABEL, PRIORITY_LABEL, type DetectedGap } from "@/components/tasks/priority";
import {
  computeScore,
  countByPriority,
  explainScore,
  MAX_SCORE,
  POINTS_PER_PRIORITY,
} from "@/lib/compare/score";
import type { GapPriority } from "@/lib/supabase/database.types";

/**
 * Le score, son calcul, et ce qui le compose — reliés entre eux.
 *
 * L'écran affichait trois blocs qui parlaient des mêmes chiffres sans jamais se
 * répondre : un score, un tableau de calcul, une liste d'écarts. Deux liens les
 * relient désormais.
 *
 * Cliquer une ligne du calcul réduit la liste aux écarts qui coûtent ces points.
 * Un nombre qui décrit une population devrait mener à cette population, sinon il
 * faut faire le tri de tête.
 *
 * Simuler la fermeture d'un écart recalcule le score avec le VRAI moteur
 * (computeScore), pas une soustraction refaite ici. C'est ce qui garantit que la
 * simulation ne peut pas annoncer un score que l'analyse suivante contredira —
 * notamment quand les pénalités dépassent 100 et que le score est écrêté à 0.
 *
 * La simulation n'écrit rien. Elle répond à « qu'est-ce que ça me rapporte de
 * traiter celui-là », question qu'on se pose avant d'agir, pas après.
 */
export function ScoreExplorer({
  gaps,
  competitorLabel,
}: {
  gaps: DetectedGap[];
  competitorLabel: string;
}) {
  const [focus, setFocus] = useState<GapPriority | null>(null);
  const [simulated, setSimulated] = useState<Set<string>>(new Set());

  const breakdown = explainScore(countByPriority(gaps));

  const remaining = gaps.filter((gap) => !simulated.has(gap.id));
  const projected = computeScore(countByPriority(remaining));
  const simulating = simulated.size > 0;
  const gained = projected - breakdown.score;

  const visible = focus === null ? gaps : gaps.filter((gap) => gap.priority === focus);

  function toggle(id: string) {
    setSimulated((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <>
      <section className="panel-focal mb-6 p-6 sm:p-8">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
          {/*
            tabular-nums : sans chasse fixe, la largeur du nombre change à chaque
            simulation cochée et le panneau tremble. Même traitement que la carte
            de score de la landing, dont ce chiffre est la version réelle.
          */}
          <span className="font-brand text-[3.2rem] font-bold leading-[0.9] tracking-[-0.05em] tabular-nums text-signal-bright sm:text-[4rem]">
            {breakdown.score}
          </span>
          <span className="font-mono text-sm text-mist/60">/{MAX_SCORE}</span>

          {simulating && (
            <span className="font-mono flex items-baseline gap-2 text-sm">
              <span aria-hidden className="text-mist/50">
                →
              </span>
              <span className="tabular-nums text-signal-bright">{projected}</span>
              <span className="text-mist/70">
                {gained > 0 ? `+${gained}` : gained} pt{Math.abs(gained) > 1 ? "s" : ""}
              </span>
            </span>
          )}
        </div>

        <p className="mt-4 max-w-xl text-sm leading-relaxed text-mist">
          {simulating ? (
            <>
              Simulation : {simulated.size} écart{simulated.size > 1 ? "s" : ""} fermé
              {simulated.size > 1 ? "s" : ""}. Rien n&rsquo;est enregistré — ferme-les depuis
              les tâches pour que ça compte.
            </>
          ) : (
            <>
              Le score part de {MAX_SCORE} et retire des points pour chaque écart encore
              ouvert, selon sa priorité. Il ne note pas la qualité de ton produit : il mesure
              ce qu&rsquo;il te reste à rattraper face à {competitorLabel}.
            </>
          )}
        </p>

        {simulating && (
          <button
            type="button"
            onClick={() => setSimulated(new Set())}
            className="mt-5 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-signal-bright transition-colors hover:text-paper"
          >
            Réinitialiser la simulation
          </button>
        )}
      </section>

      <section className="panel mb-6 overflow-hidden">
        <PanelHeader title="Le calcul" />

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-white/[0.08] text-left font-mono text-[0.62rem] uppercase tracking-[0.12em] text-mist/60">
              <th className="px-6 py-3 font-medium">Priorité</th>
              <th className="px-6 py-3 font-medium">Écarts ouverts</th>
              <th className="px-6 py-3 font-medium">Points par écart</th>
              <th className="px-6 py-3 text-right font-medium">Points retirés</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-white/[0.08]">
              <td className="px-6 py-3 text-mist">Point de départ</td>
              <td className="px-6 py-3 text-mist">—</td>
              <td className="px-6 py-3 text-mist">—</td>
              <td className="px-6 py-3 text-right font-mono tabular-nums text-paper">
                +{MAX_SCORE}
              </td>
            </tr>

            {breakdown.lines.map((line) => {
              const selected = focus === line.priority;
              const selectable = line.count > 0;

              return (
                <tr
                  key={line.priority}
                  onClick={selectable ? () => setFocus(selected ? null : line.priority) : undefined}
                  className={`border-b border-white/[0.08] transition-colors ${
                    selected
                      ? "bg-signal/15"
                      : selectable
                        ? "cursor-pointer hover:bg-white/[0.03]"
                        : ""
                  }`}
                >
                  <td className="px-6 py-3">
                    {/*
                      Le bouton porte l'action plutôt que la ligne entière : une ligne de
                      tableau cliquable n'est atteignable ni au clavier ni au lecteur
                      d'écran. Le survol de la ligne reste, il ne fait qu'annoncer la cible.
                    */}
                    {selectable ? (
                      <button
                        type="button"
                        aria-pressed={selected}
                        onClick={(event) => {
                          event.stopPropagation();
                          setFocus(selected ? null : line.priority);
                        }}
                        className="rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal-bright"
                      >
                        <PriorityBadge priority={line.priority} />
                        <span className="sr-only">
                          {selected
                            ? "Retirer le filtre"
                            : `Ne montrer que les écarts en priorité ${PRIORITY_LABEL[line.priority].toLowerCase()}`}
                        </span>
                      </button>
                    ) : (
                      <PriorityBadge priority={line.priority} />
                    )}
                  </td>
                  <td className="px-6 py-3 font-mono tabular-nums text-paper">{line.count}</td>
                  <td className="px-6 py-3 font-mono tabular-nums text-mist">−{line.pointsEach}</td>
                  <td className="px-6 py-3 text-right font-mono tabular-nums text-paper">
                    {line.pointsLost === 0 ? "0" : `−${line.pointsLost}`}
                  </td>
                </tr>
              );
            })}

            <tr>
              <td className="px-6 py-4 font-medium text-paper" colSpan={3}>
                Score
              </td>
              <td className="px-6 py-4 text-right font-mono text-lg tabular-nums text-signal-bright">
                {breakdown.score}
              </td>
            </tr>
          </tbody>
        </table>

        {breakdown.clamped && (
          <p className="border-t border-white/[0.08] px-6 py-4 text-sm leading-relaxed text-mist">
            Les pénalités totalisent {breakdown.totalLost} points, au-delà des {MAX_SCORE}{" "}
            disponibles. Le score reste donc bloqué à 0 : il ne remontera qu&rsquo;une fois les
            pénalités repassées sous {MAX_SCORE}. Ferme les écarts en priorité haute
            d&rsquo;abord, ce sont eux qui pèsent le plus.
          </p>
        )}
      </section>

      <section className="panel mb-6 overflow-hidden">
        <PanelHeader
          title={
            focus === null
              ? "Les écarts qui te coûtent des points"
              : `Priorité ${PRIORITY_LABEL[focus].toLowerCase()} · ${visible.length} sur ${gaps.length}`
          }
          action={
            focus !== null ? (
              <button
                type="button"
                onClick={() => setFocus(null)}
                className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-signal-bright transition-colors hover:text-paper"
              >
                Tout voir
              </button>
            ) : null
          }
        />

        {visible.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-mist">
            Aucun écart ouvert. Ton score est au maximum.
          </p>
        ) : (
          <ul>
            {visible.map((gap) => {
              const off = simulated.has(gap.id);
              return (
                <li
                  key={gap.id}
                  className={`flex flex-col gap-2 border-b border-white/[0.08] px-6 py-5 transition-colors last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-6 ${
                    off ? "bg-signal/[0.07]" : "hover:bg-white/[0.022]"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                      <PriorityBadge priority={gap.priority} />
                      <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-mist/60">
                        {CATEGORY_LABEL[gap.category]}
                      </span>
                    </div>
                    <p
                      className={`font-brand text-[1.05rem] font-medium leading-snug tracking-[-0.01em] ${
                        off ? "text-mist line-through" : "text-paper"
                      }`}
                    >
                      {gap.title}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <span className="font-mono text-sm tabular-nums text-mist">
                      −{POINTS_PER_PRIORITY[gap.priority]} pts
                    </span>
                    <button
                      type="button"
                      aria-pressed={off}
                      onClick={() => toggle(gap.id)}
                      className={`rounded-full border px-3.5 py-1.5 font-mono text-[0.64rem] uppercase tracking-[0.1em] transition-colors ${
                        off
                          ? "border-signal-bright/45 bg-signal/15 text-paper"
                          : "border-white/[0.14] text-mist hover:border-signal-bright/40 hover:text-paper"
                      }`}
                    >
                      {off ? "Simulé fermé" : "Simuler"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
