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

## Ajouts du ticket L0-10 — journal d'audit

- `journal-audit.test.ts` — **I8, D32, D50**, en quatre temps.
  **L'écriture n'est pas facultative** : toutes les écritures du fichier passent
  par du SQL brut, hors de tout modèle Prisma — le chemin le plus hostile —, et
  laissent la même ligne qu'une écriture applicative ; le jumeau **retire
  réellement le déclencheur** pour montrer que c'est bien lui qui écrit.
  **L'ajout seul** : les privilèges sont lus dans `information_schema` avec la
  requête que joue `scripts/controle-cloisonnement.mts` contre la base hébergée,
  `UPDATE` et `DELETE` sont refusés sous le rôle applicatif, et l'épreuve par
  retrait se fait **en deux temps** — le privilège rendu, la politique mord
  encore (zéro ligne réécrite) ; les deux verrous retirés, la réécriture passe.
  **La lecture est cloisonnée, et par rôle** : une société ne voit pas le journal
  d'une autre, et dans sa propre société seuls `admin_societe` et `direction` le
  lisent (matrice §5.2).
  **Les habilitations sont couvertes** (D52) : accorder un droit, l'escalader
  d'`adv` à `admin_societe`, puis le retirer laisse à chaque fois sa ligne —
  avec l'auteur, le bénéficiaire et le rôle d'avant. C'est ce qui rend
  vérifiable la procédure de déblocage de D40 (L7-01).
  **Le périmètre est tenu par la base** : poser le déclencheur sur un référentiel
  de plateforme fait échouer la première écriture, avec un refus _lisible_ sans
  être _informatif_ (D50) — le scénario vérifie qu'il ne nomme aucune société.

- `journal-audit-partitions.test.ts` — **L0-10**, ce que le partitionnement
  change. La table est bien `PARTITION BY RANGE` et sa clé primaire porte
  l'horodatage ; les écritures sont routées vers la partition du mois ; **aucune
  partition ne laisse au rôle applicatif le moindre privilège** et toutes forcent
  RLS — **les deux drapeaux**, `FORCE` sans `ENABLE` laissant les politiques
  inappliquées. Le jumeau rend à une partition les privilèges par défaut et lui
  retire RLS — exactement ce qu'un `CREATE TABLE … PARTITION OF` nu aurait
  laissé — et montre qu'alors la société A **lit et réécrit** les lignes d'audit
  d'une autre société en nommant la partition. Le contrôle permanent de
  `controle-cloisonnement.mts` est joué ici sur la même requête, et éprouvé sur
  une partition **réellement créée nue**, puis sur une partition à moitié
  durcie, puis sur une partition produite par la fonction du dépôt — refus,
  refus, acceptation. Un second jumeau retire la partition par
  défaut et montre que l'écriture hors plage est **refusée**, ce qui ferait
  échouer l'écriture métier. Enfin, les deux contrôles datés sont éprouvés sur la
  base réelle, et leur **indépendance** avec : l'horizon amputé fait mordre le
  préventif pendant que le détectif reste vert, une ligne rangée par défaut fait
  l'inverse.

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
