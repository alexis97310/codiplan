-- CODIPLAN — Identifiants en type `uuid` natif, et rétablissement du `::uuid`
-- dans les politiques RLS (correction de revue du ticket L0-04, arbitrage D4).
--
-- Ce que la revue a relevé : la migration `20260820120000_rls_policies` avait
-- écarté le `::uuid` de la forme imposée par D4
--     societe_id = current_setting('app.societe_id')::uuid OR societe_id IS NULL
-- au motif que les identifiants étaient stockés en `text`. Le remède traitait le
-- symptôme : c'est le stockage qui était fautif. Un identifiant qui EST un UUID
-- v7 (I10) doit être typé `uuid`, ce qui vaut contrôle d'intégrité à l'écriture,
-- indexation plus compacte, et permet d'écrire la politique dans la forme
-- arrêtée, sans divergence à expliquer.
--
-- La base est vide de données métier : la conversion se fait donc maintenant,
-- une fois, plutôt que de devenir irréversible avec le premier client.
-- La conversion est écrite en `ALTER COLUMN ... TYPE uuid USING ...::uuid`,
-- non destructive, et non en `DROP COLUMN` / `ADD COLUMN` comme le proposerait
-- la génération automatique : rien ne doit dépendre du fait que la base soit
-- vide au moment où cette migration s'applique.
--
-- `devise.code` reste `text` : c'est un code ISO (XPF, EUR), pas un identifiant
-- technique.

-- ── 1. Dépose des politiques (elles dépendent du type des colonnes) ─────────
-- PostgreSQL refuse d'altérer le type d'une colonne citée par une politique.

DROP POLICY "cloisonnement_identite" ON "societe";
DROP POLICY "cloisonnement_societe" ON "agence";
DROP POLICY "cloisonnement_societe" ON "utilisateur_societe";
DROP POLICY "cloisonnement_societe" ON "utilisateur_client";

-- ── 2. Dépose des clés étrangères ──────────────────────────────────────────
-- Une clé étrangère ne survit pas à un changement de type de l'un de ses deux
-- côtés : on la dépose, on convertit, on la rétablit à l'identique.

ALTER TABLE "agence" DROP CONSTRAINT "agence_societe_id_fkey";
ALTER TABLE "utilisateur_societe" DROP CONSTRAINT "utilisateur_societe_utilisateur_id_fkey";
ALTER TABLE "utilisateur_societe" DROP CONSTRAINT "utilisateur_societe_societe_id_fkey";
ALTER TABLE "utilisateur_client" DROP CONSTRAINT "utilisateur_client_utilisateur_id_fkey";
ALTER TABLE "utilisateur_client" DROP CONSTRAINT "utilisateur_client_societe_id_fkey";

-- ── 3. Conversion des colonnes d'identifiants ──────────────────────────────

ALTER TABLE "parite"
  ALTER COLUMN "id" TYPE uuid USING "id"::uuid;

ALTER TABLE "societe"
  ALTER COLUMN "id" TYPE uuid USING "id"::uuid;

ALTER TABLE "agence"
  ALTER COLUMN "id" TYPE uuid USING "id"::uuid,
  ALTER COLUMN "societe_id" TYPE uuid USING "societe_id"::uuid,
  ALTER COLUMN "calendrier_id" TYPE uuid USING "calendrier_id"::uuid;

ALTER TABLE "utilisateur"
  ALTER COLUMN "id" TYPE uuid USING "id"::uuid;

ALTER TABLE "utilisateur_societe"
  ALTER COLUMN "id" TYPE uuid USING "id"::uuid,
  ALTER COLUMN "utilisateur_id" TYPE uuid USING "utilisateur_id"::uuid,
  ALTER COLUMN "societe_id" TYPE uuid USING "societe_id"::uuid;

-- `perimetre_sites` est une liste d'identifiants de site (D10) : elle suit.
-- La valeur par défaut doit être déposée puis reposée, son type changeant aussi.
ALTER TABLE "utilisateur_client"
  ALTER COLUMN "id" TYPE uuid USING "id"::uuid,
  ALTER COLUMN "utilisateur_id" TYPE uuid USING "utilisateur_id"::uuid,
  ALTER COLUMN "client_id" TYPE uuid USING "client_id"::uuid,
  ALTER COLUMN "societe_id" TYPE uuid USING "societe_id"::uuid,
  ALTER COLUMN "perimetre_sites" DROP DEFAULT,
  ALTER COLUMN "perimetre_sites" TYPE uuid[] USING "perimetre_sites"::uuid[],
  ALTER COLUMN "perimetre_sites" SET DEFAULT ARRAY[]::uuid[];

-- ── 4. Rétablissement des clés étrangères ──────────────────────────────────

ALTER TABLE "agence" ADD CONSTRAINT "agence_societe_id_fkey"
  FOREIGN KEY ("societe_id") REFERENCES "societe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "utilisateur_societe" ADD CONSTRAINT "utilisateur_societe_utilisateur_id_fkey"
  FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "utilisateur_societe" ADD CONSTRAINT "utilisateur_societe_societe_id_fkey"
  FOREIGN KEY ("societe_id") REFERENCES "societe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "utilisateur_client" ADD CONSTRAINT "utilisateur_client_utilisateur_id_fkey"
  FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "utilisateur_client" ADD CONSTRAINT "utilisateur_client_societe_id_fkey"
  FOREIGN KEY ("societe_id") REFERENCES "societe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── 5. Politiques rétablies dans la forme imposée par D4 ───────────────────
-- Forme arrêtée :
--     societe_id = current_setting('app.societe_id')::uuid OR societe_id IS NULL
-- Deux durcissements conservés, à iso-sémantique, et eux seuls :
--   * `current_setting(..., true)` — le second argument (missing_ok) renvoie NULL
--     quand la variable n'est pas positionnée, au lieu de lever « unrecognized
--     configuration parameter ». C'est ce qui rend « aucune société positionnée
--     ⇒ zéro ligne » vrai, comme l'exige le critère d'acceptation ;
--   * `NULLIF(..., '')` — une variable posée à la chaîne vide est traitée comme
--     absente, et le cast en `uuid` ne bute pas sur une chaîne vide.
-- Le `::uuid`, lui, est bien celui de D4.

CREATE POLICY "cloisonnement_identite" ON "societe"
  USING ("id" = NULLIF(current_setting('app.societe_id', true), '')::uuid)
  WITH CHECK ("id" = NULLIF(current_setting('app.societe_id', true), '')::uuid);

CREATE POLICY "cloisonnement_societe" ON "agence"
  USING (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
    OR "societe_id" IS NULL
  )
  WITH CHECK (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
    OR "societe_id" IS NULL
  );

CREATE POLICY "cloisonnement_societe" ON "utilisateur_societe"
  USING (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
    OR "societe_id" IS NULL
  )
  WITH CHECK (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
    OR "societe_id" IS NULL
  );

CREATE POLICY "cloisonnement_societe" ON "utilisateur_client"
  USING (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
    OR "societe_id" IS NULL
  )
  WITH CHECK (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
    OR "societe_id" IS NULL
  );
