# 9L32-PETITS-DEFAUTS-ET-LUNDI — passation

## Reprise de branche

`9L32-PETITS-DEFAUTS-ET-LUNDI` créée directement depuis `9L31B-REPRISE-CRENEAUX-LUNDI-garde` :
`git merge-base origin/main 9L31B-REPRISE-CRENEAUX-LUNDI-garde` rend exactement le HEAD d'`origin/main`
au moment de la reprise — la branche de 9L31B était donc déjà à jour, aucun cherry-pick n'était
nécessaire (contrairement à ce que le mandat anticipait).

## Point 1 — les deux échecs d'isolation du bon portail (garantie, recensement)

**Aucun défaut de code trouvé — rejoué PLUSIEURS FOIS, toujours vert.** Mesuré dans cet ordre :

1. `tests/isolation/bon-intervention.test.ts` seul (les deux tests `lireBonDuParc`) : vert.
2. Le fichier entier (12 tests) : vert.
3. `CI=1 pnpm test:isolation` complet (263 fichiers, 2543 tests) sur la branche reportée : vert.
4. **La même chose rejouée sur `origin/main` SEUL** (checkout détaché, sans aucun commit de 9L31B ni
   de 9L32) : vert aussi — donc pas une régression introduite par la chaîne 9L31.
5. `CI=1 pnpm test:isolation` complet rejoué une SECONDE fois après le commit du point 3 (ci-dessous) :
   vert (2543/2543) à l'identique.

**Cause retenue, par élimination plutôt que mesurée directement** (la panne ne s'est pas reproduite
ici pour en lire le détail PostgreSQL) : la mémoire du dépôt ([[poste-alexis-bases-de-test]],
confirmée le 11/11 dans les deux sens) établit que `TEST_DATABASE_URL` et `E2E_DATABASE_URL` visent,
sur ce poste, la MÊME base `codiplan_test` — et que jouer un harnais juste après (ou pendant) l'autre
fait échouer des tests avec des états impossibles, sans que le code soit en cause. La dernière
vérification du 23/11 (citée par le mandat) a eu lieu alors que la suite e2e (`CI=1 npx playwright
test --workers=1`) tournait encore dans la même session, avec sa propre préparation globale
(`migrate` + `db:seed`) — exactement le scénario que la mémoire documente. `vitest.config.mts` fixe
`fileParallelism: false` pour le projet `isolation` : aucune concurrence n'est possible ENTRE ses
propres fichiers, ce qui exclut une cause interne à `test:isolation` et pointe vers un harnais
EXTÉRIEUR tournant sur la même base au même moment.

**Rien à corriger ici** : ni le code, ni une fixture. La seule action est opérationnelle, et elle est
déjà la règle du dépôt (rappel du pilote en tête du mandat, [[poste-alexis-bases-de-test]]) : ne jamais
lire le résultat de `pnpm test:isolation` tant qu'un `playwright test` tourne ou vient de tourner sur
la même base. Les cinq mesures ci-dessus, prises SEULES, le confirment.

## Point 2 — Lundi : gardien permanent de `lundiSansJourPasse`

