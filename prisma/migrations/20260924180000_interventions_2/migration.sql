-- ═══════════════════════════════════════════════════════════════════════════
-- LA FICHE INTERVENTION RÉORGANISÉE — l'historique des pauses et la note
-- interne (ticket 50-INTERVENTIONS-2, refs SAV-09, SAV-02).
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Retour d'Alexis du 23/09/2026 (point 3) : « il manque le suivi/historique
-- d'une intervention en pause (ex. pièce en commande) ». `intervention` porte
-- déjà une suspension — `motif_suspension`, `piece_attendue_ref`,
-- `date_dispo_prevue`, `suspendue_le` — mais ces quatre colonnes sont
-- RÉÉCRITES à chaque suspension : la seconde efface la première, et SAV-09
-- (« 2 pauses successives restent lisibles ») est aujourd'hui impossible.
--
-- ## CE QUE CETTE MIGRATION FAIT
--
--   1. `intervention_pause` — une ligne par suspension, jamais réécrite :
--      OUVERTE par `suspendreIntervention`, FERMÉE par `reprendreIntervention`
--      (`lib/interventions/depot.ts`). Forme « filiation » (D103), sur le
--      modèle exact d'`intervention_prestation`.
--   2. `intervention.note_interne` — une colonne texte, visible et
--      modifiable par les rôles back-office SEULEMENT (jamais le terrain, le
--      bon, le portail ou un courriel — c'est une discipline du DÉPÔT :
--      aucune fonction de `depot-rapport-terrain.ts`, de `bon.ts` ni d'un
--      module de portail ne la lit).
--   3. LA REPRISE DE DONNÉES : chaque intervention actuellement `suspendue`
--      reçoit UNE pause ouverte, construite depuis ses quatre colonnes
--      existantes. Elle est SÛRE : `20260913250000_rattrapage_suspensions_r3_02`
--      garantit déjà qu'aucune ligne `suspendue` ne porte `motif_suspension`
--      ou `suspendue_le` à `NULL` — cette migration ne lit donc rien qu'elle
--      devrait inventer.
--
-- ## CE QU'ELLE NE FAIT PAS
--
-- **Elle ne touche NI ne retire les quatre colonnes existantes.** D'autres
-- écrans les lisent (le terrain, notamment), et `intervention_sortie_de_suspension`
-- continue de les nettoyer à la reprise — cette table est l'HISTORIQUE, pas
-- un remplacement.
--
-- **`ouvert_par` et `fermee_par` sont NULLABLES.** La reprise de données ne
-- connaît l'auteur d'AUCUNE suspension déjà en base — aucune colonne ne l'a
-- jamais porté — et inventer une valeur serait la faute que le §8 du
-- `CLAUDE.md` interdit : ne jamais inventer une valeur par défaut.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. LA NOTE INTERNE — une colonne sur `intervention`
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "intervention" ADD COLUMN "note_interne" text;

COMMENT ON COLUMN "intervention"."note_interne" IS
  'La note interne (50-INTERVENTIONS-2) — visible et modifiable par les rôles BACK-OFFICE seulement. Régime INVERSE de commentaire_technicien/suite_a_donner : jamais sur le terrain, le bon imprimable, le portail ni un courriel. NULL tant que rien n''a été écrit.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. L'HISTORIQUE DES PAUSES — `intervention_pause`
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Forme « filiation » (D103), exactement sur le modèle d'`intervention_prestation`
-- (migration `20260922100000_rapport_terrain_bon_2`) : une fille est visible
-- si son parent l'est.

