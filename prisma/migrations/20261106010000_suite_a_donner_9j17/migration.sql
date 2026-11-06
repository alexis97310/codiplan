-- ═══════════════════════════════════════════════════════════════════════════
-- 9J17-SUITE-A-DONNER-SCHEMA — LA TABLE `suite_a_donner` (D231)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `Intervention.suite_a_donner` — texte libre saisi par le technicien sur le
-- terrain, « ce qu'il reste à faire, ou à surveiller, entre deux visites » —
-- RESTE INCHANGÉ : c'est la trace terrain brute (I4/I5), rien ne le retire ni
-- ne le transforme. Rien, en revanche, ne le lisait côté back-office : aucune
-- table, aucun écran.
--
-- FLX-1 proposait HUIT états. D231 en retient SEPT : juste ce dont FLX-2,
-- FLX-3 et FLX-8 — les seules relances qui restent au périmètre V1 — ont
-- besoin. `piece_attendue` n'en est pas un huitième : elle est portée par
-- deux colonnes nullables, même patron que `Intervention.piece_attendue_ref`/
-- `date_dispo_prevue` (RG-INT-06, D117).
--
-- Forme « filiation » (D103, septième entrée) : `suite_a_donner` ne porte
-- aucun `client_id` ni `perimetre_sites` propre — sa visibilité se déduit
-- entièrement de `intervention_origine_id`, exactement le raisonnement que
-- D103 a tenu pour `intervention_machine`.

CREATE TYPE "StatutSuiteADonner" AS ENUM (
  'a_qualifier', 'qualifiee', 'accord_attendu', 'accord_recu', 'sans_suite',
  'a_replanifier', 'cloturee'
);