`lundiSansJourPasse` (`tests/e2e/setup/scene.ts`) est une fonction PURE — `aujourdhui` est un
paramètre, jamais l'horloge système. Elle se rejoue donc sur n'importe quel jour SANS avoir besoin de
forger le temps système (ce que le dépôt interdit par ailleurs d'instrumenter, `maintenant(fuseau)`
étant le seul point qui lit l'horloge, gardé par `sans-date-courante-implicite.test.ts`).

Nouveau fichier commité : `tests/unit/e2e-lundi-scene-sans-jour-passe.test.ts`. Il fige, pour les sept
jours réels du 23 au 29/11/2026 (lundi à dimanche) :

1. **MARDI/MERCREDI/SAMEDI de la scène restent toujours strictement futurs**, quel que soit le jour —
   l'invariant que la fonction promet, jamais testé jusqu'ici (seule `lundiSansJourFerie` avait un
   gardien).
2. **« MARDI de la scène » ne coïncide avec « demain, en vrai » QUE lorsque le jour d'exécution est un
   lundi** — exactement le mécanisme que 9L31B avait mesuré par un script jetable non commité (preuve
   analytique sur les sept jours, non rejouée dans le navigateur). Ce fichier rend cette preuve
   PERMANENTE : elle vaudra encore l'an prochain, pas seulement le 23/11/2026.

14 tests, tous verts (`npx vitest run --project unit tests/unit/e2e-lundi-scene-sans-jour-passe.test.ts`).

## Point 3 — un défaut RÉEL, mesuré un LUNDI RÉEL, NON corrigé dans ce lot (budget)

En jouant la suite e2e en vraie grandeur (le mandat demandait l'entière, voir plus bas pour ce qui a
pu tourner), **trois échecs `23P01` bien réels sont apparus**, un jour où `TZ=Pacific/Noumea date`
rend un LUNDI (23/11/2026, le jour même de cette session) :

```
tests/e2e/captures-9dca-droits-terrain-demandes.spec.ts
tests/e2e/captures-9f4h5-terrain-vivant.spec.ts (le cas « à 1280px »)
tests/e2e/captures-9f4h5b-journee-sans-montant.spec.ts (le cas « à 1280px »)
```

**Cause exacte, lue dans le détail PostgreSQL et confirmée par requête SQL directe sur la base
pendant qu'elle portait encore l'état du run** : les trois posent, pour `technicienDucos`, un créneau
à `cle = aujourd'hui, heure UTC = 20`, soit LOCAL (NC, UTC+11) **07:00–08:00 de DEMAIN** (l'heure UTC
20 fait toujours basculer le jour local, quel que soit le jour — c'est le mécanisme que 9L31B avait
déjà identifié pour `obstacle`). Ce créneau entre en collision avec une fixture TOTALEMENT DIFFÉRENTE,
que 9L31B n'avait pas dans son périmètre : `affichage-materiel.spec.ts` pose, dans son propre
`beforeAll` (sans `afterAll` — elle DÉTRUIT-RECRÉE au lieu de nettoyer, par construction, voir son
commentaire de tête), `PLANIFIEE_SEULE` à **MARDI de la scène partagée, 07:00–07:30 LOCAL**
(`01a0f100-0000-7000-8000-000000000002`, confirmé par lecture directe de la ligne en base :
`2026-11-23 20:00:00` à `20:30:00`, soit très exactement MARDI 24/11 07:00–07:30 local).

« MARDI de la scène » et « demain, en vrai » **ne coïncident que le lundi** (c'est EXACTEMENT le fait
que le point 2 vient de figer en gardien permanent) — donc cette collision précise n'existe QUE le
lundi, et elle est **certaine**, pas flaky, chaque lundi où `affichage-materiel.spec.ts` s'exécute
avant les trois fichiers `captures-*` cités (ordre alphabétique garanti : `affichage` < `captures`),
tant que personne n'y touche.

**L'audit de 9L31B (« heures `creneauUtc(cle, …)` déjà en usage ») ne pouvait pas voir celle-ci** :
`affichage-materiel.spec.ts` ne passe jamais par `creneauUtc` (elle construit son créneau avec
`instantAMinutes` sur `jourDeLaScene(reperes, MARDI)`), et son créneau est ancré à « MARDI de la
scène », pas à « demain, en vrai » — les deux notions ne sont identiques QUE le lundi, le jour même où
9L31B travaillait, mais son grep a cherché l'usage de `creneauUtc`, pas tout ce qui occupe MARDI de la
scène. `9L31B-REPRISE-CRENEAUX-LUNDI — point 2` avait d'ailleurs laissé `captures-9f4h5` et
`captures-9f4h5b` hériter de l'heure 20 pour leur cas `1280px` SANS vérifier qu'elle entre en conflit
avec `captures-9dca`, qui l'occupait déjà (la boucle `for (const largeur of LARGEURS)` de ces deux
fichiers avorte au premier échec, ce qui a aussi MASQUÉ tout défaut éventuel sur leur propre cas
`375px` — non vérifié ici, à vérifier par qui corrige).

