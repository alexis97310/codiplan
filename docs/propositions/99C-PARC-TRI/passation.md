# 99C-PARC-TRI — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

`lib/machines/depot.ts` (`rechercherLeParc`) :

- **L'ordre à l'intérieur de chaque groupe `complet` change.** Il était
  `numero` (desc) puis `numero_serie` (asc) — deux identifiants qui ne
  disent rien du client. Il devient : raison sociale du **client** (asc),
  puis **désignation du modèle** (marque, puis référence), puis **n° de
  série**. La règle « fiches incomplètes d'abord » (`complet: "asc"`) reste
  en tête, INCHANGÉE (le ticket l'exige explicitement — audit 29 ne la
  remet pas en cause).
- **Le tri se fait EN BASE**, par `orderBy` Prisma sur les relations
  `client` et `modele` — jamais en mémoire après lecture. La page pagine
  (`skip`/`take`), et un tri posé après la lecture n'aurait trié qu'UNE
  page à la fois, laissant les pages suivantes dans le désordre.

Pour l'exploitation : un ADV qui cherche le parc d'un client donné trouve
désormais ses machines groupées ensemble (par ordre alphabétique de raison
sociale), au lieu de les voir dispersées dans tout le parc au gré des
numéros internes.

`app/(back-office)/parc/page.tsx` (mise en page) :

- **La barre de filtres tient sur UNE SEULE ligne à 1280 px.** Les quatre
  `<select>` (statut, client, site, famille) portaient une largeur
  naturelle qui suivait leur plus long libellé — jusqu'à 284 px mesurés
  pour le filtre Site — et la barre entière s'étalait sur trois lignes.
  Ils portent maintenant une largeur FIXE (`w-[100px]` à `w-[105px]`) et
  `truncate` (ellipse plutôt qu'un texte coupé au milieu d'un mot). Le
  bouton « Réinitialiser » est déplacé DANS le formulaire de recherche
  (`enfants` de `BarreDeFiltres`, avant le bouton « Rechercher ») pour
  partager la même ligne que les filtres au lieu d'ouvrir une troisième
  ligne à lui seul.
- **La barre de filtres et les trois cartes KPI sont regroupées dans un
  seul bloc** (`gap-2`, 8 px) au lieu de deux blocs séparés par le `gap-5`
  (20 px) de `Page` — la seule respiration entre les deux qui reste sous
  le contrôle de cette page.
- Les trois cartes KPI étaient déjà sur une seule ligne à 1280 px
  (`sm:grid-cols-3`, mesuré avant tout changement) : rien à faire de ce
  côté, au-delà de les inclure dans le bloc compact ci-dessus.

Pour l'exploitation : à 1280×800, la liste de résultats occupe désormais
~484 px visibles avant tout défilement (contre ~382 px mesurés avant ce
ticket), et la barre de filtres au complet — quatre filtres, la recherche,
les deux boutons — reste repérable d'un coup d'œil sur une seule ligne.
**Le prix de ce gain : les quatre `<select>` affichent un libellé tronqué**
(par exemple « Tous l... ») quand rien n'est sélectionné ou qu'un nom long
est choisi — voir « Ce que je n'ai pas fait » et les pièges plus bas.

`lib/i18n/fr.ts` : quatre clés neuves, `parctri.e2e.client_a`,
`parctri.e2e.client_z`, `parctri.e2e.site_a`, `parctri.e2e.site_z` — la
scène de l'épreuve neuve (aucune chaîne visible en dur, L0-11).

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

Mesuré au navigateur (Playwright, Chromium, viewport 1280×800, session
`adv`, vue par défaut de `/parc` sans filtre), avant tout changement de
code puis après :

| | AVANT | APRÈS |
|---|---|---|
| Hauteur de la barre de filtres | 130 px (3 lignes) | 40 px (1 ligne) |
| Écart barre → cartes KPI | 20 px | 8 px |
| Haut de la liste de résultats (depuis le haut du viewport) | 418 px | 316 px |
| **Hauteur visible de la liste** (`min(hauteur du bloc, 800 − haut)`) | **~382 px** | **~484 px** |

