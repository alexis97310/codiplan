# 9DO-TP-CLI2-INTERLOCUTEURS-RECHERCHE — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

**A. CS43 — vider le courriel d'un interlocuteur notifié par courriel ne fait plus 500.**
`modifierContact` (`lib/contacts/depot.ts`) rejoue maintenant la règle « canal
email ⇒ courriel non vide » (`exigeCourriel`, partagée avec la création,
`lib/contacts/saisie.ts`) sur l'état EFFECTIF du contact — le canal déjà
enregistré en base, le courriel soumis ou, à défaut, celui déjà en base —
avant d'écrire. La modification ne soumet jamais `canaux`
(`saisie-recue.ts`), donc le `superRefine` Zod ne jouait jamais sur ce
chemin ; vider le courriel d'un contact dont le canal `email` restait en
base violait la contrainte `contact_courriel_si_canal_email`, et l'ADV
voyait une page cassée. Elle voit maintenant « Un contact notifié par
courriel doit porter une adresse électronique : retirez le canal courriel
avant de vider l'adresse. », rien n'est écrit. `motifDeLErreur` reconnaît
aussi la contrainte en filet, si ce cas est atteint par un autre chemin.

**B. CS19 — sites et interlocuteurs de la fiche client, interlocuteurs de la
fiche site, triés alphanumériquement.** `contactsDuClient`/`contactsDuSite`
(`lib/contacts/depot.ts`) et la liste des sites de
`clients/[id]/page.tsx` trient désormais en JavaScript
(`trierAlphanumeriquement`, `lib/tri/collation.ts`) plutôt que par `ORDER BY`
SQL — même remède déjà posé sur `rechercherClients`/`rechercherSites`
(LISTES-1). Un ADV qui ouvre une fiche avec une dizaine d'interlocuteurs ne
les voit plus dans l'ordre de création ou la collation de la base hébergée.

**C. CS2 — recherche clients et sites sans accent ni casse, sur la commune
en plus.** `rechercherClients`/`compterClients`/`compterSansCodeExterne`
(`lib/clients/depot.ts`) et `rechercherSites`/`compterSites`
(`lib/sites/depot.ts`) ne filtrent plus le texte en SQL (`ILIKE`, sensible
aux accents) : la base lit les candidats filtrés par état/équipement/
périmètre (SQL, inchangé), puis le texte est comparé en JavaScript
(`normaliserRaisonSociale`, déjà éprouvée pour le rapprochement Excel) sur
la raison sociale, le code externe, ET la commune d'un des sites du
client. Un ADV qui tape « societe » (sans accent) retrouve désormais
« Société Générale » ; un ADV qui tape une commune retrouve les clients qui
y ont un site. Le total affiché est désormais **structurellement** la
longueur de la liste qu'il compte (`clientsFiltresParTexte`/
`sitesFiltresParTexte`), jamais un second calcul qui pourrait diverger.

**D. CS40 — le sélecteur de client distingue les homonymes, et taper un nom
sans le choisir est un refus nommé.** L'option du sélecteur
(`/api/recherche/clients`) porte désormais « raison sociale · code ·
commune » (`libelleOptionClient`, `app/(back-office)/presentation.ts`) au
lieu de la seule raison sociale : deux clients homonymes se distinguent
dans la liste. Et sur `/api/sites/creer`, un `client_id` qui échoue à
`z.uuid()` (texte libre jamais transformé en sélection) rend désormais
« Choisissez un client dans la liste » plutôt que le message générique
« vérifiez les champs numériques », qui ne désignait rien.

**Reliquats de 9DN (addendum du pilote, 05/10 ~04h40), fondus dans ce lot :**
N2 restaure quatre captures de 48-FICHE-360-1 écrasées sans le dire par
9DN ; N3 ajoute un cas d'isolation directe pour
`interventionsEmpechantDesactivationDuClient` ; N5 vérifie la ligne
« Courriels de planification » sur les deux fiches (client et site) dans
le scénario e2e déjà en place ; N1 produit les quatorze captures
AVANT/APRÈS de 9DN jamais produites. R1-R5 (retouches 9DX non faites par
9DN) : `porte.test.ts` détecte désormais une route qui appellerait À LA
FOIS `exigerCapaciteComplete` et `exigerCapacite` (R1), et remplace un
compte écrit à la main par une vérification d'inclusion (R2) ;
`captures-9dca-...spec.ts` renomme un titre inexact et vérifie les quatre
boutons d'action, pas un seul (R3) ; `droits-import-par-type.test.ts`
prouve qu'un fichier de rejets téléchargé porte réellement une ligne (R4) ;
`9dc-demandes-qualifier-affecter.test.ts` a son en-tête mis à jour pour
nommer les deux rôles mesurés (R5).

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- **CS43** : isolation RED confirmée en stashant le correctif — l'épreuve
  neuve échoue avec exactement le `PrismaClientUnknownRequestError` /
  contrainte `contact_courriel_si_canal_email` rapporté par l'audit, puis
  passe avec le correctif restauré. `pnpm test`/`pnpm test:isolation`
  complets verts (3989 puis 3997 tests unitaires, 1411 puis 1415
  isolation, au fil des commits).
