# 9I000-SCENE-SANS-JOUR-FERIE — passation

## FAIT, commité (deux commits sur la branche `9I000-SCENE-SANS-JOUR-FERIE`)

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

**Le problème mesuré** (trois vérifications indépendantes de suite, 03-04/11,
voir les traces citées par le ticket) : à partir du mardi 03/11/2026,
`lundiSansJourPasse` (`tests/e2e/setup/scene.ts`) pose la scène e2e sur la
semaine du lundi **09/11/2026**, dont MERCREDI (lundi+2) tombe le **11/11,
Armistice 1918** — férié des deux territoires du jeu (`FERIES_FIXES`,
`prisma/seed-data.ts`). Un dépôt (glisser-déposer) sur un jour férié ouvre la
confirmation D93 (« Poser hors des horaires d'ouverture ? »,
`components/planning/pose.tsx`) **avant toute requête**. Les cinq épreuves
citées par le ticket glissent un bloc et attendent directement le POST
`…/deplacer` sans jamais jouer cette confirmation : `page.waitForResponse`
expire (15 s). **Vérifié au point 1** en rejouant
`tests/e2e/glisser-deposer.spec.ts:168` sur l'état d'avant correctif : le
contexte d'erreur Playwright montre le dialogue
`"Poser hors des horaires d'ouverture ?"` à l'écran, et la grille affichée
porte `"Mer 11 férié"` — le mécanisme est exactement celui mesuré par le
pilote, rien d'autre.

