# Rivalys

Vois où tu perds du terrain face à ton concurrent. Sais quoi faire pour le regagner.

Rivalys compare ton SaaS à ton plus gros concurrent sur des données publiques factuelles (pricing, essai gratuit, positionnement) et transforme chaque écart détecté en tâche concrète et priorisée.

## Stack

- Next.js 16 (App Router), TypeScript strict
- Supabase (Postgres, Auth, RLS)
- Tailwind CSS v4
- `@anthropic-ai/sdk` (extraction structurée des pages pricing, côté serveur uniquement)
- Firecrawl (récupération des pages publiques, optionnel — voir plus bas)
- Perplexity Agent API (enrichissement des écarts réseaux sociaux, optionnel)
- Recharts (graphique d'évolution du score)

## Lancer le projet en local

Prérequis : Node 18+, un compte Supabase, une clé API Anthropic.

```bash
npm install
```

Copie `.env.example` vers `.env.local` et renseigne les 4 variables (voir sections suivantes pour les obtenir) :

```bash
cp .env.example .env.local
```

```bash
npm run dev
```

Ouvre [http://localhost:3000](http://localhost:3000).

### Tests

Les règles de détection d'écarts, les détecteurs déterministes (réseaux, avis, connexion,
paiement), le calcul de score et les limites d'abonnement ont des tests unitaires
(`node:test`) :

```bash
npm test
```

Ce qu'ils protègent en priorité, ce n'est pas que les règles détectent : c'est qu'elles se
**taisent** quand la donnée n'a pas été observée. Un faux positif ressemble à un vrai
résultat à l'écran — c'est la contrainte de fond du projet, et celle qu'une refonte casse
en silence.

### Vérifier les détecteurs sur un vrai site

Les détecteurs déterministes (connexion, paiement, réseaux) sont calibrés sur les quelques
sites déjà observés. Chaque site réel qui les prend en défaut est une correction à écrire —
encore faut-il pouvoir le constater vite :

```bash
curl -s "http://localhost:3000/api/diagnostic?url=https://exemple.com" | python3 -m json.tool
```

La réponse montre les pages trouvées, ce qui a été relevé, et **l'extrait de texte sur
lequel la décision s'est prise**. C'est ce dernier point qui compte : il dit si un relevé
vide vient d'un motif trop strict de notre côté, ou d'une page qui ne contient réellement
rien.

L'endpoint est fermé en production — il déclenche des récupérations payantes sans
authentification ni limite de débit.

### Clic sur le bouton d'abonnement (désactivé par défaut)

`RIVALYS_CLICK_THROUGH=1` autorise le dernier niveau de détection du prestataire de
paiement : cliquer le bouton d'abonnement dans un navigateur pour voir où il mène.

Éteint par défaut parce qu'il coûte un scrape Firecrawl par site analysé et que
l'observation le dit peu rentable — un produit qui exige un compte avant de payer renvoie
sa page d'inscription, ce dont on ne conclut rien. Utile surtout sur les sites qui vendent
sans compte préalable.

## Base de données Supabase

Le schéma complet (tables `profiles`, `competitors`, `site_snapshots`, `detected_gaps`, `score_history`, avec Row Level Security) est dans `supabase/migrations/`.

1. Crée un projet sur [supabase.com](https://supabase.com/dashboard).
2. Récupère l'URL du projet et les clés API dans **Project Settings → API** :
   - `NEXT_PUBLIC_SUPABASE_URL` — Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — clé `anon` / `public`
   - `SUPABASE_SERVICE_ROLE_KEY` — clé `service_role` (secrète, jamais exposée côté client)
3. Lie le CLI Supabase à ton projet et applique les migrations :

```bash
npx supabase login
npx supabase link --project-ref <ton-project-ref>
npx supabase db push
```

4. (Optionnel) Régénère les types TypeScript à partir du schéma réel — le fichier `src/lib/supabase/database.types.ts` actuel est écrit à la main pour correspondre à la migration, et doit être remplacé une fois le projet lié :

```bash
npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts
```

## Accès payant (verrou des résultats)

L'analyse tourne pour tout le monde, dès la fin de l'onboarding. Ce qu'elle a trouvé — score,
écarts, comparatif, statistiques — n'est affiché qu'aux paliers payants ; un compte au palier
gratuit voit que l'analyse a eu lieu, sa date et le nombre d'écarts détectés, mais pas leur
contenu (les données ne sont pas envoyées au navigateur, voir
`src/components/billing/locked-results.tsx`).

La règle est dans `src/lib/billing/access.ts` : `starter` = gratuit, `pro` et `growth` = ouvert.

La facturation n'est pas branchée. Pour ouvrir un compte pendant le développement, passe son
palier à la main depuis le SQL editor Supabase :

```sql
update profiles set subscription_tier = 'pro' where id = '<user-uuid>';
```

Cette requête ne fonctionne que depuis le SQL editor (rôle `postgres`) ou avec la clé
service_role. Depuis un client authentifié, elle est refusée : `subscription_tier` n'est plus
accessible en écriture au rôle `authenticated` (voir la section Sécurité).

## Paiement (Stripe)

Les paliers Pro et Growth sont facturés via **Stripe Checkout hébergé** — pas un formulaire
intégré. C'est ce qui fait apparaître **Apple Pay et Google Pay automatiquement** sur les
appareils compatibles : le paiement a lieu sur `checkout.stripe.com`, domaine déjà vérifié
auprès d'Apple. Un formulaire intégré à notre domaine imposerait de le faire vérifier nous-mêmes.

Le code ne passe jamais `payment_method_types` : Stripe choisit dynamiquement les moyens
éligibles selon le client et la configuration du Dashboard. Le figer à `["card"]`
supprimerait précisément Apple Pay.

### Mise en place

1. Dans le Dashboard Stripe, active **Apple Pay** et **Google Pay** :
   *Settings → Payments → Payment methods*. Sans ça, ils n'apparaîtront pas au paiement.
2. Crée **un produit par palier** (Pro, Growth) — jamais deux paliers sur un même produit,
   sinon les lignes de facture portent toutes le même nom. Sur chaque produit, crée deux
   prix récurrents : mensuel et annuel.
3. Crée une **clé restreinte** (`rk_...`, *Developers → API keys → Restricted keys*) avec
   les permissions en écriture sur Checkout Sessions, Customers, Subscriptions et Billing
   Portal, et rien d'autre. Une clé secrète `sk_...` fonctionne aussi mais donne bien plus
   de pouvoir que ce que ce serveur utilise.
4. Active le **portail client** : *Settings → Billing → Customer portal*.
5. Crée le webhook vers `https://<ton-domaine>/api/billing/webhook`, abonné à
   `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated` et `customer.subscription.deleted`. Récupère son secret
   de signature.

En local, le webhook s'écoute avec le CLI Stripe (qui affiche le secret à utiliser) :

```bash
stripe listen --forward-to localhost:3000/api/billing/webhook
```

### Ce que le webhook décide

`src/app/api/billing/webhook/route.ts` est le **seul** endroit qui écrit
`profiles.subscription_tier`, dont dépend tout l'accès aux résultats. Trois règles :

- la signature est vérifiée sur le corps brut avant toute lecture du contenu ;
- le palier accordé est déduit de **l'identifiant de prix réellement facturé**, jamais des
  métadonnées : un abonnement peut être modifié depuis le Dashboard ou le portail client ;
- un prix qui ne correspond à aucun palier configuré n'accorde rien.

### Clés à ne jamais committer

`STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET` sont des secrets au même titre que la clé
service-role Supabase. En production sur Vercel, déclare-les en
[variable d'environnement sensible](https://vercel.com/docs/environment-variables/sensitive-environment-variables)
pour que leur valeur ne soit jamais relisible dans l'interface ni dans les logs.

## Clé API Anthropic

Utilisée côté serveur uniquement (`src/lib/compare/extract.ts`) pour extraire les données de pricing des pages web au format JSON structuré.

1. Crée une clé sur [console.anthropic.com](https://console.anthropic.com/settings/keys).
2. Renseigne-la dans `.env.local` sous `ANTHROPIC_API_KEY`.

## Firecrawl (optionnel)

Utilisé côté serveur (`src/lib/compare/firecrawl.ts`) pour récupérer les pages publiques : rend le JavaScript (donc gère les sites en React/Vue), retourne du markdown propre et la liste des liens sortants de la page.

**Uniquement l'opération `scrape` (une page à la fois), jamais `crawl` ou `map`** — conformément à la contrainte "pas de scraping massif ou automatisé" du brief.

Sans `FIRECRAWL_API_KEY`, le comparateur bascule automatiquement sur un fetch HTTP direct (le code d'origine, conservé) : la qualité baisse sur les sites très dynamiques, mais rien ne casse. Idem si Firecrawl est indisponible ou à court de crédits en cours de route.

Coût : 2 crédits par site analysé (page d'accueil + page de pricing), soit 4 par actualisation. Le palier gratuit (1 000 crédits/mois) couvre ~250 actualisations.

Clé à créer sur [firecrawl.dev](https://www.firecrawl.dev/).

## Perplexity (optionnel)

Utilisé côté serveur (`src/lib/compare/perplexity.ts`) pour ajouter **une phrase factuelle** à un écart "réseaux sociaux" déjà détecté.

Point important : l'écart lui-même n'est jamais créé par Perplexity. Il vient d'une règle déterministe qui compare les liens sociaux publiés par chaque site (`src/lib/compare/social.ts`). Perplexity ne fait qu'enrichir la description, et un échec (clé absente, API indisponible, réponse "INCONNU") laisse l'écart intact sans sa phrase d'enrichissement.

L'appel n'a lieu que lorsqu'un écart social existe réellement — donc pas à chaque actualisation.

Cible l'**Agent API** (`POST /v1/agent`), pas l'endpoint Sonar `/chat/completions` qui est retiré le 27 septembre 2026. Preset `fast` : ~$0.005 par appel.

Clé à créer sur [perplexity.ai/account/api](https://www.perplexity.ai/account/api/group).

## Variables d'environnement

Voir `.env.example` :

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
FIRECRAWL_API_KEY=
PERPLEXITY_API_KEY=
NEXT_PUBLIC_APP_URL=
RIVALYS_CLICK_THROUGH=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_PRO_MONTHLY=
STRIPE_PRICE_PRO_YEARLY=
STRIPE_PRICE_GROWTH_MONTHLY=
STRIPE_PRICE_GROWTH_YEARLY=
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
```

> `.env.example` ne contient pas encore `NEXT_PUBLIC_TURNSTILE_SITE_KEY` — à y ajouter.

`FIRECRAWL_API_KEY` et `PERPLEXITY_API_KEY` sont optionnelles : sans elles, le comparateur
fonctionne en mode dégradé (fetch direct, pas d'enrichissement social).

Les variables Stripe le sont aussi : sans `STRIPE_SECRET_KEY`, la page tarifs affiche les
prix sans bouton de paiement, et les routes `/api/billing/*` répondent 503 au lieu de
planter. `NEXT_PUBLIC_APP_URL` est l'URL publique de l'application (ex.
`https://rivalys.com`) — Stripe y renvoie le navigateur après paiement, elle ne se devine
pas.

`NEXT_PUBLIC_TURNSTILE_SITE_KEY` est la clé **publique** du captcha. La clé secrète
correspondante ne va pas ici : elle se pose dans le tableau de bord Supabase, qui est le seul
à vérifier le jeton. Voir la section Sécurité.

## Sécurité

### Ce qui protège quoi

| Menace | Défense | Où |
| --- | --- | --- |
| Lire les données d'un autre utilisateur | Row Level Security sur les cinq tables, filtrée sur `auth.uid()` | `supabase/migrations/20260825000000_init_schema.sql` |
| S'accorder un palier payant sans payer | Privilèges au niveau colonne + déclencheur sur `profiles` | `supabase/migrations/20260830000000_lock_billing_columns.sql` |
| Ouvrir le portail Stripe de quelqu'un d'autre | Mêmes privilèges : `stripe_customer_id` non inscriptible depuis le navigateur | idem |
| Falsifier un événement de paiement | Vérification de la signature Stripe avant toute lecture du corps | `src/app/api/billing/webhook/route.ts` |
| XSS | CSP à nonce avec `strict-dynamic` — aucun script sans nonce ne s'exécute | `src/proxy.ts` |
| Clickjacking | `frame-ancestors 'none'` + `X-Frame-Options: DENY` | `src/proxy.ts`, `next.config.ts` |
| Interception réseau | HSTS deux ans, `upgrade-insecure-requests` | `next.config.ts`, `src/proxy.ts` |
| SSRF via l'URL d'un concurrent | Rejet des IP privées/réservées, revalidation à chaque redirection, 5 sauts max | `src/lib/compare/url-safety.ts`, `fetch-site.ts` |
| Redirection ouverte après connexion | `next` accepté seulement s'il est un chemin interne | `src/app/login/page.tsx`, `src/app/auth/callback/route.ts` |
| Abus de coût (Firecrawl / Claude / Perplexity) | 24 h entre deux analyses, 30 jours entre deux changements de concurrent | `src/lib/compare/rate-limit.ts`, `src/lib/billing/competitor-slots.ts` |
| Bourrage d'identifiants | Mot de passe 12 caractères / 4 catégories, limites Supabase par IP (30 tentatives / 5 min). Captcha écrit mais volontairement éteint, voir ci-dessous | `src/lib/auth/password.ts`, `supabase/config.toml` |

### La règle des colonnes de `profiles`

Le rôle `authenticated` n'a PAS `insert`/`update` sur toute la table : seulement sur la liste
de colonnes énumérée dans `20260830000000_lock_billing_columns.sql`. **Toute nouvelle colonne
de profil doit y être ajoutée**, sinon son écriture est refusée. C'est volontaire : l'oubli
est bruyant, alors qu'un `grant all` de confort rouvrirait silencieusement la possibilité pour
n'importe quel compte gratuit de se passer en Growth.

### Captcha Turnstile — écrit, éteint, assumé

**Le captcha n'est pas obligatoire et n'est pas activé.** Ce n'est pas un oubli.

La CNIL (délibération 2022-100) raisonne par équivalence sur les mots de passe : douze
caractères avec quatre catégories suffisent seuls, sans mesure complémentaire ; c'est à
partir de huit qu'il faut y adjoindre un blocage de compte, une limitation de débit **ou** un
captcha. Le projet a pris le premier chemin, donc rien n'exige le second.

Ce que le captcha couvrirait en plus : le bourrage d'identifiants réparti sur des centaines
d'adresses IP, que la limite Supabase (30 tentatives / 5 min / IP) ne voit pas passer. C'est
une attaque montée contre des services où un compte a de la valeur marchande. Ici, un compte
compromis donne accès à l'URL d'un concurrent — les moyens de paiement sont chez Stripe.
À activer le jour où il y a de vrais utilisateurs, ou à la première vague d'inscriptions
suspectes.

Le code est écrit et **inerte tant que `NEXT_PUBLIC_TURNSTILE_SITE_KEY` est absente**.
L'allumer ne demande aucune ligne de code :

1. Créer un widget sur [dash.cloudflare.com](https://dash.cloudflare.com) → Turnstile,
   hostnames `rivalys.com` **et** `localhost`.
2. Clé **de site** → `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, dans `.env.local` et dans les
   variables d'environnement Vercel. Redémarrer le serveur.
3. Vérifier que le widget s'affiche sur `/login` **avant** l'étape suivante.
4. Clé **secrète** → Supabase, Authentication → Attack Protection → Enable Captcha
   protection, provider `Turnstile`. Jamais dans ce dépôt : c'est Supabase qui vérifie le
   jeton, pas notre serveur.

⚠️ Les deux clés commencent par `0x4AAAAA` et se confondent à l'œil. Coller la secrète à la
place de celle de site donne l'erreur Turnstile `400020`. L'écran affiche désormais le vrai
motif plutôt qu'un diagnostic au hasard — voir `explainTurnstileError` dans
`src/components/auth/Turnstile.tsx`.

⚠️ L'ordre compte. Supabase activé sans la variable rejette **toutes** les connexions par mot
de passe, y compris la tienne. En cas de blocage : décocher Enable Captcha protection.

La politique de sécurité du contenu s'ouvre sur `challenges.cloudflare.com` (script + iframe)
uniquement quand la clé est présente — vérifié par les tests de `src/lib/security/csp.ts`.

### Déjà fait

- [x] Migrations `20260830000000` et `20260830010000` appliquées au projet lié
      (`nzmcdbaetinpemiwlrhl`). Vérifié : `update profiles set subscription_tier` sous le rôle
      `authenticated` renvoie `42501 permission denied for table profiles`.
- [x] Code du captcha écrit et branché sur `/login` et `/signup`, éteint par défaut (jeton
      remis à zéro après chaque échec — un jeton Turnstile ne sert qu'une fois ; pas de
      relance automatique sur une erreur de configuration).

### À faire avant la mise en production

- [ ] **Tableau de bord Supabase** — `supabase/config.toml` ne configure que le local, et
      `supabase config push` écraserait `site_url` avec `http://127.0.0.1:3000`. À régler à la
      main dans Authentication :
      - Site URL et Redirect URLs = domaine de production
      - Confirm email = activé — **exige un SMTP personnalisé** (Resend, SendGrid…) : le
        service d'emails intégré est plafonné à quelques envois par heure et n'est pas prévu
        pour la production
      - Minimum password length = 12, requirements = lettres min/maj + chiffres + symboles
      - Secure password change = activé
- [ ] Renseigner les deux champs restants de `src/lib/legal/identity.ts` : `address` et
      `publicationDirector` (obligation de l'article 6-III de la LCEN). Tant qu'ils sont
      vides, les trois pages légales affichent un bandeau rouge. Le SIRET peut rester `null`
      avec `registrationPending: true` — les pages écrivent alors « immatriculation en
      cours ».
- [ ] Repasser `registrationPending` à `false` et renseigner `siret` dès réception.
- [ ] Supprimer la page de prévisualisation temporaire : `rm -rf src/app/apercu`.
- [ ] Utiliser une clé Stripe **restreinte** (`rk_...`), pas une clé secrète complète.
- [ ] Vérifier que `NEXT_PUBLIC_APP_URL` pointe sur le domaine de production (Checkout et le
      portail y renvoient le navigateur).
- [ ] Mettre en place la suppression des comptes inactifs depuis trois ans, annoncée dans la
      politique de confidentialité. Rien ne l'automatise aujourd'hui.

### Reporté, en connaissance de cause

- **Captcha Turnstile** — non obligatoire, voir ci-dessus. À rallumer quand le service a de
  vrais utilisateurs.
- **Leaked password protection** (refus des mots de passe présents dans des fuites connues,
  via HaveIBeenPwned) — **réservé au plan Pro de Supabase**, donc indisponible tant que le
  projet est en Free. C'est le seul point que relève encore
  `npx supabase db advisors --linked --type security` : l'avertissement est attendu et ne
  se corrige pas par du code. À activer le jour d'un passage en Pro.

## RGPD

- **Base légale** : exécution du contrat pour le service, obligation légale pour la
  conservation comptable, intérêt légitime pour la sécurité. Aucun traitement publicitaire.
- **Sous-traitants** : Supabase (UE), Vercel, Anthropic, Firecrawl, Perplexity, Stripe, Google
  (OAuth uniquement). La liste de `src/app/confidentialite/page.tsx` doit être tenue à jour
  avec le code : **ajouter un appel réseau à un nouveau prestataire oblige à l'y déclarer.**
- **Droits en libre-service** : la page `/compte` télécharge l'export complet (articles 15 et
  20) et supprime le compte avec résiliation de l'abonnement (article 17). Aucun échange
  d'email n'est nécessaire.
- **Preuve d'acceptation** : `profiles.terms_accepted_at`, horodatée par un déclencheur avec
  l'horloge de la base — la date ne peut pas être choisie par celui qui accepte.
- **Cookies** : uniquement ceux de session de Supabase Auth. Exemptés de consentement, donc
  aucune bannière. Ajouter le moindre outil de mesure d'audience oblige à en poser une.

## Structure

- `src/app/login`, `src/app/signup`, `src/app/onboarding` — auth Supabase + onboarding en 5 étapes
- `src/app/api/compare` + `src/lib/compare/` — pipeline du comparateur : fetch des sites (Firecrawl ou direct), extraction Claude, détection des réseaux sociaux, règles de détection d'écarts codées en dur, calcul du score
- `src/app/dashboard`, `src/app/tasks` — dashboard et liste de tâches (issues des écarts détectés)
- `src/components/ui` — design system partagé (Button, Card, Badge, ProgressBar)
- `supabase/migrations/` — schéma SQL + policies RLS

## Contraintes de fond

- Aucune donnée privée ou inventée : uniquement des données publiques (pricing affiché, présence sur les sites), jamais de chiffres business propriétaires.
- Pas de crawl autonome : le fetch d'un site ne se déclenche que sur action explicite de l'utilisateur (fin d'onboarding, bouton "Actualiser").
- En cas d'échec de récupération d'une donnée, le système l'affiche clairement plutôt que d'inventer une estimation.
