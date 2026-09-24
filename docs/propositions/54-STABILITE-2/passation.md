# 54-STABILITE-2 — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

Rien de visible pour un exploitant : aucun écran, aucune route, aucune migration. Ce lot
corrige la MISE EN SCÈNE de quatre fichiers `tests/e2e/*.spec.ts`, ajoute un gardien
statique, et ne touche ni `app/`, ni `lib/`, ni le semis.

- **`tests/e2e/avertissements-1.spec.ts`** — la date de l'intervention du badge (« le
  badge Nouveau se voit… ») était posée par `CURRENT_DATE` (jour civil **UTC** de
  PostgreSQL). `/terrain` lit « aujourd'hui » via
  `instantDuJour(jourDe(maintenant(fuseau).local))`, `fuseau` = celui de la société
  (`Pacific/Noumea`, UTC+11). Entre 00h00 et 11h00 heure de Nouméa, les deux jours
  divergent et la carte disparaissait de la journée affichée. Remplacé par la même règle
  que l'écran : `instantDuJour(jourDe(maintenant(reperes.fuseau).local))`.
- **`tests/e2e/porte-capacites.spec.ts`** — deux interventions à identifiant fixe posées
  dans `beforeAll` sans `test.describe.configure({ mode: "serial" })` : sous
  `fullyParallel`, Playwright rejoue `beforeAll` dans CHAQUE worker qui reçoit un test du
  fichier, et deux workers concurrents heurtaient la même ligne
  (`Unique constraint failed on the fields: (id)`). Corrigé par les deux gestes demandés
  par le ticket : la série ajoutée EN TÊTE de fichier, ET l'écriture devenue un
  `INSERT … ON CONFLICT ("id") DO UPDATE` (au lieu de `deleteMany` puis `create`), pour
  qu'un rejeu du même identifiant — série ou pas — ne heurte plus jamais la contrainte.
- **`tests/e2e/bon-intervention.spec.ts`** et **`tests/e2e/parc-apercu-borne.spec.ts`** —
  même défaut trouvé par la même revue (recherche demandée au point 3 du ticket) :
  `deleteMany` puis `create`/`INSERT` sur un identifiant fixe, dans un `beforeAll`, sans
  série. Corrigés par le seul ajout de `test.describe.configure({ mode: "serial" })` — le
  ticket ne demandait l'upsert idempotent que pour `porte-capacites`.
