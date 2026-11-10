-- CODIPLAN — Sous-type structuré de matériel (ticket 9K17A ; invariant I1, I8).
--
-- ── CE QUE CETTE MIGRATION ÉTABLIT ─────────────────────────────────────────
--
-- Décision d'Alexis du 10/11/2026 (`claude/decisions-alexis-10-11.md`, hors
-- dépôt, décision 14) : rattacher les modèles de checklist au SOUS-TYPE
-- structuré plutôt qu'au modèle exact — « sous-type en règle, modèle en
-- exception ». Renverse la recommandation 12.1 de l'étude du 29/10/2026 (pas
-- de sous-type structuré) : sa condition de réouverture — un ratio
-- modèles/gabarits trop élevé pour rester une checklist par modèle (71
-- modèles de ponts pour 4 gabarits, 8 modèles de compresseurs pour 2) — est
-- remplie. Voir `docs/arbitrages.md` pour la décision et les règles amendées.
--
-- 1. `modele_materiel.sous_type_id`, FACULTATIF — la COLONNE seule, posée
--    AVANT `sous_type_materiel` : la politique « ascendance » du point 2 la
--    lit dans son `EXISTS`, et PostgreSQL valide une politique à sa création.
-- 2. `sous_type_materiel` — table MÉTIER cloisonnée, sous une famille, forme
--    « ascendance » (D93) comme `famille_materiel` et `modele_materiel` : un
--    compte portail ne la voit que si un de ses modèles porte une machine
--    visible dans son périmètre.
-- 3. Le CHAÎNAGE à trois colonnes qui referme le point 1 : un modèle ne peut
--    désigner un sous-type que de SA PROPRE famille, refusé PAR LA CLÉ, sans
--    déclencheur.
-- 4. `checklist_modele.sous_type_id`, FACULTATIF, et la contrainte qui tient
--    « AU PLUS UN niveau de rattachement parmi modèle / sous-type / famille ».
--    Aucune ligne n'existe encore sur cette table (9K08 n'a livré que le
--    socle) : la contrainte est posée VALIDÉE, pas `NOT VALID`.
-- 5. Les deux déclencheurs d'audit requis par le périmètre INVERSÉ (I8, D55).
--
-- Aucun sous-type n'entre par CETTE migration : le semis de DÉMONSTRATION
-- (`prisma/seed.ts`) en crée six, rien en production.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. `modele_materiel.sous_type_id` — la colonne, SANS SA CLÉ ÉTRANGÈRE encore
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "modele_materiel" ADD COLUMN "sous_type_id" UUID;

CREATE INDEX "modele_materiel_societe_id_famille_id_sous_type_id_idx"
  ON "modele_materiel" ("societe_id", "famille_id", "sous_type_id");

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. `sous_type_materiel` — le sous-type, rattaché à sa famille
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE "sous_type_materiel" (
  "id"         UUID NOT NULL,
  "societe_id" UUID NOT NULL,
  "famille_id" UUID NOT NULL,
  "code"       TEXT NOT NULL,
  "libelle"    TEXT NOT NULL,
  "actif"      BOOLEAN NOT NULL DEFAULT true,

  CONSTRAINT "sous_type_materiel_pkey" PRIMARY KEY ("id")
);

-- Ni code ni libellé vides — même garde que `famille_materiel`, en base et
-- pas seulement dans Zod : l'import Excel et une correction manuelle sont
-- deux chemins de plus.
ALTER TABLE "sous_type_materiel"
  ADD CONSTRAINT "sous_type_materiel_code_non_vide"
  CHECK (length(btrim("code")) > 0);
ALTER TABLE "sous_type_materiel"
  ADD CONSTRAINT "sous_type_materiel_libelle_non_vide"
  CHECK (length(btrim("libelle")) > 0);

