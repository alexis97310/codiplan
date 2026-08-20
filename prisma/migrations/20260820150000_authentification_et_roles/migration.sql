-- CODIPLAN — Authentification, rôles et connexion de consolidation
-- (ticket L0-06 ; arbitrages D21 et gravité 4 « énumération canonique des rôles »).
--
-- Quatre choses, dans cet ordre :
--   1. les tables de Better Auth, branchées sur `utilisateur` — un compte, une
--      identité, jamais une table `user` parallèle ;
--   2. le journal des accès (D32, dernier alinéa), en ajout seul ;
--   3. l'écriture des référentiels de plateforme réservée aux rôles éditeur —
--      restriction que la migration `20260820120000_rls_policies` renvoyait
--      explicitement à ce ticket (I1 : « modifiables par les seuls rôles
--      éditeur ») ;
--   4. le rôle PostgreSQL `codiplan_reporting` de D21 : `BYPASSRLS`, `SELECT`
--      seul, aucune table de données personnelles.
--
-- L'énumération `Role` n'est PAS redéfinie ici : elle est posée par la migration
-- initiale et reste la source unique, côté base comme côté TypeScript
-- (`lib/auth/roles.ts` la réexporte depuis le client Prisma). Le SQL ci-dessous
-- ne cite ses valeurs qu'à travers le type `"Role"` lui-même, si bien qu'une
-- valeur inventée ferait échouer la migration au lieu de passer inaperçue.
--
-- Voir docs/decisions/2026-08-20-authentification-et-deux-connexions.md.

-- ── 1. Tables de Better Auth ───────────────────────────────────────────────

-- CreateEnum
CREATE TYPE "EvenementAcces" AS ENUM ('bascule_societe', 'bascule_refusee', 'requete_consolidation');

-- AlterTable
-- `mot_de_passe_hash` quitte `utilisateur` : Better Auth range le hash dans
-- `compte.mot_de_passe`, un compte pouvant porter plusieurs moyens
-- d'authentification. La base de démonstration n'en contenait aucun (le champ
-- était nul depuis L0-03), rien n'est donc perdu.
--
-- `nom` et `modifie_le` sont ajoutés avec une valeur par défaut, puis la valeur
-- par défaut est retirée : sans cela, la migration échouerait sur une base déjà
-- amorcée, ce qu'est la base hébergée depuis L0-03. Le défaut retiré, le schéma
-- Prisma et la base restent alignés — aucune dérive.
ALTER TABLE "utilisateur" DROP COLUMN "mot_de_passe_hash",
ADD COLUMN     "avatar_url" TEXT,
ADD COLUMN     "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "email_verifie" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "modifie_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "nom" TEXT NOT NULL DEFAULT '';

ALTER TABLE "utilisateur" ALTER COLUMN "modifie_le" DROP DEFAULT;
ALTER TABLE "utilisateur" ALTER COLUMN "nom" DROP DEFAULT;

