-- 9K30A-CHECKLIST-GABARITS-VALIDES — UN MODÈLE DE CHECKLIST PEUT VISER
-- PLUSIEURS TYPES D'INTERVENTION À LA FOIS.
--
-- Décision d'Alexis du 12/11/2026 ~17h10 (réponse à la question posée par
-- 9K30, arrêté sans committer le 12/11/2026 à 16h23) : « Table de liaison ».
-- Origine : 24 gabarits de check-list validés (atelier des 10/11 et 11/11)
-- se répartissent en « entretien » (préventif sous contrat ET hors contrat —
-- DEUX types à la fois) et « installation » (un seul) — `checklist_modele.
-- type_intervention`, posée nullable mais SCALAIRE par 9K08-CHECKLIST-SCHEMA
-- (D235), ne peut représenter ce « et » sans se dédoubler en plusieurs
-- modèles au même code.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- CE QUE CETTE MIGRATION FAIT
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Une table nouvelle, `checklist_modele_type_intervention` : les types
-- d'intervention où un modèle de checklist est PROPOSÉ (cascade de
-- résolution, CK2). VIDE (aucune ligne) = proposé pour TOUS les types — même
-- sens que l'ancienne colonne `NULL` qu'elle remplace.
--
-- Reprise des données existantes de `checklist_modele.type_intervention` :
-- une valeur NON NULLE devient UNE ligne ; `NULL` ne devient AUCUNE ligne
-- (déjà le sens « tous les types »). La colonne est ensuite SUPPRIMÉE — plus
-- aucun code applicatif ne la lit après ce ticket (`lib/checklists/cascade.ts`,
-- `lib/checklists/depot.ts`, `lib/checklists/saisie.ts` et les écrans de
-- paramétrage lisent tous désormais la table).
--
-- ## POURQUOI UNE TABLE, SUR LE MODÈLE EXACT DE `prestation_type_intervention`
-- ## (9K29, D243), ET NON UN TABLEAU `TypeIntervention[]`
--
-- D235 (09/11/2026) a tranché contre un tableau d'énumération typé pour CE
-- rattachement précis — une colonne nullable scalaire, UN SEUL type. D243
-- (11/11/2026, 9K29) l'a déjà amendée UNE FOIS, pour `prestation`, avec le
-- même raisonnement qui s'applique ici À L'IDENTIQUE : un modèle de checklist
-- vise ZÉRO, UN ou PLUSIEURS types À LA FOIS SANS POUVOIR SE DÉDOUBLER — son
-- `code` est unique par société, et la cascade de résolution (`lib/
-- checklists/cascade.ts`) le désigne par un identifiant UNIQUE. Une colonne
-- nullable scalaire ne suffit donc plus ici non plus ; cette migration amende
-- D235 une SECONDE fois, dans ce seul sens, pour le même motif que D243.
--
-- ## FORME DE POLITIQUE
--
-- « Filiation » (D103), chaînée sur `checklist_modele` — EXACTEMENT comme
-- `checklist_version`/`checklist_point` (9K08), jusqu'au verrou d'écriture
-- du portail (I3, D237, 9K16) : le gardien `tests/isolation/politiques-
-- rls.test.ts` l'exige sur TOUTE table de la première catégorie de I1 qui
-- n'est pas rangée dans `TABLES_VERROU_PORTAIL_TOTAL` ni `TABLES_SANS_
-- VERROU_PORTAIL` — y compris une table « filiation » chaînée sur un parent
-- « interne » : le chaînage ferme la LECTURE sous un rôle client, jamais à
-- lui seul la preuve que l'ÉCRITURE l'est aussi. Même triple politique que
-- `prestation_type_intervention` (9K29), recopiée verbatim plus bas.
--
-- ## CE QUE CETTE MIGRATION NE FAIT PAS
--
-- Elle ne touche à aucune autre table, ni à la contrainte
-- `checklist_modele_un_seul_rattachement` (9K17A, D238 — le triplet modèle /
-- sous-type / famille reste AU PLUS UN, raisonnement différent, non touché).
-- Aucun gabarit n'est semé en production par cette migration — le contenu
-- des 24 gabarits de départ est du code (`lib/checklists/gabarits-de-
-- depart.ts`), jamais une donnée posée par une migration (I9).

-- ═══════════════════════════════════════════════════════════════════════════
-- `checklist_modele_type_intervention`
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE "checklist_modele_type_intervention" (
  "id"                  uuid NOT NULL,
  "societe_id"          uuid NOT NULL,
  "checklist_modele_id" uuid NOT NULL,
  "type_intervention"   "TypeIntervention" NOT NULL,
  "cree_le"             timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "checklist_modele_type_intervention_pkey" PRIMARY KEY ("id")
);

-- Le même type ne se coche pas deux fois sur le même modèle.
CREATE UNIQUE INDEX "checklist_modele_type_intervention_modele_type_key"
  ON "checklist_modele_type_intervention" ("checklist_modele_id", "type_intervention");
CREATE INDEX "checklist_modele_type_intervention_societe_modele_idx"
  ON "checklist_modele_type_intervention" ("societe_id", "checklist_modele_id");

-- `Cascade` vers le modèle : une ligne « ce modèle vise ce type » n'a aucune
-- vie propre sans son modèle (même raisonnement que `prestation_type_
-- intervention` vers `prestation`, D103). Sans effet aujourd'hui — un modèle
-- de checklist n'est jamais supprimé, seulement désactivé (D235) —, et ce
-- n'est pas une raison de choisir `Restrict` par confort : le jour où un tel
-- chemin existe, `Cascade` reste le sens correct.
ALTER TABLE "checklist_modele_type_intervention"
  ADD CONSTRAINT "checklist_modele_type_intervention_societe_fkey"
    FOREIGN KEY ("societe_id") REFERENCES "societe"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "checklist_modele_type_intervention_societe_modele_fkey"
    FOREIGN KEY ("societe_id", "checklist_modele_id") REFERENCES "checklist_modele"("societe_id", "id") ON DELETE CASCADE ON UPDATE RESTRICT;

ALTER TABLE "checklist_modele_type_intervention" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "checklist_modele_type_intervention" FORCE ROW LEVEL SECURITY;

-- FORME « FILIATION » (D103) : une fille est visible si son parent l'est —
-- ici `checklist_modele`, qui porte lui-même la forme « interne ». Même
-- politique, verbatim, que celle de `checklist_version` (9K08) : aucune
-- clause de société propre n'est ajoutée.
CREATE POLICY "cloisonnement_filiation" ON "checklist_modele_type_intervention"
  USING (
    EXISTS (
      SELECT 1 FROM "checklist_modele" "m"
       WHERE "m"."id" = "checklist_modele_type_intervention"."checklist_modele_id"
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "checklist_modele" "m"
       WHERE "m"."id" = "checklist_modele_type_intervention"."checklist_modele_id"
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON "checklist_modele_type_intervention" TO "codiplan_app";

CREATE TRIGGER "journal_audit" AFTER INSERT OR UPDATE OR DELETE ON "checklist_modele_type_intervention"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

-- LE VERROU D'ÉCRITURE DU PORTAIL (I3, D237, 9K16) — recopié verbatim des
-- trois politiques posées par `20261110120000_portail_securite_base_9k16`
-- pour `checklist_version`/`checklist_point` (le même patron de filiation
-- chaînée sur `checklist_modele`), et son fondement y est écrit en entier.
-- `checklist_modele_type_intervention` n'existait pas ce jour-là, d'où ces
-- trois `CREATE POLICY` ici plutôt qu'une entrée de plus dans la liste de
-- 9K16 — une migration déjà appliquée ne se modifie jamais (CLAUDE.md §7).
-- Le gardien (`tests/isolation/politiques-rls.test.ts`) exige ce verrou sur
-- TOUTE table de la première catégorie de I1 qui n'est ni dans `TABLES_
-- VERROU_PORTAIL_TOTAL` ni dans `TABLES_SANS_VERROU_PORTAIL` — y COMPRIS une
-- table de forme « filiation » chaînée sur un parent « interne » : le
-- chaînage ferme la LECTURE sous un rôle client, jamais à lui seul la
-- preuve que l'ÉCRITURE l'est aussi, et ce verrou la ferme nommément.
CREATE POLICY "verrou_ecriture_portail_insertion" ON "checklist_modele_type_intervention"
  AS RESTRICTIVE FOR INSERT
  WITH CHECK (NULLIF(current_setting('app.client_id', true), '') IS NULL);

CREATE POLICY "verrou_ecriture_portail_modification" ON "checklist_modele_type_intervention"
  AS RESTRICTIVE FOR UPDATE
  USING (NULLIF(current_setting('app.client_id', true), '') IS NULL)
  WITH CHECK (NULLIF(current_setting('app.client_id', true), '') IS NULL);

CREATE POLICY "verrou_ecriture_portail_suppression" ON "checklist_modele_type_intervention"
  AS RESTRICTIVE FOR DELETE
  USING (NULLIF(current_setting('app.client_id', true), '') IS NULL);

COMMENT ON TABLE "checklist_modele_type_intervention" IS
  'Les types d''intervention où un modèle de checklist est PROPOSÉ (9K30A, décision d''Alexis du 12/11/2026 ~17h10). VIDE = proposé pour TOUS les types. Table métier de la première catégorie de I1, forme « filiation » (D103) chaînée sur checklist_modele (forme « interne », D94) — même patron que checklist_version, verrou d''écriture portail inclus (I3, D237). Amende D235 (déjà amendée une première fois par D243 pour prestation_type_intervention) : une table de relation remplace, pour ce rattachement, la colonne nullable scalaire — un modèle vise zéro, un ou plusieurs types à la fois sans pouvoir se dédoubler par code.';

-- ═══════════════════════════════════════════════════════════════════════════
-- REPRISE DES DONNÉES — puis suppression de l'ancienne colonne
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Une valeur NON NULLE devient UNE ligne de liaison ; `NULL` (« tous les
-- types ») ne devient AUCUNE ligne — c'est déjà le sens qu'elle portait.

INSERT INTO "checklist_modele_type_intervention"
  ("id", "societe_id", "checklist_modele_id", "type_intervention")
SELECT gen_random_uuid(), "societe_id", "id", "type_intervention"
  FROM "checklist_modele"
 WHERE "type_intervention" IS NOT NULL;

ALTER TABLE "checklist_modele" DROP COLUMN "type_intervention";
