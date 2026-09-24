# 52-REGISTRE-1 — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

`/interventions` s'ouvre désormais sur une rangée de SEPT onglets, au-dessus du
tableau : « Toutes », « À planifier », « Aujourd'hui », « En cours », « Bloquées »,
« À contrôler », « Historique ». Chacun porte un COMPTE exact entre parenthèses
(« Bloquées (1) ») et mène à `?vue=<clé>&page=1`, les autres filtres actifs
(recherche, agence, type, statut, période, clients inactifs) préservés.

Pour l'exploitation : un exploitant qui veut voir « ce qui est bloqué » ou
« ce qui reste à contrôler » n'a plus besoin de connaître le nom technique du
statut ni de le composer via le `<select>` « Statut » — un clic suffit, et le
compte affiché sur l'onglet dit par avance combien de lignes il va trouver.
`vue=` accepte une valeur inconnue (favori périmé, URL tapée à la main) sans
jamais faire échouer la recherche : elle retombe simplement sur « Toutes », le
comportement d'avant ce ticket.

Fichiers touchés :
- `lib/interventions/saisie.ts` — `VUES_REGISTRE`/`VueRegistre`, le champ `vue`
  de `schemaRechercheInterventions`.
- `lib/interventions/depot.ts` — `criteresVue` (le critère par onglet),
  `filtreDesInterventions` restructurée en `AND` de fragments indépendants
  (voir « ce que j'ai tranché »), `compterParVue` (nouvelle fonction exportée).
- `app/(back-office)/interventions/page.tsx` — la rangée d'onglets, les
  paramètres actifs composés une seule fois (`parametresActifs`, partagés avec
  la pagination, qui porte désormais `vue` elle aussi).
- `app/(back-office)/interventions/presentation.ts` — `ONGLETS_REGISTRE`,
  `hrefOnglet`, `libelleCleOnglet`, `libelleOngletAvecCompte`.
- `lib/i18n/fr.ts` — sept clés `interventions.vue.*`.

## Ce que j'ai mesuré

**AVANT** (mesure du 24/09 en tête de ticket, confirmée en lisant le code au
début de la session) : `/interventions` ne portait aucune notion de vue ; un
seul `statut` à la fois, via le `<select>` du formulaire ; `filtreDesInterventions`
était un objet à plat, 553 lignes dans `page.tsx`.

**APRÈS**, mesuré par capture d'écran (`docs/propositions/52-REGISTRE-1/captures/`,
375 et 1280 px, `/interventions?vue=bloquees&q=REG1-`) : les sept onglets
rendus, « Bloquées (1) » actif et souligné en bleu, une seule ligne dans le
tableau, `1 intervention` en pied de tableau — les trois lectures du même
nombre concordent.

**`pnpm verify` entier, un seul passage, tout vert** : `format:check`,
`typecheck`, `lint`, `test` (2727 tests), `test:isolation` (1220 tests),
`build`.

**`pnpm test:e2e` entier (tout le dépôt, pas seulement ce fichier), un seul
passage** : 223 passés, 3 sautés (intentionnels, hors périmètre de
`tous-les-ecrans-rendent.spec.ts`, déjà sautés avant ce lot), 0 échec, 2,8 min
— y compris les sept épreuves de `registre-1.spec.ts`.

**`tests/isolation/ecran-intervention.test.ts`**, la nouvelle section
« les onglets du registre » : sept fiches d'un type ABSENT de la société A
(calculé par témoin, comme le fait déjà le test voisin « un type qu'aucune
fiche ne porte »), chaque onglet retrouve SA fiche et elle seule,
`compterParVue` rend `{toutes: 7, a_planifier: 1, aujourdhui: 1, en_cours: 1,
bloquees: 1, a_controler: 1, historique: 2}` — `historique` à 2 parce que la
scène porte volontairement une fiche `cloturee` ET une `annulee`, pour éprouver
le `OU` de cet onglet.

## Ce que j'ai tranché et pourquoi

- **`filtreDesInterventions` est passée d'un objet Prisma à plat à un `AND` de
  fragments indépendants.** Avant ce ticket, chaque filtre s'écrivait par
  `...spread` sur les mêmes clés (`statut`, `date_planifiee`) ; `vue` ajoute un
  SECOND écrivain possible sur ces deux mêmes clés (le `<select>` « Statut » du
  formulaire écrit `statut`, l'onglet `a_planifier`/`en_cours`/… aussi ; le
  filtre de période écrit `date_planifiee`, l'onglet `aujourdhui` aussi). Un
  objet à plat aurait fait du DERNIER fragment écrit le seul qui compte : choisir
  `vue=en_cours` avec le `<select>` Statut sur « Suspendue » aurait alors
  silencieusement ignoré l'un des deux, sans qu'aucun message ne le dise —
  exactement le défaut que CLAUDE.md §9 (01/09) nomme. L'`AND` compose les
  fragments au lieu de les superposer : deux conditions contradictoires sur
  `statut` rendent zéro ligne, jamais un filtre qui en masque un autre en
  silence.
- **`criteresVue` (et `filtreDesInterventions`, qui la compose) restent
  PRIVÉES**, jamais exportées. Je l'ai d'abord exportée pour l'éprouver
  directement — le gardien R3-12 (`tests/unit/gardiens/chemins-de-depot.test.ts`)
  a rougi : une fonction de dépôt EXPORTÉE sans chemin depuis `app/` est
  refusée, et `criteresVue` n'a d'appelant QUE dans son propre fichier
  (`filtreDesInterventions`, `compterParVue`) — le gardien exclut explicitement
  les appels d'un fichier à lui-même. L'exporter pour sa seule épreuve aurait
  été exactement l'exception que ce gardien existe pour refuser (précédent déjà
  posé pour `numeroDeReference`, non exportée pour la même raison). Son critère
  est donc éprouvé là où il est ATTEINT : sous la vraie table, dans
  `tests/isolation/ecran-intervention.test.ts`, à travers les trois fonctions
  réellement exportées et appelées par `/interventions`.
