# CODIPLAN — Note de mise en ligne

*Écrite le 08/09/2026 à la demande de l'exploitation, **réécrite le 09/09/2026** pour être suivie **depuis un téléphone, par quelqu'un qui n'a jamais ouvert ce dépôt**. Chaque valeur dit d'où elle vient ; chaque affirmation d'état a été **mesurée sur ce dépôt**, jamais supposée.*

**Ce document ne configure rien.** Aucun hébergeur n'a été contacté, aucun compte créé, aucune variable déposée. C'est une procédure à exécuter.

---

## 0 — La procédure en huit gestes, et rien d'autre

*Si vous ne lisez qu'une section, lisez celle-ci. Les suivantes expliquent chaque geste.*

1. **Créer une base PostgreSQL 16** chez l'hébergeur de votre choix, dans la région la plus proche de la Nouvelle-Calédonie.
2. **Créer un compte** chez l'hébergeur d'application et **y rattacher ce dépôt**.
3. **Déposer trois variables** chez l'hébergeur d'application : `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (§1). *Trois, et trois seulement.*
4. **Appliquer les migrations**, une seule commande : `pnpm db:deploy` (§7).
5. **Déployer.** La commande de construction est `pnpm build` ; elle ne touche pas la base.
6. **Ouvrir `/sante`** — sans compte, depuis le téléphone. Elle doit dire **oui** trois fois (§8).
7. **Ouvrir le premier compte réel**, une seule commande (§9). Elle imprime **une fois** une URL de premier accès.
8. **Suivre cette URL**, choisir un mot de passe, activer le second facteur. **Vous êtes en ligne.**

**Les gestes 1, 2, 3 et 7 exigent un compte, un secret ou un paiement : ils vous appartiennent, et personne d'autre ne peut les faire à votre place.**

---

## 0 bis — Quel hébergeur, en une phrase

**Recommandation : Vercel pour l'application, Neon pour la base** — c'est ce que le dépôt suppose déjà (les migrations sont jouées par un flux GitHub Actions qui vise Neon, et `next build` est la commande native de Vercel), donc **c'est le chemin où il reste le moins de choses à découvrir**.

**Ce qui changerait avec un autre :** rien dans le code — l'application est un Next.js standard qui lit trois variables et parle à un PostgreSQL 16 — mais il faudrait **choisir où tourne la tâche planifiée nocturne** (`pnpm veille`, `pnpm audit:partitions`), que GitHub Actions porte aujourd'hui, et **vérifier que la latence vers la base reste tenable** : le seed a déjà échoué une fois pour cette seule raison (§9 du CLAUDE.md, 23/08).

---

---

## 1 — Les variables d'environnement que l'application EXIGE pour démarrer

Trois, et trois seulement. Elles sont lues **à l'exécution**, jamais à la construction.

| Variable | À quoi elle sert | Où trouver sa valeur | **Ce qui casse si elle manque ou est fausse** |
| --- | --- | --- | --- |
| `DATABASE_URL` | **La seule connexion que l'application ouvre.** Elle doit porter le rôle `codiplan_app` — ni propriétaire, ni superutilisateur, ni `BYPASSRLS`. | **Déjà dans les secrets du dépôt, sous le nom `DATABASE_URL`.** La même chaîne, telle quelle. | **Absente ou injoignable : toute page authentifiée rend 500.** Voir le symptôme exact ci-dessous — il ne dit pas « base injoignable », et c'est tout le problème. |
| `BETTER_AUTH_SECRET` | Signe les cookies de session et **chiffre les codes de secours** du second facteur. | **À engendrer, propre à cet environnement** — au moins 32 octets aléatoires. Il n'existe nulle part aujourd'hui : ce n'est **pas** un secret du dépôt. | **Absente : personne ne reste connecté.** La connexion paraît réussir, la page suivante redemande le mot de passe. **Changée après coup : toutes les sessions tombent, et les codes de secours déjà émis deviennent illisibles.** |
| `BETTER_AUTH_URL` | URL publique de l'application. Better Auth en tire ses redirections et l'attribut `Secure` des cookies. | L'URL **https** que l'hébergeur attribue, sans barre finale. Ex. `https://codiplan.example.com`. | **Fausse : la connexion boucle.** Le cookie est posé pour un autre domaine, la redirection ramène à la page de connexion, indéfiniment. |