CREATE TABLE "suite_a_donner" (
  "id"                       uuid NOT NULL,
  "societe_id"               uuid NOT NULL,
  "intervention_origine_id"  uuid NOT NULL,
  "intervention_reprise_id"  uuid,
  "statut"                   "StatutSuiteADonner" NOT NULL DEFAULT 'a_qualifier',
  "motif_sans_suite"         text,
  "piece_attendue_ref"       text,
  "date_dispo_prevue"        date,
  "qualifiee_par"            uuid,
  "qualifiee_le"             timestamptz(3),
  "cree_le"                  timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "modifie_le"               timestamptz(3) NOT NULL,

  CONSTRAINT "suite_a_donner_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "suite_a_donner_societe_id_intervention_origine_id_idx"
  ON "suite_a_donner" ("societe_id", "intervention_origine_id");

-- `CASCADE` vers l'intervention D'ORIGINE, comme les autres filiations
-- d'`intervention` : une suite à donner n'a aucun sens sans elle. `RESTRICT`
-- vers l'intervention de REPRISE — elle ne fait que nommer une intervention
-- future, elle ne décide de rien, et rien n'empêche qu'on la protège tant
-- qu'une suite à donner la désigne.
ALTER TABLE "suite_a_donner"
  ADD CONSTRAINT "suite_a_donner_societe_id_fkey"
    FOREIGN KEY ("societe_id") REFERENCES "societe"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "suite_a_donner_societe_id_intervention_origine_id_fkey"
    FOREIGN KEY ("societe_id", "intervention_origine_id") REFERENCES "intervention"("societe_id", "id") ON DELETE CASCADE ON UPDATE RESTRICT,
  ADD CONSTRAINT "suite_a_donner_societe_id_intervention_reprise_id_fkey"
    FOREIGN KEY ("societe_id", "intervention_reprise_id") REFERENCES "intervention"("societe_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ───────────────────────────────────────────────────────────────────────────
-- LES ÉQUIVALENCES, ÉCRITES DANS LES DEUX SENS — TOUTES VALIDÉES (pas
-- `NOT VALID`, D104) : la table NAÎT avec cette migration, zéro ligne
-- existante ne peut l'enfreindre.
-- ───────────────────────────────────────────────────────────────────────────

ALTER TABLE "suite_a_donner"
  -- Une clôture « sans suite » sans motif effacerait la raison du renoncement ;
  -- un motif posé sur un dossier qui suit son cours dirait qu'il est sans
  -- suite alors qu'il ne l'est pas (même régime que `demande.motif_cloture`,
  -- D102).
  ADD CONSTRAINT "suite_a_donner_sans_suite_a_son_motif" CHECK (
    ("statut" = 'sans_suite') = ("motif_sans_suite" IS NOT NULL)
  ),
  -- RG-INT-06 exige les DEUX pour une attente de pièce. Une référence sans
  -- date ferait une file d'attente SANS HORIZON.
  ADD CONSTRAINT "suite_a_donner_piece_attendue_a_son_horizon" CHECK (
    ("piece_attendue_ref" IS NOT NULL) = ("date_dispo_prevue" IS NOT NULL)
  ),
  -- Une attente de pièce n'existe que SOUS `accord_recu` — ce n'est PAS un
  -- huitième état (D231), mais elle suppose quand même un statut précis.
  ADD CONSTRAINT "suite_a_donner_piece_attendue_suppose_accord_recu" CHECK (
    "piece_attendue_ref" IS NULL OR "statut" = 'accord_recu'
  ),
  -- QUI a qualifié, et QUAND, les deux ensemble — même régime que
  -- `intervention.temps_valide_par`/`temps_valide_le` (D120).
  ADD CONSTRAINT "suite_a_donner_qualifiee_a_sa_date" CHECK (
    ("qualifiee_par" IS NULL) = ("qualifiee_le" IS NULL)
  );

ALTER TABLE "suite_a_donner" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "suite_a_donner" FORCE ROW LEVEL SECURITY;

-- FORME « FILIATION » (D103, D231) : une fille est visible si son parent
-- l'est. AUCUNE clause de société ni de périmètre — ce serait une seconde
-- lecture du même critère que celui que `intervention` porte déjà. `WITH
-- CHECK` répète le `USING`, même forme qu'`intervention_piece_remplacee`.
CREATE POLICY "cloisonnement_filiation" ON "suite_a_donner"
  USING (
    EXISTS (
      SELECT 1 FROM "intervention" "i"
       WHERE "i"."id" = "suite_a_donner"."intervention_origine_id"
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "intervention" "i"
       WHERE "i"."id" = "suite_a_donner"."intervention_origine_id"
    )
  );

-- Aucun `DELETE` : rien ne supprime une suite à donner, seule la CASCADE
-- depuis `intervention` l'emporte. Sous `FORCE ROW LEVEL SECURITY`, l'absence
-- de grant referme ce verbe pour `codiplan_app` sans qu'aucune politique n'ait
-- à le dire.
GRANT SELECT, INSERT, UPDATE ON "suite_a_donner" TO "codiplan_app";

CREATE TRIGGER "journal_audit" AFTER INSERT OR UPDATE OR DELETE ON "suite_a_donner"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

COMMENT ON TABLE "suite_a_donner" IS
  'LA SUITE À DONNER (9J17-SUITE-A-DONNER-SCHEMA, D231) : le suivi, côté back-office, de ce qu''un technicien a signalé en texte libre dans intervention.suite_a_donner. SEPT états (pas huit, D231) — piece_attendue_ref/date_dispo_prevue portent l''attente de pièce sans en faire un état de plus. Table métier de la première catégorie de I1, forme « filiation » (D103) : visible si son intervention D''ORIGINE l''est. SELECT, INSERT, UPDATE seulement pour codiplan_app, aucun DELETE.';

COMMENT ON COLUMN "suite_a_donner"."intervention_origine_id" IS
  'Le PARENT au sens RLS (D103, D231) : c''est cette intervention, et elle seule, qui décide qui a le droit de voir cette ligne. ON DELETE CASCADE.';

COMMENT ON COLUMN "suite_a_donner"."intervention_reprise_id" IS
  'L''intervention de reprise, une fois créée — NULLABLE jusque-là. Ne décide JAMAIS de la visibilité (D231) : seule intervention_origine_id est le parent au sens RLS. ON DELETE RESTRICT.';

COMMENT ON COLUMN "suite_a_donner"."motif_sans_suite" IS
  'Exigé dès que le statut est sans_suite, refusé sinon — les deux sens. Texte LIBRE, même régime que intervention.motif_suspension : aucune énumération de motifs de plus (§9, 20/08).';

COMMENT ON COLUMN "suite_a_donner"."piece_attendue_ref" IS
  'Ce qui DÉSIGNE une attente de pièce (même patron que intervention.piece_attendue_ref, RG-INT-06) — PAS un huitième état (D231). N''existe que sous accord_recu. Exige date_dispo_prevue — une référence sans date ferait une file d''attente sans horizon.';
