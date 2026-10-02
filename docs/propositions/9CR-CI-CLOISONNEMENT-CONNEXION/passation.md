# Passation — 9CR-CI-CLOISONNEMENT-CONNEXION

Dépôt `alexis97310/codiplan`, `main` local. Deux commits : `0f100e0` (décrire les
connexions sans secret) puis `1360fd3` (le contrôle attend le réveil de la base).
**Migration : NON.** Rien n'est poussé.

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

Deux ajouts à `db-migrate.yml`, aucun retrait :

1. **Une étape « Décrire les connexions (sans secret) »**, juste avant « Contrôle
   de cloisonnement », qui écrit dans `$GITHUB_STEP_SUMMARY` ce que les deux URL
   (migration et applicative) décrivent — hôte, port, mutualisation (`-pooler`),
   région, base, NOMS des paramètres — sans jamais lire ni recopier l'utilisateur,
   le mot de passe, ou la valeur d'un paramètre. Fonction pure `decrireConnexion`
   (`scripts/lib/decrire-connexion.ts`), script `scripts/decrire-connexions.mts`.
2. **Le contrôle de cloisonnement attend le réveil de la base.** L'URL applicative
   passe par `avecDelaiDeConnexion(url, 30)` (`scripts/lib/delai-connexion.ts`)
   avant toute connexion — `connect_timeout=30` si l'appelant n'en avait pas déjà
   posé un, sinon la valeur existante est conservée telle quelle. Si la première
   tentative de connexion échoue avec le code Prisma `P1001` (base injoignable),
   `controle-cloisonnement.mts` attend 10 s et retente UNE fois ; toute autre
   erreur, ou un deuxième `P1001`, échoue comme avant.

**Pour l'exploitation** : un run qui rougissait sans dire pourquoi dit maintenant,
dans son résumé, si les deux connexions visent le même hôte et si l'une passe par
le point de mutualisation Neon — et il absorbe un réveil de Neon qui dépasserait
les 5 s par défaut de Prisma, sans masquer un rôle réellement refusé ou un
cloisonnement réellement en défaut (ces deux refus restent intacts, avant toute
connexion, exactement comme avant ce lot).

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

**Exemple réel, exécuté en local** (`scripts/decrire-connexions.mts`, URL
fabriquées, aucune base ouverte) :

```
URL_MIGRATION="postgresql://migration-fictif:secret-mig@ep-cool-leaf-a7qb6r2i-pooler.ap-southeast-2.aws.neon.tech:5432/codiplan?sslmode=require"
URL_APPLICATIVE="postgresql://codiplan_app:secret-app@ep-cool-leaf-a7qb6r2i-pooler.ap-southeast-2.aws.neon.tech:5432/codiplan?sslmode=require&connect_timeout=30"

### Connexions décrites (sans secret)

- Migration : hôte `ep-cool-leaf-a7qb6r2i-pooler.ap-southeast-2.aws.neon.tech` (mutualisé, région `ap-southeast-2`), port `5432`, base `codiplan`, paramètres : sslmode
- Applicative : hôte `ep-cool-leaf-a7qb6r2i-pooler.ap-southeast-2.aws.neon.tech` (mutualisé, région `ap-southeast-2`), port `5432`, base `codiplan`, paramètres : sslmode, connect_timeout

Même hôte : oui.
```

Et sur une URL applicative vide (le cas où le secret manquerait) :

```
### Connexions décrites (sans secret)

- Migration : hôte `ep-cool-leaf-a7qb6r2i.ap-southeast-2.aws.neon.tech` (direct, région `ap-southeast-2`), port `5432`, base `codiplan`, paramètres : aucun
- Applicative : URL illisible (vide, absente, ou non analysable).

Au moins une des deux URL est illisible : la comparaison d'hôte n'est pas faite.
```

Ni `migration-fictif`, ni `secret-mig`, ni `secret-app` n'apparaissent dans
aucune des deux sorties — vérifié à l'œil sur cette exécution, et vérifié par le
gardien sur une URL fabriquée du même type (`tests/unit/ci/decrire-connexion.test.ts`).

**`avecDelaiDeConnexion`** (`tests/unit/ci/delai-connexion.test.ts`) : absent → `?connect_timeout=30` ajouté ;
déjà posé à `9` → reste `9`, jamais écrasé par `30` ; `sslmode=require` déjà présent → conservé ;
URL sans `?` → fonctionne quand même.

