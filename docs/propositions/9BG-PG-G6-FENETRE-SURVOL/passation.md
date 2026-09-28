# 9BG-PG-G6-FENETRE-SURVOL — passation

Ticket regroupé, deux parties, dans l'ordre : PG-B2-FENETRE-POSE, PG-B4-SURVOL-CASES. Les deux
sont livrées. Quatre commits sur `main`, en local, non poussés :

- `5d66116` PG-B2-FENETRE-POSE — la fenêtre de pose
- `9288b9f` PG-B2-FENETRE-POSE — captures avant/après
- `ca2dcb7` PG-B4-SURVOL-CASES — le survol des cases
- `da11f28` PG-B4-SURVOL-CASES — captures avant/après

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

**PG-B2 — la fenêtre de pose.** Le dépôt d'une carte de la file « À planifier » n'écrit plus rien
directement : `components/planning/fenetre-pose.tsx` (neuf) s'ouvre à la place, pré-remplie du
technicien et du jour visés par la case (ou, depuis le bouton « Poser… » ajouté sur chaque carte —
clavier et téléphone —, du premier technicien de la liste et du jour du jour). Le planificateur y
choisit une durée (puces 30 min à 4 h, ou « Autre »), puis une heure parmi les créneaux réellement
libres (lus sur `GET .../verdict-pose`, PG-B1), voit les contrôles en direct, et « Planifier »
appelle la MÊME route `POST .../deplacer` que le glisser-déposer direct — aucune requête d'écriture
avant ce clic. Pour l'exploitant : une carte de la file qui, avant ce ticket, refusait le dépôt
100 % du temps en vue Semaine (et parfois en vue Jour, faute de durée) se pose désormais.

**PG-B4 — le survol des cases.** Pendant qu'on glisse une carte, la case survolée se teinte (jetons
existants `app-vert`/`app-rouge`, aucune couleur neuve) et affiche en clair pourquoi elle refuserait
— « Absent », « Férié », un jour ordinairement fermé (composé avec `mot("agence")`), ou une
habilitation manquante (jamais déclenché aujourd'hui, voir plus bas) — annoncé aussi par une région
`aria-live` unique pour un lecteur d'écran. `lib/interventions/survol.ts` (neuf) est une fonction
PURE, sans requête, qui ne fait que relire ce que la page a déjà chargé pour dessiner la grille :
elle NE REMPLACE PAS le serveur, qui reste seul juge à l'écriture (`jugerPose`).

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

Quatre paires de captures, prises par des specs e2e dédiées (`tests/e2e/captures-pg-b2-fenetre-pose.spec.ts`,
`tests/e2e/captures-pg-b4-survol-cases.spec.ts`), rejouées sur le commit `ca9bcea` (le dernier avant
ce ticket, via `git worktree`) puis sur le code livré :

- **PG-B2, 1280 px** — AVANT : dépôt d'une carte « À planifier » sur une case Semaine → bandeau
  rouge « L'heure de début et la durée prévue sont obligatoires pour planifier cette
  intervention. ». APRÈS : la même case ouvre « Poser — PGB2 · Curatif · P3 — normale »,
  technicien et date pré-remplis, sans requête d'écriture (vérifié par écoute réseau dans
  `planning-fenetre-pose.spec.ts`).
- **PG-B2, 375 px** — AVANT : rien à cliquer (aucun équivalent tactile au glissé). APRÈS : le bouton
  « Poser… » ouvre la même fenêtre.
- **PG-B4, 1280 px** — AVANT : survoler la case d'un technicien absent ne se distingue en rien
  d'une case ordinaire. APRÈS : la case se teinte en rouge et affiche « Absent », en plus de la
  pastille « Agenda bloqué » déjà dessinée par PLANNING-1.
- **e2e ciblé de fin de session** (voir plus bas) : 67 passées, 3 ignorées (pré-existantes, sans
  rapport avec ce lot), 0 échouée.

## Ce que j'ai tranché et pourquoi

