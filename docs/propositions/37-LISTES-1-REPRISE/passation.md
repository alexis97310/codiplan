# 37-LISTES-1-REPRISE — passation

Reprend le travail de la branche locale `36-LISTES-1-garde` (rejeté deux fois
par `pnpm verify:full` de la file sur une seule épreuve rouge), le rebase sur
`main` à jour (`37-AFFICHAGE-MATERIEL-1` inclus), mesure la cause exacte du
rouge et la corrige.

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

- **Fusion (`git merge --no-ff`) de `36-LISTES-1-garde` dans une branche
  neuve depuis `main`** — aucun conflit : les deux lots touchent des écrans
  disjoints (`sites`/`clients`/`parc` contre `planning`/`interventions`).
  Tout le contenu fonctionnel de LISTES-1 décrit dans
  `docs/propositions/36-LISTES-1/passation.md` (compteurs d'équipements,
  masquage par défaut, recherche par client, tri alphanumérique, filtres du
  parc) est repris tel quel — voir ce fichier pour le détail, non répété ici.
- **`tests/e2e/setup/scene.ts` gagne une fixture dédiée,
  `SCENE.redimensionnable`** (Ducos, technicien de Ducos, MARDI 14:00–15:00),
  et `tests/e2e/glisser-deposer.spec.ts` (« la poignée ALLONGE une
  intervention, et la base le garde ») s'en sert désormais au lieu de
  `SCENE.chevauchante`. *Pour l'exploitation* : rien ne change à l'écran —
  c'est un changement de fixture d'épreuve, aucun fichier `app/` ni `lib/`
  n'est touché par ce commit-ci. Ce qui change, c'est la fiabilité de
  `pnpm verify:full` : une épreuve du planning qui rougissait de façon
  reproductible ne le fait plus.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- **La cause exacte du rouge, trouvée par lecture du code, pas par
  supposition.** `tests/e2e/glisser-deposer.spec.ts:320` (« la poignée
  ALLONGE une intervention ») fait glisser la poignée de `SCENE.chevauchante`
  (créée à 13:00–14:00, 60 min) jusqu'à la case de 14:00, ce qui l'ALLONGE à
  13:00–14:30 (90 min, le pas de la grille étant de 30 min) — et **rien dans
  ce fichier ni ailleurs ne la ramène jamais à sa durée d'origine.** C'est une
  mutation PERMANENTE d'une ligne que `tests/e2e/planning-largeur-et-carte.spec.ts`
  lit, elle, pour calculer la durée ATTENDUE d'une carte (`beforeAll`, lecture
  Prisma directe de `SCENE.chevauchante`). Sous `fullyParallel: true` et
  `workers: undefined` en local (`playwright.config.ts:55,58` — seule la CI
  force `workers: 1`), les deux fichiers tournent en même temps : quand la
  lecture `beforeAll` de `planning-largeur-et-carte.spec.ts` tombe AVANT le
  redimensionnement et que l'assertion à l'écran tombe APRÈS, l'attendu
  (« 1 h 00 », lu tôt) et le rendu (« 1 h 30 », lu tard) divergent — exactement
  le symptôme constaté deux fois à l'identique par la file (`journal-file.txt`,
  23/09 14h44).
- **Reproduction ciblée AVANT correctif** : `pnpm exec playwright test
  tests/e2e/glisser-deposer.spec.ts tests/e2e/planning-largeur-et-carte.spec.ts`
  (9 workers, en parallèle) — 16/16 vertes cette fois-ci (l'ordonnancement des
  deux fichiers ne les a pas fait se chevaucher sur cette exécution ; la panne
  dépend de l'ordonnancement des *neuf* workers face à *tous* les fichiers de
  la suite, pas seulement ces deux-là — je n'ai donc PAS reproduit le rouge
  moi-même avant correctif, seulement identifié sa cause par lecture).
  **Ceci est une mesure non concluante, pas une confirmation** : je l'écris
  ici pour que la session suivante sache que la reproduction ciblée à deux
  fichiers ne suffit pas à juger si la cause est la bonne.
- **APRÈS correctif**, `pnpm verify:full` rejoué EN ENTIER : `format:check`,
  `typecheck`, `lint`, tests unitaires et `build` verts (`pnpm verify`,
  code de sortie 0), `feries:horizon` vert (2 territoires, ≥ 12 mois
  d'avance), `audit:partitions` vert (13 partitions, 0 ligne dans la
  partition par défaut), et **`pnpm test:e2e` complet : 183 scénarios
  passés, 3 sautés (inchangé depuis la mesure de 36-LISTES-1), 0 rouge** — y
  compris `planning-largeur-et-carte.spec.ts:167` (« dans la grille (lg+), une
  carte affiche le site et la durée connue ») et les deux scénarios de
  `glisser-deposer.spec.ts` qui touchent au redimensionnement, tous deux
  vérifiés individuellement en amont (8/8 vertes, fichier seul, 1 worker).
- **Avant de lancer la moindre épreuve**, `pnpm exec playwright test` a
  d'abord échoué au SEMIS (`P2022`, colonne `intervention.description`
  introuvable) — un client Prisma généré depuis un `schema.prisma` différent
  de celui du dépôt, pas une régression de ce lot. `pnpm db:generate` l'a
  réglé ; **ceci n'a touché aucun fichier versionné**, c'est un état local du
  poste, à refaire si un autre poste bute dessus après un `git pull` qui
  change `prisma/schema.prisma` sans que `postinstall` ait tourné.