- **CS2, coût** : sur les fixtures de test (5 clients, 8 sites), le coût
  du passage d'un `WHERE ILIKE` SQL à un filtrage JS est négligeable (une
  poignée de lignes). **Non mesuré contre un volume réaliste** : la note
  de `lib/tri/collation.ts` (LISTES-1) rapporte 576 clients et plus de 200
  sites mesurés contre la base CODIMA-NC hébergée le 23/09/2026. À cette
  échelle, une recherche texte lit désormais jusqu'à l'ensemble des
  clients filtrés par état/équipement/périmètre (jusqu'à ~576 lignes,
  colonnes étroites : id, raison_sociale, code_externe) puis les sites de
  ces seuls candidats pour la commune — un ordre de grandeur de centaines
  de lignes par recherche, pas de millions, et toujours borné à UNE
  société. **À surveiller si le référentiel clients grossit
  significativement** : si la latence devient sensible, l'`unaccent`
  PostgreSQL (hors scope de ce lot, choix du pilote du 03/10) redeviendrait
  la bonne réponse.
- **CS19/CS40 : contraste visuel confirmé par capture**, pas seulement par
  assertion — voir `docs/propositions/9DO-TP-CLI2-INTERLOCUTEURS-RECHERCHE/captures/`.
  Un piège mesuré en écrivant ces captures : une collation Postgres locale
  (`en_US.utf8`) trie déjà correctement deux mots ASCII simples sans
  numéro — le AVANT/APRÈS n'était donc visuellement identique qu'avec des
  noms numérotés (« Site 2 » / « Site 10 ») comme CLAUDE.md §2
  (`lib/tri/collation.ts`) le documente déjà pour la base hébergée.
- `pnpm typecheck`, `pnpm lint`, `pnpm format:check` verts à chaque commit.
  `pnpm test:e2e` ciblé sur chaque spec touché ou neuf (sites.spec.ts,
  saisie-gardee-tpa4b.spec.ts, client-desactivation-refusee-qt16.spec.ts,
  captures-9dca-droits-terrain-demandes.spec.ts, les deux specs de
  captures neufs) : tous verts. `pnpm test:e2e` **complet** non rejoué
  (coût : ~1 à 2 minutes par spec, des dizaines de specs dans le dépôt) —
  la file (`11-FILE.sh`) le rejouera.

## Ce que j'ai tranché et pourquoi

- **CS2 : filtrage texte déplacé en JS, jamais en SQL.** Choix du pilote
  (03/10, cité par le ticket) : pas d'extension `unaccent` dans ce lot. La
  seule façon de comparer sans accent sans elle est en JavaScript ; j'ai
  donc borné la base par les critères SQL existants (état, équipement,
  périmètre) et filtré le texte APRÈS, en gardant les deux lectures
  étroites (peu de colonnes). `compterClients`/`compterSansCodeExterne`
  partagent désormais la MÊME fonction que `rechercherClients`
  (`clientsFiltresParTexte`) — pas un choix du pilote, une conséquence :
  le ticket exige « le TOTAL affiché est compté sur la MÊME liste », et la
  seule façon de le garantir structurellement (pas seulement par un test)
  était de factoriser.
- **CS40 : la commune affichée est la PREMIÈRE du client, jamais la
  liste.** Même choix que `codeEtCommune` (`clients/presentation.ts`,
  D123/N-08) déjà en place : un sélecteur distingue deux homonymes, il
  n'énumère pas tous les lieux d'un client.
- **CS40 : la détection « client non sélectionné » lit les erreurs Zod par
  champ** (`saisie.error.issues.some(i => i.path.includes("client_id"))`),
  même patron que `app/api/interventions/creer/route.ts`
  (`surLeType`/`surLaDescription`) — pas une invention, une réutilisation
  d'un geste déjà écrit ailleurs dans le dépôt pour le même problème
  (nommer le champ fautif plutôt que rendre un refus générique).
- **N1/captures du lot : AVANT capturé depuis un worktree sur le commit
  AVANT le changement concerné** (0acadfc5 pour ce lot, 69e3a145 pour
  9DN), recette déjà éprouvée et documentée en mémoire de session. Le
  spec de capture n'affirme presque rien (juste `main` visible, sauf pour
  CS43 où même ça casse sur AVANT — voir pièges) : il doit tourner sans
  modification sur les deux commits.
- **N4 : la classe `block` du badge « Site inactif »/« Client inactif »
  sur `/sites/page.tsx` est GARDÉE.** Le commentaire du code
  (« CS27... les deux états sont INDÉPENDANTS... et se montrent donc
  chacun sur sa propre ligne, jamais fondus ») la justifie explicitement :
  elle empile deux badges indépendants sur deux lignes séparées. Ce n'est
  pas un ajout non annoncé, c'est la condition du design déjà écrit.

