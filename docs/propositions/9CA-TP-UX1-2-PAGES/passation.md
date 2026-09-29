# 9CA-TP-UX1-2-PAGES — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

**Le plancher de 12 px (D138) sur les 197 classes du territoire, 40 fichiers.**
Toutes les classes `text-[9px]`, `text-[9.5px]`, `text-[10px]`, `text-[10.5px]`,
`text-[11px]` et `text-[11.5px]` des pages d'`app/` touchées par le plan TP-UX
(UX1-a2, UX1-a3), plus deux composants métier rattachés au planning
(`components/planning/fenetre-pose.tsx`, `components/planning/tiroir.tsx`),
passent au jeton `text-12` posé par 9BZ-TP-UX1-1-ECHELLE
(`app/globals.css`). Cinq groupes de commit :

- **G1** — planning, fenêtre de pose, tiroir (62 classes / 3 fichiers).
- **G2** — interventions, demandes, absences, tableau de bord, arrivée,
  contacts (38 classes / 10 fichiers).
- **G3** — clients, sites, parc, VGP (40 classes / 10 fichiers).
- **G4** — paramètres et imports (50 classes / 14 fichiers).
- **G5** — terrain et portail (7 classes / 3 fichiers).

Seule la TAILLE a changé : graisses, capitales, interlettrage, interligne,
couleurs et marges sont inchangés, y compris `leading-[8px]` des libellés de
filtre du parc (`app/(back-office)/parc/page.tsx:321,351,372,393`), laissé
tel quel comme demandé.

**Pour l'exploitation** : le texte le plus petit du back-office et du
terrain (pastilles de statut, en-têtes, libellés de filtre, surtitres,
légendes, explications) redevient lisible sur un petit écran — la même
question que TP-UX1-1 avait tranchée pour `components/ui/` et la navigation,
étendue ici à toutes les pages qui les utilisent.

**Quatorze écrans ajoutés à `scripts/captures.mts`** (D138, TP-UX1-2) :
`demandes`, `demande-detail`, `intervention-bon`, `parc-detail`,
`site-detail`, `site-creation`, `parametres-equipe`, `parametres-materiel`,
`parametres-habilitations`, `parametres-societe`, `agence-detail`,
`agence-creation`, `agence-modification`, `forfait-detail` — avec leurs
fonctions de découverte de lien (`premierLienDeSite`, `premierLienDeMachine`,
`premierLienDeDemande`, `premierLienDeBon`, `premierLienDeForfait`,
`premierLienDeCalendrierAgence`, `premierLienDeModificationAgence`), pour que
chaque page touchée par ce ticket se voie AVANT et APRÈS. Rien d'autre n'a
changé dans ce fichier.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

**Grep statique** (`text-\[(9|1[01])(\.[0-9])?px\]`), territoire (40 fichiers
listés ci-dessus) : **197 classes → 0**. Global (`app` + `components`) :
215 classes / 53 fichiers (mesure du 29/09) → 202 / 42 après 9BZ → **5
classes / 2 fichiers** après ce ticket — les 5 restantes sont
`components/planning/pose.tsx` (3) et `components/interventions/trouver-creneau.tsx`
(2), territoire de 9BW-AVERT-POSE-FICHE, explicitement hors de ce ticket.

**Mesure du script**, AVANT (commit `03ca542`) → APRÈS (commit `4b28269`),
sur les 35 écrans capturés (21 déjà connus + 14 ajoutés), à chacune des
trois largeurs (`docs/propositions/9CA-TP-UX1-2-PAGES/captures/README.md`) :

| Largeur | Textes < 12 px | Cibles sous le seuil | Débordement (somme) | Erreurs |
|---|---|---|---|---|
| 1280 px | 470 → **2** | 0 → 0 | 0 → 0 | 0 → 0 |
| 1024 px | 470 → **2** | 0 → 0 | 74 px → 74 px | 0 → 0 |
| 375 px | 477 → **2** | 368 → 367 | 52 px → 52 px | 0 → 0 |

