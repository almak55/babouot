-- ============================================================
-- MIGRATION 61 — Refente : formats, passe et réglages du calcul
-- À exécuter après la migration 60, une seule fois dans Supabase (SQL Editor). Sans danger si relancée.
--
-- Ajoute au catalogue des caractéristiques produit :
--   - format_fini_l_mm / format_fini_h_mm : format fini (rogné) du livre, lu sur la fiche de fabrication ;
--   - passe_pct          : passe ajoutée à la quantité de la commande pour chaque cahier (10 % si vide) ;
--   - rognage_cahier_mm  : surplus de papier par côté d'un cahier à plat avant rognage (5 mm si vide) ;
--   - marge_feuille_mm   : marge perdue sur chaque bord de la feuille imprimée (10 mm si vide).
-- ============================================================

insert into caracteristiques_produit (cle, libelle, type, unite, ordre) values
  ('format_fini_l_mm',  'Format fini (rogné) : largeur',                          'nombre', 'mm', 91),
  ('format_fini_h_mm',  'Format fini (rogné) : hauteur',                          'nombre', 'mm', 92),
  ('passe_pct',         'Passe sur la quantité par cahier',                       'nombre', '%',  93),
  ('rognage_cahier_mm', 'Rognage par côté du cahier à plat',                      'nombre', 'mm', 96),
  ('marge_feuille_mm',  'Marge perdue sur chaque bord de la feuille',             'nombre', 'mm', 97)
on conflict (cle) do nothing;