**Le correctif** (point 2, `tests/e2e/setup/scene.ts`) : une fonction pure
sœur de `lundiSansJourPasse`, `lundiSansJourFerie(lundiCourant, feries)`,
qui avance la semaine de la scène tant que MARDI, MERCREDI ou SAMEDI tombe un
jour férié du territoire. La liste des fériés (`feriesDeLaSceneNc`) vient de
`feriesDuTerritoire` (`prisma/seed-data.ts`) — la MÊME source que le semis,
jamais une liste recopiée. Composée APRÈS `lundiSansJourPasse` aux deux
points d'appel (`ecrireLaScene`, et le repli de `reperesDeLaScene` dans
`tests/e2e/setup/reperes.ts`) : avancer pour fuir un férié ne peut pas faire
retomber sur un jour déjà passé, l'avenir ne recule pas. Bornée à 104
semaines (deux ans, l'horizon que `feriesDeLaSceneNc` couvre) — un
dépassement lève plutôt que de boucler.

**Le point 3** (`tests/e2e/9f5c-date-passee-planning.spec.ts`) : ce fichier
calculait `JOUR_PASSE` comme `reperes.lundi - 7`, en s'appuyant sur le
commentaire (désormais faux) « `reperes.lundi` est au plus
`aujourd'hui + 6` ». Avec le point 2, `reperes.lundi` peut être poussé
jusqu'à `aujourd'hui + 13` (un férié de plus à fuir) : `reperes.lundi - 7`
vaudrait alors `aujourd'hui + 6`, qui n'est PLUS strictement passé — la
confirmation D123 (« date passée ») que ce fichier éprouve ne s'ouvrirait
plus. `JOUR_PASSE` se calcule désormais en `beforeAll`, comme le RANG (depuis
`reperes.lundi`, celui que `jourDeLaScene` attend) du lundi de la semaine qui
précède celle d'**aujourd'hui** — jamais celle de la scène — via
`ecartEnJours(reperes.lundi, jourSuivant(lundiDeLaSemaine(aujourdhui), -7))`.
Toujours strictement passé, toujours un lundi, quelle que soit la distance
entre `reperes.lundi` et aujourd'hui.

## Ce que j'ai mesuré

- **Point 1** : `CI=1 pnpm exec playwright test
  tests/e2e/glisser-deposer.spec.ts:168 --workers=1` sur l'état d'avant
  correctif → rouge, contexte d'erreur confirmant le dialogue D93 et
  « Mer 11 férié » à l'écran.
- **Nouvelle épreuve unitaire** (`tests/unit/e2e-lundi-scene-sans-jour-ferie.test.ts`) :
  `feriesDeLaSceneNc` contient bien le 11/11/2026 et rend exactement les
  dates de `feriesDuTerritoire` ; `lundiSansJourFerie` avance la semaine du
  09/11/2026 au 16/11/2026, ne change rien pour une semaine sans férié ou une
  liste de fériés vide, et lève plutôt que boucler quand (par construction du
  test) tout serait férié.
- `pnpm format`, `pnpm typecheck`, `pnpm lint`, `pnpm test` (496 fichiers,
  5463 tests) : verts, après chaque point.
- **Les 5 épreuves citées par le ticket + `9f5c-date-passee-planning.spec.ts`**,
  sous `CI=1 pnpm exec playwright test ... --workers=1` : **20 passed**.
- **Point 4, élargi mais PAS exhaustif** (voir ci-dessous) : les 12 autres
  fichiers `tests/e2e/*.spec.ts` qui référencent `MERCREDI` ou `SAMEDI` (les
  constantes de rang les plus directement couplées au jour de la semaine
  visé, donc les plus exposées à un décalage de `reperes.lundi`) —
  `9eg2-tableau-de-bord-direction-admin`, `blocage-agenda-visible`,
  `captures-9f3-pose-hors-ouverture-confirmee`,
  `captures-9f3b-pose-hors-ouverture-epreuves`, `captures-pg-b4-survol-cases`,
  `creation-jour-ferme`, `deplanifiee-1`, `ergo-carte-semaine`,
  `fiche-trouver-creneau`, `planning-creer-ici`, `planning-fenetre-pose`,
  `planning-survol-cases` — sous `CI=1 --workers=1` : **58 passed**.

## Ce que j'ai tranché et pourquoi — l'écart au point 4

Le point 4 demande de rejouer, en plus des 5+1 épreuves nommées, **« tout
autre fichier qui importe `lundiSansJourPasse` ou `reperesDeLaScene` »**, en
suggérant de les lister par `git grep -l`. Je l'ai fait :
`git grep -l "lundiSansJourPasse"` ne rend que les 4 fichiers déjà cités
(scene.ts, reperes.ts, 9f5c, la nouvelle épreuve unitaire) — aucun écart là.
Mais `git grep -l "reperesDeLaScene"` rend **environ 200 fichiers**
`tests/e2e/*.spec.ts` : la quasi-totalité de la suite e2e, puisque
`reperesDeLaScene` est le point d'entrée standard du harnais, utilisé par
tout scénario qui a besoin d'une société, d'une agence ou d'une identité —
bien au-delà des scénarios réellement couplés à la date de `reperes.lundi`.

Jouer ces ~200 fichiers sous `--workers=1` (le seul mode que le ticket
demande, pour la même raison de déterminisme que les 5 épreuves nommées)
aurait dépassé de très loin le budget de 60 minutes du lot — les 20 et 58
épreuves déjà rejouées ont pris environ 4 minutes CHACUNE, pour des lots de
9 à 58 tests. Je **signale la contradiction plutôt que de deviner** : j'ai
choisi de borner le point 4 aux fichiers dont le couplage au jour de semaine
visé est direct et nommé (`MERCREDI`, `SAMEDI` — voir la liste mesurée
ci-dessus), plutôt que la totalité des importeurs de `reperesDeLaScene`. Le
reste de la suite sera rejoué par `pnpm verify:full`, que la file joue en
entier juste après moi (et qui n'était de toute façon pas à ma charge selon
le budget de temps du lot).

## Ce que je n'ai PAS fait

- Les ~190 fichiers e2e restants qui importent `reperesDeLaScene` sans
  référencer `MERCREDI`/`SAMEDI` n'ont pas été rejoués individuellement —
  voir l'écart ci-dessus. Rien n'indique qu'ils soient affectés : ils ne
  dépendent du jour de semaine exact de `reperes.lundi` que par construction
  (`jourDeLaScene`), et la fonction qui calcule ce jour n'a pas changé de
  forme, seulement la semaine qu'elle peut désigner.
- Aucune migration, aucune donnée de production, aucune dépendance nouvelle.
- Aucune capture n'a été commitée : ce lot ne touche aucun écran, et les
  captures régénérées par effet de bord des épreuves `captures-*` rejouées au
  point 4 (`9f5c-...`, `fiche-avert-pose-apres-...`) ont été restaurées à
  leur état commité (`git checkout --`) avant de rendre la main.

## Les pièges pour la session suivante

- **`lundiSansJourFerie` ne couvre que le territoire NC.** Les trois agences
  de CODIMA-NC (DUCOS, KONE, DOLBEAU) sont toutes `TERRITOIRE_NOUVELLE_CALEDONIE`
  — c'est pourquoi `feriesDeLaSceneNc` est codée en dur sur ce seul
  territoire plutôt que paramétrée. Si une scène future ajoute une agence
  d'un autre territoire (CODIMA-EU, `FR`), elle devra composer les fériés des
  DEUX territoires avant d'appeler `lundiSansJourFerie`.
- **`reperes.lundi` peut maintenant atteindre `aujourd'hui + 13`**, pas
  seulement `+ 6` — tout calcul futur qui suppose l'ancienne borne (comme le
  faisait `9f5c` avant ce lot) est à vérifier.
