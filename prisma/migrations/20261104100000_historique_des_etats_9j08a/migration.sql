-- ═══════════════════════════════════════════════════════════════════════════
-- L'HISTORIQUE DES CHANGEMENTS DE STATUT (ticket 9J08A-HISTORIQUE-DES-ETATS).
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Demande d'Alexis : le client doit voir « ses demandes d'intervention avec
-- leurs états, temps de traitement pour chaque état ». Étude d'équipe du
-- 29/10/2026 (`etude-equipe/synthese.md`, question 2) : aucun historique
-- n'existait — seules des colonnes datées dispersées sur `intervention`
-- (`suspendue_le`, `cloturee_le`, `annulee_le`...). Option A retenue par
-- Alexis, verbatim « A » : une table d'historique remplie par déclencheur,
-- forme « filiation » (précédent D103, exactement sur le modèle
-- d'`intervention_pause`), NON PARTITIONNÉE, **SANS reprise du passé**.
--
-- ## CE QUE CETTE MIGRATION FAIT
--
--   1. `intervention_statut_historique` et `demande_statut_historique` — une
--      ligne par changement RÉEL de `statut` (l'INSERT initial compte comme un
--      changement, `statut_avant` y vaut NULL).
--   2. Un déclencheur AFTER INSERT OR UPDATE OF "statut" sur chacune des deux
--      tables mères, qui pose la ligne. Jamais `SECURITY DEFINER` (D50, liste
--      fermée et vide hors l'unique exception nommément arbitrée ailleurs) —
--      ces fonctions restent `SECURITY INVOKER`, comme `journal_audit_tracer`.
--   3. Politique RLS « filiation » : une fille est visible si son parent
--      l'est. Aucune 14e forme — c'est la forme EXISTANTE d'`intervention_pause`
--      (migration `20260924180000_interventions_2`) recopiée à l'identique.
--   4. Aucune écriture directe pour `codiplan_app` : `SELECT, INSERT`
--      seulement, et l'`INSERT` n'est en pratique jamais exercé que par le
--      déclencheur lui-même (aucune fonction de dépôt n'insère dans ces deux
--      tables). `UPDATE`/`DELETE` sont retirés, et sous `FORCE ROW LEVEL
--      SECURITY` l'absence de toute politique pour ces deux verbes les ferme
--      une seconde fois : *un historique qui peut disparaître ou se réécrire
--      sans trace n'en est pas un* (même raisonnement que `journal_audit` et
--      `intervention_pause`).
--   5. Le périmètre d'audit (I8, inversé depuis D55) : ces deux tables sont de
--      première catégorie (`societe_id NOT NULL`, table métier) et reçoivent
--      donc le déclencheur `journal_audit`, exactement comme
--      `intervention_pause` — ce n'est pas la source du nouvel écran client
--      (voir point 6), seulement la traçabilité générale due à toute table du
--      périmètre.
--
-- ## CE QU'ELLE NE FAIT PAS
--
-- **Aucune reprise du passé.** Une intervention ou une demande déjà en base
-- n'a d'historique qu'à compter de son premier changement de statut déployé
-- APRÈS cette migration — `lib/interventions/durees-par-etat.ts` détecte ce
-- cas (`statut_avant` NON NULL sur la première ligne connue, ou historique
-- vide) et le signale, jamais ne l'invente.
--
-- **Aucune nouvelle valeur d'énumération.** `StatutIntervention` et
-- `StatutDemande` ne bougent pas (point d'arrêt du CLAUDE.md §8).
--
-- **Jamais adossée au journal d'audit pour l'écran client.** L'étude du
-- 29/10 l'écrit explicitement : `journal_audit` trace `note_interne`, et sa
-- politique de lecture n'ouvre qu'à `admin_societe` et `direction` — un écran
-- client qui en dépendrait serait vide pour tout le monde ailleurs. Ces deux
-- tables, de forme « filiation », n'ont pas cette restriction.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. `intervention_statut_historique`
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE "intervention_statut_historique" (
  "id"              uuid NOT NULL,
  "societe_id"      uuid NOT NULL,
  "intervention_id" uuid NOT NULL,

  -- NULL seulement à la création de l'intervention : le déclencheur AFTER
  -- INSERT ne connaît aucun statut antérieur.
  "statut_avant" "StatutIntervention",
  "statut_apres" "StatutIntervention" NOT NULL,

  "change_le" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "intervention_statut_historique_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "intervention_statut_historique_societe_id_id_key"
  ON "intervention_statut_historique" ("societe_id", "id");
CREATE INDEX "intervention_statut_historique_societe_id_intervention_id_change_le_idx"
  ON "intervention_statut_historique" ("societe_id", "intervention_id", "change_le");

ALTER TABLE "intervention_statut_historique"
  ADD CONSTRAINT "intervention_statut_historique_societe_id_fkey"
    FOREIGN KEY ("societe_id") REFERENCES "societe"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "intervention_statut_historique_societe_id_intervention_id_fkey"
    FOREIGN KEY ("societe_id", "intervention_id") REFERENCES "intervention"("societe_id", "id")
    ON DELETE CASCADE ON UPDATE RESTRICT;

ALTER TABLE "intervention_statut_historique" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "intervention_statut_historique" FORCE ROW LEVEL SECURITY;

-- DEUX politiques seulement, forme « filiation » (D103), recopiée à
-- l'identique de celle d'`intervention_pause` : une fille est visible si son
-- parent l'est. AUCUNE politique UPDATE ni DELETE — sous FORCE ROW LEVEL
-- SECURITY, l'absence de politique referme ces deux verbes pour tout le
-- monde : un historique qui peut se réécrire ou disparaître sans trace n'en
-- est pas un.
CREATE POLICY "cloisonnement_filiation_lecture" ON "intervention_statut_historique"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "intervention" "i"
       WHERE "i"."id" = "intervention_statut_historique"."intervention_id"
    )
  );

CREATE POLICY "cloisonnement_filiation_ajout" ON "intervention_statut_historique"
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "intervention" "i"
       WHERE "i"."id" = "intervention_statut_historique"."intervention_id"
    )
  );

