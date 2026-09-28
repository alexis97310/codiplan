# 9BI-PG-G8-EN-RETARD — passation

Ticket regroupé, trois parties, dans l'ordre : PG-C1a-EN-RETARD-PLANNING, PG-C1c-EN-RETARD-REGISTRE,
PG-C1b-EN-RETARD-TABLEAU. Les trois sont livrées, chacune avec ses commits, ses captures et sa mesure.

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

**`lib/interventions/retard.ts` (neuf)** — une fonction pure, `enRetard(ligne, aujourdhuiLocal)` :
une intervention `planifiee` ou `affectee`, dont `date_planifiee` est strictement avant le jour
civil `aujourdhuiLocal`, et qui ne porte AUCUN segment de travail, est « en retard ». Le statut
seul ne suffisait pas à le dire : une intervention REPRISE (L2-10) retombe `planifiee` même après
un premier segment de travail (`statutALaCreation`, `cycle-de-vie.ts`) — `aDesSegments` est le seul
signal qui distingue « jamais commencée » de « suspendue en cours de route ». `aujourdhuiLocal` est
un paramètre, jamais calculé dans la fonction : c'est l'appelant qui lit `maintenant(fuseauDeLAgence)`,
parce que le jour « aujourd'hui » dépend du fuseau de l'AGENCE (I7), et que `CURRENT_DATE` côté UTC
est encore la veille à Nouméa entre 0 h et 11 h locales.

**Le planning (`app/(back-office)/planning/page.tsx`)** — `listerPlanning` lit désormais le nombre de
segments de chaque ligne qu'elle affiche déjà (`_count: { segments: true }`), SANS élargir la
population de lignes retournées (le `where` n'a pas changé) : seul `LignePlanning` gagne un champ
`aDesSegments`, via une extension LOCALE du type de retour de `listerPlanning` — `listerInterventions`
et les autres consommateurs de `LignePlanning` ne sont pas touchés. La page calcule, une fois, le jour
civil « aujourd'hui » par agence (`aujourdhuiParAgence`, même repli que `fuseauDe` déjà en place) et un
closure `enRetardDe(ligne)`. `DetailsDeLaCarte` (le rendu PARTAGÉ entre les trois représentations de
carte — grille semaine, liste téléphone, grille jour) affiche la mention texte « En retard » ; les
quatre rendus qui portent une carte COLORÉE par statut (`CLASSES_BLOC`) reçoivent en plus un contour
pointillé (`outline`, jamais `border`, pour ne rien disputer à la couleur du statut), jeton
`app-rouge-bord` déjà utilisé (`en_cours`, le ton `refus`) — aucune couleur neuve.

**Le registre (`app/(back-office)/interventions/`, `lib/interventions/saisie.ts`,
`lib/interventions/depot.ts`)** — `VUES_REGISTRE` porte deux onglets de plus, `en_retard` et
`a_venir`, traduits en requête par `criteresVue` avec EXACTEMENT le critère d'`enRetard` :
`a_venir` = planifiée/affectée à partir d'aujourd'hui INCLUS ; `en_retard` y ajoute
`segments: { none: {} }`. `compterParVue` porte deux requêtes `count` de plus (elles ne se
déduisent pas du `groupBy` par statut, qui ne connaît pas la date ni les segments) — jouées dans le
même `Promise.all` que les autres. La tuile « Planifiées cette semaine » gagne le même lien fixe que
« En cours »/« En attente » (décision M1), vers `/interventions?vue=a_venir`.

**Le tableau de bord (`app/(back-office)/tableau-de-bord/page.tsx`)** — une troisième tuile
volontaire (D128) dans le bloc « Autres indicateurs », « Interventions en retard », lue depuis
`comptesRegistre.en_retard` — la MÊME requête `compterParVue` déjà interrogée pour « Dossiers
bloqués », jamais une troisième lecture du critère. Lien fixe vers `/interventions?vue=en_retard`.
À 0, la tuile affiche « 0 ».

**Ce que ça change pour l'exploitation** : les 6 interventions constatées le 27/09 (« Planifiée » du
23 et du 25/09, jamais démarrées) seraient désormais visibles à trois endroits — le planning (carte
marquée), le registre (onglet dédié, comptable), le tableau de bord (une tuile qui somme le
problème). Aucune n'est plus « invisible au changement de semaine ».

## Ce que j'ai mesuré (comptes AVANT/APRES)

Chaque partie a sa paire de captures forgées par un spec e2e dédié (préfixe propre, jamais une
fixture `SCENE.*` partagée), rejouée sur le commit d'avant la partie puis sur le code livré :

