-- Growth : plusieurs concurrents suivis par utilisateur.
--
-- Le schéma ne l'interdisait pas — `detected_gaps` et `site_snapshots` portent
-- déjà chacun leur `competitor_id`, et rien n'imposait une ligne unique dans
-- `competitors`. Un seul objet supposait un concurrent unique : le score, écrit
-- pour l'utilisateur sans dire de quel face-à-face il parlait. Sur trois fronts,
-- ce chiffre n'a plus de référent : il mélangerait trois comparaisons en une
-- valeur que personne ne peut reconstituer, alors que la page /score promet
-- exactement l'inverse.

alter table score_history
  add column competitor_id uuid references competitors(id) on delete cascade;

-- Rattachement des relevés déjà enregistrés. Jusqu'ici chaque utilisateur n'avait
-- qu'un concurrent primaire : le rattachement est donc exact, ce n'est pas une
-- approximation. Les lignes d'un utilisateur qui n'a aucun concurrent restent à
-- null — on ne leur invente pas de référent, et les écrans les traitent comme un
-- historique sans face-à-face connu.
update score_history sh
set competitor_id = c.id
from competitors c
where c.user_id = sh.user_id
  and c.is_primary = true
  and sh.competitor_id is null;

create index score_history_competitor_recorded_idx
  on score_history (competitor_id, recorded_at desc);

create index competitors_user_created_idx
  on competitors (user_id, created_at desc);

-- Un même site ne peut être suivi deux fois par le même utilisateur : deux lignes
-- sur la même URL consommeraient deux places pour un seul relevé, et le sélecteur
-- afficherait deux entrées indiscernables. L'unicité est ici et pas seulement dans
-- l'action serveur, parce que deux requêtes simultanées passeraient la
-- vérification applicative toutes les deux.
create unique index competitors_user_url_idx on competitors (user_id, url);
