# 68-DEMANDES-2 — passation

## LES DEUX GESTES DE MISE EN PRODUCTION (c'est Cowork qui les fait)

1. Lancer le workflow GitHub Actions **« DB migrate »**, cible `production`, purge **décochée**, branche `main` —
   seule l'étape 10 (migrate deploy) compte. Une seule migration à appliquer :
   `20260925100000_demandes_2_lien_intervention`.
2. Faire un **« Redeploy »** du déploiement Vercel annulé, **Ignore Build Step laissé coché**.

**L'ordre est celui-ci et pas l'inverse** : le code publié avant la migration casserait la production
(incident du 23/09, RELEASE-1) — la colonne `intervention.demande_id` n'existerait pas encore que
`creerIntervention` tenterait déjà d'y écrire.

---

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

- **Migration** `20260925100000_demandes_2_lien_intervention` : ajoute `intervention.demande_id`
  (UUID, nullable), une clé étrangère composite `(societe_id, demande_id) → demande(societe_id, id)`
  en `RESTRICT`/`RESTRICT` (même forme que `contact_id`, `forfait_deplacement_id`), et un index
  `(societe_id, demande_id)`. Aucune ligne existante modifiée. Le cloisonnement `intervention` n'a
  **rien à changer** : la politique `cloisonnement_parc` (`20260909200000_intervention_l2_planning`)
  ne nomme que `societe_id`/`client_id`/`site_id` — elle juge la ligne, pas une colonne précise —, et
  une colonne neuve sur une ligne déjà couverte est déjà couverte.
- `prisma/schema.prisma` : le champ `demande_id` + sa relation sur `Intervention`, et la face inverse
  `interventions Intervention[]` sur `Demande` (obligatoire pour Prisma, jamais une seconde écriture
  du fait — le lien vit uniquement sur `intervention`).
- `lib/demandes/depot.ts` : `lireDemandePourCreation` — une lecture SOUS CONTEXTE CLOISONNÉ qui rend
  ce qu'`/interventions/nouvelle` a besoin de savoir pour préremplir (site, machine, contact,
  description, urgence), `null` pour une demande hors périmètre ou inexistante (même chose, D50).
- `lib/interventions/saisie.ts` : `schemaCreation` porte désormais `demande_id` (UUID nullable,
  défaut `null`).
- `lib/interventions/depot.ts` : `creerIntervention` accepte `demande_id`. Quand il est donné, la
  demande est relue SOUS LE MÊME CONTEXTE — une demande d'une autre société y est invisible (I1) et
  refuse pareil qu'une demande d'un autre site (même motif, D50) — puis écrite sur la ligne créée.
- `app/(back-office)/interventions/nouvelle/page.tsx` : `?demande=<id>` préremplit le lieu, la
  machine, le contact, la panne et l'urgence depuis la demande (résolue sous contexte, ignorée en
  silence si hors périmètre — même discipline que `?site=`/`?machine=`), et pose `demande_id` en
  champ caché. Une ligne d'aide (« Préremplie depuis une demande d'intervention ») l'indique.
- `app/(back-office)/demandes/[id]/page.tsx` : le lien « Transformer » devient « Créer une
  intervention depuis cette demande → » et pointe vers `/interventions/nouvelle?demande=<id>`. Une
  nouvelle section « Interventions issues de cette demande » liste (référence, badge de statut, lien)
  toutes les interventions dont `demande_id` désigne cette fiche.
- `lib/i18n/fr.ts` : `intervention.refus.demande_invalide`, `intervention.depuis_demande`,
  `demande.interventions_issues.titre`/`.aucune`, le nouveau texte du lien « Transformer », et la
  fixture `demandes.e2e.description_dem2`.
- `app/api/interventions/creer/route.ts` : lit `demande_id` du formulaire et le passe à
  `schemaCreation`.
- **Pour l'exploitation** : un ADV peut désormais partir d'une demande qualifiée et créer
  l'intervention SANS ressaisir le lieu, la machine, le contact, l'urgence ni la panne — et retrouver
  ensuite, depuis la demande, toutes les interventions qui en sont nées (une demande peut en donner
  plusieurs, décision 4 : une intervention = une machine).

## Ce que j'ai mesuré (comptes AVANT/APRES)

