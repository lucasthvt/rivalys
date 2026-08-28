"use client";

import { useState, type ReactNode } from "react";

const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

/**
 * Rend les URL d'une description comme des liens cliquables.
 *
 * Les descriptions sont produites par nos propres règles de détection
 * (lib/compare/detect-gaps.ts), pas par du texte libre d'un tiers : les URL
 * qu'elles contiennent sont celles relevées par le pipeline. Elles s'ouvrent
 * dans un nouvel onglet avec `noreferrer` — l'utilisateur va constater par
 * lui-même ce que le produit affirme, c'est le cœur de la promesse.
 */
function linkify(text: string): ReactNode[] {
  return text.split(URL_PATTERN).map((part, index) => {
    if (!/^https?:\/\//.test(part)) return part;
    return (
      <a
        key={index}
        href={part}
        target="_blank"
        rel="noreferrer noopener"
        className="break-all text-accent-strong underline underline-offset-2 transition-colors hover:text-foreground"
      >
        {part}
      </a>
    );
  });
}

/** Au-delà, la description est repliée derrière « Tout lire ». */
const LONG_THRESHOLD = 260;

export function GapDescription({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > LONG_THRESHOLD;

  return (
    <div>
      <p
        className={`mt-1.5 text-sm leading-relaxed text-foreground-muted ${
          isLong && !expanded ? "line-clamp-3" : ""
        }`}
      >
        {linkify(text)}
      </p>

      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-2 font-mono text-[11px] uppercase tracking-[0.12em] text-accent-strong transition-colors hover:text-foreground"
        >
          {expanded ? "Replier" : "Tout lire"}
        </button>
      )}
    </div>
  );
}
