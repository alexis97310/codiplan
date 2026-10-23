# 9H1D — débloquer la migration 9H2, sur la production puis sur la démonstration

Écrit le 24/10/2026. Deux bases sont en retard, chacune bloquée par une
migration différente — pas la même — et les deux suivent le MÊME enchaînement
en trois gestes : `DB resolve` (lui débloque, n'applique rien), puis
`DB migrate & seed` (lui applique), puis un contrôle. Rien n'est automatique :
les deux flux ne portent que `workflow_dispatch`
(`.github/workflows/db-resolve.yml:20`, `.github/workflows/db-migrate.yml:45`).

## (a) PRODUCTION — bloquée sur `20261023073000_numerotation_interventions_demandes_9h2`

Mesuré le 24/10/2026 vers 07 h 50 : `main` = `bf339c30b`, 9H1
(`20261022210000_rapport_valide_avant_cloture`) est APPLIQUÉE, 9H2 a ÉCHOUÉ en
`23514` sur `intervention_planifiee_a_sa_duree` et n'a rien laissé derrière
elle (la transaction de la migration s'est entièrement annulée) — c'est
exactement l'état que `resoudre-migration.mts` accepte de résoudre
(`scripts/resoudre-migration.mts:61-65`, « n'a appliqué AUCUNE étape »).

1. **Fusionner d'abord** le correctif de ce lot sur `main` (les deux commits
   `9H1D-MIGRATION-9H2-SUR-PRODUCTION`) — sans lui, « DB migrate & seed »
   rejouerait la migration AU MÊME ÉTAT et échouerait à l'identique.
2. **Lancer « DB resolve »** (`.github/workflows/db-resolve.yml`) :
   - `cible` : **production** (`.github/workflows/db-resolve.yml:22-29`) ;
   - `migration` : `20261023073000_numerotation_interventions_demandes_9h2`,
     le nom EXACT du répertoire (`.github/workflows/db-resolve.yml:37-39`) —
     c'est la confirmation, il n'y a pas de défaut.
   Le job imprime l'historique, constate que 9H2 est seule en échec et n'a
   rien appliqué, la déclare `--rolled-back`, puis l'imprime une seconde fois
   et REFUSE de conclure si une migration reste en échec
   (`scripts/resoudre-migration.mts:81-91`). Son dernier message nomme déjà
   le geste suivant (`scripts/resoudre-migration.mts:93-97`).
3. **Lancer « DB migrate & seed »** (`.github/workflows/db-migrate.yml`) :
   - `cible` : **production** ;
   - `reinitialiser_demo` : **décoché** (`.github/workflows/db-migrate.yml:72-76`,
     défaut `false`) — ce booléen purge les données de DÉMONSTRATION
     (`docs/decisions/2026-08-20-purge-des-donnees-de-demonstration.md`) et
     n'a RIEN à faire sur la production ; l'étape de purge porte d'ailleurs
     sa propre garde `cible != 'production'`
     (`.github/workflows/db-migrate.yml:271`), qui l'empêche de s'exécuter là
     même si la case était cochée par erreur.
   9H2 corrigée s'applique, suivie de toute migration plus récente déjà sur
   `main`.
4. **Redéployer `main` sur Vercel.** La production tournait sur `46bd5276`
   (bien avant 9H1) : tant que le code n'avance pas, l'écran de clôture ne
   sait pas appeler `enregistrerValidationRapport`, et aucune clôture n'est
   possible même une fois la base à jour.
5. **Contrôler `/api/sante`** : `migrations.ok` doit valoir `true`, et le
   commit annoncé doit être celui qui vient d'être déployé (le contrôle
   refuse de conclure sur un commit qu'il ne reconnaît pas — voir
   `pnpm deploiement:verifier`, CLAUDE.md §4).

## (b) DÉMONSTRATION — bloquée sur sa propre migration en échec

La démonstration suit un historique séparé et peut être bloquée par une
AUTRE migration que 9H2 (probablement 9H1, voire une migration plus récente
si elle a reçu des lots que la production n'a pas encore). **Ne pas supposer
le nom : le lire.**

1. Ouvrir « DB resolve », `cible` : **demonstration**, SANS saisir de
   `migration` encore — ou lire d'abord le journal du run précédent de
   « DB migrate & seed » sur `demonstration`, qui nomme la migration en échec
   dans son erreur `P3018`. Le script de résolution imprime de toute façon
   l'historique complet en tête de sortie
   (`scripts/resoudre-migration.mts:48-52`) : relancer en lisant ce journal
   suffit à connaître le nom exact à saisir au second essai.
2. **Lancer « DB resolve »**, `cible` : **demonstration**, `migration` : le
   nom lu à l'étape précédente.
3. **Lancer « DB migrate & seed »**, `cible` : **demonstration**,
   `reinitialiser_demo` : **décoché** — cocher sèmerait les deux sociétés de
   démonstration (CLAUDE.md §4, `pnpm db:seed`, « DÉMONSTRATION UNIQUEMENT »),
   ce qui n'est pas le geste demandé ici : on débloque l'historique, on ne
   repart pas d'une base vide.
4. **Contrôler `/api/sante`** sur la démonstration, même critère qu'en (a).

## Ce que ce lot NE fait PAS

Il ne lance aucun de ces deux flux : ce sont des `workflow_dispatch`, et
« COMMITE D'ABORD. VÉRIFIE ENSUITE. N'ATTENDS JAMAIS » (ce ticket) n'autorise
pas à les déclencher depuis une session non interactive. Ce document NOMME
le geste ; un humain le joue et le regarde — même doctrine que
`pnpm deploiement:verifier` (CLAUDE.md §4).
