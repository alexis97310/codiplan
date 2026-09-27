# 9AO-GR17-DEMANDE-CHAMP-NATURE — passation

## Ce que j'ai changé

Trois finitions, sans migration, sans ligne de semis, sans prix, sans règle de gestion changée
(audit GR du 26/09, constats M5, M14, M16).

1. **M5 — la fiche d'une demande titre « Demande — <client> », pas « Demandes ».** La fiche
   affichait `demande.titre` (« Demandes »), le PLURIEL de la LISTE — sans nommer le client
   concerné. `titreFiche` (`app/(back-office)/demandes/presentation.ts`) compose désormais
   « Demande — <raison sociale> » via la clé neuve `demande.fiche.titre` (« Demande ») et
   `ponctuation.separateur`, ou « Demande » seul si le client n'a pas pu être lu. `demande.titre`
   n'a pas bougé : il sert toujours la liste et le `<title>` de l'onglet.
   **Ce que ça change pour l'exploitation** : ouvrir une fiche parmi des centaines montre
   immédiatement DE QUEL client il s'agit, sans lire la ligne du dessous.

2. **M14 — le champ refusé est encadré et focalisé.** Après un refus de saisie,
   `/interventions/nouvelle` montrait le motif en bandeau (`role="status"`) mais aucun champ
   n'était marqué. `champEnCause` (`app/(back-office)/interventions/presentation.ts`) désigne, avec
   CERTITUDE, le champ Nature (`intervention.refus.nature_manquante`) ou Panne signalée
   (`intervention.refus.panne_manquante`) — jamais le repli `lieu_inconnu`, qui couvre « tout le
   reste » et ne désigne aucun champ à coup sûr. Le champ en cause reçoit `aria-invalid="true"`,
   `aria-describedby` vers l'`id` du bandeau, une bordure `border-app-rouge-bord`, et `autoFocus`.
   **Ce que ça change pour l'exploitation** : après un refus, le curseur est déjà dans le bon champ
   et sa bordure rouge le désigne sans qu'il faille relire le bandeau pour comprendre lequel des
   sept champs du formulaire est en cause — et un lecteur d'écran lie explicitement le champ à son
   message de refus.

3. **M16 — « Nature » partout où les formulaires disaient « Type ».** Deux textes : l'option
   « Tous les types » du filtre du registre (`interventions.filtre_type_tous`) et la colonne
   « Type » de l'historique d'une fiche machine (`machine.fiche.historique_colonne_type`) —
   devenues « Toutes les natures » et « Nature ». `intervention.type` (« Nature ») portait déjà le
   mot imposé pour ce champ ; ces deux clés-ci restaient en décalage.
   **Ce que ça change pour l'exploitation** : le vocabulaire du filtre et de la colonne
   correspond enfin à celui du champ qu'ils désignent, au lieu d'employer deux mots pour une seule
   notion.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

`pnpm format:check` et `pnpm test` verts avant chaque commit ; `pnpm typecheck` vérifié après
chaque point. `CI=1 pnpm verify:full` rejoué en entier après le dernier commit : format,
typecheck, lint, tests unitaires, isolation, build, `feries:horizon`, `audit:partitions`, puis
413 tests e2e passés / 3 ignorés — vert.