### LE SYMPTÔME EXACT quand `DATABASE_URL` est fausse, et pourquoi il égare

**Mesuré le 09/09/2026, en développement, avec une `DATABASE_URL` héritée de l'environnement et pointant sur une base injoignable.**

Ce que l'on voit : **`HTTP 500` sur `POST /api/auth/…`**, c'est-à-dire sur la connexion, l'enrôlement, tout. Ce que l'on ne voit pas : le mot « base ». Le journal du serveur, lui, porte `PrismaClientInitializationError` avec le code **`P1001`** et le nom d'hôte.

**Le piège est là, et il coûte cher : le 500 tombe sur une route d'authentification, et il se lit comme un bogue d'authentification.** *Deux réparations ont été tentées du mauvais côté avant qu'on ne regarde le journal.* La règle qui en sort : **devant un 500 sur une route d'authentification, lire le code Prisma AVANT de toucher au code d'authentification** — `P1001` veut dire « la base ne répond pas », et rien d'autre.

**Le second piège, plus discret : une variable déjà présente dans l'environnement l'emporte sur le fichier `.env`.** C'est exactement ce qui s'est produit — le fichier était juste, l'environnement portait autre chose, et le fichier n'a jamais été lu.

**Et si l'on se trompe de RÔLE plutôt que d'hôte, le symptôme est tout autre : l'application refuse de servir, et c'est voulu.** `lib/db/garde-role.ts` interroge la base au premier accès cloisonné et rejette une connexion superutilisateur, `BYPASSRLS`, ou propriétaire : sous un de ces rôles, les politiques de cloisonnement ne mordraient pas (I1), et **toutes les sociétés se verraient entre elles**. Un refus au démarrage vaut mieux qu'un cloisonnement muet.

**Dans les deux cas, `/sante` répond sans compte et dit lequel des deux c'est** (§8). C'est la page à ouvrir en premier.

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

### 5.1 — ~~Personne ne peut se connecter~~ — UN GESTE EXISTE depuis le 09/09/2026 (Q1, D65)

**Le constat était exact, et il ne l'est plus.** `prisma/seed.ts` n'écrit toujours **aucune ligne de `compte`**, donc aucune empreinte de mot de passe, et `/sign-up` reste fermé. Ce qui a changé : **il existe désormais un geste pour ouvrir la PREMIÈRE identité d'une société** — `scripts/amorcage-premier-compte.mts`.

**Ce n'est pas un script qui s'arroge une autorité : c'est la BASE qui admet un cas, et ce cas se détruit en s'exerçant.** La politique d'ouverture de `utilisateur` accepte une identité sans rôle administrateur *si et seulement si* la société visée ne porte **aucune habilitation**. Dès que la première est posée, la même insertion est refusée — mesuré dans les deux sens, et le jumeau montre le refus disparaître quand la branche est retirée.

**Le geste ne pose aucun mot de passe.** Il rend une **URL de premier accès** portant un jeton à usage unique et daté, imprimée une fois.

