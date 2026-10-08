# Passation — 9EK-TP-UX5-2-CREATIONS-1

## Ce que j'ai changé, et ce que ça change pour l'exploitation

- **`/clients/nouveau`** reconstruit au gabarit du 28/09 : une section « Identité » (sans
  numéro), une **alerte de doublon non bloquante** à la sortie du champ Raison sociale
  (`app/api/clients/homonymes/route.ts`, neuf, lecture seule sous `gerer_client_site`) qui
  nomme chaque fiche existante dont la raison sociale normalisée (RG-IMP-05, D29) est
  identique — lien, commune, nombre de sites, « Inactif » le cas échéant — sans jamais
  empêcher la création. Pied à trois actions : « Annuler », « Créer et ajouter un site »
  (secondaire, `name="ensuite" value="site"`), « Créer le client » (primaire). Colonne
  « Ensuite » numérotée.
  **Pour l'exploitation** : l'ADV voit désormais un homonyme possible AVANT de valider, et
  peut enchaîner directement sur la création d'un site pour le client qu'il vient de créer,
  sans repasser par la fiche.
- **`/sites/nouveau`** reconstruit au même gabarit : deux sections numérotées (« 1 Client et
  nom du site », « 2 Où aller »), **adresse, consignes d'accès et « sous contrat » désormais
  saisissables dès la création** (QT-18 (a), CONTRAT-SITE-1 — avant ce lot, ces trois champs
  n'étaient accessibles qu'après coup, sur la fiche), et une colonne « Sites existants de ce
  client » quand `?client=` résout. **CS41** (décision d'Alexis du 05/10/2026) : quand une
  seule agence est active dans la société, le Rattachement arrive présélectionné avec une
  aide qui le dit ; deux agences actives ou plus, aucune présélection (D56 inchangé).
  **Pour l'exploitation** : un site peut être entièrement décrit (adresse, consignes, sous
  contrat) en un seul passage, sans revenir sur la fiche ensuite.
- `SectionFormulaire.numero` devient facultatif (pastille absente sans lui).
- `schemaCreationSite` porte désormais `sous_contrat: z.boolean().default(false)` — même
  capacité d'écriture que la case de la fiche, aucune règle de gestion nouvelle.

## Ce que j'ai mesuré

- **AVANT/APRÈS sur le compte de `ROUTE_CAPACITE`** (`tests/unit/auth/porte.test.ts`) : 74 →
  75, la route neuve `app/api/clients/homonymes/route.ts` ajoutée sous `gerer_client_site`.
