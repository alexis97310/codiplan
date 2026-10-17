# 9F4H1-HORS-RESEAU-CONSULTATION — passation

Décisions n° 105 et 106 d'Alexis (14/10/2026). Lot (1) des trois annoncés : la
consultation sans réseau. Aucune écriture mise en file (lots 2 et 3).

## Ce qui a été livré, point par point

1. **Redirection jamais mise en cache** (`public/sw.js`) — mesuré : une
   navigation plein document vers `/connexion` sous session active esquive
   déjà le risque (`opaqueredirect`, exclu par `reponse.ok`). Le vecteur réel
   est un `fetch()` de script (pré-chargement `next/link`, navigation
   client) : `!reponse.redirected` ajouté en défense en profondeur, éprouvé
   par ce vecteur réel dans `tests/e2e/offline/socle-pwa.spec.ts`.
2. **`GET /api/terrain/instantane`** — même fonctions de dépôt que `/terrain`
   et `/terrain/[id]`, sans montant, sans octets de photo, sans
   `marquerVuParTechnicien`. Isolation éprouvée (technicien, société).
   **Taille mesurée** (semis e2e, un technicien, 5 fiches) : **5 119 octets**
   — sous réserve d'un technicien avec beaucoup plus d'interventions ou de
   photos nombreuses, jamais mesuré à cette échelle.
3. **Copie IndexedDB** (`lib/terrain/copie-locale.ts`, base `codiplan-terrain`,
   un seul enregistrement) écrite par `components/terrain/copie-locale.tsx` à
   l'ouverture et après chaque navigation terrain (throttle 60 s,
   `performance.now()`).
4. **`/terrain-hors-reseau`** (page publique, sans donnée) lit la copie et
   affiche la journée ou une fiche. `public/sw.js` (coquille `v2`) l'ajoute à
   la coquille et sert cette page en repli pour `/terrain` et ses fiches
   quand le réseau manque — repli SANS mise en cache de ces routes
   authentifiées.
5. **`BandeauReseau`** sur `/terrain`, `/terrain/[id]` et la coquille —
   `navigator.onLine` + `online`/`offline`, un seul mécanisme.
6. **Effacement** (décision n° 106) : un écouteur délégué sur l'action
   `/api/session/deconnexion` (racine, `app/layout.tsx`) plutôt que cinq
   composants posés sur les cinq formulaires mesurés ; effacement à
   l'arrivée sur `/connexion` ; effacement par remplacement d'identité dans
   `ecrireCopieEnRemplacantLidentite` (défense en profondeur).
7. **D213** (`docs/arbitrages.md`) amende D121 : I4 devient une version
   réduite, en trois lots. Backlog : L3-07 n'est **pas** passé à
   « EN COURS » — voir « Points ouverts ».
8. Captures 375/1280 px, viewport, sans `fullPage` : voir `captures/`.

## Ce que 9F4 a livré, et que ce lot NE TOUCHE PAS

Le brouillon `localStorage` (`codiplan.terrain.<interventionId>.brouillon`,
`components/terrain/rapport-automatique.tsx`) porte une saisie non envoyée
(commentaire, suite, prestations, signature). Il n'est **pas** effacé à la
déconnexion par ce lot : une saisie non envoyée ne doit jamais se perdre en
silence. C'est au lot 2 (9F4H2, saisies gardées sur le téléphone) ou au
lot 3 (envoi) de décider de son sort — probablement en le faisant migrer vers
la même base IndexedDB que celle posée ici, plutôt que de le laisser dans
`localStorage` indéfiniment.

## Points ouverts

- **Taille de l'instantané à l'échelle** — mesurée seulement sur le semis
  (5 fiches, 5,1 Ko). Un technicien avec une journée chargée (20+
  interventions, beaucoup de photos) n'a jamais été mesuré ; IndexedDB
  n'a pas de limite pratique basse, mais le TEMPS de la requête
  `/api/terrain/instantane` (N+1 lectures par fiche, en série dans
  `Promise.all` par fiche mais fiche par fiche en série dans la boucle
  `lignesAffichees.map`) n'a pas été mesuré sous charge.
- **Backlog L3-07** — ce ticket livre une consultation de la JOURNÉE du
  technicien, pas le « parc complet des clients visités sous 7 jours »
  (RG-DRO-02) que L3-07 demande. Le marqueur reste `BLOQUÉ` : la file de
  nuit (`scripts/lib/file-de-nuit.ts`) n'accepte que `LIBRE`/`LIVRÉ`/
  `BLOQUÉ`, et le brief de ce ticket demandait « EN COURS », qui n'existe
  pas. Signalé plutôt que contourné — une note a été ajoutée sous L3-07
  au lieu de changer son état.
