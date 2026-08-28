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
```

Les deux dernières sont optionnelles : sans elles, le comparateur fonctionne en mode dégradé (fetch direct, pas d'enrichissement social).

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
