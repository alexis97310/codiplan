# Schéma multi-société

*19 août 2026 — ticket L0-03*

Pose du socle de données : les sept tables du multi-société, la première migration
et le seed de démonstration. Aucune table métier au-delà (client, site, machine,
intervention arrivent aux lots suivants). Sources : cahier des charges chapitre 11,
arbitrages D4, D5, D10, D20.

---

## 1. Périmètre : sept tables, et pas une de plus

**Contexte.** Le ticket borne le schéma à `societe`, `agence`, `devise`, `parite`,
`utilisateur`, `utilisateur_societe`, `utilisateur_client`. Le chapitre 11 en décrit
bien davantage, mais elles relèvent des lots ultérieurs.

**Choix.** Seules les sept tables sont créées. Les colonnes qui pointent vers une
table métier non encore posée — `agence.calendrier_id` (calendrier, L0-08),
`utilisateur_client.client_id` et `perimetre_sites` (client et site, lot 1) — sont
des références **logiques** : colonnes `uuid` sans contrainte de clé étrangère, avec
un commentaire indiquant le ticket qui les câblera. Les seules clés étrangères
réelles pointent vers des tables du présent périmètre (`societe`, `devise`,
`utilisateur`).

**Conséquences.** Le seed peut rattacher un compte portail à un `client_id`
déterministe sans qu'une table `client` existe. La contrainte d'intégrité
référentielle sur `client_id` sera ajoutée quand la table `client` sera posée.

---

## 2. `devise` et `parite` : référentiels de plateforme sans `societe_id` (D4, D20)

**Contexte.** I1 impose `societe_id NOT NULL` sur toute table métier, sauf la liste
close des référentiels de plateforme, dont `devise`. D20 sort la parité de `devise`
vers une table datée `parite`.

**Choix.** `devise` est clé par `code`, sans `societe_id` : le franc Pacifique est le
même partout. `parite` porte `devise_code`, `date_effet`, `taux`, `source`, unique
par `(devise_code, date_effet)` — une parité n'est jamais implicite (I2). Aucune des
deux ne porte `societe_id` : ce sont des référentiels globaux, pas des tables
cloisonnées, et leur régime RLS spécifique relève de L0-04.

**`parite` n'est pas peuplée au seed.** La convention — devise de base et sens du
taux — n'est pas tranchée pour la V1, et le §8 du CLAUDE.md interdit d'inventer un
taux. La table existe ; son amorçage attend le lot reporting, seul autorisé à
convertir (I2, D19).

---

## 3. Identifiants : UUID v7 en application, clés naturelles pour l'idempotence (I10)

**Contexte.** I10 impose un `id` UUID v7, générable sur l'appareil y compris hors
ligne. PostgreSQL 16 n'a pas de générateur v7 natif et Node n'expose que la v4.

**Choix.** Les `id` sont générés côté application par `lib/db/uuid.ts` — une
trentaine de lignes plutôt qu'une dépendance (CLAUDE.md §2). Le seed est rendu
idempotent par `upsert` sur les clés naturelles (`code`, `email`, index uniques
composites) ; l'UUID n'est attribué qu'à la création, jamais régénéré.

**Conséquences.** `pnpm db:seed` peut être rejoué sans créer de doublon. Le
générateur v7 sera réutilisé pour les tables créées hors ligne (machine,
intervention) aux lots suivants.

---

## 4. Migration appliquée et seed non exécutés dans la session de développement

**Contexte.** La session d'exécution n'autorise en sortie que le HTTPS via un proxy ;
le port PostgreSQL (5432) de l'hébergeur n'est pas joignable. `prisma migrate deploy`
et `prisma db seed` échouent donc ici sur un `P1001` (serveur injoignable).

**Choix.** La migration SQL est produite par `prisma migrate diff` et versionnée
sous `prisma/migrations/`, prête à être appliquée par `prisma migrate deploy` dans un
environnement disposant de l'accès base (CI, poste de développement). Le contenu du
seed est couvert par un test unitaire (`tests/unit/seed-data.test.ts`) qui vérifie
les critères d'acceptation sans base : deux sociétés, l'une XPF à trois agences,
l'autre EUR, et un compte portail rattaché à un client.

**Conséquences.** La porte `pnpm verify` — qui ne touche pas la base — valide le
ticket. L'exécution réelle de la migration et du seed reste à confirmer dans un
environnement connecté ; elle ne modifie ni le schéma ni les données décrites ici.
