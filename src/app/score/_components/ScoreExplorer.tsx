"use client";

import { useState } from "react";
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
      <section className="panel-focal mb-5 px-5 py-6">
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="font-mono text-[44px] leading-none text-foreground">
            {breakdown.score}
          </span>
          <span className="font-mono text-sm text-foreground-muted">/ {MAX_SCORE}</span>

          {simulating && (
            <span className="font-mono flex items-baseline gap-2 text-sm">
              <span aria-hidden className="text-foreground-muted/50">
                →
              </span>
              <span className="text-signal-bright">{projected}</span>
              <span className="text-foreground-muted/70">
                {gained > 0 ? `+${gained}` : gained} pt{Math.abs(gained) > 1 ? "s" : ""}
              </span>
            </span>
          )}
        </div>

        <p className="mt-3 max-w-xl text-sm leading-relaxed text-foreground-muted">
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
            className="mt-4 font-mono text-[11px] uppercase tracking-[0.12em] text-accent-strong transition-colors hover:text-foreground"
          >
            Réinitialiser la simulation
          </button>
        )}
      </section>

      <section className="panel mb-5 overflow-hidden">
        <div className="border-b border-white/[0.06] px-5 py-4">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-foreground-muted/70">
            Le calcul
          </h2>
        </div>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-surface-border text-left font-mono text-[11px] uppercase tracking-[0.12em] text-foreground-muted/70">
              <th className="px-5 py-3 font-medium">Priorité</th>
              <th className="px-5 py-3 font-medium">Écarts ouverts</th>
              <th className="px-5 py-3 font-medium">Points par écart</th>
              <th className="px-5 py-3 text-right font-medium">Points retirés</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-surface-border">
              <td className="px-5 py-3 text-foreground-muted">Point de départ</td>
              <td className="px-5 py-3 text-foreground-muted">—</td>
              <td className="px-5 py-3 text-foreground-muted">—</td>
              <td className="px-5 py-3 text-right font-mono text-foreground">+{MAX_SCORE}</td>
            </tr>

            {breakdown.lines.map((line) => {
              const selected = focus === line.priority;
              const selectable = line.count > 0;

              return (
                <tr
                  key={line.priority}
                  onClick={selectable ? () => setFocus(selected ? null : line.priority) : undefined}
                  className={`border-b border-surface-border transition-colors ${
                    selected ? "bg-signal/15" : selectable ? "cursor-pointer hover:bg-white/[0.04]" : ""
                  }`}
                >
                  <td className="px-5 py-3">
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
                  <td className="px-5 py-3 font-mono text-foreground">{line.count}</td>
                  <td className="px-5 py-3 font-mono text-foreground-muted">−{line.pointsEach}</td>
                  <td className="px-5 py-3 text-right font-mono text-foreground">
                    {line.pointsLost === 0 ? "0" : `−${line.pointsLost}`}
                  </td>
                </tr>
              );
            })}

            <tr>
              <td className="px-5 py-4 font-medium text-foreground" colSpan={3}>
                Score
              </td>
              <td className="px-5 py-4 text-right font-mono text-lg text-foreground">
                {breakdown.score}
              </td>
            </tr>
          </tbody>
        </table>

        {breakdown.clamped && (
          <p className="border-t border-white/[0.06] px-5 py-4 text-sm leading-relaxed text-foreground-muted">
            Les pénalités totalisent {breakdown.totalLost} points, au-delà des {MAX_SCORE}{" "}
            disponibles. Le score reste donc bloqué à 0 : il ne remontera qu&rsquo;une fois les
            pénalités repassées sous {MAX_SCORE}. Ferme les écarts en priorité haute
            d&rsquo;abord, ce sont eux qui pèsent le plus.
          </p>
        )}
      </section>

      <section className="panel mb-5 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-foreground-muted/70">
            {focus === null
              ? "Les écarts qui te coûtent des points"
              : `Priorité ${PRIORITY_LABEL[focus].toLowerCase()} · ${visible.length} sur ${gaps.length}`}
          </h2>
          {focus !== null && (
            <button
              type="button"
              onClick={() => setFocus(null)}
              className="font-mono text-[11px] uppercase tracking-[0.12em] text-accent-strong transition-colors hover:text-foreground"
            >
              Tout voir
            </button>
          )}
        </div>

        {visible.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-foreground-muted">
            Aucun écart ouvert. Ton score est au maximum.
          </p>
        ) : (
          <ul>
            {visible.map((gap) => {
              const off = simulated.has(gap.id);
              return (
                <li
                  key={gap.id}
                  className={`flex flex-col gap-2 border-b border-white/[0.06] px-5 py-4 transition-colors last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-6 ${
                    off ? "bg-signal/[0.07]" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <PriorityBadge priority={gap.priority} />
                      <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-foreground-muted/70">
                        {CATEGORY_LABEL[gap.category]}
                      </span>
                    </div>
                    <p
                      className={`text-[15px] ${off ? "text-foreground-muted line-through" : "text-foreground"}`}
                    >
                      {gap.title}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <span className="font-mono text-sm text-foreground-muted">
                      −{POINTS_PER_PRIORITY[gap.priority]} pts
                    </span>
                    <button
                      type="button"
                      aria-pressed={off}
                      onClick={() => toggle(gap.id)}
                      className={`rounded-full border px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors ${
                        off
                          ? "border-signal-bright/45 bg-signal/15 text-foreground"
                          : "border-surface-border text-foreground-muted hover:border-accent-strong/40 hover:text-foreground"
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
