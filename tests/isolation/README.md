# Tests d'isolation — répertoire sanctuarisé

Porte `pnpm test:isolation`, bloquante à chaque ticket (CLAUDE.md §4, arbitrage D14).

Ce répertoire porte les scénarios de cloisonnement multi-société (ticket
**L0-05**). Il **remplace** le gardien provisoire mis en place à L0-02 (CLAUDE.md
§9), qui ne vérifiait que l'exécution du répertoire.

## Ce qui est vérifié

Lecture, écriture et suppression tentées depuis une autre société, plus les trois
chemins obligatoires de L0-05 :

- `cloisonnement-societe.test.ts` — tables réelles `societe`, `agence`,
  `utilisateur_societe`, `utilisateur_client` : hors contexte → zéro ligne ;
  lecture, `INSERT` (WITH CHECK), `UPDATE`, `DELETE` d'une autre société refusés.
- `referentiels-partages.test.ts` — `devise` lisible par tous ; branche
  `OR societe_id IS NULL` (référentiel plateforme surchargeable, D4).
- `qr-code.test.ts` — résolution d'un `qr_token` d'une **autre société** refusée
  (D22).
- `portail-client.test.ts` — un compte portail ne voit que **son client** et
  respecte son **périmètre de sites** (D10).

Soit seize scénarios (le minimum imposé est douze).

## Base de test

Les scénarios tournent sur un **PostgreSQL local jetable**, recréé à chaque
exécution et piloté par `TEST_DATABASE_URL` — **jamais Neon**, injoignable en TCP
depuis une session cloud. Les scénarios passent par un rôle applicatif restreint
(`codiplan_test_app`, non-owner, non-BYPASSRLS) pour que les politiques RLS
mordent réellement. Détails et amorçage local :
`docs/decisions/2026-08-20-tests-isolation-postgres-local.md`.

```bash
# Exemple local (voir la décision pour démarrer le cluster jetable) :
export TEST_DATABASE_URL='postgresql://postgres@127.0.0.1:5433/codiplan_test'
pnpm test:isolation
```

En intégration continue, un service `postgres` du workflow fournit la base.

**Ne jamais assouplir un test de ce répertoire pour faire passer la
vérification** (CLAUDE.md §5). Si un scénario échoue, c'est le cloisonnement qui
est en défaut.
