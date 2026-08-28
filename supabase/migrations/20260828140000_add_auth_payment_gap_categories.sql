-- Ouvre deux catégories d'écart : les moyens de connexion et les moyens de paiement.
--
-- Jusqu'ici le comparateur ne relevait que le pricing, le positionnement, les avis et la
-- présence sociale. Or deux frictions très concrètes se lisent aussi sur des pages
-- publiques : proposer « continuer avec Google » quand le concurrent le propose et pas
-- toi, et afficher trois moyens de paiement là où il en affiche six.
--
-- La contrainte est remplacée et non étendue en place : Postgres ne sait pas modifier un
-- CHECK, il faut le supprimer puis le recréer. Les valeurs existantes restent valides,
-- aucune ligne n'est touchée.

alter table detected_gaps
  drop constraint if exists detected_gaps_category_check;

alter table detected_gaps
  add constraint detected_gaps_category_check
  check (category in ('pricing', 'positioning', 'reviews', 'social_presence', 'auth', 'payment'));

comment on column detected_gaps.category is
  'Famille de l''écart. auth = moyens de connexion observés sur la page de connexion publique ; payment = moyens de paiement affichés publiquement (jamais ce qui se passe derrière un tunnel authentifié).';
