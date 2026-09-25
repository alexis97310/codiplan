# 88-REGISTRE-5 — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

Trois défauts du registre `/interventions`, mesurés par l'audit
d'ergonomie du 25/09/2026 (constats 16, 17, 18) :

1. **Les puces de filtres actifs** (`app/(back-office)/interventions/
   presentation.ts`, `puceFiltresActifs`). Une recherche, un filtre
   agence/type/statut/technicien, une période, ou le lien « sans durée
   prévue » de la tuile du tableau de bord posent désormais une puce
   au-dessus du tableau — « Recherche : … », « Agence : … », « Période : …
   au … », etc. — chacune avec un « ✕ » qui retire CE critère et lui SEUL
   (les autres survivent, `page` retombe à 1), plus un lien « Tout
   effacer » qui garde l'onglet actif (`vue`) et retire tout le reste.
   Aucune puce ne s'affiche quand rien n'est filtré. `du`/`au` partagent
   une seule puce (une période à moitié retirée n'aurait aucun sens).
2. **Le détail des trois KPI**. Quand au moins un filtre est actif, les
   trois cartes du bandeau (`Planifiées cette semaine`, `En cours`, `En
   attente`) portent désormais « sur tout le registre » — ces trois
   nombres ne bougent JAMAIS avec la recherche (`kpiDuRegistre` reste
   inchangée), et ce sous-titre le dit plutôt que de laisser deviner.
3. **La ligne entière ouvre la fiche**. Un nouveau composant client,
   `app/(back-office)/interventions/ligne-cliquable.tsx`, remplace le
   `<tr>` nu de `LigneIntervention` : un clic n'importe où sur la ligne
   navigue vers la fiche, SAUF s'il atteint un `<a>` (la référence, qui
   reste un lien accessible à part entière — la seule manière d'ouvrir la
   fiche au clavier ou avec un lecteur d'écran). La ligne porte
   `cursor-pointer` et un survol visible (`hover:bg-app-surface-creuse`).
   La référence ne se coupe plus sur deux lignes (`whitespace-nowrap`
   ajouté à son lien).

**Pour l'exploitation** : un chef d'atelier qui a filtré une recherche
voit désormais CE qu'il a filtré (et peut le retirer d'un clic sans
rouvrir le formulaire), sait que les trois KPI du bandeau ne reflètent
pas ce filtre, et peut ouvrir une fiche en cliquant n'importe où sur sa
ligne — plus seulement sur une référence de 40 px de large.

