/**
 * Captcha Cloudflare Turnstile sur les formulaires d'authentification.
 *
 * POURQUOI
 * --------
 * Supabase limite l'authentification à 30 requêtes par tranche de 5 minutes et par adresse
 * IP. C'est une protection contre un script lancé depuis une machine ; ça n'arrête pas un
 * bourrage d'identifiants distribué sur quelques centaines d'adresses, qui teste alors des
 * dizaines de milliers de couples email/mot de passe par heure sans jamais toucher la
 * limite. Le captcha coupe ce vecteur à la racine.
 *
 * QUI VÉRIFIE QUOI
 * ----------------
 * Le navigateur obtient un jeton de Cloudflare et le joint à l'appel `signUp` /
 * `signInWithPassword`. C'est SUPABASE qui vérifie ce jeton auprès de Cloudflare, avec le
 * secret configuré dans son tableau de bord. Notre serveur ne voit jamais ce secret et n'a
 * aucun code de vérification à écrire — donc aucun code de vérification à écrire de travers.
 *
 * Turnstile plutôt que hCaptcha : pas de grille d'images à résoudre dans l'immense majorité
 * des cas, gratuit sans limite de volume, et pas de traceur publicitaire embarqué (ce qui
 * évite d'avoir à le déclarer comme traceur soumis à consentement).
 *
 * DEUX CLÉS, DEUX ENDROITS
 * ------------------------
 *  - clé de site (publique)  → NEXT_PUBLIC_TURNSTILE_SITE_KEY, ici, dans le navigateur.
 *  - clé secrète             → tableau de bord Supabase, Authentication → Attack Protection.
 *
 * Tant que la clé de site est absente, les formulaires fonctionnent sans captcha : c'est
 * l'état de développement, et il ne doit pas empêcher de lancer l'application en local.
 * L'activation côté Supabase et la présence de cette variable doivent être faites ENSEMBLE —
 * activer Supabase sans la variable rejetterait toutes les connexions ; poser la variable
 * sans activer Supabase afficherait un widget dont le jeton n'est vérifié par personne.
 */

export const TURNSTILE_SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** Origine à autoriser dans la politique de sécurité du contenu (script + iframe). */
export const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

export function turnstileSiteKey(): string | null {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || null;
}

export function isTurnstileEnabled(): boolean {
  return turnstileSiteKey() !== null;
}
