import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { isOperatorSession, operatorEmail, sessionEmail } from "@/lib/admin/operator";
import { AvisClient, type AdminTestimonial } from "./AvisClient";

/**
 * /admin/avis — la file d'attente des avis.
 *
 * Existe pour une raison précise : sans elle, publier un retour veut dire ouvrir une
 * session psql sur la base de production avec la clé de service, c'est-à-dire des droits
 * qui contournent toute la RLS, pour une opération de routine. Un `where` mal tapé y est
 * irréversible. Cet écran ramène le geste à un bouton sur une ligne nommée.
 *
 * Deuxième raison, moins évidente : une citation peut passer la contrainte CHECK et casser
 * quand même la carte. L'écran affiche le composant réel de la bande (TestimonialCard),
 * pas une approximation — c'est le seul moyen de voir ce qu'on publie avant de le publier.
 *
 * Lecture par le client de service : la RLS ne montre à l'opérateur que ses propres lignes,
 * or il doit voir celles de tout le monde. La garde ci-dessous est donc ce qui tient
 * l'écran fermé — d'où sa duplication dans /api/admin/testimonials, qui protège l'écriture.
 */

export const metadata: Metadata = {
  title: "Avis · administration",
  robots: { index: false, follow: false },
};

export default async function AdminAvisPage() {
  const isDev = process.env.NODE_ENV !== "production";

  if (!(await isOperatorSession())) {
    // En production, un refus est un 404 sec : dire « mauvais compte » confirmerait que la
    // page existe. En développement, on donne la raison — trois causes se ressemblent de
    // l'extérieur et les distinguer à l'aveugle coûte un redémarrage par hypothèse.
    if (!isDev) notFound();
    return <Blocked allowed={operatorEmail()} current={await sessionEmail()} />;
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("testimonials")
    .select("id, quote, author_label, role_label, consent_public, published, created_at")
    .order("created_at", { ascending: false });

  const rows: AdminTestimonial[] = (data ?? []).map((row) => ({
    id: row.id,
    quote: row.quote,
    author: row.author_label,
    role: row.role_label,
    consentPublic: row.consent_public,
    published: row.published,
    createdAt: row.created_at,
  }));

  return <AvisClient rows={rows} loadError={error?.message ?? null} />;
}

function Blocked({ allowed, current }: { allowed: string | null; current: string | null }) {
  const reason = !allowed
    ? {
        title: "TEARDOWN_ADMIN_EMAIL n'est pas définie",
        detail:
          "Le serveur ne voit aucune valeur pour cette variable. Ajoute-la à .env.local, puis redémarre le serveur — Next ne recharge pas toujours les .env à chaud.",
        fix: "TEARDOWN_ADMIN_EMAIL=ton@email.com",
      }
    : !current
      ? {
          title: "Aucune session dans ce navigateur",
          detail:
            "La variable est bien lue, mais personne n'est connecté ici. Connecte-toi sur Rivalys dans cet onglet, puis reviens.",
          fix: "/login",
        }
      : {
          title: "Ce compte n'est pas celui autorisé",
          detail:
            "La variable est lue et tu es connecté, mais les deux adresses ne correspondent pas.",
          fix: `TEARDOWN_ADMIN_EMAIL=${current}`,
        };

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-24">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-foreground-muted">
        Avis · accès refusé
      </p>
      <h1 className="font-display mt-3 text-3xl font-bold">{reason.title}</h1>
      <p className="mt-4 text-foreground-muted">{reason.detail}</p>
      <pre className="mt-6 overflow-x-auto rounded-xl border border-surface-border bg-surface p-4 font-mono text-sm">
        {reason.fix}
      </pre>
    </div>
  );
}
