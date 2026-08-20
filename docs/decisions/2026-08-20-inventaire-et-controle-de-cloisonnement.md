# Inventaire à plat et contrôle de cloisonnement sur la base hébergée

## Contexte

Le workflow « DB migrate & seed » se terminait par un décompte unique, pris sous
le rôle de migration, société par société, à travers les politiques de
cloisonnement. Ce décompte confondait deux questions qui n'ont ni la même
réponse ni le même mode d'échec : *que contient la base ?* et *le cloisonnement
tient-il ?* En le prenant à travers les politiques, il mesurait les politiques
à travers elles-mêmes. Une société absente de `prisma/seed-data.ts`, une ligne
rattachée à un identifiant inconnu, une politique devenue trop stricte : le
décompte descendait sans que rien ne le signale, et un total plus bas que prévu
ne se distinguait pas d'un seed plus court.

Deux faits ont rendu la séparation nécessaire. D'abord, la migration
`20260820130000_force_rls_role_applicatif` pose `FORCE ROW LEVEL SECURITY` : le
propriétaire des tables y est soumis comme les autres, un décompte « ordinaire »
sous le rôle de migration est donc filtré. Ensuite, les secrets portent
désormais deux rôles distincts — `MIGRATION_DATABASE_URL` le rôle privilégié,
`DATABASE_URL` le rôle applicatif `codiplan_app` — ce qui rend enfin possible,
depuis l'exécuteur, une observation sous le rôle réellement soumis aux
politiques. Restait l'angle mort le plus large : les tests `tests/isolation/`
tournent sur un PostgreSQL local jetable. Ils éprouvent les migrations écrites,
jamais la base hébergée, ni le rôle réellement déposé dans la configuration du
service. Une politique non appliquée, un `FORCE` manquant, une URL applicative
restée sur le rôle propriétaire : rien de tout cela n'apparaît en local.

## Options écartées

- **Conserver un décompte unique et le durcir.** Quel que soit son soin, un
  décompte pris à travers les politiques ne dit rien sur les politiques. Écarté :
  c'est la confusion elle-même qu'il fallait défaire, pas sa précision.
- **Jouer le contrôle de cloisonnement avec `MIGRATION_DATABASE_URL`.** Simple,
  et sans valeur : le rôle de migration contourne les politiques par nature, il
  ne peut pas témoigner de leur effet. Écarté.
- **Lever `FORCE ROW LEVEL SECURITY` le temps d'une transaction pour compter à
  plat.** Techniquement correct — le DDL est transactionnel, un `ROLLBACK`
  restaure l'état, et aucune autre session ne verrait la levée. Écarté quand
  même : un `COMMIT` involontaire désactiverait durablement l'invariant sur les
  quatre tables cloisonnées, ce qui est un mode de défaillance inacceptable pour
  un script de diagnostic.
- **Publier un décompte filtré en le signalant « partiel ».** Un inventaire faux
  est pire qu'un inventaire absent : il sera lu comme un état de la base.
  Écarté au profit d'un échec franc.
- **S'en remettre aux seuls tests d'isolation.** Ils restent la preuve de
  référence du cloisonnement, mais sur une base locale. Ils ne remplacent pas
  une vérification contre l'hébergé — ils la complètent.
- **Assouplir dès maintenant `lib/db/garde-role.ts` pour accepter `BYPASSRLS`,
  en prévision de D21.** Cela ouvrirait la porte des années avant que le rôle
  concerné existe, et sans rien qui la referme. Écarté ; voir plus bas.

## Choix

Le décompte unique est remplacé par **deux étapes du workflow, deux rôles, deux
motifs d'échec distincts**.

