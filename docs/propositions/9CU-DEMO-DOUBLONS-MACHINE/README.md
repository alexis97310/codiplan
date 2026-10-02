# 9CU-DEMO-DOUBLONS-MACHINE

Aucun écran n'est touché ni créé par ce lot : pas de capture AVANT/APRÈS. Ce
qui suit remplace les captures — la preuve que le script fonctionne,
mesurée sur une base jetable (`postgres-jetable.sh`, cluster
`codiplan-pg16`, port 5433), en rejouant les rôles hébergés plutôt qu'en
mesurant sous le superutilisateur local (voir la recette
« Rejouer les rôles hébergés en local »).

## Mise en place

```
CREATE ROLE doublons_bypass NOLOGIN BYPASSRLS;
CREATE ROLE doublons_owner LOGIN NOSUPERUSER NOBYPASSRLS CREATEROLE NOINHERIT IN ROLE doublons_bypass;
CREATE DATABASE codiplan_doublons_mesure OWNER doublons_owner;

DATABASE_URL="postgresql://doublons_owner@127.0.0.1:5433/codiplan_doublons_mesure" pnpm exec prisma migrate deploy
# → All migrations have been successfully applied.
#   (la migration 20260923130000_parcours_1_creer_puis_planifier passe sur une
#   base neuve, sans doublon — c'est attendu : la pose VALIDÉE de
#   « UNIQUE (intervention_id) » a réussi.)

GRANT SELECT ON ALL TABLES IN SCHEMA public TO doublons_bypass;
GRANT USAGE ON SCHEMA public TO doublons_bypass;

DATABASE_URL="postgresql://doublons_owner@127.0.0.1:5433/codiplan_doublons_mesure" pnpm exec prisma db seed
# le seed échoue plus loin sur `utilisateur` (hors du périmètre de ce lot —
# ce rôle n'a pas les GRANT que `scripts/referentiels-plateforme.mts` et le
# flux « DB migrate & seed » posent d'ordinaire), mais les deux sociétés,
# leurs interventions et leurs machines sont déjà écrites à ce stade — ce qui
# suffit à mesurer ce script.
```

## Fabrication d'un doublon (la constrainte étant déjà posée sur une base neuve)

```sql
ALTER TABLE intervention_machine DROP CONSTRAINT intervention_machine_intervention_id_key;
INSERT INTO intervention_machine (id, societe_id, intervention_id, machine_id, cree_le, modifie_le)
VALUES (
  '0192f0a0-b000-7000-8000-000000000999',
  '0192f0a0-0000-7000-8000-000000000001',
  '0192f0a0-6000-7000-8000-000000000017',
  '0192f0a0-9000-7000-8000-000000000002',
  now(), now()
);
```

État avant nettoyage — 2 lignes pour la même intervention :

```
                  id                  |           intervention_id
--------------------------------------+--------------------------------------
 0192f0a0-b000-7000-8000-000000000001 | 0192f0a0-6000-7000-8000-000000000017
 0192f0a0-b000-7000-8000-000000000999 | 0192f0a0-6000-7000-8000-000000000017
```

## 1. Lecture seule (`appliquer` décoché)

```
$ DATABASE_URL="postgresql://doublons_owner@127.0.0.1:5433/codiplan_doublons_mesure" pnpm exec tsx scripts/nettoyer-doublons-machine-demo.mts

La base ne porte-t-elle que le jeu de démonstration ?
Sociétés écrites par le seed (dépôt) : 0192f0a0-0000-7000-8000-000000000001, 0192f0a0-0000-7000-8000-000000000002
VERDICT : SEED SEUL — 2 société(s) observée(s), toutes du jeu de démonstration.
L'exécution automatique est autorisée.

1 intervention(s) avec un doublon de machine :
  intervention 0192f0a0-6000-7000-8000-000000000017 (société 0192f0a0-0000-7000-8000-000000000001) — garder 0192f0a0-b000-7000-8000-000000000001, retirer 0192f0a0-b000-7000-8000-000000000999

Total à retirer : 1 ligne(s).

Lecture seule : AUCUNE ligne n'a été retirée. Relancer avec APPLIQUER=oui pour appliquer ce plan ; le geste suivant (DB resolve puis DB migrate & seed) attend que ce retrait soit fait.
```

