# 9AY-AA-G1-AGENCE-PROPRE-CHOIX-SITES — passation

Ticket regroupé, deux parties, faites dans l'ordre : AA-0-EPREUVE-AGENCE-PROPRE puis AA-1-CHOIX-SITES.
Commits : `b2ca4c3` (AA-0), `4a5e405` et `faa107b` (AA-1). `CI=1 pnpm verify:full` joué UNE SEULE FOIS,
en entier, au premier plan, après la dernière partie : vert (format:check, typecheck, lint, test,
test:isolation, build, feries:horizon, audit:partitions, test:e2e — 499 passed, 3 skipped, 0 failed).

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

**AA-0.** Le second scénario de `tests/e2e/agences-etat-visible.spec.ts` désactivait DOLBEAU — une
agence PARTAGÉE du jeu de démonstration — le temps du scénario, avant de la réactiver. Il forge
désormais sa propre agence (préfixe `AA0-`, code tiré au sort), par l'écran de création, la désactive
par sa fiche, vérifie la liste et le badge « Inactif », puis la SUPPRIME par un accès direct à la base
dans un `finally` (aucune route de suppression n'existe pour une agence — mesuré). Pour l'exploitation :
rien ne change à l'écran, c'est une épreuve qui devient plus sûre à faire tourner en parallèle d'autres
fichiers e2e.

**AA-1.** Une agence inactive sort désormais des menus de rattachement (`/sites/nouveau`,
`/sites/[id]`, et le rattachement d'un technicien via `agencesDisponibles`), sauf celle qu'une fiche
porte déjà (`/sites/[id]`) — marquée « (inactive) » dans son option. Pour l'exploitation : on ne peut
plus, par erreur, rattacher un NOUVEAU site à un établissement fermé ; un site déjà rattaché à un
établissement qu'on vient de fermer garde son rattachement visible et modifiable, sans jamais dériver
vers une autre agence au prochain enregistrement d'un champ sans rapport. Décision écrite en
`docs/arbitrages.md` sous D134, avec ce qui est gardé (Paramètres > Agences, fiches existantes, charge
et planning, import Excel — aucun n'est filtré par cette décision).

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- **AA-0** : après le scénario, `select code, actif from agence` sur `codiplan_test` ne montre AUCUNE
  ligne `AA0-%` (nettoyage confirmé), et les trois agences de démonstration (DUCOS, KONE, DOLBEAU)
  restent `actif = true` — mesuré directement après un run isolé du fichier, puis après un run conjoint
  avec `tests/e2e/ecrans-largeur-utile.spec.ts` (qui compte exactement trois lignes sur ce même écran) :
  7 tests, tous verts.
- **AA-1** : captures AVANT/APRÈS de `/sites/nouveau` et d'une fiche site, à 1280 et 375 px, dans
  `docs/propositions/AA-1-CHOIX-SITES/captures/` — prises depuis un `git worktree` sur le commit
  précédent (AVANT, `b2ca4c3`) puis sur le commit livré (APRÈS, `4a5e405`), jamais en comparant deux
  fichiers distincts. La fiche AVANT montre l'option « AA1CAP-INACTIVE — AA1CAP-INACTIVE » sans aucune
  mention ; la fiche APRÈS montre la même option suffixée « (inactive) ». `pnpm test:isolation` (3
  scénarios neufs) et l'épreuve e2e dédiée (2 scénarios neufs) sont verts ; la base de test ne porte
  plus aucune ligne `AA1-%` ni `AA1CAP-%` après coup.

## Ce que j'ai tranché et pourquoi

- **Agence forgée directement via Prisma pour AA-1** (plutôt que par l'écran de création, comme AA-0) :
  AA-0 avait déjà pour objet de tester l'écran de création lui-même ; AA-1 teste le comportement des
  écrans de SITE face à une agence inactive, et le fait qu'un site soit rattaché à une agence AVANT sa
  désactivation est un FAIT antérieur, pas un geste que le scénario doit rejouer — même discipline que
  `tests/e2e/avertissement-ton.spec.ts`.
- **Nettoyage par accès direct à la base plutôt que par une route de suppression** (AA-0 et les captures
  AA-1) : aucune route de suppression n'existe pour une agence, et il n'y en avait pas à inventer pour
  ce ticket — c'est la même hygiène de test que `absences-2.spec.ts` ou `bon-3.spec.ts` appliquent déjà
  à un site, un client ou une machine forgés.
- **`agencesProposables` comme SEUL lecteur du critère** (`lib/agences/proposables.ts`), appelé par
  `agencesDisponibles` et les deux pages de site, plutôt que de dupliquer le `where` à trois endroits :
  un critère métier écrit à deux endroits est un critère qui divergera un jour (§9).
- **`garder` plutôt qu'un filtre `actif` nu** sur `/sites/[id]` : sans lui, une agence désactivée après
  coup ferait perdre son option au site déjà rattaché, le navigateur retomberait sur la première agence
  du menu, et « Enregistrer » un tout autre champ changerait le rattachement sans qu'on l'ait demandé —
  le piège que le constat du ticket nommait explicitement.
- **Le libellé de l'agence forgée d'AA-0 réduit au CODE seul** (`const libelle = code`, sans texte fixe
  accolé) : un texte fixe aurait fait rougir le gardien `sans-chaine-visible-en-dur`, qui reconnaît une
  chaîne visible PAR SON NOM DE VARIABLE dans tout le fichier, sans tenir compte de la portée — la
  fonction `ligneDe(page, libelle: string)`, plus bas dans le même fichier, porte un paramètre du même
  nom.
- **Formulaires remplis par sélecteur `input[name="…"]`, jamais `getByLabel`**, sur l'écran de création
  d'agence (AA-0) : chaque `<label>` du formulaire porte aussi son texte d'aide dans le même élément
  (« Code » est un sous-texte de l'aide du territoire), et `getByLabel` échoue en mode strict sur deux
  champs à la fois — même geste que `tests/e2e/contacts.spec.ts`.

## Ce que je n'ai PAS fait

- Je n'ai PAS ajouté de route de suppression d'agence : ni AA-0 ni AA-1 n'en avaient besoin, et en
  ajouter une aurait été une fonctionnalité hors du territoire du ticket.
- Je n'ai PAS touché `tests/e2e/ecrans-largeur-utile.spec.ts` : son compte exact de trois lignes reste
  vrai, parce qu'AA-0 ne laisse plus aucune agence forgée derrière lui (contrairement à l'ancienne
  version, qui désactivait DOLBEAU sans changer le nombre de lignes, donc sans jamais toucher ce
  compte).
- Je n'ai PAS touché le filtre du registre (`app/(back-office)/interventions/page.tsx:197`, son propre
  `tx.agence.findMany` sans filtre) : il continue de proposer TOUTES les agences, actives ou non. Le
  territoire du ticket nommait précisément `agencesDisponibles`, `components/agences/options.tsx` et
  les deux pages `sites/` — pas ce troisième lecteur. `/parametres/equipe`, lui, EST corrigé : il passe
  déjà par `agencesDisponibles`.
- Je n'ai PAS vérifié le comportement sous `fullyParallel` HORS CI (`workers` non fixé à 1 dans
  `playwright.config.ts` en local) : sous CI, `workers: 1` élimine toute collision entre le scénario
  qui forge une agence temporaire et un scénario étranger qui compterait les lignes de
  `/parametres/agences` au même instant ; en local, sans `CI=1`, un tel recouvrement reste
  théoriquement possible et n'a pas été mesuré au-delà d'un run conjoint des deux fichiers concernés
  (voir « Ce que j'ai mesuré »).

## Les pièges pour la session suivante

- Le gardien `sans-chaine-visible-en-dur` (`tests/unit/i18n/sans-chaine-visible-en-dur.test.ts`)
  reconnaît une constante littérale PAR SON NOM DE VARIABLE dans tout le fichier analysé, pas par sa
  portée lexicale : deux fonctions du même fichier qui partagent un nom de paramètre (`libelle`, ici)
  peuvent se faire accuser l'une par l'autre. Éviter d'accoler du texte fixe à une donnée de test dont
  le nom de variable est réutilisé ailleurs dans le même fichier, ou choisir un nom distinct.
- `getByLabel` échoue en mode strict dès qu'un texte d'aide contient le libellé d'un AUTRE champ du
  même formulaire (ex. l'aide du territoire contient le mot « Code »). Préférer `input[name="…"]` sur
  les formulaires qui associent un `<span>` d'aide au même `<label>` que le champ.
- Les captures AVANT/APRÈS via `git worktree` fonctionnent sans réinstallation (`ln -s node_modules`,
  `cp .env`), mais `next build` type-vérifie le spec de capture sur le code D'AVANT (tsconfig inclut
  `tests/`) : éviter d'y référencer une clé `fr[...]` neuve — cette fois, la capture ne comparait que
  des captures d'écran, donc le spec n'a eu besoin d'aucune clé du dictionnaire.
- La stash antérieure `WIP on main: 98ba2fc AGENCE-2 — compte rendu, sur b5b773f` (portant sur
  `lib/imports/`, sans rapport avec ce lot) était déjà présente au début de cette session et n'a pas été
  touchée — à vérifier par la session suivante si elle représente un travail encore attendu.

## Ce qui reste à faire

- Aucun reliquat du territoire de ce ticket : les deux parties sont livrées, testées et commitées.
- Le filtre du registre `/interventions` propose encore toutes les agences, actives ou non (voir
  « Ce que je n'ai PAS fait ») — à reconsidérer si l'exploitation signale qu'une agence inactive s'y
  propose encore.