-- CreateTable
CREATE TABLE "session" (
    "id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "utilisateur_id" UUID NOT NULL,
    "expire_le" TIMESTAMP(3) NOT NULL,
    "adresse_ip" TEXT,
    "agent_utilisateur" TEXT,
    "societe_id_active" UUID,
    "role_actif" "Role",
    "second_facteur_valide" BOOLEAN NOT NULL DEFAULT false,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compte" (
    "id" UUID NOT NULL,
    "utilisateur_id" UUID NOT NULL,
    "emetteur" TEXT NOT NULL,
    "compte_externe_id" TEXT NOT NULL,
    "fournisseur_id" TEXT NOT NULL,
    "mot_de_passe" TEXT,
    "jeton_acces" TEXT,
    "jeton_rafraichissement" TEXT,
    "jeton_identite" TEXT,
    "jeton_acces_expire_le" TIMESTAMP(3),
    "jeton_rafraichissement_expire_le" TIMESTAMP(3),
    "portee" TEXT,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" UUID NOT NULL,
    "identifiant" TEXT NOT NULL,
    "valeur" TEXT NOT NULL,
    "expire_le" TIMESTAMP(3) NOT NULL,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "second_facteur" (
    "id" UUID NOT NULL,
    "utilisateur_id" UUID NOT NULL,
    "secret" TEXT NOT NULL,
    "codes_secours" TEXT NOT NULL,
    "verifie" BOOLEAN NOT NULL DEFAULT true,
    "echecs_verification" INTEGER NOT NULL DEFAULT 0,
    "verrouille_jusqu_a" TIMESTAMP(3),

    CONSTRAINT "second_facteur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_acces" (
    "id" UUID NOT NULL,
    "horodatage" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "utilisateur_id" UUID NOT NULL,
    "evenement" "EvenementAcces" NOT NULL,
    "societe_id_cible" UUID,
    "societe_id_precedente" UUID,
    "role" "Role",
    "detail" TEXT,

    CONSTRAINT "journal_acces_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_utilisateur_id_idx" ON "session"("utilisateur_id");

-- CreateIndex
CREATE INDEX "compte_utilisateur_id_idx" ON "compte"("utilisateur_id");

-- CreateIndex
CREATE UNIQUE INDEX "compte_emetteur_compte_externe_id_key" ON "compte"("emetteur", "compte_externe_id");

-- CreateIndex
CREATE INDEX "verification_identifiant_idx" ON "verification"("identifiant");

-- CreateIndex
CREATE INDEX "second_facteur_utilisateur_id_idx" ON "second_facteur"("utilisateur_id");

-- CreateIndex
CREATE INDEX "second_facteur_secret_idx" ON "second_facteur"("secret");

-- CreateIndex
CREATE INDEX "journal_acces_utilisateur_id_horodatage_idx" ON "journal_acces"("utilisateur_id", "horodatage");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_societe_id_active_fkey" FOREIGN KEY ("societe_id_active") REFERENCES "societe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compte" ADD CONSTRAINT "compte_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "second_facteur" ADD CONSTRAINT "second_facteur_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_acces" ADD CONSTRAINT "journal_acces_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── 2. Contexte de session : le rôle rejoint la société ────────────────────
-- Les politiques de L0-04 lisent `app.societe_id`. L'écriture des référentiels
-- de plateforme demande en plus de savoir QUI écrit : `app.role`, posé par
-- `lib/db/rls.ts` en même temps que la société, dans la même transaction.
--
-- Deux fonctions plutôt que la clause en toutes lettres dans chaque politique :
-- la conversion vers le type `"Role"` est écrite une fois, et une valeur qui ne
-- serait pas du type échoue à la création de la fonction, pas six mois plus tard.
-- `search_path` est figé : une politique ne doit pas dépendre du chemin de
-- recherche de l'appelant.

CREATE FUNCTION "app_role"() RETURNS "Role"
  LANGUAGE sql
  STABLE
  SET search_path = pg_catalog, public
  AS $$
    SELECT NULLIF(current_setting('app.role', true), '')::"Role"
  $$;

COMMENT ON FUNCTION "app_role"() IS
  'Rôle porté par la session applicative courante, NULL hors contexte (L0-06).';

CREATE FUNCTION "app_est_role_editeur"() RETURNS boolean
  LANGUAGE sql
  STABLE
  SET search_path = pg_catalog, public
  AS $$
    SELECT COALESCE(
      "app_role"() IN ('admin_plateforme', 'editeur_commercial', 'editeur_support'),
      false
    )
  $$;

COMMENT ON FUNCTION "app_est_role_editeur"() IS
  'Vrai si le rôle courant est un rôle éditeur (§22.5) : seuls habilités à modifier les référentiels de plateforme (I1).';

-- ── 3. Référentiels de plateforme : lecture pour tous, écriture aux éditeurs ─
-- La politique `referentiel_lisible_par_tous` posée à L0-04 couvre le SELECT et
-- reste inchangée. Celle-ci s'y ajoute en PERMISSIVE : les deux sont donc
-- combinées par OU sur le SELECT (la lecture reste ouverte), et elle est seule
-- à s'appliquer sur INSERT, UPDATE et DELETE — où elle exige un rôle éditeur.

CREATE POLICY "referentiel_ecriture_editeur" ON "devise"
  AS PERMISSIVE FOR ALL
  USING ("app_est_role_editeur"())
  WITH CHECK ("app_est_role_editeur"());

CREATE POLICY "referentiel_ecriture_editeur" ON "parite"
  AS PERMISSIVE FOR ALL
  USING ("app_est_role_editeur"())
  WITH CHECK ("app_est_role_editeur"());

-- ── 4. Droits du rôle applicatif sur les tables de ce ticket ───────────────
-- `ALTER DEFAULT PRIVILEGES` (migration 20260820130000) les couvre déjà quand
-- c'est le même rôle qui applique les deux migrations. On les écrit néanmoins :
-- une base migrée par un autre rôle resterait sinon muette pour l'application.

GRANT SELECT, INSERT, UPDATE, DELETE ON "session", "compte", "verification", "second_facteur" TO "codiplan_app";

-- Le journal des accès est en AJOUT SEUL. Le rôle applicatif y écrit et le lit ;
-- il ne peut ni le corriger ni l'effacer. Même intention que le futur
-- `journal_audit` de L0-10, à cette différence près qu'il n'y a rien à protéger
-- par trigger : sans UPDATE ni DELETE, il n'y a pas de réécriture possible.
GRANT SELECT, INSERT ON "journal_acces" TO "codiplan_app";
REVOKE UPDATE, DELETE ON "journal_acces" FROM "codiplan_app";

-- ── 5. Rôle de consolidation `codiplan_reporting` (D21) ────────────────────
-- Réservé aux agrégats multi-sociétés de `lib/reporting`, et à rien d'autre.
-- Il porte `BYPASSRLS` parce que consolider, c'est précisément lire par-dessus
-- le cloisonnement ; les trois garde-fous de D21 sont ce qui empêche cette
-- porte d'en être une :
--   1. SELECT seul, et sur aucune table de données personnelles — la liste des
--      tables accordées ci-dessous est exhaustive et volontairement courte ;
--   2. toute requête passant par lui est journalisée (`journal_acces`,
--      événement `requete_consolidation`) ;
--   3. un test vérifie qu'aucun chemin hors `lib/reporting` n'ouvre cette
--      connexion (`tests/unit/reporting/connexion-reservee.test.ts`).
--
-- Accorder `BYPASSRLS` exige de le porter soi-même. Le rôle propriétaire de Neon
-- ne l'a pas nécessairement : si l'attribut ne peut pas être posé, la migration
-- AVERTIT sans échouer, et c'est `lib/db/garde-role.ts` qui refusera la
-- connexion de consolidation — un refus franc plutôt qu'une consolidation
-- silencieusement tronquée par les politiques. La marche à suivre est décrite
-- dans docs/decisions/2026-08-20-authentification-et-deux-connexions.md.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'codiplan_reporting') THEN
    BEGIN
      CREATE ROLE "codiplan_reporting" LOGIN NOSUPERUSER BYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT;
    EXCEPTION WHEN insufficient_privilege THEN
      CREATE ROLE "codiplan_reporting" LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT;
      RAISE WARNING 'codiplan_reporting a été créé SANS BYPASSRLS : le rôle qui applique la migration ne porte pas cet attribut. Poser « ALTER ROLE codiplan_reporting BYPASSRLS » avec un rôle qui le peut ; tant que ce n''est pas fait, lib/db/garde-role.ts refusera la connexion de consolidation.';
    END;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT (SELECT "rolbypassrls" FROM pg_catalog.pg_roles WHERE rolname = 'codiplan_reporting') THEN
    BEGIN
      ALTER ROLE "codiplan_reporting" BYPASSRLS;
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE WARNING 'BYPASSRLS n''a pas pu être accordé à codiplan_reporting (droits insuffisants du rôle de migration). La connexion de consolidation restera refusée par lib/db/garde-role.ts.';
    END;
  END IF;
END
$$;

-- Table blanche : on part de zéro droit, puis on accorde nommément.
REVOKE ALL ON ALL TABLES IN SCHEMA "public" FROM "codiplan_reporting";
REVOKE ALL ON ALL SEQUENCES IN SCHEMA "public" FROM "codiplan_reporting";
REVOKE ALL ON SCHEMA "public" FROM "codiplan_reporting";

GRANT USAGE ON SCHEMA "public" TO "codiplan_reporting";

-- Les seules tables consolidables aujourd'hui : le socle sans données
-- personnelles. `utilisateur`, `utilisateur_societe`, `utilisateur_client`,
-- `session`, `compte`, `verification`, `second_facteur` et `journal_acces` en
-- sont exclus, et doivent le rester (D21, garde-fou n°1). Une table livrée à un
-- lot ultérieur n'est PAS accordée d'office : `ALTER DEFAULT PRIVILEGES` ne vise
-- que le rôle applicatif. Chaque ajout au périmètre de consolidation est donc
-- une ligne écrite à la main, dans une migration, et cela est voulu.
GRANT SELECT ON "societe" TO "codiplan_reporting";
GRANT SELECT ON "agence" TO "codiplan_reporting";
GRANT SELECT ON "devise" TO "codiplan_reporting";
GRANT SELECT ON "parite" TO "codiplan_reporting";
