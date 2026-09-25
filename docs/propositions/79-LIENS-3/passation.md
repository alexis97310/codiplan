# 79-LIENS-3 — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

Le lien « Fiche complète » de l'aperçu maître-détail de `/parc`
(`app/(back-office)/parc/page.tsx`) porte désormais, en plus de l'identifiant
de la machine, un paramètre `retour=<la requête active du parc, encodée>` —
composé par `retourActuelDuParc` (nouveau module `app/(back-office)/parc/
presentation.ts`), sur une LISTE FERMÉE de six clés : `q`, `statut`,
`client`, `site`, `famille`, `page` — exactement celles que `hrefDeLaLigne`
et `hrefPage` de ce même écran composent déjà pour naviguer entre ses pages.

Sur la fiche (`app/(back-office)/parc/[id]/page.tsx`), le lien
« ‹ Retour au parc » rejoue ce paramètre via `retourVersParc` — jamais
recopié tel quel : la valeur brute est rejetée EN BLOC (retour à `/parc` nu)
si elle porte `://`, `//` ou `:` (schéma d'URL détourné), puis re-filtrée
sur la MÊME liste fermée, avec une borne de longueur par valeur (200
caractères).

**Pour l'exploitation** : un technicien de bureau ou un chef d'atelier qui
filtre le parc (recherche, statut, client, site, famille) et pagine jusqu'à
une page 3, puis ouvre une fiche machine complète depuis l'aperçu, retrouve
EXACTEMENT la même vue en cliquant « ‹ Retour au parc » — il ne refait plus
sa recherche à chaque fiche consultée. La sélection du maître-détail
(`?machine=<id>`, qui vit UNIQUEMENT sur `/parc` lui-même) n'entre pas dans
cette liste fermée : ce n'est pas un filtre de recherche, mais un état
d'écran, et le titre du ticket borne explicitement « tel qu'on l'avait
laissé » aux filtres, à la recherche et à la page.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- AVANT (lecture du code, main à `b2e3da5` avant ce lot, correspondant à
  `876db2e` + les lots 76/77 déjà mergés) : le lien « Fiche complète »
  rendait toujours `/parc/${selection.id}` nu (`page.tsx` l.436), et le lien
  « Retour » de la fiche rendait toujours `/parc` nu (`[id]/page.tsx`
  l.216-218) — vérifié en lisant les deux fichiers avant modification.
- APRÈS : `pnpm exec vitest run tests/unit/parc/retour-parc.test.ts` — 14
  tests neufs, tous verts (requête active vide, conservation des six clés,
  rejet de `machine` (pas un filtre), paramètre répété (premier élément),
  absence/vide de `retour`, conservation, retrait d'un paramètre inconnu et
  de `machine`, recomposition dans l'ordre fermé quel que soit l'ordre reçu,
  rejet en bloc de `https://x.y`, `//x` et `javascript:alert(1)`, troncature
  d'une valeur démesurée).
- `pnpm exec playwright test tests/e2e/liens-3.spec.ts` — 3 tests, tous
  verts : retour depuis la page 2 (`q=LIE3-&page=2`, 51 machines forgées
  pour forcer une page 2 d'une seule ligne) rejoint bien `q=LIE3-&page=2` ;
  sans `retour` dans l'URL, comportement inchangé (`/parc` nu) ; un `retour`
  forgé (`https://exemple-etranger.test`) ne mène jamais hors du parc.
- Non-régression : `pnpm exec playwright test tests/e2e/parc.spec.ts
  tests/e2e/parc-apercu-borne.spec.ts tests/e2e/liens-fiches.spec.ts` — 9
  tests, tous verts (ces trois fichiers touchent aux mêmes écrans et n'ont
  pas été modifiés).
- `pnpm verify` rejoué en entier après les commits : vert — format:check,
  typecheck, lint (0 avertissement), `pnpm test` (262 fichiers, 2819 tests),
  `pnpm test:isolation` (125 fichiers, 1234 tests), build de production.

## Ce que j'ai tranché et pourquoi

- **Un module SÉPARÉ, `app/(back-office)/parc/presentation.ts`, jamais un
  import depuis `app/(back-office)/interventions/presentation.ts`.** Ce
  dernier module porte déjà `retourActuelDuRegistre`/`retourVersRegistre`
  (78-LIENS-2), mais au 25/09/2026 ce lot vit sur une branche NON fusionnée
  dans `main` (`78-LIENS-2-garde`) — `git merge-base --is-ancestor` le
  confirme. Le ticket conditionnait la reprise à « si publié » ; ne l'étant
  pas, je n'ai rien pu importer d'une branche qui n'existe pas pour `main`.
  Même si elle avait été publiée, le PARC et le REGISTRE ne lisent pas la
  même liste de paramètres (six contre dix, aucun commun sauf `q` et
  `page`) : un module séparé, comme le dépôt le fait déjà pour
  `referenceMachine`/`lieuAffiche`/`numeroDeSerieAffiche` recopiés entre
  `/parc` et `/parc/[id]` plutôt que partagés.
- **`machine` (la sélection du maître-détail) est volontairement ABSENTE de
  la liste fermée**, alors que `/parc` la lit bien depuis `searchParams`.
  Le titre du ticket borne lui-même « tel qu'on l'avait laissé » à
  « (filtres, recherche, page) » — la sélection n'est ni un filtre ni un
  critère de recherche, c'est un état d'écran propre à `/parc`. Je ne l'ai
  pas élargie de ma propre initiative (même discipline que 78-LIENS-2, qui
  a refusé d'ajouter `inclure_clients_inactifs` à sa propre liste fermée).
- **`retourActuelDuParc` prend les valeurs BRUTES de `searchParams`**,
  jamais les critères déjà validés par `schemaRechercheParc` — même
  prudence que `retourActuelDuRegistre` pour `du`/`au` (qui deviennent des
  `Date` une fois analysés), même si `/parc` ne porte aujourd'hui aucun
  champ de date dans sa recherche.
- **Rejet en bloc sur `://`, `//` ou `:`**, comme 78-LIENS-2 : aucune des
  six clés connues ne porte légitimement un de ces trois motifs (UUID sans
  deux-points, entier, texte de recherche libre).
- **La scène e2e force 51 machines** (`NOMBRE_MACHINES`) sur un seul client
  `LIE3-Client de l'épreuve` : c'est le nombre minimal pour qu'une page 2
  existe et ne contienne qu'UNE seule ligne
  (`LIMITE_RECHERCHE_PAR_DEFAUT = 50`), ce qui rend l'assertion
  `toHaveCount(1)` sans ambiguïté — même construction que `liens-2.spec.ts`
  et `registre-3.spec.ts`. Chaque machine porte un `numero_serie` distinct
  (`LIE3-SN-<i>`) pour respecter l'unicité `(societe_id, modele_id,
  numero_serie)` (D6) ; la recherche `q=LIE3-` les trouve toutes par la
  raison sociale du client, pas par le numéro de série.
- **Le préfixe `LIE3-` est collé sans espace** dans les fixtures, comme
  `liens2.e2e.*` — un espace avant le trait d'union romprait la sous-chaîne
  que `filtreDuParc` compare.

## Ce que je n'ai PAS fait

- Je n'ai touché ni `lib/machines/depot.ts`, ni `prisma/`, ni aucun autre
  écran (`/planning`, `/clients/[id]`, `/sites/[id]`, `/interventions`) : le
  territoire du ticket est respecté à la lettre.
- Je n'ai pas ajouté `machine` à la liste fermée du retour (voir « Ce que
  j'ai tranché »).
- Je n'ai pas fusionné `78-LIENS-2-garde` dans `main` : ce n'est pas le
  territoire de ce ticket, et la file (`11-FILE.sh`) s'en charge selon son
  propre calendrier.

## Les pièges pour la session suivante

- **`78-LIENS-2` n'est pas sur `main` au 25/09/2026** malgré son numéro de
  ticket antérieur à celui-ci — vérifier avec `git merge-base --is-ancestor
  <sha> HEAD` avant de supposer qu'un lot numéroté plus bas est déjà
  fusionné. Si `78-LIENS-2-garde` est fusionné avant qu'un futur ticket
  touche encore `/parc` ou un autre écran à liste+fiche, il vaut la peine de
  vérifier si `retourActuelDuRegistre`/`retourVersRegistre` méritent d'être
  généralisés en un seul module paramétré par chemin et liste de clés —
  aujourd'hui, DEUX écritures quasi identiques existent (`interventions/
  presentation.ts` et `parc/presentation.ts`), la même retenue que ce dépôt
  assume déjà pour `referenceMachine` recopié plutôt que partagé, mais que
  le §9 du 01/09 met en garde de ne pas laisser diverger sans y revenir.
- **Le maître-détail de `/parc` a DEUX familles de liens vers une machine** :
  ceux qui restent SUR `/parc` (`hrefDeLaLigne`, `?machine=<id>`, la
  sélection dans la liste) et celui qui MÈNE à `/parc/<id>` (« Fiche
  complète », seul lien touché par ce ticket). Un futur ticket qui ajouterait
  un second lien vers `/parc/<id>` (ex. depuis une ligne du tableau, si la
  disposition change) devra lui aussi porter `retour=`.

## Ce qui reste à faire

Rien d'identifié pour ce ticket : le territoire annoncé (le lien « Fiche
complète » de `/parc` et le lien « Retour » de `/parc/[id]`) est couvert,
testé (unitaire et bout en bout), et `pnpm verify` est vert.
