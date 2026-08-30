import { LegalPage, type LegalSection } from "@/components/legal/LegalPage";
import {
  LEGAL_IDENTITY,
  LEGAL_UPDATED_AT,
  legalField,
  privacyContact,
} from "@/lib/legal/identity";

/**
 * Politique de confidentialité.
 *
 * Elle décrit ce que le code fait RÉELLEMENT, et rien d'autre. Chaque sous-traitant listé
 * ici correspond à un appel réseau présent dans src/lib ; chaque durée annoncée doit
 * pouvoir être tenue. Une politique qui promet plus que le produit n'applique est un
 * mensonge de plus, pas une protection de plus.
 *
 * Sous-traitants effectivement appelés, à tenir à jour avec le code :
 *  - Supabase       src/lib/supabase/*          base de données + authentification
 *  - Vercel         hébergement + mesure d'audience (@vercel/analytics, sans cookie)
 *  - Anthropic      src/lib/compare/extract.ts  extraction structurée des pages publiques
 *  - Firecrawl      src/lib/compare/firecrawl.ts récupération des pages publiques
 *  - Perplexity     src/lib/compare/perplexity.ts présence sur les plateformes d'avis
 *  - Stripe         src/lib/billing/stripe.ts   paiement et abonnement
 *  - Google         OAuth, uniquement si l'utilisateur choisit « Continuer avec Google »
 */

