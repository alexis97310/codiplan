# MESURE-1 — passation

Travail commité **sur `main` en local**, non poussé : `18a5fac` (l'application
d'un lot d'import mesure sa durée réelle) puis `fe59d01` (formatage prettier).
Captures prises le 2026-09-23 contre le serveur de production compilé (`next
build && next start`) sur la base d'épreuve locale de `pnpm test:e2e`
(migrations + semis de `prisma/seed.ts`), avec le classeur d'épreuve de
`scripts/lib/classeur-epreuve.ts` (deux créations, un rejet — aucune donnée
réelle, I9). Empreintes lues par `git rev-parse HEAD` au moment de chaque
prise : `09c2545` pour l'AVANT (le point de départ du lot, dernier commit de
CLUSTER-1) et `fe59d01` pour l'APRÈS.

## Ce que j'ai changé

Le seul chemin du produit qui porte un budget de temps
(`lib/imports/delais.ts`, `allersRetoursApplication`, `DUREE_MAXIMALE_MS`) ne
mesurait jamais le temps qu'il prenait réellement — le budget de 746 lignes
n'avait jamais été confronté à une application réelle, seulement à un banc
local (`scripts/mesure-delais-import.mts`, IMPORT-2) et à zéro instrumentation
en production (constat T-10 de la revue du 22/09).

- **`prisma/schema.prisma`** : `ImportLot.duree_application_ms` (`Int?`),
  avec son docblock — jamais `applique_le - controle_le`.
- **Une migration**, `20260923120000_duree_application_import_mesure_1` :
  `ALTER TABLE ADD COLUMN` (nullable) + `CHECK (duree_application_ms IS NULL
  OR duree_application_ms > 0)` — la contrainte « jamais zéro » posée en
  base, pas seulement dans le code applicatif. Aucune politique RLS
  nouvelle : `import_lot` est déjà de forme « interne » (D100), et RLS
  travaille ligne à ligne, jamais colonne à colonne — ajouter une colonne à
  une table déjà cloisonnée ne change aucune politique.
- **`lib/imports/application.ts`** (`appliquerLesLignes`) : chronomètre
  `process.hrtime.bigint()` posé au tout début du travail dans la
  transaction (avant la première lecture du lot — jamais avant
  `avecContexteApplicatif`, dont l'attente de connexion n'appartient pas à la
  transaction), lu juste avant l'écriture finale, et écrit dans la MÊME
  `tx.importLot.update` que `statut`, `applique_le`, `lignes_inchangees`.
  `Math.max(1, Math.round(...))` : jamais zéro, même pour un lot d'une seule
  ligne.
- **`lib/imports/depot.ts`** : `LotEnListe.dureeApplicationMs`, lu depuis la
  colonne dans `enListe` — ni `listerLesLots` ni `lireLeLot` n'avaient de
  `select` à élargir, les deux lisent déjà le lot entier.
- **`lib/i18n/fr.ts`** : `imports.duree_application_titre` et
  `imports.duree_application_absente`.
