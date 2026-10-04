# 9D2-TESTS-DATES-NOUMEA — passation

## Ce que j'ai changé

Quatre fichiers de test (et un seul, `tests/e2e/setup/scene.ts`, trouvé en
cours de route — voir plus bas), **aucun code applicatif** :

- `tests/isolation/absence.test.ts` — `LUNDI_A_VENIR` était une date EN DUR
  (`2026-10-05`), devenue aujourd'hui le jour même où ce lot tourne :
  l'absence posée dessus était « déjà commencée » et `leverLeBlocage` la
  refusait (D136). Remplacée par un calcul depuis AUJOURD'HUI À NOUMÉA
  (`maintenant`/`jourDe`/`lundiDeLaSemaine`/`jourSuivant` de
  `lib/calendar`) : le lundi de la semaine à J+14, donc toujours au moins
  J+7 devant, quel que soit le jour où le fichier s'exécute. Le second
  foyer, `dansNJours` (describe QT-15), calculait « aujourd'hui » en UTC
  (`setUTCDate`/`toISOString`) alors que `ecourterAbsence` (le code qu'il
  éprouve) le calcule dans le fuseau de la société (`debutDuJourSociete`,
  `lib/interventions/depot.ts`) : entre 00:00 et 11:00 à Nouméa, les deux
  calculs désignaient des jours civils différents. Remplacé par le même
  calcul fuseau-aware.
- `tests/e2e/absences-ecourter-etat.spec.ts` — même défaut UTC sur
  `dansNJours`, et sur `cleDuProchainLundi` (qui pouvait viser le dimanche
  local au lieu du lundi). Les deux relisent désormais `maintenant`/`jourDe`
  dans `Pacific/Noumea` (constante locale au fichier, `tests/` étant exempté
  du gardien `sans-fuseau-en-dur`, comme `vgp-affichage-tpa2.spec.ts` le
  fait déjà).
- `tests/e2e/setup/reperes.ts` — `lundi` se recalculait depuis les
  accesseurs UTC de `Date` (`getUTCFullYear`/`getUTCMonth`/`getUTCDate`)
  plutôt que depuis le fuseau de la société lu en base : entre 00:00 et
  11:00 à Nouméa, il désignait le lundi de la semaine PRÉCÉDENTE.
- `tests/e2e/setup/scene.ts` (`ecrireLaScene`) — **trouvé en vérifiant**,
  pas dans les constats du ticket : exactement le même défaut UTC, dans la
  fonction qui ÉCRIT la scène globale e2e (processus distinct de celui qui
  la RELIT via `reperesDeLaScene`). Après avoir réparé `reperes.ts` seul,
  `pnpm verify:full` a fait tomber 7 épreuves qui déposent sur
  `reperes.lundi` (`affichage-materiel`, `captures-pg-a7-semaine-garde-heure`,
  `planning-annuler-deplacement`, `planning-largeur-et-carte` ×3,
  `planning-semaine-garde-heure`) : la scène écrivait ses lignes sur le
  lundi calculé en UTC (la semaine précédente, entre 00:00 et 11:00 à
  Nouméa) pendant que les épreuves les cherchaient au lundi fuseau-aware —
  deux processus, deux lundis. Réparé à l'identique, en lisant
  `societe.fuseau_horaire` déjà sélectionné par cette même fonction.

**Ce que ça change pour l'exploitation** : rien en production — ces quatre
fichiers sont tous sous `tests/`. Ça évite que la suite tombe toutes les
nuits entre 00:00 et 11:00 heure de Nouméa (la fenêtre où UTC et le jour
civil local divergent), ce qui aurait bloqué `pnpm file` et toute
publication pendant cette fenêtre, pour une raison étrangère au code
qu'un ticket aurait touché.

