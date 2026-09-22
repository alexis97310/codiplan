# AGENCE-2 — l'écran des agences cache l'état qu'on vient d'y changer

Travail commité **sur `main` en local**, sans proposition ni branche distante
(processus du 22/09/2026) : `a566085` (l'état se voit, le lien dit où il
mène) puis `b5b773f` (la colonne des actions dans le cadre à 1280 px).

Captures prises **sur `b5b773f`** — empreinte lue par `git rev-parse HEAD` au
moment de la prise, jamais de mémoire — le **2026-09-22 à 03:16 UTC** (14:16
à Nouméa), lu à l'horloge, contre le serveur de production compilé
(`next start`) sur la base d'épreuve locale de `pnpm test:e2e` : migrations,
semis de `prisma/seed.ts`, scène de `tests/e2e/setup/scene.ts`. Aucune donnée
de la base hébergée (I9). Largeur 1280 px, fenêtre 900 px de haut.

**Le semis ne porte aucune agence inactive.** Pour la capture, **Dolbeau** a
été désactivée par la fiche de modification — le geste d'Alexis —, puis
réactivée par la même fiche une fois la prise de vue faite ; la troisième
capture en témoigne. `mesure.json` est la sortie brute du script de prise de
vue : empreinte, horodatage, la géométrie du tableau, et le texte des
cellules telles que la page les a rendues.

## Ce qui a été mesuré avant de coder

Le constat du ticket, refait sur le dépôt : `grep -nE "actif|inactif"
app/(back-office)/parametres/agences/page.tsx` ne rend aucune ligne ;
`lib/agences/depot.ts` rend `actif` dans `FicheAgence`, et la fiche de
modification l'expose. **L'écran de liste ignorait une donnée qu'il avait
sous la main.**

Sur le second défaut, le ticket disait : *« l'en-tête n'est pas déclaré dans
la liste des colonnes »*. **Ce n'est pas ce que le dépôt montre** : la
colonne `actions` est déclarée, avec `t("agence.colonne_actions")` =
« Actions », depuis AGENCE-1 (`2f7f10c`). Deux causes réelles, trouvées
l'une par la lecture, l'autre par la capture :

1. **Le lien disait « Enregistrer ».** Il reprenait `agence.action.modifier`,
   la clé du bouton d'enregistrement de la fiche. Un « Enregistrer » en bout
   de ligne, qui ne dit pas où il mène — Alexis a conclu qu'il n'y avait pas
   de lien.
