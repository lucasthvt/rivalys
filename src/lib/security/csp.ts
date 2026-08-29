// Politique de sécurité du contenu (CSP), construite à part du proxy.
//
// Pourquoi un module isolé plutôt qu'une fonction dans src/proxy.ts : c'est la règle de
// sécurité la plus facile à casser sans s'en apercevoir. Une origine ajoutée « pour
// débloquer un truc », un `'unsafe-inline'` glissé dans script-src, et la protection contre
// l'injection de script tombe — sans qu'aucun écran ne change d'apparence. Ici la fonction
// est pure, donc chaque directive est vérifiée par un test qui échoue si quelqu'un l'élargit.
//
// Même raisonnement que src/lib/compare/rate-limit.ts : la décision est pure, le proxy ne
// fait que l'appliquer.

import { TURNSTILE_ORIGIN, isTurnstileEnabled } from "../auth/turnstile";

export type CspOptions = {
  /** Nonce à usage unique, différent à chaque requête. */
  nonce: string;
  /**
   * Assouplissements réservés au développement : Next compile avec `eval` pour le
   * rechargement à chaud, et le serveur de développement parle en WebSocket sur localhost.
   * Jamais `true` en production.
   */
  dev: boolean;
};

/**
 * `'strict-dynamic'` plutôt qu'une liste blanche de domaines : les scripts que Next injecte
 * portent le nonce, et eux seuls peuvent en charger d'autres. Un script injecté par une
 * faille XSS n'a pas le nonce, donc ne s'exécute pas — y compris s'il vient de notre propre
 * origine. C'est la différence entre une CSP qui gêne un attaquant et une CSP qui l'arrête.
 *
 * `'unsafe-inline'` reste sur `style-src` : next/font et Recharts posent des styles en
 * ligne, et il n'existe pas de chemin propre pour les nonce-r. L'injection de style est un
 * risque bien plus faible que l'injection de script (pas d'exécution de code), et le fermer
 * casserait le rendu.
 */
export function buildCsp({ nonce, dev }: CspOptions): string {
  // Le client Supabase parle à ce domaine en REST et en WebSocket (Realtime). Sans lui dans
  // connect-src, plus aucune requête de données ne part du navigateur.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const supabaseWs = supabaseUrl.replace(/^https:/, "wss:").replace(/^http:/, "ws:");

  // Turnstile charge un script et ouvre une iframe sur son propre domaine. Les deux ne sont
  // ouverts que si le captcha est réellement configuré : une origine autorisée « au cas où »
  // est une origine autorisée pour rien.
  const captcha = isTurnstileEnabled();

  const connectSrc = ["'self'", supabaseUrl, supabaseWs, captcha ? TURNSTILE_ORIGIN : ""]
    .filter(Boolean)
    .join(" ");

  // `strict-dynamic` fait ignorer les sources par domaine aux navigateurs qui le
  // comprennent — le nonce et la chaîne de confiance suffisent. L'origine reste listée pour
  // les navigateurs plus anciens, qui retombent sur la liste blanche classique.
  const scriptHosts = captcha ? ` ${TURNSTILE_ORIGIN}` : "";

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${scriptHosts}${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${connectSrc}${dev ? " ws: http://localhost:*" : ""}`,
    // Le paiement se fait par redirection pleine page vers checkout.stripe.com : aucune
    // iframe n'est ouverte de ce côté. La seule iframe du produit est le widget Turnstile.
    captcha ? `frame-src ${TURNSTILE_ORIGIN}` : "frame-src 'none'",
    // Personne n'a le droit de nous encadrer : protection anti-clickjacking, et elle vaut
    // mieux que X-Frame-Options (qu'on envoie quand même pour les vieux clients).
    "frame-ancestors 'none'",
    // Un formulaire ne peut poster que chez nous — coupe l'exfiltration par formulaire
    // injecté.
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}