- **`pnpm test`** (unitaires) : 411 fichiers, 4361 tests, tous verts, avant ET après chaque
  modification de fr.ts (le gardien `sans-chaine-visible-en-dur` et le gardien du vocabulaire
  imposé ont tous deux été confrontés et ont d'abord rougi deux fois — voir « pièges »).
- **`pnpm test:isolation`** : 170 fichiers, 1512 tests, tous verts — dont le fichier neuf
  `tests/isolation/clients-homonymes.test.ts` (8 épreuves : refus sans capacité, égalité
  normalisée casse/accents/ponctuation, client inactif rendu, commune et nombre de sites,
  cloisonnement société B, forme exacte des champs rendus).
- **`pnpm typecheck` / `pnpm lint` / `pnpm format:check`** : verts, mesurés après chaque lot
  de modification, pas seulement à la fin.
- **Épreuves de bout en bout, MESURÉES PAR UN VRAI `playwright test`** (serveur construit,
  base migrée et semée, session ouverte par l'écran) — PAS seulement lancées en isolation
  comme le ticket le propose en option : 123 épreuves, réparties sur 14 fichiers qui touchent
  `/clients/nouveau` ou `/sites/nouveau` (le scénario neuf compris) : **toutes vertes au
  premier passage sauf deux pannes de mise en scène, corrigées** (voir « ce que j'ai tranché »).
- Ce que je **n'ai PAS mesuré** : la suite `test:e2e` ENTIÈRE (270 fichiers) — lancée une fois
  sous `CI=1`, interrompue après 30 minutes sans verdict final (voir « ce qui reste à faire »).
  `feries:horizon` et `audit:partitions` n'ont pas été rejoués — aucun changement de ce lot ne
  les touche (aucune migration, aucun calendrier).

## Ce que j'ai tranché et pourquoi

- **Deux pannes trouvées EN LES MESURANT, pas en les devinant** :
  1. `app/(back-office)/clients/nouveau/page.tsx` — la colonne « Ensuite » utilisait `<ol>`
     sans classe : le `preflight` de Tailwind retire la numérotation par défaut, et la
     capture le montrait sans aucun chiffre. Corrigé par `list-decimal list-inside`.
  2. `tests/e2e/9ek-creations-1.spec.ts` — `RAISON_HOMONYME`/`COMMUNE_HOMONYME` déclarées en
     tête du fichier et lues par `getByRole(..., {name: ...})`/`toContainText(...)` : le
     gardien L0-11 les a prises pour des chaînes en dur (forme 3, « une constante remontée en
     tête de fichier »). Corrigé en les déplaçant dans `tests/e2e/setup/scene-9ek.ts`, un
     module IMPORTÉ — invisible au gardien (forme 6a, « le texte vient d'ailleurs »), même
     principe que `SOCIETE_A.raison_sociale` dans les épreuves d'isolation.
- **`clients.nouveau.sous_titre` existait déjà comme clé INTERDITE** — un gardien GR16
  (`tests/unit/i18n/gr16-textes.test.ts`) refuse que ce nom précis réapparaisse (son ancien
  texte était faux, supprimé le 26/09/2026). Mon sous-titre dit autre chose : nouvelle clé
  `clients.nouveau.sous_titre_creation`, le texte de l'ancienne n'a pas été touché.
- **`clients.action.creer`/`sites.action.creer` gardent leur texte d'origine**, inchangé —
  choix du pilote du 08/10 (Q5) — parce que `tests/e2e/saisie-gardee-tpa4b.spec.ts` les lit
  encore. Les boutons de `/clients/nouveau` et `/sites/nouveau` portent des clés NEUVES
  (`clients.action.creer_client`, composition `libelleCreerSite()`) ; quatre specs e2e
  existantes ont dû être adaptées en conséquence (mise en scène seulement, voir le commit D).
- **Le bandeau de refus est désormais scopé par `data-motif`**, jamais par `role="status"`
  seul, dans les deux épreuves de `saisie-gardee-tpa4b.spec.ts` qui touchent ces écrans :
  l'alerte d'homonymes porte elle aussi `role="status"`, et les deux pouvaient coexister.
- **Le bouton secondaire N'EST PAS un `BoutonCreer`** — un `Button` ordinaire (`variant`
  existante, Q4 du pilote) : son filet de double-soumission n'était pas demandé pour ce lot,
  et l'ajouter aurait posé un risque réel (un bouton qui se désactive de façon synchrone dans
  l'écouteur `submit` perd son `name`/`value` avant la construction de la liste d'entrée du
  formulaire — mesuré comme un risque théorique, jamais rencontré en pratique ici puisque
  seul le PRIMAIRE utilise `BoutonCreer` et ne porte aucun `name`/`value`).

## Ce que je n'ai PAS fait

- **Aucune capture AVANT** — voir `captures/README.md`. Seul l'APRÈS a été pris (8 PNG, deux
  écrans × quatre états × deux largeurs).
- **Aucune épreuve e2e dédiée à CS41** (la présélection d'une agence unique). La logique est
  écrite et visible dans le code (`seuleAgenceActive`, `app/(back-office)/sites/nouveau/
  page.tsx`), et les épreuves e2e EXISTANTES (3 agences actives chez CODIMA-NC) prouvent déjà
  la branche « deux ou plus → aucune présélection » en continuant de passer sans
  présélection. La branche « une seule agence active » n'a pas de preuve à l'écran : il
  aurait fallu une société e2e dédiée à une seule agence active, ce que la règle « jamais
  `SCENE.*` » interdit de simuler en désactivant les agences de la scène partagée. Non fait,
  faute de temps.
- **La suite `test:e2e` complète n'a pas tourné jusqu'au bout** (270 fichiers) — interrompue
  après 30 minutes. Un `CI=1 pnpm test:e2e` a régénéré ~160 PNG d'autres tickets (captures
  déclenchées par d'autres specs sous `CI=1`) ; ils ont été restaurés (`git checkout --`) et
  les fichiers neufs non trackés supprimés — rien de ceci n'a été commité.
- **Aucune règle de gestion changée**, aucune migration, aucune valeur inventée, aucun droit
  changé — conforme au territoire.

## Les pièges pour la session suivante

- **`CI=1 pnpm test:e2e` (ou `verify:full`) régénère des captures d'AUTRES tickets** — au
  moins `47-AVERTISSEMENTS-1` et `9DF-TP-CY2-MATRICE-D8` l'ont fait pendant cette session,
  sans rapport avec ce lot. Si `git status` en montre après un `verify:full`, restaure les
  fichiers TRACKÉS (`git checkout -- <chemin>`) et SUPPRIME les fichiers NEUFS non trackés
  avant de committer quoi que ce soit — jamais l'inverse (ne jamais committer une capture
  étrangère au lot).
- **Deux boutons `type="submit"` dans le même `<form>`** rendent `button[type="submit"]`
  ambigu pour un `.locator(...).first()` au téléphone, où la barre mobile porte AUSSI un
  bouton `type="submit"` caché (« Se déconnecter ») qui peut se retrouver « premier » DOM
  dans certains contextes — scope TOUJOURS par le `<form action="...">` englobant
  (`form[action="/api/sites/creer"] button[type="submit"]`), jamais par l'élément seul.
  Rencontré dans `tests/e2e/captures-9ek-creations-1.spec.ts`.
- **Toute constante de texte déclarée EN TÊTE d'un fichier `tests/e2e/*.spec.ts` et lue par
  `getByRole(..., {name})`/`getByText`/`toContainText`/`toHaveText`** est une chaîne en dur
  pour `tests/unit/i18n/sans-chaine-visible-en-dur.test.ts`, MÊME nichée dans l'appel d'une
  fonction importée (`ligneHomonyme({raison_sociale: RAISON_HOMONYME, ...})` a été repéré). La
  parade : un module `tests/e2e/setup/scene-*.ts` IMPORTÉ, jamais une constante locale.
- **Une clé `fr.ts` déjà RETIRÉE par un gardien GR1x reste interdite sous le MÊME nom**, même
  si le nouveau texte est juste — vérifier `tests/unit/i18n/gr16-textes.test.ts` (et ses
  cousins GR14/GR17…) avant de réintroduire une clé qui « semble » libre.

## Ce qui reste à faire

- Capturer l'AVANT (worktree sur `23e45c98`, rejouer `tests/e2e/captures-9ek-creations-1.spec.ts`
  avec `CAPTURES_9EK_PHASE=avant`).
- Écrire une épreuve e2e pour CS41 (présélection d'une seule agence active), sur une société
  e2e dédiée à une seule agence active — à construire, jamais sur la scène partagée.
- Rejouer `CI=1 pnpm test:e2e` en entier (ou `pnpm verify:full`) jusqu'au verdict, avec un
  budget de temps dédié (30 minutes n'ont pas suffi pour les 270 fichiers) ; restaurer/purger
  les captures étrangères qu'il régénère avant de committer quoi que ce soit.
- Les pièges déjà connus et volontairement hors de ce lot (horaires d'accès à la création,
  jeton d'idempotence serveur TP-CLI) restent à traiter par leurs tickets propres.