**Un — l'inventaire** (`scripts/inventaire.mts`, sous `MIGRATION_DATABASE_URL`).
Il compte à plat, sans contexte société, et dit ce que la base contient
réellement : une entrée par `societe_id` présent, y compris inconnu du seed.
Comme `FORCE` soumet jusqu'au propriétaire aux politiques, il prend d'abord une
identité exemptée — le rôle connecté s'il porte `SUPERUSER` ou `BYPASSRLS`,
sinon, par `SET LOCAL ROLE`, un rôle exempté dont il est membre (les attributs
de rôle ne s'héritent pas par appartenance : seul `SET ROLE` les met en jeu).
Un candidat doit satisfaire **deux** conditions, et non une : être exempté des
politiques, et avoir le droit de lire les tables. Les deux sont distinctes — un
rôle `BYPASSRLS` qui ne possède pas les tables n'a aucun droit dessus par
défaut, et le retenir échangerait un décompte filtré contre un « permission
denied ». Le point s'est vérifié à l'exécution avant d'être écrit ici.
`SET LOCAL row_security = off` sert de filet : sous ce réglage, PostgreSQL
*refuse* toute lecture qui serait filtrée au lieu de la filtrer en silence. Le
décompte publié est donc non filtré par construction. Si aucune identité
exemptée n'est accessible, l'étape échoue et ne publie rien.

**Deux — le contrôle de cloisonnement** (`scripts/controle-cloisonnement.mts`,
sous `DATABASE_URL`, l'URL applicative). Il refuse de démarrer si cette URL est
absente, si elle est identique à celle des migrations, ou si
`lib/db/garde-role.ts` juge le rôle connecté non soumis aux politiques. Puis il
observe : zéro ligne sur chaque table cloisonnée sans contexte, exactement les
lignes de l'inventaire sous le contexte de chaque société — ni plus, ce qui
serait une fuite, ni moins, ce qui serait une société aveugle à ses propres
données. Les référentiels de plateforme servent de témoin : sans eux, une base
vide produirait les mêmes zéros qu'un cloisonnement parfait.

**Le rôle de migration contourne les politiques par nature, et c'est voulu.** Il
lui faut le DDL, l'écriture du socle et la lecture à plat ; aucune de ces trois
choses n'est compatible avec une soumission aux politiques. Le corollaire est
sans exception : **l'application ne doit jamais s'en servir**. Le repli
`MIGRATION_DATABASE_URL || DATABASE_URL` du workflow a été retiré pour cette
raison — depuis que `DATABASE_URL` porte `codiplan_app`, ce repli aurait fait
tourner les migrations sous un rôle sans droits DDL, et masqué un secret manquant
derrière une erreur sans rapport.

## Conséquences

Le workflow exige désormais que `MIGRATION_DATABASE_URL` soit défini : il n'y a
plus de repli. Il exige aussi `DATABASE_URL`, distinct, sans quoi l'étape de
contrôle échoue — délibérément, pour qu'une configuration incomplète ne puisse
pas se lire comme un cloisonnement vérifié. Sur un hébergeur où le rôle de
migration n'est ni exempté ni membre d'un rôle exempté, l'étape d'inventaire
échoue : c'est une information, pas un accident, et le message nomme le remède.

**Point de rendez-vous avec D21.** L'arbitrage D21 prévoit un rôle
`codiplan_reporting` portant `BYPASSRLS` **par conception**, réservé aux
agrégations multi-sociétés de `lib/reporting`. Or `lib/db/garde-role.ts` refuse
aujourd'hui toute connexion dont le rôle porte cet attribut — règle juste tant
qu'aucun rôle légitime ne le porte, et qui deviendra fausse le jour où ce rôle
existera. Le garde-fou devra alors distinguer non pas des attributs, mais des
**usages** : une connexion applicative cloisonnée, qui continue de refuser
`BYPASSRLS`, et une connexion de consolidation, qui l'exige et que seul
`lib/reporting` peut ouvrir. Ce n'est pas un assouplissement de l'invariant I1 :
c'est la traduction, dans le garde-fou, des trois garde-fous que D21 attache
déjà à ce rôle — `SELECT` seul, journalisation de l'utilisateur d'origine, et un
test d'isolation vérifiant qu'aucun chemin hors `lib/reporting` n'emprunte cette
connexion. Le contrôle de cloisonnement décrit ici devra, lui aussi, rester joué
sous `codiplan_app` et jamais sous `codiplan_reporting`, faute de quoi il
cesserait de prouver quoi que ce soit.
