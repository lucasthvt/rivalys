import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TeardownClient } from "./TeardownClient";

/**
 * /teardown — l'écran de tournage. Deux URL quelconques, le vrai pipeline, aucune écriture.
 *
 * Même garde que POST /api/teardown, dupliquée volontairement : la page ne fait qu'éviter
 * d'afficher un formulaire à quelqu'un qui n'en obtiendrait rien, c'est l'endpoint qui
 * protège la dépense. Les deux lisent TEARDOWN_ADMIN_EMAIL, absent = fermé des deux côtés.
 *
 * En production, un refus est un 404 sec : dire « mauvais compte » confirmerait que la page
 * existe. En développement il affiche la raison — trois causes se ressemblent de l'extérieur
 * (variable absente, session absente, email différent) et les distinguer à l'aveugle coûte
 * un redémarrage de serveur par hypothèse.
 */

export const metadata: Metadata = {
  title: "Teardown",
  robots: { index: false, follow: false },
};

export default async function TeardownPage() {
  const isDev = process.env.NODE_ENV !== "production";
  const allowed = process.env.TEARDOWN_ADMIN_EMAIL?.trim().toLowerCase() || null;

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const sessionEmail = data?.user?.email?.trim().toLowerCase() ?? null;

  if (allowed && sessionEmail && sessionEmail === allowed) {
    return <TeardownClient />;
  }

  if (!isDev) notFound();

  return <Blocked allowed={allowed} sessionEmail={sessionEmail} />;
}

function Blocked({
  allowed,
  sessionEmail,
}: {
  allowed: string | null;
  sessionEmail: string | null;
}) {
  const reason = !allowed
    ? {
        title: "TEARDOWN_ADMIN_EMAIL n'est pas définie",
        detail:
          "Le serveur ne voit aucune valeur pour cette variable. Ajoute-la à .env.local, puis redémarre le serveur de développement — Next ne recharge pas toujours les .env à chaud.",
        fix: "TEARDOWN_ADMIN_EMAIL=ton@email.com",
      }
    : !sessionEmail
      ? {
          title: "Aucune session dans ce navigateur",
          detail:
            "La variable est bien lue, mais personne n'est connecté ici. Connecte-toi sur Rivalys dans cet onglet, puis reviens.",
          fix: "/login",
        }
      : {
          title: "Ce compte n'est pas celui autorisé",
          detail:
            "La variable est lue et tu es connecté, mais les deux adresses ne correspondent pas. Recopie dans .env.local l'adresse de session ci-dessous, puis redémarre le serveur.",
          fix: `TEARDOWN_ADMIN_EMAIL=${sessionEmail}`,
        };

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-24">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-foreground-muted">
        Teardown · accès refusé
      </p>
      <h1 className="mt-3 font-display text-3xl font-bold tracking-tightish">{reason.title}</h1>
      <p className="mt-4 text-foreground-muted">{reason.detail}</p>

      <pre className="mt-6 overflow-x-auto rounded-xl border border-surface-border bg-surface p-4 font-mono text-sm">
        {reason.fix}
      </pre>

      <dl className="mt-8 grid gap-2 font-mono text-xs text-foreground-muted">
        <div className="flex gap-3">
          <dt className="w-44 shrink-0">TEARDOWN_ADMIN_EMAIL</dt>
          <dd>{allowed ?? "(non définie)"}</dd>
        </div>
        <div className="flex gap-3">
          <dt className="w-44 shrink-0">session</dt>
          <dd>{sessionEmail ?? "(non connecté)"}</dd>
        </div>
      </dl>

      <p className="mt-8 text-xs text-foreground-muted">
        Ce détail n&apos;existe qu&apos;en développement. En production, la page renvoie un 404.
      </p>
    </div>
  );
}
