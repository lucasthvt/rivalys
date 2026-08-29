import type { MetadataRoute } from "next";
import { LEGAL_IDENTITY } from "@/lib/legal/identity";

/**
 * Les seules pages publiques du produit. Les écrans applicatifs n'y figurent pas : ils
 * sont derrière une session, et référencés dans robots.ts comme interdits.
 */
const PUBLIC_PATHS = ["/", "/tarifs", "/login", "/signup", "/cgu", "/confidentialite", "/mentions-legales"];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_APP_URL?.trim() || `https://${LEGAL_IDENTITY.domain}`).replace(
    /\/$/,
    "",
  );

  return PUBLIC_PATHS.map((path) => ({
    url: `${base}${path}`,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.6,
  }));
}