**Un quatrième point du ticket (l'agence en clair, « DUCO — 1 ») était
déjà réparé** avant l'ouverture de ce lot — voir « Ce que j'ai tranché ».

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- **AVANT** (lecture de `app/(back-office)/interventions/page.tsx` sur
  `main` à `311d573`, avant toute modification) : `<tr>` sans `onClick` ni
  classe de survol dans `LigneIntervention` ; aucune puce, aucun bloc de
  filtres actifs entre les onglets et le tableau ; les trois `<Kpi>`
  n'avaient pas de prop `detail` ; le lien de référence portait
  `className={CLASSES_LIEN}` sans `whitespace-nowrap`.
- **AVANT — le filtre agence** : `components/agences/options.tsx` importait
  déjà `libelleAgenceAvecCode` (`lib/agences/presentation.ts`), qui compose
  « libellé — code » — pas « code — code ». `git log` confirme que
  `AGENCE-CODE-1` (commit `7737b6a`, 23/09/2026) a livré cette composition
  et l'a câblée dans CE MÊME sélecteur avant l'ouverture de ce ticket : le
  constat 18 de l'audit (25/09) était donc déjà comblé au moment où ce lot
  a commencé.
- `pnpm typecheck` : rouge une fois (narrowing `Date | null` perdu à
  travers un `if`/`else if` imbriqué dans un `if` englobant à `||`),
  corrigé en restructurant la puce « Période » en trois branches
  mutuellement exclusives sans variable partagée ; vert ensuite.
- `pnpm lint` : vert du premier coup.
- `pnpm format:check` : rouge une fois (2 fichiers), corrigé par
  `prettier --write` ciblé ; vert ensuite.
- `pnpm test` (unitaires) : **263 fichiers, 2837 tests, tous verts** — dont
  `tests/unit/ui/lot-a3.test.ts` et `tests/unit/theme/lien-visible.test.ts`,
  les deux gardiens qui lisent `page.tsx` par le texte et auraient rougi
  si l'ordre des colonnes ou la liste des porteurs de `CLASSES_LIEN` avait
  bougé.
- `pnpm test:isolation` : **126 fichiers, 1239 tests, tous verts**.
- `pnpm build` : vert — `/interventions` passe de (taille non notée avant
  ce lot) à 420 B de JS de page + 106 kB de premier chargement, l'écart
  attendu du composant client `LigneCliquable`.
- `pnpm test:e2e` ciblé sur `tests/e2e/registre-5.spec.ts` (neuf),
  `tests/e2e/liens-2.spec.ts`, `tests/e2e/registre-1.spec.ts`,
  `tests/e2e/registre-2.spec.ts`, `tests/e2e/registre-3.spec.ts` :
  **19 tests, tous verts** au second essai (voir « ce que j'ai tranché »
  pour le premier essai, rouge).
- Capture prise : `docs/propositions/88-REGISTRE-5/captures/
  registre-filtre-1280-1280.png`, à 1280 px — la puce « Recherche :
  RG5-cible ✕ », « Tout effacer », les trois sous-titres « sur tout le
  registre », et la référence `Local-562AA7` tenant sur une seule ligne.

## Ce que j'ai tranché, et pourquoi

- **Le point 4 du ticket (libellé agence lisible) n'a demandé AUCUNE
  modification** : mesuré avant d'écrire une ligne (`git log` sur
  `components/agences/options.tsx` et `lib/agences/presentation.ts`) que
  `AGENCE-CODE-1` l'avait déjà livré le 23/09/2026, deux jours avant
  l'audit qui a ouvert ce ticket — l'audit avait mesuré une version de
  `main` antérieure à cette correction. Retoucher un code déjà correct
  aurait été une seconde écriture d'un même critère.
- **`du`/`au` partagent une seule puce**, jamais deux : les retirer l'une
  sans l'autre laisserait une période bornée d'un seul côté, un état que
  rien dans le formulaire ne permet de composer directement.
- **« Tout effacer » conserve l'onglet actif (`vue`)** et retire tout le
  reste (recherche, agence, type, statut, période, technicien, « sans
  durée »), y compris la case « Inclure les clients inactifs » bien
  qu'elle ne porte pas sa propre puce — un filtre non annoncé par une
  puce reste un filtre, et « tout » doit vouloir dire tout. L'onglet, lui,
  est une NAVIGATION (les tabs au-dessus du tableau), pas un filtre du
  formulaire : l'effacer aurait surpris qui vient de cliquer « Bloquées »
  puis « Tout effacer » sur une recherche posée par-dessus.
- **La ligne cliquable est un composant CLIENT séparé**
  (`ligne-cliquable.tsx`), pas un `onClick` ajouté directement dans
  `page.tsx` : `page.tsx` reste un composant serveur (async, lit la base),
  et Next.js n'autorise un gestionnaire d'évènement que dans un fichier
  `"use client"`. Le lien de la référence reste un `<a>` distinct DANS ce
  composant, jamais remplacé par lui : un clic qui atteint ce lien (ou
  tout autre lien futur porté par la ligne) n'est jamais reconduit vers
  `router.push`, pour ne pas doubler la navigation.