## Ce que j'ai tranché et pourquoi

- **Fixture dédiée plutôt que remise en état en fin d'épreuve.** Le ticket
  proposait trois pistes : identifiants propres, remise en état, ou scène
  dédiée. Une remise en état (redimensionner en sens inverse après
  l'assertion) aurait laissé la fenêtre de course ouverte pendant TOUTE la
  durée où `chevauchante` est effectivement à 90 min — et rien ne garantit
  que cette fenêtre soit plus courte que celle observée en file : deux rouges
  identiques suggèrent un ordonnancement des workers assez stable pour que la
  fenêtre soit franchie à chaque exécution, pas un hasard rare. Une fixture
  dédiée, jamais lue par aucun autre fichier, ferme la fenêtre entièrement
  plutôt que de la raccourcir.
- **La nouvelle fixture est posée à 14:00–15:00, immédiatement APRÈS
  `chevauchante` (13:00–14:00), sur le même technicien.** Choix par mesure,
  pas par confort : le témoin du scénario existant vérifiait déjà, avant tout
  changement, que la case de 14:00 était libre pour ce technicien ce jour-là
  (`occupe(..., 14*60, ...)` à `toHaveCount(0)` avant le glisser) — la plage
  est donc déjà connue disponible et dans la grille ouverte, sans mesure
  supplémentaire à faire sur les horaires de l'agence.
- **Seule l'épreuve « la poignée ALLONGE » change de fixture.** J'ai vérifié
  qu'aucune autre épreuve, dans ce fichier ou ailleurs, ne dépend d'une
  mutation DURABLE de `chevauchante` : les autres glissers sur
  `SCENE.chevauchante` sont tous REFUSÉS (chevauchement, erreur serveur,
  connexion interrompue) ou immédiatement inversés par le refus lui-même —
  aucun n'altère la ligne en base. `chevauchante` reste donc, après ce
  correctif, strictement identique à ce que `ecrireLaScene()` écrit, du début
  à la fin de la suite.

## Ce que je n'ai PAS fait

- **Je n'ai pas reproduit le rouge moi-même avant correctif** en rejouant
  `pnpm test:e2e` en entier plusieurs fois (le temps du lot ne le permettait
  pas à ce prix — chaque exécution complète prend environ 2,7 minutes rien
  que pour Playwright, sans compter le reste de `verify:full`). La cause
  retenue vient d'une lecture du code, pas d'une reproduction contrôlée du
  symptôme suivie d'une contre-épreuve sans le correctif.
- **Je n'ai pas cherché d'autres fixtures partagées mutées de façon
  similaire** ailleurs dans `tests/e2e/setup/scene.ts` ou dans les autres
  fichiers de scénario — seule la piste nommée par le ticket (le rouge exact
  mesuré le 23/09 à 14h44) a été creusée. Un audit plus large des mutations
  durables sur des fixtures partagées, sous `fullyParallel`, reste à faire.
- **Je n'ai pas modifié `36-LISTES-1-garde`** : la branche locale reste en
  l'état, non poussée, non supprimée.
- **Rien de ce que `docs/propositions/36-LISTES-1/passation.md` déclare
  « non fait »** n'a été repris ici (confirmation collation base hébergée,
  décision sur l'ordre du parc, composant de recherche filtrante) — hors
  territoire de cette reprise, qui portait sur l'épreuve rouge seule.

## Les pièges pour la session suivante

- **`pnpm exec playwright test <deux fichiers>` en parallèle ne suffit pas à
  reproduire une panne d'ordonnancement à l'échelle de la suite complète.**
  183 scénarios répartis sur N workers ne s'ordonnancent pas comme 16
  scénarios sur 9 — une reproduction ciblée verte n'est PAS une preuve
  d'absence de course ; seul `pnpm test:e2e` complet, plusieurs fois, ou une
  lecture du code qui trouve la mutation non réversible, le sont.
- **Toute fixture de `tests/e2e/setup/scene.ts` lue par plus d'un fichier de
  scénario est un risque de course dès qu'un AUTRE fichier la mute de façon
  durable** (voir la mémoire `e2e-semis-partage-parallele` : « un spec qui
  compte pose SON site »). Avant d'ajouter un glisser-déposer, un
  redimensionnement, ou toute écriture sur une ligne de `SCENE`, vérifier
  d'abord si un autre fichier lit cette même ligne pour en afficher une
  valeur — durée, position, statut.
- **Si `pnpm exec playwright test` échoue dès le semis avec `P2022` sur une
  colonne introuvable**, le client Prisma généré est périmé face au
  `schema.prisma` courant : `pnpm db:generate` (ou tout simplement
  `pnpm install`, qui le déclenche via `postinstall`) avant de chercher plus
  loin.

## Ce qui reste à faire

- **Confirmer par une exécution répétée de `pnpm test:e2e` complet** (au
  moins deux ou trois fois de suite, hors du budget de ce lot) que la
  disparition de la fenêtre de course est stable et pas seulement favorable
  une fois.
- **Auditer plus largement `tests/e2e/setup/scene.ts`** pour d'autres
  fixtures partagées mutées de façon durable par un fichier alors que
  d'autres en dépendent en lecture — voir « ce que je n'ai pas fait ».
- Tout ce que `docs/propositions/36-LISTES-1/passation.md` laisse en
  suspens (collation de la base hébergée, ordre du parc à confirmer auprès
  d'Alexis, composant de recherche filtrante) reste entier et n'a pas été
  retouché par cette reprise.
