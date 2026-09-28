# 9AZ-AA-G2-REFUS-SERVEUR — passation

Ticket regroupé, deux parties, faites dans l'ordre : AA-2-REFUS-SITES puis AA-6-REFUS-CREATION.
Commits : `ba6e9f9` (AA-2) et `928bdc2` (AA-6). `CI=1 pnpm verify:full` joué UNE SEULE FOIS, en entier,
au premier plan, après la dernière partie : format:check, typecheck, lint, `pnpm test` (293 fichiers,
3058 tests), `pnpm test:isolation` (129 fichiers, 1254 tests), build, feries:horizon, audit:partitions
tous verts. `pnpm test:e2e` : **499 passed, 3 skipped, 2 failed** — les deux échecs sont dans un fichier
ÉTRANGER au territoire de ce ticket (`tests/e2e/planning-largeur-et-carte.spec.ts`), et leur cause est
détaillée sous « Le conflit non résolu », plus bas : ils ne viennent pas de ce lot.

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

**AA-2.** `creerSite` refuse désormais de rattacher un site à une agence inactive
(`site.refus.agence_inactive`). `modifierSite` refuse le PASSAGE vers une agence inactive différente de
celle déjà posée, mais accepte le MAINTIEN du rattachement actuel même s'il est devenu inactif depuis —
le formulaire de fiche renvoyant toujours `agence_id`, refuser tout `agence_id` inactif aurait empêché
d'enregistrer n'importe quel autre champ sur une fiche déjà rattachée à un établissement fermé après
coup. L'import (`creerSitesEnLot`, `modifierSiteDans`) n'est pas concerné : ces deux fonctions bas
niveau ne portent aucun contrôle, avant comme après ce ticket. Pour l'exploitation : on ne peut plus
créer un NOUVEAU site sur un établissement fermé, ni en rattacher un EXISTANT à un établissement fermé ;
un site déjà rattaché avant la fermeture continue de s'enregistrer normalement.

**AA-6.** `creerIntervention` et `deposerDemande` refusent la création quand le site visé dépend d'une
agence inactive (`intervention.refus.agence_inactive`, `demande.refus.agence_inactive`), juste après le
contrôle `agence_id === null` déjà en place. `planifierLObservation` (VGP) hérite du refus sans code
propre, puisqu'elle appelle `creerIntervention` en interne. Pour l'exploitation : un `site_id` posté
directement (formulaire, VGP) sur un lieu dont l'établissement a fermé après coup ne fait plus naître
d'intervention ni de demande — le message dit de rattacher d'abord le lieu à un établissement actif. La
reprise d'archive (`creerInterventionsRepriseEnLot`) n'est PAS concernée : une intervention reprise
décrit un fait passé, et un établissement aujourd'hui fermé ne rend pas fausse une visite qui a eu lieu
quand il était encore ouvert.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- **AA-2** : `tests/isolation/sites-agence-inactive.test.ts` (6 scénarios neufs, préfixe `AA2-`) —
  création refusée sur agence inactive, création acceptée sur agence active (témoin), passage refusé,
  maintien accepté, et les deux témoins d'import (`creerSitesEnLot`, `modifierSiteDans`) acceptés sans
  contrôle. 6/6 verts, isolément et dans la suite complète (129 fichiers, 1254 tests, 0 échec).
