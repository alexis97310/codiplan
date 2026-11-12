-- 9K29-PRESTATIONS-PAR-TYPE-INTERVENTION — UNE PRESTATION N'EST PROPOSÉE QUE
-- POUR LES TYPES D'INTERVENTION QUI LA CONCERNENT.
--
-- Décision d'Alexis du 11/11/2026 ~08:05 : « Prestations proposées selon le
-- type d'intervention : Oui, par type ». Origine : sur une intervention
-- préventive, le technicien pouvait cocher « remplacement écrou porteur »,
-- une prestation curative — signalement du 02/11/2026.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- CE QUE CETTE MIGRATION FAIT
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Une seule table nouvelle, `prestation_type_intervention` : les types
-- d'intervention où une prestation du catalogue est proposée au technicien.
-- VIDE (aucune ligne) = proposée pour TOUS les types — aucune prestation
-- existante ne disparaît du terrain le jour de cette migration, puisqu'elle
-- n'écrit aucune ligne sur le catalogue déjà semé. Dès qu'une ligne existe
-- pour une prestation, elle n'est proposée que pour les types listés.
--
-- ## POURQUOI UNE TABLE, ET NON LE TABLEAU `TypeIntervention[]` ENVISAGÉ AU
-- ## TICKET
--
-- D235 (09/11/2026, docs/arbitrages.md) a DÉJÀ tranché contre un tableau
-- d'énumération typé — un brouillon antérieur (9J12) l'envisageait sur
-- `checklist_modele`, sans précédent dans ce dépôt, et D235 l'a remplacé par
-- une colonne nullable scalaire. Ce ticket AMENDE D235 dans ce seul sens :
-- `checklist_modele` vise UN SEUL type parce qu'un contrôle qui en viserait
-- plusieurs se pose comme PLUSIEURS modèles (un code chacun) — une prestation
-- ne peut pas se dédoubler ainsi, son `code` étant unique par société et
-- `intervention_prestation` la désignant par un identifiant unique. Une
-- colonne nullable scalaire ne suffit donc pas ; une table de relation reste
-- cohérente avec le principe de D235 (aucun tableau d'énumération typé).
--
-- ## FORME DE POLITIQUE
--
-- « Filiation » (D103), exactement comme `intervention_prestation` : une
-- fille est visible si son parent (`prestation`) l'est, et aucune clause de
-- société propre n'est ajoutée — la clé étrangère composite l'empêche déjà de
-- dériver.
--
-- ## CE QUE CETTE MIGRATION NE FAIT PAS
--
-- Elle ne touche à aucune politique RLS existante, ni au gabarit d'import
-- (code applicatif, lot suivant de ce même ticket). Aucune prestation n'est
-- créée, modifiée ni désactivée en production.

-- ═══════════════════════════════════════════════════════════════════════════
-- `prestation_type_intervention`
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE "prestation_type_intervention" (
  "id"                uuid NOT NULL,
  "societe_id"        uuid NOT NULL,
  "prestation_id"     uuid NOT NULL,
  "type_intervention" "TypeIntervention" NOT NULL,
  "cree_le"           timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "prestation_type_intervention_pkey" PRIMARY KEY ("id")
);

-- Le même type ne se coche pas deux fois sur la même prestation.
CREATE UNIQUE INDEX "prestation_type_intervention_prestation_id_type_intervention_key"
  ON "prestation_type_intervention" ("prestation_id", "type_intervention");
CREATE INDEX "prestation_type_intervention_societe_id_prestation_id_idx"
  ON "prestation_type_intervention" ("societe_id", "prestation_id");

-- `Cascade` vers la prestation : une ligne « cette prestation vise ce type »
-- n'a aucune vie propre sans sa prestation (même raisonnement
-- qu'`intervention_machine` vers `intervention`, D103). Sans effet
-- aujourd'hui — aucun chemin ne supprime une prestation (D109) —, et ce n'est
-- pas une raison de choisir `Restrict` par confort : le jour où un tel chemin
-- existe, `Cascade` reste le sens correct.
ALTER TABLE "prestation_type_intervention"
  ADD CONSTRAINT "prestation_type_intervention_societe_id_fkey"
    FOREIGN KEY ("societe_id") REFERENCES "societe"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "prestation_type_intervention_societe_id_prestation_id_fkey"
    FOREIGN KEY ("societe_id", "prestation_id") REFERENCES "prestation"("societe_id", "id") ON DELETE CASCADE ON UPDATE RESTRICT;

ALTER TABLE "prestation_type_intervention" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "prestation_type_intervention" FORCE ROW LEVEL SECURITY;

-- `WITH CHECK` répète le `USING` (L1-02c) : on ne rattache un type qu'à une
-- prestation qu'on voit.
CREATE POLICY "cloisonnement_filiation" ON "prestation_type_intervention"
  USING (
    EXISTS (
      SELECT 1 FROM "prestation" "p"
       WHERE "p"."id" = "prestation_type_intervention"."prestation_id"
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "prestation" "p"
       WHERE "p"."id" = "prestation_type_intervention"."prestation_id"
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON "prestation_type_intervention" TO "codiplan_app";

CREATE TRIGGER "journal_audit" AFTER INSERT OR UPDATE OR DELETE ON "prestation_type_intervention"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

-- LE VERROU D'ÉCRITURE DU PORTAIL (I3, D237, 9K16) — recopié verbatim des
-- trois politiques posées par `20261110120000_portail_securite_base_9k16`,
-- et son fondement y est écrit en entier. `prestation_type_intervention`
-- n'existait pas ce jour-là, d'où ces trois CREATE POLICY ici plutôt qu'une
-- entrée de plus dans le tableau de 9K16 — une migration déjà appliquée ne se
-- modifie jamais (CLAUDE.md §7). Aucun chemin du portail n'écrit cette table
-- aujourd'hui ; le verrou ferme ce que la forme « filiation » laisserait
-- ouvert si un tel chemin naissait sans qu'on y pense.
CREATE POLICY "verrou_ecriture_portail_insertion" ON "prestation_type_intervention"
  AS RESTRICTIVE FOR INSERT
  WITH CHECK (NULLIF(current_setting('app.client_id', true), '') IS NULL);

CREATE POLICY "verrou_ecriture_portail_modification" ON "prestation_type_intervention"
  AS RESTRICTIVE FOR UPDATE
  USING (NULLIF(current_setting('app.client_id', true), '') IS NULL)
  WITH CHECK (NULLIF(current_setting('app.client_id', true), '') IS NULL);

CREATE POLICY "verrou_ecriture_portail_suppression" ON "prestation_type_intervention"
  AS RESTRICTIVE FOR DELETE
  USING (NULLIF(current_setting('app.client_id', true), '') IS NULL);

COMMENT ON TABLE "prestation_type_intervention" IS
  'Les types d''intervention où une prestation du catalogue est PROPOSÉE au technicien (9K29, décision d''Alexis du 11/11/2026). VIDE = proposée pour TOUS les types. Table métier de la première catégorie de I1, forme « filiation » (D103) : une fille est visible si son parent (prestation) l''est. Amende D235 dans le seul sens où une table de relation remplace, pour CE cas, la colonne nullable scalaire — une prestation vise zéro, un ou plusieurs types à la fois sans pouvoir se dédoubler par code.';