CREATE TABLE "intervention_pause" (
  "id"              uuid NOT NULL,
  "societe_id"      uuid NOT NULL,
  "intervention_id" uuid NOT NULL,

  "debut" timestamptz(3) NOT NULL,
  -- NULL = la pause est en cours. Jamais « on ne sait pas » : l'index partiel
  -- ci-dessous n'autorise qu'UNE pause ouverte par intervention.
  "fin"   timestamptz(3),

  "motif" text NOT NULL,

  -- L'ATTENTE DE PIÈCE — même régime que sur `intervention` (RG-INT-06) : la
  -- référence et sa date de disponibilité vont ENSEMBLE, ou pas du tout.
  "piece_attendue_ref" text,
  "date_dispo_prevue"  date,

  -- QUI a ouvert / fermé la pause — NULLABLES, voir l'en-tête de cette
  -- migration.
  "ouvert_par" uuid,
  "fermee_par" uuid,

  "cree_le" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "intervention_pause_pkey" PRIMARY KEY ("id"),

  -- Une pause dont la fin précède le début n'est pas une pause. Strict, et
  -- non `>=` : une pause de durée nulle ne mesure rien (même règle que
  -- `segment_travail_fin_apres_debut`).
  CONSTRAINT "intervention_pause_fin_apres_debut" CHECK ("fin" IS NULL OR "fin" > "debut"),

  -- RG-INT-06, transposée à l'historique : une référence sans date ferait une
  -- attente sans horizon.
  CONSTRAINT "intervention_pause_piece_attendue_a_son_horizon" CHECK (
    ("piece_attendue_ref" IS NOT NULL) = ("date_dispo_prevue" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "intervention_pause_societe_id_id_key"
  ON "intervention_pause" ("societe_id", "id");
CREATE INDEX "intervention_pause_societe_id_intervention_id_debut_idx"
  ON "intervention_pause" ("societe_id", "intervention_id", "debut");

-- ── UNE SEULE PAUSE OUVERTE PAR INTERVENTION ────────────────────────────────
--
-- *Ce n'est pas une règle de gestion inventée, c'est l'invariant même que
-- SAV-09 demande* : une intervention ne peut pas être « en pause » deux fois
-- à la fois. L'index PARTIEL ne contraint que les pauses ouvertes — les
-- pauses FERMÉES restent toutes lisibles, c'est tout l'objet de cette table.
CREATE UNIQUE INDEX "intervention_pause_une_seule_ouverte"
  ON "intervention_pause" ("societe_id", "intervention_id")
  WHERE "fin" IS NULL;

-- Les DEUX actions référentielles sont dites (§9, 24/08). `CASCADE` vers
-- l'intervention, comme `intervention_prestation` : une ligne d'historique
-- n'a aucun sens sans son intervention. `RESTRICT` vers les auteurs : un
-- compte qui a ouvert ou fermé une pause ne s'efface pas en emportant la
-- trace.
ALTER TABLE "intervention_pause"
  ADD CONSTRAINT "intervention_pause_societe_id_fkey"
    FOREIGN KEY ("societe_id") REFERENCES "societe"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "intervention_pause_societe_id_intervention_id_fkey"
    FOREIGN KEY ("societe_id", "intervention_id") REFERENCES "intervention"("societe_id", "id")
    ON DELETE CASCADE ON UPDATE RESTRICT,
  ADD CONSTRAINT "intervention_pause_ouvert_par_fkey"
    FOREIGN KEY ("ouvert_par", "societe_id") REFERENCES "utilisateur_societe"("utilisateur_id", "societe_id")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "intervention_pause_fermee_par_fkey"
    FOREIGN KEY ("fermee_par", "societe_id") REFERENCES "utilisateur_societe"("utilisateur_id", "societe_id")
    ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "intervention_pause" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "intervention_pause" FORCE ROW LEVEL SECURITY;

-- TROIS POLITIQUES, une par verbe accordé — jamais `FOR ALL` (même
-- raisonnement que `segment_travail` et `intervention_signature`) :
-- `DELETE` n'en a AUCUNE, et sous `FORCE ROW LEVEL SECURITY` un verbe sans
-- politique est refusé pour tout le monde. *Un historique qui peut
-- disparaître sans trace n'en est pas un.* Chaque politique d'écriture
-- énonce son `WITH CHECK`, même quand il répète le `USING` (L1-02c).
CREATE POLICY "cloisonnement_filiation_lecture" ON "intervention_pause"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "intervention" "i"
       WHERE "i"."id" = "intervention_pause"."intervention_id"
    )
  );

CREATE POLICY "cloisonnement_filiation_ajout" ON "intervention_pause"
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "intervention" "i"
       WHERE "i"."id" = "intervention_pause"."intervention_id"
    )
  );

