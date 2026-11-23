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

## Reprise 9L32A-REPRISE-COLLISIONS-LUNDI

### Reprise de branche

`origin/main` au moment de la reprise était exactement `git merge-base origin/main
9L32-PETITS-DEFAUTS-ET-LUNDI-garde` (comme pour 9L31B) : aucun commit publié entre-temps, donc la
branche `9L32A-REPRISE-COLLISIONS-LUNDI` a été créée DIRECTEMENT sur la pointe de `-garde`, sans
cherry-pick ni conflit.

### Point 2 — la collision « un lundi » corrigée, PUIS une seconde du même genre trouvée en rejouant

**Cause confirmée (et corrigée) en rejouant les quatre fichiers ensemble, un LUNDI RÉEL
(23/11/2026)** : `affichage-materiel.spec.ts` réserve en permanence (aucun `afterAll`, par
construction, voir son en-tête) deux fenêtres pour `technicienDucos` sur MARDI de la scène
(`PLANIFIEE_SEULE` 07:00–07:30 LOCAL, `AVEC_MACHINE` 10:30–11:00 LOCAL) — qui ne coïncident avec
« demain, en vrai » QUE le lundi. Trois scènes `captures-*` posaient le même technicien à l'heure UTC
20 (→ LOCAL 07:00–08:00 de demain, chevauche `PLANIFIEE_SEULE`) et, masqué par l'avortement de boucle
que 9L32 avait relevé sans le vérifier, à l'heure UTC 23 pour le cas `375px` de
`captures-9f4h5-terrain-vivant.spec.ts` (→ LOCAL 10:00–11:00 de demain, chevauche `AVEC_MACHINE`,
confirmé en tricycle par calcul, non par un `23P01` qui aurait fallu reproduire). Heures déplacées
à 13–16 (toujours avant l'ouverture, hors de toute fenêtre réservée de MARDI : obstacle 21–23,
`PLANIFIEE_SEULE` 20, `AVEC_MACHINE` 23). Rejoué ensemble (`affichage-materiel.spec.ts` +
les trois `captures-*`) un LUNDI RÉEL : **16/16 verts, zéro `23P01`.**

**Recherche d'une autre paire du même genre (demandée par le mandat)** : `parc-apercu-borne.spec.ts`
et `bon-intervention.spec.ts` détruisent-recréent aussi leur fixture sans `afterAll` (même geste
qu'`affichage-materiel.spec.ts`), mais aucun des deux ne pose `creneau_debut`/`creneau_fin` avec un
`technicien_id` — hors du périmètre de la contrainte d'exclusion, donc rien à corriger là.

**Une SECONDE paire du même genre, trouvée en rejouant le quart 3, pas par relecture de code** : la
suite a franchi MINUIT EN COURS D'EXÉCUTION (la session a débuté un lundi 22h52, le quart 3 a tourné
après minuit, devenu mardi). `fiche-entete-bandeau-frise.spec.ts` et `captures-9eq-fiche-onglets.spec.ts`
lisent tous deux « aujourd'hui » EN DIRECT et posent `technicienDucos` à l'heure UTC 3 — qui retombe,
en LOCAL, sur 14:00–15:00 quand « aujourd'hui » devient MARDI de la scène, exactement le créneau que
`redimensionnable` (scène partagée) réserve pour ce même technicien sur MARDI. `23P01` mesuré sur
`fiche-entete-bandeau-frise.spec.ts` (ligne 181, retry compris). Même famille que le point précédent
(fixture éphémère « aujourd'hui » contre fixture persistante de la scène), déclencheur différent
(minuit franchi, pas « lundi »). Heure déplacée à 9 dans les deux fichiers — vérifié hors de toute
fenêtre de MARDI. Rejoué isolément (hors minuit) : **47/47 verts.**

**Non recherché par relecture exhaustive** : d'autres paires qui ne se révéleraient QUE si la suite
franchit encore minuit, ou QUE si elle tourne un autre jour de semaine particulier — le mandat suivant
qui rejoue la suite entière au complet, à une heure différente, pourrait en révéler d'autres. Aucun
gardien permanent n'a été écrit pour cette classe de défaut (contrairement au point 2 de 9L32 pour
`lundiSansJourPasse`) — recommandation reprise de 9L32 : un script qui recense PROGRAMMATIQUEMENT
toutes les fenêtres fixes du même technicien plutôt que de les trouver un `23P01` à la fois.

### Point 3 — localisateurs de la même famille

Aucun écran, libellé ou bouton n'a été touché dans ce lot (seules des heures de fixture e2e). Rien à
rendre précis ici.

### Épreuves jouées

- Les quatre fichiers du point 2 (point initial) rejoués ensemble sur le LUNDI RÉEL : **16/16 verts**.
- Suite e2e entière, `CI=1 npx playwright test --workers=1`, en QUATRE QUARTS :
  - **Quart 1** (124 fichiers, 494 tests) : **494 passés, 0 échec, 28,1 min.**
  - **Quart 2** (120 fichiers, 609 tests programmés) : **595 passés + 14 skips = 609, ZÉRO échec,
    24,9 min** — c'est exactement le quart qui portait les 3 `23P01` avant correction : confirmé
    résolu.
  - **Quart 3** (123 fichiers) : interrompu par le `23P01` du point 2 (second cas, ci-dessus) après
    428 tests passés, 2 skips, 6 non joués. **NON REJOUÉ EN ENTIER après la correction** — seul le
    fichier en cause, revérifié isolément (47/47 verts, voir ci-dessus) ; budget de session épuisé
    avant d'avoir pu relancer le quart complet.
  - **Quart 4 (143 fichiers) : NON JOUÉ** — budget épuisé.
- `CI=1 pnpm test` (projet `unit`) : **538 fichiers, 6041 tests, vert.**
- `CI=1 pnpm test:isolation` : **263 fichiers, 2543 tests, vert** — joué seul, aucun `playwright`
  en vol.
- `CI=1 pnpm verify` (format:check + typecheck + lint + test + test:isolation + build) : **vert de
  bout en bout** (build terminé sans erreur après les étapes précédentes, toutes vertes).
- `CI=1 pnpm verify:full` : **non joué** — laissé à la file, comme le rappel du pilote le demande.

**Pour la suite** : rejouer les quarts 3 (en entier) et 4 avant de considérer la suite e2e
intégralement propre — rien n'indique un défaut dans ce qui n'a pas été rejoué, mais rien ne le
garantit non plus tant que ce n'est pas mesuré.

### Captures

Aucun écran touché dans ce lot (fixtures e2e seulement) — rien à capturer. Les captures des lots
précédents (9L31/9L31A/9L31B/9L32) restent valables.

### Ce qui n'a pas été touché

Aucune migration. Aucune garde assouplie, aucune assertion retirée ni élargie. `depot/` et les
scripts de file non touchés. Jamais de push.
