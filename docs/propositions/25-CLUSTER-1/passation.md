# CLUSTER-1 — passation

## Ce que j'ai changé

**Avant ce lot**, `scripts/postgres-jetable.sh` portait deux défauts mesurés dans le même
fichier, à quelques lignes d'écart l'un de l'autre :

- il retenait la version PostgreSQL la **plus élevée** installée (une boucle sur
  `/usr/lib/postgresql/*/bin` qui garde la dernière du glob), alors que
  `.github/workflows/ci.yml` épingle `postgres:16` deux fois et que le message d'erreur
  du script lui-même réclamait ce paquet-là — le commentaire au-dessus de la boucle
  disait « en préférant la version la plus élevée installée », en toutes lettres, à
  côté d'un message d'erreur qui disait l'inverse ;
- le répertoire par défaut, `/var/lib/postgresql/codiplan-test`, n'est écrivable que par
  `root` ou le compte système `postgres` — une session ordinaire sans `sudo` échouait
  sur le `mkdir` avec un « Permission denied » qui ne disait pas quoi faire.

**Depuis ce lot** :

- `scripts/postgres-jetable.sh` déclare `VERSION_CIBLE="16"` et ne cherche plus que cette
  version précise parmi ses candidats (`/usr/lib/postgresql/$VERSION_CIBLE/bin`,
  `/usr/local/pgsql/bin`, `/opt/homebrew/opt/postgresql@$VERSION_CIBLE/bin`). Si elle
  n'est pas installée, le script **s'arrête et le dit** — le paquet à installer, et
  `PGJ_BIN` pour forcer une autre version en connaissance de cause — au lieu de se
  rabattre en silence sur une autre. La détection générique par `command -v initdb` a été
  retirée : elle pouvait ramener n'importe quelle version présente dans le `PATH`, sans
  vérification, exactement le repli silencieux que ce ticket interdit.
- Le répertoire par défaut devient `${TMPDIR:-/tmp}/codiplan-postgres-jetable/$PGJ_PORT` :
  écrivable sans privilège, et **namespacé par port** — condition posée par le chantier de
  la file parallèle (un `git worktree` + un cluster + un `PORT` par voie), pour que deux
  voies ne se marchent jamais dessus sans avoir à poser autre chose que `PGJ_PORT`.
- **Un troisième défaut, non prévu par le ticket, trouvé en corrigeant le second.** Un
  répertoire de données accessible sans `root` ne suffisait pas : le paquet PostgreSQL
  d'Ubuntu compile `/var/run/postgresql` comme `unix_socket_directories` par défaut, un
  répertoire que seul le groupe système `postgres` peut écrire. Mesuré sur cette machine
  même, après avoir corrigé le seul répertoire de données : `pg_ctl: could not start
  server` / `could not create lock file
  "/var/run/postgresql/.s.PGSQL.<port>.lock": Permission denied`. Le script pose
  maintenant `unix_socket_directories` sur `$RACINE` lui-même au démarrage, pour que TOUT
  ce que le serveur écrit — données, journal, socket — reste sous un répertoire que la
  session possède.
- `tests/unit/scripts/postgres-jetable-version.test.ts` (7 tests) : le gardien qui lit
  `VERSION_CIBLE` dans le script et `image: postgres:<n>` dans `ci.yml` et refuse qu'ils
  divergent, avec sa contre-épreuve sur des sources fabriquées ; deux épreuves de
  comportement qui fabriquent un arbre de binaires factice via le réglage interne
  `PGJ_RACINE_DEBIAN` (pour ne dépendre d'aucune version réellement installée sur la
  machine qui exécute le test) et vérifient le refus explicite d'un côté, la bonne
  sélection de l'autre ; une épreuve de bout en bout qui fait tourner un VRAI cluster
  (`creer`/`etat`/`arret`) sous la racine par défaut, avec n'importe quel binaire
  PostgreSQL réellement présent sur la machine (`PGJ_BIN`), ignorée si aucun n'existe.
- `docs/decisions/2026-08-20-tests-isolation-postgres-local.md` porte une section datée du
  23/09/2026 qui consigne les trois défauts et leur correction, dans le style des
  addenda déjà présents dans ce document (ex. « révisé le 20/08/2026 »).

**Pour l'exploitation** : les lots arrêtent de perdre du temps à diagnostiquer un rouge de
`test:isolation` qui ne vient pas de leur travail — le script dit maintenant clairement
« PostgreSQL 16 introuvable » au lieu de tourner sur une autre version en silence. Et la
file parallèle demandée par Alexis (une voie = un worktree + un cluster + un port) devient
possible : plusieurs sessions peuvent monter plusieurs clusters jetables sans droits root
et sans se marcher dessus, en ne changeant que `PGJ_PORT` d'une voie à l'autre.

