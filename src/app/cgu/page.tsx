import { LegalPage, type LegalSection } from "@/components/legal/LegalPage";
import { LEGAL_UPDATED_AT, isVatRegistered, legalField } from "@/lib/legal/identity";

/**
 * Conditions générales d'utilisation et de vente.
 *
 * Le service est vendu à des professionnels (fondateurs de SaaS), ce qui change plusieurs
 * régimes : pas de droit de rétractation de quatorze jours, pas de reconduction tacite au
 * sens de l'article L215-1 du code de la consommation, pas de médiation de la
 * consommation. Ces points sont dits explicitement plutôt que laissés dans le flou — un
 * utilisateur doit pouvoir savoir ce à quoi il renonce en souscrivant à titre professionnel.
 */

const SECTIONS: LegalSection[] = [
  {
    title: "1. Objet",
    body: [
      "Les présentes conditions générales régissent l'accès et l'utilisation du service Rivalys, un comparateur qui analyse des données publiques — tarifs, positionnement, essai gratuit, moyens de connexion et de paiement, présence sur les réseaux et plateformes d'avis — entre le logiciel d'un utilisateur et celui de son principal concurrent.",
      "Créer un compte vaut acceptation pleine et entière de ces conditions. La date de cette acceptation est horodatée et consultable dans la page « Mon compte ».",
    ],
  },
  {
    title: "2. Description du service",
    body: [
      "À la demande de l'utilisateur, Rivalys récupère le contenu de pages publiques — accueil, tarifs, connexion — des deux URL qu'il a fournies, en extrait des données structurées, et signale les écarts factuels détectés sous forme de tâches priorisées.",
      "Rivalys ne collecte et n'affiche que des données publiquement accessibles. Il ne prétend jamais connaître de données privées d'un tiers : chiffre d'affaires, nombre de clients, taux d'attrition ou tout autre chiffre non publié.",
      "Le service ne procède à aucune collecte autonome : rien n'est récupéré en dehors des URL explicitement renseignées par un utilisateur identifié. Le nombre d'analyses est limité dans le temps, par compte.",
      "Les données affichées sont datées. Elles reflètent l'état des pages au moment de leur lecture et peuvent être périmées si le site tiers a changé depuis.",
    ],
  },
  {
    title: "3. Compte utilisateur",
    body: [
      "L'accès au service nécessite la création d'un compte, par email et mot de passe ou via un compte Google. L'utilisateur est responsable de la confidentialité de ses identifiants et de toute activité effectuée depuis son compte.",
      "Le service s'adresse à des professionnels majeurs. Un compte est personnel : le partager avec un tiers ou revendre l'accès est interdit.",
      "Tout accès suspect ou toute perte de contrôle d'un compte doit être signalé sans délai à " +
        legalField("contactEmail") +
        ".",
    ],
  },
  {
    title: "4. Utilisation autorisée",
    body: [
      "L'utilisateur s'engage à ne renseigner que des URL qu'il est légitime à comparer, et à ne pas détourner le service pour effectuer une collecte de données automatisée à grande échelle sur des sites tiers.",
      "Sont notamment interdits : tenter d'accéder aux données d'un autre utilisateur, contourner les limites d'usage ou les mécanismes de facturation, sonder ou attaquer l'infrastructure, et pointer une URL vers un service interne ou une ressource non publique.",
      "Un manquement grave ou répété peut entraîner la suspension immédiate du compte, sans remboursement de la période en cours.",
    ],
  },
  {
    title: "5. Tarifs, facturation et résiliation",
    body: [
      "Le palier Starter est gratuit. Les paliers payants sont facturés au mois ou à l'année, selon la périodicité choisie à la souscription, aux montants affichés sur la page Tarifs.",
      isVatRegistered()
        ? "Les prix affichés s'entendent hors taxes ; la TVA applicable est ajoutée au moment du paiement."
        : "Les prix affichés sont les prix payés : l'éditeur relève de la franchise en base de TVA, aucune taxe n'est ajoutée au moment du paiement (article 293 B du code général des impôts).",
      "Le paiement est traité par Stripe. Aucune donnée de carte bancaire ne transite par Rivalys ni n'y est conservée.",
      "L'abonnement est sans engagement de durée : il se renouvelle automatiquement à chaque échéance jusqu'à résiliation. La résiliation se fait à tout moment depuis la page « Mon compte », par le portail Stripe. Elle prend effet à la fin de la période déjà payée, qui reste intégralement accessible jusqu'à son terme.",
      "Le service étant fourni à des professionnels dans le cadre de leur activité, le droit de rétractation de quatorze jours prévu à l'article L221-18 du code de la consommation ne s'applique pas, pas plus que le régime de reconduction tacite de l'article L215-1 du même code.",
      "Toute évolution tarifaire est annoncée au moins trente jours avant sa prise d'effet et ne s'applique qu'à compter de l'échéance suivante. L'utilisateur qui la refuse peut résilier avant cette échéance.",
      "Les périodes entamées ne sont pas remboursées au prorata, sauf indisponibilité prolongée imputable à Rivalys.",
    ],
  },
  {
    title: "6. Disponibilité et évolutions",
    body: [
      "Rivalys est fourni sans garantie de disponibilité ininterrompue. Des interruptions peuvent survenir pour maintenance ou pour une cause extérieure — panne d'un hébergeur, d'un prestataire d'analyse, ou d'un site tiers analysé.",
      "Les fonctionnalités peuvent évoluer. Une fonctionnalité annoncée comme en construction sur la page Tarifs n'est pas due tant qu'elle n'est pas livrée, et n'est jamais facturée comme si elle l'était.",
    ],
  },
  {
    title: "7. Responsabilité",
    body: [
      "Rivalys met en œuvre des moyens raisonnables pour que les données affichées soient exactes au moment de leur récupération, mais ne garantit pas l'exactitude de données tierces dont il ne maîtrise pas la mise à jour. En cas d'impossibilité de récupérer une donnée, il l'indique clairement plutôt que d'en estimer une valeur.",
      "Les écarts signalés et les tâches proposées sont des observations factuelles, pas un conseil stratégique, commercial, juridique ou financier. Les décisions prises à partir de ces informations relèvent de la seule responsabilité de l'utilisateur.",
      "La responsabilité de Rivalys, toutes causes confondues, est limitée aux sommes effectivement versées par l'utilisateur au cours des douze mois précédant le fait générateur. Aucune indemnisation n'est due au titre d'un préjudice indirect, notamment une perte de chiffre d'affaires, de clientèle ou de données.",
    ],
  },
  {
    title: "8. Données personnelles",
    body: [
      "Le traitement des données personnelles est décrit dans la politique de confidentialité, qui fait partie intégrante des présentes conditions.",
      "L'utilisateur peut à tout moment télécharger l'intégralité de ses données et supprimer définitivement son compte depuis la page « Mon compte », sans avoir à en formuler la demande.",
    ],
  },
  {
    title: "9. Modification des conditions",
    body: [
      "Rivalys peut faire évoluer les présentes conditions. Toute modification substantielle est notifiée au moins trente jours avant sa prise d'effet. La poursuite de l'utilisation du service après cette date vaut acceptation ; à défaut, l'utilisateur peut résilier sans frais.",
    ],
  },
  {
    title: "10. Droit applicable et juridiction",
    body: [
      "Les présentes conditions sont soumises au droit français.",
      "À défaut de résolution amiable, tout litige relève de la compétence exclusive des tribunaux français du ressort du siège de l'éditeur, les parties agissant en qualité de professionnels.",
    ],
  },
];

export default function CguPage() {
  return (
    <LegalPage
      title="Conditions générales d'utilisation et de vente"
      updatedAt={LEGAL_UPDATED_AT}
      sections={SECTIONS}
    />
  );
}