Les 2 occurrences restantes à chaque largeur viennent des écrans `planning`
et `planning-jour` (`components/planning/pose.tsx`, territoire de 9BW).
Cibles, débordement et erreurs ne bougent pas (à un cas près, une pastille
franchissant le seuil de 32×32 px à 375 px, effet de bord positif) : ce
ticket ne touche aucune mise en page.

**Les cinq attentes e2e neuves** (`tests/e2e/plancher-12-pages.spec.ts`), et
le gardien statique (`tests/unit/ui/plancher-12-pages.test.ts`) :

| Groupe | Élément visé | Valeur sur `03ca542` (rouge, mesurée à la volée par `scripts/captures.mts`) | Valeur après |
|---|---|---|---|
| G1 | `/planning`, cellule d'en-tête « Technicien » (vue Semaine, 1280 px) | 10,5 px | **12 px** |
| G2 | `/tableau-de-bord`, `[data-bloc="kpi-occupation"] [data-non-calcule]` | 11 px | **12 px** |
| G3 | `/parc`, `label[for="statut"]` | 9 px | **12 px** |
| G4 | `/parametres/agences`, paragraphe `parametres.exception_explication` | 11,5 px | **12 px** |
| G5 | `/terrain`, pastille de statut (dernier `span` du conteneur du badge) | 11 px | **12 px** |

La preuve du rouge n'a pas été rejouée sur un worktree séparé pour ces cinq
attentes précises (contrairement aux états tiroir/fenêtre de pose, voir plus
bas) : chaque valeur « avant » ci-dessus est celle mesurée par
`scripts/captures.mts` lui-même sur les captures AVANT (colonne « Textes <
12 px » du README par écran), qui cite l'élément et sa taille exacte.

**Les deux états rejoués** (`tests/e2e/captures-pg-c5-tiroir.spec.ts`,
`tests/e2e/captures-pg-b2-fenetre-pose.spec.ts`) : AVANT capturé sur un
`git worktree` posé sur `03ca542` (recette documentée en tête de ces deux
fichiers), APRÈS sur `main`. Les deux ne rendent que 1280 et 375 px, jamais
1024 — c'est la forme des specs elles-mêmes, non modifiée par ce ticket.

## Ce que j'ai tranché et pourquoi

- **Correspondance appliquée** : toutes les classes sous 12 px du territoire
  montent à 12 px via le jeton `text-12`, jamais un littéral `text-[12px]` —
  même convention que 9BZ, pour qu'un seul mot désigne 12 px dans le dépôt.
- **Le commentaire de `app/(back-office)/tableau-de-bord/page.tsx:78-83`**
  (qui citait `text-[11px]`) est réécrit pour citer `text-12` et nommer D138 /
  TP-UX1-2, sans changer son sens (la taille et la graisse du texte de détail
  de la tuile).
- **`leading-[8px]` des libellés de filtre du parc, INCHANGÉ** — seule la
  taille est passée à 12 px. `tests/e2e/parc-tri.spec.ts` (constat 30, 480 px
  visibles à 1280×800) reste vert sans modification : pas de chevauchement
  visible sur les captures, aucune exception nécessaire.
- **Locators e2e** : jamais par une classe de taille, toujours par un
  attribut `data-` existant, un rôle/libellé (`getByRole("cell", …)`,
  `getByText(...)`), ou — à défaut, pour la pastille de statut du terrain, qui
  ne porte ni attribut ni libellé stable (le statut dépend du semis) — une
  position structurelle documentée dans le test lui-même.
- **Deux bases locales jetables distinctes** pour AVANT et APRÈS
  (`codiplan_captures_9ca`, recréée entre les deux prises) : le second
  facteur d'un compte de démonstration activé pendant une prise n'est pas
  rejouable sans son secret (piège déjà nommé par 9BZ) — repartir d'une base
  fraîche est plus sûr que de le retenir.
- **Fonctions de découverte de lien groupées** en une seule section du
  fichier (`// ── ÉCRANS DÉCOUVERTS AJOUTÉS PAR 9CA-TP-UX1-2-PAGES ──`),
  chacune une fonction nommée courte, dans le style déjà établi par
  `premierLienDeClient` — pas de généralisation en une fonction paramétrée,
  pour rester dans la forme du fichier plutôt que d'y introduire un nouveau
  motif.

## Ce que je n'ai PAS fait