La cible du ticket (≥ 480 px, soit 60 % de 800) est donc atteinte avec une
marge d'environ 4 px sur la mesure directe. Cette marge est plus large
qu'il n'y paraît : la largeur de l'input de recherche (qui absorbe tout
l'espace non consommé par les filtres et les boutons, `flex:1`) est
mesurée à 262 px pour un minimum CSS de 220 px — 42 px de jeu avant qu'un
rendu de police légèrement différent (CI, ou un futur libellé plus long)
ne fasse retomber la barre sur deux lignes et perde le gain.

- **`pnpm test`** : 267 fichiers, 2869 tests, tous verts.
- **`pnpm exec playwright test tests/e2e/parc.spec.ts tests/e2e/parc-sites.spec.ts
  tests/e2e/listes-1.spec.ts tests/e2e/parc-apercu-borne.spec.ts
  tests/e2e/captures-parc-sites.spec.ts tests/e2e/captures-parcours-1.spec.ts`** :
  15/15 verts, sans retouche — aucune régression mesurée sur les épreuves
  existantes qui traversent `/parc`.
- **`tests/e2e/parc-tri.spec.ts`** (l'épreuve neuve) : 2/2 vertes —
  l'ordre par client (« PTRI-A » précède « PTRI-Z » à désignation de
  modèle strictement égale) et la hauteur visible ≥ 480 px.
- **Captures** : `docs/propositions/99C-PARC-TRI/captures/`, prises par
  l'épreuve neuve (`CAPTURES_99C_PARC_TRI`) — la liste compacte sur le parc
  de démonstration + la scène de l'épreuve, et la preuve d'ordre par client
  isolée par la recherche `PTRIREF`.

## Ce que j'ai tranché et pourquoi

