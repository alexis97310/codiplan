-- ═══════════════════════════════════════════════════════════════════════════
-- 9K08-CHECKLIST-SCHEMA — LE SOCLE DES CHECKLISTS (D235)
-- Invariants I1, I6, I8, I10 ; arbitrages D94, D103, D109, D231 ; décisions
-- d'Alexis du 29/10/2026 (réponses « A » et « B ») et du 09/11/2026 (~07h45).
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ## Ce que cette migration établit
--
-- 1. `checklist_modele` — l'en-tête du gabarit (société, code, libellé,
--    rattachement à un type d'intervention et/ou une famille et/ou un modèle
--    de matériel, actif). Forme « INTERNE » (D94, D235) : aucun compte
--    portail ne le lit, quel que soit son client — c'est la FAÇON DE
--    TRAVAILLER de la société, même motif que `Prestation.duree_standard_min`.
-- 2. `checklist_version` — n° et date de publication, JAMAIS MODIFIÉE une
--    fois publiée (« modifier » = publier N+1). Forme « FILIATION » (D103)
--    chaînée sur `checklist_modele` : aucune clause de société propre.
-- 3. `checklist_point` — section, ordre, libellé, consigne, obligatoire,
--    trois types de réponse SEULEMENT. Même forme « filiation », chaînée sur
--    `checklist_version`.
-- 4. `checklist_reponse` — la réponse FIGÉE PAR INTERVENTION, qui RECOPIE le
--    libellé, la section, l'unité et le caractère obligatoire du point au
--    moment de la réponse (patron `segment_travail.nom_technicien_affiche`,
--    9J22A). Forme « filiation » (D103) sur `intervention` : c'est la SEULE
--    des quatre tables que le portail lit — jamais les trois précédentes.
-- 5. `Intervention.checklist_version_id`, NULLABLE — le PIN, posé une seule
--    fois à la première réponse (lot suivant, CK2) et jamais réévalué.
--    AUCUNE migration de données sur les lignes existantes.
-- 6. `Prestation.checklist_type` est déclarée INERTE (voir son commentaire de
--    colonne) — ni supprimée, ni jamais écrite (R3-15).
--
-- ## CE QUE CETTE MIGRATION NE FAIT PAS
--
-- Aucun gabarit n'est semé ici, en production ni en démonstration (CK4, après
-- l'atelier). Aucune cascade de résolution (CK2). Aucun blocage de
-- « Terminer » (CK7) — RG-INT-02 n'est pas amendée ici. Aucun écran (CK3).

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. LES ÉNUMÉRATIONS
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Trois types de réponse SEULEMENT pour ce lot — `choix_liste`, `texte` et
-- `photo` sont DIFFÉRÉS (la photo passe par l'outil Photos existant de
-- l'intervention, jamais par la checklist).

CREATE TYPE "TypeReponseChecklist" AS ENUM (
  'conforme_non_conforme_sans_objet', 'valeur_mesuree', 'case_faite'
);

-- Un NON CONFORME ne bloque JAMAIS « Terminer » (décision d'Alexis du
-- 29/10/2026, réponse « A » à la question 3) ; seul un point OBLIGATOIRE non
-- renseigné bloquera — lot ultérieur CK7, hors territoire ici.
CREATE TYPE "ReponseConformite" AS ENUM ('conforme', 'non_conforme', 'sans_objet');

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. `checklist_modele` — L'EN-TÊTE, FORME « INTERNE » (D94, D235)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE "checklist_modele" (
  "id"         uuid NOT NULL,
  "societe_id" uuid NOT NULL,

  "code"    text NOT NULL,
  "libelle" text NOT NULL,

  -- Rattachement à UN SEUL type d'intervention (nullable), jamais un
  -- tableau : aucune colonne de ce dépôt ne porte un tableau d'énumération
  -- (mesuré au ticket 9K08). Un contrôle qui s'appliquerait à plusieurs
  -- types se pose comme PLUSIEURS modèles, un code chacun.
  "type_intervention" "TypeIntervention",

  -- La famille visée, FACULTATIVE — même régime que `prestation.famille_id`.
  "famille_id" uuid,
  -- Le modèle de matériel visé, FACULTATIF et PLUS PRÉCIS que la famille —
  -- la cascade de résolution (CK2) le préfère quand les deux existent.
  "modele_id" uuid,

  -- Si VRAI, ce modèle n'est proposé (CK2) qu'à une intervention qui PORTE
  -- une machine (PARCOURS-1, D228).
  "exige_machine" boolean NOT NULL DEFAULT false,

  -- JAMAIS SUPPRIMÉ, seulement désactivé : une version déjà publiée doit
  -- rester lisible même si son modèle n'est plus proposé pour une
  -- intervention neuve.
  "actif" boolean NOT NULL DEFAULT true,

  "cree_le"    timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "modifie_le" timestamptz(3) NOT NULL,

  CONSTRAINT "checklist_modele_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "checklist_modele_societe_id_id_key" ON "checklist_modele" ("societe_id", "id");
CREATE UNIQUE INDEX "checklist_modele_societe_id_code_key" ON "checklist_modele" ("societe_id", "code");
CREATE INDEX "checklist_modele_societe_id_famille_id_idx" ON "checklist_modele" ("societe_id", "famille_id");
CREATE INDEX "checklist_modele_societe_id_modele_id_idx" ON "checklist_modele" ("societe_id", "modele_id");

ALTER TABLE "checklist_modele"
  ADD CONSTRAINT "checklist_modele_code_non_vide" CHECK (btrim("code") <> ''),
  ADD CONSTRAINT "checklist_modele_libelle_non_vide" CHECK (btrim("libelle") <> '');

ALTER TABLE "checklist_modele"
  ADD CONSTRAINT "checklist_modele_societe_id_fkey"
    FOREIGN KEY ("societe_id") REFERENCES "societe"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "checklist_modele_societe_id_famille_id_fkey"
    FOREIGN KEY ("societe_id", "famille_id") REFERENCES "famille_materiel"("societe_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "checklist_modele_societe_id_modele_id_fkey"
    FOREIGN KEY ("societe_id", "modele_id") REFERENCES "modele_materiel"("societe_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "checklist_modele" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "checklist_modele" FORCE ROW LEVEL SECURITY;

-- FORME « INTERNE » (D94, D235) : société, PLUS l'absence de `app.client_id`.
-- Aucun compte portail ne lit cette table, quel que soit son client.
CREATE POLICY "cloisonnement_interne" ON "checklist_modele"
  USING (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
    AND NULLIF(current_setting('app.client_id', true), '') IS NULL
  )
  WITH CHECK (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
    AND NULLIF(current_setting('app.client_id', true), '') IS NULL
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON "checklist_modele" TO "codiplan_app";

CREATE TRIGGER "journal_audit" AFTER INSERT OR UPDATE OR DELETE ON "checklist_modele"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

COMMENT ON TABLE "checklist_modele" IS
  'LE MODÈLE DE CHECKLIST — en-tête SEUL (9K08-CHECKLIST-SCHEMA, D235). Forme « interne » (D94) : aucun compte portail ne le lit, quel que soit son client — c''est la façon de travailler de la société. Rattachement à UN SEUL type d''intervention, jamais un tableau. Jamais supprimé, seulement désactivé (actif).';

COMMENT ON COLUMN "checklist_modele"."exige_machine" IS
  'Si VRAI, la cascade de résolution (CK2) n''offre ce modèle qu''à une intervention qui PORTE une machine (PARCOURS-1, D228).';

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. `checklist_version` — IMMUABLE, FORME « FILIATION » SUR LE MODÈLE (D103)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Naît déjà publiée : ce lot n'ouvre aucun état de brouillon. « Modifier » une
-- version publiée = publier la version N+1 (D235).

CREATE TABLE "checklist_version" (
  "id"                  uuid NOT NULL,
  "societe_id"          uuid NOT NULL,
  "checklist_modele_id" uuid NOT NULL,

  -- Commence à 1, un de plus que la précédente — jamais réutilisé.
  "numero" integer NOT NULL,

  "publiee_le" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "checklist_version_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "checklist_version_societe_id_id_key" ON "checklist_version" ("societe_id", "id");
CREATE UNIQUE INDEX "checklist_version_checklist_modele_id_numero_key" ON "checklist_version" ("checklist_modele_id", "numero");

ALTER TABLE "checklist_version"
  ADD CONSTRAINT "checklist_version_numero_positif" CHECK ("numero" > 0);

ALTER TABLE "checklist_version"
  ADD CONSTRAINT "checklist_version_societe_id_fkey"
    FOREIGN KEY ("societe_id") REFERENCES "societe"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "checklist_version_societe_id_checklist_modele_id_fkey"
    FOREIGN KEY ("societe_id", "checklist_modele_id") REFERENCES "checklist_modele"("societe_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "checklist_version" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "checklist_version" FORCE ROW LEVEL SECURITY;

-- FORME « FILIATION » (D103) : une fille est visible si son parent l'est —
-- ici `checklist_modele`, qui porte lui-même la forme « interne ». La
-- visibilité se CHAÎNE, exactement comme `vgp_observation` sur
-- `vgp_verification` : aucune clause de société propre n'est écrite ici.
CREATE POLICY "cloisonnement_filiation" ON "checklist_version"
  USING (
    EXISTS (
      SELECT 1 FROM "checklist_modele" "m"
       WHERE "m"."id" = "checklist_version"."checklist_modele_id"
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "checklist_modele" "m"
       WHERE "m"."id" = "checklist_version"."checklist_modele_id"
    )
  );

-- IMMUABLE : `UPDATE` et `DELETE` sont RETIRÉS au rôle applicatif ET sans
-- politique pour ces verbes (I8, même patron qu'`intervention_signature`) —
-- la base tient l'immutabilité en plus de la discipline du dépôt.
REVOKE UPDATE, DELETE ON "checklist_version" FROM "codiplan_app";
GRANT SELECT, INSERT ON "checklist_version" TO "codiplan_app";

CREATE TRIGGER "journal_audit" AFTER INSERT OR UPDATE OR DELETE ON "checklist_version"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

COMMENT ON TABLE "checklist_version" IS
  'UNE VERSION DE GABARIT, JAMAIS MODIFIÉE UNE FOIS PUBLIÉE (9K08-CHECKLIST-SCHEMA, D235) — « modifier » publie la version N+1. Forme « filiation » (D103) chaînée sur checklist_modele. UPDATE et DELETE retirés au rôle applicatif ET sans politique (I8) : la base tient l''immutabilité, pas seulement la discipline du dépôt.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. `checklist_point` — IMMUABLE, FORME « FILIATION » SUR LA VERSION (D103)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- AUCUNE table `checklist_section` séparée : la section est un simple LIBELLÉ
-- porté par chaque point — la structure la plus simple qui rende le tableau
-- d'un gabarit sans lui ajouter un niveau (mesuré au ticket 9K08).

CREATE TABLE "checklist_point" (
  "id"                    uuid NOT NULL,
  "societe_id"            uuid NOT NULL,
  "checklist_version_id"  uuid NOT NULL,

  "section"  text NOT NULL,
  "ordre"    integer NOT NULL,
  "libelle"  text NOT NULL,
  "consigne" text,

  "obligatoire"  boolean NOT NULL DEFAULT false,
  "type_reponse" "TypeReponseChecklist" NOT NULL,

  -- Unité et tolérances — `valeur_mesuree` SEULEMENT (contrainte ci-dessous).
  -- FACULTATIVES ET VIDES PAR DÉFAUT (9K08) : aucune tolérance inventée, la
  -- notice du modèle les fournira à l'atelier.
  "unite"         text,
  "tolerance_min" numeric(12, 3),
  "tolerance_max" numeric(12, 3),

  CONSTRAINT "checklist_point_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "checklist_point_societe_id_id_key" ON "checklist_point" ("societe_id", "id");
CREATE UNIQUE INDEX "checklist_point_checklist_version_id_ordre_key" ON "checklist_point" ("checklist_version_id", "ordre");

ALTER TABLE "checklist_point"
  ADD CONSTRAINT "checklist_point_section_non_vide" CHECK (btrim("section") <> ''),
  ADD CONSTRAINT "checklist_point_libelle_non_vide" CHECK (btrim("libelle") <> ''),
  -- Unité et tolérances n'existent que sur un point `valeur_mesuree` — sur
  -- tout autre type, elles mentiraient sur ce qui se mesure.
  ADD CONSTRAINT "checklist_point_mesure_reserve_a_valeur_mesuree" CHECK (
    "type_reponse" = 'valeur_mesuree'
    OR ("unite" IS NULL AND "tolerance_min" IS NULL AND "tolerance_max" IS NULL)
  );

ALTER TABLE "checklist_point"
  ADD CONSTRAINT "checklist_point_societe_id_fkey"
    FOREIGN KEY ("societe_id") REFERENCES "societe"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "checklist_point_societe_id_checklist_version_id_fkey"
    FOREIGN KEY ("societe_id", "checklist_version_id") REFERENCES "checklist_version"("societe_id", "id") ON DELETE CASCADE ON UPDATE RESTRICT;

ALTER TABLE "checklist_point" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "checklist_point" FORCE ROW LEVEL SECURITY;

-- FORME « FILIATION » (D103), chaînée sur `checklist_version` — qui se
-- chaîne elle-même sur `checklist_modele` (forme « interne »). Même
-- raisonnement que `vgp_observation` sur `vgp_verification` sur `machine`.
CREATE POLICY "cloisonnement_filiation" ON "checklist_point"
  USING (
    EXISTS (
      SELECT 1 FROM "checklist_version" "v"
       WHERE "v"."id" = "checklist_point"."checklist_version_id"
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "checklist_version" "v"
       WHERE "v"."id" = "checklist_point"."checklist_version_id"
    )
  );

-- IMMUABLE, comme sa version (même patron qu'`intervention_signature`).
REVOKE UPDATE, DELETE ON "checklist_point" FROM "codiplan_app";
GRANT SELECT, INSERT ON "checklist_point" TO "codiplan_app";

CREATE TRIGGER "journal_audit" AFTER INSERT OR UPDATE OR DELETE ON "checklist_point"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

COMMENT ON TABLE "checklist_point" IS
  'UN POINT DE LA VERSION (9K08-CHECKLIST-SCHEMA, D235) — section, ordre, libellé, consigne, obligatoire, type de réponse. Jamais modifié ni supprimé, comme sa version. AUCUNE table checklist_section séparée : la section est un simple libellé porté par chaque point. Forme « filiation » (D103) chaînée sur checklist_version.';

COMMENT ON COLUMN "checklist_point"."unite" IS
  'Unité et tolérances (tolerance_min/tolerance_max) réservées au type valeur_mesuree (contrainte checklist_point_mesure_reserve_a_valeur_mesuree). FACULTATIVES ET VIDES PAR DÉFAUT : aucune tolérance inventée (CLAUDE.md §8), la notice du modèle les fournira à l''atelier.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. `checklist_reponse` — FIGÉE PAR INTERVENTION, FORME « FILIATION » (D103)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- La SEULE des quatre tables de ce lot qu'un compte portail peut lire : elle
-- RECOPIE le libellé, la section, l'unité et le caractère obligatoire du
-- point au moment de la réponse (même patron que `segment_travail.
-- nom_technicien_affiche`, 9J22A) — ni le versionnement ni la lecture
-- portail n'ont donc jamais besoin d'ouvrir `checklist_point`.

CREATE TABLE "checklist_reponse" (
  "id"                  uuid NOT NULL,
  "societe_id"          uuid NOT NULL,
  "intervention_id"     uuid NOT NULL,
  "checklist_point_id"  uuid NOT NULL,

  -- Recopiés du point au moment de la réponse — jamais relus depuis
  -- `checklist_point` (D235, patron 9J22A).
  "libelle"     text NOT NULL,
  "section"     text NOT NULL,
  "unite"       text,
  "obligatoire" boolean NOT NULL,

  -- Exactement une des trois, selon le type de réponse du point — gardé par
  -- `num_nonnulls`, même patron que `notification_cible_unique`.
  "valeur_conforme" "ReponseConformite",
  "valeur_mesuree"  numeric(12, 3),
  "valeur_fait"     boolean,

  -- QUI a répondu — une IDENTITÉ, aucune relation Prisma déclarée vers
  -- `utilisateur` (même choix que `notification.destinataire_id`, D39).
  "auteur_id"  uuid NOT NULL,
  "repondu_le" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "checklist_reponse_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "checklist_reponse_societe_id_id_key" ON "checklist_reponse" ("societe_id", "id");
CREATE UNIQUE INDEX "checklist_reponse_societe_intervention_point_key"
  ON "checklist_reponse" ("societe_id", "intervention_id", "checklist_point_id");
CREATE INDEX "checklist_reponse_societe_id_intervention_id_idx" ON "checklist_reponse" ("societe_id", "intervention_id");

ALTER TABLE "checklist_reponse"
  ADD CONSTRAINT "checklist_reponse_libelle_non_vide" CHECK (btrim("libelle") <> ''),
  ADD CONSTRAINT "checklist_reponse_valeur_unique" CHECK (
    num_nonnulls("valeur_conforme", "valeur_mesuree", "valeur_fait") = 1
  );

ALTER TABLE "checklist_reponse"
  ADD CONSTRAINT "checklist_reponse_societe_id_fkey"
    FOREIGN KEY ("societe_id") REFERENCES "societe"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "checklist_reponse_societe_id_intervention_id_fkey"
    FOREIGN KEY ("societe_id", "intervention_id") REFERENCES "intervention"("societe_id", "id") ON DELETE CASCADE ON UPDATE RESTRICT,
  ADD CONSTRAINT "checklist_reponse_societe_id_checklist_point_id_fkey"
    FOREIGN KEY ("societe_id", "checklist_point_id") REFERENCES "checklist_point"("societe_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "checklist_reponse_auteur_id_fkey"
    FOREIGN KEY ("auteur_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "checklist_reponse" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "checklist_reponse" FORCE ROW LEVEL SECURITY;

-- FORME « FILIATION » (D103, D235) : visible si l'INTERVENTION l'est — c'est
-- par cette table, et par elle seule, qu'un compte portail lit sa checklist
-- (décision d'Alexis du 09/11/2026 ~07h45). `WITH CHECK` répète le `USING`,
-- même forme qu'`intervention_piece_remplacee`.
CREATE POLICY "cloisonnement_filiation" ON "checklist_reponse"
  USING (
    EXISTS (
      SELECT 1 FROM "intervention" "i"
       WHERE "i"."id" = "checklist_reponse"."intervention_id"
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "intervention" "i"
       WHERE "i"."id" = "checklist_reponse"."intervention_id"
    )
  );

-- UPDATE autorisé (une réponse se CORRIGE — la saisie du lot suivant, CK2,
-- fait un upsert par point), DELETE retiré : aucune réponse ne disparaît
-- (I6), elle se corrige par UPDATE, et c'est le journal d'audit qui garde la
-- valeur d'avant — même discipline que `segment_travail`.
REVOKE DELETE ON "checklist_reponse" FROM "codiplan_app";
GRANT SELECT, INSERT, UPDATE ON "checklist_reponse" TO "codiplan_app";

CREATE TRIGGER "journal_audit" AFTER INSERT OR UPDATE OR DELETE ON "checklist_reponse"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

COMMENT ON TABLE "checklist_reponse" IS
  'LA RÉPONSE, FIGÉE PAR INTERVENTION (9K08-CHECKLIST-SCHEMA, D235). Forme « filiation » (D103) sur intervention : la SEULE des quatre tables de ce lot qu''un compte portail peut lire. RECOPIE libellé/section/unité/obligatoire du point (patron segment_travail.nom_technicien_affiche, 9J22A) — jamais besoin d''ouvrir checklist_point. DELETE retiré (I6) : une correction passe par UPDATE, jamais par une suppression.';

COMMENT ON COLUMN "checklist_reponse"."checklist_point_id" IS
  'Le point répondu. societe_id + intervention_id d''un côté, ce point de l''autre : la version figée se déduit de ce point (checklist_point.checklist_version_id), jamais répétée sur cette ligne.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. LE PIN SUR L'INTERVENTION — `checklist_version_id`, NULLABLE
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Posé UNE SEULE FOIS, à la première réponse (lot suivant, CK2), jamais
-- réévalué. NULL est l'état normal d'une intervention sans gabarit applicable
-- — AUCUNE migration de données sur les lignes existantes.

ALTER TABLE "intervention" ADD COLUMN "checklist_version_id" uuid;

CREATE INDEX "intervention_societe_id_checklist_version_id_idx"
  ON "intervention" ("societe_id", "checklist_version_id");

ALTER TABLE "intervention"
  ADD CONSTRAINT "intervention_societe_id_checklist_version_id_fkey"
    FOREIGN KEY ("societe_id", "checklist_version_id") REFERENCES "checklist_version"("societe_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

COMMENT ON COLUMN "intervention"."checklist_version_id" IS
  'LE GABARIT PINNÉ (9K08-CHECKLIST-SCHEMA, D235) — posé UNE SEULE FOIS, à la première réponse (lot suivant, CK2), jamais réévalué. NULL est l''état normal tant qu''aucune réponse n''a été posée, ou qu''aucun gabarit ne s''applique.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. `prestation.checklist_type` — DÉCLARÉE INERTE (ne se supprime pas)
-- ═══════════════════════════════════════════════════════════════════════════

COMMENT ON COLUMN "prestation"."checklist_type" IS
  'La checklist type, en texte LIBRE — INERTE depuis 9K08-CHECKLIST-SCHEMA (D235) : la vraie checklist paramétrable vit désormais dans checklist_modele/checklist_version/checklist_point, rattachée à un type d''intervention et/ou une famille et/ou un modèle de matériel, jamais à une prestation du catalogue (décision « B » du 29/10/2026 : checklist et prestations COEXISTENT, la checklist ne facture rien). Colonne NON SUPPRIMÉE et NON ÉCRITE (R3-15, lib/prestations/depot.ts) : la supprimer serait une seconde décision que ce ticket ne prend pas.';
