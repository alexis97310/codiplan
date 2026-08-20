# Authentification Better Auth, et deux connexions pour deux usages

*Ticket L0-06. Arbitrages D21 (rôle de consolidation), D32 (journal), gravité 4
(énumération canonique des rôles). Invariants I1, I9, I10.*

## Contexte

Le ticket L0-06 demande quatre choses qui, prises ensemble, posent une question
d'architecture : une énumération de rôles à source unique, une authentification
Better Auth dont la session porte la société active, un second facteur
obligatoire sur deux rôles, et le rôle PostgreSQL `codiplan_reporting` de D21 —
`BYPASSRLS`, réservé à `lib/reporting`.

Le point dur est le dernier. `lib/db/garde-role.ts`, livré en correction de revue
de L0-04, refuse **toute** connexion portant `BYPASSRLS`, parce qu'un tel rôle
échappe aux politiques de cloisonnement. D21 exige précisément un rôle qui y
échappe : consolider plusieurs sociétés, c'est lire au-dessus d'elles. Le garde
tel qu'il était écrit rendait donc D21 inapplicable — ou obligeait à l'affaiblir
pour tout le monde.

Deux questions secondaires se posaient dans la foulée : où brancher Better Auth,
qui apporte son propre modèle d'utilisateur alors que le schéma L0-03 en a déjà
un ; et où journaliser les basculements de société, que D32 exige mais que le
`journal_audit` de L0-10 — orienté valeurs avant/après des écritures métier — ne
couvre pas.

## Options écartées

**Assouplir le garde pour tout le monde.** Retirer `BYPASSRLS` de la liste des
attributs disqualifiants aurait rendu D21 possible… et aurait rouvert au service
applicatif la porte que L0-04 venait de fermer. Le garde ne protégeait plus de
rien. Écarté sans hésitation.

**Un seul rôle, `codiplan_app`, avec `SET ROLE` vers un rôle exempté pour les
agrégats.** Techniquement faisable, mais l'exemption devient alors une propriété
du *code* — un appel oublié à `RESET ROLE` et toute la suite de la requête lit
sans cloisonnement, sur la même connexion. La séparation par connexion, elle, ne
peut pas fuir : deux clients Prisma distincts, deux URL distinctes, deux mots de
passe distincts.

**Une table `user` de Better Auth à côté de `utilisateur`.** C'est le chemin par
défaut, et le moins coûteux à écrire. Il installe deux notions d'utilisateur dans
le même dépôt, reliées par l'adresse électronique ; la première divergence n'est
qu'une question de temps, et elle se paiera sur les habilitations. Écarté.

**Ranger les basculements de société dans le futur `journal_audit` (L0-10).**
Ce journal porte les valeurs avant/après d'écritures métier, protégées par
trigger. Un basculement n'est pas une écriture métier, et un basculement
*refusé* n'écrit rien du tout — il n'aurait aucune ligne à décrire. Écarté au
profit d'un journal d'accès distinct.

**Soumettre les tables d'identité au cloisonnement.** Séduisant, mais
l'authentification cherche un compte **avant** de savoir quelle société activer :
une politique société sur `utilisateur` rendrait la connexion impossible, ou
obligerait à une troisième connexion exemptée — plus de surface, pour un gain
nul. Voir « Conséquences ».

## Choix

**Un.** Le garde ne juge plus l'attribut, il juge l'**usage**. `lib/db/garde-role.ts`
expose désormais deux décisions pures et deux vérifications :

| Usage | `BYPASSRLS` | Superutilisateur | Propriétaire | Écriture |
|---|---|---|---|---|
| applicatif (`codiplan_app`) | **interdit** | interdit | interdit | permise |
| consolidation (`codiplan_reporting`) | **exigé** | interdit | interdit | **interdite** |

Les deux jeux d'exigences se contredisent sur `BYPASSRLS`, et c'est le fond de la
décision : un rôle accepté par l'un est refusé par l'autre. Un test unitaire
soumet le même diagnostic aux deux gardes et vérifie ce désaccord — sans quoi
rien ne distinguerait vraiment les deux usages. La contrainte « écriture
interdite » n'est pas déclarative : le diagnostic interroge
`has_table_privilege` sur toutes les tables du schéma, et un seul droit
d'écriture disqualifie.

