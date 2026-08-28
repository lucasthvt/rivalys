-- Trace la date du dernier changement d'URL d'un concurrent.
--
-- Le palier Pro ouvre une seule place de concurrent, remplaçable une fois par période
-- de 30 jours. Sans cette colonne, rien ne distingue « ce concurrent est suivi depuis
-- l'onboarding » de « il a été remplacé hier » : `created_at` décrit la création de la
-- ligne, et setCompetitor met la ligne à jour au lieu d'en créer une nouvelle (les
-- écarts et les relevés y sont rattachés par clé étrangère).
--
-- NULL = l'URL n'a jamais été remplacée depuis l'enregistrement initial. Un premier
-- remplacement est donc toujours autorisé : le délai borne les changements répétés, il
-- ne punit pas une erreur de saisie faite à l'onboarding.

alter table competitors
  add column if not exists url_changed_at timestamptz;

comment on column competitors.url_changed_at is
  'Date du dernier remplacement d''URL. NULL si l''URL n''a jamais changé depuis la création de la ligne.';