## Ce que j'ai mesuré

- **Sur cette machine même, AVANT correction** : `bash scripts/postgres-jetable.sh etat`
  choisissait silencieusement PostgreSQL 18 (seule version installée ici — `dpkg -l` ne
  montre aucun paquet `postgresql-16`), reproduisant exactement le défaut décrit par le
  ticket. Cette machine est donc un témoin réel du défaut, pas seulement un lecteur du
  code.
- **Après correction, sans `PGJ_BIN`** : le script refuse, avec le message attendu —
  `PostgreSQL 16 introuvable (version épinglée par .github/workflows/ci.yml).` /
  `Installer le paquet postgresql-16,` / `ou indiquer le répertoire des binaires d'une
  AUTRE version dans PGJ_BIN, en connaissance de cause : ...` — code de sortie 1.
- **Après correction, avec `PGJ_BIN=/usr/lib/postgresql/18/bin` (porte de sortie
  explicite) et `PGJ_PORT=5555`** : cycle complet `creer` → `etat` → `arret` réussi, en
  environ 1 s, cluster sous `/tmp/codiplan-postgres-jetable/5555/`, jamais sous
  `/var/lib/postgresql`, socket sous la même racine (confirmé par le contenu du fichier
  `log` avant/après le correctif du socket).
- `pnpm exec vitest run --project unit tests/unit/scripts/postgres-jetable-version.test.ts` :
  **rouge sur le script non corrigé** (3 échecs sur 6 tests, pour les bonnes raisons —
  `VERSION_CIBLE` absent, commentaire contradictoire toujours présent, refus de version
  non observé), **vert après correction** (7/7, l'épreuve de bout en bout comprise).
- `pnpm verify:full`, **EN ENTIER, une seule fois, vert** (exit code 0) :
  `format:check`, `typecheck`, `lint` verts ; `pnpm test` (projet unit) — **238 fichiers,
  2594 tests, tous verts** ; `pnpm test:isolation` — **110 fichiers, 1138 tests, tous
  verts** ; `pnpm build` vert ; `pnpm feries:horizon` vert ; `pnpm audit:partitions` vert
  (13 partitions couvertes, horizon jusqu'à 2027-09) ; `pnpm test:e2e` — **155 passés, 3
  ignorés** (les 3 ignorés sont préexistants, des variantes de routes dynamiques dans
  `tous-les-ecrans-rendent.spec.ts`, sans rapport avec ce lot). Aucune épreuve
  d'isolation n'a échoué : `TEST_DATABASE_URL` de ce poste pointe déjà sur le conteneur
  `codiplan-pg16` (PostgreSQL 16, exactement la version que la CI épingle), donc ni
  `pnpm test:isolation` ni `pnpm test:e2e` ne sont passés par
  `scripts/postgres-jetable.sh` pour cette exécution — le harnais d'isolation lit
  directement `TEST_DATABASE_URL`, le script n'est qu'un moyen de la provisionner. C'est
  documenté dans `docs/decisions/2026-08-20-tests-isolation-postgres-local.md` : le
  script sert à *amorcer* le cluster, il n'est pas dans le chemin de `pnpm test:isolation`
  lui-même.

## Ce que j'ai tranché, et pourquoi

1. **La racine par défaut dépend du `PORT`**, plutôt que de faire de `PGJ_ROOT` la seule
   variable à changer entre deux voies. Le ticket proposait les deux options ; j'ai retenu
   celle où une voie n'a besoin de poser QU'UNE variable (`PGJ_PORT`) pour obtenir un
   cluster et un répertoire isolés des autres — poser `PGJ_ROOT` en plus serait redondant
   avec ce que `PGJ_PORT` détermine déjà, et une voie qui oublierait de le poser
   écraserait celle d'une autre. Avec la dépendance au port, l'oubli est sans risque : deux
   ports différents impliquent déjà deux racines différentes.
2. **`${TMPDIR:-/tmp}` plutôt que `$HOME`** pour la racine par défaut. `/tmp` est
   conventionnellement écrivable par tout compte sans configuration préalable (y compris
   dans un conteneur minimal où `$HOME` peut être absent ou en lecture seule), et son
   caractère éphémère correspond exactement à la sémantique « jetable » du script — une
   base qui ne doit JAMAIS survivre à une coupure de courant ou un redémarrage, ce que
   `$HOME` ne garantit pas.
3. **La détection générique par `command -v initdb` a été supprimée**, pas seulement
   réordonnée après la recherche de la version épinglée. Elle aurait pu ramener
   n'importe quelle version trouvée dans le `PATH` de l'appelant, sans jamais vérifier
   qu'il s'agit de la version épinglée — un second repli silencieux, de la même famille
   que celui que ce ticket répare. `PGJ_BIN` reste l'unique porte de sortie pour une
   version hors des trois chemins standard.
4. **Le réglage `PGJ_RACINE_DEBIAN` n'est pas documenté dans l'en-tête « Réglages » du
   script**, au même rang que `PGJ_PORT`/`PGJ_ROOT`/`PGJ_BASE`/`PGJ_BIN` : c'est un point
   d'entrée technique réservé aux épreuves (fabriquer un arbre de versions sans toucher au
   vrai `/usr/lib/postgresql`), pas un réglage destiné à un usage normal. Il est commenté
   sur sa ligne de déclaration et dans le fichier de test qui s'en sert, pour qu'il ne
   reste pas un readonly magique sans explication.

## Ce que je n'ai PAS fait

- **Je n'ai pas ajouté de mode de test dédié au script** (un `--verifier-seulement` qui
  résoudrait `BIN` sans rien créer) : les épreuves de bout en bout et de refus de version
  passent par le script réel, via `etat` (qui ne crée rien) ou par un cycle
  `creer`/`arret` complet sur un port et une racine jetables. Ajouter un mode dédié
  aurait élargi la surface du script pour un besoin que les épreuves existantes couvrent
  déjà.
