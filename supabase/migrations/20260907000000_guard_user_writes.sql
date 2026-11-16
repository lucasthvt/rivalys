-- Garde-fous côté base pour les écritures faites par le navigateur (rôles authenticated / anon).
--
-- 1. competitors : le quota de places par palier et le cooldown de remplacement d'URL étaient
--    appliqués seulement dans les server actions. Les politiques RLS laissaient l'insertion et la
--    modification directes (PostgREST), ce qui permettait d'ouvrir des places sans limite et de
--    réinitialiser `url_changed_at` pour sauter le cooldown de /api/compare.
--    Ici : comptage par palier à l'insertion, et `url`/`url_changed_at` non modifiables par le
--    navigateur. Le remplacement d'URL passe par la server action, qui écrit via service_role.
--
-- 2. testimonials : la garde de publication ne couvrait que l'UPDATE. Un INSERT direct pouvait
--    publier un avis (published = true) sans passer par l'opérateur.
--
-- Les limites ci-dessous reprennent COMPETITOR_SLOTS de src/lib/billing/competitor-slots.ts. Les
-- modifier aux deux endroits.

create or replace function public.guard_user_writes()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  tier_slots constant jsonb := '{"starter": 1, "pro": 1, "growth": 3}';
  current_tier text;
  current_count integer;
  allowed integer;
begin
  -- Le service_role (serveur, webhook, opérateur) et les migrations passent.
  if current_user not in ('authenticated', 'anon') then
    return coalesce(new, old);
  end if;

  if tg_table_name = 'competitors' then
    if tg_op = 'INSERT' then
      select p.subscription_tier into current_tier
        from public.profiles p where p.id = new.user_id;
      allowed := coalesce((tier_slots ->> coalesce(current_tier, 'starter'))::integer, 1);
      select count(*) into current_count
        from public.competitors c where c.user_id = new.user_id;
      if current_count >= allowed then
        raise exception 'Nombre de places de concurrent atteint pour ton palier.'
          using errcode = '42501';
      end if;
      -- Horodatage de remplacement : posé uniquement par le serveur.
      new.url_changed_at := null;
      return new;
    end if;

    if tg_op = 'UPDATE' then
      if new.url is distinct from old.url
         or new.url_changed_at is distinct from old.url_changed_at then
        raise exception 'L''URL d''un concurrent ne se modifie que depuis la page Concurrents.'
          using errcode = '42501';
      end if;
      return new;
    end if;
  end if;

  if tg_table_name = 'testimonials' and tg_op = 'INSERT' then
    -- Publication réservée à l'opérateur, comme pour la mise à jour.
    new.published := false;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists competitors_guard_user_writes_trg on public.competitors;
create trigger competitors_guard_user_writes_trg
  before insert or update on public.competitors
  for each row execute function public.guard_user_writes();

drop trigger if exists testimonials_guard_user_writes_trg on public.testimonials;
create trigger testimonials_guard_user_writes_trg
  before insert on public.testimonials
  for each row execute function public.guard_user_writes();
