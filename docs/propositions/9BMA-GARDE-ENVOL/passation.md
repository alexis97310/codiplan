# Passation — 9BMA-GARDE-ENVOL

Territoire : `tests/unit/planning/pose.test.tsx` (ajout), une ligne de
`docs/propositions/9BM-PG-G7-ANNULER-DUREE-CREATION/passation.md` (§6, correction), cette
passation. Aucun fichier de `components/` ni `app/` ne change dans le commit (voir « ce que j'ai
mesuré » pour le détour de démonstration, non commité). Aucun écran touché : pas de capture.

Un PRÉALABLE (date du jour tombant sur le mardi visé par `planning-fenetre-pose.spec.ts`) était déjà
corrigé sur `main` avant cette session — commits `3a92dea` et `35cf6ab`, tous deux antérieurs à ce
lot. Rien à refaire de ce côté : vérifié par `git log --oneline -- tests/e2e/planning-fenetre-pose.spec.ts`.

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

`tests/unit/planning/pose.test.tsx` gagne un nouveau `describe` (« LA GARDE \`enVol\` (D-06) —
RÉTABLIE APRÈS 9BM (9BMA-GARDE-ENVOL) »), deux `it` :

1. Un dépôt DIFFÉRÉ (bord « bloc », le chemin normal d'un glisser-déposer direct depuis PG-B5) :
   pendant qu'une première requête `/deplacer` est EN VOL (promesse non résolue), un second dépôt de
   la MÊME intervention pose une nouvelle minuterie, mais à son échéance la garde `enVol`
   (`components/planning/pose.tsx:500-512`) empêche une seconde requête concurrente — le décompte du
   `fetch` simulé reste à 1. Une fois la première réponse résolue, un dépôt suivant envoie bien une
   requête neuve (décompte à 2).
2. Le même contrôle pour un REDIMENSIONNEMENT (bord « fin », écriture immédiate — pas de minuterie) :
   la même garde bloque un second redimensionnement tant que le premier n'est pas retombé, puis
   laisse repartir une requête neuve.

Pour l'exploitation : rien ne change dans le comportement de l'application — la garde `enVol`
existait déjà (posée par D-06, jamais retirée). Ce qui change, c'est qu'un futur ticket qui
retirerait ou casserait cette garde par erreur (comme 9BM l'a fait sans le savoir, en réécrivant le
test qui la couvrait sans en garder l'épreuve) fera à nouveau rougir `pnpm test`.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- `grep -n enVol tests/unit/planning/pose.test.tsx` — AVANT (sur `main`, avant ce lot) : 1 occurrence,
  un commentaire seul (ligne 390, qui NOMME `enVol` sans l'éprouver). APRÈS : 6 occurrences, dont le
  titre du nouveau `describe` et 4 commentaires qui l'éprouvent effectivement.
- `pnpm exec vitest run tests/unit/planning/pose.test.tsx` — AVANT ce lot : 16 tests, tous verts.
  APRÈS l'ajout des deux nouveaux `it` : 18 tests, tous verts.
- **La preuve que les deux nouveaux tests mordent** (étape 2 du ticket, détour NON commité) : dans
  `components/planning/pose.tsx`, la garde `if (enVol.current.has(main.id))` a été temporairement
  changée en `if (false && enVol.current.has(main.id))`. Rejoué : les deux nouveaux `it` rougissent
  (`expected "vi.fn()" to be called 1 times, but got 2 times`, sur la ligne qui vérifie qu'aucune
  seconde requête n'est partie pendant que la première vole), les 16 autres restent verts. La garde a
  ensuite été remise à l'identique (`git diff --stat components/planning/pose.tsx` vide après le
  détour, confirmé), et les 18 tests repassent verts.
- `pnpm format:check` et `pnpm test` (suite complète) : vérifiés avant le commit.

## Ce que j'ai tranché et pourquoi

1. **Les deux nouveaux tests visent le chemin ACTUEL (post-PG-B5), pas l'ancien comportement
   d'écriture immédiate d'avant PG-B5.** Le ticket demande d'éprouver la garde « avec le délai
   actuel » : pour le dépôt différé, cela veut dire avancer les minuteries simulées de
   `DELAI_DEPLACEMENT_DIFFERE_MS` (jamais `10000` en dur) pour que la première requête parte, avant
   de tester le second dépôt.
2. **Nouveau `describe` plutôt qu'ajout dans le bloc « UN GESTE RÉPÉTÉ REMPLACE LE PRÉCÉDENT » de
   9BM.** Ce bloc-là éprouve le REMPLACEMENT de la minuterie (une seule requête part, à l'échéance du
   SECOND dépôt, si les deux dépôts arrivent avant que la première minuterie n'ait sonné) — un
   mécanisme différent de la garde `enVol` (qui protège contre deux requêtes CONCURRENTES une fois
   qu'une première est déjà partie). Les confondre dans un seul bloc aurait rendu moins lisible lequel
   des deux mécanismes est éprouvé par quel `it`.
3. **Contrôle du redimensionnement ajouté via un `dataTransfer` construit à la main
   (\`dataTransferDeRedimensionnement\`, bord \`"fin"\`) plutôt qu'en simulant le glissé de la
   poignée.** `CasePosable.onDrop` lit `lireLaMain(evenement.dataTransfer)` sans se soucier de
   comment le glissé a commencé — le comportement éprouvé (`deposer` routant vers l'écriture
   immédiate quand `main.bord === "fin"`) est identique, et ce raccourci évite de reproduire toute la
   mécanique de `BlocPosable.avecRedimensionnement` dans le test.

## Ce que je n'ai PAS fait

- Je n'ai pas retiré le test de 9BM sur le remplacement de la minuterie (« UN GESTE RÉPÉTÉ REMPLACE
  LE PRÉCÉDENT... ») : demandé explicitement par le ticket.
- Je n'ai touché aucun fichier de `components/` ni `app/` dans le commit final — le changement dans
  `components/planning/pose.tsx` qui a servi à démontrer que les tests mordent a été entièrement
  annulé avant le commit.
- Je n'ai pas rejoué le PRÉALABLE de ce ticket (dates futures pour `planning-fenetre-pose.spec.ts`) :
  déjà réglé par une session antérieure sur `main` (voir l'entête de cette passation). Je n'ai pas non
  plus refait le grep `jourDeLaScene(` demandé par le PRÉALABLE sur les autres fichiers e2e
  (`fiche-trouver-creneau`, `glisser-deposer`) : hors du territoire de CE ticket (qui porte sur
  `tests/unit/planning/pose.test.tsx`), et déjà couvert par la session qui a livré `3a92dea`/`35cf6ab`
  — non revérifié par moi.

## Les pièges pour la session suivante

- **`enVol` et le remplacement de minuterie (PG-B5) sont deux gardes DISTINCTES dans `deposer`** :
  la première (`ecrire`, ligne ~502) empêche deux requêtes concurrentes pour le même `id` ; la
  seconde (`deposer`, ligne ~601) remplace une minuterie non encore échue par une nouvelle. Un futur
  changement qui fusionnerait ou simplifierait ce mécanisme doit garder les deux `describe` de ce
  fichier verts séparément — perdre l'un en modifiant l'autre serait la même erreur que 9BM.
- **`dataTransferDeRedimensionnement` ne passe pas par la poignée UI réelle** (pas de
  `avecRedimensionnement`, pas de `stopPropagation`) — un futur test qui voudrait éprouver la poignée
  elle-même (le `data-poignee`, le `stopPropagation` qui empêche le bloc entier d'engager un
  déplacement) doit construire sa propre scène avec `avecRedimensionnement={true}`, celle-ci ne le
  fait pas.

## Ce qui reste à faire

- Rien d'identifié comme bloquant pour ce ticket.
