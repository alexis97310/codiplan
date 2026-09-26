# 99XA-STAB-GLISSER — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

Rien d'applicatif : le seul territoire touché est `tests/e2e/glisser-deposer.spec.ts` et un
nouvel utilitaire `tests/e2e/setup/scene-glisser.ts`. L'exploitation n'est pas concernée ;
ce qui change, c'est la fiabilité de la file de nuit.

Les huit scénarios visaient autrefois des fixtures écrites UNE FOIS par la préparation
globale — `SCENE.glissable`, `SCENE.chevauchante`, `SCENE.obstacle`, `SCENE.redimensionnable`.
Deux d'entre eux effectuent un geste qui **réussit** et **laisse une mutation permanente** :
le premier déplace `glissable` de MARDI à MERCREDI et l'y laisse ; celui du redimensionnement
allonge une intervention et la garde allongée. Une seconde exécution du fichier dans le même
processus — un `--repeat-each`, ou une reprise CI du mode `serial` (qui rejoue TOUT le fichier
depuis le premier test dès qu'un test plus loin échoue) — retrouvait donc ces fixtures déjà
déplacées, et le témoin d'origine du scénario échouait.

Chaque scénario pose désormais SA PROPRE intervention avec
`poserInterventionGlisser` (identifiant `uuidv7()` tiré au sort à l'appel, jamais fixe) et la
retire avec `retirerInterventionGlisser` dans un `finally` — qu'il réussisse ou échoue. Plus
aucune écriture, ni aucune lecture, sur `SCENE.glissable` / `chevauchante` / `obstacle` /
`redimensionnable`.

Les deux scénarios d'interception réseau (« erreur serveur », « connexion interrompue »)
comptent désormais les requêtes effectivement interceptées et vérifient que ce compte vaut
exactement 1 — sans ce compteur, une interception ratée laisse la requête réelle atteindre la
route, et le motif de refus observé à l'écran accuse la mauvaise cause (chevauchement au lieu
d'erreur serveur), comme mesuré par 99T le 26/09.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- **AVANT** (fichier original, `CI=1 pnpm exec playwright test tests/e2e/glisser-deposer.spec.ts
  --repeat-each=5`) : 4 échecs sur le scénario « un déplacement accepté… » (repeats 2 à 5), le
  témoin d'origine ne retrouvant plus `SCENE.glissable` à sa place (déjà déplacée par le
  premier repeat). 8 passed / 28 did not run / 4 failed.
- **Premier essai de correction** (isolation des fixtures, mais fixture du redimensionnement
  encore posée sur MARDI 14:00–15:00 — le créneau de `SCENE.redimensionnable`, jamais
  supprimée) : le déplacement était bien corrigé (30 passed sur les 6 premiers scénarios × 5
  repeats), mais le scénario « la poignée ALLONGE… » échouait à CHAQUE repeat (5 sur 5, y
  compris le premier) — allongée jusqu'à 15:00–16:00, la fixture propre au scénario chevauchait
  systématiquement `SCENE.redimensionnable`, restée sur 14:00–15:00.
- **Deuxième essai** (mauvais choix : déplacer les scénarios Ducos sur un jour neuf,
  `rang = 3`) : a fait apparaître un AUTRE échec — ce jour tombait sur le 24/09/2026, un jour
  férié réel de Nouvelle-Calédonie (Fête de la Citoyenneté) pour la semaine où j'ai exécuté la
  mesure, donc un refus « jour_ferme » au lieu du « chevauchement » attendu. Choisir un jour
  fixe par décalage est fragile face aux fériés ; revenir au jour déjà éprouvé (MARDI) et
  choisir seulement un CRÉNEAU HORAIRE libre était la bonne réparation.
- **APRÈS** (fixture du redimensionnement déplacée sur 15:00–16:00 → 16:00–17:00, dans la plage
  d'ouverture de l'après-midi de Ducos 13:00–17:00, hors de toute fixture permanente) :
  `CI=1 pnpm exec playwright test tests/e2e/glisser-deposer.spec.ts --repeat-each=5` →
  **40 passed**, aucun échec, aucun skip. Un passage simple (`CI=1 pnpm exec playwright test
  tests/e2e/glisser-deposer.spec.ts`) → **8 passed**.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (2913 tests) : verts après
  chaque commit.
- `CI=1 pnpm verify:full` (en entier, au premier plan) : **vert** — 311 passed / 3 skipped sur
  `test:e2e` (les 3 skips sont préexistants, hors du périmètre de ce lot), et la chaîne
  `format:check && typecheck && lint && test && test:isolation && build && feries:horizon &&
  audit:partitions` a donc, elle aussi, entièrement réussi (le script est une conjonction : la
  suite `test:e2e` ne s'exécute que si tout ce qui précède est vert).

## Ce que j'ai tranché et pourquoi

- **Isoler PAR SCÉNARIO plutôt que par fichier** (`beforeAll`/`afterAll` unique) : les huit
  scénarios n'ont pas tous besoin des mêmes fixtures (obstacle, chevauchement, redimensionnement
  ne se recoupent pas), et une fixture créée dans le corps du test — jamais dans `beforeAll` —
  est immunisée contre une reprise CI du mode `serial`, qui rejoue le fichier depuis le premier
  test.
- **`uuidv7()` généré À L'APPEL, jamais un identifiant fixe** : c'est la garantie qu'une
  répétition ou une reprise ne retrouve jamais une ligne déjà écrite par la tentative
  précédente.
- **Garder MARDI pour les scénarios Ducos, jamais un jour neuf** : MARDI est déjà éprouvé
  ouvert pour Ducos par l'ensemble de la suite existante ; un jour choisi par décalage fixe
  peut tomber sur un jour férié réel selon la semaine d'exécution, ce que j'ai mesuré
  directement (24/09 2026, Fête de la Citoyenneté). Le bon axe pour éviter `SCENE.redimensionnable`
  était l'HORAIRE, pas le JOUR.
- **Le compteur de requêtes interceptées** sur les deux scénarios réseau : décrit dans le
  ticket, il transforme un symptôme déroutant (mauvais motif de refus affiché) en un défaut
  nommé si l'interception venait à échouer de nouveau.

## Ce que je n'ai PAS fait

- Je n'ai touché aucun code applicatif : la cause des deux rouges était entièrement dans la
  mise en scène du fichier de test, jamais dans l'écran.
- Je n'ai pas modifié `tests/e2e/setup/scene.ts` ni aucune fixture `SCENE.*` : elles restent
  intactes, lues par d'autres fichiers (`affichage-materiel.spec.ts`,
  `planning-largeur-et-carte.spec.ts` notamment).
- Je n'ai pas cherché à vérifier la piste « date FIXE de la scène » signalée par 99T au-delà de
  ce que la lecture du code montre déjà : `reperesDeLaScene()` et `ecrireLaScene()` calculent
  toutes deux `lundi` depuis `new Date()` au moment de leur propre appel, dans des processus
  séparés, mais le fichier lit systématiquement `reperes.lundi` (jamais un calcul indépendant
  depuis la date du jour) pour construire ses URLs — ce point était déjà corrigé le 20/09/2026
  (CI #817) et n'est pas revenu pendant mes mesures.

## Les pièges pour la session suivante

- **`SCENE.redimensionnable` (MARDI 14:00–15:00 côté Ducos) reste une fixture PERMANENTE que
  personne n'efface** : toute nouvelle fixture posée par un AUTRE fichier sur ce créneau, pour
  ce technicien, un mardi, risque le même chevauchement que celui mesuré ici. Le réflexe n'est
  pas de déplacer le JOUR (risque de tomber sur un jour férié réel), mais de choisir un
  CRÉNEAU HORAIRE libre dans la plage d'ouverture de l'agence visée.
- **Les horaires d'ouverture de Ducos sont un service coupé** : 07:30–11:30 puis 13:00–17:00
  (semis `DEMO-NOUMEA`), avec un trou de midi 11:30–13:00 où aucune case `data-depot-heure`
  n'existe. Une fixture posée dans ce trou ne trouverait aucune case à viser.
- **Choisir un jour par décalage fixe depuis le lundi de la scène (`rang = N`) est fragile face
  aux jours fériés** : la semaine où j'ai mesuré, `rang = 3` (jeudi) tombait sur le 24/09/2026,
  jour férié réel en Nouvelle-Calédonie. Une future session qui voudrait un jour neuf devrait
  d'abord vérifier `pnpm feries:horizon` ou la table des fériés pour la semaine visée — ou,
  plus simplement, rester sur un jour déjà éprouvé et choisir un horaire libre, comme fait ici.

## Ce qui reste à faire

Rien dans ce lot. Le fichier est vert sous `--repeat-each=5` (40/40) et sous `verify:full`
complet ; aucun conflit non résolu à signaler.
