"use client";

import { useState } from "react";
import { exportMyData } from "../actions";

/**
 * Télécharge l'export RGPD au format JSON.
 *
 * Le fichier est fabriqué dans le navigateur à partir de ce que l'action serveur renvoie,
 * plutôt que servi par une route dédiée : une route `/api/export` serait une URL de plus à
 * protéger, et celle-ci n'existe que le temps du clic.
 */
export function ExportDataButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleClick() {
    setError(null);
    setDone(false);
    setPending(true);

    const result = await exportMyData();

    if (!result.ok) {
      setError(result.error);
      setPending(false);
      return;
    }

    const blob = new Blob([JSON.stringify(result.data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `rivalys-mes-donnees-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);

    setPending(false);
    setDone(true);
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="inline-flex h-10 items-center justify-center rounded-full border border-surface-border px-5 text-sm font-semibold text-foreground transition-colors hover:border-signal-bright/40 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Préparation…" : "Télécharger mes données (JSON)"}
      </button>
      {error ? (
        <p role="alert" className="mt-3 text-xs leading-relaxed text-flare">
          {error}
        </p>
      ) : null}
      {done ? (
        <p role="status" className="mt-3 text-xs leading-relaxed text-foreground-muted">
          Export téléchargé.
        </p>
      ) : null}
    </div>
  );
}