const SECTIONS: LegalSection[] = [
  {
    title: "1. Responsable de traitement",
    body: [
      `Le responsable du traitement des données personnelles collectées via ${LEGAL_IDENTITY.tradeName ?? "Rivalys"} est ${legalField("companyName")}, ${legalField("legalForm")}, dont le siège est situé ${legalField("address")}.`,
      `Toute question relative à tes données, et l'exercice de tes droits, se font à l'adresse ${privacyContact()}.`,
      LEGAL_IDENTITY.dpoEmail
        ? "Un délégué à la protection des données a été désigné ; c'est lui qui répond à cette adresse."
        : "Aucun délégué à la protection des données n'a été désigné : le traitement ne relève d'aucun des cas de désignation obligatoire prévus à l'article 37 du RGPD (pas de suivi systématique à grande échelle, pas de données sensibles, pas d'autorité publique).",
    ],
  },
  {
    title: "2. Données collectées, et d'où elles viennent",
    body: [
      "Compte, fournies par toi : adresse email et mot de passe. Le mot de passe n'est jamais stocké en clair ni lisible par nous — il est haché par Supabase Auth. Si tu passes par « Continuer avec Google », nous recevons de Google ton adresse email et l'identifiant du compte, jamais ton mot de passe Google.",
      "Profil produit, fournies par toi à l'onboarding : prénom, type de SaaS (B2B/B2C), secteur, description du produit, stade du produit, modèle de prix, objectif principal, clientèle cible, URL de ton SaaS, URL du concurrent que tu veux suivre.",
      "Données de comparaison, collectées par le service à ta demande : contenu texte des pages PUBLIQUES (accueil, tarifs, connexion) des deux URL que tu as renseignées, et les données structurées qui en sont extraites — paliers de tarifs, présence d'un essai gratuit, positionnement affiché, moyens de connexion et de paiement affichés, présence publique sur les réseaux et les plateformes d'avis.",
      "Usage du service : écarts détectés et leur statut (ouvert, fait, ignoré), historique du score, dates des analyses lancées, date d'acceptation des CGU.",
      "Facturation, si tu souscris un palier payant : identifiants de client et d'abonnement Stripe, statut de l'abonnement et date de fin de période. Aucune donnée de carte bancaire ne transite par Rivalys ni n'y est stockée — le paiement se fait entièrement sur les pages de Stripe.",
      "Aucune donnée privée d'un tiers n'est collectée, déduite ou inventée. Rivalys ne prétend jamais connaître le chiffre d'affaires, le nombre de clients ou tout autre chiffre non public d'un concurrent.",
    ],
  },
  {
    title: "3. Finalités et bases légales",
    body: [
      "Fournir le service demandé — créer le compte, lancer les analyses, afficher le comparatif et les tâches : exécution du contrat (article 6.1.b du RGPD).",
      "Facturer un abonnement et émettre les factures correspondantes : exécution du contrat, et obligation légale pour la conservation comptable (article 6.1.c).",
      "Sécuriser le service — limitation du nombre d'analyses, journalisation technique des erreurs, prévention des abus : intérêt légitime (article 6.1.f), celui de faire tourner un service qui ne s'effondre pas au premier abus.",
      "Aucune donnée n'est utilisée à des fins publicitaires, revendue, ni transmise à des courtiers en données. Aucune décision produisant un effet juridique n'est prise de manière automatisée : le comparateur signale des écarts, il ne décide rien à ta place.",
    ],
  },
  {
    title: "4. Sous-traitants et destinataires",
    body: [
      "Supabase — base de données et authentification. Données du compte et du produit. Hébergement dans l'Union européenne (région AWS eu-central-1, Francfort).",
      "Vercel — hébergement de l'application, journaux techniques associés, et mesure d'audience (Vercel Web Analytics). Société américaine.",
      "Anthropic — le contenu texte des pages publiques récupérées est envoyé à l'API Claude pour en extraire des données structurées. Aucune donnée de compte (email, mot de passe) ne lui est transmise. Société américaine.",
      "Firecrawl — récupération du contenu des pages publiques dont tu as fourni l'URL. Reçoit ces URL. Société américaine.",
      "Perplexity — vérification de la présence publique des deux produits sur les plateformes d'avis et les réseaux. Reçoit le nom et l'URL des sites comparés. Société américaine.",
      "Stripe — paiement, abonnement et facturation. Reçoit ton adresse email et tes données de paiement, qu'il traite en tant que responsable de traitement pour ce qui relève de la conformité financière. Établi en Irlande, avec des traitements aux États-Unis.",
      "Google — uniquement si tu choisis « Continuer avec Google » pour te connecter. Société américaine.",
      "Certains de ces prestataires traitent des données en dehors de l'Union européenne. Ces transferts sont encadrés par les clauses contractuelles types de la Commission européenne (article 46.2.c du RGPD) et, pour les prestataires américains adhérents, par le Data Privacy Framework UE–États-Unis.",
    ],
  },
  {
    title: "5. Durées de conservation",
    body: [
      "Compte et données de profil : conservés tant que le compte existe. La suppression du compte efface immédiatement et définitivement le profil, les concurrents suivis, les relevés, les écarts détectés et l'historique du score.",
      "Compte inactif : sans aucune connexion pendant trois ans, le compte et ses données sont supprimés, après un email de relance resté sans réponse pendant un mois.",
      "Relevés de pages publiques : remplacés à chaque nouvelle analyse, et supprimés dès que tu changes de concurrent suivi ou que tu supprimes ton compte.",
      "Données de facturation : dix ans à compter de la clôture de l'exercice, comme l'impose l'article L123-22 du code de commerce. Elles sont conservées par Stripe, pas par Rivalys.",
      "Journaux techniques : conservés par nos hébergeurs (Vercel, Supabase) selon leur propre politique. Rivalys n'en tient pas de copie séparée.",
    ],
  },
  {
    title: "6. Tes droits, et comment les exercer",
    body: [
      "Tu disposes d'un droit d'accès, de rectification, d'effacement, de limitation, d'opposition et de portabilité sur tes données (articles 15 à 22 du RGPD).",
      "Accès et portabilité s'exercent directement dans le produit : la page « Mon compte » télécharge en un clic la totalité de tes données dans un fichier JSON lisible par une machine, sans avoir à écrire à qui que ce soit ni à attendre.",
      "L'effacement aussi : le bouton « Supprimer mon compte » de cette même page efface immédiatement le compte et tout ce qui y est rattaché, et résilie l'abonnement en cours au passage.",
      "Rectification, limitation, opposition, ou toute question : écris à " +
        privacyContact() +
        ". Une réponse te sera apportée dans le délai d'un mois prévu par l'article 12.3 du RGPD.",
      "Si la réponse ne te convient pas, tu peux introduire une réclamation auprès de la CNIL — 3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07, ou www.cnil.fr.",
    ],
  },
  {
    title: "7. Cookies et traceurs",
    body: [
      "Rivalys ne dépose que les cookies strictement nécessaires au fonctionnement du service : ceux de session posés par Supabase Auth, qui te maintiennent connecté. Ils sont exemptés de consentement au sens de l'article 82 de la loi Informatique et Libertés.",
      "Une mesure d'audience est en place, Vercel Web Analytics. Elle ne dépose aucun cookie, ne crée aucun identifiant persistant et ne permet pas de te suivre d'un site à l'autre : elle produit uniquement des statistiques agrégées de pages vues, de provenance et de type d'appareil. Elle ne sert qu'à savoir quelles pages sont consultées, jamais à profiler qui que ce soit, et ses données ne sont ni recoupées avec ton compte, ni transmises à des tiers à d'autres fins.",
      "C'est parce qu'elle reste dans ce périmètre strict — celui que la CNIL reconnaît à la mesure d'audience — qu'aucune bannière de consentement ne t'est imposée. Aucun cookie publicitaire, aucun pixel de réseau social, aucun outil d'analyse comportementale n'est utilisé. L'ajout d'un outil sortant de ce périmètre s'accompagnerait d'un recueil de consentement préalable.",
    ],
  },
  {
    title: "8. Sécurité",
    body: [
      "Le cloisonnement des données repose sur la Row Level Security de PostgreSQL : chaque requête, y compris une requête directe à l'API, est filtrée par la base sur l'identifiant de l'utilisateur authentifié. Les colonnes qui décrivent l'abonnement payé ne sont accessibles en écriture qu'au serveur, jamais au navigateur.",
      "Les échanges se font exclusivement en HTTPS, avec HSTS. Les pages sont servies avec une politique de sécurité du contenu à nonce, qui empêche l'exécution de tout script non émis par l'application.",
      "Les mots de passe sont hachés par Supabase Auth et exigent douze caractères mêlant majuscules, minuscules, chiffres et caractères spéciaux, conformément à la recommandation de la CNIL du 21 juillet 2022.",
      "Les clés d'API des prestataires ne quittent jamais le serveur. Aucun appel à une API tierce n'est fait depuis le navigateur.",
    ],
  },
  {
    title: "9. Mineurs",
    body: [
      "Rivalys s'adresse à des fondateurs de logiciels et n'est pas destiné aux mineurs. Aucune collecte n'est sciemment effectuée auprès d'une personne de moins de quinze ans.",
    ],
  },
  {
    title: "10. Évolution de cette politique",
    body: [
      "Cette politique peut évoluer, notamment si un nouveau sous-traitant est ajouté. Toute modification substantielle est portée à la connaissance des utilisateurs, et la date de mise à jour en tête de page est révisée.",
    ],
  },
];

export default function ConfidentialitePage() {
  return (
    <LegalPage
      title="Politique de confidentialité"
      updatedAt={LEGAL_UPDATED_AT}
      intro="Ce document décrit exactement ce que Rivalys collecte, pourquoi, à qui c'est transmis, combien de temps c'est gardé, et ce que tu peux exiger. Il ne décrit rien que le produit ne fasse réellement."
      sections={SECTIONS}
    />
  );
}
