# CODIPLAN — Note de mise en ligne

*Écrite le 08/09/2026, à la demande de l'exploitation. Elle se suit sans réfléchir : chaque valeur dit d'où elle vient, et chaque affirmation d'état a été **mesurée sur ce dépôt**, jamais supposée.*

**Ce document ne configure rien.** Aucun hébergeur n'a été contacté, aucun compte n'a été créé, aucune variable n'a été déposée. C'est une procédure à exécuter par l'exploitation.

**À lire avant tout : le [§5 — Ce qui est risqué à exposer en l'état](#5--ce-qui-est-risque-a-exposer-en-letat).** Ses points ont été mesurés, jamais supposés. **Deux d'entre eux ont été réparés depuis** — l'enfermement du second facteur et l'absence de plancher (L1-02g, D64) — et restent écrits, barrés, pour que celui qui a lu cette note avant le 08/09 constate ce qui a changé. **Le §5.1 tient toujours, et il suffit à lui seul : personne ne peut se connecter.** Mettre en ligne d'abord et lire ensuite ferait découvrir ces points par un utilisateur.

---

## 1 — Les variables d'environnement que l'application EXIGE pour démarrer

Trois, et trois seulement. Elles sont lues **à l'exécution**, jamais à la construction.

| Variable | Rôle | D'où vient la valeur |
| --- | --- | --- |
| `DATABASE_URL` | **La seule connexion que l'application ouvre.** Elle doit porter le rôle `codiplan_app` — ni propriétaire, ni superutilisateur, ni `BYPASSRLS`. | **Déjà dans les secrets du dépôt, sous le nom `DATABASE_URL`.** La même chaîne, telle quelle. |
| `BETTER_AUTH_SECRET` | Signe les cookies de session et **chiffre les codes de secours** du second facteur. | **À engendrer, propre à cet environnement** — au moins 32 octets aléatoires. Il n'existe nulle part aujourd'hui : ce n'est **pas** un secret du dépôt. |
| `BETTER_AUTH_URL` | URL publique de l'application. Better Auth en tire ses redirections et l'attribut `Secure` des cookies. | L'URL **https** que l'hébergeur attribue, sans barre finale. Ex. `https://codiplan.example.com`. |

**Ce que `DATABASE_URL` doit contenir, exactement.**
`postgresql://codiplan_app:<mot de passe>@<hôte Neon>/<base>?sslmode=require`

Le rôle `codiplan_app` est créé par la migration `20260820130000_force_rls_role_applicatif` **sans mot de passe** ; celui qui est en service a été posé à la main hors dépôt, et c'est lui qui est dans le secret `DATABASE_URL`. Il n'y a donc rien à redécouvrir : on recopie le secret.

**Si l'on se trompe de rôle, l'application refuse de servir — et c'est voulu.** `lib/db/garde-role.ts` interroge la base au premier accès cloisonné et rejette une connexion superutilisateur, `BYPASSRLS`, ou propriétaire de la base : sous un de ces rôles, les politiques de cloisonnement ne mordraient pas (I1). Un refus au démarrage vaut mieux qu'un cloisonnement muet.

### Ce qu'il ne faut PAS déposer chez l'hébergeur

| Variable | Pourquoi elle n'y a pas sa place |
| --- | --- |
| `MIGRATION_DATABASE_URL` | Rôle **privilégié**. Il fait le DDL, contourne les politiques par nature. Il vit dans les secrets du dépôt, lu par le seul flux `db-migrate.yml`. L'application ne doit jamais l'avoir sous la main. |
| `REPORTING_DATABASE_URL` | **Clé passe-partout** — `BYPASSRLS`, voit toutes les sociétés (D38). Le rôle n'a pas de mot de passe aujourd'hui et n'en aura pas avant le lot 5. La déposer serait ouvrir une porte dont personne n'a besoin. |
| `TEST_DATABASE_URL` | Base locale jetable des scénarios d'isolation. Sans objet en production. |
| `HORIZON_DATABASE_URL` | Contrôle d'horizon des jours fériés, joué depuis un poste ou la CI. |

`.env.example` mentionne aussi `APP_DATABASE_URL` en commentaire. **Aucun code ne lit cette variable** — vérifié sur l'ensemble du dépôt. C'est `DATABASE_URL` qui porte le rôle applicatif, et rien d'autre.

---

## 2 — Ce qui est déjà dans les secrets du dépôt, et sous quel nom

| Secret | Rôle PostgreSQL | Qui le lit | À recopier chez l'hébergeur ? |
| --- | --- | --- | --- |
| `DATABASE_URL` | `codiplan_app` (applicatif, soumis aux politiques) | `db-migrate.yml` (étape de contrôle du cloisonnement), `ci.yml` (veille nocturne) | **Oui** — c'est la variable n° 1 du tableau ci-dessus. |
| `MIGRATION_DATABASE_URL` | propriétaire (DDL, seed, purge) | `db-migrate.yml` | **Non, jamais.** |

`GITHUB_TOKEN` est fourni par GitHub, il n'a pas à être créé.

**Il n'existe aucun secret `BETTER_AUTH_SECRET`**, ni dans le dépôt, ni ailleurs. Il est à engendrer au moment de la mise en ligne, et à déposer **chez l'hébergeur seulement** — le dépôt n'en a pas besoin : aucun flux de CI ne monte l'authentification contre la base hébergée.

---

## 3 — Ce que l'hébergeur doit savoir, et qui ne se devine pas

| Point | Valeur | D'où elle vient |
| --- | --- | --- |
| Version de Node | **22** | `.nvmrc`, et `engines.node >= 22` du `package.json` |
| Gestionnaire de paquets | **pnpm 10.33.0** — jamais npm ni yarn (CLAUDE.md §2) | `packageManager` du `package.json` |
| Installation | `pnpm install --frozen-lockfile` | même commande que la CI |
| Construction | `pnpm build` (`next build`) | `package.json` |
| Démarrage | `pnpm start` (`next start`), port par `PORT`, 3000 par défaut | `package.json` |
| Framework | Next.js 15, App Router. **Toutes les routes sont dynamiques** — aucune page pré-rendue à la construction | mesuré : la construction rend onze routes, toutes marquées `ƒ (Dynamic)` |

**La construction n'a besoin d'AUCUN secret, et c'est mesuré, pas supposé.** `pnpm build` a été joué le 08/09/2026 avec `DATABASE_URL`, `BETTER_AUTH_SECRET` et `TEST_DATABASE_URL` **retirées de l'environnement**, et le fichier `.env` déplacé : la construction réussit. L'instance d'authentification est construite à la première demande et non au chargement du module, exactement pour cela (`lib/auth/config.ts`). Il est donc inutile — et déconseillé — d'exposer les secrets à l'étape de construction.

`postinstall` exécute `prisma generate`, qui lit le schéma et n'ouvre aucune connexion.

### La commande de construction NE DOIT PAS toucher la base

Ni `prisma migrate deploy`, ni `pnpm db:seed`, ni aucune variante. Ce n'est pas une préférence : **les migrations partent exclusivement du flux `db-migrate.yml`, à la main** (`workflow_dispatch` seul, aucun déclencheur automatique — voir `docs/decisions/2026-08-20-migration-par-github-actions.md`). Un hébergeur qui migrerait à chaque déploiement ferait partir une migration toute seule, ce que ce dépôt refuse par construction.

### La région, et pourquoi elle compte plus qu'ailleurs

La base est chez Neon en **`ap-southeast-2` (Sydney)**. Depuis un exécuteur GitHub, chaque aller-retour coûte **environ 200 ms** — mesuré, c'est l'incident du 23/08/2026 et c'est ce qui a fait échouer le seed en P2028.

**Choisir la région de l'hébergeur au plus près de Sydney.** Une page d'arrivée ordinaire enchaîne plusieurs allers-retours ; à 200 ms l'un, la même page rend en 50 ms ou en 1,5 s selon ce choix, sans qu'une ligne de code change. C'est la décision la plus structurante de cette mise en ligne, et elle se prend une fois.

### Pooler ou hôte direct — le point à trancher, non mesuré

Neon offre deux hôtes : `…-pooler.ap-southeast-2.aws.neon.tech` et le même privé de `-pooler`.

- Les **migrations** utilisent l'hôte **direct** : le pooler ne garantit pas qu'une même connexion serve toute une transaction interactive, et le seed en ouvre une de trente-quatre allers-retours (README, § « Amorçage de la base hébergée »).
- L'**application**, elle, ouvre des transactions **courtes** — deux à quatre instructions —, et un hébergeur sans état en ouvre beaucoup : le pooler est le choix naturel.

**Ce point n'a pas été mesuré contre la base hébergée**, et il ne le sera pas depuis une session cloud (le proxy sortant ne relaie pas le TCP, la base y est injoignable — P1001). Il est donc écrit ici plutôt que tranché. *Ce qui est certain, en revanche* : le cloisonnement ne souffre pas du pooler. Toutes les variables de contexte sont posées avec `set_config(…, is_local => true)`, donc **mortes au `COMMIT` comme au `ROLLBACK`** — mesuré à L1-02c, et c'est précisément la précaution qui rend un pooler sûr. Une variable persistante aurait été lue par la requête suivante, d'un autre utilisateur.

**Si un `P2028` — « Transaction not found » — apparaît après la mise en ligne**, la première chose à vérifier est la présence de `-pooler` dans l'hôte.

---

## 4 — Ce qui, dans le dépôt, suppose de tourner ailleurs qu'en production

Rien de tout cela n'est exécuté par l'application ; tout est déployé comme source. La liste existe pour qu'aucune de ces commandes ne soit branchée sur l'hébergeur « pour bien faire ».

| Ce que c'est | Où cela tourne | Ce qui arriverait si l'hébergeur le lançait |
| --- | --- | --- |
| `prisma migrate deploy`, `pnpm db:seed` | flux `db-migrate.yml`, **à la main** | une migration partie toute seule, sous un rôle sans droits DDL |
| `prisma/seed.ts` | idem | il écrit **des données de démonstration** — deux sociétés, CODIMA-NC et CODIMA-EU |
| `scripts/purge-demonstration.mts` | idem, sur demande explicite | il refuse sans `PURGE_DEMONSTRATION_CONFIRMEE`, mais ce n'est pas une raison de l'exposer |
| `pnpm veille`, `pnpm battement`, `pnpm feries:horizon`, `pnpm audit:partitions` | CI, chaque nuit | rien de grave, mais `veille` ouvre une connexion en lecture seule qui n'a pas sa place dans un service web |
| `tests/`, Playwright, `tests/isolation/` | poste et CI | ils exigent un PostgreSQL **local et jetable** ; un garde-fou refuse une URL Neon |
| `.env.example` | modèle | il ne contient aucune valeur réelle (I9) |

**La base hébergée contient aujourd'hui des données de DÉMONSTRATION**, et rien d'autre. Ce n'est pas un défaut : c'est ce que L0-03 demandait. Mais cela veut dire qu'une mise en ligne rend publiques deux sociétés fictives, pas un produit vide.

---

## 5 — Ce qui est risqué à exposer en l'état

*Demandé franchement, répondu franchement. Les trois premiers points ont été **mesurés** le 08/09/2026 sur la base jetable, sous le rôle applicatif réel, par la chaîne que l'application emprunte.*

### 5.1 — Personne ne peut se connecter. Aucun compte n'a de mot de passe.

**Mesuré :** `prisma/seed.ts` crée des **identités** (`utilisateur`) et des **habilitations** (`utilisateur_societe`, `utilisateur_client`) — il n'écrit **aucune ligne de `compte`**, donc **aucune empreinte de mot de passe**. Aucun des comptes de la base hébergée ne peut donc présenter d'identifiants.

Et il n'existe aucun chemin pour en créer un : *personne ne crée son propre compte, jamais* (D58, L1-02c), `/sign-up` est fermé sur la surface HTTP, et **l'écran d'ouverture administrative d'un compte n'existe pas encore** — L1-02c l'a explicitement laissé hors de son périmètre. Le seul appelant de `auth.api.signUpEmail` aujourd'hui est le harnais de tests.

**Conséquence, dite sans l'adoucir : le site serait en ligne et personne ne pourrait y entrer.** Ce n'est pas une faille — c'est l'inverse — mais c'est une mise en ligne sans usage.

### 5.2 — ~~Un compte qui enrôle son second facteur est ENFERMÉ~~ — RÉPARÉ le 08/09/2026 (L1-02g, D64)

**Ce point est levé.** Il était exact, et c'était le plus coûteux de cette note : un compte enrôlé recevait `401` en présentant le **bon** code, et le code de secours échouait en `409` **après avoir été validé** — aucune porte de sortie, et le cliquet interdisant le retour en arrière.

*La cause était bien celle qui avait été isolée* : la bibliothèque consommait le défi en le désignant par son `id`, qui n'est pas une clé de désignation. La réparation ne touche **aucune politique** — elles exigeaient déjà la bonne seconde moitié ; ce qui manquait était la **pose**. Voir `lib/auth/echange.ts` et D64.

*Mesuré sur la chaîne réelle, sous le rôle applicatif* : le bon code ouvre une session, le code de secours aussi. Le paragraphe est conservé barré plutôt que supprimé — quelqu'un qui a lu cette note avant le 08/09 doit pouvoir constater ce qui a changé.

### 5.3 — Le plancher du second facteur existe désormais, et ce qu'il ne couvre pas

**D62 est fermé.** Dix échecs consécutifs verrouillent le compte quinze minutes ; trois verrouillages enchaînés sans connexion réussie entre eux et le verrouillage **cesse d'expirer**. Mesuré en essayant, pas en lisant : dix codes comparés, puis `429`.

**Ce qui reste à connaître avant d'exposer, et qui est un état atteignable :**

- **un compte parvenu à l'escalade n'a aucun chemin de sortie.** Le ticket de déverrouillage — **L7-04**, `admin_societe` de la société concernée — **n'est pas construit**. L'état s'atteint en trente codes faux. La base laisse déjà passer le geste ; ce qui manque est le droit.
- la limite par **adresse IP** de la bibliothèque (3 requêtes / 10 s sur `/two-factor/*`) reste, elle, **en mémoire du processus** : elle disparaît au redémarrage et n'est pas partagée entre instances. Elle n'est plus la seule protection, mais elle ne compte toujours pas pour un attaquant distribué.
- **s'assurer que `NODE_ENV=production` est bien posé chez l'hébergeur.** `next start` le pose ; une commande de démarrage exotique pourrait ne pas le faire, et cette limite-là serait alors désactivée.


### 5.4 — Un compte habilité sur plusieurs sociétés arrive dans une impasse

Il se connecte, arrive, et ne peut rien lire : le chemin de connexion n'active une société que s'il y en a **exactement une**, et aucun écran ne laisse en désigner une. Sans conséquence aujourd'hui — aucun compte réel n'est dans ce cas — et le premier le sera probablement celui de la direction.

**Constaté et nommé** : `tests/isolation/premier-ecran.test.ts`, section « L'IMPASSE MULTI-SOCIÉTÉ », et ticket **L2-11** au backlog. C'est un rendez-vous, pas une embuscade.

### 5.5 — Deux points d'hygiène, sans mesure derrière eux

- **Servir en https, et poser `BETTER_AUTH_URL` en https.** L'attribut `Secure` des cookies de session en dépend. En http, le jeton de session circule en clair.
- **Le dépôt est privé, et la planification nocturne n'y survit que pour cette raison.** Rendre le dépôt public désactiverait les flux planifiés après 60 jours d'inactivité — voir le README, « ⚠️ Avant de rendre ce dépôt public ». Mettre l'**application** en ligne ne change rien à cela ; rendre le **dépôt** public, si.

---

## 6 — La procédure, dans l'ordre

1. **Trancher le point 5.1.** Tant qu'il tient, la mise en ligne produit un site où personne n'entre : aucun compte de la base hébergée ne porte de mot de passe, et aucun écran n'en ouvre. Lire aussi le 5.3 : un compte parvenu à l'escalade n'a pas encore de chemin de sortie.
2. Choisir la région de l'hébergeur au plus près de **`ap-southeast-2`**.
3. Engendrer `BETTER_AUTH_SECRET` (≥ 32 octets aléatoires) et le déposer chez l'hébergeur **seulement**.
4. Recopier le secret de dépôt `DATABASE_URL` dans la variable `DATABASE_URL` de l'hébergeur. **Ne pas y mettre `MIGRATION_DATABASE_URL`.**
5. Poser `BETTER_AUTH_URL` sur l'URL https attribuée, sans barre finale.
6. Configurer : Node **22**, pnpm **10.33.0**, installation `pnpm install --frozen-lockfile`, construction `pnpm build`, démarrage `pnpm start`. **Aucune commande de base de données dans la construction.**
7. Vérifier que `NODE_ENV` vaut `production`.
8. Déployer, puis ouvrir `/` : la page d'accueil doit s'afficher. Elle ne touche pas la base — c'est le premier signe que le service tourne, pas que la base répond.
9. Ouvrir `/connexion` et soumettre n'importe quoi : le refus doit être **uniforme** (D35). S'il apparaît une erreur de connexion à la base, c'est `DATABASE_URL` ; s'il apparaît un refus de rôle, c'est que la chaîne ne porte pas `codiplan_app`.