> #### ⚠️ CE JETON ATTERRIT DANS UN JOURNAL, ET C'EST UNE EXPOSITION ASSUMÉE
>
> Si la commande est jouée depuis un flux GitHub Actions, **l'URL entre dans le journal d'exécution du flux** — c'est-à-dire exactement le genre de journal qu'on voulait éviter. La borne est réelle et elle tient à trois choses, qui doivent être vraies **toutes les trois** :
>
> 1. **le dépôt est privé** — un dépôt public rendrait ce journal lisible de tous ;
> 2. **seule l'exploitation peut déclencher ce flux** ;
> 3. **le jeton est à usage unique**, et il est **daté**.
>
> **Durée de vie mesurée le 09/09/2026, lue en base et non dans la documentation : 1 heure** (`expire_le − cree_le = 00:59:59.999`). C'est le défaut de la bibliothèque ; le dépôt ne le règle pas.
>
> **Une fois le jeton consommé, l'URL du journal n'ouvre plus rien** — un second usage est refusé, mesuré (`tests/isolation/amorcage-premier-compte.test.ts`, « est à usage unique, et il ouvre réellement le compte »).
>
> **Ce qui reste vrai pendant l'heure : la ligne du journal EST une clé.** Qui la lit dans cette fenêtre, avant l'exploitation, ouvre le compte. Si cela ne convient pas, jouer la commande **hors CI** — depuis un poste ayant accès à la base — et le journal n'existe pas.

> #### ⚠️ ~~ET SI L'HEURE PASSE, IL N'Y A AUCUNE VOIE DE RETOUR~~ — UNE VOIE EXISTE depuis le 10/09/2026, et son cliquet est plus étroit
>
> **Le constat ci-dessous était exact, et il ne l'est plus.** Le même script porte désormais `--reemettre` : il réémet un jeton de premier accès pour une identité **qui n'a jamais servi**, et pour elle seule. Le cliquet lit un FAIT de la ligne de `compte` — `mot_de_passe IS NULL`, l'état dans lequel l'amorçage laisse le moyen de connexion depuis ce jour (l'empreinte du mot de passe jetable est **effacée** — parce qu'un compte sans mot de passe ne doit pas en porter un ; **mesuré le 11/09/2026, trois tentatives** : une chaîne quelconque, la chaîne vide et la valeur nulle sont toutes refusées, sans qu'aucune session s'ouvre). La première réinitialisation écrit une empreinte, et **la réémission est fermée pour toujours** — mesuré sur la même identité, avant et après, et le jumeau montre qu'elle repasse quand le fait est remis en place. Elle ne rouvre jamais le chemin d'ouverture, ne laisse aucune session, et trace `reemission_premier_acces` dans `journal_acces`. **Ce qu'elle ne sait pas faire :** invalider un jeton précédent encore vivant — deux jetons peuvent donc être valides pendant l'heure du premier. Le paragraphe d'origine est conservé barré, pour qui a lu cette note avant le 10/09.
>
> Deux scénarios existants le disent, chacun de son côté, et personne ne les avait mis côte à côte :
>
> | Ce qui est mesuré | Où |
> | --- | --- |
> | le **second appel** du geste sur la même société est refusé | « le second appel sur la MÊME société est refusé, lisiblement » |
> | l'instance de **production** ne peut émettre **aucun** jeton | « l'instance de PRODUCTION ne peut émettre aucun jeton » |
>
> Mis ensemble : **jeton expiré ⇒ le compte existe, personne ne peut lui donner de mot de passe, et rien ne peut en émettre un autre.** Le cliquet qui protège l'ouverture condamne aussi l'issue de secours — *c'est l'espèce nommée au §9 le 08/09.*
>
> ~~**Conséquence pratique, et c'est pourquoi la durée n'a PAS été raccourcie :** raccourcir le jeton sans voie de réémission augmente la probabilité de cet enfermement. La question est **inscrite** au registre du 09/09 (suite) avec deux options chiffrées, pas tranchée ici.~~ **Tranché le 09/09 par l'exploitation : la durée reste à une heure, la réémission se construit — elle l'est.**
>
> ~~**En attendant : ouvrir le lien dans l'heure, et ne pas déclencher le geste sans être disponible pour l'utiliser.**~~ Ouvrir le lien dans l'heure reste la bonne habitude ; s'il expire, `--reemettre` en rend un autre tant que personne n'a choisi de mot de passe.