**Deux.** Deux connexions, `DATABASE_URL` / `APP_DATABASE_URL` d'un côté,
`REPORTING_DATABASE_URL` de l'autre. La seconde n'est ouverte que par
`lib/reporting/connexion.ts`, à la demande. Un test statique parcourt `app/`,
`components/`, `lib/`, `prisma/` et `scripts/` et échoue si un fichier hors de
`lib/reporting/` importe ce module ou nomme sa variable d'environnement — c'est
le garde-fou n°3 de D21, le seul des trois qui ne puisse pas être posé en base.
Les deux autres le sont : `SELECT` seul, accordé nommément sur quatre tables sans
données personnelles, et journalisation de chaque requête avec l'utilisateur
d'origine.

**Trois.** L'énumération des rôles est déclarée **une seule fois**, dans
`prisma/schema.prisma`. La base en tire le type `"Role"`, le client Prisma en
tire l'objet réexporté par `lib/auth/roles.ts`, et tout le TypeScript passe par
lui. Deux gardiens tiennent la promesse : un scénario d'isolation compare les
valeurs du type PostgreSQL à la liste TypeScript, et un test statique interdit
qu'un rôle soit écrit en chaîne libre dans les sources. La règle « seuls les
rôles éditeur modifient les référentiels de plateforme » (I1) est écrite des deux
côtés — fonction SQL `app_est_role_editeur()` et prédicat `estRoleEditeur` — et
un scénario les confronte sur les neuf rôles.

**Quatre.** Better Auth est branché **sur** `utilisateur`. La correspondance des
noms est écrite explicitement dans `lib/auth/config.ts`, champ par champ, et
elle est éprouvée par un parcours complet — inscription, connexion, second
facteur — joué contre la vraie base sous le rôle applicatif réel. Le hash du mot
de passe quitte `utilisateur` pour `compte.mot_de_passe`, là où Better Auth le
range ; `utilisateur.mfa_actif` porte le `twoFactorEnabled` du greffon second
facteur. Les identifiants restent des UUID v7, y compris ceux que Better Auth
crée (I10).

**Cinq.** La session porte `societe_id_active` et `role_actif`. C'est cette
société-là, et aucune autre, qui alimente `app.societe_id` ; c'est ce rôle-là qui
alimente `app.role`. La bascule d'une société à l'autre passe par
`basculerSociete`, qui **relit le rôle en base** — un rôle transmis par
l'appelant serait une habilitation auto-déclarée — et journalise l'acceptation
comme le refus.

**Six.** Le second facteur est obligatoire sur `admin_plateforme` et `direction`
(§12.1, §22.5). Il est tenu à deux endroits, et les deux comptent : Better Auth
n'ouvre pas de session sur le seul mot de passe quand le second facteur est actif
sur le compte ; et `motifRefusContexte` refuse d'ouvrir la moindre transaction
cloisonnée pour un rôle qui l'exige si la session ne le porte pas — ce qui couvre
le cas d'un compte qui ne l'aurait pas encore activé.

## Conséquences

**Trois rôles PostgreSQL, trois usages** : le propriétaire pour les migrations et
le seed, `codiplan_app` pour l'application, `codiplan_reporting` pour la
consolidation. Chaque ajout au périmètre de consolidation est une ligne écrite à
la main dans une migration : `ALTER DEFAULT PRIVILEGES` ne vise que le rôle
applicatif, une table livrée à un lot ultérieur n'est donc **pas** lisible par la
consolidation tant qu'on ne l'a pas décidé. C'est voulu, et c'est le seul réglage
dont l'oubli soit sans danger.

**`BYPASSRLS` peut ne pas être accordable.** Seul un rôle portant déjà l'attribut
peut le conférer, et l'hébergeur n'en garantit pas. La migration tente donc de le
poser et **avertit** au lieu d'échouer : elle ne bloque pas les autres tickets.
En contrepartie, `verifierRoleReporting` refuse la connexion tant que l'attribut
manque — un refus franc, plutôt qu'un agrégat silencieusement tronqué par les
politiques. Marche à suivre côté hébergeur :