-- Le code est unique PAR FAMILLE, pas seulement par société : deux familles
-- peuvent réutiliser le même code pour deux sous-types différents (mesuré
-- cohérent avec `famille_materiel`, dont le code est unique par société SEULE
-- — une famille n'a pas de parent sous lequel réutiliser un code).
CREATE UNIQUE INDEX "sous_type_materiel_societe_id_famille_id_code_key"
  ON "sous_type_materiel" ("societe_id", "famille_id", "code");

-- La CIBLE du chaînage composite À DEUX colonnes, pour `checklist_modele`
-- (point 4). Même raisonnement que `famille_materiel_societe_id_id_key`.
CREATE UNIQUE INDEX "sous_type_materiel_societe_id_id_key"
  ON "sous_type_materiel" ("societe_id", "id");

-- La CIBLE du chaînage composite À TROIS colonnes, pour `modele_materiel`
-- (point 3) : elle porte la FAMILLE en plus de la société, ce qui est ce qui
-- permet à la clé étrangère de REFUSER qu'un modèle désigne un sous-type
-- d'une autre famille que la sienne, sans qu'aucun déclencheur ne l'écrive.
CREATE UNIQUE INDEX "sous_type_materiel_societe_id_famille_id_id_key"
  ON "sous_type_materiel" ("societe_id", "famille_id", "id");

ALTER TABLE "sous_type_materiel"
  ADD CONSTRAINT "sous_type_materiel_societe_id_fkey"
  FOREIGN KEY ("societe_id") REFERENCES "societe"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "sous_type_materiel"
  ADD CONSTRAINT "sous_type_materiel_famille_fkey"
  FOREIGN KEY ("societe_id", "famille_id")
  REFERENCES "famille_materiel"("societe_id", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "sous_type_materiel" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sous_type_materiel" FORCE ROW LEVEL SECURITY;

-- Forme « ASCENDANCE » (D93) — comme `famille_materiel` et `modele_materiel` :
-- un utilisateur interne garde la clause de société seule ; un compte portail
-- (discriminant `app.client_id`) ne voit un sous-type que si l'un de ses
-- MODÈLES porte une machine visible dans son périmètre. *Sinon la présence
-- d'un sous-type « pont 4 colonnes » révèle la composition du parc des autres
-- sites.* `modele_materiel` porte lui-même la forme « ascendance » adossée à
-- `machine` : la restriction par site se propage donc par la POLITIQUE de
-- `modele_materiel`, jamais réécrite ici.
CREATE POLICY "cloisonnement_ascendance" ON "sous_type_materiel"
  USING (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
    AND (
      NULLIF(current_setting('app.client_id', true), '') IS NULL
      OR EXISTS (
        SELECT 1 FROM "modele_materiel"
         WHERE "modele_materiel"."sous_type_id" = "sous_type_materiel"."id"
      )
    )
  )
  WITH CHECK (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
    AND (
      NULLIF(current_setting('app.client_id', true), '') IS NULL
      OR EXISTS (
        SELECT 1 FROM "modele_materiel"
         WHERE "modele_materiel"."sous_type_id" = "sous_type_materiel"."id"
      )
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON "sous_type_materiel" TO "codiplan_app";

CREATE TRIGGER "journal_audit" AFTER INSERT OR UPDATE OR DELETE ON "sous_type_materiel"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

-- LE VERROU D'ÉCRITURE DU PORTAIL (I3, D237, 9K16) — recopié verbatim des
-- trois politiques posées par `20261110120000_portail_securite_base_9k16` sur
-- `modele_materiel`/`famille_materiel`, et son fondement y est écrit en
-- entier. `sous_type_materiel` n'existait pas ce jour-là, d'où ces trois
-- CREATE POLICY ici plutôt qu'une entrée de plus dans le tableau de 9K16 —
-- une migration déjà appliquée ne se modifie jamais (CLAUDE.md §7).
CREATE POLICY "verrou_ecriture_portail_insertion" ON "sous_type_materiel"
  AS RESTRICTIVE FOR INSERT
  WITH CHECK (NULLIF(current_setting('app.client_id', true), '') IS NULL);

CREATE POLICY "verrou_ecriture_portail_modification" ON "sous_type_materiel"
  AS RESTRICTIVE FOR UPDATE
  USING (NULLIF(current_setting('app.client_id', true), '') IS NULL)
  WITH CHECK (NULLIF(current_setting('app.client_id', true), '') IS NULL);

CREATE POLICY "verrou_ecriture_portail_suppression" ON "sous_type_materiel"
  AS RESTRICTIVE FOR DELETE
  USING (NULLIF(current_setting('app.client_id', true), '') IS NULL);

COMMENT ON TABLE "sous_type_materiel" IS
  'Sous-type structuré de matériel, sous une famille (ticket 9K17A, décision d''Alexis du 10/11/2026). Table MÉTIER cloisonnée, forme « ascendance » (D93) comme famille_materiel et modele_materiel. Ce sont des données SAISIES, jamais une énumération.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. `modele_materiel` — le chaînage à trois colonnes, maintenant que la
--    cible existe
-- ═══════════════════════════════════════════════════════════════════════════

-- LE CHAÎNAGE À TROIS COLONNES, et c'est lui qui refuse PAR LA CLÉ qu'un
-- modèle désigne le sous-type d'une autre famille — y compris une famille de
-- la MÊME société. `MATCH SIMPLE` (le défaut PostgreSQL) laisse `sous_type_id`
-- NULL sans exiger les deux autres colonnes : c'est ce qui rend le
-- rattachement FACULTATIF malgré une clé à trois colonnes.
ALTER TABLE "modele_materiel"
  ADD CONSTRAINT "modele_materiel_sous_type_fkey"
  FOREIGN KEY ("societe_id", "famille_id", "sous_type_id")
  REFERENCES "sous_type_materiel"("societe_id", "famille_id", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. `checklist_modele.sous_type_id` — et l'exclusivité des trois niveaux
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "checklist_modele" ADD COLUMN "sous_type_id" UUID;

CREATE INDEX "checklist_modele_societe_id_sous_type_id_idx"
  ON "checklist_modele" ("societe_id", "sous_type_id");

ALTER TABLE "checklist_modele"
  ADD CONSTRAINT "checklist_modele_societe_id_sous_type_id_fkey"
  FOREIGN KEY ("societe_id", "sous_type_id")
  REFERENCES "sous_type_materiel"("societe_id", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AU PLUS UN niveau parmi modèle / sous-type / famille (décision d'Alexis du
-- 10/11/2026 : « sous-type en règle, modèle en exception » — une checklist ne
-- vise jamais DEUX niveaux à la fois). Posée VALIDÉE : 9K08 n'a livré que le
-- socle de cette table, aucune ligne n'existe encore pour la violer.
ALTER TABLE "checklist_modele"
  ADD CONSTRAINT "checklist_modele_un_seul_rattachement"
  CHECK (
    (CASE WHEN "famille_id" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "sous_type_id" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "modele_id" IS NOT NULL THEN 1 ELSE 0 END) <= 1
  );