2. **La colonne entière était hors du cadre à 1280 px.** Mesuré à la première
   prise de vue de ce lot (`geometrie` de `mesure.json`, version d'avant) :
   colonne latérale 272 px, gouttière 20 px de chaque côté, **966 px** pour
   le tableau — qui en exigeait **1040** (`minimum="1040px"`). Le conteneur
   défile latéralement sans rien dire, et l'en-tête « Actions » était à
   **17 %** dans le cadre. *Le DOM la portait, l'œil ne l'atteignait pas.*
   C'est exactement ce que le ticket décrit comme « pas d'intitulé ».

## La forme retenue pour dire l'état — citée, pas inventée

Le produit dit déjà « actif / inactif » dans un tableau, sur
`/parametres/equipe` (`app/(back-office)/parametres/equipe/page.tsx`,
ligne 166) : `<Badge ton="vert">` « Actif », `<Badge ton="gris">` « Inactif »
— la pastille `.b` de la maquette (`components/ui/badge.tsx`, AT-04), la
même que `/clients` pose à côté de la raison sociale (`clients/page.tsx`,
ligne 302). La pastille est posée **dans la cellule du nom**, pas en bout de
ligne : c'est là qu'on lit au premier coup d'œil, et l'état accompagne ce
qu'il qualifie. Les deux états sont dits, jamais l'un par l'absence de
l'autre. **La ligne inactive n'est pas cachée** : il faut pouvoir la
retrouver pour la réactiver, et c'est cette fiche-là qui le permet.

`agence.actif` sert deux fois — la case de la fiche et la pastille —, comme
`equipe.actif` ; `agence.inactif` et `agence.modifier` (« Modifier », le mot
de `equipe.modifier`) sont ajoutés au dictionnaire, avec leur raison.

## Les comptes

`tests/e2e/agences-etat-visible.spec.ts` — NEUF. Il rejoue le geste par la
fiche sur Dolbeau du semis et lit la liste ; Dolbeau est réactivée en fin de
scénario, par la même fiche, dans un `finally`.

| Série | Avant `a566085` | Après `a566085` | Après `b5b773f` |
|---|---|---|---|
| « la colonne des actions… et le lien dit où il mène » | **rouge** — 0 lien « Modifier » sur 3 | vert (en-tête et lien au DOM) ; **rouge** dès que le scénario exige le cadre à 1280 : en-tête à **17 %** | vert — **100 %** dans le cadre, `defilement_lateral: 0` |
| « une agence désactivée par sa fiche se distingue… et y reste » | **rouge** — Dolbeau désactivée, aucun « Inactif » | vert | vert |

Entre les deux gestes de `b5b773f`, mesuré séparément : le minimum ramené à
960 px (celui de la table des modèles de `/parametres/materiel` ; la
maquette ne demande que `min-width:920px`) porte l'en-tête de 17 % à
**94,5 %** — pas assez, parce que le formulaire du pas, champ et bouton côte
à côte, fixe une largeur incompressible. Il passe en `flex-wrap` : le bouton
descend sous le champ quand la place manque, et reste à côté à 1700 px, la
fenêtre de R2-05. 100 %.

Pourquoi `toBeInViewport` et pas `toBeVisible` : une boîte non vide hors de
l'écran est « visible » pour Playwright. C'est pour cela que rien ne
rougissait.

Pourquoi Dolbeau du semis et pas une quatrième agence :
`tests/e2e/ecrans-largeur-utile.spec.ts` compte **trois** lignes sur cet
écran, et les fichiers s'exécutent en parallèle hors CI — une agence de plus
le temps du scénario aurait fait rougir un gardien qui n'a rien à voir avec
l'état. Désactiver n'en change pas le compte, précisément parce que la liste
ne cache pas.

## `pnpm verify:full`, en entier

Deux passages complets, sur `b5b773f`.

**Premier (03:16 → 03:20 UTC)** : format, typecheck, lint, **2465**
unitaires, **1061** d'isolation, build, fériés, partitions verts ; e2e
**118 verts, 2 sautés nommés, 1 rouge** —
`porte-capacites.spec.ts › un technicien ne peut pas créer de fiche client`
: `Expected: 5, Received: 3`. Le compte de clients a **baissé** pendant le
scénario. Cause lue, pas devinée : `imports.spec.ts:103` (« le rapport
précède toute écriture… », n° 43, terminé juste avant le n° 58) applique un
import puis l'**annule**, et `lib/imports/annulation.ts:278` supprime les
clients importés — pendant que `porte-capacites` compte avant et après.
Une course entre deux fichiers joués en parallèle, hors du territoire de ce
lot ; sous CI (un seul worker) elle ne peut pas se produire.

**Second (03:21 → 03:25 UTC)** : **tout vert** — 2465 unitaires, 1061
d'isolation, build, fériés, partitions, e2e **119 verts, 2 sautés nommés**.
`tous-les-ecrans-rendent` et `ecrans-largeur-utile` (1700 px, trois lignes
dans la fenêtre) restent verts avec le tableau à 960 px et le formulaire en
`flex-wrap`.

## Les captures

- `liste-agences-active-et-inactive--1280.png` — Dolbeau **Inactif** (gris),
  Ducos et Koné **Actif** (vert), les huit colonnes dans le cadre, l'en-tête
  **ACTIONS** et trois liens « Modifier » soulignés.
- `fiche-dolbeau-desactivee--1280.png` — la fiche juste après
  l'enregistrement, case « Actif » décochée.
- `liste-agences-dolbeau-reactivee--1280.png` — la scène rendue comme elle
  a été trouvée.

## Ce que je n'ai pas fait

- **Rien dans `lib/agences/`, `app/api/**`, `prisma/**`** : le défaut était
  dans l'écran, et le dépôt n'a pas eu besoin d'être ouvert.
- **Pas de filtre « masquer les inactifs »** comme sur `/parametres/equipe` :
  le livrable est de ne pas cacher, et trois établissements n'ont pas besoin
  d'un filtre. À rouvrir si la liste s'allonge.
- **Pas de réparation de la course `imports` / `porte-capacites`** : deux
  fichiers hors du territoire. Elle est nommée ici pour que le prochain
  rouge de `porte-capacites` sous exécution parallèle soit lu comme ce
  qu'il est.
- **Le script partagé `scripts/captures.mts` n'a pas été étendu** : il
  photographie tous les écrans sous trois identités et n'a pas de geste
  « désactiver puis remettre ». La prise de vue a été faite par un scénario
  Playwright temporaire, supprimé après ; `mesure.json` en est la trace.
- **Rien n'est poussé.** Le script qui a lancé cette session rejoue
  `pnpm verify:full` et publie s'il est vert.
