# 73-DEMANDES-2-REPRISE — passation

## LES DEUX GESTES DE MISE EN PRODUCTION (c'est Cowork qui les fait)

1. Lancer le workflow GitHub Actions **« DB migrate »**, cible `production`, purge **décochée**, branche
   `main` — seule l'étape 10 (migrate deploy) compte. Une seule migration à appliquer (inchangée depuis
   68) : `20260925100000_demandes_2_lien_intervention`.
2. Faire un **« Redeploy »** du déploiement Vercel annulé, **Ignore Build Step laissé coché**.

**L'ordre est celui-ci et pas l'inverse** : le code publié avant la migration casserait la production
(incident du 23/09, RELEASE-1) — la colonne `intervention.demande_id` n'existerait pas encore que
`creerIntervention` tenterait déjà d'y écrire.

---

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

- **Fusionné `68-DEMANDES-2-garde` sur `main`** (un seul commit, `fb96d63`, fusion sans conflit hors
  `lib/i18n/fr.ts` auto-résolu par git). Le contenu métier est exactement celui décrit dans
  `docs/propositions/68-DEMANDES-2/passation.md` (lien créer-intervention-depuis-une-demande, préremplissage,
  section « Interventions issues de cette demande », migration `intervention.demande_id`) — rien n'y a
  été changé.
- **`tests/e2e/demandes.spec.ts:200`** (le scénario « LA FILE montre les deux demandes ») : la locator
  `tr[data-demande]`, qui comptait TOUTE la file ouverte de CODIMA-NC, est scopée aux deux identifiants
  que ce fichier a lui-même forgés (`tr[data-demande="<ANCIENNE>"], tr[data-demande="<RECENTE>"]`).
  L'assertion métier — exactement ces deux-là, l'ANCIENNE avant la RÉCENTE dans le DOM — est inchangée.
  C'est la seule ligne de code touchée dans ce lot.
- **Aucun changement de comportement** livré par 68 : ni `lib/`, ni `app/`, ni le schéma, ni la
  migration n'ont bougé au-delà de cette fusion.
- **Pour l'exploitation** : rien de neuf par rapport à 68 — un ADV peut créer une intervention depuis
  une demande qualifiée sans ressaisir lieu/machine/contact/urgence/panne, et retrouver depuis la
  demande les interventions qui en sont nées. Ce lot ne fait que rendre ce travail republiable après
  le recalage du 25/09.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- **AVANT** (constat du ticket, 25/09 08h35) : `pnpm test:e2e` recalé deux fois de suite sur
  `tests/e2e/demandes.spec.ts:200` — attendu 2 lignes, reçu 3 (la 3e étant la demande forgée par
  `demandes-2.spec.ts`, ouverte en parallèle dans la même société).
- **Après la fusion, avant le correctif** : `pnpm typecheck` a d'abord échoué (5 erreurs
  `demande_id` inconnu sur `InterventionWhereInput`/`InterventionCreateInput`/`InterventionSelect`) —
  le client Prisma généré dans ce clone datait d'avant le merge. Un `prisma generate` (aucune migration
  jouée, uniquement la régénération du client à partir du `schema.prisma` déjà fusionné) a suffi :
  `pnpm typecheck` est ensuite passé sans erreur.