- **AVANT** (main 87d49b1, lu) : `intervention` n'a pas de colonne `demande_id` — `grep demande_id
  prisma/schema.prisma` ne rend que la note d'intention dans l'en-tête de `Demande`. Le lien vers
  `/interventions/nouvelle` depuis la fiche d'une demande est nu, sans paramètre, et rien ne relie
  ensuite l'intervention à sa demande.
- **APRÈS** (mesuré par les épreuves neuves) :
  - `tests/isolation/demandes-2.test.ts` (4 tests, tous verts) : une demande du même client/site est
    acceptée et son id écrit dans `intervention.demande_id` ; une demande d'un AUTRE site du même
    client est refusée (`intervention.refus.demande_invalide`) et **rien** n'est écrit (compte avant
    = compte après) ; une demande d'une AUTRE société — invisible sous ce contexte — est refusée
    PAREIL, et rien n'est écrit non plus ; sans `demande_id`, la colonne reste `NULL`.
  - `tests/e2e/demandes-2.spec.ts` (1 test, vert, avec capture) : depuis la fiche d'une demande
    qualifiée, le lien mène à `/interventions/nouvelle?demande=<id>` ; le formulaire arrive
    PRÉREMPLI (site+client, machine, panne, urgence P2) — capturé dans
    `docs/propositions/68-DEMANDES-2/captures/formulaire-prerempli--1280.png` ; après création, la
    fiche de la demande liste **cette** intervention (`Local-DCF616`, badge « À planifier ») —
    capturé dans `fiche-demande-apres--1280.png` ; en base, `intervention.demande_id` égale la
    demande.
  - `pnpm verify` (format, typecheck, lint, 2773 tests unitaires, 1231 tests d'isolation, build) :
    **vert**.
  - `pnpm verify:full` sous `CI=1` (la configuration réelle de la CI et de `11-FILE.sh` —
    `playwright.config.ts` force `workers: 1` sous cette variable) : **vert**, 242 scénarios e2e
    passés, 3 sautés (préexistants, sans rapport avec ce lot).

## Ce que j'ai tranché et pourquoi

- **Aucune modification de la politique RLS d'`intervention`.** Vérifié en lisant
  `cloisonnement_parc` (`20260909200000_intervention_l2_planning`) : elle ne nomme que
  `societe_id`/`client_id`/`site_id`, jamais une colonne précise — la migration l'annonce et le
  reformule dans son en-tête plutôt que de le supposer.
- **La comparaison de site n'est PAS déléguée à la clé étrangère.** La FK garantit seulement que
  `(societe_id, demande_id)` existe ; elle ne dit rien du site. `creerIntervention` relit donc la
  demande et compare `demande.site_id` à `site.id` avant d'écrire — sinon une demande de la même
  société mais d'un autre site aurait pu s'attacher à l'intervention sans qu'aucune règle ne s'y
  oppose.
- **Un seul refus nommé (`intervention.refus.demande_invalide`) pour « autre société » ET « autre
  site ».** Même discipline que `machine_invalide`/`lieu_inconnu` déjà dans ce module : distinguer
  les deux renseignerait sur l'existence d'une demande que le contexte courant ne doit jamais voir
  (D50).
- **Le champ `demande_id` prime les paramètres `?site=`/`?machine=`/`?contact_id=`** sur
  `/interventions/nouvelle` quand il résout, plutôt que l'inverse — le lien depuis une fiche de
  demande porte une intention plus précise qu'un lien générique.
- **`app/api/interventions/creer/formulaire.ts` n'a PAS été touché** : `champsResoumis` ne porte pas
  `demande_id`. Un refus de saisie (cas rare : la panne prérempl​ie vient déjà de la demande, donc
  valide) fait perdre le préremplissage au retour au formulaire — accepté comme dégradation mineure,
  hors du territoire explicitement listé par le ticket (`lib/interventions/saisie.ts` n'y figure que
  pour son champ `demande_id`, `route.ts` est nommé seul).
- **La demande de test e2e est créée directement au statut `qualifiee`** (et non `nouvelle` suivie
  d'un `qualifierDemande`) : le déclencheur `demande_cycle_de_vie` ne garde que les transitions
  (`BEFORE UPDATE`), jamais l'état de naissance — un `INSERT` direct à `qualifiee` n'est donc pas un
  contournement du verrou, juste un raccourci de mise en scène.

## Ce que je n'ai PAS fait

- Aucune règle du cycle de vie des demandes ni des interventions n'a changé — « Transformer » reste
  un geste séparé, inchangé, comme le ticket l'exige.
- Je n'ai pas ajouté de lien retour depuis la fiche d'une intervention vers sa demande d'origine : le
  ticket ne le demandait que dans l'autre sens (demande → interventions).
- Je n'ai pas touché `lib/interventions/depot.ts` au-delà du strict nécessaire pour accepter, vérifier
  et écrire `demande_id` — « Rien d'autre ne change » dans `creerIntervention`.

## Les pièges pour la session suivante

- **`tests/e2e/demandes.spec.ts` comptait TOUTE la société pour son témoin de départ**
  (`client.demande.count({ where: { societe_id } })`), en assumant qu'aucun autre chemin ne pose de
  `demande` dans CODIMA-NC (vrai au 22/09, faux depuis ce lot : `demandes-2.spec.ts` en pose une
  aussi). Sous `pnpm test:e2e` LOCAL sans `CI=1` (`fullyParallel`, plusieurs fichiers en même temps),
  ce témoin peut rougir en course avec la scène de `demandes-2.spec.ts` — mesuré une fois
  (`Expected: 0, Received: 1`). **Corrigé ici** (mise en scène seulement, même famille que le fix de
  `porte-capacites.spec.ts:107` cité dans ce ticket) : le témoin compte désormais
  `client_id: CLIENT_DEMANDES`, sa propre fiche fraîche, jamais la société entière. **Non corrigé** :
  les deux autres assertions du même fichier (`toHaveCount(2)` sur `/demandes`, et « LA FILE EST
  VIDE » qui attend zéro ligne globale) restent, elles, des comptes larges — elles n'ont PAS rougi
  dans mes essais mais pourraient, en local sans `CI=1`, si le calendrier des workers change. Sous
  `CI=1` (la configuration réelle de la CI et de `11-FILE.sh`, `workers: 1`, fichiers séquentiels),
  aucun de ces trois n'est exposé — vérifié, `pnpm verify:full` est vert sous cette variable.
- Toute nouvelle épreuve e2e qui pose une `demande` dans CODIMA-NC hérite du même risque en local sans
  `CI=1`. Si cela devient gênant, la vraie réparation serait de scoper `demandes.spec.ts` à ses deux
  identifiants connus plutôt qu'à un compte global — non fait ici pour rester dans le territoire du
  ticket et ne pas toucher une assertion qui n'a jamais rougi sous la configuration qui compte
  réellement.

## Ce qui reste à faire

- Rien d'identifié dans le périmètre de ce ticket. `pnpm verify` et `pnpm verify:full` (sous `CI=1`)
  sont verts.