- `docs/propositions/PG-C1a-EN-RETARD-PLANNING/captures/` — planning, vue jour : AVANT, la ligne
  « Journée — heure non fixée » ne porte aucune mention ; APRÈS, « En retard » en texte rouge sous
  la durée. (Le contour pointillé n'est pas visible sur CETTE capture précise : la scène forgée
  n'a pas de créneau posé, donc pas de carte colorée par `CLASSES_BLOC` — la mention texte, elle,
  est partagée par les cinq emplacements de `DetailsDeLaCarte`, donc visible ici aussi.)
- `docs/propositions/PG-C1c-EN-RETARD-REGISTRE/captures/` — `/interventions?vue=en_retard` :
  AVANT, vue inconnue du schéma d'alors, retombe à « aucune vue » (36 fiches, aucun onglet actif,
  six onglets seulement) ; APRÈS, huit onglets, « En retard (1) » actif et exact, « À venir (27) »,
  et le lien sous « Planifiées cette semaine ».
- `docs/propositions/PG-C1b-EN-RETARD-TABLEAU/captures/` — `/tableau-de-bord` : AVANT, deux tuiles
  dans « Autres indicateurs » ; APRÈS, une troisième, « Interventions en retard », « 1 ».

Les trois paires sont à 1280 et 375 px.

**Mesuré aussi (isolation, sur la vraie table)** : l'égalité entre la fonction pure et la requête,
sur trois jeux distincts créés par les tests (préfixes `PGC1C-` et `PGC1B-`, `tests/isolation/
ecran-intervention.test.ts` et `tests/isolation/tableau-de-bord-en-retard.test.ts`) — y compris le
cas qui les distinguerait en silence : une intervention `planifiee`, datée d'hier, avec un segment
de travail déjà posé, N'EST PAS en retard (reprise en cours), et le scénario le vérifie par une
requête ET par la fonction pure sur les mêmes données.

**Contrôle de fin de session** (les trois commandes exactes, rejouées après les neuf commits de
code) :

1. `CI=1 pnpm verify` — vert : format:check, typecheck, lint, `pnpm test` (300 fichiers, 3113
   tests), `pnpm test:isolation` (133 fichiers, 1272 tests), `next build` (70 pages, compilé sans
   erreur).
2. `pnpm feries:horizon && pnpm audit:partitions` — vert : 2 territoires contrôlés (horizon ≥ 12
   mois) ; partitions couvertes jusqu'à 2027-09, partition par défaut vide (préventif et détectif
   verts).
3. `CI=1 pnpm exec playwright test` sur `tous-les-ecrans-rendent`, `ecrans-largeur-utile`,
   `coque-375`, l'ensemble des specs `planning-*` (dix fichiers, le composant `DetailsDeLaCarte`
   étant partagé par tous), les trois specs de capture neufs de ce lot, et les specs existants du
   registre et du tableau de bord (`registre-1/2/3/5`, `registre-kpi-liens`,
   `registre-filtre-agence-inactive`, `interventions-2`, `captures-aa4-registre-filtre`,
   `tableau-de-bord-liens-tuiles`, `tableau-non-calcule`, `defilement-tableau`) — **120 épreuves,
   117 passées, 3 ignorées (`skip` préexistants, sans rapport avec ce lot), 0 échec.**

## Ce que j'ai tranché et pourquoi

- **`aDesSegments` porté par `listerPlanning` seul, jamais par `CHAMPS_LIGNE`** — `CHAMPS_LIGNE` est
  partagé par `listerInterventions`, `lireIntervention`, etc. ; y ajouter le compte de segments
  aurait élargi la lecture de TOUS ces appelants pour un besoin qui n'appartient qu'au planning. Le
  type de retour de `listerPlanning` est étendu localement (`LignePlanning & { aDesSegments:
  boolean }`), ce qui reste assignable partout où `LignePlanning` est attendu (`/terrain` compris).
- **Le contour est un `outline`, jamais un second `border`** — les cartes du planning portent déjà
  `border-l-[3px]` coloré par statut (`CLASSES_BLOC`). Une seconde classe `border-*` sur la même
  carte aurait fait dépendre l'affichage de l'ORDRE DE GÉNÉRATION du CSS par Tailwind, pas de
  l'ordre du JSX — fragile et invérifiable à l'œil. `outline` est une couche indépendante.
