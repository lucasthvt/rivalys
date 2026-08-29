import type { MetadataRoute } from "next";
import { LEGAL_IDENTITY } from "@/lib/legal/identity";

/**
 * Ce que les moteurs ont le droit d'indexer.
 *
 * Les écrans applicatifs sont fermés : ils ne contiennent que des données appartenant à
 * une personne, et une URL indexée est une URL qu'on retrouve dans un cache public. Le
 * `noindex` posé par le proxy (voir src/proxy.ts) reste la protection réelle — celle-ci
 * évite simplement que les robots viennent taper dessus.
 *
 * Les routes d'API et d'authentification sont exclues pour la même raison : rien à
 * indexer, et pas de raison de publier leur cartographie.
 */
export default function robots(): MetadataRoute.Robots {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || `https://${LEGAL_IDENTITY.domain}`;

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/auth/",
          "/dashboard",
          "/tasks",
          "/score",
          "/statistiques",
          "/concurrent",
          "/compte",
          "/onboarding",
        ],
      },
    ],
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
