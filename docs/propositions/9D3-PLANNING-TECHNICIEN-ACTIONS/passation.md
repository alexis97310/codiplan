# 9D3-PLANNING-TECHNICIEN-ACTIONS — passation

## Ce que j'ai changé

Le commit `dfb169ea` (9DKA-REPRISE-9DK) avait fermé, côté SERVEUR, le ○ que
le technicien porte sur `modifier_planning` pour cinq routes d'écriture
(`/api/interventions/[id]/deplacer`, `.../note-interne`, `.../transmettre`,
`app/api/interventions/transmettre`, `.../verdict-pose`) : elles exigent
désormais `exigerCapaciteComplete`. Les ÉCRANS n'avaient pas suivi :

- `app/(back-office)/planning/page.tsx` lisait `peut(role, "modifier_planning")`
  pour afficher la mention « Glisser-déposer pour réaffecter », les
  commandes « Transmettre demain » / « Transmettre toutes les planifiées
  prêtes », la liste des laissées, et pour composer `peutCreerIci`
  (« + Créer ici ») ;
- `app/api/interventions/[id]/resume/route.ts` (qui nourrit le tiroir,
  `components/planning/tiroir.tsx`) lisait la même `peut`, pour afficher
  « Poser… » et « Transmettre au technicien ».

Un technicien connecté par l'écran voyait donc ces gestes, et chacun se
terminait en refus serveur silencieux au premier clic (contraire à D131/D-06).

**Correction** : ces lectures passent à `peutPleinement(role,
"modifier_planning")`. Une variable à part, `peutDeclarerAbsence` (en
`peut`, pas `peutPleinement`), garde ouvert le SEUL lien que ce ○ doit
continuer de servir — « Déclarer une absence » (`LienDeclarerAbsence`), sur
la ligne du technicien dans `/planning`. Le prop auparavant mal nommé
`peutModifierLePlanning` qu'on passait à `VueSemaine`/`VueJour` (et qui n'y
servait QUE pour ce lien) est renommé `peutDeclarerAbsence` pour que le nom
dise ce qu'il protège.