- **`components/planning/pose.tsx` (3 classes) et
  `components/interventions/trouver-creneau.tsx` (2 classes)** — territoire de
  9BW-AVERT-POSE-FICHE : la preuve du plan « grep : zéro sur tout le dépôt »
  (`lots-ux.md:72`) n'est donc PAS atteinte par ce ticket seul (5 occurrences
  restantes dans le dépôt, mesurées sur `main` à ce commit).
- **Les chiffres tabulaires** des montants et heures dans `app/` (§3.2 :230) —
  ce ticket ne change que des tailles de texte, rien d'autre. À replanifier.
- Aucune icône, aucune tuile cliquable, aucun chevron (D139, D140).
- Aucune donnée, aucun calcul, aucune règle de gestion, aucune migration.
- Aucun jeton nouveau dans `app/globals.css` : seuls ceux posés par 9BZ sont
  employés.

## Les pièges pour la session suivante

- **Un serveur manuel qui occupe le port du webServer Playwright (3100) se
  fait RÉUTILISER en silence par `reuseExistingServer: !CI`**, avec la
  MAUVAISE base : `pnpm exec playwright test` a échoué une fois pendant ce
  ticket avec `auth.refus` parce qu'un serveur de capture, lancé à la main
  sur 3100 pour la prise APRÈS, était resté vivant. Toujours vérifier
  `ss -ltnp | grep 3100` (ou tuer le PID directement — **jamais
  `pkill -f "next start"`**, qui tue aussi le shell appelant, voir
  [[git-identite-poste-alexis]]) avant de lancer une suite e2e.
- **`pkill -f` avec un motif qui se retrouve dans sa propre ligne de
  commande tue le shell qui l'invoque** — confirmé une fois de plus pendant
  ce ticket. Toujours cibler un PID lu par `ss`/`ps`, jamais un motif large.
- **Les captures d'état (tiroir, fenêtre de pose) exigent un `git worktree`
  pour la version AVANT**, puisque le code de ce ticket est déjà committé sur
  `main` au moment de photographier l'APRÈS — la recette est documentée en
  tête des deux fichiers de spec (`captures-pg-c5-tiroir.spec.ts`,
  `captures-pg-b2-fenetre-pose.spec.ts`), et `node_modules` doit être copié
  dans le worktree (pas de réinstallation complète nécessaire, le store pnpm
  est partagé).
- **`text-[12.5px]` reste hors échelle** (§3.2 ne le prévoit pas) : 192
  occurrences dans le territoire de ce ticket, inchangées — décision
  reportée à Alexis (voir 9BZ).

## Ce qui reste à faire

- **`components/planning/pose.tsx` (3) et `components/interventions/trouver-creneau.tsx`
  (2)** — territoire de 9BW, à traiter par un ticket qui touche ce
  territoire, pour atteindre enfin le « grep : zéro » du plan.
- **Chiffres tabulaires** des montants et heures dans `app/parametres/forfaits`,
  `app/parametres/taux-horaire`, `app/(mobile)/terrain` — non faits ici.
- **VALEURS À FIXER PAR ALEXIS** (rien n'a été tranché, reporté depuis 9BZ) :
  - `text-[12.5px]` — 12 ou 13 px ? 192 occurrences dans le territoire de ce
    ticket (210 dans le dépôt entier).
  - Tailles hors échelle au-dessus de 12 px : 27 px (portail, valeur de
    tuile), 26 px (`parc/[id]`, `clients`), 22 px (`parc/[id]`, `terrain`),
    20 px (`terrain/[id]`), 19 px (`portail`).
  - Graisse du « plus petit texte » : §3.2 demande 700 à 850 ; les textes
    passés à 12 px par ce ticket gardent leur graisse d'origine (souvent 400
    ou 600).
  - Interligne des libellés de filtre du parc (`leading-[8px]`) : gardé tel
    quel — chevauchement visible ou non sur les captures, effet sur
    `parc-tri.spec.ts` (mesuré vert, sans changement).
  - Terrain : §3.2 demande 15 à 16 px pour ce territoire ; ce ticket ne monte
    que jusqu'au plancher de 12 px (D138), pas plus haut.
