# DEMANDES-1 — passation

## Ce que j'ai changé

**Avant ce lot**, `lib/demandes/depot.ts` portait tout le cycle de vie d'une demande
(déposer, accuser réception, qualifier, marquer transformée, clore sans suite,
lister les ouvertes) depuis le lot 2 (L2-06), sans aucun appelant hors des tests. Zéro
route sous `app/api`, zéro écran sous `app/(back-office)` : une demande, une fois créée
par fixture, restait invisible et inatteignable depuis l'interface. Le tableau de bord
affichait un compteur « demandes ouvertes » qui menait vers `/interventions/nouvelle`
— un écran qui QUALIFIE une demande sans jamais la MONTRER.

**Depuis ce lot** :

- Quatre routes sous `app/api/demandes/[id]/` (`accuser`, `qualifier`, `transformer`,
  `clore`), chacune un mince appel à la fonction déjà écrite dans le dépôt, sous la
  capacité `creer_demande` — la même que `POST /api/interventions/creer` (arbitrage
  du ticket : qualifier une demande, c'est décider qu'on va intervenir).
- La file de qualification, `/demandes` : les demandes `nouvelle` ou `qualifiee`,
  triées par la plus ancienne d'abord (voir « Ce que j'ai tranché »), avec un état vide
  qui se distingue explicitement d'une file qui n'a pas pu être lue.
- La fiche d'une demande, `/demandes/[id]` : ce qu'elle porte (client, site, agence
  déduite, machine, interlocuteur), l'état de son accusé de réception, et ses quatre
  actions — chacune affichant le refus à sa place, avec sa raison, quand la transition
  ou la capacité manque.
- Le compteur du tableau de bord mène désormais à `/demandes` plutôt qu'à
  `/interventions/nouvelle` — même tuile, même ordre, même nombre (D125) : seul le lien
  change.

**Ce que ça change pour l'exploitation** : une demande a maintenant un endroit où vivre
entre « le client a appelé » et « un technicien est planifié ». L'ADV peut accuser
réception, qualifier, et — si rien ne le justifie — clore avec un motif conservé.
Aujourd'hui encore, aucune de ces demandes ne crée d'intervention toute seule ; le geste
de planifier reste un geste humain séparé (voir plus bas).

## Ce que j'ai mesuré

- `find app/api -ipath '*demande*'` et `find "app/(back-office)" -ipath '*demande*'` :
  **0 fichier sur `main`, 8 fichiers après ce lot** (`git ls-tree -r --name-only main --
  app/api "app/(back-office)"`, vérifié à nouveau ce jour).
- Le compte des routes gardées par `tests/unit/auth/porte.test.ts` (D-12) :
  **58 après ce lot**, quatre exemptions retirées (`accuserReception`,
  `qualifierDemande`, `marquerTransformee`, `cloreSansSuite` avaient chacune une
  exemption nommée dans `scripts/lib/chemins-de-depot.ts` ; elles ont désormais un
  appelant réel et l'exemption se retire).
- `pnpm verify` (ce jour) : **2581 tests unitaires (233 fichiers)**,
  **1129 tests d'isolation (108 fichiers)**, format/typecheck/lint/build tous verts.
- `pnpm verify:full` (ce jour, en entier) : ce qui précède, plus l'horizon des fériés
  (vert), l'audit des partitions (13 couvertes, jusqu'à 2027-09, vert), et
  **153 scénarios e2e passés**, dont les 7 de `tests/e2e/demandes.spec.ts`.
- `tests/e2e/demandes.spec.ts`, exécuté seul avec `CAPTURES_DEMANDES_1=...` : **7/7
  scénarios verts**, cinq captures 1280 px écrites dans ce dossier.
- Sur `main`, avant ce lot, ce même scénario e2e rougirait par construction :
  `/demandes` répond 404 et aucune route `/api/demandes/**` n'existe (le docblock du
  spec porte cette mesure, datée du 22/09/2026 par la session précédente).

## Ce que j'ai tranché et pourquoi

- **Reprise, pas réécriture.** Le premier passage (23/09, 01h29–02h02) avait produit ce
  travail sur la branche `19-DEMANDES-1-inacheve` (commit `37470bc`), mais celle-ci avait
  été créée AVANT que `BON-2` ne fusionne sur `main` — un `git diff main..branche` brut
  aurait fait croire que ce lot *retirait* le rapport de terrain, les octets de document,
  etc. J'ai rebasé par `cherry-pick` sur `main` à jour plutôt que de repartir de zéro. Un
  seul conflit (le compte de routes gardées, recalculé à 58) et deux blobs de test sous
  `.donnees-locales/` — explicitement ignorés par git (stockage local des documents,
  voir `lib/documents/stockage.ts`) — que j'ai retirés de l'index avant de commiter (I9 :
  pas de données locales dans le dépôt).