Liste des 36 spécifications qui lisent `reperes.lundi` (recensées, aucune
modifiée au-delà de `scene.ts`/`reperes.ts` eux-mêmes — elles héritent
simplement d'un repère désormais juste) :
`9cy-tiroir-remise-en-file`, `affichage-materiel`, `avertissements-1`,
`blocage-agenda-visible`, `captures-9co-pg-g14a-transmettre`,
`captures-pg-a7-semaine-garde-heure`, `captures-pg-b2-fenetre-pose`,
`captures-pg-b4-survol-cases`, `captures-pg-b5-annuler-deplacement`,
`captures-pg-c2-file-onglets`, `captures-pg-c3-cartes-colonnes`,
`captures-pg-c4-charge`, `captures-pg-c5-tiroir`,
`captures-pg-c6-filtres-aujourdhui`, `captures-pgd2-deux-semaines`,
`captures-pgd3-mois-charge`, `captures-pgd4-telephone-onglets`,
`captures-pgd5-creer-ici`, `ergo-carte-semaine`, `glisser-deposer`,
`pg-g14a-transmettre`, `pg-g14b-transmettre-groupe`, `planning-6`,
`planning-annuler-deplacement`, `planning-creer-ici`,
`planning-deux-semaines`, `planning-fenetre-pose`,
`planning-file-onglets`, `planning-filtres-aujourdhui`,
`planning-jour-frise`, `planning-largeur-et-carte`,
`planning-mois-charge`, `planning-semaine-garde-heure`,
`planning-survol-cases`, `planning-telephone-onglets`, `planning-tiroir`.

## Ce que j'ai mesuré (AVANT/APRÈS)

**Repro initiale**, sur `696ec5dd`, à 00:34 heure de Nouméa (04/10 13:34 UTC) :

- `CI=1 pnpm exec vitest run tests/isolation/absence.test.ts` : **2 échecs
  sur 25** — exactement A (« LEVER LE BLOCAGE NE REND PAS LES CRÉNEAUX »,
  `levee.accepte` attendu `true`, reçu `false`) et B (« ÉCOURTER une absence
  EN COURS, fin = aujourd'hui — accepté », `resultat.accepte` attendu
  `true`, reçu `false`). Conforme aux constats du ticket.

**Après réparation de `absence.test.ts`** :

- Même commande : **25/25 verts**.

**Après réparation de `absences-ecourter-etat.spec.ts`**, à 00:41 Nouméa
(toujours dans la fenêtre à risque) :

- `CI=1 pnpm exec playwright test tests/e2e/absences-ecourter-etat.spec.ts` :
  **8/8 verts** (1,2 min).

**Après réparation de `reperes.ts`, premier `verify:full` complet**, lancé à
00:47 Nouméa (04/10 13:47 UTC) :

- `format:check`, `typecheck`, `lint`, `test` (3974 tests), `test:isolation`
  (1395 tests), `build`, `feries:horizon`, `audit:partitions` : tous verts.
- `test:e2e` : **7 échecs / 852 passés / 7 sautés / 4 non exécutés** (36,9
  min) — les 7 décrits ci-dessus (section « Ce que j'ai changé »), tous sur
  des locators absents, tous datés `data-depot-jour="2026-10-07"` (le
  mercredi de LA SEMAINE ATTENDUE par l'épreuve, absent de la base parce
  que la scène l'avait écrit un lundi différent).

**Après réparation de `scene.ts`**, re-mesuré ciblé à 01:30 Nouméa (toujours
dans la fenêtre 00:00–11:00) :

- Les 5 fichiers en cause (`affichage-materiel`,
  `captures-pg-a7-semaine-garde-heure`, `planning-annuler-deplacement`,
  `planning-largeur-et-carte`, `planning-semaine-garde-heure`), 24 tests :
  **24/24 verts** (2,4 min).

**`verify:full` complet, second passage**, lancé à 01:32 Nouméa (04/10
14:32 UTC), toujours dans la fenêtre à risque :

- Toutes les étapes vertes jusqu'à `test:e2e` compris : **863 passés, 7
  sautés, 0 échec** (34,8 min). Les 7 sautés sont pré-existants et sans
  rapport avec ce lot — gates `test.skip` sur `CAPTURES_TPA6`/`CAPTURES_9BV`
  (variables d'environnement absentes) dans `captures-tpa6.spec.ts`,
  `captures-9bv-dates-reprise.spec.ts`, et une résolution d'écran dans
  `tous-les-ecrans-rendent.spec.ts`. Vérifié en lisant les trois
  `test.skip(...)` : aucun des trois n'a de rapport avec une date.

## Ce que j'ai tranché et pourquoi

- **Calcul via `lib/calendar/fuseau.ts` et `lib/calendar/semaine.ts`
  partout**, jamais une réécriture locale de l'arithmétique de date : ce
  sont les mêmes fonctions que le code applicatif qu'ils éprouvent
  (`debutDuJourSociete`, `lundiDeLaSemaine`), donc le même défaut ne peut
  plus réapparaître en divergeant d'une ligne.
- **`LUNDI_A_VENIR` à J+14 (lundi de la semaine), pas J+7 strict** : une
  marge confortable plutôt qu'un calcul au plus juste, pour éviter un
  nouveau cas limite si ce fichier est relu dans plusieurs mois sans qu'on
  y repense.
- **`FUSEAU_NOUMEA` en dur dans `absences-ecourter-etat.spec.ts`** plutôt
  que de relire `societe.fuseau_horaire` en base avant d'écrire la scène
  du fichier : ce fichier a sa PROPRE scène, fixée sur `CODIMA-NC`
  (commentaire de tête), et `tests/` est explicitement exempté du gardien
  `sans-fuseau-en-dur` — exactement le même choix que
  `tests/e2e/vgp-affichage-tpa2.spec.ts` fait déjà pour la même raison.
- **`scene.ts` réparé alors qu'il n'était pas dans les constats du
  ticket** : je l'ai trouvé parce que `verify:full` l'a fait rougir après
  ma réparation de `reperes.ts` seul — les deux fichiers portent le MÊME
  calcul en double (un qui écrit, un qui relit, dans deux processus
  distincts, comme le dit le docblock de `reperes.ts`), et réparer l'un
  sans l'autre les met en désaccord plutôt que de les accorder. Les deux
  sont donc réparés à l'identique.

## Ce que je n'ai pas fait

- Aucune ligne de code applicatif touchée — ni `lib/`, ni `app/`, ni
  migration, ni semis.
- Aucune assertion changée, aucun `skip`/`fixme`, aucun `retries` ou
  `workers` modifié.
- Je n'ai PAS touché `tests/isolation/absence.test.ts:381` ni `:814`
  (`bloquer("2026-10-05", "2026-10-09")`, hors du scénario de levée) ni
  `tests/isolation/occupation-absences.test.ts:180` (même couple de
  dates) : vérifié que ces trois declarations ne passent JAMAIS par
  `leverLeBlocage`/`ecourterAbsence` (les deux seules fonctions qui jugent
  « a_venir »/« aujourd'hui ») — elles ne servent qu'à poser une fenêtre
  disjointe d'une autre, et `declarerAbsence` n'a aucune contrainte sur le
  passé. Rien n'y vieillit.
- Balayage `grep -rn '2026-1[0-2]-\|2026-09-' tests/` : passé en revue
  toutes les dates d'octobre 2026 trouvées dans `tests/`. Celles qui
  restaient (`intervention-pause.test.ts`, `suspension.test.ts`,
  `avertissements-reaffectation.test.ts`, `avertissements-transmission.test.ts`,
  `parc-du-technicien.test.ts`, des unitaires de `avertissements/composition`
  et `interventions/cycle-de-vie`…) sont soit des fixtures pures passées en
  PARAMÈTRE à une fonction qui ne lit jamais l'horloge (le motif « DATES-1 »
  documenté dans `lib/interventions/depot.ts` autour de `enAttenteDePiece`),
  soit des couples de dates disjoints sans rapport avec « aujourd'hui ».
  Vérifié un par un en lisant le code appelé (`horizonDepasse`,
  `declarerAbsence`), pas seulement le nom du test. Non touchées.
- Les épreuves e2e à marge large et volontairement fuseau-indépendante
  (`equipe-1.spec.ts` : ±3/±10/−10 jours, documenté « indépendante de tout
  fuseau » ; `fiche-intervention.spec.ts`, `deplacer-valeurs-prereplies.spec.ts`,
  `pg-a3b-heure-obligatoire.spec.ts`, `captures-pg-a3b-heure-obligatoire.spec.ts`,
  `captures-pg-a3a-messages-pose.spec.ts` : +21 à +42 jours, documenté « loin
  de toute fenêtre ») ne sont PAS de la même famille que le bug réparé ici :
  elles n'exigent jamais un jour-de-semaine exact, seulement « loin dans le
  futur », et une marge d'un jour ne les fait jamais basculer. Non touchées.
- Je n'ai pas relancé `verify:full` une troisième fois après la passation :
  le second passage (34,8 min, 0 échec) est la preuve retenue.

## Pièges pour la session suivante

- **Un repère de date e2e qui vit dans DEUX processus (écriture/lecture)
  doit être réparé aux DEUX bouts, jamais un seul.** `reperes.ts` (lecture,
  par scénario) et `scene.ts` (écriture, globale) portaient le même calcul
  UTC copié-collé ; ne réparer que l'un des deux les mettait en désaccord
  plutôt que d'accord, et seul `verify:full` complet (pas l'épreuve ciblée
  du ticket) l'a révélé. Avant de toucher un calcul de date commun à un
  couple écriture/lecture, `grep` l'autre bout.
- **La fenêtre 00:00–11:00 heure de Nouméa (13:00–00:00 UTC la veille) est
  le moment où cette classe de défaut se manifeste.** Si une session future
  voit `verify:full` rougir sur des locators absents un jour précis
  (`data-depot-jour`, `data-bloc`…) sans changement de code applicatif,
  vérifier l'heure de Nouméa en premier.
- **`tests/` est exempté du gardien `sans-fuseau-en-dur`** — poser
  `Pacific/Noumea` en dur dans un fichier de test (comme
  `vgp-affichage-tpa2.spec.ts` le fait déjà) est un choix légitime quand le
  fichier a sa propre scène fixée sur `CODIMA-NC`, et évite de relire la
  société en base juste pour connaître son fuseau.
- Ce lot a tourné ENTIÈREMENT dans la fenêtre à risque (00:34 à 01:32-ish
  heure de Nouméa) — c'est une chance pour la reproduction (A et B se sont
  reproduits du premier coup), mais ça veut dire que je n'ai PAS pu
  observer ce fichier tourner après 11:00 Nouméa pour confirmer qu'il
  redevient vert « pour la bonne raison » plutôt que par heureux hasard.
  La correction ne dépend plus de l'heure d'exécution (elle lit le fuseau
  partout), donc ce n'est pas bloquant, mais c'est une case que je n'ai
  pas pu cocher moi-même.

## Ce qui reste à faire

Rien d'identifié dans le périmètre de ce lot. `pnpm verify:full` est vert
(863 passés, 7 sautés pré-existants, 0 échec), aucune régression
introduite, aucune dette connue laissée par ce lot.
