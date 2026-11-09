import Link from "next/link";
import { CheckoutButton } from "./CheckoutButton";
import { DOWNSELL_PERCENT_OFF } from "../pricing-tiers";

/**
 * Seconde chance proposée à qui vient de quitter Checkout sans payer.
 *
 * Le ton reste factuel : une remise, son périmètre (première année, annuel seulement) et
 * une sortie claire. Pas de compte à rebours ni de fausse rareté — la remise est réelle et
 * ne disparaît pas dans l'heure.
 *
 * Composant serveur : il ne porte que du texte. Le bouton, lui, est client et passe
 * `downsell` à /api/billing/checkout, qui décide seul si la remise s'applique.
 */
export function DownsellBanner({
  tier,
  tierName,
}: {
  tier: "pro" | "growth";
  tierName: string;
}) {
  return (
    <section className="border-b border-white/[0.06] bg-signal/[0.06]">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4 px-6 py-8 text-center sm:flex-row sm:justify-between sm:text-left">
        <div>
          <h2 className="font-brand text-lg font-semibold text-paper">
            Le prix t&apos;a freiné ? −{DOWNSELL_PERCENT_OFF} % sur ta première année.
          </h2>
          <p className="mt-1 text-sm text-mist">
            Valable sur {tierName} en annuel, une seule fois. Aucune autre condition.
          </p>
        </div>
        <div className="flex flex-col items-center gap-2 sm:items-end">
          <CheckoutButton
            tier={tier}
            period="yearly"
            downsell
            authenticated
            label={`Prendre ${tierName} à −${DOWNSELL_PERCENT_OFF} %`}
            className="inline-flex h-10 items-center justify-center rounded-full bg-signal px-6 text-sm font-semibold text-paper transition-colors duration-150 hover:bg-signal-bright hover:text-void disabled:opacity-60"
          />
          <Link
            href="/tarifs"
            className="text-xs text-mist underline underline-offset-4 transition-colors hover:text-paper"
          >
            Non merci
          </Link>
        </div>
      </div>
    </section>
  );
}