### 5.2 — ~~Un compte qui enrôle son second facteur est ENFERMÉ~~ — RÉPARÉ le 08/09/2026 (L1-02g, D64)

**Ce point est levé.** Il était exact, et c'était le plus coûteux de cette note : un compte enrôlé recevait `401` en présentant le **bon** code, et le code de secours échouait en `409` **après avoir été validé** — aucune porte de sortie, et le cliquet interdisant le retour en arrière.

*La cause était bien celle qui avait été isolée* : la bibliothèque consommait le défi en le désignant par son `id`, qui n'est pas une clé de désignation. La réparation ne touche **aucune politique** — elles exigeaient déjà la bonne seconde moitié ; ce qui manquait était la **pose**. Voir `lib/auth/echange.ts` et D64.

*Mesuré sur la chaîne réelle, sous le rôle applicatif* : le bon code ouvre une session, le code de secours aussi. Le paragraphe est conservé barré plutôt que supprimé — quelqu'un qui a lu cette note avant le 08/09 doit pouvoir constater ce qui a changé.

### 5.3 — Le plancher du second facteur existe désormais, et ce qu'il ne couvre pas

**D62 est fermé.** Dix échecs consécutifs verrouillent le compte quinze minutes ; trois verrouillages enchaînés sans connexion réussie entre eux et le verrouillage **cesse d'expirer**. Mesuré en essayant, pas en lisant : dix codes comparés, puis `429`.

**Ce qui reste à connaître avant d'exposer, et qui est un état atteignable :**

