-- Enrichit le profil avec ce que l'onboarding demande désormais.
--
-- Jusqu'ici le profil ne portait que l'identité du produit (nom, type, secteur, URL).
-- Le comparateur en tirait donc uniquement de quoi aller lire le site. Ces quatre
-- colonnes décrivent la situation du fondateur, ce qui permet de pondérer et de trier
-- les écarts détectés plutôt que de tous les présenter à plat.
--
-- Toutes nullables, sans valeur par défaut : les profils créés avant cette migration
-- n'ont jamais répondu à ces questions. Leur inventer une valeur (« lancé », « freemium »)
-- fabriquerait une donnée que l'utilisateur n'a pas fournie — et le produit ne doit
-- jamais présenter une supposition comme un fait. Le code lit donc ces champs comme
-- « inconnu » tant qu'ils sont à NULL.

alter table profiles
  add column if not exists product_stage text
    check (product_stage in ('idea', 'launched', 'growing', 'mature')),
  add column if not exists pricing_model text
    check (pricing_model in ('freemium', 'free_trial', 'subscription', 'one_time')),
  add column if not exists main_goal text
    check (main_goal in ('acquisition', 'conversion', 'retention', 'pricing')),
  add column if not exists target_customer text;

comment on column profiles.product_stage is
  'Stade du produit déclaré à l''onboarding. NULL = jamais renseigné (profil antérieur à la migration).';

comment on column profiles.pricing_model is
  'Modèle de prix déclaré par le fondateur. Déclaratif : ne remplace pas ce que le comparateur relève sur la page de tarifs, sert à trier les écarts pricing.';

comment on column profiles.main_goal is
  'Objectif principal déclaré. Sert à ordonner les tâches générées à partir des écarts.';

comment on column profiles.target_customer is
  'Cible précise, texte libre (ex : « freelances », « PME 10-50 »). Enrichit la comparaison de positionnement.';
