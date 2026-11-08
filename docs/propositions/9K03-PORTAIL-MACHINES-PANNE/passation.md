# 9K03-PORTAIL-MACHINES-PANNE — passation

## Mesure (fichier:ligne, avant toute écriture)

- Une machine n'était nommée au portail que par son numéro de série, à quatre
  endroits : l'accueil (`app/(portail)/portail/page.tsx:331-333`), le
  sélecteur de la demande (`app/(portail)/portail/demandes/vue.tsx:204-208`),
  la ligne d'une demande déjà déposée (`vue.tsx:135-137`), et le titre de la
  fiche machine (`app/(portail)/portail/machines/presentation.ts:18-21`,
  consommé par `machines/[id]/page.tsx:88,140,150-152`).
- `lib/portail/depot.ts` — `SELECTION_FICHE_MACHINE_PORTAIL` (ex-lignes
  117-125) et le select inline de `parcDuClient` (ex-lignes 222-233) ne
  lisaient ni `famille`, ni `marque`, ni `modèle` : seules des colonnes plates
  de `Machine`. Le type `Machine` ne porte pas ces trois notions directement —
  elles vivent en jointure : `machine.modele_id → ModeleMateriel.{marque,
  reference} → ModeleMateriel.famille_id → FamilleMateriel.libelle`
  (`prisma/schema.prisma:1507-1612`, `:3046-3090`, `:2996-3037`).
