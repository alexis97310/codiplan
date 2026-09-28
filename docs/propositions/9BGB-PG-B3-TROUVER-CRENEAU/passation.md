# 9BGB-PG-B3-TROUVER-CRENEAU — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

- `components/interventions/trouver-creneau.tsx` (neuf) — le bouton « Trouver un créneau » et la
  fenêtre qu'il ouvre. Client component qui rend `FenetrePose` (`components/planning/fenetre-pose.tsx`,
  **import, aucune copie**), pré-remplie du technicien, de la durée et du jour que la fiche connaît
  déjà (rien d'inventé), avec le jour **choisissable** (`jourChoisissable`, voir plus bas). À la
  confirmation, écrit par `posterDeplacement` — la même fonction, donc la même route
  (`POST /api/interventions/{id}/deplacer`) et la même garde (`peutPlanifier`/`peutDeplacer`) que
  « Déplacer ». Réussite → `window.location.reload()` ; refus → affiché sous le bouton, sa clé
  nommée (`data-refus-creneau`).
- `components/planning/fenetre-pose.tsx` — nouvelle prop optionnelle `jourChoisissable` (défaut
  `false`, le planning ne la passe jamais). Quand elle est vraie, le champ « Date », jusqu'ici un
  texte fixe, devient un `<input type="date">` modifiable ; un état interne (`jourChoisi`,
  initialisé depuis la prop `jour`) remplace toutes les lectures internes de `jour`. Le planning
  garde exactement son comportement d'avant (jour toujours résolu par l'appelant, jamais un
  sélecteur).
- `components/planning/pose.tsx` — extrait `posterDeplacement` (exportée), l'écriture pure
  (construction du `FormData`, `fetch`, interprétation de la réponse) hors de `Posable.deposer`,
  qui l'appelle désormais au lieu de dupliquer la logique. Comportement de `deposer` inchangé (même
  dédoublonnage `enVol`, mêmes quatre issues).
- `app/(back-office)/interventions/[id]/page.tsx` — les blocs « Planifier » et « Déplacer »
  reçoivent chacun `enTete={<TrouverCreneau .../>}` et `saisieManuelle` (nouvelles props de la
  fonction locale `Action`) : le bouton apparaît en tête, le formulaire existant reste **identique**
  mais passe sous un `<details><summary>Saisir à la main</summary>` fermé par défaut. Le jour de
  départ passé à `TrouverCreneau` est la date de l'intervention si elle en a une, sinon le jour
  courant de la société (`jourInitialCreneau`, un repère d'affichage, jamais une valeur métier —
  la fenêtre le laisse changer).
- `lib/i18n/fr.ts` — deux clés neuves : `intervention.action.trouver_creneau` (« Trouver un
  créneau »), `intervention.action.saisir_a_la_main` (« Saisir à la main »).

**Pour l'exploitation** : depuis la fiche d'une intervention « À planifier » (ou lors d'un
« Déplacer »), un planificateur n'a plus besoin d'aller lire le planning à part : le bouton ouvre
directement les créneaux disponibles du technicien choisi, pour le jour qu'il choisit, et écrit en
un clic. Le formulaire manuel reste disponible pour qui préfère taper les quatre valeurs (clavier,
repli).

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- `pnpm test` (unitaires) : 302 fichiers, 3148 tests, tous verts (3147 avant l'ajout de la spec de
  capture, +1 avec elle).
- `CI=1 pnpm verify` (format, typecheck, lint, test, test:isolation, build) : vert, code de sortie 0.
- `CI=1 pnpm verify:full` (verify + feries:horizon + audit:partitions + test:e2e complet), **joué
  en entier, au premier plan, en un seul appel, deux fois** (la première a révélé deux épreuves à
  corriger, la seconde est celle qui compte) : **572 épreuves, 569 passées, 3 ignorées
  (pré-existantes, sans rapport), 0 échouée**, code de sortie 0, ~21 minutes.
- Les deux épreuves neuves de `tests/e2e/fiche-trouver-creneau.spec.ts` (scène `PGB3-`) : succès
  (créneau choisi → `statut = planifiee` en base, `technicien_id`, `date_planifiee`,
  `creneau_debut`/`creneau_fin` non nuls — vérifié par lecture Prisma directe) et refus nommé
  (Koné un samedi fermé, choisi dans la fenêtre : `intervention.refus.jour_ferme` visible,
  « Planifier » inactif).
- Captures AVANT (commit `7746003`, `git worktree`) / APRÈS (commit `afd229a`) produites par
  `tests/e2e/captures-pg-b3-trouver-creneau-fiche.spec.ts` — voir
  `docs/propositions/PG-B3-TROUVER-CRENEAU-FICHE/captures/README.md`.

## Ce que j'ai tranché et pourquoi

