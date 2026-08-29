// Contrôle de configuration avant mise en production.
//
//   npm run preflight              → vérifie .env.local (poste de développement)
//   npm run preflight -- --prod    → exige en plus les valeurs de production
//
// POURQUOI CE FICHIER EXISTE
// --------------------------
// Les pannes de lancement de ce produit ne viennent pas du code : elles viennent d'une
// variable oubliée dans un tableau de bord. Un identifiant de prix Stripe resté en mode
// test, un webhook jamais pointé sur la production, une URL publique laissée sur
// localhost — chacune se voit uniquement quand un vrai client a déjà payé.
//
// Ce script fait passer ces vérifications du statut « liste dans un README qu'on relit
// mal » à celui de commande qui répond oui ou non.
//
// RÈGLE ABSOLUE : aucune valeur secrète n'est affichée. Le script ne dit jamais que
// contient une clé, seulement si elle est là, et à quel mode Stripe elle appartient —
// information qui se lit dans le préfixe public de la clé, pas dans son secret.

import Stripe from "stripe";
import { LEGAL_IDENTITY, missingLegalFields } from "../src/lib/legal/identity.ts";

const PROD = process.argv.includes("--prod");

let failures = 0;
let warnings = 0;

const ok = (msg) => console.log(`  \x1b[32m✓\x1b[0m ${msg}`);
const warn = (msg) => {
  warnings++;
  console.log(`  \x1b[33m!\x1b[0m ${msg}`);
};
const fail = (msg) => {
  failures++;
  console.log(`  \x1b[31m✗\x1b[0m ${msg}`);
};
const section = (title) => console.log(`\n\x1b[1m${title}\x1b[0m`);

const value = (name) => process.env[name]?.trim() || null;
const present = (name) => value(name) !== null;

/** Exige la variable ; `optional` la rétrograde en simple information. */
function requireEnv(name, { optional = false, note = "" } = {}) {
  if (present(name)) {
    ok(`${name} présente${note ? ` — ${note}` : ""}`);
    return true;
  }
  if (optional) {
    warn(`${name} absente — ${note || "fonctionnalité dégradée"}`);
  } else {
    fail(`${name} absente${note ? ` — ${note}` : ""}`);
  }
  return false;
}

/** Une URL publique ne doit être ni vide, ni en clair, ni locale. */
function checkPublicUrl(name) {
  const raw = value(name);
  if (!raw) {
    fail(`${name} absente — Stripe et les emails y renvoient le navigateur`);
    return;
  }
  let url;
  try {
    url = new URL(raw);
  } catch {
    fail(`${name} n'est pas une URL valide`);
    return;
  }
  const local = url.hostname === "localhost" || url.hostname.startsWith("127.");
  if (PROD && local) {
    fail(`${name} pointe sur ${url.hostname} — inutilisable depuis un autre appareil`);
    return;
  }
  if (PROD && url.protocol !== "https:") {
    fail(`${name} n'est pas en HTTPS`);
    return;
  }
  ok(`${name} → ${url.origin}`);
}

// ─────────────────────────────────────────────────────────────────────────────
section("Supabase");
requireEnv("NEXT_PUBLIC_SUPABASE_URL");
requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
requireEnv("SUPABASE_SERVICE_ROLE_KEY", {
  note: "le webhook Stripe et la suppression de compte en dépendent",
});

// ─────────────────────────────────────────────────────────────────────────────
section("Application");
checkPublicUrl("NEXT_PUBLIC_APP_URL");
requireEnv("ANTHROPIC_API_KEY", { note: "extraction des pages" });
requireEnv("FIRECRAWL_API_KEY", { optional: true, note: "lecture directe en repli" });
requireEnv("PERPLEXITY_API_KEY", { optional: true, note: "pas d'enrichissement avis/réseaux" });

// ─────────────────────────────────────────────────────────────────────────────
section("Stripe");

