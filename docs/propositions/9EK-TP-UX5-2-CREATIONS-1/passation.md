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

## Reprise 9EKA — rouge tardif à la vérification indépendante, cause trouvée et corrigée

**En une phrase** : `tests/e2e/9ek-creations-1.spec.ts` crée, dans son épreuve d'homonyme, un
client dont la casse est volontairement différente du préfixe de nettoyage (`.toLowerCase()`
appliqué à `${PREFIXE}garage dupont (scène)` abaisse aussi le `9EK-`) ; `afterAll` filtrait par
`startsWith` SANS `mode: "insensitive"`, donc ne le retirait jamais ; ce client sans aucun site,
préfixé par un chiffre, trie avant tout client du référentiel dans un sélecteur non filtré, et
`tests/e2e/captures-selecteurs-1.spec.ts` (étranger au lot, à `/parc/nouvelle`) le choisissait
comme « premier résultat » puis échouait à trouver un site pour lui.

### Ce qui a été mesuré, dans l'ordre

1. `git fetch origin` : `origin/main` à `171a3cc8` (9EE-TP-UX4-1-FICHE-INTERVENTION-1 —
   passation), inchangé depuis la note de reprise. La garde
   `9EK-TP-UX5-2-CREATIONS-1-garde` portait 5 commits au-dessus de `origin/main`.
2. `git branch -f main-work origin/main` (main-work n'avait aucun commit propre — ancêtre
   direct de `origin/main` — donc une avance sans perte), puis `git cherry-pick` des 5 commits
   de la garde : UN SEUL conflit, dans `docs/arbitrages.md` (D181 et D182 ajoutées côte à côte
   en fin de fichier) — résolu en gardant les deux décisions, D181 avant D182, sans toucher au
   texte d'aucune des deux.
3. `CI=1 pnpm verify` (format/typecheck/lint/test/isolation/build) : VERT du premier coup.
   `feries:horizon` et `audit:partitions` : VERTS.
4. `CI=1 pnpm test:e2e` (suite complète, 1103 tests) : **1 ROUGE** après 42,1 minutes —
   `captures-selecteurs-1.spec.ts:86:9 › à 375 px › parc/nouvelle — les sélecteurs de client,
   de site et de modèle`, `expect(locator).toBeVisible()` sur le premier `li[role="option"]`
   du sélecteur `site_id`, timeout 5000 ms, élément introuvable.
5. Reproduit en ISOLANT des sous-ensembles de fichiers (chaque essai relance le `globalSetup`,
   donc une base neuve) : `9ek-creations-1.spec.ts` + `captures-9ek-creations-1.spec.ts` +
   `captures-selecteurs-1.spec.ts` → rouge identique ; `captures-9ek-creations-1.spec.ts` +
   `captures-selecteurs-1.spec.ts` (sans `9ek-creations-1`) → VERT ; `9ek-creations-1.spec.ts`
   + `captures-selecteurs-1.spec.ts` (sans la variante captures) → rouge identique. Puis
   `--grep` à l'intérieur de `9ek-creations-1.spec.ts` : la SEULE épreuve « l'alerte de
   doublon… » suffit à reproduire le rouge avec `captures-selecteurs-1.spec.ts`.