- **`posterDeplacement` extraite plutôt que `deposer` appelée depuis la fiche.** La fiche n'est pas
  enveloppée dans `<Posable>` (ce contexte porte aussi le glisser-déposer, `carteEnGlisse`, le
  survol — rien de tout ça n'a de sens hors du planning) : l'enveloppe entière aurait été un import
  disproportionné pour la seule écriture. Extraire la fonction pure qui POSTE et interprète la
  réponse, et la partager, tient la promesse « même route, même garde » sans emprunter au planning
  ce qui n'est pas à lui.
- **`jourChoisissable` sur `FenetrePose` plutôt qu'une fenêtre séparée pour la fiche.** Le ticket
  l'exige explicitement (« import, aucune copie »). L'alternative (dupliquer `FenetrePose` en
  miniature) aurait recréé le risque de divergence que PG-B1/PG-B2 viennent de fermer côté serveur.
- **« Saisir à la main » enveloppe `children`+bouton, jamais `note`.** La note d'explication
  (« Les quatre valeurs… ») reste visible sans dépli : elle explique aussi bien le bouton que le
  formulaire replié en dessous.
- **Le rechargement de la fiche est un `window.location.reload()` simple**, pas la danse
  `urlDeRechargement` (purge `motif`/`avertissement`, ajoute les avertissements en paramètre) que
  `Posable.deposer` fait pour le planning. La fiche ne lit les avertissements que via son propre
  paramètre `?avertissement=`, déjà alimenté par les formulaires natifs (`/deplacer` redirige
  lui-même) — composer cette même URL depuis `TrouverCreneau` aurait dupliqué une construction déjà
  faite ailleurs pour un gain non demandé par ce ticket. Documenté ici comme **hors périmètre**,
  pas oublié : un lot futur pourrait vouloir afficher les avertissements après un « Trouver un
  créneau » réussi, ce que le rechargement simple ne fait pas aujourd'hui.

## Ce que je n'ai PAS fait

- Je n'ai pas fait apparaître les avertissements (courriels partis, etc.) après une confirmation
  réussie depuis `TrouverCreneau` — voir ci-dessus.
- Je n'ai pas touché `components/planning/pose.tsx` au-delà de l'extraction de `posterDeplacement` :
  aucune logique de glisser-déposer, de survol ou de `Posable` n'a changé.
- Je n'ai pas ajouté de sélecteur de jour à la fenêtre ouverte DEPUIS LE PLANNING — `jourChoisissable`
  vaut toujours `false` pour `Posable`/`BoutonPoser`/`CasePosable`, conformément au ticket
  (« le planning garde son comportement »).

## Les pièges pour la session suivante

- **`saisieManuelle` sur `Action` change la structure DOM de « Planifier » et « Déplacer » pour
  TOUTE épreuve qui les touche.** Douze fichiers e2e préexistants interagissaient directement avec
  les champs `date_planifiee`/`heure_debut`/`duree_min`/`technicien_id` sans passer par un repli —
  ils sont désormais masqués derrière `<details><summary>Saisir à la main</summary>`. Tous corrigés
  dans ce lot (mise en scène seulement, aucune assertion changée) via le nouveau repère
  `tests/e2e/setup/saisie-manuelle.ts` (`ouvrirSaisieManuelle`). **Deux ont été ratées au premier
  balayage** (`captures-9ai-gr14-libelles-saisie.spec.ts`, `fiche-actions.spec.ts`) parce qu'elles
  posent `date_planifiee` comme CLÉ D'OBJET Prisma dans leur semis, pas comme `name="…"` HTML — un
  grep sur `name="date_planifiee"` seul ne les trouve pas. Toute future épreuve qui ouvre
  « Déplacer » (déjà repliée sous son propre `<summary>`) doit désormais ouvrir DEUX replis
  successifs, pas un seul : `deplacerDetails.locator("summary").first().click()` (le premier,
  jamais `.locator("summary").click()` seul — ambigu depuis que le second `<summary>` existe),
  puis `ouvrirSaisieManuelle(...)`.
- **Le gardien `sans-chaine-visible-en-dur` (L0-11) refuse une chaîne dans les OPTIONS d'un
  `getByRole`** (`name`, `description`), même provisoire — mesuré sur ce lot : une spec de capture
  AVANT/APRÈS ne peut PAS utiliser `page.getByRole("button", { name: "Trouver un créneau" })` avec
  une chaîne en dur (nécessaire puisque la clé neuve n'existe pas sur le code d'AVANT). La voie
  retenue, déjà utilisée par `captures-pg-b2-fenetre-pose.spec.ts`, est `.locator(css, { hasText })`
  — pas une requête de rôle, donc hors du périmètre du gardien.
- **`optionsTechniciens` (sans date, sans absences) est réutilisé tel quel** pour peupler
  `TrouverCreneau.techniciens` (`{id: valeur, nom: libelle}`) — son `libelle` est déjà le nom nu
  dans ce cas précis (pas de suffixe d'agenda bloqué), donc la forme correspond exactement à ce que
  `FenetrePose` attend. Si `optionsDAffectation` change un jour sa forme, cette correspondance est
  à revérifier.

## Ce qui reste à faire

- Rien d'identifié dans le territoire de ce lot : le bouton, la fenêtre, l'écriture partagée, les
  deux épreuves e2e neuves, les captures et la remise au vert de l'existant sont tous livrés et
  mesurés verts (`CI=1 pnpm verify:full`, deux passages, le second à 0 échec).
- Hors territoire : afficher les avertissements après une confirmation réussie depuis la fiche
  (voir « Ce que j'ai tranché et pourquoi »).
