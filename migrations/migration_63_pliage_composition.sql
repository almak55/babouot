-- ============================================================
-- MIGRATION 63 — Pliage : valeurs calculées d'après la composition du livre
-- À exécuter après la migration 62, une seule fois dans Supabase (SQL Editor). Sans danger si relancée.
-- Permet d'utiliser ces valeurs dans les formules « quantité à traiter » des profils machine ; le calcul des réglages de
-- la plieuse fonctionne même sans cette migration.
-- ============================================================

insert into caracteristiques_produit (cle, libelle, type, unite, ordre) values
  ('pliage_feuilles',     'Feuilles à plier, passe comprise (calculé)',                 'nombre', 'feuilles', 106),
  ('pliage_cahiers',      'Cahiers différents à plier (calculé)',                       'nombre', 'cahiers',  107),
  ('pliage_series',       'Séries de pliage : paginations différentes (calculé)',       'nombre', 'séries',   108),
  ('pliage_ajustements',  'Ajustements de pli : cahiers suivants d''une même pagination (calculé)', 'nombre', 'cahiers', 109),
  ('pliage_series_4',     'Séries de cahiers de 4 pages (calculé)',                     'nombre', 'séries',   110),
  ('pliage_series_8',     'Séries de cahiers de 8 pages (calculé)',                     'nombre', 'séries',   111),
  ('pliage_series_16',    'Séries de cahiers de 16 pages (calculé)',                    'nombre', 'séries',   112),
  ('pliage_series_32',    'Séries de cahiers de 32 pages (calculé)',                    'nombre', 'séries',   113)
on conflict (cle) do nothing;