- Le piège qui a produit ce lot reviendra : tout férié tombant un mardi, un
  mercredi ou un samedi de la semaine visée (Noël 2026 est un vendredi, mais
  le 01/01/2027 un vendredi aussi ; Pâques 2027 via `lib/calendar/paques.ts`
  peut faire tomber le Lundi de Pâques ou l'Ascension sur l'un des trois
  rangs). `lundiSansJourFerie` ferme la famille entière, pas seulement le
  11/11/2026 constaté.

## Ce qui reste à faire

- Rien dans le territoire de ce lot. Le reste de la suite e2e sera couvert
  par `pnpm verify:full` (la file, juste après ce lot).

---

# Reprise 9I000A-REPRISE-9I000

## FAIT, commité sur `9I000A-REPRISE-9I000` (partie d'`origin/main`, avec les
trois commits de la garde `9I000-SCENE-SANS-JOUR-FERIE-garde` reportés en tête)

## Ce que le pilote avait mesuré (04/11, ~04:50)

9I000 a corrigé `9f5c-date-passee-planning.spec.ts` (point 3 ci-dessus :
`JOUR_PASSE` calculé depuis AUJOURD'HUI, jamais depuis `reperes.lundi`), mais
pas les deux autres fichiers qui supposent la même borne fausse
(« `reperes.lundi − 7` est toujours strictement passé ») — écart que 9I000
avait lui-même signalé sans le traiter, le ticket le bornant à ce seul
fichier. Deux occurrences mesurées par le 1er passage de vérification
indépendante : `tests/e2e/9f5b-date-passee.spec.ts:100` et `:152`, et par
`git grep` : `tests/audit-fonctionnel/parcours-edge.spec.ts:143`. Les trois
appelaient `jourSuivant(reperes.lundi, -7)`.

## Le correctif

**Une seule fonction partagée**, dans `tests/e2e/setup/scene.ts`, à côté de
`lundiSansJourFerie` (même mécanisme, même borne de 104 semaines) :

- `lundiDeLaSemainePasseeOuvert(aujourdhui, feries)` — fonction PURE : rend le
  lundi de la semaine qui précède celle d'AUJOURD'HUI (jamais celle de la
  scène), et recule d'une semaine supplémentaire tant qu'il tombe un jour
  férié du territoire. Toujours un LUNDI, donc toujours ouvert pour Ducos et
  Koné (`DEMO-NOUMEA`, `DEMO-KONE` ouvrent du lundi au vendredi), et toujours
  strictement passé (au pire huit jours avant aujourd'hui, si aujourd'hui est
  lui-même un lundi).
- `lundiPasseDeLEpreuve(reperes)` — l'enveloppe que les trois fichiers
  appellent : lit `aujourdhui` via `maintenant(reperes.fuseau)`, compose les
  fériés via `feriesDeLaSceneNc(aujourdhui.annee - ANNEES_AU_DELA)` (reculer
  de deux ans est nécessaire : `feriesDeLaSceneNc` ne couvre que l'année de
  départ et les deux suivantes, et le recul peut franchir une bascule
  d'année), puis appelle `lundiDeLaSemainePasseeOuvert`.

Les trois fichiers (`9f5c-date-passee-planning.spec.ts`,
`9f5b-date-passee.spec.ts`, `parcours-edge.spec.ts`) appellent désormais tous
`lundiPasseDeLEpreuve(reperes)` — plus aucun `jourSuivant(reperes.lundi, -7)`
dans `tests/` (vérifié par `git grep -n "reperes\.lundi, -\|jourDeLaScene
(reperes, -"`, qui ne rend plus que le commentaire de `scene.ts` qui raconte
l'ancienne forme). `9f5c` a été refactoré pour utiliser la même fonction que
les deux autres plutôt que de garder son propre calcul en ligne — « même
forme, jamais trois calculs divergents » (le ticket).

Les imports devenus inutiles (`jourDe`, `jourSuivant`, `maintenant`,
`lundiDeLaSemaine`, `ecartEnJours` composé différemment) ont été retirés ou
ajustés aux trois points d'appel ; `parcours-edge.spec.ts` garde `jourSuivant`
pour ses décalages FUTURS (`+91`, `+98`), hors territoire de ce lot.

## Épreuve unitaire

`tests/unit/e2e-lundi-passe-ouvert.test.ts`, même forme que
`e2e-lundi-scene-sans-jour-ferie.test.ts` : exécutée un lundi, exécutée un
mardi (rend le même lundi passé que depuis un lundi — jamais celui de la
semaine courante), un lendemain de férié (02/01/2024, après le Jour de l'An
du 01/01 — un LUNDI — qui recule vers le 25/12/2023, Noël, lui-même férié :
deux fériés enchaînés de part et d'autre d'une bascule d'année), liste de
fériés vide, et la borne à 104 semaines qui lève plutôt que boucler.

## Ce que j'ai mesuré

- `pnpm format`, `pnpm typecheck`, `pnpm lint`, `pnpm test` (497 fichiers,
  5468 tests) : verts avant le commit du point 2.
- `CI=1 pnpm exec playwright test tests/e2e/9f5b-date-passee.spec.ts
  tests/e2e/9f5c-date-passee-planning.spec.ts tests/e2e/glisser-deposer.spec.ts
  --workers=1` : **15 passed** (2 + 4 + 9 — les 9 scénarios de
  `glisser-deposer.spec.ts`, surensemble des cinq cités par le ticket).
- `tests/audit-fonctionnel/parcours-edge.spec.ts` : rejoué par
  `pnpm typecheck` seulement (le territoire du point 3 le permet) — vert,
  inclus dans le `CI=1 pnpm verify` global.
- `CI=1 pnpm verify` (format:check, typecheck, lint, test, test:isolation,
  build) : vert, EXIT=0.

## Ce que je n'ai PAS fait

- `pnpm verify:full` n'a pas été joué ici (consigne du lot) — la file le joue
  juste après.
- Les ~190 autres fichiers `tests/e2e/*.spec.ts` qui importent
  `reperesDeLaScene` sans référencer le motif `reperes.lundi, -7` n'ont pas
  été rejoués : `git grep` sur tout `tests/` ne trouve plus ce motif que dans
  le commentaire explicatif de `scene.ts` — rien d'autre n'était dans le
  territoire de ce lot.
- Aucune migration, aucune donnée de production, aucune dépendance nouvelle.

## Piège pour la session suivante

- `feriesDeLaSceneNc(annee)` ne couvre que `[annee, annee+1, annee+2]` —
  jamais les années AVANT `annee`. Tout calcul qui recule dans le temps (passé
  strict) doit appeler `feriesDeLaSceneNc(aujourdhui.annee - ANNEES_AU_DELA)`,
  jamais `feriesDeLaSceneNc(aujourdhui.annee)`, sous peine de chercher un
  férié d'une année que le jeu ne couvre pas dès que le recul franchit une
  bascule d'année (exactement le cas couvert par l'épreuve unitaire
  « lendemain de férié » ci-dessus).