**`doitReessayer`** : `("P1001", 1)` → `true` ; `("P2002", 1)` et `(undefined, 1)` → `false` ;
`("P1001", 2)` → `false` — un seul nouvel essai, jamais deux.

**Ce qui N'A PAS été mesuré, et qui reste une hypothèse** : que le délai de 5 s par
défaut de Prisma soit RÉELLEMENT la cause des runs #80/#82. Je n'ai pas accès à
l'exécuteur GitHub ni à la base de production ; je n'ai donc pas pu reproduire
l'échec ni confirmer qu'un délai de 30 s et un nouvel essai le corrigent. C'est la
piste la plus probable au vu du message d'erreur (« Can't reach database server »,
caractéristique de `P1001`) et de l'écart de latence déjà mesuré ailleurs dans ce
dépôt vers Neon `ap-southeast-2` (`scripts/lib/veille-delais.ts`, incident du
12/09/2026), mais ce lot la rend seulement VÉRIFIABLE — c'est à Alexis de la
vérifier en rejouant le flux.

## Ce que j'ai tranché, et pourquoi

- **`decrireConnexion` ne fait AUCUNE hypothèse de format d'hôte Neon** : la
  mutualisation se lit sur la terminaison `-pooler` du premier segment, et la
  « région » est simplement le second segment de l'hôte (ex. `ap-southeast-2`),
  pas une liste de régions connues. Une URL qui ne vient pas de Neon (une base
  locale, un autre hébergeur) reste décrite sans lever ni mentir.
- **Le délai de connexion, 30 s** : j'ai repris `ATTENTE_CONNEXION_MS` de
  `scripts/lib/veille-delais.ts`, posée pour la même raison (Neon réveille un
  calcul inactif) sur le même contrôle (base hébergée), plutôt que d'inventer un
  autre chiffre. C'est un choix technique, réversible, et je le dis : rien ne
  prouve que 30 s suffisent toujours, seulement que c'est la valeur déjà
  retenue ailleurs dans ce dépôt pour le même problème.
- **Un seul nouvel essai, et seulement sur `P1001`** : élargir aux trois autres
  codes de liaison de `veille-hebergee.mts` (`P1002`, `P1008`, `P1017`) aurait
  dépassé la demande du ticket, qui nomme `P1001` seul ; je l'ai respectée au
  pied de la lettre plutôt que d'anticiper un besoin non écrit. Si un run futur
  échoue sur l'un des trois autres, la question se repose alors, nommément.
- **Pas de reprise du `errorCode`/`code` de `veille-hebergee.mts`** : j'ai
  réécrit `codePrisma` dans `scripts/lib/delai-connexion.ts` plutôt que
  d'importer celui de `scripts/veille-hebergee.mts`, pour ne pas coupler deux
  scripts dont les listes de codes et les décisions diffèrent (quatre codes et
  un verdict de sécurité/exploitation là, un seul code et une décision de
  retente ici). La duplication est de trois lignes ; le couplage aurait coûté
  plus cher le jour où l'une des deux listes bouge sans l'autre.
- **`$connect()` explicite, avant la première requête** : le script appelait
  déjà `verifierRoleApplicatif(prisma)` comme première opération, qui aurait
  elle-même déclenché la connexion lazy de Prisma. J'ai inséré un `$connect()`
  explicite devant pour isoler PRÉCISÉMENT l'étape qui peut échouer sur `P1001`
  et la seule que je retente — retenter toute la fonction de vérification de
  rôle aurait caché une éventuelle non-idempotence future de cette fonction.

## Ce que je n'ai pas fait

- **Je n'ai joué aucun workflow GitHub**, et je n'ai lu ni écrit aucun secret :
  interdit par la consigne, et je n'y avais de toute façon pas accès. Ce qui
  est vérifié est le texte du flux (gardiens statiques) et les deux scripts
  rejoués en local sur des URL fabriquées.
- **Je n'ai pas reproduit le run #82** : je n'ai ni l'accès à la base de
  production ni à l'exécuteur GitHub Actions. L'hypothèse du délai de réveil
  Neon reste une hypothèse — voir « Ce que j'ai mesuré ».
