-- CODIPLAN — Familles et modèles de matériel (ticket L1-05 ; invariant I1 ;
-- arbitrages D4 AMENDÉ, D60, D55).
--
-- ── CE QUE CETTE MIGRATION ÉTABLIT, ET CE QU'ELLE RETIRE ───────────────────
--
-- 1. `famille_materiel` et `modele_materiel` — tables MÉTIER cloisonnées,
--    `societe_id NOT NULL`, forme « société ».
-- 2. Leurs deux déclencheurs d'audit, réclamés par le périmètre INVERSÉ de D55.
-- 3. Et elle RETIRE un mécanisme : « référentiel de plateforme + copie
--    masquante ». Il n'a jamais été construit, et il ne le sera pas.
--
-- ── POURQUOI D4 EST AMENDÉ PLUTÔT QU'APPLIQUÉ ──────────────────────────────
--
-- D4 se contredisait, et la contradiction n'était pas une maladresse de
-- rédaction : elle signale une décision écrite avant que quiconque essaie de
-- l'appliquer.
--
--   * D4 range ces tables parmi les référentiels de plateforme, « modifiables
--     par les seuls rôles éditeur » ;
--   * et D4 écrit dans la même page qu'« une société qui veut l'adapter en crée
--     une copie portant son societe_id ».
--
-- **Une société qui ne peut pas écrire ne peut pas créer de copie.** Et la
-- clause que D4 propose — `societe_id = app.societe_id OR societe_id IS NULL` —
-- n'est pas la forme « référentiel » du CLAUDE.md, dont la lecture est
-- `USING (true)` : sous celle-ci, la copie de la société A serait lisible par B.
--
-- Un troisième point, qui n'est pas une contradiction mais un manque : « la
-- copie masque l'original » est une règle de SÉLECTION, pas de visibilité par
-- ligne. RLS filtre des lignes ; il ne sait pas dire « cache X parce que Y
-- existe ». Rien n'avait dit où cette règle vivrait.
--
-- **La décision d'exploitation du 08/09/2026 retire le mécanisme** plutôt que
-- d'arbitrer entre ses moitiés. C'est la QUATRIÈME fois que ce dépôt tranche
-- dans ce sens — zones géographiques (L1-02), rôles de contact (L1-03),
-- habilitations (D60), et ici — toujours pour la même raison : *une nomenclature
-- partagée fige un territoire dans un produit destiné à être vendu ailleurs.*
--
-- Et une raison de plus, propre à celle-ci : chez CODIMA les modèles ne
-- viendront pas d'un catalogue d'éditeur mais de leur propre fichier de suivi —
-- équipement, marque, modèle, numéro de série. **Ce sont des données saisies,
-- pas un référentiel reçu.**
--
-- ── LA CONSÉQUENCE QUI DISPARAÎT AVEC LE MÉCANISME ─────────────────────────
--
-- Elle avait été mesurée avant d'être évitée : L2-01 rend `modele_id`
-- obligatoire sur une machine. Sous le masquage, une société qui copiait un
-- modèle laissait ses machines déjà créées pointer vers un modèle que sa propre
-- société ne voyait plus. **Plus de copie, plus de masquage, plus de machine
-- orpheline de son modèle.**
--
-- ── LE CATALOGUE DE PLATEFORME, S'IL EXISTE UN JOUR ────────────────────────
--
-- Il sera un AMORÇAGE, comme la liste réglementaire des habilitations : posé à
-- l'ouverture d'une société, complété ou réduit par elle. Aucune migration le
-- jour d'un nouveau territoire. **Le seed n'en pose aucun aujourd'hui** — la
-- liste des familles et des modèles suivis par CODIMA appartient à
-- l'exploitation, et l'inventer serait inventer une donnée métier.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. `famille_materiel` — la famille, saisie par la société
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE "famille_materiel" (
  "id" UUID NOT NULL,
  "societe_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "libelle" TEXT NOT NULL,
  "actif" BOOLEAN NOT NULL DEFAULT true,

  CONSTRAINT "famille_materiel_pkey" PRIMARY KEY ("id")
);

