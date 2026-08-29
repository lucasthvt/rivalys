import type { NextConfig } from "next";

/**
 * En-têtes de sécurité posés sur toutes les réponses.
 *
 * La politique de sécurité du contenu (CSP) n'est PAS ici : elle porte un nonce différent
 * à chaque requête, donc elle est construite dans src/proxy.ts. Ce fichier ne contient que
 * ce qui est constant.
 */
const SECURITY_HEADERS = [
  {
    // HSTS : le navigateur refuse le HTTP en clair sur ce domaine pendant deux ans, y
    // compris pour la toute première frappe dans la barre d'adresse une fois préchargé.
    // Ferme l'interception du premier aller-retour (SSL stripping).
    //
    // `preload` engage à ne plus jamais servir ce domaine en HTTP : c'est vrai sur Vercel,
    // où le HTTPS est de toute façon forcé. La soumission à hstspreload.org reste une
    // démarche manuelle et volontaire.
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    // Empêche le navigateur de deviner un type MIME : un fichier servi en text/plain ne
    // sera jamais exécuté comme du JavaScript parce que son contenu y ressemble.
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    // Doublon volontaire de `frame-ancestors 'none'` dans la CSP, pour les navigateurs qui
    // ne lisent pas encore cette directive.
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    // Une URL de l'application peut porter un identifiant dans son chemin. On n'envoie
    // donc l'URL complète qu'à nous-mêmes, et seulement l'origine aux tiers.
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    // Aucune de ces API n'est utilisée par le produit. Les fermer explicitement empêche un
    // script tiers compromis de les réclamer à la place de l'utilisateur.
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  {
    // Isole notre contexte de navigation des fenêtres ouvertes par un tiers (protection
    // contre les attaques par canal auxiliaire de type Spectre, et contre window.opener).
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin",
  },
  {
    // Nos ressources ne peuvent pas être chargées depuis un autre site.
    key: "Cross-Origin-Resource-Policy",
    value: "same-origin",
  },
];

const nextConfig: NextConfig = {
  // La version de Next et de son moteur n'ont rien à faire dans une réponse HTTP : c'est
  // le premier renseignement que cherche un scanner pour choisir un exploit connu.
  poweredByHeader: false,

  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