- **L'ordre de la file** : la plus ancienne demande en tête, PAS l'ordre de
  `demandesOuvertes` (urgence puis dépôt), qui répond à une autre question (celle du
  tableau de bord — voir le pire cas d'abord). Une file d'attente répond à « qui attend
  depuis le plus longtemps ? », la question que pose le standard des 30 minutes
  (RG-STD-01) : une demande urgente déposée il y a cinq minutes ne doit pas passer devant
  une demande ordinaire qui attend depuis deux jours. Le tri est donc refait dans l'écran
  (`presentation.ts:parLaPlusAncienne`), jamais dans le dépôt — `demandesOuvertes` garde
  SON ordre pour SON usage. Le spec e2e le PROUVE (pas seulement l'affirme) : la demande
  la plus urgente porte un dépôt récent, l'ancienne une urgence basse — si le tri de
  l'écran était absent, l'ordre serait inversé.
- **Aucune nouvelle épreuve d'isolation.** Le ticket demandait « au minimum » une épreuve
  d'isolation du cycle complet. `tests/isolation/demande.test.ts` la porte déjà en
  entier depuis L2-06 — dépôt et quatre actions « à travers le contexte de production »,
  refus tenus par la base (test JUMEAU, déclencheur retiré), clôture avec motif, audit.
  Écrire une seconde épreuve isolation aurait dupliqué une confrontation module/base déjà
  faite ; j'ai donc écrit UNE épreuve de RENDU (`tests/e2e/demandes.spec.ts`), qui prouve
  la ROUTE et l'ÉCRAN — la seule chose qui manquait avant ce lot — et je le dis dans le
  docblock du spec plutôt que de le laisser à déduire.
- **`Tableau`, pas `CarteEntite`**, pour la file — `demande` est transactionnel (une file
  à traiter), pas un référentiel qu'on consulte pour ce qu'il EST (D123, réservée aux deux
  seuls écrans référentiels de la maquette).
- **La capacité `creer_demande`** pour les quatre actions, la même que la création d'une
  intervention : décision du ticket lui-même (§5, dernier point), appliquée telle quelle.

## Ce que je n'ai PAS fait

- **Le dépôt d'une demande par le portail client** — hors périmètre V1 par cadrage
  explicite du ticket. `deposerDemande` reste exemptée dans
  `scripts/lib/chemins-de-depot.ts`, avec le motif inchangé (« écran du portail »).
- **Aucune règle métier neuve.** Les six fonctions de `lib/demandes/depot.ts` n'ont pas
  été touchées ; les routes les appellent telles quelles.
- **Aucune création d'intervention automatique.** « Transformer » pose le statut et son
  verrou, rien de plus — `marquerTransformee` le dit dans son propre en-tête, et la
  colonne `intervention.demande_id` n'existe pas encore au chapitre 11. La fiche porte un
  lien vers `/interventions/nouvelle` pour le geste réel, séparé et humain.
- **`prisma/schema.prisma` et toute migration** — territoire interdit par le ticket, non
  touché.

## Les pièges pour la session suivante

- **`git diff main..<branche-de-secours>` peut mentir si la branche de secours a été
  créée avant un merge récent sur `main`.** Toujours `git merge-base main <branche>` et
  comparer à `git log --oneline -1 main` avant de juger un diff de sauvegarde — sinon un
  lot fusionné entre-temps (ici `BON-2`) apparaît comme « retiré » par la branche
  inachevée, alors qu'elle est simplement en retard.
- **`.donnees-locales/` est gitignoré mais un commit peut quand même l'avoir ajouté** :
  `git status` ne le signale qu'après coup (fichier déjà TRACKÉ dans le commit importé).
  Vérifier `git status --short` après tout `cherry-pick` ou `merge` qui importe un commit
  d'une autre session, avant de committer à son tour.
- **Le compte `58` dans `tests/unit/auth/porte.test.ts`** n'est bon QUE tant que personne
  n'ajoute ou ne retire de route gardée ailleurs. Il se recalcule avec le script node
  utilisé ici (compter les clés de `ROUTE_CAPACITE`), pas en le devinant.
- La fiche d'une demande n'a pas de lecture dédiée dans `lib/demandes/depot.ts` : elle lit
  `tx.demande.findFirst` directement avec `CHAMPS_DEMANDE` (exporté par le dépôt), parce
  que `demandesOuvertes` filtre `nouvelle`/`qualifiee` et cacherait une demande
  `transformee` ou `close_sans_suite`. Une future fonction de lecture-par-id dans le
  dépôt devra composer avec cette fiche, pas la dupliquer.

## Ce qui reste à faire

- **Le dépôt d'une demande par le portail client** (hors V1, cadrage explicite).
- **La création d'intervention depuis une demande transformée** n'est pas liée en base
  (`intervention.demande_id` n'existe pas au chapitre 11) : aujourd'hui, le lien entre une
  demande « transformée » et l'intervention qui en résulte n'est visible dans AUCUN sens.
  C'est un ticket à écrire, pas une omission de celui-ci — nommé au chapitre 11 comme
  travail futur.
- Aucun conflit non résolu, aucune épreuve rouge deux fois de suite à signaler.