-- Ni code ni libellé vides. En base et pas seulement dans Zod : l'import Excel
-- (L1-08) et une correction manuelle sont deux chemins de plus.
ALTER TABLE "famille_materiel"
  ADD CONSTRAINT "famille_materiel_code_non_vide"
  CHECK (length(btrim("code")) > 0);
ALTER TABLE "famille_materiel"
  ADD CONSTRAINT "famille_materiel_libelle_non_vide"
  CHECK (length(btrim("libelle")) > 0);

CREATE UNIQUE INDEX "famille_materiel_societe_id_code_key"
  ON "famille_materiel" ("societe_id", "code");

-- La CIBLE du chaînage composite de `modele_materiel`. Elle n'ajoute aucune
-- unicité — `id` est déjà clé primaire — : elle rend le couple référençable d'un
-- seul geste, de sorte qu'un modèle ne puisse pas désigner la famille d'une
-- AUTRE société. Les contrôles d'intégrité référentielle contournent les
-- politiques RLS par construction : sans la société dans la clé, le verrou
-- serait muet là où le cloisonnement doit mordre.
CREATE UNIQUE INDEX "famille_materiel_societe_id_id_key"
  ON "famille_materiel" ("societe_id", "id");

-- Les DEUX actions référentielles sont dites, et justifiées (D49). `RESTRICT` en
-- suppression : effacer une société dont des familles dépendent est refusé.
-- `RESTRICT` en mise à jour : `societe.id` est un UUID v7 technique, il ne change
-- pas — et le défaut `CASCADE` de Prisma répondrait tout seul à une question que
-- personne n'a posée.
ALTER TABLE "famille_materiel"
  ADD CONSTRAINT "famille_materiel_societe_id_fkey"
  FOREIGN KEY ("societe_id") REFERENCES "societe"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "famille_materiel" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "famille_materiel" FORCE ROW LEVEL SECURITY;

-- Forme « SOCIÉTÉ » — la forme par défaut d'une table métier ordinaire, et elle
-- suffit ici : une famille n'est la donnée d'aucun client, et rien dans le parc
-- ne la sépare. La branche `OR societe_id IS NULL` de L0-04 n'est pas reprise :
-- sur une colonne `NOT NULL` elle est inerte, et une table nouvelle s'écrit sans
-- elle.
CREATE POLICY "cloisonnement_societe" ON "famille_materiel"
  USING (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
  )
  WITH CHECK (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
  );

CREATE TRIGGER "journal_audit" AFTER INSERT OR UPDATE OR DELETE ON "famille_materiel"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

