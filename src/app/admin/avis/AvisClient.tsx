"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TestimonialCard } from "@/components/landing/TestimonialCard";

/**
 * La file d'attente, côté navigateur.
 *
 * Trois groupes dans cet ordre : ce qui attend une décision, ce qui est en ligne, puis ce
 * qui est hors-jeu (sans accord). L'ordre suit ce qu'on vient faire ici — traiter la file,
 * pas contempler l'archive.
 */

export interface AdminTestimonial {
  id: string;
  quote: string;
  author: string;
  role: string | null;
  consentPublic: boolean;
  published: boolean;
  createdAt: string;
}

type Feedback = { kind: "info" | "error"; message: string };

export function AvisClient({
  rows,
  loadError,
}: {
  rows: AdminTestimonial[];
  loadError: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function setPublished(row: AdminTestimonial, published: boolean) {
    setFeedback(null);
    setBusyId(row.id);

    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/testimonials", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: row.id, published }),
        });

        const payload = (await res.json().catch(() => null)) as
          | { ok?: boolean; error?: string }
          | null;

        if (!res.ok) {
          setFeedback({
            kind: "error",
            message: payload?.error ?? "La mise à jour a échoué.",
          });
          return;
        }

        setFeedback({
          kind: "info",
          message: published
            ? `« ${row.author} » est maintenant sur la page d'accueil.`
            : `« ${row.author} » a été retiré de la page d'accueil.`,
        });
        router.refresh();
      } catch {
        setFeedback({ kind: "error", message: "Réseau indisponible. Réessaie." });
      } finally {
        setBusyId(null);
      }
    });
  }

  const waiting = rows.filter((r) => r.consentPublic && !r.published);
  const online = rows.filter((r) => r.published);
  const withoutConsent = rows.filter((r) => !r.consentPublic && !r.published);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-16">
      <header className="border-b border-surface-border pb-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-foreground-muted/70">
          Administration
        </p>
        <h1 className="font-display mt-2 text-2xl sm:text-[28px]">Avis</h1>
        <p className="mt-3 text-sm leading-relaxed text-foreground-muted">
          Chaque carte est affichée avec le composant réel de la page d&rsquo;accueil. Ce que
          tu vois ici est ce qui sera publié, coupures de ligne comprises.
        </p>
      </header>

      {loadError && (
        <p className="mt-6 rounded-xl border border-clay-500/40 p-4 text-sm text-clay-100">
          Lecture impossible : {loadError}
        </p>
      )}

      {feedback && (
        <p
          role="status"
          className={`mt-6 rounded-xl border p-4 text-sm ${
            feedback.kind === "error"
              ? "border-clay-500/40 text-clay-100"
              : "border-white/10 text-mist"
          }`}
        >
          {feedback.message}
        </p>
      )}

      <Group
        title="En attente"
        hint="Accord donné, pas encore publié. C'est la file à traiter."
        rows={waiting}
        empty="Rien en attente."
        render={(row) => (
          <Action
            label="Publier"
            primary
            busy={isPending && busyId === row.id}
            onClick={() => setPublished(row, true)}
          />
        )}
      />

      <Group
        title="En ligne"
        hint="Visible sur la page d'accueil."
        rows={online}
        empty="Aucun avis publié. La bande n'apparaît pas sur la page d'accueil."
        render={(row) => (
          <Action
            label="Retirer"
            busy={isPending && busyId === row.id}
            onClick={() => setPublished(row, false)}
          />
        )}
      />

      <Group
        title="Sans accord de publication"
        hint="Retours internes. Ne peuvent pas être publiés — la route les refuse."
        rows={withoutConsent}
        empty="Aucun."
        render={() => null}
      />
    </div>
  );
}

function Group({
  title,
  hint,
  rows,
  empty,
  render,
}: {
  title: string;
  hint: string;
  rows: AdminTestimonial[];
  empty: string;
  render: (row: AdminTestimonial) => React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-foreground-muted/70">
        {title} <span className="text-foreground-muted/40">({rows.length})</span>
      </h2>
      <p className="mt-1.5 text-sm text-foreground-muted">{hint}</p>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-foreground-muted/60">{empty}</p>
      ) : (
        <ul className="mt-5 flex flex-col gap-5">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-col gap-3 sm:flex-row sm:items-start">
              {/*
                Largeur identique à celle de la bande : une carte relue plus large que la
                carte publiée ne montrerait pas les coupures réelles, et l'écran mentirait
                sur sa seule promesse.
              */}
              <TestimonialCard
                testimonial={{ quote: row.quote, author: row.author, role: row.role ?? undefined }}
                className="w-full sm:w-[24rem] sm:shrink-0"
              />
              <div className="flex flex-col gap-2 sm:pt-1">
                <p className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-foreground-muted/50">
                  {formatDate(row.createdAt)} · {row.quote.length} signes
                </p>
                {render(row)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Action({
  label,
  onClick,
  busy,
  primary = false,
}: {
  label: string;
  onClick: () => void;
  busy: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`inline-flex h-9 items-center justify-center rounded-full px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        primary
          ? "bg-signal text-paper hover:bg-signal-bright hover:text-void"
          : "border border-white/10 text-paper hover:border-signal-bright/40"
      }`}
    >
      {busy ? "…" : label}
    </button>
  );
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "date inconnue";
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}
