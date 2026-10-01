# Atelier Babouot — Logiciel de planification de production

Logiciel interne de planification et gestion de production pour l'atelier
de reliure industrielle (inspiré de ProjeQtor, calé sur la feuille de
planning papier existante).

## Stack

- **Base de données** : Supabase (PostgreSQL)
- **Backend** : Netlify Functions (CommonJS)
- **Front** : HTML/CSS/JS autonome (pas de build step), à terme React CDN
  si besoin d'interactivité plus riche

## Fichiers livrés

### Base de données
| Fichier | Rôle |
|---|---|
| `00_tout_en_un.sql` | **Celui à exécuter** — fusion de tous les scripts ci-dessous, dans l'ordre, idempotent (rejouable sans erreur) |
| `schema_atelier.sql` | Création des tables |
| `seed_referentiels.sql` | Opérations + machines identifiées sur la feuille papier |
| `seed_referentiels_addendum.sql` | Opérations/machine complémentaires découvertes via le fichier personnel (peaux, Intégra) |
| `seed_personnel.sql` | 24 personnes + compétences |
| `migration_2_personnel_machines.sql` | Compétence machine précise (Benoit) + rôle d'encadrement |
| `migration_3_ajustements.sql` | Fabrice en encadrement, Alain compétent sur tout le parc |
| `migration_4_corrections.sql` | Corrections de lecture (Ventura, 3210, CRF, Retour SODIS, Coupe cuir) + Rhodoïds |
| `reset_complet.sql` | À utiliser seulement si vous voulez repartir de zéro (efface tout) |

### Backend (Netlify Functions — dans `netlify-functions.zip`)
| Fonction | Rôle |
|---|---|
| `lecture-planning` | Lecture consolidée (machines, personnel, OF, stocks, planning) pour alimenter le front |
| `charge-machine` | Calcul du taux de charge par machine sur une période |
| `detection-conflits` | Détecte les doubles affectations machine/personnel |
| `alertes-stock` | Matières sous seuil (attention / critique) |
| `ordonnancement` | Planification automatique par priorité + séquencement de gamme |
| `ordonnancement-auto` | Version planifiée (cron) de la fonction ci-dessus, chaque matin en semaine |

### Front
| Fichier | Rôle |
|---|---|
| `atelier-planning.html` | Prototype de démo (données en mémoire, pour visualiser l'ergonomie) |
| `atelier-planning-deploy.html` | Version branchée sur `lecture-planning`, avec repli sur la démo si le backend ne répond pas — à déployer sur Netlify pour fonctionner réellement |

## Mise en route

1. Créer le projet Supabase, exécuter `00_tout_en_un.sql` dans le SQL Editor
2. Récupérer `SUPABASE_URL` et la clé `service_role` (Project Settings > API)
3. Déployer `netlify-functions.zip` (dossier `functions/` + `netlify.toml`) sur Netlify, avec les variables d'environnement ci-dessus
4. Déployer `atelier-planning-deploy.html` sur le même site Netlify
5. Tester `/.netlify/functions/alertes-stock` dans le navigateur pour confirmer le branchement

## Points ouverts / hypothèses à confirmer

- **Dorure — Pléiade / PE-PE** : traités comme deux machines distinctes (par analogie avec BDM/DA sous Montage de couverture), mais pourraient être deux lignes de produit plutôt que deux machines physiques. À confirmer.
- **Code couleur de la feuille papier** (rouge/bleu/vert/orange/rose/jaune) : signification non confirmée. Le champ `couleur_code` existe dans `planning_jour` et `personnel_planning_jour` mais n'est pas encore interprété par l'application.
- **Benoit / machines couverturières** : compétence enregistrée au niveau machine (`personnel_machines`), alors que le reste du personnel est au niveau opération (`personnel_competences`) — cohérent avec son cas particulier, mais à garder en tête si d'autres personnes ont ce genre de spécialisation fine.
- **Avancement (%) des OF** : pas encore stocké en base ; `atelier-planning-deploy.html` l'affiche à 0 pour l'instant.
- **Charge du personnel** : approximée (créneaux planning de la semaine affichée / 5 jours ouvrés) — pas une vraie moyenne glissante, à affiner si besoin d'un chiffre plus précis.

## Prochaines étapes possibles

- Stocker et exploiter l'avancement réel d'un OF (mise à jour depuis l'atelier)
- Interpréter la légende de couleurs une fois sa signification confirmée
- Bascule progressive depuis la feuille papier (une ou deux machines pilotes avant généralisation)