1. **« Nh disponibles » devient « N créneaux libres ».** La maquette promet un total d'heures
   libres dans la journée ; PG-B1 (`verdict-pose`) ne rend que le NOMBRE de débuts possibles pour
   LA DURÉE choisie, jamais un total d'heures. Inventer ce total aurait affiché un chiffre que
   personne n'a calculé. J'ai réutilisé les clés déjà existantes `planning.creneau_libre_un` /
   `planning.creneaux_libres`, honnêtes vis-à-vis de la donnée réelle.
2. **« Absent » vs « Aucun créneau de cette durée » — une SONDE, pas une nouvelle route.** PG-B1 ne
   distingue pas les deux quand `creneaux` est vide (le territoire de ce ticket n'incluait pas la
   route). J'ai ajouté un second appel à `duree=1` : si même une minute ne trouve aucun début, la
   cause la plus probable est une absence couvrant la journée. **Approximation reconnue** : un jour
   rempli à la dernière minute près donnerait le même signal — documenté dans le docblock de
   `FenetrePose`.
3. **Techniciens et fuseau du bouton « Poser » viennent du serveur, jamais devinés côté client.**
   `page.tsx` calcule `techniciensPourPose` (triés, noms résolus via `quiTravaille`) et
   `fuseauParAgence` (le fuseau de l'AGENCE DE L'INTERVENTION, jamais celui du technicien visé, ni
   une constante — I7). Une carte dont l'agence n'a pas de calendrier connu garde l'ancien
   comportement (`depuisFile` retombe à `false`) plutôt que d'ouvrir une fenêtre qui ne saurait pas
   afficher d'heure locale.
4. **`etatDeLaCase` accepte une habilitation « inconnue » et NE L'INVENTE PAS.** Les habilitations
   d'un site ne sont pas chargées par la page du planning aujourd'hui : `donneesChargees.habilitationManquante`
   vaut toujours `null` en pratique, et la fonction rend `possible: true` plutôt qu'un refus sans
   preuve — exactement ce que demandait le ticket (« Si une donnée manque… rend possible »). Le
   motif « Habilitation manquante » existe dans le type et le dictionnaire, prêt à s'activer le
   jour où cette donnée sera chargée, mais AUCUN chemin ne le déclenche aujourd'hui.
5. **Vue Jour : pas de distinction « Férié » / « Agence fermée ».** `hors_ouverture`, en vue Jour,
   est par CRÉNEAU HORAIRE, jamais par jour entier — impossible d'en déduire honnêtement un férié
   nommé sans charger une donnée supplémentaire. Les deux motifs se rangent donc sous « Agence
   fermée » en vue Jour ; seule la vue Semaine, à la granularité du jour, porte le nom du férié.
6. **La carte en cours de glissé voyage par un state React (`Depot.carteEnGlisse`), jamais par
   `dataTransfer.getData()`.** Le navigateur refuse de rendre les VALEURS du `dataTransfer` avant
   l'événement `drop` (seuls les TYPES sont lisibles à `dragover`) — une restriction du standard.
   `BlocPosable` connaît déjà la carte en props à `dragstart` ; `commencerGlisse`/`terminerGlisse`
   la font transiter par le contexte `Posable`.
7. **Un refus de « Planifier » ferme la fenêtre plutôt que d'afficher un message dedans.** La
   fenêtre est un `<dialog>` natif (`showModal()`), qui couvre tout le reste de la page : le
   bandeau de refus existant (`Posable`, rendu en dessous) resterait invisible tant qu'elle est
   ouverte. « Planifier » ferme donc la fenêtre puis appelle `deposer`, exactement comme un
   glissé direct — même mécanisme, même bandeau, jamais un second endroit qui affiche un refus.

## Ce que je n'ai PAS fait

- Aucune migration, aucune ligne de semis, aucun prix — conforme aux interdits du ticket.
- Aucun sélecteur de DATE dans `FenetrePose` : le ticket ne demande des puces que pour la durée et
  l'heure ; le jour reste pré-rempli, jamais choisi dans la fenêtre.
- Aucune vraie vérification d'habilitation dans `etatDeLaCase` (voir point 4 ci-dessus) — la donnée
  n'existe pas côté client aujourd'hui, et PG-B1 (hors territoire) ne la fournit pas de la fenêtre
  d'attente.
- Aucun test n'a été désactivé, aucune assertion assouplie pour faire passer une épreuve.

## Les pièges pour la session suivante

