-- ═══════════════════════════════════════════════════════════════════════════
-- 9K28-CHECKLIST-REPONSE-PHOTO — UN SIXIÈME TYPE DE RÉPONSE, « photo »
-- (décision d'Alexis du 11/11/2026 ~08h05, atelier des check-lists :
-- « Oui, dès maintenant » — revient sur le report du 29/10, inscrit au
-- commentaire de `TypeReponseChecklist` par 9K18-CHECKLIST-DOMAINE)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Cette migration AJOUTE, elle ne touche aucune migration déjà appliquée.
--
-- 1. `TypeReponseChecklist` gagne `photo`.
-- 2. `checklist_reponse.valeur_photo` — AUCUNE valeur propre, un simple
--    marqueur de présence posé `true` par le dépôt UNIQUEMENT quand au moins
--    une photo est déjà liée (même transaction) ; la contrainte d'exclusivité
--    (`checklist_reponse_valeur_unique`, `num_nonnulls`) est REPOSÉE sur les
--    SIX colonnes de valeur.
-- 3. `checklist_reponse_photo` — table NEUVE, le lien d'une réponse `photo`
--    vers une ou plusieurs photos (`document`). Forme « filiation » CHAÎNÉE
--    sur `checklist_reponse` (jamais directement sur `intervention`), même
--    patron que `vgp_observation` sur `vgp_verification`
--    (20260913240000_vgp_verification_l9) : l'adossement se chaîne, aucune
--    clause de société propre n'est écrite dans sa politique.
--
-- `document.intervention_id` reste la SEULE cible de la photo elle-même
-- (`document_cible_unique` inchangée) : une photo de checklist est déposée
-- par L'OUTIL PHOTOS EXISTANT (`deposerPhotoIntervention`,
-- `POST /api/terrain/{id}/photos`), jamais une seconde chaîne de dépôt — ce
-- lien ne fait qu'ÉTIQUETER laquelle répond à quel point.
--
-- ## LA RESTRICTION POSTGRESQL SUR LES VALEURS D'ÉNUMÉRATION NEUVES
--
-- Une valeur ajoutée par `ALTER TYPE ... ADD VALUE` ne peut pas être UTILISÉE
-- dans la transaction qui l'ajoute (même restriction que 9K18, documentée
-- dans son fichier). Les comparaisons qui suivent comparent donc
-- `"type_reponse"::text`, jamais `"type_reponse" = 'photo'::"TypeReponseChecklist"`.
--
-- Aucune ligne n'existe encore dans `checklist_point` ni `checklist_reponse`
-- pour le type `photo` (aucun gabarit de ce lot n'en sème, CK10 désignera les
-- points plus tard) : la contrainte neuve est posée VALIDÉE, rien à resserrer.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. L'ÉNUMÉRATION
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TYPE "TypeReponseChecklist" ADD VALUE 'photo';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. `checklist_reponse.valeur_photo` — SIXIÈME COLONNE, EXCLUSIVITÉ REPOSÉE
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "checklist_reponse" ADD COLUMN "valeur_photo" boolean;

-- REPOSÉE sur les SIX colonnes — même contrainte, même nom, un ALTER TABLE
-- ... DROP puis ADD plutôt qu'une migration déjà appliquée réécrite.
ALTER TABLE "checklist_reponse" DROP CONSTRAINT "checklist_reponse_valeur_unique";
ALTER TABLE "checklist_reponse"
  ADD CONSTRAINT "checklist_reponse_valeur_unique" CHECK (
    num_nonnulls(
      "valeur_conforme", "valeur_mesuree", "valeur_fait", "valeur_choix",
      "valeur_texte", "valeur_photo"
    ) = 1
  );

-- `valeur_photo`, QUAND POSÉE, NE VAUT JAMAIS FAUX (9K28) — un marqueur de
-- présence n'a qu'une seule valeur utile ; `false` n'aurait aucun sens
-- (l'absence de photo se lit par l'ABSENCE de réponse, pas par une valeur).
ALTER TABLE "checklist_reponse"
  ADD CONSTRAINT "checklist_reponse_valeur_photo_vraie" CHECK (
    "valeur_photo" IS NULL OR "valeur_photo" = true
  );

