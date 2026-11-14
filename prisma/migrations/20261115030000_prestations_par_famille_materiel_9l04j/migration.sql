-- 9L04J-PRESTATIONS-PAR-MATERIEL — UNE PRESTATION NE SE PROPOSE QUE SUR LES
-- FAMILLES DE MATÉRIEL QU'ELLE VISE.
--
-- Décision d'Alexis du 13/11/2026 : « Filtrer par matériel ». Origine : en
-- production (INT-2026-1853, un compresseur), « Prestations réalisées »
-- proposait « Remplacement écrous porteurs » — seule prestation du
-- catalogue, proposée PARTOUT, y compris sur un matériel qui ne porte pas
-- d'écrou porteur. 9K29 filtre déjà par TYPE d'intervention (D243) ; ce
-- ticket ajoute le filtre par FAMILLE DE MATÉRIEL, les deux se composent.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- CE QUE CETTE MIGRATION FAIT
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Une table nouvelle, `prestation_famille_materiel` : les familles de
-- matériel où une prestation du catalogue est proposée au technicien. VIDE
-- (aucune ligne) = GÉNÉRALE, proposée sur TOUTE machine.
--
-- Elle REMPLACE `prestation.famille_id`, le scalaire NULLABLE posé par L1-12
-- (D109, D113) : une valeur NON NULLE devient UNE ligne de liaison, puis la
-- colonne est SUPPRIMÉE. Reprise ADDITIONNELLE, par le LIBELLÉ (jamais un
-- identifiant en dur, I9) : la prestation « Remplacement écrous porteurs »
-- est rattachée à la famille de code `PONT-ELEV` de la MÊME société, pour
-- chaque société où les deux existent — c'est le constat exact de
-- l'incident : cette prestation existait déjà, sa famille n'avait jamais été
-- posée. `ON CONFLICT DO NOTHING` : si le scalaire la portait déjà, la
-- reprise générale ci-dessus a posé la même ligne, et la seconde ne la
-- redouble pas.
--
-- ## POURQUOI UNE TABLE, SUR LE MODÈLE EXACT DE `prestation_type_
-- ## intervention` (9K29, D243) ET `checklist_modele_type_intervention`
-- ## (9K30A, D246), ET NON LE SCALAIRE QU'ELLE REMPLACE
--
-- Le scalaire `famille_id` portait déjà « zéro ou une famille ». Ce qui
-- change est la MULTIPLICITÉ : une prestation peut viser PLUSIEURS familles
-- À LA FOIS SANS POUVOIR SE DÉDOUBLER — son `code` est unique par société, et
-- `intervention_prestation` la désigne par un identifiant unique. Un
-- scalaire ne suffit donc plus, pour le même motif qui a fait amender D235
-- deux fois déjà (D243 pour `prestation`/type, D246 pour `checklist_modele`/
-- type) : une table de relation reste cohérente avec ce principe.
--
-- ## FORME DE POLITIQUE
--
-- « Filiation » (D103), exactement comme `prestation_type_intervention` :
-- une fille est visible si son parent (`prestation`) l'est, et aucune clause
-- de société propre n'est ajoutée — les DEUX clés étrangères composites
-- (vers `prestation` ET vers `famille_materiel`) l'empêchent déjà de
-- dériver.
--
-- ## CE QUE CETTE MIGRATION NE FAIT PAS
--
-- Elle ne crée, ne modifie ni ne désactive aucune prestation en production
-- (I9) — la reprise par libellé ne fait que RATTACHER une famille à une
-- prestation déjà existante, si les deux existent déjà. Elle ne touche à
-- aucune autre politique RLS existante.

-- ═══════════════════════════════════════════════════════════════════════════
-- `prestation_famille_materiel`
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE "prestation_famille_materiel" (
  "id"            uuid NOT NULL,
  "societe_id"    uuid NOT NULL,
  "prestation_id" uuid NOT NULL,
  "famille_id"    uuid NOT NULL,
  "cree_le"       timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "prestation_famille_materiel_pkey" PRIMARY KEY ("id")
);

-- La même famille ne se coche pas deux fois sur la même prestation.
CREATE UNIQUE INDEX "prestation_famille_materiel_prestation_id_famille_id_key"
  ON "prestation_famille_materiel" ("prestation_id", "famille_id");
CREATE INDEX "prestation_famille_materiel_societe_id_prestation_id_idx"
  ON "prestation_famille_materiel" ("societe_id", "prestation_id");

