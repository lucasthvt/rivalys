-- Collecte des avis clients.
--
-- La landing a une bande d'avis. La remplir suppose d'avoir des retours réels et de
-- pouvoir le prouver : depuis la transposition de la directive Omnibus (2019/2161) en
-- mai 2022, afficher un avis client oblige à démontrer qu'il émane d'un utilisateur du
-- produit. Cette table est cette preuve — chaque ligne est rattachée à un compte, datée,
-- et porte un consentement explicite à la publication.
--
-- Deux booléens distincts, et la distinction est le cœur de la table :
--   consent_public — la personne accepte que son retour soit publié. C'est SA décision.
--   published      — le retour est effectivement affiché. C'est la nôtre.
-- Un avis n'apparaît que si les deux sont vrais. Confondre les deux reviendrait soit à
-- publier sans accord, soit à ne plus pouvoir retirer un avis devenu inexact.

create table if not exists public.testimonials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,

  quote text not null,

  -- Ce que la personne accepte de voir affiché à côté de sa phrase : prénom, pseudo, nom
  -- de son SaaS. Jamais son email, jamais une identité qu'elle n'a pas écrite elle-même —
  -- l'email sert à l'authentification, pas à la vitrine.
  author_label text not null,
  role_label text,

  consent_public boolean not null default false,
  published boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Un avis par compte. Sans cette contrainte, un même utilisateur peut peupler la bande
  -- à lui seul et la page donne l'illusion d'une base de clients qui n'existe pas. La
  -- personne modifie le sien plutôt que d'en ajouter un second.
  unique (user_id)
);

-- Bornes de longueur en base et pas seulement dans le formulaire : le navigateur n'est
-- pas l'endroit où l'on décide de ce qui entre en base. Une citation de 4000 signes casse
-- la carte, une citation vide crée une carte fantôme.
alter table public.testimonials
  add constraint testimonials_quote_length check (char_length(quote) between 20 and 400),
  add constraint testimonials_author_length check (char_length(author_label) between 2 and 40),
  add constraint testimonials_role_length check (role_label is null or char_length(role_label) between 2 and 60);

comment on table public.testimonials is
  'Retours d''utilisateurs, un par compte. Un avis n''est affiché publiquement que si consent_public (accord de la personne) ET published (validation par nous) sont vrais.';

create index if not exists testimonials_published_idx
  on public.testimonials (created_at desc)
  where published and consent_public;

alter table public.testimonials enable row level security;

-- Chacun ne voit et ne modifie que le sien.
create policy "testimonials_select_own"
  on public.testimonials for select
  using (auth.uid() = user_id);

create policy "testimonials_insert_own"
  on public.testimonials for insert
  with check (auth.uid() = user_id);

create policy "testimonials_update_own"
  on public.testimonials for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "testimonials_delete_own"
  on public.testimonials for delete
  using (auth.uid() = user_id);

-- Lecture publique STRICTEMENT limitée aux avis doublement validés. C'est la seule policy
-- de tout le schéma qui expose une ligne à un visiteur non connecté : elle ne doit laisser
-- passer ni un brouillon, ni un avis dont l'accord a été retiré.
create policy "testimonials_select_published"
  on public.testimonials for select
  to anon, authenticated
  using (published and consent_public);

-- `published` et `consent_public` restent modifiables par leur propriétaire : retirer son
-- accord doit dépublier immédiatement, sans passer par nous. En revanche republier ce
-- qu'on a dépublié se fait côté service — d'où le trigger ci-dessous, qui empêche un
-- utilisateur de rallumer `published` tout seul.
create or replace function public.testimonials_guard_publication()
returns trigger
language plpgsql
-- Volontairement SECURITY INVOKER (le défaut) : la fonction distingue l'appelant via
-- `current_user`, or SECURITY DEFINER le remplacerait par le propriétaire de la fonction
-- et le garde-fou ne verrait plus jamais la différence entre nous et un utilisateur.
set search_path = public
as $$
begin
  new.updated_at := now();

  -- Le rôle de service, c'est nous côté serveur. C'est lui qui publie et qui corrige une
  -- coquille sans dépublier au passage ; les règles ci-dessous ne le concernent pas.
  if current_user = 'service_role' then
    return new;
  end if;

  -- Toute modification du texte remet l'avis en file d'attente : sinon une phrase validée
  -- peut être réécrite après coup en n'importe quoi, et la validation ne veut plus rien
  -- dire.
  if new.quote is distinct from old.quote
     or new.author_label is distinct from old.author_label
     or new.role_label is distinct from old.role_label then
    new.published := false;
  end if;

  -- Un utilisateur peut dépublier le sien, jamais le publier.
  if new.published and not old.published then
    new.published := false;
  end if;

  return new;
end;
$$;

create trigger testimonials_guard_publication_trg
  before update on public.testimonials
  for each row
  execute function public.testimonials_guard_publication();