- ~~**un compte parvenu à l'escalade n'a aucun chemin de sortie.**~~ **LEVÉ le 09/09/2026 (L7-04, D66).** `admin_societe` de la société concernée peut déverrouiller, l'acte est journalisé, et il **rend le droit de réessayer, jamais un accès**. La sortie **n'ouvre aucune lecture** sur `second_facteur` : l'écriture ne nomme aucune ligne — un `UPDATE` sans `WHERE` ne lit aucune colonne et échappe donc aux politiques de `SELECT` —, ce qui évitait qu'un déverrouillage devienne une prise de contrôle (l'administrateur y aurait lu le secret TOTP et les codes de secours). Ce paragraphe est conservé barré : qui a lu cette note avant le 09/09 doit pouvoir constater ce qui a changé.
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

1. **Lire le 5.1 en entier avant de jouer le geste d'amorçage** — les deux encadrés surtout. Il n'est plus vrai que personne ne peut entrer : le geste existe. Ce qui reste à savoir tient en deux phrases. *Le jeton entre dans le journal du flux si la commande est jouée en CI, et il y est une clé vivante pendant une heure.* ~~*S'il expire, il n'y a aucune voie de retour.*~~ *S'il expire, `--reemettre` en rend un autre, tant que personne n'a choisi de mot de passe (10/09/2026).* Ne pas le déclencher sans être disponible pour l'utiliser dans l'heure — ou le jouer hors CI, auquel cas le journal n'existe pas.
2. Choisir la région de l'hébergeur au plus près de **`ap-southeast-2`**.
3. Engendrer `BETTER_AUTH_SECRET` (≥ 32 octets aléatoires) et le déposer chez l'hébergeur **seulement**.
4. Recopier le secret de dépôt `DATABASE_URL` dans la variable `DATABASE_URL` de l'hébergeur. **Ne pas y mettre `MIGRATION_DATABASE_URL`.**
5. Poser `BETTER_AUTH_URL` sur l'URL https attribuée, sans barre finale.
6. Configurer : Node **22**, pnpm **10.33.0**, installation `pnpm install --frozen-lockfile`, construction `pnpm build`, démarrage `pnpm start`. **Aucune commande de base de données dans la construction.**
7. Vérifier que `NODE_ENV` vaut `production`.
8. Déployer, puis ouvrir `/` : la page d'accueil doit s'afficher. Elle ne touche pas la base — c'est le premier signe que le service tourne, pas que la base répond.
9. Ouvrir `/connexion` et soumettre n'importe quoi : le refus doit être **uniforme** (D35). S'il apparaît une erreur de connexion à la base, c'est `DATABASE_URL` ; s'il apparaît un refus de rôle, c'est que la chaîne ne porte pas `codiplan_app`.
10. **Ouvrir la première identité** avec `scripts/amorcage-premier-compte.mts` — `AMORCAGE_PREMIER_COMPTE_CONFIRME=oui`, `--societe`, `--email`, `--nom`, `--role`. Relire le 5.1 d'abord. **Utiliser l'URL rendue dans l'heure.**
11. **Vérifier que la porte s'est refermée derrière vous** : rejouer la même commande sur la même société doit être **refusé**, et rouvrir l'URL déjà consommée ne doit **rien** ouvrir. Ce sont les deux seules choses à constater après coup, et elles se constatent en trente secondes.
12. **Si l'URL a expiré avant d'être ouverte** : rejouer le script avec `--reemettre --societe --email`. Il refuse dès qu'un mot de passe existe — si c'est le cas, l'identité a servi, et un mot de passe oublié se traite par le chemin ordinaire, jamais par ce geste. Deux constats après coup : la nouvelle URL ouvre le compte, et la même commande rejouée **après** le choix du mot de passe est refusée.
13. **Le taux horaire n'est pas posé par le geste d'amorçage — il a SON geste**, séparé (décision du 09/09, construit le 10/09) : `TAUX_INITIAL_CONFIRME=oui pnpm tsx scripts/taux-initial.mts --societe <uuid> --montant 7000` — le montant dans l'unité la plus fine de la devise de la société (D68 : 7 000 XPF hors taxes pour CODIMA NC), `--date AAAA-MM-JJ` facultative, à défaut le jour du geste dans le fuseau de la société. **Relire le montant formaté que le script répète** : il refuse ensuite de rejouer, et une erreur d'échelle se corrige par le chemin ordinaire. Tant qu'aucune ligne de `taux_horaire` n'existe, RG-TAR-04 n'a rien à appliquer et aucune intervention ne se valorise.

---

## 7 — Les migrations, une seule commande

```bash
DATABASE_URL="<la connexion du rôle PROPRIÉTAIRE>" pnpm db:deploy
```

`pnpm db:deploy` est `prisma migrate deploy` : il applique **les migrations manquantes, dans l'ordre, sans jamais en réécrire une déjà appliquée** — Prisma le refuse par empreinte, et c'est une garantie, pas une gêne.

**Sur une base NEUVE, il n'y a rien de plus à faire :** la première migration crée le rôle applicatif `codiplan_app`, les suivantes posent les tables, les politiques de cloisonnement et les déclencheurs d'audit.

**Le rôle à employer ici est le PROPRIÉTAIRE, pas l'applicatif.** Une migration fait du DDL ; le rôle applicatif n'en a pas le droit, et c'est exactement ce qu'on veut le reste du temps. C'est le seul geste de toute cette procédure où le rôle privilégié sert.

**Ce que l'on doit voir quand ça marche :** `All migrations have been successfully applied.` **Quand ça rate :** `P1001` si la base ne répond pas, `P3009` si une migration précédente a échoué et doit être résolue à la main.

**Les données de démonstration ne s'installent PAS en production.** `pnpm db:seed` crée deux sociétés fictives ; il n'a rien à faire sur une base réelle.

---

## 8 — `/sante` — ce qu'on doit voir quand ça marche, et quand ça rate

**Ouvrez `https://<votre URL>/sante` depuis le téléphone. Aucun compte n'est demandé.**

| Ligne | Ce qu'elle doit dire | Si elle dit « non » |
| --- | --- | --- |
| **La base de données répond** | oui | `DATABASE_URL` est absente, fausse, ou la base ne répond pas. C'est le `P1001` du §1. |
| **Le rôle de connexion est le bon** | oui | La connexion porte le propriétaire ou un rôle privilégié : **le cloisonnement entre sociétés ne s'appliquerait pas**. À corriger avant toute autre chose. |
| **Les migrations sont à jour** | oui | Elle **nomme la migration manquante**. Rejouez le §7. |
| **Sociétés / Comptes** | **« non lisible d'ici »**, avec sa raison | **Ce n'est pas un défaut, et surtout ce n'est pas un zéro.** Le compte se ferait sous la connexion applicative et sans société active ; les politiques de cloisonnement rendent alors zéro, et *un zéro se lirait « installation vide »* — la conclusion opposée à la vraie. **Que cette page ne puisse pas les compter prouve que le cloisonnement fonctionne.** Pour connaître ces nombres, il faut se connecter. |

**Cette page ne tombe jamais avec ce qu'elle surveille.** Avec une base injoignable, elle s'affiche quand même et répond « non » : *une sonde qui tombe en même temps que ce qu'elle surveille ne surveille rien.* Un scénario l'éprouve en pointant la connexion sur un port où rien n'écoute (`tests/unit/db/sante.test.ts`).

**Et elle ne montre jamais d'adresse, de nom d'hôte, de nom de base ni d'identifiant.** Elle est sans compte, donc lisible par n'importe qui : *un message d'erreur est un canal d'information, soumis au cloisonnement comme une requête* (D50). Le message brut d'un pilote PostgreSQL nomme l'hébergeur et la région ; il est réécrit avant d'arriver à l'écran, et un scénario le vérifie.

---

## 9 — Ouvrir le PREMIER compte réel

Aucun compte n'existe sur une base neuve, et **personne ne peut créer le sien** : dans ce produit, un accès est délivré, jamais réclamé (D58). Le premier compte d'une société s'ouvre par un geste, une seule fois :

```bash
AMORCAGE_PREMIER_COMPTE_CONFIRME=oui \
DATABASE_URL="<la connexion du rôle PROPRIÉTAIRE>" \
pnpm tsx scripts/amorcage-premier-compte.mts \
  --societe <identifiant de la société> \
  --email <votre adresse> \
  --nom "<votre nom>" \
  --role admin_societe \
  --base https://<votre URL>
```

**Ce qu'il imprime, et qu'il n'imprimera jamais deux fois :** une **URL de premier accès**, portant un jeton à usage unique et daté. *Elle n'est relisible nulle part* — ni en base sous cette forme, ni dans un journal. Copiez-la immédiatement.

**Ce qu'il n'imprime pas :** aucun mot de passe. Le geste en tire un au hasard, ne le rend à personne, et le rend inutile en émettant le jeton.

**La porte se referme derrière lui**, et le message le dit : dès que la société porte une habilitation, ce geste refuse de s'exécuter à nouveau. Les comptes suivants s'ouvrent par un administrateur de la société.

**Si le jeton expire ou se perd**, et **seulement pour une identité qui n'a jamais servi**, il se réémet :

```bash
AMORCAGE_PREMIER_COMPTE_CONFIRME=oui \
DATABASE_URL="<la connexion du rôle PROPRIÉTAIRE>" \
pnpm tsx scripts/amorcage-premier-compte.mts \
  --reemettre --societe <identifiant> --email <adresse> --base https://<votre URL>
```

**Ce que l'on doit voir ensuite, en suivant l'URL :** un écran de choix de mot de passe, puis — le rôle `admin_societe` l'exigeant (RG-DRO-05) — **l'activation du second facteur**, qui affiche **une seule fois** une clé et des codes de secours. *Notez-les : un second facteur s'active et ne se retire pas ; seul un administrateur de la plateforme peut le révoquer.* Puis la page d'arrivée, qui nomme votre société.

**Quand ça rate :** un refus lisible qui nomme sa raison — société inconnue, société déjà pourvue d'une habilitation, variable de confirmation absente. Aucun de ces refus n'est silencieux.

