-- ============================================================
-- MIGRATION 62 — Refente : piles taquées et piles terminées (valeurs calculées)
-- À exécuter après la migration 61, une seule fois dans Supabase (SQL Editor). Sans danger si relancée.
-- ============================================================

insert into caracteristiques_produit (cle, libelle, type, unite, ordre) values
  ('refente_piles_taquees', 'Piles de feuilles taquées avant la coupe (calculé)',     'nombre', 'piles', 104),
  ('refente_piles_finies',  'Piles coupées terminées, à palettiser (calculé)',        'nombre', 'piles', 105)
on conflict (cle) do nothing;
