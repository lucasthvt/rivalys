import Link from "next/link";

const SECTIONS = [
  {
    title: "1. Objet",
    body: [
      "Les présentes conditions générales d'utilisation (CGU) régissent l'accès et l'utilisation du service Rivalys, un comparateur qui analyse des données publiques (pricing, positionnement, présence d'un essai gratuit) entre le SaaS d'un utilisateur et celui de son principal concurrent.",
    ],
  },
  {
    title: "2. Description du service",
    body: [
      "À la demande de l'utilisateur, Rivalys récupère le contenu de pages publiques (page d'accueil, page de pricing) de deux URL fournies par l'utilisateur, en extrait des données structurées, et signale les écarts factuels détectés sous forme de tâches.",
      "Rivalys ne collecte et n'affiche que des données publiquement accessibles. Rivalys ne prétend jamais connaître de données privées (chiffre d'affaires, nombre de clients, etc.) d'un tiers.",
    ],
  },
  {
    title: "3. Compte utilisateur",
    body: [
      "L'accès au service nécessite la création d'un compte (email et mot de passe). L'utilisateur est responsable de la confidentialité de ses identifiants.",
    ],
  },
  {
    title: "4. Utilisation autorisée",
    body: [
      "L'utilisateur s'engage à ne renseigner que des URL qu'il est légitime à comparer, et à ne pas détourner le service pour effectuer une collecte de données automatisée à grande échelle sur des sites tiers.",
    ],
  },
  {
    title: "5. Tarifs et facturation",
    body: [
      "Rivalys est un service payant. Le détail des paliers d'abonnement est disponible sur la page d'accueil, section Tarifs. La facturation n'est pas encore active à ce stade du lancement ; les modalités précises (montants, périodicité) seront communiquées avant toute mise en place d'un paiement.",
    ],
  },
  {
    title: "6. Résiliation",
    body: [
      "L'utilisateur peut demander la suppression de son compte et de ses données à tout moment en contactant [email de contact à compléter].",
    ],
  },
  {
    title: "7. Responsabilité",
    body: [
      "Rivalys met en œuvre des moyens raisonnables pour que les données affichées soient exactes au moment de leur récupération, mais ne peut garantir l'exactitude de données tierces dont il ne maîtrise pas la mise à jour. En cas d'impossibilité de récupérer une donnée, Rivalys l'indique clairement plutôt que d'en estimer une valeur.",
    ],
  },
  {
    title: "8. Modification des CGU",
    body: [
      "Rivalys peut faire évoluer les présentes CGU. Les utilisateurs seront informés de toute modification substantielle.",
    ],
  },
  {
    title: "9. Droit applicable",
    body: ["Les présentes CGU sont soumises au droit français."],
  },
];

export default function CguPage() {
  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-20">
      <p className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-signal-bright">
        [ Légal ]
      </p>
      <h1 className="mt-3 font-brand text-3xl font-semibold tracking-tight text-paper">
        Conditions générales d&rsquo;utilisation
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
