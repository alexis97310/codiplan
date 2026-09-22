-- ═══════════════════════════════════════════════════════════════════════════
-- LE RAPPORT DE TERRAIN — prestations réalisées, commentaire, suite à donner,
-- photos et signature (ticket 17-BON-2, suite de BON-1 / lot 16).
-- Invariants I1, I4, I5, I8, I9 ; arbitrage du ticket lui-même.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- BON-1 a livré le bon d'intervention imprimable avec CE QUE LA BASE PORTAIT
-- DÉJÀ, et a nommé cinq blocs sans les construire : « prestations réalisées,
-- commentaire du technicien, suite à donner, photos, signature du client ».
-- Cette migration leur donne une place dans le modèle de données.
--
-- ## Ce que cette migration établit
--
-- 1. `intervention.commentaire_technicien` et `intervention.suite_a_donner` —
--    deux colonnes texte, saisies sur le TERRAIN (I4, I5), jamais au
--    back-office.
-- 2. `document` gagne une TROISIÈME cible possible, `intervention_id` : les
--    photos d'une intervention sont des `document` comme les autres, jamais
--    une seconde table de fichiers. La forme « héritage » (D93) s'étend en
--    conséquence — trois cibles au lieu de deux, le principe ne change pas.
-- 3. `intervention_prestation` — un simple rattachement entre une
--    intervention et une ligne du catalogue `prestation`, forme « filiation »
--    (D103), sur le modèle exact d'`intervention_machine`.
-- 4. `intervention_signature` — la preuve de signature, HISTORISÉE comme
--    `taux_horaire` (RG-TAR-04) : une re-signature AJOUTE une ligne, elle n'en
--    réécrit ni n'en efface aucune. La base le tient en plus de la
--    discipline applicative : `UPDATE` et `DELETE` sont retirés au rôle
--    applicatif, comme sur `journal_audit` (I8).
--
-- ## CE QUE CETTE MIGRATION NE FAIT PAS
--
-- **Aucune prestation ne porte de durée ou de montant propres.** Une
-- prestation porte une durée STANDARD dans son catalogue et jamais de tarif
-- (D109) ; le temps d'une intervention est déjà mesuré, globalement, par
-- `segment_travail`. Inventer une durée par ligne de `intervention_prestation`
-- serait une donnée que rien ne demande encore, susceptible de diverger du
-- temps mesuré (§9, 01/09). Condition de réouverture, écrite plutôt que
-- devinée : le jour où plusieurs prestations d'une même visite doivent se
-- facturer avec des durées distinctes du temps mesuré global.
--
-- **Aucun statut de l'intervention ne bloque l'ajout d'une signature, d'une
-- photo ou d'une prestation réalisée** — pas même `cloturee` ni `annulee`.
-- I5 garantit que le travail terrain n'est jamais perdu ; borner l'ajout par
-- un statut lu au moment de l'écriture referait, sur une preuve, l'erreur
-- qu'I5 interdit sur un segment de travail. `commentaire_technicien` et
-- `suite_a_donner` restent en revanche des COLONNES de `intervention`, donc
-- déjà couvertes par le déclencheur `intervention_cycle_de_vie` : une
-- intervention clôturée ne se modifie plus (sauf vers `annulee`), exactement
-- comme le reste de sa fiche.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. LE COMMENTAIRE ET LA SUITE À DONNER — deux colonnes sur `intervention`
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "intervention"
  ADD COLUMN "commentaire_technicien" TEXT,
  ADD COLUMN "suite_a_donner" TEXT;

COMMENT ON COLUMN "intervention"."commentaire_technicien" IS
  'Ce que le technicien a constaté ou fait, dans ses mots (BON-2). Saisi sur le TERRAIN, jamais au back-office (I4, I5). NULL tant que rien n''a été écrit — jamais une chaîne vide.';

