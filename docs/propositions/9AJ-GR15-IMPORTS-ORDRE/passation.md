# 9AJ-GR15-IMPORTER-APRES — passation

## Ce que j'ai changé

L'écran `/imports` disait déjà QUELS types de fichiers on peut déposer, mais
jamais dans quel ORDRE les déposer. Un opérateur qui charge les équipements
avant les clients et les sites se heurtait à des rejets `parent_introuvable`
sans qu'aucun écran ne l'ait prévenu de l'ordre à respecter.

Deux changements :

1. `app/(back-office)/imports/types.ts` : `TypeDImport` porte un nouveau champ
   `importerApres: readonly string[]`, renseigné pour les dix types d'après
   les dépendances réelles lues dans `gabaritsPublies`
   (`lib/imports/modeles.ts` l.2238-2250) — chaque valeur commentée avec la
   ligne qui la fonde. Une fonction pure `ligneImporterApres(type)` compose le
   rappel depuis les titres des préalables (`titreDuType`, jamais un mot en
   dur), `null` pour les deux racines (clients, familles).
2. `app/(back-office)/imports/page.tsx` : sous le détail de chaque type, une
   ligne `data-importer-apres` affiche ce rappel quand il n'est pas `null`.

Pour l'exploitation : un opérateur qui ouvre l'écran voit maintenant, à côté
de « Équipements », « À importer après : Clients, Sites, Modèles de
matériel » — sans avoir à deviner l'ordre en lisant les rejets d'un lot déjà
raté.

Aucune migration, aucune règle de gestion changée : la ligne informe, elle
ne bloque ni ne réordonne rien. L'ordre de la liste elle-même est inchangé.

## Ce que j'ai mesuré

- AVANT (`git stash` du seul `page.tsx`, sur le commit qui ne porte que la
  donnée) : `li[data-type="equipements"] [data-importer-apres]` — 0 élément,
  captures `docs/propositions/9AJ-GR15-IMPORTS-ORDRE/captures/imports-ordre-avant-{1280,375}.png`.
- APRÈS (commit `058d3be`) : le même sélecteur — 1 élément, contenant les
  titres composés des clients, des sites (mot imposé, `mot("site", true)`) et
  des modèles de matériel, captures
  `imports-ordre-apres-{1280,375}.png`.
- `pnpm format:check`, `pnpm typecheck`, `pnpm test` (2972 tests) verts avant
  chaque commit ; `CI=1 pnpm verify:full` vert en un seul appel au premier
  plan après le second commit (365 tests e2e passés, 3 ignorés — le compte
  habituel du dépôt, sans rapport avec ce lot).

## Ce que j'ai tranché, et pourquoi

- **La clé de jointure de la liste** : aucun des trois `ponctuation.*`
  existants (`separateur`, `deux_points`, `point_median`) ne convient — les
  trois relient un COUPLE (libellé — valeur, ou identifiant · lieu), jamais N
  éléments d'une liste. J'ai ajouté `ponctuation.virgule": ", "`, à côté des
  trois autres et avec la même forme de commentaire qu'elles portent déjà.
- **Le texte du rappel lui-même** est celui donné dans le ticket telle
  quelle : `"imports.type.importer_apres": "À importer après :"` — le deux-
  points fait partie de la valeur, pas une composition avec
  `ponctuation.deux_points` (cette dernière est réservée aux puces « libellé
  : valeur », une forme différente).
- **Les agences** ne figurent dans aucune liste `importerApres` : ce sont un
  paramètre de société, pas un type d'`TYPES_DIMPORT` (absentes de la liste
  d'imports), bien qu'elles soient un second paramètre de `modeleSites`.
- **Pas de scène e2e** : l'écran des imports liste des TYPES, une donnée
  statique de dépôt, jamais une ligne créée par un scénario — donc le spec
  `tests/e2e/imports-ordre.spec.ts` ne fabrique et ne nettoie rien.

## Ce que je n'ai PAS fait

- Aucun contrôle nouveau au dépôt d'un fichier : l'ordre reste une
  INFORMATION, pas une validation — c'est ce que dit le ticket
  (« aucun ordre n'est imposé »).
- Aucun changement à `lib/imports/modeles.ts` (lecture seule, comme prescrit).
- Aucun changement au motif de rejet `parent_introuvable` (9AK, hors lot).
- Le test unitaire de cycle (`atteintDepuis`) vérifie qu'aucun type ne se
  redésigne lui-même comme préalable, direct ou indirect ; il n'a rien
  trouvé à signaler puisque la table mesurée est un graphe acyclique (les
  dix types se répartissent en rangs stricts : racines, puis un à trois
  niveaux de dépendance).

## Pièges pour la session suivante

- Le fichier `tests/unit/imports/types-dimport.test.ts` mélangeait déjà des
  imports triés par ESLint (`cleDuMotif` avant `cleDuStatut`) — j'ai laissé
  `pnpm format:check`/`eslint` réordonner `ligneImporterApres` et
  `titreDuType` dans le bloc d'import : ne pas les réordonner à la main.
- Pour reproduire les captures AVANT/APRÈS : `git stash push -- "app/(back-office)/imports/page.tsx"`
  isole la donnée du rendu, capture, puis `git stash pop` — le mode
  `CAPTURES_IMPORTS_ORDRE=<dossier>` du spec écrit les PNG AVANT les
  assertions, donc la capture survit même quand l'assertion qui suit rougit
  (cas de l'AVANT, où la ligne n'existe pas encore).
- `pnpm test` seul (sans le serveur e2e) suffit pour valider `types.ts` et le
  dictionnaire ; `verify:full` reste la seule porte qui rejoue vraiment
  l'écran par Playwright.

## Ce qui reste à faire

- Rien d'identifié dans le périmètre de ce ticket. Les pistes hors territoire
  et déjà nommées ailleurs : le motif de rejet `parent_introuvable` pour les
  sites ne nomme qu'un des deux parents (limite déjà annoncée dans
  `motifParentIntrouvable`, condition de réouverture inchangée) — 9AK ;
  les modèles Excel téléchargeables (⚠, C2) restent inertes, sans lien avec
  ce lot.