REVOKE UPDATE, DELETE, TRUNCATE ON "intervention_statut_historique" FROM "codiplan_app";
GRANT SELECT, INSERT ON "intervention_statut_historique" TO "codiplan_app";

CREATE TRIGGER "journal_audit" AFTER INSERT OR UPDATE OR DELETE ON "intervention_statut_historique"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

COMMENT ON TABLE "intervention_statut_historique" IS
  'L''HISTORIQUE des changements de statut d''une intervention (9J08A-HISTORIQUE-DES-ETATS). Alimentée EXCLUSIVEMENT par le déclencheur intervention_statut_historique_tracer — aucune écriture directe n''est accordée à codiplan_app au-delà de SELECT et INSERT, et UPDATE/DELETE sont fermés sous FORCE ROW LEVEL SECURITY faute de politique. SANS reprise du passé : une intervention déjà en base à la migration n''a d''historique qu''à partir de son premier changement de statut postérieur. Table métier de la première catégorie de I1, forme « filiation » (D103) : une fille est visible si son parent l''est.';

COMMENT ON COLUMN "intervention_statut_historique"."statut_avant" IS
  'NULL veut dire « c''est la création de l''intervention » (ligne posée par le déclencheur AFTER INSERT), jamais « valeur inconnue ».';

-- ── LE DÉCLENCHEUR — jamais SECURITY DEFINER (D50) ──────────────────────────
-- Une ligne seulement si le statut change RÉELLEMENT : PostgreSQL déclenche
-- un trigger "UPDATE OF statut" dès que la colonne est NOMMÉE dans le SET,
-- même si la valeur ne change pas — d'où la garde IS DISTINCT FROM.
CREATE FUNCTION "intervention_statut_historique_tracer"() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO "intervention_statut_historique"
      ("id", "societe_id", "intervention_id", "statut_avant", "statut_apres")
    VALUES (gen_random_uuid(), NEW."societe_id", NEW."id", NULL, NEW."statut");
  ELSIF NEW."statut" IS DISTINCT FROM OLD."statut" THEN
    INSERT INTO "intervention_statut_historique"
      ("id", "societe_id", "intervention_id", "statut_avant", "statut_apres")
    VALUES (gen_random_uuid(), NEW."societe_id", NEW."id", OLD."statut", NEW."statut");
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "intervention_statut_historique" AFTER INSERT OR UPDATE OF "statut" ON "intervention"
  FOR EACH ROW EXECUTE FUNCTION "intervention_statut_historique_tracer"();

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. `demande_statut_historique` — même forme, même régime
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE "demande_statut_historique" (
  "id"         uuid NOT NULL,
  "societe_id" uuid NOT NULL,
  "demande_id" uuid NOT NULL,

  "statut_avant" "StatutDemande",
  "statut_apres" "StatutDemande" NOT NULL,

  "change_le" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "demande_statut_historique_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "demande_statut_historique_societe_id_id_key"
  ON "demande_statut_historique" ("societe_id", "id");
CREATE INDEX "demande_statut_historique_societe_id_demande_id_change_le_idx"
  ON "demande_statut_historique" ("societe_id", "demande_id", "change_le");

ALTER TABLE "demande_statut_historique"
  ADD CONSTRAINT "demande_statut_historique_societe_id_fkey"
    FOREIGN KEY ("societe_id") REFERENCES "societe"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "demande_statut_historique_societe_id_demande_id_fkey"
    FOREIGN KEY ("societe_id", "demande_id") REFERENCES "demande"("societe_id", "id")
    ON DELETE CASCADE ON UPDATE RESTRICT;

ALTER TABLE "demande_statut_historique" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "demande_statut_historique" FORCE ROW LEVEL SECURITY;

CREATE POLICY "cloisonnement_filiation_lecture" ON "demande_statut_historique"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "demande" "d"
       WHERE "d"."id" = "demande_statut_historique"."demande_id"
    )
  );