- **Le premier essai de `tests/e2e/registre-5.spec.ts` a rougi** sur
  l'assertion qui suit le clic du « ✕ » : `toHaveURL(/\/interventions
  (?:\?.*)?$/)` acceptait AUSSI BIEN l'URL d'AVANT le clic (qui porte
  encore `?q=…`) que celle d'APRÈS — le motif est passé avant que la
  navigation n'ait rien changé, et `page.url()` lu juste après portait
  encore `q`. Remplacé par `page.waitForURL((url) =>
  !url.searchParams.has("q"))`, qui attend la condition réellement visée.
  Ce n'est PAS le code de l'écran qui était en cause — deux essais
  contrôlés, le second vert, avant de conclure.
- **Une seule nouvelle clé de ponctuation**, `ponctuation.deux_points`
  (" : "), pour composer chaque puce « Libellé : Valeur » — même principe
  que `ponctuation.separateur` (" — ") déjà en place pour
  `libelleAgenceAvecCode`.

## Ce que je n'ai PAS fait

- **Pas de puce ni de mention pour « Inclure les clients inactifs »** : le
  ticket énumère explicitement les six critères qui portent une puce
  (`q, agence, type, statut, du/au, technicien, sans durée`) et cette case
  n'y figure pas. Elle reste effaçable seulement en décochant la case du
  formulaire, ou via « Tout effacer ».
- **Pas de vérification de bout en bout des puces « Agence », « Type »,
  « Statut », « Technicien » et « Période »** — seules « Recherche » (via
  la puce elle-même) et « sans durée prévue » (via le KPI, indirectement)
  sont couvertes par une épreuve jouée dans un navigateur. Les cinq autres
  branches de `puceFiltresActifs` sont couvertes par `pnpm typecheck` (le
  narrowing `RechercheInterventions` empêche une valeur `null` de passer),
  par lecture de code, et par la capture d'écran unique — mais PAS par une
  assertion Playwright dédiée. Ce n'est pas une mesure, c'est un
  raisonnement : à écrire comme tel pour la session suivante.
- **Pas de bouton d'export ni de barre d'outils recomposée** — hors
  périmètre du ticket, et déjà nommé écart D128 par le lot A3.
- **Aucune migration, aucune ligne de semis, aucun prix, aucun `skip`.**

## Les pièges pour la session suivante

- **`hrefDeLaPage` pose TOUJOURS `page=<n>`**, même `page=1` — un lien
  « Tout effacer » ou une puce retirée rend donc `/interventions?page=1`
  (ou `/interventions?vue=…&page=1`), jamais `/interventions` nu. Une
  épreuve qui attendrait une URL sans AUCUN paramètre rougirait à tort ;
  mes deux épreuves vérifient l'ABSENCE du seul paramètre retiré, jamais
  l'absence de tout paramètre.
- **Un motif d'URL qui matche l'AVANT et l'APRÈS d'une navigation passe
  avant que la navigation n'ait eu lieu** (voir « ce que j'ai tranché » —
  le premier essai rouge de ce lot). Devant un clic sur un lien qui
  RETIRE un paramètre, préférer `page.waitForURL((url) =>
  !url.searchParams.has("x"))` à un `toHaveURL` par motif trop large.
- **`sans_duree_a_venir` ne survit déjà pas à un changement d'onglet ni de
  page** (comportement d'AVANT ce ticket, non touché) : `parametresActifs`
  ne le porte pas, seule la nouvelle `parametresPuces` (une SUPERPOSITION
  de `parametresActifs`, locale à ce fichier) le porte, pour que retirer
  UN AUTRE critère ne perde pas celui-ci. Si un ticket futur veut le faire
  survivre aux onglets/pagination, il faudra l'ajouter à
  `parametresActifs` lui-même — un changement plus large que celui-ci, non
  fait ici pour ne pas toucher un comportement que le ticket ne nommait
  pas.
- **`LigneCliquable` est un composant CLIENT** : toute évolution de
  `LigneIntervention` qui ajouterait un second élément interactif dans la
  ligne (un bouton, un menu) doit soit rester un `<a>`/`<button>` — auquel
  cas le clic sur la ligne l'ignore déjà via `closest("a")` pour les
  liens, MAIS PAS pour un `<button>` : `closest("a")` ne couvre que les
  liens. Un bouton ajouté dans une cellule serait aujourd'hui doublement
  cliqué (son propre gestionnaire, ET la navigation de la ligne).

## Ce qui reste à faire

- Écrire une épreuve de bout en bout dédiée aux puces « Agence », « Type »,
  « Statut », « Technicien » et « Période » (et à leur combinaison), pour
  remplacer le raisonnement par une mesure.
- Décider si « Inclure les clients inactifs » doit porter sa propre puce
  dans un ticket futur — ce lot suit la liste fermée du ticket, qui ne
  l'y place pas, mais la question reste ouverte pour l'ergonomie.
- Étendre `closest("a")` de `LigneCliquable` à `closest("a, button")` le
  jour où une ligne du registre porte un élément interactif autre qu'un
  lien.