1. appliquer la migration avec le rôle propriétaire (workflow « DB migrate & seed ») ;
2. si l'avertissement apparaît dans le journal, ouvrir une session avec un rôle
   portant `BYPASSRLS` et exécuter `ALTER ROLE codiplan_reporting BYPASSRLS;` —
   sur Neon, par le support si la console ne l'expose pas ;
3. attribuer un mot de passe : `ALTER ROLE codiplan_reporting WITH PASSWORD '<secret>';` ;
4. composer `REPORTING_DATABASE_URL` et la déposer hors dépôt (I9).

**Les tables d'identité ne sont pas cloisonnées, et c'est assumé.** `utilisateur`,
`session`, `compte`, `verification`, `second_facteur` ne portent pas de
`societe_id` : elles portent l'identité, pas des données métier. L'authentification
doit d'ailleurs pouvoir chercher un compte avant qu'aucune société ne soit active.
Le cloisonnement porte sur `utilisateur_societe` et `utilisateur_client`, qui
disent **qui est habilité où**, et par lesquelles passe toute décision d'accès :
sans habilitation, aucune société ne s'active, et sans société active rien ne se
lit. Compensation immédiate : la connexion de consolidation n'a aucun droit de
lecture sur ces tables. Le durcissement de la visibilité des comptes entre
sociétés reste à traiter avec la console éditeur (lot 7), où il prend son sens.

**`journal_acces` enjambe les sociétés, par nécessité.** Une bascule refusée de A
vers B ne se range ni sous A ni sous B ; la table ne porte donc pas de
`societe_id NOT NULL` et n'est pas soumise au cloisonnement. C'est un journal
technique, au même titre que `session`, et non une table métier au sens de I1 —
la liste close des référentiels de plateforme n'est pas touchée. Sa protection
est ailleurs : le rôle applicatif y a `SELECT` et `INSERT`, jamais `UPDATE` ni
`DELETE`. Sans droit de réécriture, il n'y a rien à protéger par trigger.

**Le harnais d'isolation n'accorde plus de droits en bloc.** Il accordait
`SELECT, INSERT, UPDATE, DELETE ON ALL TABLES` au rôle applicatif, ce qui lui
rendait ce que les migrations lui retirent — le droit d'effacer le journal, par
exemple. Il n'accorde désormais que les tables fixtures ; les tables réelles
tiennent leurs droits des migrations, et d'elles seules. Les scénarios éprouvent
donc les droits de production, pas ceux du harnais.

**Trois dépendances de plus** : `better-auth` (imposé par la stack), son greffon
`two-factor` (inclus dans le paquet), et `zod` (imposé pour toute entrée
serveur). Aucune autre.

---

## Suite — ce que le ticket L0-06b a corrigé

La note d'arbitrage n°2 (20 août 2026) reprend quatre points laissés ouverts ici,
et les tranche. Ce document reste le récit de L0-06 ; il n'est pas réécrit, mais
il ne fait plus foi seul sur ces quatre points :

- **D34** — « les tables d'identité ne sont pas cloisonnées, et c'est assumé »
  devient une **catégorie explicite de I1**, fermée et énumérée : `session`,
  `compte`, `verification`, `journal_acces`. La colonne `societe_id_precedente`
  est renommée `societe_id_source` et forme, avec `societe_id_cible`, un couple
  **informatif** qui ne filtre jamais.
- **D35** — l'identité globale devient une décision explicite, et les refus
  d'authentification deviennent **indiscernables**. Voir
  `2026-08-20-identites-globales-et-reponses-indiscernables.md`.
- **D36 et D38** — `BYPASSRLS` est bien accordé sur notre hébergement, mais le
  repli portable reste obligatoire, et les privilèges du rôle de consolidation
  sont désormais **contrôlés à chaque migration**. Voir
  `2026-08-20-consolidation-repli-portable.md`.
- **D37** — l'énumération des rôles passe à **dix** : `admin_societe` s'ajoute.
  Le point « la colonne Admin est celle d'`admin_plateforme` », défendu plus
  haut, est **renversé** : elle est de portée société et revient à
  `admin_societe`. L'argument d'alors — « une capacité ne donne accès à rien tant
  qu'aucune société n'est active » — restait vrai, mais il répondait à côté :
  le problème n'était pas la fuite, c'était qu'ouvrir un compte chez un client
  aurait exigé un salarié de l'éditeur.
