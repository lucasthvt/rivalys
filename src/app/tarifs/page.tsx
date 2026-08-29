import { Eyebrow } from "@/components/ui/Eyebrow";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isStripeConfigured } from "@/lib/billing/stripe";
import { CheckoutButton } from "./_components/CheckoutButton";

type PricingTier = {
  name: string;
  price: string;
  period: string;
  yearly?: string;
  tagline: string;
  features: string[];
  cta: string;
  /** Palier facturable. Absent = carte non payable (gratuit, ou pas encore ouvert). */
  checkout?: "pro" | "growth";
  highlighted?: boolean;
};

const PRICING_TIERS: PricingTier[] = [
  {
    name: "Starter",
    price: "0 €",
    period: "pour toujours",
    tagline: "L'analyse tourne. Ses résultats restent fermés.",
    features: [
      "1 concurrent suivi",
      "Première analyse lancée automatiquement",
      "Nombre d'écarts détectés et date de l'analyse",
      "Détail des résultats verrouillé",
    ],
    cta: "Créer mon compte",
  },
  {
    name: "Pro",
    price: "29 €",
    period: "par mois",
    yearly: "290 € par an — deux mois offerts",
    tagline: "Tout ce que l'analyse a trouvé, et quoi en faire.",
    features: [
      "1 concurrent suivi, remplaçable tous les 30 jours",
      "Tous les écarts détectés, en tâches priorisées",
      "Score, comparatif des tarifs et face-à-face complet",
      "Connexion et moyens de paiement comparés",
      "Historique du score et statistiques",
      "Analyse relançable à la demande",
    ],
    cta: "Commencer avec Pro",
    checkout: "pro",
    highlighted: true,
  },
  {
    name: "Growth",
    price: "79 €",
    period: "par mois",
    yearly: "790 € par an — deux mois offerts",
    tagline: "Plusieurs fronts à surveiller en même temps.",
    features: [
      "Tout le contenu de Pro",
      "3 concurrents suivis (en construction)",
      "Comparatif par concurrent",
      "Support prioritaire",
    ],
    cta: "Être prévenu à l'ouverture",
  },
];

export default async function TarifsPage() {
  // L'état de session ne sert qu'à router le bouton : un visiteur déconnecté part
  // s'inscrire, il n'a pas encore de compte auquel rattacher un abonnement.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const paymentOpen = isStripeConfigured();

  return (
    <div className="bg-void text-paper">
      <section className="relative overflow-hidden border-b border-white/[0.06]">
        <div
          className="pointer-events-none absolute left-1/2 top-[-10rem] h-[22rem] w-[36rem] -translate-x-1/2 rounded-full bg-signal/20 blur-[110px]"
          aria-hidden="true"
        />
        <div className="relative mx-auto w-full max-w-6xl px-6 pb-16 pt-20 text-center lg:pb-20 lg:pt-24">
          <Eyebrow>Tarifs</Eyebrow>
          <h1 className="mx-auto mt-3 max-w-2xl font-brand text-3xl font-semibold tracking-tight text-paper sm:text-4xl">
            Un outil payant, sans surprise.
          </h1>
          <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-mist">
            {paymentOpen
              ? "Sans engagement, résiliable en un clic depuis ton compte. Carte, Apple Pay et Google Pay acceptés."
              : "Les prix sont fixés. La facturation, elle, n'est pas encore branchée : inscris-toi maintenant, tu utilises le comparateur et tu seras prévenu à l'ouverture des paliers."}
          </p>
        </div>
      </section>

      <section className="border-b border-white/[0.06]">
        <div className="mx-auto w-full max-w-6xl px-6 py-16 lg:py-20">
          <div className="grid gap-5 sm:grid-cols-3">
            {PRICING_TIERS.map((tier) => (
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
                  <span className="font-mono text-3xl text-paper">{tier.price}</span>
                  <span className="text-sm text-mist">{tier.period}</span>
                </p>
                {/*
                  Hauteur réservée même sans tarif annuel, pour que les listes de
                  fonctionnalités des trois cartes démarrent sur la même ligne.
                */}
                <p className="mt-1 min-h-[1.25rem] text-xs text-mist">{tier.yearly ?? ""}</p>
                <ul className="mt-6 flex flex-1 flex-col gap-2">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-mist">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-signal-bright" aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
                {tier.checkout && paymentOpen ? (
                  <div className="mt-6">
                    <CheckoutButton
                      tier={tier.checkout}
                      label={tier.cta}
                      authenticated={Boolean(user)}
                      className={`inline-flex h-10 w-full items-center justify-center rounded-full text-sm font-semibold transition-colors duration-150 disabled:opacity-60 ${
                        tier.highlighted
                          ? "bg-signal text-paper hover:bg-signal-bright hover:text-void"
                          : "border border-white/10 text-paper hover:border-signal-bright/40"
                      }`}
                    />
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
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto w-full max-w-6xl px-6 py-16 text-center lg:py-20">
          <p className="text-sm text-mist">
            Une question sur les paliers ?{" "}
            <Link href="/#faq" className="font-medium text-paper underline underline-offset-4">
              Consulte la FAQ
            </Link>
            .
          </p>
        </div>
      </section>
    </div>
  );
}