- **`compterParVue` : un `groupBy(statut)` + un `count` du jour, jamais une
  requête par onglet** — exactement l'exemple du ticket. « Toutes » se déduit
  par la SOMME des groupes plutôt qu'une troisième requête, puisque le `groupBy`
  couvre déjà toute la population filtrée (hors onglet).
- **Le compte affiché sur un onglet est composé HORS JSX**
  (`libelleOngletAvecCompte`, `presentation.ts`), jamais par un `{t(...)} (...)`
  dans le JSX. Le gardien L0-11 (`react/jsx-no-literals`) refuse même la seule
  ponctuation d'un compte (`" ("`, `")"`) posée nue dans un conteneur JSX — mesuré
  au premier `pnpm lint`, corrigé en suivant le patron déjà établi par
  `decompte`/`libellePage`.
- **Le test e2e extrait le compte par une expression régulière plutôt que par
  `toContainText("(1)")`.** Le même gardien L0-11 (`tests/unit/i18n/sans-chaine-visible-en-dur.test.ts`)
  refuse aussi une chaîne littérale passée à une requête d'écran (`toContainText`,
  `getByRole({name})`…), même dans un fichier de test — « (1) » n'est pas une clé
  du dictionnaire. Le compte est donc lu par `.innerText()` puis comparé en
  NOMBRE.
- **La pagination porte désormais `vue`** (`parametresActifs`, partagé avec les
  onglets) : sans ce partage, changer de page aurait silencieusement perdu
  l'onglet actif — un défaut que je n'ai pas laissé, même si le ticket ne le
  nommait pas explicitement.
- **Le sélecteur de l'onglet actif porte `data-nav="onglets-registre"`** : la
  barre de navigation principale pose déjà `aria-current="page"` sur son propre
  lien actif (« Interventions »), et `a[aria-current="page"]` sans le scoper au
  `<nav>` du registre visait les deux à la fois — mesuré au premier passage e2e
  (« strict mode violation : 2 elements »).

## Ce que je n'ai PAS fait

- Aucune vue enregistrée, aucune action groupée, aucun filtre technicien ni S/N
  — hors périmètre, écrit comme tel dans le ticket.
- Je n'ai pas touché `app/(back-office)/interventions/[id]/`, `nouvelle/`, aucune
  route `app/api/`, ni le planning — territoire interdit du ticket.
- Je n'ai pas ajouté de vue enregistrée ni de mémorisation de l'onglet choisi
  entre deux visites : l'état vit entièrement dans l'URL, comme le reste de cet
  écran (AT-07).
- Je n'ai pas relu `docs/propositions/47-AVERTISSEMENTS-1/captures/*.png` ni
  `docs/propositions/50-INTERVENTIONS-2/captures/*.png`, modifiés en local
  AVANT cette session (probable antialiasing à la régénération, piège déjà noté
  par 51-STABILITE-1) — non commités, hors périmètre de ce lot.

## Les pièges pour la session suivante

- **`aria-current="page"` n'est pas unique sur cet écran.** La barre de
  navigation principale ET la rangée d'onglets du registre le posent toutes les
  deux — tout sélecteur futur qui viserait « le lien actif » doit se scoper au
  bon `<nav>` (`data-nav="onglets-registre"` pour celui-ci).
- **Un `AND` de fragments Prisma n'est pas la même chose qu'un objet à plat**,
  et `filtreDesInterventions` a changé de forme pour cette raison (voir « ce que
  j'ai tranché »). Un futur filtre qui écrirait de nouveau une clé déjà portée
  par `vue` (ou l'inverse) doit passer par un NOUVEAU fragment poussé dans le
  tableau, jamais par une fusion `{...a, ...b}` qui réintroduirait le défaut de
  recouvrement silencieux que ce lot a fermé.
- **Une fonction de dépôt exportée doit avoir un appelant HORS de son propre
  fichier**, sans quoi R3-12 la refuse — même si elle est parfaitement
  atteinte fonctionnellement par composition interne. Le réflexe « je l'exporte
  pour la tester directement » ne marche pas dans `lib/<domaine>/depot*.ts` ;
  la bonne maison pour ce genre d'épreuve est `tests/isolation/`, sous la vraie
  table, à travers les fonctions publiques réelles.
- **`compterParVue` recalcule `debutDuJourSociete` inconditionnellement**
  (contrairement à `listerInterventions`/`compterInterventions`, qui ne le font
  que si `sans_duree_a_venir` ou `vue === "aujourdhui"`) : l'onglet « Aujourd'hui »
  a TOUJOURS besoin de sa borne pour afficher un compte, même quand ce n'est pas
  l'onglet actif. C'est volontaire, pas un oubli d'optimisation.

## Ce qui reste à faire

- Rien d'obligatoire au sens du ticket : `pnpm verify` et `pnpm test:e2e`
  entiers sont verts, chacun en un seul passage.
- Une session future pourrait envisager des vues ENREGISTRABLES (filtres
  personnalisés au-delà des six statuts/dates fixes) — explicitement hors
  périmètre ici, à ouvrir comme un ticket à part si l'exploitation le demande.
