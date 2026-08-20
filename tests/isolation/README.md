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
- `force-rls.test.ts` — `FORCE ROW LEVEL SECURITY` est bien posé sur les quatre
  tables cloisonnées et **absent** des référentiels de plateforme ; une société
  ne s'écrit que sous son propre contexte, y compris depuis le seed.
- `garde-role.test.ts` — le contrôle au démarrage accepte le rôle applicatif et
  refuse le rôle propriétaire de la base.
- `identifiants-uuid.test.ts` — les colonnes d'identifiants sont typées `uuid`
  et les quatre politiques de cloisonnement portent bien le `::uuid` de D4.

Le minimum imposé est de douze scénarios.

## Ajouts du ticket L0-06 — authentification et rôles

- `roles.test.ts` — **un scénario par rôle canonique**, prouvant à chaque fois ce
  que le rôle voit ET ce qu'il ne voit pas. L'énumération PostgreSQL est
  confrontée à l'énumération TypeScript, et `app_est_role_editeur()` au prédicat
  `estRoleEditeur`, sur les dix rôles (neuf avant D37).
- `bascule-societe.test.ts` — un compte habilité sur A ne bascule pas sur B ;
  le rôle est relu en base à chaque bascule ; acceptations **et** refus sont
  journalisés ; le journal des accès est en ajout seul.
- `reporting.test.ts` — le rôle `codiplan_reporting` (D21) lit les deux sociétés
  à la fois, n'écrit rien et n'atteint aucune table de données personnelles ;
  les deux gardes se contredisent sur `BYPASSRLS`, chacun pour son usage.
- `authentification.test.ts` — parcours Better Auth complet contre la vraie base :
  inscription, connexion, second facteur. Il éprouve la table de correspondance
  entre le vocabulaire de Better Auth et les colonnes du schéma, qui ne se relit
  pas mais s'exécute.

## Ajouts du ticket L0-06b — arbitrages consécutifs

- `reponses-indiscernables.test.ts` — **D35**. Les trois refus de l'arbitrage —
  compte inexistant, mot de passe faux, compte sans habilitation — rendent le
  **même message** et répondent dans le **même ordre de grandeur de temps**.
  Mesuré contre la vraie base, sous le rôle applicatif réel : une uniformité
  obtenue sur des doublures ne dirait rien du coût d'un hachage scrypt. Porte
  aussi un témoin positif — un compte habilité entre bien.
- `reporting.test.ts` — **D38**, deux scénarios de plus : `codiplan_reporting` ne
  détient **aucun privilège autre que `SELECT`**, lu dans
  `information_schema.role_table_grants` et non déclaré ; et il en détient bien
  quelque chose, sans quoi le contrôle serait aveugle. Même requête et même règle
  que `scripts/controle-cloisonnement.mts` joue contre la base hébergée.
- `roles.test.ts` et `bascule-societe.test.ts` — **D37** : l'énumération compte
  désormais **dix** rôles, et `admin_societe` est éprouvé comme rôle interne —
  il voit sa société, et il ne modifie pas les référentiels de plateforme (I1).
- `bascule-societe.test.ts` — **D40** : `admin_societe` est refusé sans second
  facteur et accepté avec, sous le rôle applicatif réel. C'est le seul rôle de
  la liste dont la contrainte pèse sur l'utilisateur d'un client, et non sur
  l'un des nôtres (RG-DRO-05).

## Base de test

Les scénarios tournent sur un **PostgreSQL local jetable**, recréé à chaque
exécution et piloté par `TEST_DATABASE_URL` — **jamais Neon**, injoignable en TCP
depuis une session cloud. Les scénarios passent par le rôle applicatif
`codiplan_app` — non propriétaire, non-BYPASSRLS —, celui-là même que crée la
migration `20260820130000_force_rls_role_applicatif` : les politiques RLS mordent
donc réellement, et ce sont les droits de production qui sont éprouvés. Détails et amorçage local :
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
