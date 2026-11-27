-- ═══════════════════════════════════════════════════════════════════════════
-- 9L60-PRET-1-MODELE — L'ÉQUIPEMENT DE PRÊT
-- Invariants I1, I8, I9, I10 ; arbitrage D287.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Décision d'Alexis, 27/11/2026 ~09h30 NC : « Je prête un équipement lorsqu'il
-- y a une panne et un délai avant la réappro d'une pièce. » Cadrage validé :
--   1. le BUREAU SEUL enregistre la sortie et le retour — jamais le
--      technicien, jamais le portail (capacité `gerer_prets`) ;
--   2. le prêt est GRATUIT — aucune colonne de montant, nulle part ici ;
--   3. un bon de prêt signé par le client à la remise (lot 3 — colonnes
--      posées ici, écrites plus tard, pour qu'une seule migration couvre les
--      trois lots du module).
--
-- Ce que cette migration établit :
--   1. `appareil_pret` — le parc de prêt, propre à la société. Forme
--      « société » : aucun compte de portail n'y a de chemin.
--   2. `pret_equipement` — le prêt lui-même. Forme « interne » (D287), le
--      même régime que `notification` (D229) et `document_recu` (D94).
--   3. Les gardes en base : au plus un prêt EN COURS par appareil (index
--      unique partiel), un retour qui ne précède jamais la sortie (CHECK).
--   4. L'audit des deux tables (I8, périmètre inversé — D55).

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. LE PARC DE PRÊT — `appareil_pret`
-- ═══════════════════════════════════════════════════════════════════════════
--
-- TABLE SÉPARÉE de `machine`, et c'est une décision nommée (D287) : `machine`
-- porte quatre colonnes OBLIGATOIRES (D6) dont `client_id` et `site_id` — les
-- rendre nullables pour accueillir un appareil sans client aurait affaibli un
-- invariant déjà posé pour tout le parc existant, pour le bénéfice d'une
-- poignée de lignes qui ne sont d'ailleurs jamais sur un site tant qu'elles ne
-- sont pas prêtées. Une table neuve, plus simple, est la voie la plus sûre.

CREATE TYPE "StatutAppareilPret" AS ENUM ('disponible', 'prete', 'en_revision');

