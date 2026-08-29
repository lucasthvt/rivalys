import { Eyebrow } from "@/components/ui/Eyebrow";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isStripeConfigured } from "@/lib/billing/stripe";
import { PricingTable } from "./_components/PricingTable";

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
          <PricingTable authenticated={Boolean(user)} paymentOpen={paymentOpen} />
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