COMMENT ON COLUMN "intervention"."suite_a_donner" IS
  'Ce qu''il reste à faire ou à surveiller entre deux visites (BON-2). Même régime que commentaire_technicien : terrain seul, NULL tant que rien n''a été écrit.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. `document` GAGNE UNE TROISIÈME CIBLE — l'intervention (BON-2)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Une photo prise sur une intervention ne concerne ni un modèle ni une
-- machine en particulier : elle documente LA VISITE. La forme reste
-- « héritage » (D93) — un document est visible si sa cible l'est, la classe
-- ne fait que rétrécir —, seule la LISTE des cibles s'allonge.

ALTER TABLE "document" ADD COLUMN "intervention_id" UUID;

-- La cible reste une SOMME : exactement une des trois colonnes, jamais deux
-- ni zéro. La contrainte est retirée puis reposée sous le même nom — c'est le
-- même fait, sur trois colonnes au lieu de deux.
ALTER TABLE "document" DROP CONSTRAINT "document_cible_unique";
ALTER TABLE "document"
  ADD CONSTRAINT "document_cible_unique"
  CHECK (num_nonnulls("modele_id", "machine_id", "intervention_id") = 1);

-- Les deux actions référentielles sont dites (§9, 24/08), et suivent le même
-- choix que `modele_id`/`machine_id` : `RESTRICT` des deux côtés. Une
-- intervention qui porte des photos ne s'efface pas en emportant sa
-- documentation ; `societe_id` entrant dans la clé, une propagation
-- silencieuse ferait changer de société toute une documentation.
ALTER TABLE "document" ADD CONSTRAINT "document_societe_id_intervention_id_fkey"
  FOREIGN KEY ("societe_id", "intervention_id")
  REFERENCES "intervention" ("societe_id", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE INDEX "document_societe_id_intervention_id_idx"
  ON "document" ("societe_id", "intervention_id");

-- ── LA POLITIQUE « HÉRITAGE » S'ÉTEND À TROIS CIBLES ────────────────────────
--
-- Même principe, même classe qui rétrécit : seule la disjonction des cibles
-- gagne une branche. `intervention` est de forme « parc » (D84) : société,
-- `app.client_id` et `app.perimetre_sites` s'y propagent déjà, sans être
-- réécrits ici — les recopier serait une seconde lecture d'un même critère.

DROP POLICY "cloisonnement_heritage" ON "document";

CREATE POLICY "cloisonnement_heritage" ON "document"
  USING (
    (
      EXISTS (SELECT 1 FROM "machine" WHERE "machine"."id" = "document"."machine_id")
      OR EXISTS (SELECT 1 FROM "modele_materiel" WHERE "modele_materiel"."id" = "document"."modele_id")
      OR EXISTS (SELECT 1 FROM "intervention" WHERE "intervention"."id" = "document"."intervention_id")
    )
    AND (
      "classe" = 'client'::"ClasseDocument"
      OR NULLIF(current_setting('app.client_id', true), '') IS NULL
    )
  )
  WITH CHECK (
    (
      EXISTS (SELECT 1 FROM "machine" WHERE "machine"."id" = "document"."machine_id")
      OR EXISTS (SELECT 1 FROM "modele_materiel" WHERE "modele_materiel"."id" = "document"."modele_id")
      OR EXISTS (SELECT 1 FROM "intervention" WHERE "intervention"."id" = "document"."intervention_id")
    )
    AND (
      "classe" = 'client'::"ClasseDocument"
      OR NULLIF(current_setting('app.client_id', true), '') IS NULL
    )
  );

COMMENT ON TABLE "document" IS
  'Documentation d''une machine, d''un modèle ou d''une intervention (lot 8, L8-01 à L8-06 ; troisième cible BON-2). Table métier de la première catégorie de I1, forme « héritage » (D93) : un document est visible si sa CIBLE l''est, et la classe ne fait que rétrécir. La cible est le modèle, la machine OU l''intervention, jamais deux — num_nonnulls(modele_id, machine_id, intervention_id) = 1, par le schéma et non par une validation applicative. Les octets vivent dans un stockage d''objets, jamais ici (L8-05).';

COMMENT ON COLUMN "document"."intervention_id" IS
  'La troisième cible (BON-2) : les photos prises sur une intervention — avant/après, preuve d''un état constaté — qui ne concernent ni un modèle ni une machine en particulier mais la visite elle-même.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. `prestation` GAGNE SA CLÉ COMPOSITE — cible du chaînage qui suit
-- ═══════════════════════════════════════════════════════════════════════════

CREATE UNIQUE INDEX "prestation_societe_id_id_key" ON "prestation" ("societe_id", "id");

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. LES PRESTATIONS RÉALISÉES — `intervention_prestation` (BON-2)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Un simple rattachement, pas une ligne de facturation : voir l'en-tête de
-- cette migration. Forme « filiation » (D103), exactement sur le modèle
-- d'`intervention_machine` — une fille est visible si son parent l'est.

CREATE TABLE "intervention_prestation" (
  "id"              uuid NOT NULL,
  "societe_id"      uuid NOT NULL,
  "intervention_id" uuid NOT NULL,
  "prestation_id"   uuid NOT NULL,
  "cree_le"         timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "intervention_prestation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "intervention_prestation_societe_id_id_key"
  ON "intervention_prestation" ("societe_id", "id");
-- La même prestation ne se déclare pas deux fois réalisée sur la même visite.
CREATE UNIQUE INDEX "intervention_prestation_intervention_id_prestation_id_key"
  ON "intervention_prestation" ("intervention_id", "prestation_id");
CREATE INDEX "intervention_prestation_societe_id_prestation_id_idx"
  ON "intervention_prestation" ("societe_id", "prestation_id");

-- Les deux actions référentielles sont dites (§9, 24/08). `ON DELETE CASCADE`
-- vers l'intervention, comme `intervention_machine` et pour la même raison :
-- une ligne de rattachement n'a aucun sens sans son intervention. `RESTRICT`
-- vers la prestation : une prestation référencée par une réalisation ne
-- s'efface pas en emportant la preuve qu'elle a eu lieu.
ALTER TABLE "intervention_prestation"
  ADD CONSTRAINT "intervention_prestation_societe_id_fkey"
    FOREIGN KEY ("societe_id") REFERENCES "societe"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "intervention_prestation_societe_id_intervention_id_fkey"
    FOREIGN KEY ("societe_id", "intervention_id") REFERENCES "intervention"("societe_id", "id") ON DELETE CASCADE ON UPDATE RESTRICT,
  ADD CONSTRAINT "intervention_prestation_societe_id_prestation_id_fkey"
    FOREIGN KEY ("societe_id", "prestation_id") REFERENCES "prestation"("societe_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "intervention_prestation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "intervention_prestation" FORCE ROW LEVEL SECURITY;

-- `WITH CHECK` répète le `USING` (L1-02c) : on ne rattache une prestation
-- qu'à une intervention qu'on voit.
CREATE POLICY "cloisonnement_filiation" ON "intervention_prestation"
  USING (
    EXISTS (
      SELECT 1 FROM "intervention" "i"
       WHERE "i"."id" = "intervention_prestation"."intervention_id"
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "intervention" "i"
       WHERE "i"."id" = "intervention_prestation"."intervention_id"
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON "intervention_prestation" TO "codiplan_app";

CREATE TRIGGER "journal_audit" AFTER INSERT OR UPDATE OR DELETE ON "intervention_prestation"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

COMMENT ON TABLE "intervention_prestation" IS
  'Les prestations du catalogue déclarées RÉALISÉES sur une intervention (BON-2). Table métier de la première catégorie de I1, forme « filiation » (D103) : une fille est visible si son parent l''est. Ne porte NI durée NI montant propres — voir le catalogue prestation.duree_standard_min et le temps mesuré global de segment_travail.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. LA SIGNATURE CLIENT — `intervention_signature`, HISTORISÉE (BON-2)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Une PREUVE, pas un réglage : voir l'en-tête. Forme « filiation », comme
-- `intervention_prestation`.

CREATE TABLE "intervention_signature" (
  "id"              uuid NOT NULL,
  "societe_id"      uuid NOT NULL,
  "intervention_id" uuid NOT NULL,

  -- Un tracé de canevas encodé en data URI PNG, jamais un fichier : voir
  -- l'en-tête du modèle Prisma. Aucune colonne binaire (I9,
  -- tests/unit/db/aucun-binaire-en-base.test.ts) : du TEXTE, comme tout le
  -- reste du dépôt qui porte des octets encodés.
  "image_base64"    text NOT NULL,

  "cree_le"         timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "intervention_signature_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "intervention_signature"
  ADD CONSTRAINT "intervention_signature_image_non_vide"
  CHECK (btrim("image_base64") <> '');

CREATE UNIQUE INDEX "intervention_signature_societe_id_id_key"
  ON "intervention_signature" ("societe_id", "id");
CREATE INDEX "intervention_signature_societe_id_intervention_id_idx"
  ON "intervention_signature" ("societe_id", "intervention_id");

ALTER TABLE "intervention_signature"
  ADD CONSTRAINT "intervention_signature_societe_id_fkey"
    FOREIGN KEY ("societe_id") REFERENCES "societe"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "intervention_signature_societe_id_intervention_id_fkey"
    FOREIGN KEY ("societe_id", "intervention_id") REFERENCES "intervention"("societe_id", "id") ON DELETE CASCADE ON UPDATE RESTRICT;

ALTER TABLE "intervention_signature" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "intervention_signature" FORCE ROW LEVEL SECURITY;

-- DEUX politiques, une par verbe accordé — jamais `FOR ALL` : c'est la
-- COMMANDE qui borne ici, pas la clause (même raisonnement que D61, D67 sur
-- les formes « appartenance »/« adhésion »). Aucune politique n'existe pour
-- `UPDATE` ni `DELETE` : sous FORCE, un verbe sans politique est refusé pour
-- tout le monde (I8) — c'est ce qui rend une signature réellement immuable,
-- doublé ci-dessous par le retrait du droit lui-même.
CREATE POLICY "cloisonnement_filiation_lecture" ON "intervention_signature"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "intervention" "i"
       WHERE "i"."id" = "intervention_signature"."intervention_id"
    )
  );

CREATE POLICY "cloisonnement_filiation_ajout" ON "intervention_signature"
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "intervention" "i"
       WHERE "i"."id" = "intervention_signature"."intervention_id"
    )
  );

-- `ALTER DEFAULT PRIVILEGES` (migration 20260820130000) accorde d'avance les
-- quatre verbes à `codiplan_app` sur toute table nouvelle. Le retrait est donc
-- EXPLICITE ici, comme sur `journal_audit` (I8) : une preuve qui se modifie ou
-- s'efface en silence cesse d'en être une.
REVOKE UPDATE, DELETE ON "intervention_signature" FROM "codiplan_app";
GRANT SELECT, INSERT ON "intervention_signature" TO "codiplan_app";

CREATE TRIGGER "journal_audit" AFTER INSERT OR UPDATE OR DELETE ON "intervention_signature"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

COMMENT ON TABLE "intervention_signature" IS
  'La signature client d''une intervention (BON-2) — une PREUVE, pas un réglage. HISTORISÉE comme taux_horaire (RG-TAR-04) : une re-signature AJOUTE une ligne, elle n''en réécrit ni n''en efface aucune. UPDATE et DELETE sont retirés au rôle applicatif ET sans politique (I8) : la base tient l''immutabilité en plus de la discipline du dépôt. Aucun statut d''intervention ne bloque l''ajout d''une signature (I5).';
