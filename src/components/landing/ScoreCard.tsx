"use client";

import { useEffect, useRef, useState } from "react";

export interface ScoreLine {
  /** « 1 écart prioritaire » — déjà accordé côté serveur. */
  label: string;
  /** Points retirés par cette ligne. Positif ; le signe est ajouté à l'affichage. */
  lost: number;
  /** Intensité du trait — graduation de l'accent, jamais un feu tricolore. */
  bar: string;
}

/**
 * La carte de score de la landing.
 *
 * Le nombre descend de 100 jusqu'au score d'exemple quand la carte entre dans
 * l'écran. Ce n'est pas une décoration : la promesse de la section est « 100
 * moins les écarts », et voir le chiffre partir de 100 pour tomber montre la
 * soustraction au lieu de la raconter.
 *
 * L'animation ne se joue qu'une fois — la rejouer à chaque passage
 * transformerait un argument en clignotant. Et si le système réclame moins de
 * mouvement, le score s'affiche directement à sa valeur finale : rien n'est
 * perdu, puisque le détail chiffré est écrit juste en dessous.
 */
export function ScoreCard({
  score,
  maxScore,
  lines,
}: {
  score: number;
  maxScore: number;
  lines: ScoreLine[];
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  // L'état de départ est le score final, pas 100 : c'est ce que voit un
  // visiteur sans JavaScript, et ce que rend le serveur. L'animation ne fait
  // que remonter à 100 pour redescendre, une fois la carte visible.
  const [displayed, setDisplayed] = useState(score);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || typeof IntersectionObserver === "undefined") return;

    let frame = 0;
    let started = false;

    const observer = new IntersectionObserver(
      (entries) => {
        if (started || !entries.some((entry) => entry.isIntersecting)) return;
        started = true;
        observer.disconnect();

        const start = performance.now();
        const duration = 900;
        const lost = maxScore - score;

        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - t, 3);
          setDisplayed(Math.round(maxScore - lost * eased));
          if (t < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.4 }
    );

    observer.observe(card);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [score, maxScore]);

  const totalLost = maxScore - score;

  return (
    <div ref={cardRef} className="panel p-6 sm:p-8">
      <div className="flex items-end justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-mist/60">
            Score global
          </p>
          <p className="mt-2 flex items-baseline gap-1.5">
            {/*
              tabular-nums : sans chasse fixe, chaque décrément redessine la
              largeur du nombre et la carte tremble pendant toute l'animation.
            */}
            <span className="font-brand text-[3.4rem] font-bold leading-[0.9] tracking-[-0.05em] tabular-nums text-signal-bright sm:text-[4.4rem]">
              {displayed}
            </span>
            <span className="font-mono text-sm text-mist/60">/{maxScore}</span>
          </p>
        </div>
        <p className="text-right font-mono text-[0.68rem] leading-relaxed text-mist">
          {maxScore}
          <br />
          −{totalLost} d&rsquo;écarts
        </p>
      </div>

      <dl className="mt-6 flex flex-col gap-[1.15rem]">
        {lines.map((line, index) => (
          <div key={line.label}>
            <div className="flex items-baseline justify-between gap-4 text-sm">
              <dt className="text-paper">{line.label}</dt>
              <dd className="font-mono text-signal-bright">−{line.lost}</dd>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
              <div
                className={`meter-fill h-full rounded-full ${line.bar}`}
                style={{
                  width: `${(line.lost / totalLost) * 100}%`,
                  animationDelay: `${0.15 + index * 0.15}s`,
                }}
              />
            </div>
          </div>
        ))}
      </dl>
    </div>
  );
}