- **`app/(back-office)/imports/presentation.ts`** :
  `dureeApplicationLisible(ms: number | null): string` — l'absence NOMMÉE
  (jamais un zéro), le nombre brut sinon (voir « ce que j'ai tranché »).
- **`app/(back-office)/imports/[id]/page.tsx`** : une ligne sous les
  coordonnées du lot, `data-duree-application`.
- **`lib/imports/delais.ts`** : un renvoi ajouté au docblock (aucune
  constante touchée) — la mesure réelle existe désormais, et où la lire.

Pour l'exploitation : Alexis a aujourd'hui quatre sites en attente d'import.
Chaque lot qu'il applique désormais porte sa durée réelle, visible sur son
écran, et le plafond de 746 lignes cesse d'être une croyance jamais
confrontée à une vraie application — la prochaine fois qu'un lot approche du
refus, la durée des lots précédents dira de combien on s'en approche.

## Ce que j'ai mesuré

**AVANT tout code (le constat du ticket, refait sur le dépôt)** :
`grep -n "duree_application\|process.hrtime" lib/imports/application.ts
prisma/schema.prisma` ne rendait rien sur `09c2545`. Relu `ImportLot`
(`prisma/schema.prisma`) avant d'ajouter quoi que ce soit : il portait déjà
`controle_le`, `applique_le`, `annule_le`, `lignes_inchangees` — mais aucune
durée, et `applique_le - controle_le` couvre le temps de lecture humaine du
rapport, jamais celui de la transaction (piège nommé par le ticket, vérifié
en le fabriquant dans l'épreuve d'isolation ci-dessous plutôt qu'en le
croyant sur parole).

**Captures AVANT/APRÈS**, un même lot (deux créations, un rejet), deux états :

| Écran | AVANT (`09c2545`) | APRÈS (`fe59d01`) |
|---|---|---|
| `/imports/[id]`, lot `controle` | aucune ligne de durée | « Durée de l'application — non mesurée — ce lot n'a pas encore été appliqué » |
| `/imports/[id]`, lot `applique` | aucune ligne de durée | « Durée de l'application — 5 ms » |

Fichiers : `lot-controle--avant--1280.png` / `lot-controle--apres--1280.png` /
`lot-applique--avant--1280.png` / `lot-applique--apres--1280.png`, dans ce
dossier, 1280×900.

**Épreuves écrites, vérifiées rouges pour la raison nommée avant le
correctif** — `duree_application_ms` n'existait pas avant ce lot, donc toute
lecture de cette colonne échouait à la requête SQL sur le code d'avant :

- `tests/isolation/duree-application-import.test.ts` — DEUX épreuves contre
  la vraie base, sous le rôle applicatif restreint : (1) un lot appliqué
  porte une durée strictement positive et distincte de l'écart artificiel de
  cinq heures fabriqué entre `controle_le` et `applique_le` (le piège du
  ticket, rendu mesurable plutôt que supposé) ; (2) un lot resté `controle`
  ne porte AUCUNE durée — `toBeNull()`, jamais `toBe(0)`.
- `tests/unit/imports/duree-application.test.ts` — `dureeApplicationLisible`
  sur les deux cas (durée, absence), et une lecture du SOURCE de l'écran
  vérifiant qu'il appelle réellement cette fonction sur `lot.dureeApplicationMs`
  et cite la clé du dictionnaire — même méthode que
  `tests/unit/imports/titre-nouvel-import.test.ts`.

5 tests neufs, dans 2 fichiers neufs.

**`pnpm verify` complet** : format, typecheck, lint, **2599 tests unitaires**
(239 fichiers), **1140 tests d'isolation** (111 fichiers), build — tout vert.

**`pnpm verify:full` complet** : les deux précédents, plus fériés,
partitions, et **e2e 155 verts, 3 sautés** (nommés, `/demandes/[id]`,
`/imports/[id]`, `/parametres/forfaits/[id]` — pré-existants, sans rapport
avec ce lot : des routes dynamiques que `tous-les-ecrans-rendent.spec.ts`
saute faute de ligne fixe à viser, déjà documenté par AGENCE-CODE-1).

## Ce que j'ai tranché, et pourquoi

- **Le chronomètre part au tout début de la transaction, jamais avant
  `avecContexteApplicatif`.** L'attente d'une connexion
  (`ATTENTE_CONNEXION_MS`) n'appartient pas au travail de la transaction ; la
  compter aurait mêlé une latence d'infrastructure à une durée de travail.
- **Le chronomètre s'arrête juste avant l'écriture qui porte la mesure,
  jamais après.** Une mesure ne peut pas inclure l'instant où elle s'écrit
  elle-même — c'est une limite inévitable, écrite dans le docblock du code
  plutôt que cachée.
- **`Math.max(1, ...)` plutôt qu'un `Math.round` nu.** La contrainte CHECK
  interdit zéro ; un lot d'une seule ligne créée pourrait, en théorie,
  arrondir à zéro milliseconde sur une machine très rapide. `Math.max(1, …)`
  ferme ce cas sans jamais mentir dans l'autre sens (une vraie transaction de
  plusieurs secondes n'est jamais rabattue à 1).
- **Aucun `.toLocaleString()` ni séparateur de milliers.** Le premier essai
  utilisait `toLocaleString("fr-FR")` pour la lisibilité ; le gardien I3
  (`tests/unit/money/sans-decimales-en-dur.test.ts`) l'a refusé — sa règle
  vise TOUT formatage par la locale, pas seulement les montants, parce que
  `Intl`/`toLocaleString` tirent leurs décimales d'ICU et non du référentiel
  `devise`. Le chiffre brut (`342 ms`) suffit à une durée et évite la
  question entièrement, plutôt que de contourner le gardien.
- **Aucune constante de `lib/imports/delais.ts` ne bouge.** Le ticket
  l'interdisait explicitement, pour la raison qu'il nomme : relever un
  plafond sur la foi d'une première mesure est la faute qui a déjà coûté un
  déploiement raté (le premier `maxDuration` de ce même fichier). Le renvoi
  ajouté au docblock dit où lire la mesure réelle, sans y substituer un
  nombre.
- **Pas de tentative de généraliser l'instrumentation** (T-10 en parle pour
  tout le produit). Ce lot pose la première pierre sur le seul chemin qui
  porte déjà un budget ET un incident de production réel ; généraliser est
  un arbitrage d'Alexis, écrit ci-dessous plutôt que livré.

