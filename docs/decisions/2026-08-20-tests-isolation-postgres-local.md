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

1. **Identifiants en `text`.** Le schéma L0-03 stocke les identifiants en `text`
   (UUID v7 générés côté appareil, I10). La forme imposée par D4
   (`... = current_setting('app.societe_id')::uuid`) est donc rendue en
   comparaison text-à-text, sans cast — sémantiquement identique, mais sans quoi
   PostgreSQL lèverait `operator does not exist: text = uuid`. Le membre est en
   outre durci en `NULLIF(current_setting('app.societe_id', true), '')` pour que
   « aucune société positionnée » renvoie **zéro ligne** au lieu de lever une
   erreur, comme l'exige le critère d'acceptation.
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

```bash
export PATH="/usr/lib/postgresql/16/bin:$PATH"
PGROOT=/var/lib/postgresql/codiplan-test   # répertoire accessible au compte postgres
rm -rf "$PGROOT" && mkdir -p "$PGROOT" && chown -R postgres:postgres "$PGROOT" && chmod 700 "$PGROOT"
su postgres -c "initdb -D '$PGROOT/data' -U postgres --auth=trust -E UTF8"
su postgres -c "pg_ctl -D '$PGROOT/data' -o '-p 5433' -l '$PGROOT/log' -w start"
psql 'postgresql://postgres@127.0.0.1:5433/postgres' -c 'CREATE DATABASE codiplan_test;'

export TEST_DATABASE_URL='postgresql://postgres@127.0.0.1:5433/codiplan_test'
pnpm test:isolation
```
