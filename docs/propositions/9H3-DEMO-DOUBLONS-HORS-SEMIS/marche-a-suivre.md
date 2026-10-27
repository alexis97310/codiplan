# 9H3-DEMO-DOUBLONS-HORS-SEMIS — marche à suivre

Les gestes d'Alexis, un à la fois, dans cet ordre. Aucune capture d'écran : ce
lot ne touche aucun écran.

## 1. Lire le plan (lecture seule)

Onglet **Actions** → **DB doublons machine — démonstration** → **Run
workflow**, case **appliquer** DÉCOCHÉE.

Avec le changement de ce lot, le rapport doit maintenant proposer un plan
pour l'intervention `0192f0a0-6000-7000-8000-000000000001` au lieu de
refuser : la ligne gardée sera la plus ancienne des deux (par `cree_le`), et
l'autre sera nommée « hors semis sur une intervention du semis — retirée,
décision du 24/10/2026 ». Lire le rapport en entier avant de passer à l'étape
2 — s'il refuse encore, ou s'il nomme une AUTRE intervention en refus, c'est
un état différent de celui mesuré le 24/10 : s'arrêter et le signaler plutôt
que de continuer.

## 2. Appliquer le plan

Même flux, **Run workflow**, case **appliquer** COCHÉE cette fois. Les
lignes en trop sont retirées, et le script relit aussitôt (même identité
exemptée) qu'aucune intervention ne porte plus d'une machine.

## 3. Débloquer la migration

Onglet **Actions** → **DB resolve** → **Run workflow** : cible
`demonstration`, migration `20260923130000_parcours_1_creer_puis_planifier`.

## 4. Rejouer toutes les migrations jusqu'à la dernière

Onglet **Actions** → **DB migrate & seed** → **Run workflow** : cible
`demonstration`, `reinitialiser_demo` DÉCOCHÉ.

**LE NETTOYAGE (étapes 1-2) VIENT AVANT LE RESOLVE (étape 3), et le RESOLVE
avant ce geste** : lancer « DB migrate & seed » avant d'avoir débloqué la
migration la rejouerait aussitôt et la referait échouer à l'identique.

### Migrations postérieures au 23/09 qui pourraient échouer à leur tour

Lues une à une (18 migrations entre `20260923130000` et `20261023073000`,
celle du jour) pour tout garde-fou `RAISE EXCEPTION` qui vérifierait des
données déjà en base — PAS un garde-fou de mécanisme (`FORCE ROW LEVEL
SECURITY`, qui ne dépend que de l'exécution de la migration elle-même, pas
des données). Mesuré, pas deviné — ces deux migrations ont chacune un garde
qui dépend de la base, et je n'ai pas pu vérifier ce qu'elle y voit (aucune
connexion à une base réelle n'est permise par ce lot) :

- **`20261003090000_tp_cy1_terminer_signature`** (`migration.sql:50-62`) :
  avant de rendre `issue` obligatoire sur `intervention_signature` en
  réputant « signee » toute ligne déjà en base, elle compte les lignes dont
  `image_base64` est NULL ou vide et REFUSE s'il en existe au moins une. Si
  la démonstration porte une signature sans image, cette migration échouera
  à son tour — un blocage NOUVEAU et SANS RAPPORT avec celui de ce lot (les
  doublons `intervention_machine`), à diagnostiquer séparément si le geste 4
  rougit sur son nom.
- **`20261023073000_numerotation_interventions_demandes_9h2`** — celle du
  jour, qui cite déjà elle-même *« exactement l'erreur E23514 mesurée en
  production le 24/10/2026 »* (`migration.sql:203`) comme la raison de sa
  propre prudence (lever puis reposer trois contraintes `NOT VALID` autour de
  son `UPDATE` de rattrapage) : elle est déjà la réparation d'un risque de
  cette famille, pas un risque nouveau. Son seul garde-fou qui lit des
  données (les trois `DO $$` de témoin, `migration.sql:271-301` et
  `363-394`) ne vérifie que l'état des contraintes et de `FORCE ROW LEVEL
  SECURITY` après son propre `UPDATE` inconditionnel — pas le contenu des
  lignes elles-mêmes, donc pas sensible à un état de la démonstration que je
  n'aurais pas mesuré.

Toutes les autres migrations entre les deux (`20260923140000` à
`20261022210000`) n'ont AUCUN `RAISE EXCEPTION` qui dépende du contenu de la
base — soit elles n'en ont aucun, soit leurs `RAISE EXCEPTION` vivent dans le
corps d'un déclencheur redéfini (`journal_audit_tracer`,
`intervention_cycle_de_vie`) qui ne s'exécute qu'sur une écriture FUTURE,
jamais pendant la migration elle-même, soit ils vérifient un mécanisme
(`FORCE ROW LEVEL SECURITY` levé/rétabli) qui ne dépend que du bon
déroulement de la migration, jamais du contenu des lignes.

Si le geste 4 échoue malgré tout, lire le nom de la migration en échec dans
le message : s'il nomme `20261003090000_tp_cy1_terminer_signature`, c'est le
premier risque ci-dessus qui s'est réalisé, et c'est un nouveau ticket, pas
une reprise de celui-ci.