- **Je n'ai pas touché `.github/workflows/ci.yml`** — territoire interdit du ticket, lu
  seulement pour en extraire la version épinglée.
- **Je n'ai pas installé PostgreSQL 16 sur cette machine** (pas de `sudo` disponible ici) :
  l'épreuve de bout en bout du script s'appuie sur `PGJ_BIN` pour utiliser la version 18
  réellement installée, ce qui est exactement l'usage que ce réglage est censé couvrir.
- **Je n'ai pas cherché à rendre le script silencieux sur une version PLUS BASSE que
  l'épinglée** ni sur aucune autre situation que « épinglée présente » / « épinglée
  absente » : le ticket ne demandait que ces deux cas, et le comportement pour une version
  strictement supérieure installée EN PLUS de la version épinglée est déjà couvert (le
  script prend l'épinglée si elle existe, quel que soit ce qui existe à côté — testé
  explicitement dans le test « la version épinglée EST installée... sans se rabattre sur
  une autre »).

## Les pièges pour la session suivante

- **`TEST_DATABASE_URL` de ce poste ne passe pas par `scripts/postgres-jetable.sh`.** Le
  conteneur Docker `codiplan-pg16` (port 5433) tourne déjà et `.env` pointe dessus — voir
  la mémoire `poste-alexis-bases-de-test`. Ce lot n'a donc PAS pu observer, sur ce poste,
  un `pnpm test:isolation` qui échouerait faute de PostgreSQL 16 : la preuve que le script
  refuse correctement vient des épreuves unitaires et d'une exécution manuelle isolée
  (`bash scripts/postgres-jetable.sh etat` sans `PGJ_BIN`), pas de `verify:full`
  lui-même.
- **Le script, sans `PGJ_BIN`, refuse désormais sur cette machine.** Quiconque relance
  `scripts/postgres-jetable.sh` sans argument sur ce poste (au lieu d'utiliser le
  conteneur Docker déjà en place) obtiendra le message de refus, pas un cluster — c'est le
  comportement voulu, pas une régression.
- **`PGJ_RACINE_DEBIAN` est un point d'entrée de test, pas un réglage à documenter côté
  utilisateur.** Si un futur lot ajoute un vrai besoin de pointer ailleurs que
  `/usr/lib/postgresql` en usage normal, il faudra le faire monter dans l'en-tête
  « Réglages », pas juste réutiliser cette variable interne telle quelle.

## Ce qui reste à faire

- **Le chantier de la file parallèle lui-même** (un `git worktree` + un cluster + un
  `PORT` par voie) — ce ticket le débloque, il ne l'implémente pas.
- **Aucune épreuve d'isolation n'a été observée en échec après correction sur cette
  machine**, faute de scénario où `TEST_DATABASE_URL` dépendrait réellement du script
  corrigé (voir « pièges » ci-dessus) : la prochaine session qui touche à ce script
  devrait, si elle en a l'occasion, vérifier le comportement sur une machine où
  PostgreSQL 16 est réellement absent ET où `TEST_DATABASE_URL` n'est pas déjà fixée par
  ailleurs.