Code de sortie `0`. Vérifié : `SELECT count(*) FROM intervention_machine WHERE intervention_id = '…17'` rend toujours **2** — rien n'a été retiré.

## 2. Application (`appliquer` coché, `APPLIQUER=oui`)

```
$ APPLIQUER=oui DATABASE_URL="postgresql://doublons_owner@127.0.0.1:5433/codiplan_doublons_mesure" pnpm exec tsx scripts/nettoyer-doublons-machine-demo.mts

[… même rapport …]
1 ligne(s) retirée(s).

Témoin : aucune intervention ne porte plus d'une machine.

GESTE SUIVANT, et il n'est pas automatique :
  1. DB resolve (cible démonstration, migration 20260923130000_parcours_1_creer_puis_planifier)
  2. DB migrate & seed (démonstration, reinitialiser_demo décoché)
```

Code de sortie `0`. Vérifié : il ne reste qu'une ligne pour l'intervention `…17`, celle de plus petit identifiant (`…0001`) — exactement celle que le semis actuel pose seule.

## 3. Relance — « aucun doublon »

```
$ DATABASE_URL="postgresql://doublons_owner@127.0.0.1:5433/codiplan_doublons_mesure" pnpm exec tsx scripts/nettoyer-doublons-machine-demo.mts
[…]
Aucun doublon : chaque intervention porte au plus une machine.

GESTE SUIVANT, et il n'est pas automatique :
  1. DB resolve (cible démonstration, migration 20260923130000_parcours_1_creer_puis_planifier)
  2. DB migrate & seed (démonstration, reinitialiser_demo décoché)
```

Code de sortie `0`.

## 4. Preuve que le blocage réel est bien levé

```
$ psql … -c "ALTER TABLE intervention_machine ADD CONSTRAINT intervention_machine_intervention_id_key UNIQUE (intervention_id);"
ALTER TABLE
```

La contrainte que `20260923130000_parcours_1_creer_puis_planifier` pose se repose sans
échouer : plus aucune intervention ne porte deux machines.

## 5. Le cloisonnement n'a jamais été levé

```
$ psql … -c "SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname='intervention_machine';"
       relname        | relrowsecurity | relforcerowsecurity
----------------------+----------------+----------------------
 intervention_machine | t              | t
```

Mesuré **après** l'application du retrait : `FORCE ROW LEVEL SECURITY` est resté actif du
début à la fin. La suppression a été acceptée par la politique `cloisonnement_filiation`
du seul fait que le contexte de société était posé — exactement comme le rôle applicatif
l'aurait vécu.

## 6. Les deux refus

**Société hors du seed** : non reproduit en base fabriquée (l'insertion manuelle d'une
société bute sur une colonne `NOT NULL` propre au schéma, sans rapport avec ce lot) —
mais le chemin est celui, inchangé, de `scripts/refus-si-donnees-reelles.mts`, déjà
éprouvé par `tests/unit/ci/donnees-hors-seed.test.ts`. Non vérifié ici : à noter comme tel.

**Ligne en doublon hors du jeu de démonstration** — mesuré :

```
$ DATABASE_URL="postgresql://doublons_owner@127.0.0.1:5433/codiplan_doublons_mesure" pnpm exec tsx scripts/nettoyer-doublons-machine-demo.mts
[…]
REFUS : la ligne aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa (intervention 0192f0a0-6000-7000-8000-000000000017,
société 0192f0a0-0000-7000-8000-000000000001) ne porte pas un identifiant du jeu de
démonstration (préfixe attendu 0192f0a0-b000-7000-8000-…). Ce n'est plus la démo telle que le semis
la connaît : rien n'est proposé, rien ne sera retiré.
```

Code de sortie `1`. Rien n'a été retiré (vérifié par relecture).

La base et les deux rôles jetables (`codiplan_doublons_mesure`, `doublons_owner`,
`doublons_bypass`) ont été détruits après la mesure.