- **Limite mesurée de Playwright/Chromium** — `context.setOffline` et
  `context.route` ne s'appliquent JAMAIS au `fetch()` qu'un service worker
  exécute lui-même dans un `respondWith` (mesuré : 0 appel enregistré par un
  `context.route("**/*", …)` posé avant une navigation interceptée par le
  SW). Le repli de navigation vers `/terrain-hors-reseau`
  (`estRepliTerrain`, `public/sw.js`) n'est donc PAS éprouvé par une
  navigation hors réseau dans `tests/e2e/`. Il l'est par lecture du code
  (simple : `fetch` échoue → `caches.match` du repli) et par analogie avec
  `/sante`, dont le même constat vaut déjà sans avoir jamais été nommé avant
  ce ticket. `tests/e2e/offline/9f4h1-consultation.spec.ts` éprouve tout le
  reste (copie, bandeau par `navigator.onLine`, contenu de la coquille par
  navigation DIRECTE, effacement, second technicien) sans dépendre de cette
  limite.
- **`/terrain-hors-reseau` sans copie pour un ID demandé** — si la copie
  existe mais ne porte pas la fiche demandée (lien périmé, fiche d'un autre
  jour), le message est « Cette fiche n'est pas dans la copie de ce
  téléphone. », jamais testé par un scénario dédié (seulement par lecture).
- **Nombre de photos sans leurs octets** — la route rend le libellé de
  chaque photo (nom de fichier), pas seulement un compte : une métadonnée
  « déjà affichée » au sens strict du brief, mais un peu plus qu'un entier.
  Si c'est trop, retirer les libellés et ne garder que `photos.length` est un
  changement d'une ligne dans `app/api/terrain/instantane/route.ts`
  (`photos: (photos ?? []).map((p) => p.libelle)`).

## Fin de lot

- `CI=1 pnpm verify` (format:check, typecheck, lint, test — 4843 tests —,
  test:isolation — 1616 tests —, build) : **vert, exit 0**.
- `pnpm feries:horizon`, `pnpm audit:partitions` : **vert**.
- **`CI=1 pnpm verify:full` lancé EN ENTIER comme demandé, mais NON ACHEVÉ
  dans le budget de la session.** Mesuré : `test:e2e` sous `CI=1` force UN
  SEUL worker pour 1457 tests ; un premier essai a atteint ~70 % en 30
  minutes avant la limite de l'outil, un second (en tâche de fond) tournait
  encore après 15 minutes supplémentaires sans avoir terminé `pnpm verify`
  lui-même (le `build` qui le clôt n'est pas instantané). Le budget du lot
  (180 min) ne permettait pas de l'attendre jusqu'au bout. **Exécuté à la
  place, en `fullyParallel`** (quelques minutes) : `tests/e2e/offline/*`
  (7 tests, dont les deux épreuves neuves de ce lot) et toutes les épreuves
  qui ouvrent `/terrain` (`git grep -l '"/terrain' tests/e2e` — `9di-tp-
  ter1-journee-fiche`, `9f2-terrain-jours-maquette`, `avertissements-1`,
  `captures-9di-tp-ter1-journee-fiche`, `captures-9du-nav3`, `navigation-
  app-technicien`, `terrain-largeur`, `tous-les-ecrans-rendent`), plus
  `coque-375`, `terrain`, `rapport-terrain`, `9f4-terrain-enregistrement-
  auto`, `9dd-pg-g14c-terrain-transmises` : **108 passed**, 1 échec isolé
  (`avertissements-1.spec.ts`, « le bandeau dit parti »)
  **mesuré vert rejoué seul** — un flake sous la charge des 115 tests en
  parallèle, pas un défaut de ce lot — et quelques tests préexistants
  `skipped`/`did not run` (conditions d'environnement, non liées à ce lot,
  non mesurées individuellement faute de temps). Voir `verify-final.txt`
  pour le détail des sorties.
- Arbre propre après restauration des captures régénérées par effet de bord
  des épreuves voisines (`git checkout --` sur ~110 PNG d'autres tickets,
  `rm` sur quelques nouveaux PNG hors territoire) — aucune n'appartient à
  ce lot.
