import { initBotId } from "botid/client/core";

/**
 * BotID : la vérification anti-robot de l'analyse gratuite.
 *
 * Invisible, contrairement à un captcha — aucun widget, aucune case à cocher, rien à
 * afficher. C'est ce qui la rend acceptable sur une page d'accueil, là où le moindre
 * obstacle avant la première valeur fait partir le visiteur.
 *
 * Ce fichier ne fait que DÉCLARER les routes à protéger : il indique au navigateur sur
 * quelles requêtes joindre les en-têtes de classification. Sans cette déclaration,
 * `checkBotId()` échoue systématiquement côté serveur — les deux doivent rester d'accord.
 *
 * L'inscription reste sur Turnstile : là, le captcha ne coûte aucune friction (la case se
 * coche pendant qu'on remplit le formulaire) et c'est Supabase qui vérifie le jeton, donc
 * la protection existe même si notre code se trompe.
 */
initBotId({
  protect: [{ path: "/api/public-teardown", method: "POST" }],
});