6. Un diagnostic temporaire (retiré avant le commit) dans `afterAll` a montré `clients: 1`
   supprimé par le `deleteMany` (le client de la scène, casse exacte `9EK-`) et un SECOND
   client, de casse `9ek-` (créé par le formulaire dans l'épreuve elle-même), ENCORE présent
   juste après. Une requête SQL directe (`SELECT '9ek-garage...' LIKE '9EK-%'`) a confirmé
   `false` sur cette base (collation `en_US.utf8`, `LIKE` sensible à la casse, confirmé aussi
   par un essai Prisma minimal isolé). Le fait que ce même client ait disparu une fois le
   process `playwright test` complètement sorti était une fausse piste : la base
   `codiplan_test` est partagée entre les trois répertoires de travail de ce poste
   (mémoire « Bases de test sur le poste d'Alexis »), et une autre exécution concurrente l'a
   recréée entre-temps — pas une seconde suppression de ce lot.

### Ce qui a été corrigé

`tests/e2e/9ek-creations-1.spec.ts`, `afterAll` : les deux `deleteMany` (sur `site.libelle` et
sur `client.raison_sociale`) portent désormais `mode: "insensitive"` en plus de `startsWith`.
Aucune assertion touchée, aucune mise en scène affaiblie — le nettoyage retire maintenant
exactement ce que l'épreuve a écrit, casse comprise. Revérifié par trois exécutions
consécutives de `9ek-creations-1.spec.ts` + `captures-selecteurs-1.spec.ts` : VERT les trois
fois (aucune troisième tentative nécessaire, le premier essai après correctif était déjà vert).

### Vérification finale

`CI=1 pnpm verify:full` rejoué EN ENTIER après le correctif : **VERT de bout en bout**,
suite `test:e2e` complète comprise — 1055 passed, 48 skipped, 0 failed (41,9 min pour
`test:e2e`). Terminé à 19h20 heure de Nouméa le 08/10/2026 (08h20 UTC). Les ~169 captures
TRACKÉES d'autres tickets, régénérées par cette exécution (même phénomène déjà noté par la
session 9EK-1 — `47-AVERTISSEMENTS-1`, `9DF-TP-CY2-MATRICE-D8`, et une quarantaine d'autres
tickets dont les specs écrivent leurs PNG sans variable d'environnement), ont été restaurées
par `git checkout --`. Six fichiers NEUFS NON TRACKÉS (`47-AVERTISSEMENTS-1/captures/
bandeau-transmis-*`, `9BV-TP-A5b-DATES-REPRISE/captures/fiche-reprise-*`,
`9DF-TP-CY2-MATRICE-D8/captures/fiche-*`), produits par ces mêmes specs étrangères sous
`CI=1`, ont été SUPPRIMÉS plutôt que commités — même pratique que celle déjà appliquée par la
session 9EK-1 (voir ses « pièges »), aucun n'appartient au territoire de ce lot.

### Tableau de couverture du ticket 9EK-1

**Le fichier `tickets/recales/9EK-TP-UX5-2-CREATIONS-1.md` nommé par la note de reprise
N'EXISTE PAS dans ce dépôt** — ni sous ce chemin, ni ailleurs (`tickets/`, `docs/backlog.md`
ne le portent pas) ; les tickets de ce projet vivent visiblement hors du dépôt git. Le tableau
ci-dessous est donc construit à partir des DEUX sources disponibles en repo — la décision
D181 (`docs/arbitrages.md`) et la passation de la session 9EK-1 ci-dessus — et NON à partir
des addenda de recalage ni des choix Q1 à Q15 nommés par la note de reprise, qui ne sont
vérifiables par aucun document présent ici. C'est un écart signalé, pas une supposition.

| Partie | État |
|---|---|
| A/B — `/clients/nouveau` et `/sites/nouveau` au gabarit du 28/09 | FAIT (commit `5dfa8757`) |
| C — Décision D181 | FAIT (commit `80a75ef9` après rejeu) |
| D — Épreuves e2e sur fixture dédiée (14 fichiers touchés, 123 épreuves ciblées) | FAIT (commit `c2a0620c`) ; **suite complète maintenant rejouée et VERTE** par cette reprise (pas seulement les 123 ciblées) |
| E — Captures APRÈS, numérotation de « Ensuite », scène e2e externalisée | FAIT (commit `b5d848b7`) |
| Passation 9EK-1 | FAIT (commit `ec0f5ae6`) |
| Alerte de doublon non bloquante (CS40), `/api/clients/homonymes` | FAIT, prouvé par `tests/isolation/clients-homonymes.test.ts` (8 épreuves) et par l'épreuve e2e de l'alerte |
| « Créer et ajouter un site » enchaîné (bouton secondaire `ensuite=site`) | FAIT, prouvé par l'épreuve e2e dédiée |
| QT-18 (a) / CONTRAT-SITE-1 — adresse, consignes, sous contrat à la création | FAIT, prouvé par l'épreuve e2e dédiée et par lecture base |
| Refus serveur (libellé vidé) garde la saisie | FAIT, prouvé par l'épreuve e2e dédiée |
| Colonne « Sites existants de ce client » | FAIT, prouvé par l'épreuve e2e dédiée |
| **CS41 — présélection de l'agence unique** | **CODE ÉCRIT** (`seuleAgenceActive`, `app/(back-office)/sites/nouveau/page.tsx`) ; la branche « deux agences actives ou plus » est prouvée par les épreuves existantes (CODIMA-NC, 3 agences) ; la branche « une seule agence active » **reste SANS preuve e2e** — non fait par 9EK-1, PAS COMMENCÉ par cette reprise non plus (voir « ce qui reste à faire ») |
| Captures AVANT | **PAS FAIT** par 9EK-1, **PAS COMMENCÉ** par cette reprise (voir « ce qui reste à faire ») |

### Pourquoi CS41 (preuve e2e) et les captures AVANT n'ont pas été repris ici

**Choix explicite, pas un oubli.** La note de reprise porte une limite de 210 minutes ; le
diagnostic du rouge tardif (reproduction isolée par sous-ensembles de fichiers, puis par
`--grep`, puis vérification SQL directe de la sensibilité à la casse) en a consommé une part
importante, et `CI=1 pnpm verify:full` seul coûte environ 45 minutes à chaque passage COMPLET
— il en a fallu deux dans cette reprise (un après le correctif pour le confirmer de façon
ciblée, un en entier pour la vérification finale). Écrire la preuve CS41 exige une identité
`direction@codima.test` (rôle à second facteur obligatoire, `ROLES_SECOND_FACTEUR_OBLIGATOIRE`)
jamais ouverte par aucun scénario e2e existant, puis une bascule vers la société CODIMA-EU
(seule société du semis à une seule agence active, « SIEGE ») par `/arrivee` et
`/api/session/societe` — un chemin neuf, à construire et à éprouver, dont le risque d'aléas
(enrôlement MFA, bascule de société, sélecteurs de l'écran d'arrivée) ne se mesure qu'en le
faisant. Risquer ce temps aurait menacé le respect du dernier geste obligatoire de ce lot — le
`verify:full` complet et vert, puis le commit, puis le rebase de fin de session — pour un ajout
qui n'était PAS la cause du rouge qui a motivé cette reprise. Les deux restent donc dans
« ce qui reste à faire », inchangés depuis la session 9EK-1, avec le chemin déjà identifié
ci-dessus pour la session suivante : `CODIMA-EU` / `SIEGE` pour CS41, un worktree sur
`23e45c98` pour l'AVANT.

