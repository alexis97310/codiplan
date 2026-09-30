# Passation — 9CK-PG-G11B-JOUR-SUITE

Décisions d'Alexis du 30/09/2026 (« Planning », points 3 à 5), inscrites sous **D147**
(`docs/arbitrages.md`, amende D142) : le libellé « Heure à fixer », le dépôt d'une carte de la file
pré-remplissant technicien/date/heure dans la fenêtre de pose, et les cartes « Heure à fixer »
glissables directement sur la frise.

## Ce que j'ai changé

1. **`docs/arbitrages.md`** — D147, qui comble les trois points que D142 renvoyait à « Ce qui n'est
   pas construit par ce ticket » ; D142 porte désormais `**Amendé par D147.**`.
2. **Le libellé** — `lib/i18n/fr.ts`, `planning.jour_sans_heure` vaut « Heure à fixer » au lieu de
   « Journée — heure non fixée ». La clé ne change pas de nom : `affichage-materiel.spec.ts` et le
   ticket 9CJ la lisaient déjà par la clé, jamais par le texte — aucun test cassé par ce seul
   changement de valeur.
3. **L'heure pré-remplie dans la fenêtre de pose** — `components/planning/pose.tsx`
   (`DemandeDOuverture.heureMinutesInitiale`, transmis par `onDrop` de `CasePosable` depuis
   `cible.minutes`, `null` depuis `BoutonPoser`) et `components/planning/fenetre-pose.tsx`
   (`FenetrePose` reçoit `heureMinutesInitiale`, initialise `heureMinutes`/`heureAutreTexte`
   dessus, porte `data-heure` sur le `<dialog>`). Un déplacement de la case depuis la file écrit
   maintenant technicien + date + heure ensemble, tous les trois modifiables avant « Planifier ».
   **Règle d'écran ajoutée** : tant que l'utilisateur n'a pas retouché l'heure (aucun clic sur une
   puce, aucune saisie dans « Autre heure »), un changement de durée la GARDE au lieu de la
   remettre à vide — sinon la valeur donnée par le dépôt serait effacée au premier clic d'une carte
   sans durée. Dès que l'heure est choisie par l'utilisateur, ou que le technicien ou le jour
   change, le comportement d'avant ce ticket reprend intact.
4. **Les cartes « Heure à fixer » glissables** — `app/(back-office)/planning/carte.ts`
   (`glisseDeLaCarteSansHeure`, fonction pure : durée connue → déplacement direct ; durée inconnue
   → ouvre la fenêtre de pose, jamais une écriture sans durée) et `SansHeureVide` (page.tsx),
   qui enveloppe chaque carte dans `BlocPosable` quand `VueJour` lui passe la prop facultative
   `glissable` — seulement dans la branche FRISE (une case de dépôt existe), jamais dans la branche
   « axe vide ».
