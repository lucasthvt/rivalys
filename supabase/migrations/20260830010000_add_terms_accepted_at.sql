-- Horodate l'acceptation des CGU et de la politique de confidentialité.
--
-- La case cochée à l'inscription vit dans le navigateur : elle bloque le formulaire, mais
-- elle ne prouve rien. Les métadonnées utilisateur de Supabase ne prouvent rien non plus,
-- elles sont modifiables par leur propriétaire.
--
-- Cette colonne est écrite par le serveur, à la fin de l'onboarding, avec l'horloge de la
-- base. C'est la seule trace du consentement qui ne dépende pas de ce que le client a bien
-- voulu envoyer — ce que le RGPD demande de pouvoir démontrer (article 7.1 pour le
-- consentement, et à tout le moins la preuve de l'acceptation contractuelle ici, la base
-- légale étant l'exécution du contrat).
--
-- NULL = profil créé avant cette migration, ou onboarding jamais terminé. Aucune valeur
-- n'est inventée : dater rétroactivement une acceptation qui n'a pas été tracée
-- fabriquerait exactement la preuve qu'on prétend détenir.

alter table profiles
  add column if not exists terms_accepted_at timestamptz;

comment on column profiles.terms_accepted_at is
  'Date d''acceptation des CGU et de la politique de confidentialité, horodatée côté serveur. NULL si jamais tracée.';

-- Écrite par l'utilisateur lui-même à la fin de l'onboarding (voir
-- src/app/onboarding/actions.ts), donc le privilège de colonne doit être accordé — la
-- migration 20260830000000 a révoqué l'écriture en bloc sur la table.
grant insert (terms_accepted_at), update (terms_accepted_at)
  on table public.profiles to authenticated;

-- La date, elle, n'est pas laissée au client : accorder l'écriture de la colonne sans
-- cette contrainte permettrait d'antidater sa propre acceptation. Le déclencheur force
-- l'horloge de la base, et interdit d'effacer une acceptation déjà tracée.
-- Même remarque que pour reject_billing_column_writes : surtout pas SECURITY DEFINER,
-- sinon `current_user` désignerait le propriétaire de la fonction et le test serait faux.
create or replace function public.stamp_terms_acceptance()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.terms_accepted_at is not null then
      new.terms_accepted_at := now();
    end if;
    return new;
  end if;

  if new.terms_accepted_at is distinct from old.terms_accepted_at then
    -- Une acceptation ne se retire pas en repassant la colonne à NULL.
    new.terms_accepted_at := coalesce(
      case when new.terms_accepted_at is null then old.terms_accepted_at end,
      old.terms_accepted_at,
      now()
    );
  end if;

  return new;
end;
$$;

comment on function public.stamp_terms_acceptance is
  'Force terms_accepted_at à l''horloge de la base pour les écritures venues du navigateur : la date d''acceptation ne doit pas être choisie par celui qui accepte.';

drop trigger if exists profiles_stamp_terms_acceptance on public.profiles;

create trigger profiles_stamp_terms_acceptance
  before insert or update on public.profiles
  for each row
  execute function public.stamp_terms_acceptance();
