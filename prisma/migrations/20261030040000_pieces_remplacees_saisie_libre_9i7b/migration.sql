-- ════════════════════════════════════════════════════════════════════════════
-- 9I7B-PIECES-REMPLACEES-SAISIE-LIBRE — LE TECHNICIEN SAISIT LES PIÈCES
-- REMPLACÉES, EN TEXTE LIBRE, SANS PRIX (décision d'Alexis du 29/10/2026,
-- verbatim « choix libre »)
-- ════════════════════════════════════════════════════════════════════════════
--
-- `intervention_piece_remplacee` est UN RELEVÉ DÉCLARATIF, pas une ligne de
-- facturation : désignation, référence facultative, quantité — AUCUN PRIX,
-- AUCUN LIEN avec le catalogue d'articles. L'arbitrage 3.7
-- (`intervention_piece.prix_unitaire`, issu du catalogue, jamais saisi par le
-- technicien) reste INCHANGÉ et non réalisé — ceci est une autre chose.
--
-- Même forme « filiation » (D103) qu'`intervention_prestation` (BON-2) : une
-- fille est visible si son parent l'est, `ON DELETE CASCADE` vers
-- l'intervention pour la même raison — une ligne de pièce n'a aucun sens sans
-- son intervention.

CREATE TABLE "intervention_piece_remplacee" (
  "id"              uuid NOT NULL,
  "societe_id"      uuid NOT NULL,
  "intervention_id" uuid NOT NULL,
  "designation"     VARCHAR(200) NOT NULL,
  "reference"       VARCHAR(80),
  "quantite"        INTEGER NOT NULL DEFAULT 1,
  "rang"            INTEGER NOT NULL,
  "cree_le"         timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "modifie_le"      timestamptz(3) NOT NULL,

  CONSTRAINT "intervention_piece_remplacee_pkey" PRIMARY KEY ("id")
);

-- Ni désignation vide ni quantité nulle ou négative — en base, pas seulement
-- dans Zod (même doctrine que `habilitation_code_non_vide`) : un rattrapage
-- direct en base est un autre chemin que la route.
ALTER TABLE "intervention_piece_remplacee"
  ADD CONSTRAINT "intervention_piece_remplacee_designation_non_vide"
  CHECK (length(btrim("designation")) > 0);
ALTER TABLE "intervention_piece_remplacee"
  ADD CONSTRAINT "intervention_piece_remplacee_quantite_positive"
  CHECK ("quantite" >= 1);

CREATE INDEX "intervention_piece_remplacee_societe_id_intervention_id_idx"
  ON "intervention_piece_remplacee" ("societe_id", "intervention_id");

-- `ON DELETE CASCADE` vers l'intervention, comme `intervention_prestation` et
-- pour la même raison. `RESTRICT` vers la société.
ALTER TABLE "intervention_piece_remplacee"
  ADD CONSTRAINT "intervention_piece_remplacee_societe_id_fkey"
    FOREIGN KEY ("societe_id") REFERENCES "societe"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "intervention_piece_remplacee_societe_id_intervention_id_fkey"
    FOREIGN KEY ("societe_id", "intervention_id") REFERENCES "intervention"("societe_id", "id") ON DELETE CASCADE ON UPDATE RESTRICT;

ALTER TABLE "intervention_piece_remplacee" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "intervention_piece_remplacee" FORCE ROW LEVEL SECURITY;

-- MÊME FORME QUE `intervention_prestation` (`cloisonnement_filiation`,
-- L1-02c) : `WITH CHECK` répète le `USING` — on n'écrit une pièce que sur une
-- intervention qu'on voit.
CREATE POLICY "cloisonnement_filiation" ON "intervention_piece_remplacee"
  USING (
    EXISTS (
      SELECT 1 FROM "intervention" "i"
       WHERE "i"."id" = "intervention_piece_remplacee"."intervention_id"
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "intervention" "i"
       WHERE "i"."id" = "intervention_piece_remplacee"."intervention_id"
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON "intervention_piece_remplacee" TO "codiplan_app";

CREATE TRIGGER "journal_audit" AFTER INSERT OR UPDATE OR DELETE ON "intervention_piece_remplacee"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

COMMENT ON TABLE "intervention_piece_remplacee" IS
  'Les pièces remplacées, SAISIE LIBRE (9I7B) — un relevé déclaratif sans prix ni lien au catalogue d''articles, distinct de l''arbitrage 3.7. Table métier de la première catégorie de I1, forme « filiation » (D103) : une fille est visible si son parent l''est.';