5. **Épreuves** : `tests/e2e/planning-jour-suite.spec.ts` (quatre scénarios contre la vraie route et
   la vraie base) et `tests/e2e/captures-pgd1b-jour-suite.spec.ts` (captures + mesure d'accessibilité).

**Pour l'exploitation** : un planificateur peut désormais déposer une carte de la file directement
sur une heure précise de la frise (la fenêtre de pose s'ouvre déjà à cette heure, à confirmer), et
une ligne « Heure à fixer » dont la durée est déjà connue peut être glissée directement sur une case
sans repasser par la fiche — le même geste que pour une intervention déjà planifiée.

## Ce que j'ai mesuré

- **D147, numéro re-vérifié au départ** : dernières décisions écrites D142, D145, D146 ;
  D141/D143/D144 réservés mais non écrits ; D147 confirmé libre par `grep "^## D14" docs/arbitrages.md`.
- **Constat serveur (aucune extension nécessaire) refait au départ** : `POST .../deplacer`,
  `jugerPose`, les quatre verdicts (ouverture, habilitation, absence, chevauchement),
  `peutDeplacer`/`peutPlanifier`/`peutGarderHeure` jugent déjà, sans distinction, une ligne datée
  sans créneau à qui l'on donne une heure — exactement les contrôles d'un déplacement ordinaire.
  Confirmé par la mesure e2e : la route n'a reçu AUCUNE modification, et les quatre scénarios de
  `planning-jour-suite.spec.ts` passent contre elle telle quelle.
- **Rouge → vert** : `tests/unit/i18n/libelle-heure-a-fixer.test.ts` était rouge sur `main` avant le
  commit du libellé (`Journée — heure non fixée` reçu, `Heure à fixer` attendu). Les cas ajoutés à
  `tests/unit/planning/pose.test.tsx` (data-heure) et `tests/unit/planning/carte.test.ts`
  (`glisseDeLaCarteSansHeure`) référençaient des identifiants/fonctions qui n'existaient pas encore
  — rouges par construction avant les commits de code. `tests/unit/planning/fenetre-pose-heure.test.tsx`
  (neuf) était rouge (`heureMinutesInitiale` non lu, `data-heure` absent) avant le commit 3.
- **`pnpm test`** : 350 fichiers, 3564 tests, tous verts après le dernier commit de code.
- **`pnpm verify`** (format, typecheck, lint, test, test:isolation, build) : vert en entier.
- **`pnpm feries:horizon`** et **`pnpm audit:partitions`** : verts.
- **`pnpm test:e2e`** (suite complète, 744 tests) : **737 passés, 7 ignorés, 0 échec** (29,3 min).
  `pnpm verify:full` en un seul appel a dépassé le plafond de 30 minutes de l'outil qui l'exécutait
  ici (format+typecheck+lint+test+isolation+build+feries+partitions+e2e mis bout à bout) — j'ai donc
  rejoué chaque morceau séparément, tous verts, la suite e2e étant la plus longue (29,3 min à elle
  seule). Aucun échec, seulement un plafond de temps de l'outil d'exécution.
- **Deux échecs e2e mesurés comme PRÉ-EXISTANTS, jamais causés par ce ticket** — vérifiés par
  rejeu isolé et par un `git worktree` sur `77428b2` (le dernier commit avant ce ticket) :
  - `fiche-trouver-creneau.spec.ts:455` (« avec un donneur d'ordre ») échoue sur `main` AUSSI, en
    isolation (`expect(courrielsCaptures().length).toBe(avant + 2)` — un compte de courriels qui
    dérive, sans rapport avec ce ticket).
  - `planning-fenetre-pose.spec.ts:125` échoue UNIQUEMENT en exécution parallèle massive
    (12 fichiers ensemble) et passe systématiquement en isolation — le piège documenté du ticket
    (« épreuves qui comptent large » / pollution inter-fichiers sous `fullyParallel`), pas une
    régression de ce lot.
- **La mesure du script de captures** (textes < 12 px, cibles < 32 px, débordement — seuils de
  `scripts/lib/mesure-captures.ts`, D138 et spécification §10) : **identique AVANT et APRÈS** sur
  les six écrans communs aux deux passes — 0 texte sous 12 px, 0 débordement partout ; 7 puis 10
  cibles sous 32 px à 375 px, mais ce sont les `<select>`/`<input>`/`<button>` de la barre de
  filtres (PG-C6, hors territoire de ce ticket) et le lien d'évitement, déjà présents AVANT. Détail
  dans `docs/propositions/9CK-PG-G11B-JOUR-SUITE/captures/README.md`.

## Ce que j'ai tranché, et pourquoi

- **D147 amende D142** sur son seul paragraphe « Ce qui n'est PAS construit », pour les trois points
  précis nommés par la décision d'Alexis — le reste de D142 (orientation de la frise, écarts nommés
  à `dayPlan()`) reste entier.
- **La règle « l'heure survit à un choix de durée »** n'a été ajoutée QUE pour `choisirDuree` et
  `choisirDureeAutre` — `choisirJour` et le changement de technicien continuent de remettre l'heure
  à vide sans condition, exactement comme avant ce ticket (le ticket ne demandait pas de changer ce
  point, et la question 1 de la passation reste ouverte, voir plus bas).
- **La prop d'heure de `FenetrePose` (`heureMinutesInitiale`) est créée par CE ticket** — mesuré au
  départ que 9CJ-PG-G13-TELEPHONE-CREER-ICI (déjà publié sur `main`, dernier commit avant ce lot)
  n'a ajouté AUCUNE prop d'heure à `FenetrePose` : il transporte `poser_heure` dans l'URL
  (`lib/interventions/creer-ici.ts`) mais s'arrête avant de la donner à la fenêtre. Il n'y avait donc
  rien à réutiliser. Reste à faire (voir plus bas) : brancher `poser_heure` jusqu'à `FenetrePose`
  depuis `components/interventions/trouver-creneau.tsx`.
- **Le cas « carte Heure à fixer SANS durée déposée sur une heure »** est éprouvé en UNITAIRE
  seulement (`carte.test.ts`, `glisseDeLaCarteSansHeure({ dureeMin: null, … })` → `depuisFile: true`),
  jamais en e2e : la contrainte `intervention_planifiee_a_sa_duree` (`NOT VALID`, mais VÉRIFIÉE à
  toute nouvelle écriture) refuse d'insérer une ligne `planifiee` sans `duree_estimee_min` — un tel
  scénario ne peut pas être forgé sans contourner une contrainte de la base, ce que ce ticket
  interdit.
- **La fenêtre HAUTE (2000 px) plutôt que le calcul de défilement de `setup/glisser.ts`** pour le
  scénario de capture (c) : un seul scénario, mesuré plus simple à rendre par une fenêtre assez
  haute pour n'avoir aucun défilement vertical à gérer, avec `scrollIntoViewIfNeeded()` pour le seul
  défilement HORIZONTAL du cadre de la frise (mesuré nécessaire : à 1280 px de large, la case 14:00
  déborde du cadre défilant et `elementFromPoint` n'y résout rien tant qu'elle n'est pas amenée à
  l'écran).

## Ce que je n'ai pas fait

- **`poser_heure` n'est pas branché jusqu'à `FenetrePose` depuis la fiche** (`trouver-creneau.tsx`) —
  hors du périmètre nommé par ce ticket (9CJ le transporte dans l'URL, ce ticket crée la prop
  d'heure de `FenetrePose`, mais le fil entre les deux n'est pas tiré). C'est un reste à faire
  nommé, pas un oubli.
- **Aucune capture AVANT n'a rejoué la vue Semaine ni la fiche** : ce ticket ne les touche pas.
- **La recherche d'une heure de repli plus large qu'un pas de 30 minutes** (`heureLibre`, dans
  `planning-jour-suite.spec.ts`) — bornée à ±120 minutes ; au-delà, l'épreuve échoue bruyamment
  plutôt que de chercher indéfiniment. Non mesuré nécessaire à ce jour (l'offset de 420 semaines n'a
  jamais eu besoin de repli, `heureKone10`/`heureKone14` valent toujours 600/840 en pratique).

## Pièges pour la session suivante

- **Les deux échecs e2e pré-existants** (voir « Ce que j'ai mesuré ») ne sont pas de ce lot : ne pas
  les recorriger ici, et ne pas être surpris s'ils réapparaissent dans une exécution parallèle
  massive de `pnpm test:e2e`.
- **`pnpm verify:full` en un seul appel peut dépasser un plafond de temps de l'outil qui l'exécute**
  (30 minutes mesurées ici) — la suite `test:e2e` à elle seule prend 29,3 minutes. Si ce plafond se
  reproduit, rejouer les morceaux séparément (`verify` puis `feries:horizon`/`audit:partitions`
  puis `test:e2e`) donne le même verdict sans le dépasser.
- **Le glisser d'une carte à 1280 px, quand la cible déborde du cadre défilant de la frise** :
  `elementFromPoint` renvoie `null` sur un point hors du viewport ou hors de la zone visible du
  cadre défilant — toujours appeler `cible.scrollIntoViewIfNeeded()` (ou élargir la fenêtre comme
  `setup/glisser.ts` le fait déjà pour le cas général) avant de mesurer `boundingBox()`.
- **`getByRole` sur le contenu d'un `<dialog>` non ouvert par `showModal` (jsdom, tests unitaires)**
  ne trouve rien par défaut — passer `{ hidden: true }`, comme dans
  `tests/unit/planning/fenetre-pose-heure.test.tsx`.
- **`ListeJour` (téléphone, sous 900 px) ne porte pas de titre de section** pour les lignes « Heure
  à fixer » — la différence de libellé (point 3) n'y est donc pas visible ; c'est attendu, voir la
  capture `ligne-sans-heure-375-*`.

## Ce qui reste à faire

- Brancher `poser_heure` (déjà transporté dans l'URL par 9CJ) jusqu'à `FenetrePose`, via une prop à
  ajouter sur `components/interventions/trouver-creneau.tsx` — nommé mais non construit par ce
  ticket.
- **À confirmer par Alexis** :
  1. Changer de technicien dans la fenêtre de pose efface l'heure pré-remplie par la case (comportement
     d'aujourd'hui, gardé tel quel) : faut-il la garder aussi dans ce cas ?
  2. Une carte « Heure à fixer » sans durée déposée sur la frise ouvre la fenêtre de pose (durée à
     choisir, heure déjà mise) au lieu d'être posée directement : confirmé ?