const stripeKey = value("STRIPE_SECRET_KEY");
const PRICE_VARS = [
  "STRIPE_PRICE_PRO_MONTHLY",
  "STRIPE_PRICE_PRO_YEARLY",
  "STRIPE_PRICE_GROWTH_MONTHLY",
  "STRIPE_PRICE_GROWTH_YEARLY",
];

if (!stripeKey) {
  if (PROD) fail("STRIPE_SECRET_KEY absente — aucun paiement possible");
  else warn("STRIPE_SECRET_KEY absente — la page tarifs affiche les prix sans bouton");
} else {
  // Le mode se lit dans le préfixe, qui n'est pas la partie secrète de la clé.
  const testMode = stripeKey.includes("_test_");
  if (PROD && testMode) {
    fail("Clé Stripe en mode TEST — aucun paiement réel ne sera encaissé");
  } else {
    ok(`Clé Stripe en mode ${testMode ? "test" : "live"}`);
  }

  if (stripeKey.startsWith("sk_")) {
    warn(
      "Clé secrète complète (sk_). Une clé restreinte (rk_) limitée à Checkout, Customers, " +
        "Subscriptions et Billing Portal donnerait au serveur juste ce qu'il utilise.",
    );
  } else if (stripeKey.startsWith("rk_")) {
    ok("Clé restreinte (rk_)");
  }

  if (!present("STRIPE_WEBHOOK_SECRET")) {
    fail(
      "STRIPE_WEBHOOK_SECRET absente — le webhook refusera tous les événements, " +
        "et un client qui paie restera au palier gratuit",
    );
  } else {
    ok("STRIPE_WEBHOOK_SECRET présente");
  }

  // La vérification qui compte : un identifiant de prix créé en mode test n'existe pas en
  // mode live. Rien dans la chaîne ne le signale — la session de Checkout échoue au moment
  // où quelqu'un clique. On demande donc à Stripe si chaque prix existe vraiment.
  const stripe = new Stripe(stripeKey, { apiVersion: "2026-08-26.dahlia" });
  for (const name of PRICE_VARS) {
    const id = value(name);
    if (!id) {
      const sellable = name.startsWith("STRIPE_PRICE_PRO");
      if (sellable) fail(`${name} absente — le palier Pro ne peut pas être souscrit`);
      else warn(`${name} absente — Growth n'est de toute façon pas encore ouvert`);
      continue;
    }
    try {
      const price = await stripe.prices.retrieve(id);
      if (!price.active) warn(`${name} désigne un prix archivé chez Stripe`);
      else ok(`${name} résolu (${price.currency.toUpperCase()} ${(price.unit_amount ?? 0) / 100})`);
    } catch (error) {
      const code = error?.code ?? error?.type ?? "erreur";
      fail(`${name} introuvable chez Stripe (${code}) — mauvais mode, ou prix supprimé`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
section("Mentions légales");

const missing = missingLegalFields();
if (missing.length === 0) {
  ok("Identité de l'éditeur complète");
} else {
  const message = `Champs manquants dans src/lib/legal/identity.ts : ${missing.join(", ")}`;
  // Obligation de l'article 6-III de la LCEN : bloquant dès que le site est public.
  if (PROD) fail(message);
  else warn(message);
}

if (!LEGAL_IDENTITY.siret) {
  if (LEGAL_IDENTITY.registrationPending) {
    warn("SIRET absent, immatriculation annoncée en cours — à renseigner dès réception");
  } else {
    fail("SIRET absent et registrationPending à false — les pages affichent un trou");
  }
} else {
  ok("SIRET renseigné");
}

// ─────────────────────────────────────────────────────────────────────────────
console.log(
  `\n${failures === 0 ? "\x1b[32m" : "\x1b[31m"}${failures} bloquant(s)\x1b[0m, ${warnings} avertissement(s).`,
);
if (!PROD) {
  console.log("Relance avec \x1b[1m--prod\x1b[0m pour appliquer les exigences de production.");
}

process.exit(failures === 0 ? 0 : 1);