- **« À venir » inclut aujourd'hui** (`date_planifiee >= aujourd'hui`, jamais `>`) — lecture
  littérale du ticket (« planifiee ou affectee, date >= aujourd'hui local »). Ça fait chevaucher
  « À venir » et « Aujourd'hui » (une même fiche compte dans les deux onglets), assumé et mesuré
  dans le scénario d'isolation plutôt que découvert en silence.
- **`compterParVue` reste à quatre requêtes agrégées, jamais dix** — `a_venir`/`en_retard` croisent
  deux statuts et une date (`en_retard` en plus une absence de segment) : ni l'un ni l'autre ne se
  déduit du `groupBy` par statut existant. Deux `count` de plus, dans le même `Promise.all`.
- **Le tableau de bord ne relit PAS `compterParVue`** — `comptesRegistre` était déjà dans le
  `Promise.all` existant (pour « Dossiers bloqués ») ; `.en_retard` s'y trouve désormais aussi.
  Aucune requête ajoutée pour cette troisième tuile.
- **Test d'égalité en isolation, pas en unitaire pur, pour le critère de requête** — `criteresVue`
  est privée (R3-12) : sa traduction en SQL ne s'éprouve que là où elle est atteinte, sous la
  vraie table, à travers les fonctions exportées (`listerInterventions`, `compterParVue`) — même
  discipline que le reste du fichier `ecran-intervention.test.ts`.

## Ce que je n'ai PAS fait

- Je n'ai touché ni `depot/` ni `11-FILE.sh` (interdit).
- Aucune migration, aucune ligne de semis, aucun prix — « en retard » reste une LECTURE, jamais
  stockée.
- Je n'ai pas ajouté le contour pointillé aux lignes texte SANS carte colorée (« Journée — heure
  non fixée », « Non placées sur la grille ») : elles n'ont pas de `border-l` de statut à côté
  duquel poser un contour, et la mention texte suffit à les distinguer.
- Je n'ai pas retouché `criteresSansDureeAVenir` ni les autres critères déjà posés — territoire
  strictement celui du ticket.
- Je n'ai pas élargi le contour pointillé aux captures : la scène de `captures-pg-c1a-en-retard-
  planning.spec.ts` pose une intervention SANS créneau (rendue dans la ligne « sans heure », pas de
  carte colorée) — voir la note dans la section « Ce que j'ai mesuré » ci-dessus. Une capture d'une
  carte colorée EN RETARD (grille semaine ou jour, avec créneau) n'a pas été prise séparément ; le
  code est le même (`CONTOUR_EN_RETARD` appliqué aux quatre sites colorés), mais ce n'est PAS
  vérifié par une capture — seulement par la lecture du code et les 117 épreuves e2e existantes qui
  rendent ces écrans sans rougir.

## Les pièges pour la session suivante

- **`listerPlanning` est appelé par TROIS écrans** (`/planning`, `/terrain`, `/tableau-de-bord`) —
  n'importe quelle extension future de son type de retour doit vérifier les trois, pas seulement le
  planning. `aDesSegments` a été ajoutée sans casser les deux autres (vérifié par `pnpm typecheck`),
  mais ni `/terrain` ni `/tableau-de-bord` ne l'utilisent aujourd'hui.
- **`DetailsDeLaCarte` a CINQ points d'appel** dans `planning/page.tsx` (grille semaine, liste
  semaine, ligne « sans heure » du jour, cellule de l'axe du jour, ligne « sans heure » de l'état
  vide) — un sixième ajouté sans threader `enRetardDe` romprait silencieusement la mention pour ce
  seul rendu (le typecheck le refuserait, `enRetardDe` étant un prop requis).
- **`VUES_REGISTRE` est maintenant un tableau de HUIT** — tout gardien ou test qui itère dessus
  (`registre-vues.test.ts`, les gardiens de traduction) doit rester générique ; j'ai vérifié qu'ils
  le sont déjà (boucle `for (const vue of VUES_REGISTRE)`), mais une future vue doit garder cette
  discipline.
- **Le contour pointillé n'a pas de capture dédiée** (voir ci-dessus) — la session suivante qui
  touche à nouveau le planning devrait envisager d'en prendre une (grille semaine ou jour, avec
  créneau posé et statut `planifiee`/`affectee`).
- **`compterParVue` fait maintenant QUATRE requêtes**, pas deux — si une session future y ajoute
  encore une vue calculée, il faudra probablement reconsidérer le nombre de requêtes plutôt que de
  continuer à en ajouter une par vue.

## Ce qui reste à faire

- Aucun point du ticket regroupé n'est resté ouvert ; les trois parties sont livrées, testées et
  capturées (à la réserve près, notée ci-dessus, du contour pointillé jamais capturé isolément).
- Rien n'a été laissé en `BLOQUÉ` ni en deux rouges consécutifs.