CREATE POLICY "cloisonnement_filiation_ajout" ON "demande_statut_historique"
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "demande" "d"
       WHERE "d"."id" = "demande_statut_historique"."demande_id"
    )
  );

REVOKE UPDATE, DELETE, TRUNCATE ON "demande_statut_historique" FROM "codiplan_app";
GRANT SELECT, INSERT ON "demande_statut_historique" TO "codiplan_app";

CREATE TRIGGER "journal_audit" AFTER INSERT OR UPDATE OR DELETE ON "demande_statut_historique"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

COMMENT ON TABLE "demande_statut_historique" IS
  'L''HISTORIQUE des changements de statut d''une demande (9J08A-HISTORIQUE-DES-ETATS). Même régime que intervention_statut_historique : alimentée exclusivement par déclencheur, sans reprise du passé, forme « filiation » (D103).';

COMMENT ON COLUMN "demande_statut_historique"."statut_avant" IS
  'NULL veut dire « c''est la création de la demande », jamais « valeur inconnue ».';

CREATE FUNCTION "demande_statut_historique_tracer"() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO "demande_statut_historique"
      ("id", "societe_id", "demande_id", "statut_avant", "statut_apres")
    VALUES (gen_random_uuid(), NEW."societe_id", NEW."id", NULL, NEW."statut");
  ELSIF NEW."statut" IS DISTINCT FROM OLD."statut" THEN
    INSERT INTO "demande_statut_historique"
      ("id", "societe_id", "demande_id", "statut_avant", "statut_apres")
    VALUES (gen_random_uuid(), NEW."societe_id", NEW."id", OLD."statut", NEW."statut");
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "demande_statut_historique" AFTER INSERT OR UPDATE OF "statut" ON "demande"
  FOR EACH ROW EXECUTE FUNCTION "demande_statut_historique_tracer"();
