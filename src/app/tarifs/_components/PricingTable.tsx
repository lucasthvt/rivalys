"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckoutButton } from "./CheckoutButton";
import { PRICING_TIERS, type BillingPeriod } from "../pricing-tiers";

/**
 * Grille de tarifs, avec le sélecteur mensuel / annuel.
 *
 * Le composant est client parce que la périodicité est un choix qui ne doit pas coûter
 * un aller-retour serveur — et surtout parce que, sans lui, le seul prix atteignable au
 * paiement était le mensuel : `CheckoutButton` envoyait toujours `period: "monthly"`.
 * L'annuel était affiché en petit sous le prix, sans aucun moyen de le souscrire.
 *
 * La périodicité choisie est envoyée telle quelle à /api/billing/checkout, qui la
 * revalide et résout l'identifiant de prix Stripe côté serveur. Rien ici ne décide de ce
 * qui sera facturé : le navigateur ne fait que nommer un palier et une périodicité.
 */
export function PricingTable({
  authenticated,
  paymentOpen,
}: {
  authenticated: boolean;
  paymentOpen: boolean;
}) {
  const [period, setPeriod] = useState<BillingPeriod>("yearly");

  return (
    <>
      <PeriodToggle value={period} onChange={setPeriod} />

      <div className="mt-10 grid gap-5 sm:grid-cols-3">
        {PRICING_TIERS.map((tier) => {
          const plan = tier.plans[period];

          return (
            <div
              key={tier.name}
              className={`flex flex-col rounded-2xl border p-6 ${
                tier.highlighted
                  ? "border-signal-bright/40 bg-signal/10 shadow-signal-sm"
                  : "border-white/10 bg-void-raised"
              }`}
            >
              <h2 className="font-brand text-lg font-semibold text-paper">{tier.name}</h2>
              <p className="mt-2 text-sm leading-relaxed text-mist">{tier.tagline}</p>
              <p className="mt-6 flex items-baseline gap-2">
                <span className="font-mono text-3xl text-paper">{plan.price}</span>
                <span className="text-sm text-mist">{plan.period}</span>
              </p>
              {/*
                Hauteur réservée même sans mention secondaire, pour que les listes de
                fonctionnalités des trois cartes démarrent sur la même ligne.
              */}
              <p className="mt-1 min-h-[1.25rem] text-xs text-mist">{plan.note ?? ""}</p>
              <ul className="mt-6 flex flex-1 flex-col gap-2">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-mist">
                    <span
                      className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-signal-bright"
                      aria-hidden="true"
                    />
                    {feature}
                  </li>
                ))}
              </ul>
              {/*
                Trois cas, et aucun ne doit mentir sur ce qui va se passer :
                paiement ouvert → Checkout ; visiteur déconnecté → inscription ;
                déjà connecté mais paiement pas encore ouvert → on le dit, plutôt
                que de le renvoyer créer un compte qu'il a déjà.
              */}
              {tier.checkout && paymentOpen ? (
                <div className="mt-6">
                  <CheckoutButton
                    tier={tier.checkout}
                    period={period}
                    label={tier.cta}
                    authenticated={authenticated}
                    className={`inline-flex h-10 w-full items-center justify-center rounded-full text-sm font-semibold transition-colors duration-150 disabled:opacity-60 ${
                      tier.highlighted
                        ? "bg-signal text-paper hover:bg-signal-bright hover:text-void"
                        : "border border-white/10 text-paper hover:border-signal-bright/40"
                    }`}
                  />
                </div>
              ) : authenticated ? (
                <div className="mt-6">
                  <span
                    className={`inline-flex h-10 w-full cursor-not-allowed items-center justify-center rounded-full text-sm font-semibold opacity-50 ${
                      tier.highlighted ? "bg-signal text-paper" : "border border-white/10 text-paper"
                    }`}
                  >
                    {tier.checkout ? "Paiement bientôt ouvert" : "Bientôt disponible"}
                  </span>
                  <Link
                    href="/dashboard"
                    className="mt-3 block text-center text-xs text-mist underline underline-offset-4 transition-colors hover:text-paper"
                  >
                    Retour au tableau de bord
                  </Link>
                </div>
              ) : (
                <Link
                  href="/signup"
                  className={`mt-6 inline-flex h-10 items-center justify-center rounded-full text-sm font-semibold transition-colors duration-150 ${
                    tier.highlighted
                      ? "bg-signal text-paper hover:bg-signal-bright hover:text-void"
                      : "border border-white/10 text-paper hover:border-signal-bright/40"
                  }`}
                >
                  {tier.cta}
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

/**
 * Sélecteur de périodicité.
 *
 * `role="group"` + `aria-pressed` plutôt qu'un radiogroup : les deux options sont des
 * boutons qui agissent immédiatement sur l'affichage, pas un champ de formulaire à
 * soumettre. Le lecteur d'écran annonce l'état enfoncé, ce qui décrit exactement ce qui
 * se passe.
 */
function PeriodToggle({
  value,
  onChange,
}: {
  value: BillingPeriod;
  onChange: (next: BillingPeriod) => void;
}) {
  return (
    <div className="flex justify-center">
      <div
        role="group"
        aria-label="Périodicité de facturation"
        className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-void-raised p-1"
      >
        <PeriodOption
          selected={value === "monthly"}
          onClick={() => onChange("monthly")}
          label="Mensuel"
        />
        <PeriodOption
          selected={value === "yearly"}
          onClick={() => onChange("yearly")}
          label="Annuel"
          hint="2 mois offerts"
        />
      </div>
    </div>
  );
}

function PeriodOption({
  selected,
  onClick,
  label,
  hint,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors duration-150 ${
        selected ? "bg-signal text-paper" : "text-mist hover:text-paper"
      }`}
    >
      {label}
      {hint ? (
        <span
          className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] ${
            selected ? "bg-void/30 text-paper" : "bg-white/[0.06] text-signal-bright"
          }`}
        >
          {hint}
        </span>
      ) : null}
    </button>
  );
}