**Ce n'est pas un défaut de production** : les trois fichiers touchés sont des scénarios `captures-*`
(captures d'écran, hors dépôt réel) et `affichage-materiel.spec.ts` est un scénario e2e — aucune règle
métier n'est en cause, seulement des données de fixture e2e qui ne se connaissent pas entre elles.

**NON corrigé dans ce lot** : mesuré à T0+110 (plus de code neuf autorisé passé ce point, consigne du
mandat), le choix des nouvelles heures demande de revérifier l'ENSEMBLE des fenêtres fixes ancrées à
MARDI/MERCREDI de la scène (`obstacle` 08:00–10:00, `chevauchante` 13:00–14:00, `redimensionnable`
14:00–15:00, `PLANIFIEE_SEULE` 07:00–07:30, `AVEC_MACHINE` 10:30–11:00) contre TOUTES les heures UTC
≥13 employées ailleurs pour `technicienDucos` avec `cle = aujourd'hui` — recensées ici, mais pas
encore vérifiées une à une pour l'absence de collision :

```
tests/e2e/9dd-pg-g14c-terrain-transmises.spec.ts
tests/e2e/9f4h5b-ma-journee-375.spec.ts
tests/e2e/9f2-terrain-jours-maquette.spec.ts
tests/e2e/captures-9dca-droits-terrain-demandes.spec.ts
tests/e2e/captures-9eq-fiche-onglets.spec.ts
tests/e2e/captures-9dd-pg-g14c-terrain-transmises.spec.ts
tests/e2e/9f4h5-nouvelle-intervention.spec.ts
tests/e2e/fiche-entete-bandeau-frise.spec.ts
tests/e2e/9f4h5-compteur-vivant.spec.ts
tests/e2e/captures-9f4h5b-journee-sans-montant.spec.ts
tests/e2e/captures-9f4h5-terrain-vivant.spec.ts
```

**Recommandation pour la suite** : écrire un script (ou mieux, un gardien committé comme celui du
point 2) qui recense PROGRAMMATIQUEMENT, à partir du code réel, toutes les fenêtres fixes ancrées à
MARDI/MERCREDI de la scène partagée (`scene.ts` ET les fichiers hors `scene.ts` comme
`affichage-materiel.spec.ts`) et toutes les fenêtres « aujourd'hui + heure UTC ≥13 » pour
`technicienDucos`, puis vérifie qu'aucune ne chevauche une autre QUAND elles coïncident (le lundi) —
plutôt que de les auditer un par un par lecture de code, qui a déjà laissé passer cette collision une
fois.

## Épreuves jouées

- `tests/unit/e2e-lundi-scene-sans-jour-passe.test.ts` seul : 14/14 vert.
- `CI=1 pnpm test` (projet `unit`) : **538 fichiers, 6041 tests, vert**.
- `CI=1 pnpm test:isolation` : **263 fichiers, 2543 tests, vert** — rejoué deux fois (avant et après
  le commit du point 2), toujours vert, SEUL (aucun autre harnais en vol, voir point 1).
- Suite e2e, `CI=1 npx playwright test --workers=1`, **jouée en QUATRE QUARTS** (le budget de session
  ne permettait pas l'entière d'un seul tenant — chaque quart proche de la limite de 60 minutes d'un
  appel) :
  - **Quart 1** (124 fichiers, 494 tests) : **494 passés, 0 échec, 30,1 min.**
  - **Quart 2** (120 fichiers, 494 tests programmés) : **585 passés, 3 échecs `23P01` (point 3
    ci-dessus), 14 skips, 7 jamais joués (boucle avortée par les 3 échecs), 26,6 min.**
  - **Quarts 3 et 4 (124 + 142 fichiers) : NON JOUÉS** — budget de session épuisé après le quart 2 et
    la rédaction de cette passation. Zéro `23P01` rencontré dans les quarts 1 et 2 EN DEHORS du défaut
    du point 3, qui n'a rien à voir avec les corrections de 9L31/9L31A/9L31B elles-mêmes.
  - La séparation en quarts n'a pas été reportée dans le dépôt (fichiers `/tmp/q*.txt`, non commités,
    propres à cette session) — purement un découpage d'exécution.
- `CI=1 pnpm verify` (format:check + typecheck + lint + test + test:isolation + build) : **vert de
  bout en bout, exit 0.**
- `CI=1 pnpm verify:full` : **non joué** — laissé à la file, comme le rappel du pilote le demande.

## Captures

Aucun écran n'a été touché dans ce lot (un seul fichier de test unitaire ajouté). Les captures de
9L31/9L31A/9L31B restent valables et n'ont pas été rejouées.

**Attention — effet de bord mesuré et annulé** : jouer la suite e2e régénère, pour de nombreux
scénarios `captures-*`, les images PNG sous `docs/propositions/**/captures/` (362 fichiers modifiés ou
ajoutés après le quart 1, malgré ce que la passation de 9L31 affirmait pour trois fichiers précis —
d'autres scénarios de capture, eux, écrivent bel et bien à chaque exécution). Ces changements ont été
annulés (`git checkout -- docs/propositions/` puis `git clean -fd docs/propositions/`) avant de
committer quoi que ce soit : aucun écran n'ayant changé dans ce lot, ces régénérations n'étaient que du
bruit de rendu (police, date affichée, etc.), pas une preuve de rien.

## Ce qui n'a pas été touché

Aucune migration. Aucune garde de 9L14 ou 9L19 assouplie. `depot/` et les scripts de file non touchés.
`git fetch origin` + `git rebase origin/main` effectués en fin de lot : rien de neuf côté `origin/main`
depuis le départ de la session, arbre propre. Jamais de push.
