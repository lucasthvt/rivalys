import type { CoverageNotice } from "@/lib/compare/comparability";

/**
 * Affiche ce que le comparateur n'a pas pu mesurer, faute de tarifs publics d'un côté ou
 * de l'autre.
 *
 * Volontairement neutre : ni accent bleu (qui signale un écart détecté), ni teinte
 * d'alerte. Ce n'est pas un retard sur le concurrent et ça ne pèse pas sur le score —
 * c'est une limite de mesure, et lui donner l'apparence d'un problème pousserait
 * l'utilisateur à « corriger » quelque chose qui n'est pas de son ressort.
 *
 * Permanent plutôt que passager : le constat reste vrai tant qu'un nouveau relevé ne l'a
 * pas levé, et un message qui disparaît au rechargement laisserait l'écran affirmer de
 * nouveau « aucun écart » sans la moindre réserve.
 */
export function CoverageNoticePanel({ notice }: { notice: CoverageNotice }) {
  return (
    <section
      aria-labelledby="coverage-notice-title"
      className="panel mb-5 flex gap-4 px-5 py-5"
    >
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-foreground-muted"
      >
        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
          <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.4" />
          <path d="M10 6.5v4.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="10" cy="13.6" r="0.85" fill="currentColor" />
        </svg>
      </span>

      <div className="min-w-0">
        <h2
          id="coverage-notice-title"
          className="font-display text-[0.95rem] font-semibold text-foreground"
        >
          {notice.title}
        </h2>

        <ul className="mt-2.5 flex flex-col gap-1.5">
          {notice.observations.map((observation) => (
            <li
              key={observation}
              className="flex gap-2.5 text-sm leading-relaxed text-foreground-muted"
            >
              <span
                aria-hidden="true"
                className="mt-[0.6rem] h-px w-3 shrink-0 bg-foreground-muted/40"
              />
              <span>{observation}</span>
            </li>
          ))}
        </ul>

        <p className="mt-3 text-sm leading-relaxed text-foreground-muted">
          {notice.consequence}
        </p>

        {notice.fitWarning && (
          <p className="mt-3 border-t border-white/[0.06] pt-3 text-sm leading-relaxed text-foreground-muted">
            {notice.fitWarning}
          </p>
        )}
      </div>
    </section>
  );
}
