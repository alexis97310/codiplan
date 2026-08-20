-- CODIPLAN — FORCE RLS et rôle applicatif non propriétaire
-- (correction de revue du ticket L0-04, invariant I1).
--
-- Ce que la revue a relevé : `ENABLE ROW LEVEL SECURITY` seul ne mord pas sur
-- le propriétaire des tables. Tant que l'application se connectait avec le rôle
-- qui applique les migrations, le filet base de données était donc inopérant —
-- il ne protégeait que des rôles que personne n'utilisait. I1 exige que « la
-- base applique EN PLUS une politique RLS » ; cette migration rend cette
-- promesse vraie.
--
-- Trois pièces, indissociables :
--   1. FORCE ROW LEVEL SECURITY sur les tables cloisonnées : le propriétaire
--      lui-même y est soumis ;
--   2. un rôle applicatif `codiplan_app`, ni propriétaire, ni superutilisateur,
--      ni BYPASSRLS, doté des seuls droits de manipulation de données ;
--   3. côté applicatif, le contrôle au démarrage de `lib/db/garde-role.ts`,
--      qui refuse d'ouvrir la moindre transaction si le rôle courant est
--      propriétaire de la base (ou superutilisateur, ou BYPASSRLS).
--
-- Voir docs/decisions/2026-08-20-role-applicatif-et-force-rls.md, qui décrit
-- notamment la marche à suivre côté Neon.

-- ── 1. FORCE sur les tables cloisonnées ────────────────────────────────────
-- Uniquement les tables cloisonnées : `societe` (cloisonnée par son identité)
-- et les trois tables portant `societe_id`. Les référentiels de plateforme
-- `devise` et `parite` restent en RLS simple — ils sont lisibles par toutes les
-- sociétés (D4) et leur écriture, réservée aux rôles éditeur, est posée à
-- L0-06 ; le propriétaire doit pouvoir les amorcer sans contexte.

ALTER TABLE "societe" FORCE ROW LEVEL SECURITY;
ALTER TABLE "agence" FORCE ROW LEVEL SECURITY;
ALTER TABLE "utilisateur_societe" FORCE ROW LEVEL SECURITY;
ALTER TABLE "utilisateur_client" FORCE ROW LEVEL SECURITY;

-- ── 2. Rôle applicatif non propriétaire ────────────────────────────────────
-- Créé sans mot de passe : il ne peut donc pas se connecter tant qu'un
-- exploitant ne lui en attribue un hors dépôt (I9 — aucun secret versionné).
-- Sur un cluster local en authentification « trust » (tests, intégration
-- continue), il se connecte tel quel.
--
-- Idempotent : le rôle est un objet de cluster, il survit à la reprise à zéro
-- du schéma que pratiquent les tests d'isolation.
--
-- Si le rôle qui applique la migration n'a pas l'attribut CREATEROLE, cette
-- instruction échoue : créer alors `codiplan_app` depuis la console de
-- l'hébergeur AVANT de relancer la migration — la branche de création est
-- alors sautée et seuls les GRANT s'appliquent (voir la décision citée plus haut).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'codiplan_app') THEN
    CREATE ROLE "codiplan_app" LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END
$$;

-- Droits strictement limités à la manipulation de données : aucun DDL, aucune
-- création d'objet. Les migrations restent l'affaire du propriétaire.
GRANT USAGE ON SCHEMA "public" TO "codiplan_app";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "public" TO "codiplan_app";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "public" TO "codiplan_app";

-- Les tables des migrations à venir sont couvertes d'avance : sans cela, chaque
-- nouvelle table serait invisible au rôle applicatif jusqu'à un GRANT oublié.
ALTER DEFAULT PRIVILEGES IN SCHEMA "public"
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "codiplan_app";
ALTER DEFAULT PRIVILEGES IN SCHEMA "public"
  GRANT USAGE, SELECT ON SEQUENCES TO "codiplan_app";
