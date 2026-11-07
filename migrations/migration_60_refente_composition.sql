-- ============================================================
-- MIGRATION 60 — Refente au massicot droit d'après la composition du livre
-- À exécuter une seule fois dans Supabase (SQL Editor). Sans danger si relancée.
--
-- Ajoute au catalogue des caractéristiques produit :
--   - composition_cahiers : composition exacte du livre (pagination, nombre de cahiers, poses par feuille),
--                           lue sur la fiche de fabrication ou saisie dans le chiffrage ;
--   - feuilles_par_pile   : nombre maximum de feuilles par pile au massicot (500 si vide) ;
--   - refente_coups, refente_piles, refente_feuilles, refente_morceaux : valeurs CALCULÉES d'après la composition
--                           (ne se saisissent pas), utilisables dans les temps standards et les profils machine.
-- ============================================================

insert into caracteristiques_produit (cle, libelle, type, unite, ordre) values
  ('composition_cahiers', 'Composition du livre (cahiers)',                     'texte',  null,      90),
  ('feuilles_par_pile',   'Feuilles maximum par pile au massicot',              'nombre', 'feuilles', 95),
  ('refente_coups',       'Coups de couteau de refente (calculé)',              'nombre', 'coups',    100),
  ('refente_piles',       'Piles passées au massicot droit (calculé)',          'nombre', 'piles',    101),
  ('refente_feuilles',    'Feuilles à refendre (calculé)',                      'nombre', 'feuilles', 102),
  ('refente_morceaux',    'Cahiers à plat obtenus par la refente (calculé)',    'nombre', 'cahiers',  103)
on conflict (cle) do nothing;