COMMENT ON TABLE "famille_materiel" IS
  'Famille de matériel suivie par une société. Table MÉTIER cloisonnée et NON référentiel de plateforme : D4 est amendé le 08/09/2026. Le schéma « référentiel + copie masquante » se contredisait — une société qui ne peut pas écrire ne peut pas créer de copie — et « la copie masque l''original » suppose une règle de sélection que RLS ne sait pas porter. Chez CODIMA, les modèles viennent du fichier de suivi, pas d''un catalogue d''éditeur : ce sont des données saisies.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. `modele_materiel` — le modèle, rattaché à sa famille
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE "modele_materiel" (
  "id" UUID NOT NULL,
  "societe_id" UUID NOT NULL,
  "famille_id" UUID NOT NULL,
  "marque" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  -- Le chapitre 11 les nomme ; leur CONTENU n'est fixé par personne, et ce
  -- n'est pas à une migration de l'inventer.
  "caracteristiques" JSONB,
  -- NULLES quand la maintenance n'est pas périodique. Aucune valeur par défaut :
  -- une périodicité est une décision d'exploitation, jamais un défaut technique
  -- (CLAUDE.md §8).
  "periodicite_jours" INTEGER,
  "periodicite_compteur" INTEGER,
  "actif" BOOLEAN NOT NULL DEFAULT true,

  CONSTRAINT "modele_materiel_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "modele_materiel"
  ADD CONSTRAINT "modele_materiel_marque_non_vide"
  CHECK (length(btrim("marque")) > 0);
ALTER TABLE "modele_materiel"
  ADD CONSTRAINT "modele_materiel_reference_non_vide"
  CHECK (length(btrim("reference")) > 0);

-- Une périodicité nulle ou négative n'a pas de sens. Zéro non plus : une
-- maintenance due tous les zéro jours est due en permanence.
ALTER TABLE "modele_materiel"
  ADD CONSTRAINT "modele_materiel_periodicite_jours_positive"
  CHECK ("periodicite_jours" IS NULL OR "periodicite_jours" > 0);
ALTER TABLE "modele_materiel"
  ADD CONSTRAINT "modele_materiel_periodicite_compteur_positive"
  CHECK ("periodicite_compteur" IS NULL OR "periodicite_compteur" > 0);

-- Le couple (marque, référence) identifie un modèle AU SEIN d'une société.
-- Deux sociétés qui suivent le même compresseur en ont chacune une ligne, et
-- c'est le fond de l'amendement : ce n'est plus un fait de la plateforme.
CREATE UNIQUE INDEX "modele_materiel_societe_id_marque_reference_key"
  ON "modele_materiel" ("societe_id", "marque", "reference");

CREATE INDEX "modele_materiel_societe_id_famille_id_idx"
  ON "modele_materiel" ("societe_id", "famille_id");

-- La cible du chaînage composite que `machine` (L2-01) posera à son tour.
CREATE UNIQUE INDEX "modele_materiel_societe_id_id_key"
  ON "modele_materiel" ("societe_id", "id");

ALTER TABLE "modele_materiel"
  ADD CONSTRAINT "modele_materiel_societe_id_fkey"
  FOREIGN KEY ("societe_id") REFERENCES "societe"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- LE CHAÎNAGE COMPOSITE, et c'est lui qui refuse la famille d'une autre
-- société. `RESTRICT` en suppression : une famille qui porte des modèles ne
-- s'efface pas sans qu'on ait traité ses modèles. `RESTRICT` en mise à jour :
-- ni `societe_id` ni `id` ne changent, et le défaut de Prisma répondrait tout
-- seul à une question que personne n'a posée (D49).
ALTER TABLE "modele_materiel"
  ADD CONSTRAINT "modele_materiel_famille_fkey"
  FOREIGN KEY ("societe_id", "famille_id")
  REFERENCES "famille_materiel"("societe_id", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "modele_materiel" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "modele_materiel" FORCE ROW LEVEL SECURITY;

-- Forme « SOCIÉTÉ », et NON « référentiel » : c'est l'amendement à D4 rendu
-- exécutable. Sous la forme « référentiel », la lecture serait `USING (true)` et
-- le modèle d'une société serait lisible par toutes les autres.
--
-- **Et non « parc » non plus.** Un modèle n'est la donnée d'aucun client : rien
-- ne le rattache à `app.client_id` ni à un périmètre de sites. Y ajouter ces
-- filtres retirerait aux comptes portail la lecture d'un modèle dont ils voient
-- déjà la machine.
CREATE POLICY "cloisonnement_societe" ON "modele_materiel"
  USING (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
  )
  WITH CHECK (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
  );

CREATE TRIGGER "journal_audit" AFTER INSERT OR UPDATE OR DELETE ON "modele_materiel"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

COMMENT ON TABLE "modele_materiel" IS
  'Modèle de matériel suivi par une société. Table MÉTIER cloisonnée : D4 est amendé le 08/09/2026 et le schéma « référentiel + copie masquante » est retiré. Conséquence mesurée que l''amendement fait disparaître : sous le masquage, une machine pouvait pointer vers un modèle que sa propre société ne voyait plus (L2-01 rend modele_id obligatoire).';

COMMENT ON COLUMN "modele_materiel"."caracteristiques" IS
  'Caractéristiques libres du modèle (chapitre 11). Leur contenu n''est fixé par personne : ce n''est pas à la base de l''inventer.';
