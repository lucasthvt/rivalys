-- Rattache un profil à son client et à son abonnement Stripe.
--
-- `subscription_tier` existait déjà et reste la source de vérité pour l'accès (voir
-- src/lib/billing/access.ts) : c'est le webhook Stripe qui l'écrit. Les colonnes ajoutées
-- ici servent à faire le lien dans l'autre sens — retrouver le profil à partir d'un
-- événement Stripe, et rouvrir le portail de gestion d'un client existant sans lui créer
-- un second compte Stripe à chaque visite.
--
-- Toutes nullables : un compte qui n'a jamais ouvert de paiement n'a pas de client Stripe,
-- et lui en inventer un serait faux autant qu'inutile.

alter table profiles
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status text,
  add column if not exists subscription_current_period_end timestamptz;

-- Un client Stripe appartient à un seul profil. Sans cette contrainte, un doublon
-- silencieux ferait basculer le palier du mauvais utilisateur au prochain événement.
create unique index if not exists profiles_stripe_customer_id_key
  on profiles (stripe_customer_id)
  where stripe_customer_id is not null;

-- Le webhook cherche le profil par client Stripe à chaque événement : c'est la lecture
-- la plus fréquente de ces colonnes.
create index if not exists profiles_stripe_subscription_id_idx
  on profiles (stripe_subscription_id)
  where stripe_subscription_id is not null;

comment on column profiles.stripe_customer_id is
  'Identifiant du client Stripe (cus_...). NULL tant qu''aucun paiement n''a été ouvert.';

comment on column profiles.subscription_status is
  'Statut brut de l''abonnement Stripe (active, trialing, past_due, canceled, ...). Informatif : l''accès est décidé par subscription_tier, écrit par le webhook.';

comment on column profiles.subscription_current_period_end is
  'Fin de la période payée en cours, telle que renvoyée par Stripe. Sert à dire à l''utilisateur jusqu''à quand son accès court après une résiliation.';
