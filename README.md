# Rivalys

> Vois où tu perds du terrain face à ton concurrent. Sais quoi faire pour le regagner.

Rivalys est un SaaS pour les fondateurs de logiciels (B2B et B2C). Tu renseignes ton produit et celui de ton plus gros concurrent. Rivalys compare des données publiques et factuelles (pricing, essai gratuit, palier gratuit, positionnement, présence sociale) et transforme chaque écart en tâche concrète et priorisée.

Pas de conseils génériques : chaque action découle d'un écart détecté. Pas de classement qui humilie, pas de comparaison entre utilisateurs.

## Fonctionnement

1. **Onboarding** : prénom, type de SaaS (B2B/B2C), secteur, description, URL de ton produit, URL du concurrent.
2. **Comparateur** : crawl de la page d'accueil et des pages pricing (`/pricing`, `/plans`, `/tarifs`, `/prix`), extraction structurée par l'API Claude, stockage en snapshots.
3. **Détection d'écarts** : règles codées en dur, pas de génération libre par le LLM. Exemple : le concurrent propose un essai gratuit et pas toi → écart pricing, priorité haute.
4. **Tâches** : liste des écarts ouverts, à marquer comme faits ou ignorer.
5. **Dashboard** : score global, actions prioritaires, tableau comparatif, évolution du score dans le temps.

Les données du concurrent sont mises en cache et rafraîchies selon le palier, jamais à chaque clic.

## Stack

- **Front et back** : Next.js 16 (App Router), React 19, TypeScript strict
- **Données et auth** : Supabase (Postgres, Auth, Row Level Security sur chaque table)
- **IA** : `@anthropic-ai/sdk`, appelé uniquement côté serveur
- **Crawl** : service Python dédié (`python/rivalys_crawler`, Scrapling), plus Firecrawl en option
- **UI** : Tailwind CSS v4, Recharts
- **Paiement** : Stripe (abonnements et webhooks)
- **Déploiement visé** : Vercel

## Structure

```
src/app/             pages Next.js (onboarding, tasks, tarifs, teardown, login…)
src/lib/compare/     moteur du comparateur : extraction, détection d'écarts, score
src/lib/billing/     accès payant, Stripe, quotas de concurrents
supabase/migrations  schéma Postgres et politiques RLS
python/              crawler et tests associés
api/                 point d'entrée Python
```

## Démarrer

```bash
npm install
cp .env.example .env.local   # puis renseigne les clés
npm run dev
```

La procédure complète (Supabase, Anthropic, Stripe, variables d'environnement, déploiement) est dans [docs/DEVELOPPEMENT.md](docs/DEVELOPPEMENT.md).

Tests :

```bash
npm test
```

## Sécurité et données

- Les clés API restent côté serveur. `.env.local` n'est jamais commité.
- Chaque table est protégée par RLS : un utilisateur ne voit que ses données.
- Les colonnes sensibles de `profiles` (facturation, abonnement) ne sont modifiables que par le serveur.

Le détail des protections et ce qui reste à faire avant la production est dans [docs/DEVELOPPEMENT.md](docs/DEVELOPPEMENT.md).

## Statut

Projet en cours de construction (MVP). L'état détaillé des fonctionnalités, de la sécurité et de la mise en production est dans [docs/DEVELOPPEMENT.md](docs/DEVELOPPEMENT.md).