- **`prisma migrate diff --from-migrations --to-schema-datamodel`**, joué sur une base fantôme dédiée
  (`codiplan_test_shadow_diff`) : comparé ligne à ligne entre l'état d'avant la fusion (87d49b1,
  migrations + schéma extraits à part, sans toucher au dépôt) et l'état d'après. **Diff strictement
  identique dans les deux cas (0 ligne d'écart entre les deux sorties)** — la migration de 68 n'introduit
  aucun écart nouveau entre les migrations et `schema.prisma`. Le solde affiché par la commande
  (renommages de clés étrangères et d'index, colonnes `cree_le`/`modifie_le` avec une valeur par défaut
  différente de celle que Prisma introspecterait) est un écart **préexistant et sans rapport avec ce
  lot** — il vient de la convention de nommage explicite du dépôt (les migrations SQL nomment les
  contraintes elles-mêmes) et de colonnes gérées par déclencheur plutôt que par défaut de colonne.
- Dossier de migration : `find prisma/migrations -iname '*demandes_2*'` ne rend qu'un seul dossier,
  `20260925100000_demandes_2_lien_intervention` — pas de doublon.
- `pnpm exec prettier --check tests/e2e/demandes.spec.ts` : vert.
- `CAPTURES_DEMANDES_2=docs/propositions/73-DEMANDES-2-REPRISE/captures pnpm exec playwright test
  tests/e2e/demandes-2.spec.ts` (joué seul, 1 worker) : **1 passed**. Trois captures régénérées dans
  `docs/propositions/73-DEMANDES-2-REPRISE/captures/` : `fiche-demande-avant--1280.png`,
  `formulaire-prerempli--1280.png`, `fiche-demande-apres--1280.png`, plus `mesure.json`.
- **`CI=1 pnpm verify:full`, en UN appel, au premier plan** : format, typecheck, lint, tests unitaires,
  tests d'isolation, build, horizon des fériés, partitions du journal d'audit, puis `test:e2e` sous
  `workers: 1` (la configuration réelle de `11-FILE.sh`) — **246 scénarios, 243 passés, 3 sautés**
  (les mêmes trois sautés que la mesure de 68, préexistants, sans rapport avec ce lot). **Vert de bout
  en bout.**

## Ce que j'ai tranché et pourquoi

- **Seule la ligne 200 (et les deux locators qu'elle introduit, 206-211) a été touchée.** J'ai relu
  tout `demandes.spec.ts` et `demandes-2.spec.ts` à la recherche de toute autre lecture non filtrée de
  `tr[data-demande]` ou de tout compteur large de la file, comme le demandait le ticket :
  - Ligne 356 (« LA FILE EST VIDE ET LE DIT ») lit elle aussi `tr[data-demande]` sans filtre. **Je ne
    l'ai PAS touchée** : son intention métier n'est pas « nos deux demandes ont disparu » (ça, c'est
    déjà couvert par les locators filtrés des lignes 275 et 345, inchangés) mais « la file, vue par
    TOUTE la société, est vide et l'affiche » — `app/(back-office)/demandes/page.tsx:146` conditionne
    le message `demandes.vide` à `file.length === 0`, où `file` est `demandesOuvertes` sur toute
    CODIMA-NC. Scoper cette lecture à nos deux identifiants changerait ce qu'elle prouve, ce que le
    ticket interdit (« aucune assertion métier changée »). Sous `CI=1` (workers:1, fichiers exécutés
    l'un après l'autre jusqu'à leurs hooks `afterAll` compris — vérifié dans ce lot, aucune interférence
    mesurée), ce test n'est pas exposé à la même course que la ligne 200 : c'était déjà la conclusion de
    la passation de 68, reconfirmée ici par un `verify:full` vert sous `CI=1`.
  - `demandes-2.spec.ts` ne lit jamais `/demandes` (la file) ni `tr[data-demande]` sans filtre — ses
    seules lectures de liste portent sur `[data-intervention-issue="…"]`, sur SA PROPRE fiche de
    demande. Rien à y scoper.
- **`prisma generate` avant tout, sans rejouer de migration** : le ticket demandait de vérifier l'absence
  d'écart, pas de faire tourner une migration supplémentaire. La régénération du client ne touche à
  aucune base ; elle aligne uniquement le typage TypeScript sur le `schema.prisma` déjà fusionné.
- **La base fantôme utilisée pour `migrate diff`** (`codiplan_test_shadow_diff`, `codiplan_test_shadow_diff2`)
  a été créée puis détruite dans ce lot, sur le PostgreSQL de test local (`127.0.0.1:5433`) — jamais
  sur une base d'exploitation, jamais gardée après la mesure.

## Ce que je n'ai PAS fait

- Aucune ligne de `lib/`, `app/`, `prisma/schema.prisma` ou de migration n'a été touchée — tout le
  contenu métier de 68 est repris tel quel.
- Aucune ligne de semis (`prisma/seed*.ts`) n'a été ajoutée ou modifiée.
- Aucun `skip`/`fixme`/`retries`/`workers: 1` ajouté dans `playwright.config.ts` ou dans les specs.
- La ligne 356 de `demandes.spec.ts` (« LA FILE EST VIDE ») n'a pas été retouchée — voir « Ce que j'ai
  tranché et pourquoi » : sa scoper aurait changé son assertion métier, ce que le ticket interdit.
- Le conflit n'a pas eu lieu deux fois : le scénario visé n'a été rejoué qu'une seule fois seul
  (`-g`), puis une fois dans le `verify:full` complet — les deux verts. La clause « deux rouges et tu
  t'arrêtes » ne s'applique pas ici.

## Les pièges pour la session suivante

- **Après une fusion qui touche `prisma/schema.prisma`, lancer `prisma generate` avant `pnpm
  typecheck`** — sinon le client Prisma du clone reste celui d'avant la fusion et `demande_id` paraît
  inconnu du typage alors que le schéma est déjà juste. Ce n'est pas une erreur de code, c'est un
  artefact d'outillage local ; ne pas la confondre avec une vraie régression.
- **`prisma migrate diff --from-migrations --to-schema-datamodel` a besoin d'une base fantôme déjà
  créée** (`CREATE DATABASE` manuel) — la commande échoue sinon avec `P1003`, sans la créer elle-même.
  Penser à la détruire ensuite (fait ici : `codiplan_test_shadow_diff` et `…_diff2` supprimées en fin
  de mesure).
- **Le solde affiché par `migrate diff` sur ce dépôt n'est jamais à zéro** — des dizaines de
  renommages de contraintes/index et quelques colonnes à valeur posée par déclencheur plutôt que par
  défaut de colonne. C'est un écart de longue date entre la convention de nommage du dépôt et celle que
  Prisma introspecterait ; comparer le solde AVANT/APRÈS une fusion (comme fait ici) plutôt que de
  viser un solde nul est la bonne façon de juger si UNE migration donnée a introduit un écart.
- Le risque documenté par 68 sur les deux autres compteurs larges de `demandes.spec.ts` (celui de la
  ligne 356 ici, et le témoin de `beforeAll` déjà scopé par 68 au client `CLIENT_DEMANDES`) reste
  entier en local SANS `CI=1` (`fullyParallel`, plusieurs fichiers concurrents) — non exposé sous la
  configuration qui compte réellement (`CI=1`, `workers: 1`, celle de `11-FILE.sh`), donc non corrigé
  ici, par discipline de périmètre.

## Ce qui reste à faire

Rien d'identifié dans le périmètre de ce ticket. `pnpm verify:full` est vert sous `CI=1`, la migration
de 68 est présente une seule fois, et `prisma migrate diff` ne montre aucun écart nouveau.