- **Je n'ai pas touché `scripts/veille-hebergee.mts`** ni ses codes de liaison :
  hors territoire, et la question ne se posait pas — ce script a déjà son
  propre délai de connexion (`DELAIS_VEILLE`) depuis l'incident du 12/09.
- **Aucune capture d'écran** : aucun écran n'est touché (voir le README).

## Les pièges pour la session suivante

- **`tests/unit/ci/cible-de-migration.test.ts` et `migration-automatique.test.ts`
  sont les deux seuls gardiens qui analysent réellement `db-migrate.yml`** (un
  troisième, `verification-apres-deploiement.test.ts`, ne fait que le CITER en
  commentaire — ne pas s'y fier pour une garantie sur ce flux). Les deux lus
  avant d'écrire : ils découpent le flux sur `\n      - ` et cherchent une étape
  UNIQUE par fragment de commande — une nouvelle étape dont la commande
  contiendrait un fragment déjà recherché par un test existant romprait son
  unicité. Vérifié : `pnpm exec tsx scripts/decrire-connexions.mts` ne recoupe
  aucun fragment cherché par ces deux fichiers. Les attentes existantes n'ont
  pas été modifiées, seulement ajoutées (trois nouveaux fichiers de test).
- **`tests/unit/db/inventaire.test.ts:413` vérifie l'ORDRE `seed < inventaire <
  contrôle`**, pas une adjacence stricte : insérer une étape ENTRE l'inventaire
  et le contrôle ne le fait pas rougir, et c'est voulu — mais si une session
  future déplace la nouvelle étape AVANT l'inventaire, ce test reste vert à
  tort pour cette partie-là ; la vraie garantie de position est dans mon propre
  `tests/unit/ci/decrire-connexions-workflow.test.ts`.
- **`new URL()` sur une chaîne `postgresql://` fonctionne** (déjà utilisé dans
  ce dépôt : `scripts/mesure-delais-import.mts:76`) — pas besoin d'un analyseur
  dédié si on touche encore à ce fichier.
- **Le message de nouvel essai passe par `process.stdout.write`, jamais
  `console.log`** : un gardien statique dédié (`tests/unit/ci/controle-attend-le-reveil.test.ts`)
  le vérifie en excluant les lignes de commentaire — la documentation du
  fichier NOMME `console.log` dans sa propre prose, et une recherche naïve
  rougirait sur sa propre note (même famille que `url-hors-journal.test.ts`).

## Ce qui reste à faire

- **Alexis relance « DB migrate & seed », cible production, purge décochée**,
  et lit l'étape « Décrire les connexions (sans secret) » : même hôte ? même
  mutualisation ? Puis le contrôle de cloisonnement lui-même.
- **Si le contrôle reste rouge après 30 s et un nouvel essai** : la piste
  suivante n'est plus le délai mais, à dire et pas à faire ici — soit le réseau
  de Neon (liste d'adresses autorisées, qui pourrait admettre l'exécuteur de
  migration et refuser celui du contrôle si les deux runners sortent par des
  IP différentes), soit l'URL du secret `PRODUCTION_DATABASE_URL` elle-même
  (hôte mutualisé injoignable depuis GitHub pour une raison qui n'est pas un
  délai). La nouvelle étape « Décrire les connexions » donnera, à ce moment,
  de quoi trancher entre les deux sans relire aucun secret.
- **Si l'hypothèse du délai se confirme**, envisager d'appliquer le même délai
  de connexion aux autres scripts qui ouvrent une connexion applicative
  ponctuelle vers la base hébergée en CI (hors territoire de ce lot, et à
  mesurer un par un plutôt qu'à généraliser d'un coup).

## La porte jouée

`CI=1 pnpm verify:full`, en entier, sur `1360fd3` — **EXIT 0** :

| Étape | Résultat |
|---|---|
| `format:check`, `typecheck`, `lint` (`--max-warnings 0`) | sans erreur ni avertissement |
| `test` (unitaires) | **361 fichiers, 3 704 tests passés** |
| `test:isolation` | **140 fichiers, 1 312 tests passés** |
| `build` | compilé |
| `feries:horizon`, `audit:partitions` | passés |
| `test:e2e` | **763 passés, 7 sautés** (30,5 min) |
