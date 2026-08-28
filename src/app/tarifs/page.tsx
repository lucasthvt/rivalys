import { Eyebrow } from "@/components/ui/Eyebrow";
import Link from "next/link";

const PRICING_TIERS: { name: string; tagline: string; features: string[]; highlighted?: boolean }[] = [
  {
    name: "Starter",
    tagline: "Pour tester le comparateur sur ton premier concurrent.",
    features: ["1 concurrent suivi", "Actualisation manuelle", "Tableau de bord + tâches"],
  },
  {
    name: "Pro",
    tagline: "Pour les fondateurs qui veulent un suivi plus soutenu.",
    features: ["1 concurrent suivi", "Actualisation manuelle", "Historique de score détaillé"],
    highlighted: true,
  },
  {
    name: "Growth",
    tagline: "Pour aller plus loin — plusieurs concurrents, bientôt.",
    features: ["Plusieurs concurrents (à venir)", "Actualisation manuelle", "Support prioritaire"],
  },
];

export default function TarifsPage() {
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
            La facturation arrive bientôt. Inscris-toi pour accéder au comparateur dès maintenant et
            être prévenu à l&rsquo;ouverture des paliers.
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
                <p className="mt-6 font-mono text-2xl text-paper">Bientôt</p>
                <ul className="mt-6 flex flex-1 flex-col gap-2">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-mist">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-signal-bright" aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className={`mt-6 inline-flex h-10 items-center justify-center rounded-full text-sm font-semibold transition-colors duration-150 ${
                    tier.highlighted
                      ? "bg-signal text-paper hover:bg-signal-bright hover:text-void"
                      : "border border-white/10 text-paper hover:border-signal-bright/40"
                  }`}
                >
                  Commencer
                </Link>
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