- La policy d'ascendance de D93 (`prisma/migrations/20260913100000_documents_l8
  /migration.sql:254-310`) ouvre déjà `modele_materiel`/`famille_materiel` au
  compte portail dès qu'il voit la `machine` qui les référence, par un
  `EXISTS` qui s'exécute lui-même sous le contexte client — **aucune
  politique RLS neuve n'était due**, seulement une extension du `select`.
- `app/api/portail/demandes/creer/route.ts:87-88` forçait `urgence: "p3"`
  **et** `machine_arretee: false` en dur ; la colonne `machine_arretee`
  existe déjà sur `Demande` (`prisma/schema.prisma:2161`) et est déjà
  sélectionnée par `CHAMPS_DEMANDE` (`lib/demandes/depot.ts:73`) — donc déjà
  lisible partout où une `LigneDemande` l'est, y compris côté bureau
  (`app/(back-office)/demandes/[id]/page.tsx:453-458`, déjà affichée
  conditionnellement). **Aucun écran bureau n'a dû changer.**
- La fiche machine du portail (`app/(portail)/portail/machines/[id]/page.tsx`)
  existait déjà (9J06) mais ne portait aucun bouton « Signaler une panne », et
  `/portail/demandes` ne lisait aucun paramètre `machine_id`.
- Gardien colonnes fermées existant : `tests/unit/portail/machine-colonnes-
  fermees.test.ts` — liste close plate, à étendre à sa source pour les deux
  niveaux de jointure ajoutés (§9, discipline rappelée par le ticket : « étendre
  un gardien colonnes fermées pour y déclarer une colonne lue n'est pas un
  assouplissement »).

## Ce qui a été fait

1. **La machine nommée « Famille · Marque · Modèle »**, numéro de série
   affiché en second (texte plus petit, `text-12 font-bold text-app-encre-
   faible`) — à l'accueil, au sélecteur et à la liste des demandes, au titre
   de la fiche machine, et au bon d'intervention (famille ajoutée devant
   marque/modèle, sans changer sa ponctuation : ce bon est partagé avec le
   back-office — `lib/interventions/bon.ts`). Fonction partagée
   `nomDeLaMachine`/`numeroDeSerieDeLaMachine`
   (`app/(portail)/portail/presentation.ts`), réutilisée par
   `machines/presentation.ts` plutôt que recomposée. `lib/portail/depot.ts`
   étend `SELECTION_FICHE_MACHINE_PORTAIL` d'une jointure fermée
   (`modele.{marque,reference,famille.libelle}`) et `parcDuClient` réutilise
   désormais cette même constante au lieu d'un select dupliqué.
2. **« La machine est à l'arrêt »** : case dans le formulaire de dépôt
   (`app/(portail)/portail/demandes/vue.tsx`), lue par
   `creationDemandePortailRecue` (`app/api/portail/demandes/saisie-recue.ts`)
   et écrite dans `machine_arretee` par la route
   (`app/api/portail/demandes/creer/route.ts`). `urgence` reste fixée à
   `"p3"` en dur — décision d'Alexis du 08/11/2026, un client ne la choisit
   pas, même en cochant la case.
3. **« Signaler une panne » depuis la fiche machine** : lien vers
   `/portail/demandes?machine_id=<id>`. Le paramètre est revérifié côté
   serveur dans `app/(portail)/portail/demandes/page.tsx` contre le parc déjà
   lu sous le contexte cloisonné (`machinePreselectionneeValide`, nouvelle
   fonction pure de `demandes/presentation.ts`) — jamais cru sur parole ; une
   machine absente de cette liste (donc hors périmètre, par construction de
   `parcDuClient`) est silencieusement ignorée, le formulaire s'ouvrant sans
   machine pré-choisie. Le `<details>` du formulaire s'ouvre automatiquement
   dès qu'une machine est pré-choisie.
4. **Le bandeau de succès nomme la demande** par son numéro dès qu'il est
   connu (`confirmationDuDepot`, `demandes/presentation.ts`) — le dépôt
   portail étant synchrone, il l'est toujours ; `versLeRetourPortailDemandes`
   porte désormais `numero`/`annee` en paramètres de redirection en plus du
   motif.
5. **Gardien colonnes fermées étendu à sa source**
   (`tests/unit/portail/machine-colonnes-fermees.test.ts`) : deux nouveaux
   tests ferment, dans les deux sens, le sous-select de `modele` et celui de
   `modele.famille`, en plus de l'existant sur `Machine`.
6. **Épreuves** :
   - unitaires : `nomDeLaMachine`/`numeroDeSerieDeLaMachine`
     (`tests/unit/portail/presentation.test.ts`), `confirmationDuDepot` et
     `machinePreselectionneeValide`
     (`tests/unit/portail/demandes-presentation.test.ts`, nouveau fichier) ;
   - isolation : `tests/isolation/9j04-portail-demandes-creer.test.ts` étendu
     de trois scénarios (case cochée → `machine_arretee = true` ; case absente
     → `false` ; un `urgence` forgé dans le formulaire est ignoré, reste
     `"p3"`) ; le cloisonnement de `ficheMachineDuParc`/`parcDuClient`
     lui-même n'a pas eu besoin d'un nouveau scénario — l'extension du select
     est entièrement couverte par les scénarios déjà existants de
     `tests/isolation/9j06-portail-fiche-machine.test.ts` et
     `tests/isolation/portail-client.test.ts` (une fiche/ligne hors périmètre
     rend toujours `null`/absente, quelles que soient les colonnes
     sélectionnées) ;
   - e2e fonctionnel neuf : `tests/e2e/9k03-portail-machines-panne.spec.ts`
     (4 scénarios, 1280 et 375 px) — le bouton pré-choisit la bonne machine,
     et une déclaration « à l'arrêt » écrit bien `machine_arretee = true` et
     `urgence = "p3"` en base ;
   - `tests/e2e/tous-les-ecrans-rendent.spec.ts` : vert (ce gardien ne couvre
     que les routes back-office, aucune route portail n'y figure) ;
   - correction d'un e2e existant cassé par le changement de libellé du
     sélecteur : `captures-9j04-portail-demandes.spec.ts` sélectionnait la
     machine par son numéro de série en LIBELLÉ d'option — devenu « Famille ·
     Marque · Modèle » — corrigé pour sélectionner par VALEUR (l'id).
7. **Captures AVANT/APRÈS** (`captures-9k03-portail-machines-panne.spec.ts`,
   rejouée deux fois par `git worktree` — sur le commit `d907653b2`,
   précédant ce lot, puis sur le code livré) :
   `docs/propositions/9K03-PORTAIL-MACHINES-PANNE/captures/` — accueil, fiche
   machine, formulaire, aux deux largeurs.

## Ce que j'ai tranché, et pourquoi

- **`parcDuClient` réutilise `SELECTION_FICHE_MACHINE_PORTAIL`** au lieu de
  dupliquer le select de `ficheMachineDuParc` : les deux lisaient déjà
  exactement les mêmes colonnes de `Machine`, en deux endroits — la jointure
  neuve aurait dû être ajoutée deux fois, pour le même résultat.
- **Le bon d'intervention garde l'espace comme séparateur**, jamais le « · »
  du reste du portail : ce module (`lib/interventions/bon.ts`) est partagé
  avec le back-office (`app/(back-office)/interventions/[id]/bon/page.tsx`),
  qui n'était pas la cible de ce ticket — changer sa ponctuation aurait été un
  effet de bord visuel non demandé sur un écran que ce lot ne devait pas
  toucher.
- **`numeroDeLaDemande` n'a pas eu besoin d'être créée** : elle existait déjà
  (`lib/demandes/depot.ts:568-583`, écrite pour une autre carte) et répond
  exactement au besoin du scénario de rejeu (double clic). Le cas de succès
  normal n'a lui-même rien coûté : `deposerDemande` rend déjà `fiche.numero`/
  `fiche.annee` dans son résultat.
- **Aucun écran bureau modifié** : `machine_arretee` y était déjà visible
  (mesuré ci-dessus) — conformément à la consigne du ticket (« aucun écran
  bureau modifié sauf si la valeur n'y est visible nulle part »).

## Ce que je n'ai PAS fait

- **Aucune migration, aucune politique RLS modifiée** — la colonne et la
  policy d'ascendance existaient déjà.
- **Aucune route nouvelle** — `/portail/demandes` lit un paramètre de PLUS,
  `/api/portail/demandes/creer` ne change pas d'URL.
- **`lib/auth/**`, `depot/`, `11-FILE.sh`, `CLAUDE.md`** — non touchés.
- **Aucune liste de machines du back-office retouchée** pour la présentation
  partagée — `libelleMaterielComplet` (`lib/machines/presentation.ts`) reste
  la fonction du back-office, `nomDeLaMachine` celle du portail : même
  discipline que le reste du dépôt (« chaque domaine porte la sienne »), bien
  que les deux rendent une idée voisine.

## Ce que j'ai mesuré

- `pnpm format` / `pnpm typecheck` / `pnpm lint` : verts après chaque commit.
- `pnpm test` : 505 fichiers / 5555 tests, vert (après correctif D143 — deux
  nouveaux `<span>` en 12 px sans `font-bold`, détecté par
  `tests/unit/ui/retouches-2a.test.ts`).
- `pnpm test:isolation` : 228 fichiers / 1958 tests, vert (dont les trois
  scénarios neufs `machine_arretee`/`urgence`).
- `tests/e2e/tous-les-ecrans-rendent.spec.ts` : 59 passés, 3 ignorés
  (préexistants, étrangers à ce lot).
- `tests/e2e/9k03-portail-machines-panne.spec.ts` : 4 passés.
- `tests/e2e/9k02-portail-menu-accueil.spec.ts`,
  `captures-9j04-portail-demandes.spec.ts`,
  `captures-9j06-portail-fiche-machine.spec.ts`,
  `captures-9k02-portail-menu-accueil.spec.ts` : rejoués ensemble, 33 passés
  (aucune régression du changement de libellé/colonnes).
- `captures-9k03-portail-machines-panne.spec.ts` : 6 passés par passe, deux
  passes (avant/après), 12 images dans `captures/`.

## Pour la session suivante

- `pnpm verify:full` reste à la file (non joué ici, par consigne).
- `CI=1 pnpm verify` joué avant de rendre la main (voir le dernier commit).

## Reprise 9K03A (09/11/2026)

`CI=1 pnpm verify:full` sur le lot ci-dessus rendait **deux échecs**, aucun des
deux imputable au code applicatif.

1. **`tests/e2e/demandes.spec.ts:394` « LA FILE EST VIDE ET LE DIT »** —
   `tr[data-demande]` attendu 0, reçu 2. `9k03-portail-machines-panne.spec.ts`
   dépose réellement une demande (« machine à l'arrêt ») à 1280px ET à 375px,
   et ne l'effaçait jamais : deux demandes `p3` restaient ouvertes dans
   CODIMA-NC, et `demandes.spec.ts` les compte SANS filtre (par société,
   comme avant ce lot). Corrigé en suivant chaque id créé
   (`idsDemandesCreees`) et en l'effaçant par un `afterAll`, sur le modèle de
   `9edz-nouvelle-demande.spec.ts`.
2. **`tests/e2e/planning-charge-technicien.spec.ts:316`** — la case n° 3
   (mercredi) d'une semaine n'avait pas de barre de charge. Semaine du
   09-15/11/2026 : le mercredi 11 novembre est l'Armistice, férié semé
   (`prisma/seed-data.ts`). Lu le code : `barreChargeDuJour`
   (`app/(back-office)/planning/carte.ts`) rend `null` quand
   `minutesOuvrables <= 0` — EXACTEMENT le même état que « pas de calendrier
   connu » (`tauxCompact`, `lib/interventions/statistiques.ts`) — un jour
   fermé n'affiche donc PAS de barre, et c'est le comportement voulu, pas un
   défaut. Épreuve étrangère à 9K03 (semaine courante, sans rapport avec les
   machines/pannes), et aurait rougi pour TOUT lot vérifié cette semaine-là.
   Corrigé en choisissant le prochain lundi dont les six jours affichés
   (lundi→samedi) sont tous ouverts pour l'agence semée, via
   `chargerCalendrierAgence` + `estJourOuvre` (`lib/calendar`) — même famille
   d'oracle que 9K00-E2E-PLANNING5-FERIE, jamais une date en dur.

Rejoué dans la même exécution (`CI=1 --workers=1`) :
`9k03-portail-machines-panne.spec.ts` + `demandes.spec.ts` (11 passés),
`planning-charge-technicien.spec.ts` (5 passés),
`tous-les-ecrans-rendent.spec.ts` (59 passés, 3 ignorés, préexistants),
`pnpm test:isolation` (228 fichiers / 1958 tests), puis `CI=1 pnpm verify`
(format, typecheck, lint, test, isolation, build) — tout vert.
`pnpm verify:full` reste à la file, non rejoué ici par consigne de la
reprise.