## Ce que je n'ai pas fait

- **Aucune constante de `lib/imports/delais.ts`, `lib/vgp/**`,
  `lib/calendar/**`, `lib/tarification/**` ni `.github/workflows/**`
  touchée** — hors territoire, et interdit explicitement pour le premier.
- **Aucune écriture contre une base hébergée** — toutes les mesures et
  captures viennent de la base jetable locale de `pnpm test:e2e` (I9).
- **Aucune modification de `scripts/lib/politiques-rls.ts`** : la forme
  « interne » de `import_lot` ne change pas avec l'ajout d'une colonne, et le
  territoire ne l'exigeait que « si la forme l'exige » — mesuré : elle ne
  l'exigeait pas.
- **Pas d'instrumentation d'un second chemin** (ni la file d'import
  d'historique ni celle de VGP au-delà de ce que l'enveloppe commune
  `appliquerLesLignes` leur donne déjà gratuitement — elles la traversent
  toutes, donc elles mesurent aussi leur durée sans code supplémentaire).

## Les pièges pour la session suivante

- **Les six fonctions `appliquerLeLotDe*` partagent TOUTES la même
  enveloppe `appliquerLesLignes`** : la mesure posée à cet endroit couvre
  déjà clients, sites, modèles, prestations, familles, équipements,
  historique et VGP — pas seulement les clients. Un futur ticket qui
  voudrait « ajouter » la mesure à un autre type d'import referait un
  travail déjà fait ; vérifier d'abord que le type visé passe bien par
  `appliquerLesLignes` (les huit le font, `grep -n "appliquerLesLignes("
  lib/imports/application.ts`).
- **La durée mesurée ici est un aller unique, jamais un historique.** Un
  second lot appliqué écrase la question « quelle durée pour QUEL lot » —
  non, en fait chaque lot a sa propre ligne, donc son propre
  `duree_application_ms` : aucun écrasement. Ce qui N'EXISTE PAS, c'est une
  vue agrégée (moyenne, maximum) sur plusieurs lots — le journal des
  chargements (`/imports`, la liste) ne montre pas la colonne aujourd'hui,
  seul le rapport d'un lot (`/imports/[id]`) la montre. L'ajouter à la liste
  serait un ticket à part, pas un oubli de celui-ci : le territoire ne
  demandait que l'écran, pas une colonne du tableau (voir `presentation.ts`,
  qui suit le tableau régi par la maquette D95, une des trois phrases déjà
  réécrites par des décisions de rang 1 — une colonne de plus ne s'y ajoute
  pas sans en peser l'autorité).
- **Le format AVANT/APRÈS de capture** : `tests/e2e/_captures-mesure-1.spec.ts`,
  jamais commité, supprimé après usage — même geste que AGENCE-CODE-1 et
  CLUSTER-1. Pour refaire ou étendre : `CAPTURE_SUFFIXE=avant|apres pnpm
  exec playwright test tests/e2e/_captures-mesure-1.spec.ts`, en tuant tout
  `next-server` survivant entre les deux prises (`ps aux | grep next-server`
  — jamais `pkill -f next-server` en une seule commande shell qui contient
  elle-même la chaîne « next-server », sous peine de tuer le shell appelant,
  voir la mémoire de session `git-identite-poste-alexis`), et en régénérant
  le client Prisma (`pnpm exec prisma generate`) après CHAQUE `git checkout`
  puisque le schéma diffère entre AVANT et APRÈS.
- **`allersRetoursApplication` reste un budget théorique, jamais recalé sur
  cette mesure.** Si un futur ticket veut confronter les deux, il devra
  d'abord accumuler plusieurs mesures réelles sur des lots de tailles
  variées — une seule mesure de 5 ms sur deux lignes ne dit rien sur le
  comportement à 700 lignes, et l'extrapoler serait retomber dans la faute
  que ce ticket ferme.

## Ce qui reste à faire

- **Rien d'ouvert par CE ticket** : la mesure existe, est écrite une seule
  fois au bon endroit, s'affiche, et le budget renvoie vers elle sans être
  modifié.
- **T-10 (instrumentation générale) reste un ticket à part**, pour Alexis à
  arbitrer : ce lot n'en couvre qu'un chemin, délibérément (voir « ce que
  j'ai tranché »).
- **La colonne « Durée » sur le journal des chargements** (`/imports`, la
  liste) n'existe pas — voir le premier piège ci-dessus. Un futur ticket
  pourrait l'ajouter si Alexis veut comparer plusieurs lots d'un coup d'œil,
  sans ouvrir chacun.
