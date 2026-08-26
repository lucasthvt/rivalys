# Rivalys

Vois où tu perds du terrain face à ton concurrent. Sais quoi faire pour le regagner.

Rivalys compare ton SaaS à ton plus gros concurrent sur des données publiques factuelles (pricing, essai gratuit, positionnement) et transforme chaque écart détecté en tâche concrète et priorisée.

## Stack

- Next.js 16 (App Router), TypeScript strict
- Supabase (Postgres, Auth, RLS)
- Tailwind CSS v4
- `@anthropic-ai/sdk` (extraction structurée des pages pricing, côté serveur uniquement)
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

Les règles de détection d'écarts et le calcul de score ont des tests unitaires (`node:test`) :

```bash
node --import ./src/lib/compare/__tests__/register-ts-extensions.mjs --test src/lib/compare/__tests__/*.test.ts
```

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

## Clé API Anthropic

Utilisée côté serveur uniquement (`src/lib/compare/extract.ts`) pour extraire les données de pricing des pages web au format JSON structuré.

1. Crée une clé sur [console.anthropic.com](https://console.anthropic.com/settings/keys).
2. Renseigne-la dans `.env.local` sous `ANTHROPIC_API_KEY`.

## Variables d'environnement

Voir `.env.example` :

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
```

## Structure

- `src/app/login`, `src/app/signup`, `src/app/onboarding` — auth Supabase + onboarding en 5 étapes
- `src/app/api/compare` + `src/lib/compare/` — pipeline du comparateur : fetch des sites, extraction Claude, règles de détection d'écarts codées en dur, calcul du score
- `src/app/dashboard`, `src/app/tasks` — dashboard et liste de tâches (issues des écarts détectés)
- `src/components/ui` — design system partagé (Button, Card, Badge, ProgressBar)
- `supabase/migrations/` — schéma SQL + policies RLS

## Contraintes de fond

- Aucune donnée privée ou inventée : uniquement des données publiques (pricing affiché, présence sur les sites), jamais de chiffres business propriétaires.
- Pas de crawl autonome : le fetch d'un site ne se déclenche que sur action explicite de l'utilisateur (fin d'onboarding, bouton "Actualiser").
- En cas d'échec de récupération d'une donnée, le système l'affiche clairement plutôt que d'inventer une estimation.
