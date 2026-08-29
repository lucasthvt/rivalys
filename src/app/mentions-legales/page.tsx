import { LegalPage, type LegalSection } from "@/components/legal/LegalPage";
import { LEGAL_IDENTITY, isVatRegistered, legalField, registrationLine } from "@/lib/legal/identity";

/**
 * Mentions légales — obligation de l'article 6-III de la LCEN.
 *
 * Les valeurs viennent toutes de src/lib/legal/identity.ts. Tant qu'elles sont vides, le
 * gabarit affiche un bandeau d'avertissement : mieux vaut un site qui crie qu'il est
 * incomplet qu'un site qui affiche une identité plausible et fausse.
 */

const SECTIONS: LegalSection[] = [
  {
    title: "Éditeur du site",
    body: [
      `Le site Rivalys (${LEGAL_IDENTITY.domain}) est édité par ${legalField("companyName")}, ${legalField("legalForm")} — ${registrationLine()} —, dont le siège est situé ${legalField("address")}.`,
      ...(LEGAL_IDENTITY.shareCapital && LEGAL_IDENTITY.rcsCity
        ? [`Capital social : ${LEGAL_IDENTITY.shareCapital}. Immatriculée au RCS de ${LEGAL_IDENTITY.rcsCity}.`]
        : []),
      isVatRegistered()
        ? `Numéro de TVA intracommunautaire : ${LEGAL_IDENTITY.vatNumber}.`
        : "TVA non applicable, article 293 B du code général des impôts (franchise en base de TVA).",
      `Directeur de la publication : ${legalField("publicationDirector")}.`,
      `Contact : ${legalField("contactEmail")}.`,
    ],
  },
  {
    title: "Hébergement",
    body: [
      "L'application est hébergée par Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis — vercel.com.",
      "La base de données et l'authentification sont hébergées par Supabase, dans l'Union européenne (région AWS eu-central-1, Francfort, Allemagne) — supabase.com.",
      "Les paiements sont traités par Stripe Payments Europe Ltd., The One Building, 1 Grand Canal Street Lower, Dublin 2, Irlande — stripe.com.",
    ],
  },
  {
    title: "Propriété intellectuelle",
    body: [
      "L'ensemble des éléments du site Rivalys — textes, structure, identité visuelle, code — est protégé au titre du droit d'auteur. Toute reproduction, représentation ou adaptation non autorisée est interdite.",
      "Les marques, logos et contenus de sites tiers affichés dans un comparatif restent la propriété de leurs titulaires respectifs. Ils sont cités à titre d'information factuelle, dans le cadre du droit de citation et de la comparaison licite prévue à l'article L121-8 du code de la consommation.",
    ],
  },
  {
    title: "Données affichées sur le site",
    body: [
      "Les données comparatives affichées à un utilisateur — tarifs, positionnement, présence d'un essai gratuit, moyens de connexion et de paiement — sont extraites de pages publiques d'un site tiers, à la demande explicite de cet utilisateur et pour son seul usage.",
      "Rivalys ne garantit pas l'exactitude de ces données, qui peuvent évoluer indépendamment de sa volonté. Lorsqu'une donnée n'a pas pu être récupérée, elle est signalée comme telle et jamais estimée.",
      "Rivalys ne constitue pas un annuaire de concurrents et ne collecte aucune donnée en dehors des URL fournies par un utilisateur identifié.",
    ],
  },
  {
    title: "Signalement",
    body: [
      `L'éditeur d'un site tiers qui souhaite signaler une donnée inexacte affichée par le comparateur, ou s'opposer à sa lecture automatisée, peut écrire à ${legalField("contactEmail")}.`,
    ],
  },
  {
    title: "Médiation de la consommation",
    body: [
      "Rivalys s'adresse à des professionnels. Le dispositif de médiation de la consommation prévu aux articles L611-1 et suivants du code de la consommation ne s'applique donc pas aux relations avec ses utilisateurs professionnels.",
    ],
  },
];

export default function MentionsLegalesPage() {
  return <LegalPage title="Mentions légales" updatedAt="29 août 2026" sections={SECTIONS} />;
}
