# Tests d'isolation sur PostgreSQL local jetable

## Contexte

Les tickets L0-04 (politiques Row Level Security) et L0-05 (scénarios
d'isolation) exigent d'exécuter du SQL contre une vraie base PostgreSQL : une
politique RLS ne se teste pas à vide. Or la base de production est hébergée sur
Neon, et une session Claude Code exécutée dans l'environnement cloud ne peut pas
l'atteindre — le proxy sortant ne relaie que le HTTPS, jamais le TCP du port
5432 (même cause que la migration, `P1001`, voir
`2026-08-20-migration-par-github-actions.md`). Il fallait donc un PostgreSQL
joignable, distinct de Neon, et sûr : les tests créent, modifient et suppriment
des données, et doivent pouvoir repartir d'un état propre à chaque exécution.

## Options écartées

- **Tester contre Neon.** Impossible depuis une session cloud (TCP non relayé),
  et de toute façon proscrit : les tests écrivent et détruisent des données.
  Écarté sans réserve.
- **Simuler RLS sans base (mocks).** Un mock de PostgreSQL ne prouve rien sur le
  cloisonnement réel — c'est précisément l'erreur du gardien provisoire que
  L0-05 remplace (CLAUDE.md §9). Écarté.
- **`prisma migrate reset` pour recréer la base.** Refusé par le garde-fou
  anti-IA de Prisma (« highly dangerous action »), qui exige un consentement
  explicite à chaque exécution — inutilisable dans un harnais automatique.
  Remplacé par un `DROP SCHEMA ... CASCADE` en SQL brut suivi de
  `prisma migrate deploy` (non destructif, idempotent, applique n'importe quel
  SQL, y compris les futurs triggers).

## Choix

Un **PostgreSQL local jetable**, piloté par la variable `TEST_DATABASE_URL`,
**jamais** `DATABASE_URL` (un garde-fou du harnais refuse une URL Neon ou
identique à la production). Le `globalSetup` du projet Vitest « isolation »
recrée intégralement le schéma à chaque exécution (dépose le schéma, réapplique
les migrations, dont celle qui pose les politiques RLS et celle qui crée le rôle
applicatif `codiplan_app` — **non propriétaire, non superutilisateur, non
`BYPASSRLS`**), provisionne les fixtures et amorce deux sociétés fictives. Les
scénarios se connectent sous ce rôle restreint : c'est la seule façon de vérifier
que les politiques mordent réellement, et comme il s'agit du rôle applicatif réel
et non d'un rôle créé pour les tests, ce sont les droits de production qui sont
éprouvés.

En intégration continue, un **service `postgres:16`** (auth `trust`, base
`codiplan_test`) fournit cette base aux jobs `verify` et `verify:full` de
`ci.yml`.

Deux points de mise en œuvre méritent d'être notés :

1. **Type des identifiants** — *révisé le 20/08/2026, correction de revue.*
   Ce document indiquait initialement que les identifiants étaient stockés en
   `text`, ce qui obligeait à écarter le `::uuid` de la forme imposée par D4.
   Les colonnes sont désormais typées `uuid` et le cast est rétabli — voir
   `2026-08-20-identifiants-uuid-natif.md`. Restent deux durcissements, à
   sémantique identique : `current_setting(..., true)` pour que « aucune société
   positionnée » renvoie **zéro ligne** au lieu de lever une erreur, comme
   l'exige le critère d'acceptation, et `NULLIF(..., '')` pour qu'une variable
   vide compte comme absente. Corollaire pratique : dans une requête brute, un
   identifiant passé en paramètre lié doit être casté sur place (`$1::uuid`).
2. **`FORCE ROW LEVEL SECURITY`** — *révisé le 20/08/2026, correction de revue.*
   Ce document indiquait initialement que FORCE n'était pas activé, le
   propriétaire devant écrire le socle sans contexte. La revue de L0-04 a montré
   que cela laissait le filet inopérant pour la connexion applicative par défaut.
   FORCE est désormais activé sur les quatre tables cloisonnées, un rôle
   applicatif non propriétaire est créé par migration, et le seed pose le
   contexte société de chacune de ses écritures. Voir
   `2026-08-20-role-applicatif-et-force-rls.md`. Le harnais d'isolation ne crée
   plus son propre rôle : les scénarios tournent sous `codiplan_app`, le rôle
   applicatif réel.

### Vérification manuelle par mutation (critère L0-05, arbitrage gravité 4)

Un test de mutation automatisé serait disproportionné. La vérification
« retirer un filtre société fait échouer les tests » a donc été faite **une fois,
à la main**, et consignée ici :

> Le 20/08/2026, la politique de `agence` a été temporairement neutralisée
> (`USING (true) WITH CHECK (true)`). `pnpm test:isolation` est passé de 17 verts
> à **6 échecs** (lecture hors contexte, lecture, insertion, mise à jour et
> suppression inter-sociétés). La politique a ensuite été restaurée et la suite
> est repassée au vert. Le filet RLS est donc bien ce qui fait tenir les
> scénarios, et non un hasard de jeu de données.

## Conséquences

Les tests d'isolation tournent partout où un PostgreSQL local est joignable
(session cloud avec cluster local, poste de développement, service CI), jamais
sur Neon. La base étant recréée à chaque exécution, aucun état ne fuit d'une
exécution à l'autre. Ce répertoire **remplace** le gardien provisoire de L0-02
(CLAUDE.md §9). Quand les vraies tables métier arriveront (parc au lot 2, clients
et sites au lot 1), elles devront honorer le même contrat de cloisonnement que
les fixtures « contrat » utilisées ici pour les chemins QR, portail et périmètre
de sites.

### Amorcer le cluster local (session cloud / poste de développement)

*Révisé le 20/08/2026, ticket L0-E : la procédure consignée ici était fausse.*

```bash
scripts/postgres-jetable.sh                     # détruit, recrée et démarre le cluster

export TEST_DATABASE_URL='postgresql://postgres@127.0.0.1:5433/codiplan_test'
pnpm test:isolation
```

Le script accepte aussi `arret` et `etat`, et se règle par `PGJ_PORT`,
`PGJ_ROOT`, `PGJ_BASE` et `PGJ_BIN`. Il est idempotent : le relancer repart d'un
cluster neuf, ce qui est exactement ce qu'on attend d'une base jetable.

**Pourquoi un script, et non la suite de commandes qui figurait ici.** Celle-ci
commençait par `export PATH="/usr/lib/postgresql/16/bin:$PATH"` puis appelait
`su postgres -c "initdb …"`. Or `su` **n'hérite pas du PATH de l'appelant** : il
le réinitialise depuis `/etc/login.defs`, et `/usr/lib/postgresql/16/bin` n'y
figure pas. Les deux commandes échouaient donc sur `initdb: command not found`
— l'`export` de la première ligne n'y changeait rien. Il fallait écrire les
chemins en absolu **à l'intérieur** de la chaîne passée à `su`. Une procédure
fausse coûte plus cher qu'une procédure absente, parce qu'on lui fait confiance
avant de la lire ; versionner le script referme le piège une fois pour toutes,
et le numéro de version de PostgreSQL cesse d'être recopié à la main (le script
retient la plus élevée installée).

Deux points que le script tranche au passage, et qui n'étaient pas écrits :
PostgreSQL refuse de démarrer sous `root`, d'où le détour par le compte système
`postgres` quand la session est privilégiée — et seulement dans ce cas ; sur un
poste de développement où l'on n'est pas `root`, le cluster appartient au compte
courant et aucun `su` n'est nécessaire.