Pour l'exploitation : un technicien qui ouvre `/planning` ou le tiroir d'une
intervention ne voit plus de bouton qu'il ne peut pas actionner ; il garde
« Ouvrir la fiche » (lecture) et « Déclarer une absence » (son seul geste
d'écriture sur ce périmètre).

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

Mesuré par lecture de code (étape 1 du ticket) puis par un scénario
Playwright dédié (`tests/e2e/planning-technicien-actions-refusees.spec.ts`),
rejoué une fois sur le code AVANT (captures `avant-*`, échec attendu de ses
propres assertions — mesuré en désactivant temporairement les assertions
dans une copie jetable du spec, jamais commitée) et une fois sur le code
APRÈS (captures `apres-*`, vert) :

- **Le technicien PEUT ouvrir `/planning` et le tiroir** — `consulter_planning`
  lui accorde un ○ (restreint à sa propre ligne), et aucun redirect ne l'en
  écarte ; ce n'était donc pas un point d'arrêt (l'étape 3 du ticket
  s'applique).
- **AVANT** (`avant-technicien-tiroir-1280.png`) : le sous-titre affiche
  « Glisser-déposer pour réaffecter », la rangée de commandes affiche
  « Transmettre demain (4) », et le tiroir affiche « Transmettre au
  technicien » et « Poser… ».
- **APRÈS** (`apres-technicien-tiroir-1280.png`) : la mention a disparu, la
  commande « Transmettre demain » a disparu, le tiroir ne montre plus que
  « Ouvrir la fiche ».
- **ADV**, avant et après : aucun changement (`avant-adv-*` /
  `apres-adv-*` sont identiques aux yeux d'un humain) — l'ADV garde tout.
- Captures à 375 px (`*-planning-375.png`) : la grille et le tiroir ne sont
  jamais rendus sous `lg` (liste lecture seule) — rien à y re-mesurer.

## Ce que j'ai tranché, et pourquoi

- **`peutDeclarerAbsence` est une variable À PART**, jamais une relecture de
  `peutPleinement` inversée : c'est littéralement ce que TR-5/D136 ont
  tranché (le ○ existe PAR CONCEPTION pour ce seul geste), et le nommer
  distinctement est ce qui évite qu'un futur geste s'y accroche par erreur
  (le même risque que ce ticket corrige).
- **Pas de nouvelle décision D** — j'applique D131 (un geste affiché qu'un
  rôle ne peut pas accomplir ne s'affiche pas), D-06 (l'écran n'offre que ce
  que le serveur accepte) et TR-5/D136 (le périmètre exact du ○). Aucun cas
  rencontré n'est resté sans réponse dans ces textes.
- **`PORTE_COMPLETE` (tests/unit/auth/porte.test.ts) reçoit les 7 routes**
  déjà passées à `exigerCapaciteComplete` par 9DK/9DKA — elle ne les listait
  pas encore, ce qui aurait laissé un retour à `exigerCapacite` simple
  invisible au gardien statique qui vérifie « ces routes appellent la porte
  complète, jamais la simple ». Le compte passe de 14 à 21.
- **Trois tests unitaires qui simulaient la porte** (`deplacer-refus-saisie`,
  `transmettre-compte-rendu-route`, `transmettre-trace-erreur`) faisaient
  répondre un contexte ADV identique à `exigerCapacite` ET
  `exigerCapaciteComplete` — un retour de la route à la porte simple serait
  passé inaperçu puisque les deux mocks auraient renvoyé le même contexte.
  Chacun reçoit un cas où `exigerCapacite` répondrait un contexte TECHNICIEN
  (acceptable) et `exigerCapaciteComplete` répond `null` (refusé) : si la
  route revient un jour à `exigerCapacite`, ce cas rougit.
- **Scène e2e dédiée, jour 112** (16 semaines, multiple de 7 — reste un
  mardi), cinq multiples de 7 après le plus grand déjà réservé
  (105, `planning-cibles-375.spec.ts`) ; le jour 113 (vide) sert de case
  pour « + Créer ici ». Identité technicien RÉELLE du semis
  (`reperes.technicienDucos` = `garnier@codima.test`), pas un compte créé à
  la volée — évite l'enrôlement MFA d'un compte neuf, même moyen que
  `porte-capacites.spec.ts`.
- **Les assertions "+Créer ici"/tiroir/mention sont faites à 1280 px
  seulement** : ces trois gestes ne vivent QUE dans la grille (`CasePosable`,
  rendue à partir de `lg`) — sous `lg`, `/planning` bascule sur une liste
  lecture seule qui ne les a jamais portés (voir le commentaire au-dessus de
  `ListeJour`, `page.tsx`). Les captures à 375 px existent (exigées par le
  ticket) mais ne répètent pas des assertions qui n'auraient rien à y
  mesurer.
- **La commande groupée "Transmettre toutes les planifiées prêtes" et la
  liste des laissées ne sont PAS testées séparément en e2e** : elles
  partagent la MÊME variable (`peutModifierLePlanning`, désormais en
  `peutPleinement`) que la mention et « Transmettre demain », déjà mesurée.
  Construire une scène « planifiée prête pour demain » aurait ajouté de la
  complexité (fuseau, calendrier d'agence) sans éprouver un chemin de code
  distinct de celui déjà couvert.

## Ce que je n'ai PAS fait

- **Je n'ai pas touché au glisser-déposer natif (`draggable`) de
  `CasePosable`/`BlocPosable`** (`components/planning/pose.tsx`) : le geste
  HTML5 reste physiquement possible pour un technicien (il atterrirait sur
  un refus serveur au dépôt, comme avant toute capacité). Ce n'est cité dans
  aucun des quatre constats du ticket, et le désactiver aurait changé un
  comportement hors périmètre sans décision D à l'appui — à signaler si
  jugé nécessaire.
- Aucune migration, aucune ligne de semis, aucun prix — conforme aux
  interdits du ticket.
- Je n'ai pas écrit de nouvelle décision D : les trois cas rencontrés
  (accès du technicien à `/planning`, portée de `peutDeclarerAbsence`,
  compte de `PORTE_COMPLETE`) découlent tous de D131/D-06/TR-5 déjà
  tranchées.

## Pièges pour la session suivante

- **Deux éléments identiques dans le DOM à 1280 px** portent le même
  `data-tiroir-declencheur` (la carte de la grille et sa doublure de liste
  `lg:hidden`, `data-carte-liste`) : un `locator(...)` simple lève une
  violation de mode strict. Utiliser `:visible` (voir
  `ouvrirLeTiroir` dans le nouveau spec), jamais `.first()` seul — l'ordre
  DOM n'est pas garanti.
- **« Déclarer une absence » apparaît une fois PAR TECHNICIEN** visible à
  l'écran : un ADV (périmètre complet) en voit plusieurs — scoper par
  `href*="utilisateur_id=..."`, jamais par le seul nom du lien.
- Le port de la base e2e locale a changé depuis la dernière mesure connue
  (`E2E_DATABASE_URL` sur `127.0.0.1:5442`, pas `5433` comme noté
  précédemment pour ce poste) — vérifier l'environnement avant de supposer
  l'ancien port.
- **`pnpm verify:full` régénère les captures PNG de dizaines d'autres
  tickets** (tout le dossier `tests/e2e/` tourne) : après l'avoir lancé,
  `git status` liste des fichiers étrangers au lot — je les ai restaurés
  (`git checkout --`) pour les fichiers suivis, et laissé intacts les
  fichiers neufs d'autres tickets (pas à moi de les committer ni de les
  supprimer). Toujours vérifier `git status --porcelain` avant de committer
  pour ne prendre QUE son propre dossier `docs/propositions/<TICKET>/` et
  son propre spec.

## Ce qui reste à faire

- Rien d'identifié dans le périmètre de ce ticket. Le glisser-déposer natif
  resté actif pour un technicien (voir « Ce que je n'ai PAS fait ») est le
  seul point ouvert, à trancher si jugé nécessaire.

## Reprise 9D3A

Ce lot avait fini (session 04:19-06:00) puis a été recalé à 06:39 par un
CONFLIT au rebase sur `main` — `9D1A-REPRISE-9D1` avait publié `0acadfc5` à
06:01 pendant la vérification de 9D3. 1er recalage, non imputable au lot.
Le travail complet dormait sur la branche locale
`9D3-PLANNING-TECHNICIEN-ACTIONS-garde` (deux commits : `fa087d25` puis
`8e4f5727`).

- **Rejeu** : `main` étant déjà occupée par un autre worktree, le rejeu
  s'est fait sur une branche neuve `9D3A-REPRISE-9D3` partie d'`origin/main`
  (dd53a36b), même schéma que 9DHA-REPRISE-9DH / 9DJB-REPRISE-9DJ /
  9DKA-REPRISE-9DK. `git cherry-pick` des deux commits dans l'ordre, sans
  force-push, sans toucher à la branche garde.
- **Le seul conflit** : `tests/unit/auth/porte.test.ts`. Entre le moment où
  la garde avait écrit son test (compte figé
  `expect(PORTE_COMPLETE.length).toBe(21)`) et la publication de
  `9D1A-REPRISE-9D1`, `main` avait ajouté R2 (addendum 9DN, relecture 9DX) :
  un test qui vérifie que chaque route de `PORTE_COMPLETE` existe parmi les
  routes analysées, **remplaçant explicitement** — son propre commentaire le
  dit — le compte écrit à la main, au motif précis que « chaque lot qui
  étend `PORTE_COMPLETE` (9D3 lui ajoute 7 routes) aurait fallu rouvrir pour
  le corriger ». Ce n'était donc pas un conflit de sens (D131/D-06/TR-5/D136
  intacts) : j'ai gardé le tableau `PORTE_COMPLETE` complet (14 routes de
  `main` + les 7 de 9D3, recompté : **21**) et le test R2 de `main`, retiré
  le test à compte figé de la garde devenu redondant avec ce que R2 fait
  déjà, à la fois mieux et sans jamais se rouvrir.
- **`pnpm verify:full` : vert au premier passage**, aucune épreuve rejouée.
  Fin du passage (Nouméa UTC+11) : 2026-10-05 09:23:44 — soit 2026-10-04
  22:23:44 UTC. `format:check`, `typecheck`, `lint`, `test`, `test:isolation`
  et `build` ont nécessairement réussi (chaîne `&&` de `pnpm verify`) puisque
  `test:e2e` a tourné jusqu'au bout : 885 passed, 7 skipped, 0 failed.
- **Captures** : les 12 captures AVANT/APRÈS déjà commitées par la garde
  (technicien et ADV, 375 et 1280 px) sont ressorties intactes du
  cherry-pick — aucun fichier modifié dans leur dossier. L'écran n'a pas
  bougé depuis la session originale (même code rejoué à l'identique), donc
  aucune régénération d'APRÈS n'était nécessaire.
- **Effet de bord attendu, déjà documenté dans ce fichier** : `verify:full`
  a de nouveau régénéré des PNG de dizaines de tickets étrangers (fichiers
  suivis modifiés, et quelques captures neuves non suivies dans
  `9D3-PLANNING-TECHNICIEN-ACTIONS/captures/` elles-mêmes —
  `adv-planning-*.png`, `technicien-planning-*.png`,
  `technicien-tiroir-*.png`, écrites par `capturer()` dans le spec e2e lui-
  même, sans rapport avec les fichiers `avant-*`/`apres-*` commités). Fichiers
  suivis restaurés par `git checkout --`, fichiers neufs non suivis
  supprimés (artefacts de test, régénérés à chaque exécution, aucune perte).
  Rien de tout cela n'a été commité.