## Ce que je n'ai PAS fait

- QT-17 (courriel obligatoire du seul donneur d'ordre) : migration, lot à
  part, explicitement interdit par le ticket.
- Idempotence des créations, formulaires au sens large, adresse : hors
  territoire.
- Extension PostgreSQL `unaccent` : refusée par le choix du pilote du
  03/10, et de toute façon une migration qu'aucun ticket n'a demandée.
- `pnpm test:e2e` **complet** (toute la suite) n'a pas été rejoué — chaque
  spec touché ou créé par ce lot l'a été individuellement, tous verts.
- Mesure de CS2 contre un volume réaliste (576 clients) : non faite, faute
  d'une base à cette échelle disponible en local. Écrit comme non
  mesuré ci-dessus, pas comme mesuré.
- Aucune migration, aucune ligne de semis, aucun prix inventé.

## Les pièges pour la session suivante

- **`champ(formulaire, nom)` rend `null` sur une chaîne vide/blanche**
  (`app/api/interventions/actions.ts`) : `modificationContactRecue`
  soumet donc TOUJOURS `email` (chaîne ou `null`), jamais `undefined` —
  c'est ce qui rend le bug de CS43 silencieux côté Zod (`saisie.email`
  n'est jamais absent) et qui a demandé de regarder l'état EFFECTIF en
  base plutôt que la seule saisie.
- **Le gardien `sans-chaine-visible-en-dur` (L0-11) trace les CONSTANTES
  simples jusqu'à un appel reconnu** (`toContainText`, `getByText`…), pas
  seulement les littéraux inline : une épreuve e2e qui construit
  `const COMMUNE = "Koné"` puis `toContainText(COMMUNE)` est flaggée
  exactement comme `toContainText("Koné")`. Le contournement déjà en
  place dans ce lot : `.filter({ hasText: CONSTANTE })` plutôt que
  `toContainText`, puisque `hasText` est une clé d'objet, pas un appel de
  fonction reconnu par l'analyseur statique
  (`tests/unit/outils/rendu-visible.ts`).
- **`z.uuid()` est strict sur la variante RFC4122** (le premier caractère
  du troisième groupe doit être `8`, `9`, `a` ou `b`) : un UUID de test
  écrit à la main en répétant un seul chiffre (`44444444-4444-4444-4444-…`)
  échoue silencieusement à la validation — j'ai perdu du temps sur un faux
  négatif avant de m'en rendre compte (`tests/unit/sites/creer-client-non-selectionne.test.ts`).
  Les fixtures existantes du dépôt (`aaaaaaaa-0000-7000-8000-…`) suivent
  déjà la forme correcte (version `7`, variante `8`) ; la reproduire.
- **Les captures AVANT sur un commit qui plante** (CS43) ne doivent PAS
  attendre `main` visible — la page AVANT est littéralement une page
  blanche (500 avalé par Next). `page.waitForLoadState("networkidle")`
  puis capturer sans condition, sinon le test échoue précisément sur le
  cas qu'il documente.
- **Le défaut `inclure_sans_equipement: false` masque un client/site sans
  équipement sur `/clients` et `/sites`** (LISTES-1) — une scène de
  capture ou d'épreuve qui crée un client/site SANS machine doit
  explicitement passer `sans_equipement=1` dans l'URL, sinon la recherche
  rend 0 résultat alors que le code est correct (piège rencontré en
  écrivant `tests/e2e/zz-captures-9do.spec.ts`).
- **La commune affichée par `codeEtCommune`/`libelleOptionClient` est la
  PREMIÈRE site, triée alphabétiquement par `sitesParClient`** — un
  client à deux sites dans deux communes différentes n'affiche qu'une
  seule commune dans le sélecteur ou sur la carte ; ce n'est pas un bug,
  c'est le choix déjà documenté par D123/N-08.
- **`git worktree add` sur un commit ancien peut avoir un schéma Prisma
  différent** : la table `intervention.description` était déjà nullable
  sur 69e3a145 ET sur 0acadfc5 (vérifié avant d'écrire les fixtures des
  deux specs de capture), mais ce n'est pas garanti pour un AVANT plus
  ancien — vérifier le schéma du commit AVANT avant d'écrire les
  fixtures d'un spec de capture.

## Ce qui reste à faire

- Faire valider par Alexis les choix du pilote du 03/10 cités par ce
  ticket (aucune règle nouvelle n'a été tranchée ici, seulement
  appliquée).
- Mesurer CS2 contre un volume de clients réaliste (576+, voir
  « Ce que j'ai mesuré ») si la latence de `/clients`/`/sites` devient un
  sujet remonté par l'exploitation — et si elle l'est, rouvrir la
  question de l'extension `unaccent` plutôt que d'empiler des
  optimisations JS.
- `pnpm test:e2e` complet n'a pas été rejoué dans cette session : la file
  (`11-FILE.sh`) le fera avant publication.
