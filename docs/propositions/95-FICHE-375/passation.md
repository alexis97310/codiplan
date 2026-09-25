# 95-FICHE-375 — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

`app/(back-office)/interventions/[id]/page.tsx`, trois classes seulement, aucune
logique ni route touchée :

- le `<select name="machine_id">` du mini-formulaire « Ajouter une machine »
  (colonne de gauche, hors du panneau « Actions ») porte désormais
  `w-full min-w-0` en plus de ses classes existantes ;
- les deux éléments de `Saisie` (`<select>` et `<input>`, utilisés par les
  formulaires « Planifier »/« Affecter »/« Déplacer »/« Clôturer »/
  « Suspendre »/« Annuler ») portent la même paire de classes ;
- les quatre `<dl>` de la fiche (`grid-cols-[132px_1fr]` × 2,
  `grid-cols-[160px_1fr]` × 2) passent en une seule colonne sous `sm`
  (640 px) — étiquette au-dessus de la valeur — et reprennent leur forme à
  deux colonnes à partir de `sm`, inchangée.

Pour l'exploitation : un planificateur qui ouvre une fiche depuis un
téléphone (375 px) sur une intervention portant des données longues — une
désignation de machine détaillée, une panne décrite en une phrase, une
référence de bon de commande — ne rencontre plus de défilement horizontal ;
le panneau « Actions » reste atteignable en défilant verticalement. Rien ne
change à 1280 px (bureau).

## Ce que j'ai mesuré (comptes AVANT/APRES)