COMMENT ON COLUMN "checklist_reponse"."valeur_photo" IS
  'photo (9K28-CHECKLIST-REPONSE-PHOTO) — AUCUNE valeur propre, un marqueur de présence posé true UNIQUEMENT quand au moins une photo est déjà liée via checklist_reponse_photo (même transaction, enregistrerReponsePhoto). Exclusivité : checklist_reponse_valeur_unique.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. `checklist_reponse_photo` — LE LIEN, FORME « FILIATION » CHAÎNÉE
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE "checklist_reponse_photo" (
  "id"                   uuid NOT NULL,
  "societe_id"           uuid NOT NULL,
  "checklist_reponse_id" uuid NOT NULL,
  "document_id"          uuid NOT NULL,

  "cree_le" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "checklist_reponse_photo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "checklist_reponse_photo_societe_id_id_key"
  ON "checklist_reponse_photo" ("societe_id", "id");
CREATE UNIQUE INDEX "checklist_reponse_photo_societe_reponse_document_key"
  ON "checklist_reponse_photo" ("societe_id", "checklist_reponse_id", "document_id");
CREATE INDEX "checklist_reponse_photo_societe_id_document_id_idx"
  ON "checklist_reponse_photo" ("societe_id", "document_id");

ALTER TABLE "checklist_reponse_photo"
  ADD CONSTRAINT "checklist_reponse_photo_societe_id_fkey"
    FOREIGN KEY ("societe_id") REFERENCES "societe"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "checklist_reponse_photo_societe_id_checklist_reponse_id_fkey"
    FOREIGN KEY ("societe_id", "checklist_reponse_id") REFERENCES "checklist_reponse"("societe_id", "id") ON DELETE CASCADE ON UPDATE RESTRICT,
  ADD CONSTRAINT "checklist_reponse_photo_societe_id_document_id_fkey"
    FOREIGN KEY ("societe_id", "document_id") REFERENCES "document"("societe_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- FORME « FILIATION » CHAÎNÉE sur `checklist_reponse` (jamais directement sur
-- `intervention`) — même patron que `vgp_observation` sur `vgp_verification`
-- (20260913240000_vgp_verification_l9) : la visibilité de `checklist_reponse`
-- se chaîne elle-même jusqu'à `intervention` (D103, D235), donc nul besoin de
-- répéter ce chaînage une seconde fois ici.
ALTER TABLE "checklist_reponse_photo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "checklist_reponse_photo" FORCE ROW LEVEL SECURITY;

CREATE POLICY "cloisonnement_filiation" ON "checklist_reponse_photo"
  USING (
    EXISTS (
      SELECT 1 FROM "checklist_reponse" "r"
       WHERE "r"."id" = "checklist_reponse_photo"."checklist_reponse_id"
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "checklist_reponse" "r"
       WHERE "r"."id" = "checklist_reponse_photo"."checklist_reponse_id"
    )
  );

-- LE VERROU PORTAIL, VARIANTE ÉCRITURE (9K16-PORTAIL-SECURITE-BASE, D237) —
-- cette table est de la première catégorie de I1 et REÇOIT le verrou
-- ÉCRITURE PAR DÉFAUT (`tablesVerrouEcriturePortail`,
-- `scripts/lib/politiques-rls.ts`) : trois politiques RESTRICTIVE, jamais
-- `FOR ALL`, qui ne touchent jamais la LECTURE (déjà ouverte au client par
-- D235, « filiation » chaînée ci-dessus). `checklist_reponse_photo` n'existait
-- pas au ticket 9K16 : ces trois CREATE POLICY vivent ici plutôt qu'une
-- entrée de plus dans son tableau — une migration déjà appliquée ne se
-- modifie jamais (CLAUDE.md §7), même patron que `sous_type_materiel`
-- (20261110130000_sous_type_materiel_9k17a).
CREATE POLICY "verrou_ecriture_portail_insertion" ON "checklist_reponse_photo"
  AS RESTRICTIVE FOR INSERT
  WITH CHECK (NULLIF(current_setting('app.client_id', true), '') IS NULL);

CREATE POLICY "verrou_ecriture_portail_modification" ON "checklist_reponse_photo"
  AS RESTRICTIVE FOR UPDATE
  USING (NULLIF(current_setting('app.client_id', true), '') IS NULL)
  WITH CHECK (NULLIF(current_setting('app.client_id', true), '') IS NULL);

CREATE POLICY "verrou_ecriture_portail_suppression" ON "checklist_reponse_photo"
  AS RESTRICTIVE FOR DELETE
  USING (NULLIF(current_setting('app.client_id', true), '') IS NULL);

-- IMMUABLE, comme `checklist_point` : un lien se pose ou ne se pose pas,
-- jamais ne se corrige (I6) — UPDATE n'aurait aucun sens sur un simple lien.
REVOKE UPDATE, DELETE ON "checklist_reponse_photo" FROM "codiplan_app";
GRANT SELECT, INSERT ON "checklist_reponse_photo" TO "codiplan_app";

CREATE TRIGGER "journal_audit" AFTER INSERT OR UPDATE OR DELETE ON "checklist_reponse_photo"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

COMMENT ON TABLE "checklist_reponse_photo" IS
  'LE LIEN D''UNE RÉPONSE photo VERS SES PHOTOS (9K28-CHECKLIST-REPONSE-PHOTO) — une réponse peut en porter plusieurs. Forme « filiation » CHAÎNÉE sur checklist_reponse (jamais directement sur intervention), même patron que vgp_observation sur vgp_verification. document_id reste une photo déposée par l''outil Photos existant (intervention_id posé comme toujours) : ce lien ÉTIQUETTE, il ne crée aucune seconde cible. IMMUABLE (I6) : jamais modifié ni supprimé par le rôle applicatif.';