-- `UPDATE` reste ouvert : c'est lui qui FERME une pause (`fin`, `fermee_par`).
-- Une pause fermée par erreur se corrige ; le journal d'audit garde l'avant
-- et l'après (I8) — elle ne s'efface pas pour autant.
CREATE POLICY "cloisonnement_filiation_modification" ON "intervention_pause"
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM "intervention" "i"
       WHERE "i"."id" = "intervention_pause"."intervention_id"
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "intervention" "i"
       WHERE "i"."id" = "intervention_pause"."intervention_id"
    )
  );

REVOKE DELETE ON "intervention_pause" FROM "codiplan_app";
GRANT SELECT, INSERT, UPDATE ON "intervention_pause" TO "codiplan_app";

CREATE TRIGGER "journal_audit" AFTER INSERT OR UPDATE OR DELETE ON "intervention_pause"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

COMMENT ON TABLE "intervention_pause" IS
  'L''HISTORIQUE des suspensions d''une intervention (50-INTERVENTIONS-2, SAV-09). Contrairement à intervention.motif_suspension/piece_attendue_ref/date_dispo_prevue/suspendue_le, réécrites à chaque suspension, cette table ne réécrit JAMAIS une ligne : une suspension OUVRE une ligne (fin NULL), une reprise la FERME. Table métier de la première catégorie de I1, forme « filiation » (D103) : une fille est visible si son parent l''est. Une seule pause ouverte par intervention (index partiel) — DELETE est refusé à tout le monde, sous FORCE ROW LEVEL SECURITY.';

COMMENT ON COLUMN "intervention_pause"."fin" IS
  'NULL veut dire « la pause est en cours », jamais « on ne sait pas » : l''index partiel intervention_pause_une_seule_ouverte n''autorise qu''UNE pause ouverte par intervention, ce qui rend cet état non ambigu.';

COMMENT ON COLUMN "intervention_pause"."ouvert_par" IS
  'QUI a ouvert la pause. NULLABLE : la reprise de données de cette migration ne connaît l''auteur d''aucune suspension déjà en base — aucune colonne ne l''a jamais porté, et inventer une valeur serait la faute que le §8 du CLAUDE.md interdit.';

COMMENT ON COLUMN "intervention_pause"."fermee_par" IS
  'QUI a fermé la pause. NULL tant qu''elle est ouverte, ou pour la même raison que ouvert_par sur les lignes reprises depuis une suspension déjà close au moment de cette migration (aucune, en pratique : seules les suspensions COURANTES sont reprises).';

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. LA REPRISE DE DONNÉES — une pause ouverte par suspension COURANTE
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Sûre par construction (voir l'en-tête) : `20260913250000_rattrapage_suspensions_r3_02`
-- garantit que toute ligne `suspendue` porte déjà `motif_suspension` et
-- `suspendue_le`. Rien n'est inventé ; `piece_attendue_ref` et
-- `date_dispo_prevue` voyagent NULL ensemble quand l'attente n'est pas une
-- pièce, exactement comme sur `intervention`.

INSERT INTO "intervention_pause"
  ("id", "societe_id", "intervention_id", "debut", "motif",
   "piece_attendue_ref", "date_dispo_prevue")
SELECT gen_random_uuid(), "societe_id", "id", "suspendue_le", "motif_suspension",
       "piece_attendue_ref", "date_dispo_prevue"
  FROM "intervention"
 WHERE "statut" = 'suspendue';