Captures AVANT/APRÈS dans `captures/`, à 1280 et 375 px, prises par
`tests/e2e/captures-9ao-gr17-demande-champ-nature.spec.ts` (committé, gardé par la variable
d'environnement `CAPTURES_9AO` — silencieux sous `pnpm test:e2e` ordinaire) : une fois sur le
commit `69f9a15` (avant le lot, dans un `git worktree` séparé), une fois sur le code livré
(après les trois commits de ce lot) :

- `fiche-demande-ergo5-{avant,apres}-{1280,375}.png` — la fiche d'une demande de scène `ERGO5-`.
  Vérifié visuellement : AVANT le titre est « Demandes », APRÈS « Demande — ERGO5-Client
  (captures GR17) ».
- `formulaire-refus-panne-{avant,apres}-{1280,375}.png` —
  `/interventions/nouvelle?motif=intervention.refus.panne_manquante`. Vérifié visuellement : AVANT
  le champ « Panne signalée / travail demandé » est identique aux autres, APRÈS il porte une
  bordure rouge et le focus (visible au style natif du navigateur).
- `registre-filtre-nature-{avant,apres}-{1280,375}.png` — `/interventions`. Vérifié visuellement :
  AVANT l'option par défaut du filtre dit « Tous les types », APRÈS « Toutes les natures ».
- `fiche-machine-historique-{avant,apres}-{1280,375}.png` — la fiche d'une machine de démonstration
  DÉJÀ rattachée à l'historique du semis (Ravaglioli KPX-337, `Local-000001`). Vérifié
  visuellement : AVANT la colonne dit « Type », APRÈS « Nature ».

## Ce que j'ai tranché et pourquoi

**La fiche machine capturée n'est PAS une fiche forgée par la scène `ERGO5-`.** Le point M16 porte
sur l'historique d'UNE machine — une donnée du semis de démonstration, jamais recréée par une
épreuve e2e (§9, aucune ligne de semis). Le capture-spec lit donc la première ligne de
`intervention_machine` pour la société CODIMA-NC, plutôt que de fabriquer sa propre machine et sa
propre intervention rien que pour la capture : la colonne « Type »/« Nature » s'affiche que
l'historique soit vide ou non (le tableau pose toujours son en-tête), mais une ligne réelle rend la
capture plus lisible.

**`aria-describedby` est posé même quand le motif ne désigne aucun champ (repli
`lieu_inconnu`).** Non — au contraire : il n'est posé QUE quand `champEnCause` renvoie `"type"` ou
`"description"`, jamais pour le repli. C'est explicitement ce que la troisième épreuve e2e
(`champ-fautif.spec.ts`) vérifie : zéro `[aria-invalid="true"]` sur cette URL.

**`autoFocus` en JSX, sans composant client ni `useEffect`.** Mesuré au navigateur (via
`toBeFocused()` dans `champ-fautif.spec.ts`) : l'attribut HTML natif `autofocus` est traité par le
navigateur au chargement du DOM, AVANT toute hydratation React — il fonctionne donc identiquement
sur un élément rendu par un composant SERVEUR, sans JavaScript supplémentaire. Le risque nommé par
le ticket (« NON MESURÉ ») ne s'est pas matérialisé ; aucun petit composant client n'a été
nécessaire.

## Ce que je n'ai PAS fait

- Le titre « Fiche machine » : question explicitement en attente (hors lot, cf. le ticket).
- Le titre « Intervention Local-… » : non demandé par GR17.
- Un message sous le champ en cause (l'audit M14 le propose ; le ticket ne le demande pas — seuls
  `aria-invalid`, `aria-describedby`, la bordure et le focus sont demandés).
- Le champ Site : le repli `lieu_inconnu` ne le désigne jamais avec certitude, et le ticket est
  explicite là-dessus — aucun encadrement n'est posé sur ce champ.
- Aucune route de `app/api/` modifiée : `versLeFormulaire` continue de composer les mêmes motifs,
  seule leur lecture côté écran change.

## Les pièges pour la session suivante

- **L'attribut HTML `autofocus` n'a pas besoin d'hydratation** : sur un composant Next.js
  ENTIÈREMENT serveur, `<textarea autoFocus>` fonctionne quand même, parce que c'est le navigateur
  — pas React — qui pose le focus au chargement du document. Ne pas se précipiter vers un
  composant client « juste pour le focus ».
- **`intervention.refus.lieu_inconnu` est un REPLI, jamais une désignation du champ Site** :
  toute nouvelle logique qui voudrait encadrer un champ à partir d'un motif de refus doit vérifier
  d'abord, dans `app/api/interventions/creer/route.ts`, quels chemins Zod (`issues[].path`) mènent
  réellement à ce motif — `lieu_inconnu` couvre TOUT sauf `type` et `description`.
- Recette des captures AVANT/APRÈS quand le code AVANT est déjà committé (mémoire
  `captures-avant-apres-e2e`) : `git worktree add <chemin> <commit-avant>`, `node_modules`
  symlinké, `.env` copié, capture-spec copié dans le worktree, lancé avec `CI=1` — chaque run
  complet (migrate deploy + seed + build) a coûté ~55-60 s une fois le worktree prêt.
  `git worktree remove --force` ensuite.

## Ce qui reste à faire

Rien d'identifié dans le périmètre de ce lot. Les trois constats du GR (M5, M14, M16) sont
couverts, testés (unitaire + e2e pour M5 et M14, unitaire pour M16), capturés et commités.
