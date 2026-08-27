-- Ajoute la date de résolution d'un écart.
--
-- Jusqu'ici detected_gaps ne stockait que `status` et `created_at` : on savait qu'un
-- écart était fait ou ignoré, jamais quand. Impossible donc de tracer l'évolution des
-- fermetures dans le temps ou un délai moyen de résolution.
--
-- Nullable et sans valeur par défaut : les écarts déjà fermés avant cette migration
-- gardent resolved_at à NULL. C'est volontaire — on ne connaît pas leur vraie date de
-- fermeture, et la deviner (created_at, now(), ...) fabriquerait un historique faux.
-- Les statistiques temporelles doivent donc exclure les lignes à NULL plutôt que de
-- les compter à une date inventée.

alter table detected_gaps
  add column if not exists resolved_at timestamptz;

comment on column detected_gaps.resolved_at is
  'Date de passage du statut à done/dismissed. NULL si encore ouvert, ou si fermé avant l''ajout de cette colonne.';

-- Sert les statistiques « écarts comblés dans le temps » : filtre sur les lignes
-- résolues d'un utilisateur, triées par date.
create index if not exists detected_gaps_user_resolved_at_idx
  on detected_gaps (user_id, resolved_at desc)
  where resolved_at is not null;
