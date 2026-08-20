-- CODIPLAN — Arbitrages consécutifs à L0-06 (ticket L0-06b).
--
-- Trois changements, tous issus de la note d'arbitrage n°2 :
--
--   D34 — `journal_acces.societe_id_precedente` devient `societe_id_source`.
--         Avec `societe_id_cible`, elles forment le couple INFORMATIF que D34
--         arrête : elles répondent à « qui a tenté d'accéder à mes données »,
--         et ne filtrent JAMAIS. Ni clé étrangère, ni index, ni politique : un
--         index serait la signature d'un filtrage, et un filtre écrit sur elles
--         ferait croire que le journal est cloisonné alors qu'il ne l'est pas.
--
--   D37 — `admin_societe` rejoint l'énumération `"Role"`, en dixième rôle.
--         L'énumération avait été fermée avant l'arbitrage « il faut prévoir de
--         vendre la solution » : il y manquait un administrateur au niveau
--         SOCIÉTÉ. Sans lui, créer un compte chez un client passerait par
--         l'éditeur — intenable dès la première vente.
--
--   D38 — le commentaire du rôle `codiplan_reporting` porte désormais la règle
--         du secret distinct. La vérification permanente de ses privilèges,
--         elle, ne s'écrit pas en base : elle est jouée à chaque migration par
--         `scripts/controle-cloisonnement.mts`, qui interroge
--         `information_schema.role_table_grants` — un contrôle, pas une
--         déclaration.

-- ── D34 : le couple informatif du journal des accès ────────────────────────
ALTER TABLE "journal_acces" RENAME COLUMN "societe_id_precedente" TO "societe_id_source";

COMMENT ON COLUMN "journal_acces"."societe_id_source" IS
  'Société active AVANT la tentative. INFORMATIVE (D34) : ne filtre jamais, sans clé étrangère ni index.';

COMMENT ON COLUMN "journal_acces"."societe_id_cible" IS
  'Société VISÉE par la tentative. INFORMATIVE (D34) : ne filtre jamais, sans clé étrangère ni index.';

-- ── D37 : le dixième rôle ──────────────────────────────────────────────────
-- Placé APRÈS `editeur_support` et avant `direction` : c'est la frontière entre
-- ce qui est au-dessus des sociétés (§22.5) et ce qui est dedans (§5.2).
-- L'ordre du type PostgreSQL et celui de `prisma/schema.prisma` doivent
-- coïncider — un scénario d'isolation les confronte valeur par valeur.
--
-- `AFTER` est indispensable : sans lui la valeur se rangerait en fin
-- d'énumération et le scénario tomberait. La valeur n'est pas UTILISÉE dans
-- cette migration, ce qui la rend applicable telle quelle dans la transaction
-- de `prisma migrate deploy` (PostgreSQL 12+).
ALTER TYPE "Role" ADD VALUE 'admin_societe' AFTER 'editeur_support';

-- `app_est_role_editeur()` reste inchangée, et c'est le fond de D37 :
-- `admin_societe` administre SA société, il n'est pas un rôle éditeur. Il ne
-- modifie donc pas les référentiels de plateforme (I1).

-- ── D38 : le rôle de consolidation est une clé passe-partout ───────────────
-- Vérifié sur l'hébergement Neon le 20 août 2026 : `codiplan_reporting` porte
-- bien `rolbypassrls = true`, `codiplan_app` porte `rolbypassrls = false`. Le
-- chemin rapide fonctionne donc ici, et l'avertissement de la migration
-- précédente n'est jamais déclenché sur cette base — il reste en place pour les
-- clients qui hébergeront ailleurs (D36).
-- Le commentaire est posé au mieux : commenter un rôle demande d'en être
-- administrateur, ce que le rôle de migration est chez nous mais que rien ne
-- garantit chez un client qui hébergerait ailleurs. Un commentaire manquant
-- n'est pas une raison de refuser une migration — la règle, elle, est écrite
-- dans CLAUDE.md et contrôlée par le script.
DO $$
BEGIN
  EXECUTE 'COMMENT ON ROLE "codiplan_reporting" IS ' || quote_literal(
    'Consolidation multi-sociétés (D21). SELECT seul, BYPASSRLS. Son mot de ' ||
    'passe ne va JAMAIS dans DATABASE_URL ni MIGRATION_DATABASE_URL, mais dans ' ||
    'le secret distinct REPORTING_DATABASE_URL, lu par le seul lib/reporting ' ||
    '(D38). Privilèges contrôlés à chaque migration par ' ||
    'scripts/controle-cloisonnement.mts.');
EXCEPTION WHEN insufficient_privilege THEN
  RAISE WARNING 'Le commentaire du rôle codiplan_reporting n''a pas pu être posé (droits insuffisants). Sans effet sur le cloisonnement : la règle D38 est tenue par CLAUDE.md et par scripts/controle-cloisonnement.mts.';
END
$$;