- **`dataTransfer.getData()` ne se relit pas à `dragover`** — seuls les TYPES du glissé (pas les
  valeurs) sont visibles avant `drop`. Toute future extension du survol qui aurait besoin d'un
  champ supplémentaire de la carte glissée doit passer par `Depot.carteEnGlisse`
  (`components/planning/pose.tsx`), jamais retenter `dataTransfer`.
- **`getByRole("button", { name: "1 h" })` sans `exact: true` matche aussi « 1 h 30 »** — mesuré en
  faisant tourner `planning-fenetre-pose.spec.ts` : Playwright fait une correspondance partielle
  par défaut. Toutes les puces de durée ont un nom qui commence par un préfixe partagé ; toujours
  `exact: true` dans un futur test de cette fenêtre.
- **`page.waitForURL(/\/planning/)` ne détecte rien si l'URL est DÉJÀ `/planning`** — le succès de
  « Planifier » navigue par `window.location.assign` vers la MÊME route (un rechargement complet,
  jamais un changement de route). Un futur test doit attendre la RÉPONSE réseau
  (`page.waitForResponse(...".../deplacer"...)`), jamais l'URL.
- **jsdom n'implémente pas `HTMLDialogElement.showModal`** — `FenetrePose` le garde par
  `typeof dialogue.showModal === "function"` ; sans cette garde, tout test unitaire qui monte le
  composant lève une exception non liée à la logique testée.
- Si PG-B1 (`verdict-pose`) est un jour étendu pour rendre le NOMBRE D'HEURES LIBRES ou la cause
  exacte d'un refus sans heure (absence vs jour complet), remplacer directement la sonde à
  `duree=1` et la formule `decompte(creneaux.length, …)` par la vraie donnée — les deux sont des
  approximations documentées, pas une décision définitive.
- Le bouton « Poser » par défaut au PREMIER technicien de la liste triée : si ce technicien n'est
  pas celui voulu, il se change dans le `<select>` de la fenêtre elle-même — pas de piège caché,
  juste un défaut peu visible à mentionner si un utilisateur rapporte « le mauvais technicien
  apparaît en premier ».

## Ce qui reste à faire

- Rien d'identifié à l'intérieur du territoire de ce ticket. Les deux parties sont complètes,
  testées (unitaires + e2e) et capturées.
- Hors territoire, pour une session future : si le planning charge un jour les habilitations
  exigées par site (pour un autre besoin), brancher cette donnée dans
  `donneesChargeesPourSurvol.habilitationManquante` et dans le `donneesChargees` construit par
  `CasePosable` (aujourd'hui `{ habilitationManquante: null }` en dur) activerait le quatrième
  motif du survol sans changer sa signature.

## Contrôle de fin de session

Trois commandes, dans l'ordre imposé, chacune au premier plan, aucune relance nécessaire (zéro
rouge) :

1. `CI=1 pnpm verify` → **vert** (format:check, typecheck, lint, `test` 3117/3117, `test:isolation`
   1268/1268, `build` réussi — 70 routes générées, `/planning` à 4,94 kB / 162 kB First Load JS).
2. `pnpm feries:horizon && pnpm audit:partitions` → **vert** (2 territoires contrôlés, au moins
   douze mois d'avance partout ; 13 partitions couvertes jusqu'à 2027-09, partition par défaut
   vide).
3. `CI=1 pnpm exec playwright test tests/e2e/planning-fenetre-pose.spec.ts
   tests/e2e/captures-pg-b2-fenetre-pose.spec.ts tests/e2e/planning-survol-cases.spec.ts
   tests/e2e/captures-pg-b4-survol-cases.spec.ts tests/e2e/tous-les-ecrans-rendent.spec.ts
   tests/e2e/ecrans-largeur-utile.spec.ts tests/e2e/coque-375.spec.ts
   tests/e2e/planning-largeur-et-carte.spec.ts tests/e2e/planning-cibles-375.spec.ts` → **vert**,
   67 passées, 3 ignorées (pré-existantes, `/demandes/[id]`, `/imports/[id]`,
   `/parametres/forfaits/[id]` — routes dynamiques sans repère fixe pour ce fichier, déjà ignorées
   avant ce lot), 0 échouée.
