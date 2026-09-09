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
> **Le constat ci-dessous était exact, et il ne l'est plus.** Le même script porte désormais `--reemettre` : il réémet un jeton de premier accès pour une identité **qui n'a jamais servi**, et pour elle seule. Le cliquet lit un FAIT de la ligne de `compte` — `mot_de_passe IS NULL`, l'état dans lequel l'amorçage laisse le moyen de connexion depuis ce jour (l'empreinte du mot de passe jetable est **effacée**, mesuré : l'identité ne se connecte alors avec rien). La première réinitialisation écrit une empreinte, et **la réémission est fermée pour toujours** — mesuré sur la même identité, avant et après, et le jumeau montre qu'elle repasse quand le fait est remis en place. Elle ne rouvre jamais le chemin d'ouverture, ne laisse aucune session, et trace `reemission_premier_acces` dans `journal_acces`. **Ce qu'elle ne sait pas faire :** invalider un jeton précédent encore vivant — deux jetons peuvent donc être valides pendant l'heure du premier. Le paragraphe d'origine est conservé barré, pour qui a lu cette note avant le 10/09.
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
13. **Le taux horaire n'est pas posé par ce geste** — voir le registre du 09/09 (suite), §4. Le montant est arrêté (7 000 XPF HT, D68) et sa date d'effet aussi (la mise en service) ; c'est le MÉCANISME d'écriture qui attend un mot de l'exploitation. Tant qu'aucune ligne de `taux_horaire` n'existe, RG-TAR-04 n'a rien à appliquer et aucune intervention ne se valorise.