- **AA-6** : `tests/isolation/refus-creation-agence-inactive.test.ts` (6 scénarios neufs, préfixe
  `AA6-`) — témoin `creerIntervention` accepté sur agence active, refusé sur agence inactive ; témoin
  `deposerDemande` accepté/refusé de même ; `planifierLObservation` refusée (même motif) ; témoin de la
  reprise d'archive acceptée sans contrôle. 6/6 verts. Captures du bandeau de refus sur `/interventions/
  nouvelle`, à 1280 et 375 px, dans `docs/propositions/AA-6-REFUS-CREATION/captures/` — site
  `AA6CAP-Client — AA6CAP-Site` forgé directement en base (agence créée `actif=false`), toujours
  proposé par le sélecteur puisque `RG-PLA-08` ne filtre que sur le client actif : c'est précisément ce
  qui rend ce refus SERVEUR nécessaire et pas seulement un menu qui filtrerait l'agence.
- **`CI=1 pnpm verify:full`**, une seule exécution, en entier : détail des trois lignes vertes et des
  deux rouges sous « Le conflit non résolu ».

## Ce que j'ai tranché et pourquoi

- **Le contrôle vit dans `creerSite`/`modifierSite`, jamais dans `creerSiteDans`/`modifierSiteDans`**
  (constat du ticket) : les fonctions « Dans » sont le chemin bas niveau qu'emprunte l'import, et
  l'import doit continuer d'accepter une agence inactive pour une archive.
- **`modifierSite` relit la fiche AVANT d'écrire, pour comparer l'ancien et le nouveau `agence_id`** :
  sans cette lecture, impossible de distinguer « rattacher à une agence inactive » (refusé) de « garder
  le rattachement actuel devenu inactif » (accepté) — la même distinction que D134 avait déjà tranchée
  pour le menu de `/sites/[id]`.
- **`creerSite` et `modifierSite` gagnent un paramètre `client?: PrismaClient` facultatif**, comme
  toutes les autres fonctions de `lib/sites/depot.ts` sauf ces deux-là (incohérence antérieure au
  ticket) : sans lui, aucun scénario d'isolation ne peut les appeler sous le rôle applicatif restreint
  de la base de test — la seule façon de mesurer le refus par la fonction réellement exposée aux routes,
  plutôt que par un raccourci écrit pour l'occasion.
- **Les messages composent « lieu » et « établissement », jamais « site »/« agence » en toutes
  lettres** (§9, D5/D47) : `site.refus.agence_inactive` = *« Ce rattachement est inactif : choisissez-en
  un actif. »* ; `intervention.refus.agence_inactive` et `demande.refus.agence_inactive` partagent le
  même texte, *« Ce lieu est rattaché à un établissement inactif : rattachez-le d'abord à un
  établissement actif. »* — ma première rédaction employait le mot « agence » en toutes lettres dans la
  VALEUR du dictionnaire (le texte du constat du ticket le fait aussi) et a fait rougir
  `tests/unit/i18n/vocabulaire-impose.test.ts` (5 échecs) avant correction ; voir « pièges » plus bas.
- **Scène de capture AA-6 forgée directement en base** (agence `actif=false` dès sa création, comme
  `captures-9ay-aa1-choix-sites.spec.ts`), plutôt que créée active puis désactivée par l'écran : le site
  d'une agence fermée est un FAIT antérieur pour ce ticket, pas un geste que la capture doit rejouer.
- **AVANT non produit pour les captures AA-6** (comme `captures-parcours-1.spec.ts`) : le refus
  n'existait pas avant ce ticket, et le reproduire par un second worktree était hors du budget du lot —
  écrit ici plutôt que simulé.

## Ce que je n'ai PAS fait

- Je n'ai PAS touché `lib/interventions/depot-reprise.ts`, ni `lib/imports/parc-agences.ts`,
  `lib/imports/application.ts`, `lib/imports/annulation.ts` : hors territoire des deux parties, et le
  constat de chaque partie exigeait explicitement de les laisser intacts.
- Je n'ai PAS ajouté de contrôle du CLIENT inactif dans `deposerDemande` : le constat d'AA-6 l'a signalé
  comme un écart PRÉEXISTANT et hors territoire (« Note : il ne contrôle pas non plus le client inactif
  — hors de ce ticket, à signaler en passation »), je le signale donc ici, sans y toucher.
- Je n'ai PAS touché `tests/e2e/planning-largeur-et-carte.spec.ts` ni `tests/e2e/setup/reperes.ts` : le
  fichier est étranger au territoire des deux parties, et sa réparation demande de revoir comment la
  date de la scène est partagée entre le `globalSetup` et chaque fichier de scénario — un chantier à
  part entière (voir ci-dessous).
- Je n'ai PAS de second commit pour AA-6 (contrairement à ce que « Un ou deux commits » autorisait) :
  toutes les modifications de la partie (dépôt, dictionnaire, tests, captures) tenaient dans un seul
  commit cohérent.

## Les pièges pour la session suivante

- **Le gardien du vocabulaire (`tests/unit/i18n/vocabulaire-impose.test.ts`) refuse « agence »/« site »
  en toutes lettres dans la VALEUR d'une clé du dictionnaire**, y compris pour un texte de refus qui
  semble anodin : mon premier jet de `site.refus.agence_inactive` disait *« Cette agence est inactive :
  choisissez une agence active »* et a fait rougir 5 tests. Le motif se compose avec « rattachement »,
  « lieu », « établissement » — jamais le mot imposé lui-même, qui ne vit que sous une clé
  `vocabulaire.*`. **Lancer `pnpm test` (pas seulement `pnpm typecheck`) avant de committer une nouvelle
  clé de refus qui touche à une agence ou à un site.**
- **`creerSite`/`modifierSite` refusaient déjà toute création SUR une agence inactive avant que ce
  ticket ajoute AA-6** : un scénario qui veut fabriquer « un site déjà rattaché à une agence, agence
  désactivée ENSUITE » doit créer le site pendant que l'agence est encore active, puis la désactiver
  après coup (`modifierAgence`) — créer directement sur une agence déjà inactive est désormais refusé
  par construction, et c'est le premier piège dans lequel je suis tombé en écrivant
  `tests/isolation/refus-creation-agence-inactive.test.ts` (4 échecs avant correction de l'ordre des
  opérations).
- **`tests/e2e/planning-largeur-et-carte.spec.ts` est fragile aux passages de minuit UTC pendant un
  `verify:full` long.** `ecrireLaScene()` (préparation globale) écrit l'intervention `SCENE.obstacle`
  sur le MARDI calculé par `reperesDeLaScene()` **au moment de la préparation**. Chaque fichier de
  scénario — dont celui-ci — rappelle `reperesDeLaScene()` dans son propre `beforeAll`, qui recalcule
  `lundi` à partir de `new Date()` **au moment où CE fichier s'exécute**, dans un PROCESSUS SÉPARÉ qui
  ne partage rien avec la préparation globale. `verify:full` a démarré le 27/09 vers 23:45 UTC (37e ligne
  du log : première ligne de préparation) ; `test:e2e` seul a duré 19,1 minutes, et ce fichier de
  scénario particulier s'est exécuté après le passage à 2026-09-28 00:00 UTC (mesuré : `date -u` donnait
  `Mon Sep 28 00:11:11 UTC 2026` juste après l'échec). `lundiDeLaSemaine` bascule alors sur la semaine
  SUIVANTE, MARDI se décale d'une semaine entière, et la carte de `SCENE.obstacle` — écrite pour l'ancien
  mardi — n'apparaît plus sur le mardi que ce fichier regarde désormais. **Ce n'est pas une régression de
  ce ticket** : `lib/sites/depot.ts`, `lib/interventions/depot.ts` et `lib/demandes/depot.ts` ne sont
  touchés par aucun des deux fichiers en cause, et la précédente exécution de `verify:full`
  (9AY-AA-G1-AGENCE-PROPRE-CHOIX-SITES, `docs/propositions/9AY-AA-G1-AGENCE-PROPRE-CHOIX-SITES/
  passation.md`) rapportait cette même suite e2e à 499 passed / 3 skipped / **0 failed**. Rejouer
  `pnpm test:e2e` seul, à un instant qui ne chevauche pas un passage de minuit UTC, devrait suffire à
  confirmer que c'est bien le seul en cause. La réparation de fond — faire relire aux fichiers de
  scénario les REPÈRES écrits par la préparation globale, plutôt que de les recalculer chacun de leur
  côté — est un chantier à part, hors du territoire de ce ticket.

## Ce qui reste à faire

- Réparer `tests/e2e/planning-largeur-et-carte.spec.ts` (et plus largement `reperesDeLaScene()`) pour
  qu'un `verify:full` qui chevauche minuit UTC ne rougisse plus sur un décalage de semaine — probablement
  en écrivant les repères de la scène dans un fichier ou une variable d'environnement à la préparation
  globale, relus tels quels par chaque scénario, au lieu d'être recalculés.
- Contrôler le client inactif dans `deposerDemande` (écart signalé par le constat d'AA-6, non traité
  ici, hors territoire).
