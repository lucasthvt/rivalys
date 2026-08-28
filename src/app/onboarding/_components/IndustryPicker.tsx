"use client";

import { useMemo, useState } from "react";
import { BigField, SuggestionChip } from "./Fields";
import { filterIndustryGroups, isKnownIndustry, normalizeIndustry } from "./industries";

type IndustryPickerProps = {
  value: string;
  onChange: (value: string) => void;
};

/**
 * Search-as-you-filter sector picker. The typed text is itself a valid
 * answer — a founder in a niche we didn't list types it and moves on, which
 * is why the query doubles as the free-text field instead of being a
 * separate input.
 */
export function IndustryPicker({ value, onChange }: IndustryPickerProps) {
  // Seeded from `value` so going back a step shows the previous answer.
  const [query, setQuery] = useState(value);

  const groups = useMemo(() => filterIndustryGroups(query), [query]);
  const trimmedQuery = query.trim();

  // Only worth offering when it isn't already one of the listed sectors.
  const showCustomOption = trimmedQuery.length > 0 && !isKnownIndustry(trimmedQuery);

  function select(industry: string) {
    onChange(industry);
    setQuery(industry);
  }

  return (
    <div>
      <BigField
        id="industry"
        label="Secteur"
        autoFocus
        autoComplete="off"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          // Typing IS the answer: keep the profile in sync as they go, so
          // "Continuer" works without forcing a click on a chip.
          onChange(event.target.value);
        }}
        placeholder="Cherche : CRM, e-commerce, santé..."
      />

      {/*
        Clearing the search only widens the list back out — the answer itself
        survives in `value`, and is echoed below so it never looks lost.
      */}
      {trimmedQuery.length > 0 ? (
        <button
          type="button"
          onClick={() => setQuery("")}
          className="mt-3 font-mono text-[11px] uppercase tracking-[0.16em] text-foreground-muted underline underline-offset-4 transition-colors hover:text-foreground"
        >
          Voir tous les secteurs
        </button>
      ) : value.trim() ? (
        <p className="mt-3 text-sm text-foreground-muted">
          Secteur retenu : <span className="text-foreground">{value.trim()}</span>
        </p>
      ) : null}

      {groups.length === 0 && !showCustomOption ? (
        <p className="mt-6 text-sm text-foreground-muted">
          Aucun secteur ne correspond — garde ta formulation, elle sera enregistrée telle quelle.
        </p>
      ) : (
        <div className="mt-6 max-h-[19rem] overflow-y-auto pr-1">
          {showCustomOption ? (
            <div className="mb-6">
              <SuggestionChip
                label={`Utiliser « ${trimmedQuery} »`}
                active={normalizeIndustry(value) === normalizeIndustry(trimmedQuery)}
                onClick={() => select(trimmedQuery)}
              />
            </div>
          ) : null}

          <div className="flex flex-col gap-5">
            {groups.map((group) => (
              <div key={group.label}>
                <p className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-foreground-muted">
                  {group.label}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {group.items.map((item) => (
                    <SuggestionChip
                      key={item}
                      label={item}
                      active={normalizeIndustry(value) === normalizeIndustry(item)}
                      onClick={() => select(item)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