- **`tests/unit/e2e-mise-en-scene.test.ts`** (nouveau) — gardien statique en deux volets :
  (a) tout fichier dont un `beforeAll` écrit en base (Prisma `create`/`update`/`upsert`/
  `delete`… ou `$executeRawUnsafe` portant `INSERT`/`UPDATE`/`DELETE`, `ON CONFLICT`
  compris) déclare la série, sauf exemption NOMMÉE avec motif ; (b) aucun fichier ne
  contient `CURRENT_DATE`. Fermé dans les deux sens : les deux exemptions
  (`blocage-agenda-visible.spec.ts`, `fiche-intervention.spec.ts` — toutes deux
  `ON CONFLICT DO NOTHING` par choix documenté dans leur propre en-tête) sont vérifiées
  vivantes (le fichier existe, la règle générale le flaguerait réellement sans
  l'exemption, il ne déclare pas déjà la série).

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- **Recherche exhaustive** (agent dédié) sur `tests/e2e/*.spec.ts` : 49 fichiers, 17 avec
  un `test.beforeAll`. Parmi eux, 5 écrivaient sans `test.describe.configure({ mode:
  "serial" })` : `blocage-agenda-visible.spec.ts`, `bon-intervention.spec.ts`,
  `fiche-intervention.spec.ts`, `parc-apercu-borne.spec.ts`, `porte-capacites.spec.ts`.
  Sur ces 5, 2 écrivaient déjà en `ON CONFLICT DO NOTHING` (safe par construction,
  documenté dans leur propre en-tête) — les 3 autres ont été corrigés.
- `CURRENT_DATE`/`now()::date` : 2 occurrences dans tout `tests/e2e/` —
  `avertissements-1.spec.ts:148` (`CURRENT_DATE`, corrigé) et
  `bon-intervention.spec.ts:66` (`now()::date`, PAS `CURRENT_DATE` littéral — hors du
  périmètre du gardien (b), et vérifié : sa fixture n'est visitée que par son
  identifiant, `/interventions/{id}/bon`, jamais lue « par jour » par un écran — donc pas
  un défaut au sens de ce ticket).
- **Gardien neuf, éprouvé sur le vrai dépôt** : 26 tests verts. Preuve demandée par le
  ticket faite deux fois : j'ai retiré `test.describe.configure` de
  `porte-capacites.spec.ts` → le gardien rougit exactement sur ce fichier (message :
  « écrit en base dans son beforeAll sans déclarer la série ») ; remis → vert. (La
  première version du gardien considérait `ON CONFLICT DO UPDATE` comme dispensé de
  série, donc AVEUGLE à ce retrait — j'ai corrigé la règle avant de committer la version
  finale ; voir « ce que j'ai tranché ».)
- `pnpm test` : 254 fichiers, 2750 tests, verts.
- `pnpm test:isolation` : 119 fichiers, 1216 tests, verts.
- `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build` : verts.
- **`pnpm test:e2e` deux fois de suite, verts les deux fois**, les DEUX passages
  entièrement dans la fenêtre à risque (avant 11h00 heure de Nouméa) :
  - Passage 1 : 00h56 → 00h59 (Pacific/Noumea) — 216 passed, 3 skipped, 0 failed.
  - Passage 2 : 00h59 → 01h02 (Pacific/Noumea) — 216 passed, 3 skipped, 0 failed.
  Les 3 « skipped » sont les mêmes aux deux passages (`tous-les-ecrans-rendent.spec.ts`,
  routes sans donnée de démonstration — non liés à ce lot, non modifiés).

## Ce que j'ai tranché, et pourquoi

- **Le gardien exige la série sur TOUTE écriture, `ON CONFLICT` compris — pas seulement
  sur les écritures « non idempotentes ».** Première version : une écriture
  `INSERT … ON CONFLICT DO NOTHING` ou `DO UPDATE` dispensait de la série. Ça rendait le
  gardien aveugle à `porte-capacites.spec.ts` une fois son écriture rendue idempotente
  par l'upsert — retirer `test.describe.configure` ne le faisait plus rougir, alors que
  la preuve exigée par le ticket (« Le gardien rougit si on retire le describe.configure
  de porte-capacites ») l'exige explicitement. J'ai donc rendu la règle plus littérale
  (toute écriture exige la série) et déplacé la tolérance vers des EXEMPTIONS NOMMÉES
  avec motif — exactement la porte que le ticket ouvrait
  (« liste d'exemptions NOMMÉES avec leur motif si une exception est justifiée »).
- **`bon-intervention.spec.ts:66` (`now()::date`) n'a pas été touché.** Le point 3 du
  ticket demandait de vérifier, pas de corriger systématiquement : « verifie si l'ecran
  les lit au jour ». Cette fixture est visitée directement par son identifiant
  (`/interventions/{id}/bon`), jamais par un écran qui filtre « aujourd'hui » — le défaut
  mesuré (divergence de fuseau) ne peut pas s'y produire. Le gardien (b) ne porte de
  toute façon que sur `CURRENT_DATE`, jamais sur `now()::date`, à l'identique du texte du
  ticket.
- **`blocage-agenda-visible.spec.ts` et `fiche-intervention.spec.ts` sont exemptés,
  jamais sérialisés.** Les deux portent déjà, dans leur PROPRE en-tête, l'explication
  écrite du choix : `ON CONFLICT DO NOTHING` plutôt que la série, parce que deux workers
  concurrents écrivant la même valeur ne se font pas la course. Les resérialiser aurait
  été un changement non demandé par le ticket et déjà couvert par une décision
  antérieure documentée.
- **`bon-intervention.spec.ts` et `parc-apercu-borne.spec.ts` n'ont reçu QUE la série**,
  pas l'upsert idempotent — le ticket ne demandait l'upsert que pour
  `porte-capacites.spec.ts` (« Choix attendu » nommé explicitly pour ce fichier). La
  série suffit à fermer leur course, et rajouter un upsert non demandé aurait été une
  extension hors périmètre.

## Ce que je n'ai PAS fait

- Je n'ai pas touché `app/`, `lib/`, ni aucune ligne du semis (`prisma/seed.ts`,
  `prisma/seed-data.ts`) — interdit par le ticket, vérifié par `git diff --stat`.
- Je n'ai pas retiré ni changé une seule assertion métier.
- Je n'ai pas ajouté de `retries`, de `workers: 1` global, de `fullyParallel: false`
  global, de `skip`/`fixme`, ni de délai — vérifié en relisant chaque diff avant de
  committer.
- Je n'ai pas produit de nouvelles captures : les PNG regénérés comme effet de bord de
  `pnpm test:e2e` (deux fichiers en produisent) ont été annulés par `git checkout --`
  avant le commit final, le ticket disant explicitement « Captures : aucune ».
- Je n'ai pas cherché d'autres classes de défaut de mise en scène que celles nommées par
  le ticket (`beforeAll` non sérialisé qui écrit, `CURRENT_DATE`) — un `beforeEach` qui
  écrirait sans idempotence, par exemple, est hors du périmètre du gardien neuf et n'a
  pas été audité.

## Les pièges pour la session suivante

- **Le gardien `tests/unit/e2e-mise-en-scene.test.ts` génère un `it()` par fichier
  flagué**, au chargement du module (boucle `for` hors de tout `describe` synchrone) —
  comme `tests/unit/e2e-donnees-partagees.test.ts` avant lui. Un fichier e2e neuf dont le
  `beforeAll` écrit en base sans série y ajoute un test rouge automatiquement ; c'est
  voulu, mais un futur lot qui lirait « le gardien a grossi » sans comprendre pourquoi
  perdrait du temps à chercher un bug côté harnais alors que c'est le comportement normal
  de détection.
- **Ne pas confondre les deux exemptions du gardien** : `EXEMPTIONS_SERIE`
  (mode "serial") et `EXEMPTIONS_CURRENT_DATE` (règle b) sont deux listes séparées, vides
  ou non indépendamment. Ajouter une entrée à la mauvaise n'échouerait pas immédiatement
  mais laisserait un vrai défaut passer.
- **`ON CONFLICT ("id") DO UPDATE` sur `intervention` traverse le déclencheur
  `intervention_cycle_de_vie`** (`BEFORE UPDATE`) à chaque rejeu du `beforeAll` de
  `porte-capacites.spec.ts` — vérifié inoffensif ici parce que `statut` reste toujours
  `planifiee` (les deux scénarios du fichier sont des REFUS, le statut ne bouge jamais),
  donc `OLD.statut = NEW.statut = 'planifiee'` et aucune des gardes du déclencheur ne se
  déclenche. Un futur ticket qui ferait avancer le statut d'une de ces deux fixtures
  romprait cette hypothèse silencieusement au prochain rejeu du `beforeAll`.
- **Le premier `pnpm test:e2e` régénère des captures PNG existantes** même sans qu'aucun
  écran n'ait changé (compression, anti-aliasing, ou contenu légèrement différent d'une
  exécution à l'autre) — `git status` après un `test:e2e` montre presque toujours des
  fichiers `docs/propositions/*/captures/*.png` modifiés. Un lot qui ne touche AUCUN
  écran doit les `git checkout --` avant de committer, comme fait ici.

## Ce qui reste à faire

- Rien d'identifié dans le périmètre de ce ticket : les deux épreuves nommées par le
  constat (`avertissements-1.spec.ts:367`, `porte-capacites.spec.ts`) sont corrigées et
  prouvées vertes deux fois de suite, avant 11h00 heure de Nouméa ; le gardien neuf ferme
  la classe de défaut pour l'avenir, dans les deux sens.
- Hors périmètre, à surveiller par une session future si le sujet revient : aucun autre
  `CURRENT_DATE`/`now()::date` lu « par jour » par un écran n'a été trouvé, mais seul
  `tests/e2e/` a été audité — un `now()::date` dans un script (`scripts/`) ou une
  migration n'a pas été cherché, n'étant pas dans le périmètre du constat ni du gardien
  demandé.