CREATE TABLE "appareil_pret" (
  "id"         uuid PRIMARY KEY,
  "societe_id" uuid NOT NULL,

  "designation"   text NOT NULL,
  "marque"        text,
  "modele"        text,
  "numero_serie"  text,

  "statut" "StatutAppareilPret" NOT NULL DEFAULT 'disponible',
  "actif"  boolean NOT NULL DEFAULT true,

  "cree_le"    timestamptz NOT NULL DEFAULT now(),
  "modifie_le" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "appareil_pret"
  ADD CONSTRAINT "appareil_pret_designation_non_vide"
  CHECK (btrim("designation") <> '');

ALTER TABLE "appareil_pret" ADD CONSTRAINT "appareil_pret_societe_id_fkey"
  FOREIGN KEY ("societe_id") REFERENCES "societe" ("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE UNIQUE INDEX "appareil_pret_societe_id_id_key" ON "appareil_pret" ("societe_id", "id");
CREATE INDEX "appareil_pret_societe_statut_idx" ON "appareil_pret" ("societe_id", "statut");

-- Forme « SOCIÉTÉ » (le cas ordinaire de la première catégorie de I1) :
-- aucune colonne `client_id` n'existe sur cette table, et aucun écran de
-- portail n'y a de chemin.
ALTER TABLE "appareil_pret" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appareil_pret" FORCE ROW LEVEL SECURITY;

CREATE POLICY "cloisonnement_societe" ON "appareil_pret"
  USING (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
  )
  WITH CHECK (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON "appareil_pret" TO "codiplan_app";

CREATE TRIGGER "journal_audit" AFTER INSERT OR UPDATE OR DELETE ON "appareil_pret"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

COMMENT ON TABLE "appareil_pret" IS
  'LE PARC DE PRÊT (9L60-PRET-1-MODELE, D287) — des appareils qui appartiennent à la SOCIÉTÉ elle-même, jamais à un client ni à un site. Table séparée de machine (D6 exige client_id/site_id NOT NULL sur machine). Forme « société » : aucune colonne client_id, aucun chemin de portail.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. LE PRÊT — `pret_equipement`
-- ═══════════════════════════════════════════════════════════════════════════
--
-- TOUJOURS rattaché à une intervention (le motif du prêt, obligatoire), à un
-- client et à un site. Forme « INTERNE » (D287, même régime que D94/D100/
-- D229) : société ET `app.client_id` ABSENT — décision d'Alexis du
-- 27/11/2026, le bureau seul gère les prêts, jamais le portail.
--
-- `pret_equipement` est fille de `client`, `site` ET `intervention` — les
-- trois de forme « parc ». La forme « interne » ferme PLUS que la filiation
-- qu'elle aurait sinon réclamée (même raisonnement que `segment_travail`,
-- D119) : un compte portail apprendrait, par filiation, qu'un appareil lui a
-- été prêté — une donnée sur le FONCTIONNEMENT DU BUREAU, pas sur son parc.

CREATE TABLE "pret_equipement" (
  "id"         uuid PRIMARY KEY,
  "societe_id" uuid NOT NULL,

  "appareil_id"     uuid NOT NULL,
  "intervention_id" uuid NOT NULL,
  "client_id"       uuid NOT NULL,
  "site_id"         uuid NOT NULL,

  "date_sortie"         date NOT NULL,
  "date_retour_prevue"  date NOT NULL,
  -- NULL tant que le prêt est EN COURS. L'index unique partiel ci-dessous
  -- s'ancre sur cette nullité, jamais sur `appareil_pret.statut` — une
  -- seconde source du même fait divergerait en silence (§9, 01/09).
  "date_retour_reelle"  date,

  -- Texte court, les deux : le chapitre 10 ne donne aucune énumération
  -- d'états d'appareil, et en fermer une ici déciderait une règle que
  -- personne n'a arbitrée (CLAUDE.md §8).
  "etat_depart"  text NOT NULL,
  "etat_retour"  text,
  "observations" text,

  -- Identités scalaires, SANS relation Prisma déclarée vers `utilisateur` —
  -- même choix que `notification.destinataire_id` (D39).
  "auteur_sortie_id" uuid,
  "auteur_retour_id" uuid,

  -- RÉSERVÉ AU LOT 3 (bon de prêt signé à la remise) — aucune de ces cinq
  -- colonnes n'est écrite par ce lot ; posées ici pour qu'UNE SEULE
  -- migration couvre les trois lots du module.
  "signataire_nom"      text,
  "signataire_qualite"  text,
  "signature_objet_cle" text,
  "bon_document_id"     uuid,
  "date_signature"      timestamptz,

  "cree_le"    timestamptz NOT NULL DEFAULT now(),
  "modifie_le" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "pret_equipement"
  ADD CONSTRAINT "pret_equipement_etat_depart_non_vide"
  CHECK (btrim("etat_depart") <> '');

-- Un retour ne précède jamais la sortie — ni le prévu, ni le réel.
ALTER TABLE "pret_equipement"
  ADD CONSTRAINT "pret_equipement_retour_prevue_pas_avant_sortie"
  CHECK ("date_retour_prevue" >= "date_sortie");

ALTER TABLE "pret_equipement"
  ADD CONSTRAINT "pret_equipement_retour_reelle_pas_avant_sortie"
  CHECK ("date_retour_reelle" IS NULL OR "date_retour_reelle" >= "date_sortie");

-- Chaînages composites — `societe_id` dans la clé des quatre : les contrôles
-- d'intégrité référentielle contournent les politiques RLS par construction
-- en PostgreSQL, et sans la société dans la clé un prêt pourrait désigner
-- l'appareil, l'intervention, le client ou le site d'une AUTRE société.
ALTER TABLE "pret_equipement" ADD CONSTRAINT "pret_equipement_societe_id_fkey"
  FOREIGN KEY ("societe_id") REFERENCES "societe" ("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "pret_equipement" ADD CONSTRAINT "pret_equipement_societe_id_appareil_id_fkey"
  FOREIGN KEY ("societe_id", "appareil_id")
  REFERENCES "appareil_pret" ("societe_id", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "pret_equipement" ADD CONSTRAINT "pret_equipement_societe_id_intervention_id_fkey"
  FOREIGN KEY ("societe_id", "intervention_id")
  REFERENCES "intervention" ("societe_id", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "pret_equipement" ADD CONSTRAINT "pret_equipement_societe_id_client_id_fkey"
  FOREIGN KEY ("societe_id", "client_id")
  REFERENCES "client" ("societe_id", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "pret_equipement" ADD CONSTRAINT "pret_equipement_societe_id_site_id_fkey"
  FOREIGN KEY ("societe_id", "site_id")
  REFERENCES "site" ("societe_id", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "pret_equipement" ADD CONSTRAINT "pret_equipement_societe_id_bon_document_id_fkey"
  FOREIGN KEY ("societe_id", "bon_document_id")
  REFERENCES "document" ("societe_id", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "pret_equipement" ADD CONSTRAINT "pret_equipement_auteur_sortie_id_fkey"
  FOREIGN KEY ("auteur_sortie_id") REFERENCES "utilisateur" ("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "pret_equipement" ADD CONSTRAINT "pret_equipement_auteur_retour_id_fkey"
  FOREIGN KEY ("auteur_retour_id") REFERENCES "utilisateur" ("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE UNIQUE INDEX "pret_equipement_societe_id_id_key" ON "pret_equipement" ("societe_id", "id");
CREATE INDEX "pret_equipement_societe_appareil_idx" ON "pret_equipement" ("societe_id", "appareil_id");
CREATE INDEX "pret_equipement_societe_intervention_idx" ON "pret_equipement" ("societe_id", "intervention_id");
CREATE INDEX "pret_equipement_societe_client_idx" ON "pret_equipement" ("societe_id", "client_id");
CREATE INDEX "pret_equipement_societe_site_idx" ON "pret_equipement" ("societe_id", "site_id");

-- UN APPAREIL NE TIENT QU'UN PRÊT EN COURS (décision d'Alexis du 27/11/2026).
-- Index unique PARTIEL — pas une contrainte d'exclusion : il n'y a ici aucune
-- plage de temps à comparer, seulement « au plus une ligne non retournée » à
-- la fois, ce qu'un index unique partiel exprime exactement et au moindre
-- coût (même forme que `machine_societe_reference_interne_key`, D6).
CREATE UNIQUE INDEX "pret_equipement_un_en_cours_par_appareil"
  ON "pret_equipement" ("societe_id", "appareil_id")
  WHERE "date_retour_reelle" IS NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- Le cloisonnement — forme « INTERNE » (D287)
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE "pret_equipement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pret_equipement" FORCE ROW LEVEL SECURITY;

CREATE POLICY "cloisonnement_interne" ON "pret_equipement"
  USING (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
    AND NULLIF(current_setting('app.client_id', true), '') IS NULL
  )
  WITH CHECK (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
    AND NULLIF(current_setting('app.client_id', true), '') IS NULL
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON "pret_equipement" TO "codiplan_app";

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. L'AUDIT (I8, D55) — le périmètre est INVERSÉ : ces tables sont métier et
--    cloisonnées, donc auditées le jour où elles apparaissent.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TRIGGER "journal_audit" AFTER INSERT OR UPDATE OR DELETE ON "pret_equipement"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

COMMENT ON TABLE "pret_equipement" IS
  'LE PRÊT (9L60-PRET-1-MODELE, D287) — un appareil du parc de prêt, prêté le temps d''une réparation, toujours rattaché à une intervention. Forme « interne » (même régime que notification/D229 et document_recu/D94) : société ET app.client_id absent. Aucun écran de portail n''en lit en V1 ; le jour où cela change, cette forme SE RETIRE, elle ne s''assouplit pas. Colonnes signataire_nom à date_signature RÉSERVÉES au lot 3 (bon de prêt signé), non écrites par ce lot.';

COMMENT ON COLUMN "pret_equipement"."bon_document_id" IS
  'RÉSERVÉ au lot 3 (bon de prêt figé). Référence document(societe_id, id) en base, SANS relation Prisma déclarée — même choix que notification.destinataire_id (D39).';
