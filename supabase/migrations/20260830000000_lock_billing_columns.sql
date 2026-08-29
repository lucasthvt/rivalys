-- Ferme l'écriture des colonnes de facturation aux rôles applicatifs.
--
-- LA FAILLE CORRIGÉE ICI
-- ----------------------
-- `profiles` porte à la fois des champs que l'utilisateur remplit (prénom, secteur, URL)
-- et des champs qui décrivent ce qu'il a payé (`subscription_tier`, `stripe_customer_id`,
-- …). Les politiques RLS posées à l'initialisation n'autorisent qu'une chose : écrire SA
-- PROPRE ligne. Elles ne disent rien des colonnes.
--
-- Or l'accès payant est décidé par `profiles.subscription_tier` (src/lib/billing/access.ts),
-- la clé anon et l'URL du projet sont publiques par construction (NEXT_PUBLIC_*), et le
-- navigateur porte un jeton du rôle `authenticated`. N'importe quel compte gratuit pouvait
-- donc s'offrir Growth avec une requête directe sur PostgREST :
--
--   PATCH /rest/v1/profiles?id=eq.<son propre id>   {"subscription_tier":"growth"}
--
-- La politique `profiles_update_own` acceptait : la ligne lui appartient bien. Aucun
-- passage par Stripe, aucun webhook, aucune trace de paiement.
--
-- Même chemin, conséquence plus grave, sur `stripe_customer_id` : POST /api/billing/portal
-- ouvre le portail Stripe du client inscrit dans le profil. Écrire là l'identifiant d'un
-- autre client (`cus_…`) donnait accès à SES factures, SA carte et SA résiliation.
--
-- CE QUE FAIT CETTE MIGRATION
-- ---------------------------
-- 1. Privilèges au niveau colonne : `authenticated` et `anon` ne peuvent plus écrire que
--    les champs que l'utilisateur remplit lui-même. C'est le mécanisme Postgres natif,
--    appliqué avant même la RLS.
-- 2. Un déclencheur en défense en profondeur, pour le cas où une future migration
--    re-accorderait `update` en bloc sur la table (un `grant all` de confort suffit à
--    rouvrir le trou sans que personne ne le remarque).
--
-- Ces colonnes restent lisibles par leur propriétaire : l'application doit pouvoir
-- afficher le palier et la date de fin de période. Seule l'écriture est fermée.
--
-- Le webhook Stripe continue d'écrire : il utilise la clé service_role, qui n'est
-- concernée ni par ces révocations ni par le déclencheur.

-- ============================================================
-- 1. Privilèges au niveau colonne
-- ============================================================

revoke insert, update on table public.profiles from authenticated, anon;

-- Colonnes que l'utilisateur renseigne lui-même, à l'onboarding puis dans son compte.
-- `id` doit rester insérable : c'est la clé, et la politique RLS la contraint déjà à
-- auth.uid(). Toute nouvelle colonne « de profil » devra être ajoutée à ces deux listes,
-- sinon son écriture sera refusée — un oubli visible, jamais silencieux.
grant insert (
  id,
  first_name,
  saas_type,
  industry,
  product_description,
  saas_url,
  product_stage,
  pricing_model,
  main_goal,
  target_customer,
  onboarding_completed
) on table public.profiles to authenticated;

-- `id` figure dans la liste UPDATE pour une raison technique, pas par laxisme : un upsert
-- PostgREST se traduit par `insert ... on conflict (id) do update set` portant TOUTES les
-- colonnes du corps, `id` compris — sans ce privilège, l'onboarding échouerait sur
-- « permission denied for column id ». La politique RLS impose `with check (id = auth.uid())`,
-- donc la seule valeur qu'on puisse y écrire est celle qui s'y trouve déjà.
grant update (
  id,
  first_name,
  saas_type,
  industry,
  product_description,
  saas_url,
  product_stage,
  pricing_model,
  main_goal,
  target_customer,
  onboarding_completed
) on table public.profiles to authenticated;

-- ============================================================
-- 2. Déclencheur de défense en profondeur
-- ============================================================

-- Volontairement PAS `security definer` : dans une fonction SECURITY DEFINER, `current_user`
-- vaut le propriétaire de la fonction (postgres), pas le rôle appelant — le test ci-dessous
-- serait toujours vrai et le déclencheur ne protégerait plus rien. En SECURITY INVOKER
-- (le défaut), `current_user` est bien le rôle posé par PostgREST : `authenticated`, `anon`
-- ou `service_role`. La fonction ne lit aucune table, elle n'a besoin d'aucun privilège
-- supplémentaire.
create or replace function public.reject_billing_column_writes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Ne concerne que les rôles portés par une requête venue du navigateur. Le webhook
  -- (service_role), les migrations (postgres) et l'administration Supabase passent.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Un profil se crée toujours au palier gratuit. Le palier ne monte que par le webhook.
    new.subscription_tier := 'starter';
    new.stripe_customer_id := null;
    new.stripe_subscription_id := null;
    new.subscription_status := null;
    new.subscription_current_period_end := null;
    return new;
  end if;

  if new.subscription_tier is distinct from old.subscription_tier
     or new.stripe_customer_id is distinct from old.stripe_customer_id
     or new.stripe_subscription_id is distinct from old.stripe_subscription_id
     or new.subscription_status is distinct from old.subscription_status
     or new.subscription_current_period_end is distinct from old.subscription_current_period_end
  then
    raise exception 'Les colonnes de facturation ne sont écrites que par le webhook Stripe.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.reject_billing_column_writes is
  'Défense en profondeur derrière les privilèges de colonne : empêche un client authentifié de s''accorder un palier payant ou de se rattacher au client Stripe de quelqu''un d''autre.';

drop trigger if exists profiles_reject_billing_column_writes on public.profiles;

create trigger profiles_reject_billing_column_writes
  before insert or update on public.profiles
  for each row
  execute function public.reject_billing_column_writes();
