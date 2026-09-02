-- L'essai gratuit de la page d'accueil : une analyse sans compte, avec de quoi en borner
-- le coût.
--
-- Chaque analyse dépense de vrais crédits Firecrawl, Claude et Perplexity. Ouverte sans
-- garde-fou, la route se scripte et vide le budget en une nuit. Ces deux tables sont ce
-- qui rend l'offre tenable : l'une évite de repayer une paire déjà analysée, l'autre
-- borne ce qu'un visiteur peut déclencher.
--
-- À ne pas confondre avec ce que CLAUDE.md interdit : il n'y a ici aucun crawl autonome,
-- aucune base de concurrents constituée à l'avance. On ne garde que le résultat de paires
-- qu'un visiteur a explicitement demandées, une par une.

create table if not exists public.public_teardowns (
  -- Clé directionnelle : « A comparé à B » n'est pas « B comparé à A », puisque le score
  -- porte sur le premier des deux. Construite côté application après normalisation des
  -- URL (voir src/lib/compare/public-teardown.ts) pour que deux écritures de la même
  -- adresse ne produisent pas deux analyses payantes.
  pair_key text primary key,
  own_url text not null,
  competitor_url text not null,
  -- Le résultat COMPLET du pipeline. La route n'en expose publiquement qu'un extrait
  -- (score, comptages, écart mis en avant) ; le reste est conservé pour pouvoir l'ouvrir
  -- plus tard à un visiteur qui crée un compte, sans relancer d'analyse payante.
  result jsonb not null,
  -- Combien de visiteurs sont retombés sur cette paire. Sert à deux choses : mesurer ce
  -- que le cache économise, et savoir quelles comparaisons intéressent vraiment le marché.
  hit_count integer not null default 0,
  created_at timestamptz not null default now()
);

-- Le plafond global journalier compte les analyses NEUVES du jour : seules celles-là ont
-- coûté quelque chose.
create index if not exists public_teardowns_created_at_idx
  on public.public_teardowns (created_at desc);

comment on table public.public_teardowns is
  'Cache des analyses publiques lancées depuis la page d''accueil, une ligne par paire d''URL explicitement demandée par un visiteur. Évite de repayer une analyse déjà faite.';

create table if not exists public.public_teardown_quota (
  -- L'adresse IP n'est jamais stockée en clair : seulement un HMAC-SHA256 tronqué, calculé
  -- avec un secret serveur. Une IP est une donnée personnelle au sens du RGPD, et le
  -- besoin ici se limite à reconnaître « ce visiteur a déjà eu son essai » — ce qu'un
  -- condensat suffit à faire, sans conserver de quoi remonter à quelqu'un.
  ip_hash text primary key,
  used_at timestamptz not null default now()
);

comment on table public.public_teardown_quota is
  'Un enregistrement par visiteur ayant consommé son analyse gratuite. Contient un condensat de l''IP, jamais l''IP elle-même.';

-- RLS activée SANS aucune policy : la table devient inaccessible à la clé anonyme comme à
-- celle d'un utilisateur connecté. Seul le rôle de service, côté serveur, y écrit et y lit.
-- Le quota se contournerait en une requête si le navigateur pouvait y toucher, et le cache
-- exposerait le contenu complet des analyses que la page d'accueil masque volontairement.
alter table public.public_teardowns enable row level security;
alter table public.public_teardown_quota enable row level security;
