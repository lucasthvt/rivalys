"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TESTIMONIAL_LIMITS } from "@/lib/testimonials/limits";

/**
 * Demande de retour, sur son propre écran (/avis).
 *
 * Elle vivait en bas du tableau de bord, après le relevé. C'était le bon moment mais le
 * mauvais endroit : un écran qui répond « où je perds du terrain » finissait par demander
 * un service, et le bloc se lisait comme une bannière collée sous le contenu. Sur son
 * propre onglet, la demande est une page qu'on ouvre, pas une interruption.
 *
 * Placée après une analyse aboutie et non à l'inscription : quelqu'un qui vient de voir
 * son premier écart a quelque chose à dire, quelqu'un qui vient de créer un compte n'a
 * rien vécu. C'est aussi la différence entre un avis utilisable et une phrase polie.
 *
 * Le consentement est décoché par défaut, et l'étiquette dit exactement ce qui sera
 * publié. Une case pré-cochée n'est pas un consentement — c'est un consentement supposé,
 * et c'est précisément ce que le RGPD ne reconnaît pas.
 */

export interface ExistingTestimonial {
  quote: string;
  author_label: string;
  role_label: string | null;
  consent_public: boolean;
  published: boolean;
}

type Feedback = { kind: "info" | "error"; message: string };

export function TestimonialPrompt({ existing }: { existing: ExistingTestimonial | null }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const [quote, setQuote] = useState(existing?.quote ?? "");
  const [authorLabel, setAuthorLabel] = useState(existing?.author_label ?? "");
  const [roleLabel, setRoleLabel] = useState(existing?.role_label ?? "");
  const [consent, setConsent] = useState(existing?.consent_public ?? false);

  const remaining = TESTIMONIAL_LIMITS.quote.max - quote.trim().length;
  const tooShort = quote.trim().length < TESTIMONIAL_LIMITS.quote.min;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/testimonials", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quote,
            authorLabel,
            roleLabel: roleLabel || null,
            consentPublic: consent,
          }),
        });

        const payload = (await res.json().catch(() => null)) as
          | { ok?: boolean; error?: string }
          | null;

        if (!res.ok) {
          setFeedback({
            kind: "error",
            message: payload?.error ?? "Le retour n'a pas pu être enregistré.",
          });
          return;
        }

        setFeedback({
          kind: "info",
          message: consent
            ? "Merci. On te préviendra avant toute publication."
            : "Merci. Ton retour reste interne, il ne sera pas publié.",
        });
        setOpen(false);
        router.refresh();
      } catch {
        setFeedback({ kind: "error", message: "Réseau indisponible. Réessaie." });
      }
    });
  }

  if (!open) {
    return (
      <div className="panel flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[0.95rem] text-paper">
            {existing
              ? "Ton retour est enregistré."
              : "Une phrase sur ce que Rivalys t'a montré ?"}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-mist">
            {existing
              ? existing.published
                ? "Il est affiché sur la page d'accueil. Tu peux le modifier ou retirer ton accord à tout moment."
                : existing.consent_public
                  ? "En attente de relecture avant publication."
                  : "Conservé en interne : tu n'as pas donné ton accord de publication."
              : "Deux lignes suffisent. Tu décides ensuite si elles peuvent être publiées, ou si elles restent entre nous."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-full border border-white/10 px-5 text-sm font-semibold text-paper transition-colors hover:border-signal-bright/40"
        >
          {existing ? "Modifier" : "Écrire un retour"}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="panel flex flex-col gap-5 p-5 sm:p-6">
      <div>
        <label htmlFor="testimonial-quote" className="text-[0.95rem] text-paper">
          Ce que Rivalys t&rsquo;a montré
        </label>
        <textarea
          id="testimonial-quote"
          value={quote}
          onChange={(event) => setQuote(event.target.value)}
          rows={3}
          maxLength={TESTIMONIAL_LIMITS.quote.max}
          required
          placeholder="Ex. : j'ai découvert que mon concurrent proposait un essai gratuit depuis six mois."
          className="mt-2 w-full rounded-xl border border-white/10 bg-void-raised px-4 py-3 text-[0.95rem] text-paper placeholder:text-mist/40 focus:border-signal-bright/40 focus:outline-none"
        />
        <p className="mt-1.5 font-mono text-[0.64rem] uppercase tracking-[0.1em] text-mist/50">
          {tooShort
            ? `Encore ${TESTIMONIAL_LIMITS.quote.min - quote.trim().length} caractères`
            : `${remaining} caractères restants`}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="testimonial-author" className="text-[0.95rem] text-paper">
            Nom affiché
          </label>
          <input
            id="testimonial-author"
            value={authorLabel}
            onChange={(event) => setAuthorLabel(event.target.value)}
            maxLength={TESTIMONIAL_LIMITS.author.max}
            required
            placeholder="Prénom, pseudo, ou nom de ton SaaS"
            className="mt-2 w-full rounded-xl border border-white/10 bg-void-raised px-4 py-3 text-[0.95rem] text-paper placeholder:text-mist/40 focus:border-signal-bright/40 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="testimonial-role" className="text-[0.95rem] text-paper">
            Contexte <span className="text-mist/50">(facultatif)</span>
          </label>
          <input
            id="testimonial-role"
            value={roleLabel}
            onChange={(event) => setRoleLabel(event.target.value)}
            maxLength={TESTIMONIAL_LIMITS.role.max}
            placeholder="Ex. : fondateur, SaaS RH"
            className="mt-2 w-full rounded-xl border border-white/10 bg-void-raised px-4 py-3 text-[0.95rem] text-paper placeholder:text-mist/40 focus:border-signal-bright/40 focus:outline-none"
          />
        </div>
      </div>

      {/*
        Case décochée par défaut, et l'étiquette énumère précisément ce qui sera visible.
        C'est ce qui distingue un avis publiable d'un avis publié sans accord.
      */}
      <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-mist">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-signal)]"
        />
        <span>
          J&rsquo;autorise Rivalys à publier cette phrase, le nom affiché et le contexte
          ci-dessus sur son site. Mon email n&rsquo;est pas publié. Je peux retirer cet
          accord à tout moment depuis cette page.
        </span>
      </label>

      {feedback && (
        <p
          className={`text-sm ${feedback.kind === "error" ? "text-flare" : "text-mist"}`}
          role="status"
        >
          {feedback.message}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isPending || tooShort}
          className="inline-flex h-10 items-center justify-center rounded-full bg-signal px-5 text-sm font-semibold text-paper transition-colors hover:bg-signal-bright hover:text-void disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Enregistrement…" : "Envoyer"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-mist transition-colors hover:text-paper"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}
