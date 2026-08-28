import { Eyebrow } from "@/components/ui/Eyebrow";
import Link from "next/link";

const SECTIONS = [
  {
    title: "Éditeur du site",
    body: [
      "Le site Rivalys (rivalys.com) est édité par [Nom / raison sociale à compléter], [statut juridique — ex. entreprise individuelle, SASU], immatriculée sous le numéro SIRET [à compléter], dont le siège est situé [adresse à compléter].",
      "Responsable de la publication : [Nom du responsable].",
      "Contact : [email de contact à compléter].",
    ],
  },
  {
    title: "Hébergement",
    body: [
      "Le site est hébergé par Vercel Inc. (https://vercel.com).",
      "La base de données, l'authentification et le stockage sont hébergés par Supabase (https://supabase.com), dans la région [région du projet Supabase à compléter].",
    ],
  },
  {
    title: "Propriété intellectuelle",
    body: [
      "L'ensemble des éléments du site Rivalys (textes, structure, identité visuelle) est protégé au titre du droit d'auteur. Toute reproduction non autorisée est interdite.",
    ],
  },
  {
    title: "Données affichées sur le site",
    body: [
      "Les données comparatives affichées à un utilisateur (pricing, positionnement, présence d'un essai gratuit) sont extraites de pages publiques d'un site tiers, à la demande explicite de l'utilisateur. Rivalys ne garantit pas l'exactitude de ces données, qui peuvent évoluer indépendamment de la volonté de Rivalys.",
    ],
  },
];

export default function MentionsLegalesPage() {
  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-20">
      <Eyebrow>Légal</Eyebrow>
      <h1 className="mt-3 font-brand text-3xl font-semibold tracking-tight text-paper">
        Mentions légales
      </h1>
      <p className="mt-4 text-sm text-mist">
        Version provisoire — les champs entre crochets seront complétés avant le lancement public.
      </p>

      <div className="mt-10 flex flex-col gap-8">
        {SECTIONS.map((section) => (
          <div key={section.title}>
            <h2 className="font-brand text-lg font-semibold text-paper">{section.title}</h2>
            <div className="mt-2 flex flex-col gap-2">
              {section.body.map((p, i) => (
                <p key={i} className="text-sm leading-relaxed text-mist">
                  {p}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Link href="/" className="mt-10 inline-block text-sm font-medium text-mist transition-colors hover:text-paper">
        ← Retour à l&rsquo;accueil
      </Link>
    </div>
  );
}
