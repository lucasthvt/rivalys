import { Eyebrow } from "@/components/ui/Eyebrow";
import Link from "next/link";

const SECTIONS = [
  {
    title: "1. Responsable de traitement",
    body: [
      "Le responsable du traitement des données personnelles collectées via Rivalys est [Nom / raison sociale à compléter], contactable à [email de contact à compléter].",
    ],
  },
  {
    title: "2. Données collectées",
    body: [
      "Compte : email, mot de passe (haché, jamais stocké en clair — géré par Supabase Auth), prénom.",
      "Profil produit : type de SaaS (B2B/B2C), secteur, description du produit, URL de ton SaaS, URL de ton concurrent.",
      "Données de comparaison : extraits texte des pages publiques (accueil, pricing) de ton site et de celui de ton concurrent, ainsi que les données structurées qui en sont extraites (paliers de pricing, présence d'un essai gratuit, positionnement).",
    ],
  },
  {
    title: "3. Finalité et base légale",
    body: [
      "Ces données sont collectées pour exécuter le service demandé par l'utilisateur (exécution du contrat) : générer le comparatif et les tâches associées.",
    ],
  },
  {
    title: "4. Sous-traitants",
    body: [
      "Supabase — hébergement de la base de données et authentification.",
      "Anthropic — le contenu texte des pages publiques récupérées est envoyé à l'API Claude d'Anthropic pour en extraire des données structurées (pricing, positionnement). Aucune donnée de compte (email, mot de passe) n'est transmise à Anthropic.",
      "Vercel — hébergement de l'application.",
    ],
  },
  {
    title: "5. Conservation",
    body: [
      "Les données sont conservées tant que le compte est actif. En cas de suppression du compte, les données associées sont supprimées.",
    ],
  },
  {
    title: "6. Tes droits",
    body: [
      "Conformément au RGPD, tu disposes d'un droit d'accès, de rectification, de suppression, de portabilité et d'opposition sur tes données. Pour exercer ces droits, contacte [email de contact à compléter].",
    ],
  },
  {
    title: "7. Cookies",
    body: [
      "Rivalys utilise uniquement un cookie de session nécessaire au fonctionnement de l'authentification (géré par Supabase Auth). Aucun cookie publicitaire ou de tracking tiers n'est utilisé.",
    ],
  },
  {
    title: "8. Sécurité",
    body: [
      "L'accès aux données est protégé par Row Level Security (RLS) au niveau de la base de données : chaque utilisateur ne peut accéder qu'à ses propres données, y compris via un accès direct à l'API.",
    ],
  },
];

export default function ConfidentialitePage() {
  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-20">
      <Eyebrow>Légal</Eyebrow>
      <h1 className="mt-3 font-brand text-3xl font-semibold tracking-tight text-paper">
        Politique de confidentialité
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