- **Les quatre `<select>` reçoivent une largeur FIXE avec `truncate`**,
  plutôt qu'une largeur naturelle. C'est le seul levier resté disponible
  dans le territoire de ce ticket (`app/(back-office)/parc/page.tsx`
  seulement — ni `BarreDeFiltres`, ni `Kpi`, ni `Page`, ni `MaitreDetail`
  n'étaient à toucher) pour libérer assez de largeur et tenir la barre sur
  une seule ligne. Calcul fait avant d'écrire une ligne : avec les quatre
  filtres à leur largeur naturelle (784 px) plus les deux boutons, la
  ligne dépassait le conteneur (968 px) de plus de 300 px — aucun réglage
  de marge ou d'espacement seul n'aurait suffi ; réduire le NOMBRE de
  lignes de la barre était la seule voie vers 480 px de liste visible (la
  version à deux lignes, calculée puis mesurée en cours de route, plafonne
  à ~442 px visibles — en dessous de la cible).
- **Le bouton « Réinitialiser » est déplacé DANS le `<form>` de recherche**
  (`enfants`), et non laissé en frère du formulaire dans la barre. Une
  case `display:contents` ne fusionne pas deux contextes de retour à la
  ligne CSS distincts : posé en dehors du formulaire, il ouvrait
  systématiquement sa PROPRE troisième ligne dès que le formulaire
  débordait sur deux lignes, quel que soit l'espace restant sur la
  seconde. Le marqueur `data-bloc="reinitialiser"` voyage avec lui — le
  gardien `tests/unit/machines/composition-parc.test.ts` confronte une
  sous-chaîne du code source, jamais une position dans le DOM, et reste
  vert sans modification.
- **La sélection de la scène de l'épreuve neuve force le CLIENT comme
  seul critère de différence** : les deux machines forgées (`PTRI-A`,
  `PTRI-Z`) partagent la MÊME désignation de modèle (marque et référence
  identiques). Si l'ordre reposait encore sur un reste de tri par
  désignation ou par n° de série, les deux lignes resteraient
  indépartageables sur ce critère — c'est bien le client, et lui seul, qui
  les sépare dans ce scénario.
- **La recherche `q=PTRIREF` isole les deux lignes de l'épreuve** de tout
  le reste du parc (démonstration et scènes forgées par d'autres fichiers
  joués en parallèle) — la comparaison d'ordre ne porte jamais sur un
  compte large (piège connu de ce lot).
- **`test.describe.configure({ mode: "serial" })`** est posé dans
  `parc-tri.spec.ts` — omis dans un premier jet, ce qui a fait courir
  `beforeAll` deux fois en parallèle (deux workers pour les deux tests du
  fichier) et provoqué une violation de contrainte unique sur
  `(societe_id, marque, reference)` de `ModeleMateriel`, PUIS un
  `deleteMany({ where: { modele_id: undefined } })` dans l'`afterAll` du
  worker en échec — Prisma ignore une clé `undefined` dans un `where`,
  ce qui revient à un `deleteMany({})` SANS FILTRE. Repéré immédiatement
  (violation de clé étrangère vers `intervention_machine`, machines de
  démonstration incluses) ; la base de l'épreuve est jetable et recréée à
  chaque exécution (`tests/e2e/setup/global.ts`), donc sans conséquence
  au-delà de cette exécution — mais c'est exactement le même mécanisme
  que `tests/e2e/parc-sites.spec.ts` et `tests/e2e/listes-1.spec.ts`
  évitent déjà par ce même réglage, et je l'avais omis par erreur. Voir
  « Les pièges » ci-dessous.

## Ce que je n'ai PAS fait

- Je n'ai pas touché `lib/machines/ecarts-maquette.ts`, `lib/machines/
  saisie.ts` (au-delà d'une lecture), ni aucun composant partagé
  (`components/ui/*`, `components/mise-en-page/*`) : le territoire du
  ticket limitait la mise en page à `app/(back-office)/parc/page.tsx`
  seul.
- Je n'ai pas cherché à rendre les `<select>` plus étroits ENCORE
  lisibles (par exemple avec une abréviation du texte par défaut,
  « Tous... » → « Statut ») : changer les libellés eux-mêmes
  (`parc.filtre_*.tous`) aurait dépassé la mise en page de cette seule
  page et touché un texte partagé, pour un gain incertain (un client ou
  un site réellement choisi reste long, quel que soit le texte par
  défaut).
- Je n'ai pas ajouté d'attribut `title` (infobulle native) sur les
  `<select>` tronqués pour en révéler le contenu complet au survol — un
  vrai select HTML porte déjà cette bulle nativement pour l'OPTION
  sélectionnée dans la plupart des navigateurs, vérifié visuellement sur
  Chromium (capture), mais non éprouvé formellement.
- Je n'ai forgé, modifié ni supprimé aucune ligne de semis
  (`prisma/seed*.ts`).

## Les pièges pour la session suivante

- **La marge sur les 480 px est réelle mais pas énorme (~4 px sur la
  mesure directe).** Toute session qui ajoute un CINQUIÈME filtre à cette
  barre, allonge un des quatre libellés `parc.filtre_*.tous` (aujourd'hui
  ce sont les valeurs par défaut, ex. « Toutes les familles »), ou touche
  au `gap-2`/`gap-5` autour de ce bloc, doit RE-MESURER avec
  `tests/e2e/parc-tri.spec.ts` avant de conclure — ce gardien existe
  précisément pour attraper cette régression.
- **Un `<select>` tronqué (`truncate`, largeur fixe) affiche un texte
  identique ou quasi-identique pour PLUSIEURS filtres au repos** (« Tous
  l... » ×4 dans la capture `parc-tri-liste-compacte-1280.png`). C'est un
  compromis délibéré (voir « Ce que j'ai tranché ») mais reste un vrai
  coût d'ergonomie, nommé ici plutôt que découvert par un futur audit :
  une session future pourrait vouloir des libellés par défaut plus courts
  et distincts (`parc.filtre_*.tous`), un choix de contenu qui dépasse ce
  ticket.
- **`beforeAll`/`afterAll` d'un fichier e2e qui forge SA PROPRE scène doit
  systématiquement porter `test.describe.configure({ mode: "serial" })`**
  dès que le fichier contient PLUS D'UN test — sans lui, `fullyParallel`
  peut lancer deux workers sur le même fichier, dupliquant `beforeAll` (et
  dans le pire cas, un `afterAll` qui tourne sur un état partiellement
  construit peut supprimer bien plus que sa propre scène, `undefined`
  n'étant pas un filtre pour Prisma). Toutes les épreuves existantes de ce
  dépôt qui forgent une scène le font déjà ; ce ticket a bien failli être
  la première exception.

## Ce qui reste à faire

Rien de bloquant pour ce ticket : les quatre étapes demandées sont faites.
`CI=1 pnpm verify:full` a tourné en entier après le commit du code :
format, typecheck, lint, tests unitaires (267 fichiers, 2869 tests),
`test:isolation` (14 tests), build, `feries:horizon`, `audit:partitions`
et `test:e2e` (290 épreuves — 287 passées, 3 ignorées, 0 échec) sont tous
verts, sans retouche.