Mesuré à 375 × 812, sur une fiche forgée par `tests/e2e/fiche-375.spec.ts`
(scène propre, préfixée `FICHE375`, valeurs longues sans espace — client,
site, famille, marque, référence, n° de série, panne signalée, référence
client — créée et supprimée par l'épreuve, aucune ligne de semis) :

| Scène | `document.documentElement.scrollWidth` AVANT | APRÈS |
|---|---|---|
| Intervention SANS machine rattachée (le mini-formulaire « Ajouter une machine » se rend, avec un `<select>` peuplé de la désignation longue) | **1706** | **375** |
| Intervention AVEC une machine déjà rattachée (le mini-formulaire ne se rend pas ; seuls les quatre `<dl>` portent les valeurs longues) | 375 (pas de débordement mesuré, dans les deux cas) | 375 |

La deuxième ligne est la mesure qui a écarté l'hypothèse de lecture de code
du ticket (« la cause est le `<dl>` à colonne fixe ») : avec `break-all` déjà
posé sur les deux `<dd>` avant ce ticket, aucun `<dl>` ne produisait, seul,
un `scrollWidth` supérieur à son `clientWidth` — la cause mesurée était
ailleurs. La première ligne est celle qui a identifié la vraie cause : un
`<select>` natif sans largeur posée se dimensionne sur son option la plus
large et ne s'enroule jamais ; sans `w-full min-w-0`, il pousse tout son
ancêtre (jusqu'à `<body>`) hors de l'écran. La correction du `<dl>` (une
colonne sous `sm`) reste appliquée en DÉFENSE — elle correspond à la
description du ticket et ne dépend plus, après elle, de `break-all` seul
pour absorber une valeur longue dans une colonne à largeur fixe.

À 1280 px, sur la même fiche : le panneau « Actions » reste à droite de
l'identification (`aside.top < identification.top + 50`,
`aside.left > identification.left + 400`) — la mise en page à deux colonnes
n'a pas bougé.

- `pnpm exec playwright test tests/e2e/fiche-375.spec.ts` (2 tests) : **2/2
  passés**, ~45 s.
- `pnpm test` (unitaires) : **2844 tests passés** sur 264 fichiers.
- `pnpm verify:full` en entier, en un seul appel, au premier plan (`CI=1`) :
  voir la suite de cette passation — lancé après ce commit.

## Ce que j'ai tranché, et pourquoi

- **La cause mesurée n'est pas celle que la lecture de code du ticket
  anticipait**, et j'ai corrigé la cause mesurée en priorité (le `<select>`),
  plutôt que de m'arrêter à la première hypothèse plausible. J'ai gardé la
  correction du `<dl>` en plus, parce qu'elle correspond à ce que le ticket
  demande explicitement et qu'elle rend la fiche moins dépendante d'une
  seule classe (`break-all`) pour tenir une valeur longue dans une colonne à
  largeur fixe — un `min-w-0` sur un track de grille est la même famille de
  défaut que celle qui touchait le `<select>`.
- **`Saisie` est touchée, mais ni le panneau « Actions » ni la fonction
  `Action` ne le sont** : `Saisie` est une fonction distincte, définie hors
  de `Action`, dont les classes ne changent que la largeur de ses champs.
  Aucune ligne du panneau « Actions » (la section `<aside>` de
  `PageIntervention`) ni du corps de `Action` n'a été modifiée — seules les
  classes de `Saisie` (utilisée aussi par « Ajouter une machine », qui n'est
  pas dans ce panneau) le sont. Je l'ai fait parce que c'est EXACTEMENT le
  même défaut que celui mesuré sur le `<select>` d'« Ajouter une machine » :
  un technicien au nom long, ou une longue liste d'options, produirait le
  même débordement dans « Planifier »/« Déplacer »/« Affecter ». Ne pas la
  corriger aurait laissé le même bug vivre à côté de celui que je venais de
  mesurer et corriger.
- **Scène SANS machine rattachée à l'intervention** (`ligne.machines.length
  === 0`) : c'est la condition qui fait exister le mini-formulaire
  « Ajouter une machine » (`figee || ligne.machines.length > 0 ? null :
  …`) — sans elle, l'épreuve n'aurait jamais atteint le `<select>` fautif.
- **`test.describe.configure({ mode: "serial" })`** — sans lui, `beforeAll`
  s'exécute une fois PAR OUVRIER sous `fullyParallel: true`
  (`playwright.config.ts`), et deux ouvriers qui créent la même
  `ModeleMateriel` (`(societe_id, marque, reference)` unique) au même
  instant se heurtent — mesuré directement pendant ce lot (voir « pièges »).
  Même convention que `92-CREATION-2`.
- **Valeurs longues SANS espace** (répétition d'une lettre) plutôt que des
  phrases : c'est le cas qui met `break-all` et la largeur du `<select>`
  sous tension — une phrase normale s'enroulerait de toute façon aux
  espaces, et n'aurait pas révélé le défaut mesuré.

## Ce que je n'ai PAS fait

- Je n'ai touché à aucune ligne du panneau « Actions » (la section `<aside>`
  de `PageIntervention`) ni de la fonction `Action`, comme demandé.
- Je n'ai pas ajouté `min-w-0` aux deux `<dd>` (`Ligne`/`LigneMachines`) :
  mesuré inutile — avec `break-all` déjà posé et le `<dl>` en une colonne
  sous `sm`, leur `scrollWidth` égalait déjà leur `clientWidth` dans les deux
  scènes éprouvées.
- Aucune migration, aucune ligne de semis, aucun prix, aucune route changée.
- Pas de capture d'écran : le ticket porte la mention « Captures : … (liste
  ci-dessus) », mais aucune liste ne précède cette phrase dans le texte du
  ticket — rien à quoi rattacher un nom de fichier. Je n'en ai pas inventé.

## Les pièges pour la session suivante

- **`fullyParallel: true` fait tourner `beforeAll` une fois PAR OUVRIER**
  quand Playwright répartit les tests d'un même fichier sur plusieurs
  ouvriers — mesuré directement : deux exécutions parallèles de ce fichier,
  sans `mode: "serial"`, se sont heurtées sur la contrainte unique
  `(societe_id, marque, reference)` de `ModeleMateriel`, puis l'`afterAll`
  du second ouvrier (dont le `beforeAll` avait échoué, laissant
  `interventionId` à `undefined`) a tenté un `deleteMany({ where: { id:
  undefined } })` — Prisma traite `undefined` comme un filtre absent, donc
  comme un `deleteMany({})` sur TOUTE la table `intervention`, qui a heurté
  la contrainte de clé étrangère de `segment_travail` sur des interventions
  du semis. Aucune donnée du semis n'a été perdue (la contrainte a refusé
  l'écriture), mais la scène `FICHE375` (client, site) est restée orpheline
  en base le temps que je la nettoie à la main. Tout fichier e2e qui pose
  `beforeAll`/`afterAll` avec des identifiants STATIQUES (marque, référence,
  libellé) doit porter `test.describe.configure({ mode: "serial" })` —
  `92-CREATION-2` le faisait déjà, je ne l'avais pas repris au premier jet.
- **Deux `<aside>` coexistent sur cette fiche** : la colonne de navigation
  (`#colonne-navigation`, masquée à 1280 px) et le panneau « Actions ». Un
  `page.locator("aside")` nu est ambigu — filtrer par le titre du panneau
  (`hasText: fr["intervention.actions.titre"]`).
- La désignation d'un `<select>` natif ne s'enrôle jamais dans son texte, quel
  que soit l'espace : un `<select>` sans `w-full`/`min-width` posé restera un
  point de défaillance pour TOUT écran de ce dépôt qui en affiche un dans un
  conteneur étroit — celui-ci n'était pas le seul (voir `Saisie` ci-dessus),
  et il peut ne pas être le dernier.

## Ce qui reste à faire

Rien d'identifié sur le périmètre de ce ticket (`/interventions/[id]`
seulement). Les autres écrans du dépôt n'ont pas été mesurés à 375 px dans
ce lot — un `<select>` sans largeur posée ailleurs dans le dépôt resterait à
découvrir par un audit dédié, hors du territoire de ce ticket.