-- `Cascade` vers la prestation : une ligne « cette prestation vise cette
-- famille » n'a aucune vie propre sans sa prestation (même raisonnement
-- qu'`intervention_machine` vers `intervention`, D103, et que
-- `prestation_type_intervention` vers `prestation`, 9K29).
--
-- `Restrict` vers la famille : même raisonnement que l'ancien
-- `prestation_famille_fkey` (`prestation.famille_id`, L1-12) qu'elle
-- remplace — une famille qu'une prestation vise ne s'efface pas sous elle.
ALTER TABLE "prestation_famille_materiel"
  ADD CONSTRAINT "prestation_famille_materiel_societe_id_fkey"
    FOREIGN KEY ("societe_id") REFERENCES "societe"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "prestation_famille_materiel_societe_id_prestation_id_fkey"
    FOREIGN KEY ("societe_id", "prestation_id") REFERENCES "prestation"("societe_id", "id") ON DELETE CASCADE ON UPDATE RESTRICT,
  ADD CONSTRAINT "prestation_famille_materiel_societe_id_famille_id_fkey"
    FOREIGN KEY ("societe_id", "famille_id") REFERENCES "famille_materiel"("societe_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "prestation_famille_materiel" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "prestation_famille_materiel" FORCE ROW LEVEL SECURITY;

-- `WITH CHECK` répète le `USING` (L1-02c) : on ne rattache une famille qu'à
-- une prestation qu'on voit.
CREATE POLICY "cloisonnement_filiation" ON "prestation_famille_materiel"
  USING (
    EXISTS (
      SELECT 1 FROM "prestation" "p"
       WHERE "p"."id" = "prestation_famille_materiel"."prestation_id"
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "prestation" "p"
       WHERE "p"."id" = "prestation_famille_materiel"."prestation_id"
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON "prestation_famille_materiel" TO "codiplan_app";

CREATE TRIGGER "journal_audit" AFTER INSERT OR UPDATE OR DELETE ON "prestation_famille_materiel"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

-- LE VERROU D'ÉCRITURE DU PORTAIL (I3, D237, 9K16) — recopié verbatim des
-- trois politiques posées par `20261110120000_portail_securite_base_9k16`,
-- et son fondement y est écrit en entier. `prestation_famille_materiel`
-- n'existait pas ce jour-là, d'où ces trois CREATE POLICY ici plutôt qu'une
-- entrée de plus dans le tableau de 9K16 — une migration déjà appliquée ne
-- se modifie jamais (CLAUDE.md §7). Aucun chemin du portail n'écrit cette
-- table aujourd'hui ; le verrou ferme ce que la forme « filiation » laisserait
-- ouvert si un tel chemin naissait sans qu'on y pense.
CREATE POLICY "verrou_ecriture_portail_insertion" ON "prestation_famille_materiel"
  AS RESTRICTIVE FOR INSERT
  WITH CHECK (NULLIF(current_setting('app.client_id', true), '') IS NULL);

CREATE POLICY "verrou_ecriture_portail_modification" ON "prestation_famille_materiel"
  AS RESTRICTIVE FOR UPDATE
  USING (NULLIF(current_setting('app.client_id', true), '') IS NULL)
  WITH CHECK (NULLIF(current_setting('app.client_id', true), '') IS NULL);

CREATE POLICY "verrou_ecriture_portail_suppression" ON "prestation_famille_materiel"
  AS RESTRICTIVE FOR DELETE
  USING (NULLIF(current_setting('app.client_id', true), '') IS NULL);

COMMENT ON TABLE "prestation_famille_materiel" IS
  'Les familles de matériel où une prestation du catalogue est PROPOSÉE au technicien (9L04J, décision d''Alexis du 13/11/2026 : « Filtrer par matériel »). VIDE = générale, proposée sur TOUTE machine. Table métier de la première catégorie de I1, forme « filiation » (D103) : une fille est visible si son parent (prestation) l''est. REMPLACE le scalaire famille_id de L1-12 (D109/D113) — une prestation vise zéro, une ou plusieurs familles à la fois sans pouvoir se dédoubler par code.';

-- ═══════════════════════════════════════════════════════════════════════════
-- REPRISE DES DONNÉES — puis suppression de l'ancienne colonne
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 1. L'ANCIEN SCALAIRE : une valeur NON NULLE devient UNE ligne de liaison ;
--    `NULL` (« aucune famille », déjà « générale ») ne devient AUCUNE ligne.

INSERT INTO "prestation_famille_materiel"
  ("id", "societe_id", "prestation_id", "famille_id")
SELECT gen_random_uuid(), "societe_id", "id", "famille_id"
  FROM "prestation"
 WHERE "famille_id" IS NOT NULL;

-- 2. LE CONSTAT DE L'INCIDENT, PAR LIBELLÉ (I9 — aucun identifiant en dur) :
--    la prestation « Remplacement écrous porteurs » rattachée à la famille
--    `PONT-ELEV` de la MÊME société, quand les deux existent. `ON CONFLICT
--    DO NOTHING` : sans effet si l'étape 1 a déjà posé cette même ligne.

INSERT INTO "prestation_famille_materiel"
  ("id", "societe_id", "prestation_id", "famille_id")
SELECT gen_random_uuid(), "p"."societe_id", "p"."id", "f"."id"
  FROM "prestation" "p"
  JOIN "famille_materiel" "f"
    ON "f"."societe_id" = "p"."societe_id" AND "f"."code" = 'PONT-ELEV'
 WHERE "p"."libelle" = 'Remplacement écrous porteurs'
ON CONFLICT ("prestation_id", "famille_id") DO NOTHING;

-- 3. L'ANCIENNE COLONNE ET SES OBJETS DÉPENDANTS, EXPLICITEMENT — plutôt que
--    de compter sur l'abandon implicite d'un index ou d'une contrainte par
--    `DROP COLUMN` (même discipline que le reste de ce dépôt : toute action
--    est nommée, §9).

ALTER TABLE "prestation" DROP CONSTRAINT "prestation_famille_fkey";
DROP INDEX "prestation_societe_id_famille_id_idx";
ALTER TABLE "prestation" DROP COLUMN "famille_id";
