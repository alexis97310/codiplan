-- ═══════════════════════════════════════════════════════════════════════════
-- LA DEMANDE D'INTERVENTION — le point d'entrée du flux (L2-06, D102)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Chapitre 7/M3 : « Demande d'intervention. Point d'entrée. » Chapitre 11 :
-- `societe_id`, numéro, source, client, site, machine, description, urgence,
-- machine arrêtée, contact, date souhaitée, statut, horodatage de l'accusé de
-- réception. Le ticket L2-06 ajoute les quatre statuts et les quatre motifs.
--
-- Table métier de la PREMIÈRE CATÉGORIE de I1 : `societe_id NOT NULL`, et le
-- gardien d'exhaustivité de D41 la réclamera dans exactement une catégorie dès
-- qu'elle apparaît au schéma.

CREATE TYPE "SourceDemande" AS ENUM (
  'appel', 'portail', 'email', 'echeance_contrat', 'seuil_compteur', 'detection_technicien'
);

CREATE TYPE "StatutDemande" AS ENUM (
  'nouvelle', 'qualifiee', 'transformee', 'close_sans_suite'
);

CREATE TYPE "MotifClotureDemande" AS ENUM (
  'resolue_telephone', 'hors_perimetre', 'refus_client', 'doublon'
);

-- ───────────────────────────────────────────────────────────────────────────
-- LA CLÉ QUE LE CHAÎNAGE DU CONTACT RÉCLAME
-- ───────────────────────────────────────────────────────────────────────────
--
-- `contact` ne portait aucune clé composite. La demande y chaîne sur le COUPLE
-- société + client, et non sur la société seule : *un contact d'un autre client
-- ne peut pas être désigné sur une demande*, et c'est la base qui le tient.
-- C'est la forme exacte du chaînage de `contact` vers `site`, écrit à L1-03.

CREATE UNIQUE INDEX "contact_societe_client_id_key"
  ON "contact" ("societe_id", "client_id", "id");

COMMENT ON INDEX "contact_societe_client_id_key" IS
  'Cible du chaînage de demande.contact_id (L2-06). Elle porte le CLIENT et pas seulement la société : un contact désigné sur une demande appartient au client de cette demande, et la base le tient plutôt qu''une vérification applicative.';

-- ───────────────────────────────────────────────────────────────────────────
-- LA TABLE
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE "demande" (
  "id"                 uuid NOT NULL,
  "societe_id"         uuid NOT NULL,
  "numero"             integer,
  "source"             "SourceDemande" NOT NULL,
  "client_id"          uuid NOT NULL,
  "site_id"            uuid NOT NULL,
  "machine_id"         uuid,
  "agence_id"          uuid NOT NULL,
  "contact_id"         uuid,
  "description"        text NOT NULL,
  "urgence"            "PrioriteIntervention" NOT NULL DEFAULT 'p3',
  "machine_arretee"    boolean NOT NULL DEFAULT false,
  "date_souhaitee"     date,
  "statut"             "StatutDemande" NOT NULL DEFAULT 'nouvelle',
  "depose_le"          timestamptz(3) NOT NULL,
  "compteur_accuse_le" timestamptz(3) NOT NULL,
  "accuse_le"          timestamptz(3),
  "motif_cloture"      "MotifClotureDemande",
  "close_le"           timestamptz(3),
  "cree_le"            timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "modifie_le"         timestamptz(3) NOT NULL,

  CONSTRAINT "demande_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "demande_societe_id_id_key" ON "demande" ("societe_id", "id");
CREATE UNIQUE INDEX "demande_societe_id_numero_key" ON "demande" ("societe_id", "numero");
CREATE INDEX "demande_societe_id_statut_idx" ON "demande" ("societe_id", "statut");
CREATE INDEX "demande_societe_id_client_id_idx" ON "demande" ("societe_id", "client_id");
CREATE INDEX "demande_societe_id_site_id_idx" ON "demande" ("societe_id", "site_id");

-- Les DEUX actions référentielles sont dites et justifiées (§9, 24/08) :
-- `RESTRICT` des deux côtés. Une demande est une TRACE du flux — elle mesure le
-- service rendu à distance quand elle est close sans suite —, et laisser
-- disparaître ou renuméroter son client, son site ou sa machine effacerait
-- cette mesure sans que personne ne l'ait décidé.
ALTER TABLE "demande"
  ADD CONSTRAINT "demande_societe_id_fkey"
    FOREIGN KEY ("societe_id") REFERENCES "societe"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "demande_societe_id_client_id_fkey"
    FOREIGN KEY ("societe_id", "client_id") REFERENCES "client"("societe_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "demande_societe_id_site_id_fkey"
    FOREIGN KEY ("societe_id", "site_id") REFERENCES "site"("societe_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "demande_societe_id_machine_id_fkey"
    FOREIGN KEY ("societe_id", "machine_id") REFERENCES "machine"("societe_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "demande_societe_id_agence_id_fkey"
    FOREIGN KEY ("societe_id", "agence_id") REFERENCES "agence"("societe_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "demande_societe_id_client_id_contact_id_fkey"
    FOREIGN KEY ("societe_id", "client_id", "contact_id") REFERENCES "contact"("societe_id", "client_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ───────────────────────────────────────────────────────────────────────────
-- LES ÉQUIVALENCES, ÉCRITES DANS LES DEUX SENS
-- ───────────────────────────────────────────────────────────────────────────
--
-- *Le second sens est celui qu'on oublie* : une exception sans motif est
-- refusée, et un motif sans exception aussi (la leçon de `vgp/`). Ici, une
-- clôture sans motif effacerait la mesure du service rendu à distance ; un
-- motif posé sur une demande qui suit son cours dirait qu'elle est close alors
-- qu'elle ne l'est pas.

ALTER TABLE "demande"
  ADD CONSTRAINT "demande_cloture_a_son_motif" CHECK (
    ("statut" = 'close_sans_suite') = ("motif_cloture" IS NOT NULL)
  ),
  ADD CONSTRAINT "demande_cloture_a_sa_date" CHECK (
    ("statut" = 'close_sans_suite') = ("close_le" IS NOT NULL)
  );

-- **Aucune contrainte n'ordonne `accuse_le` et `compteur_accuse_le`, et c'est
-- une décision.** Le départ du compteur est l'ouverture SUIVANTE (D13) ; une
-- demande déposée le dimanche à 22 h et rappelée le dimanche à 23 h par une
-- astreinte porte donc un accusé ANTÉRIEUR à son départ de compteur. Exiger
-- l'ordre refuserait d'enregistrer un service réellement rendu — et c'est
-- exactement ce que la mesure des 30 minutes cherche à récompenser.

-- ───────────────────────────────────────────────────────────────────────────
-- LE CLOISONNEMENT — forme « parc » (D102, D10, D22)
-- ───────────────────────────────────────────────────────────────────────────
--
-- Société ET `app.client_id` ET `app.perimetre_sites`. La clause de société
-- SEULE est exclue par RG-DRO-01 — *un client n'accède qu'aux données de son
-- propre périmètre* — et la mesure du 07/09 : sous société seule, un compte
-- portail lirait les demandes des autres clients de sa propre société.
--
-- La colonne de périmètre est `site_id` : une demande vise un site, comme une
-- intervention y a lieu. C'est aussi pourquoi `site_id` est NOT NULL — une
-- demande sans site serait une demande qu'aucun compte de portail restreint ne
-- pourrait lire, c'est-à-dire une ligne invisible à celui qui l'a déposée.
--
-- La branche `OR societe_id IS NULL` de L0-04 n'est pas reprise : sur une
-- colonne NOT NULL elle est inerte, et une table nouvelle s'écrit sans elle.
--
-- Le `WITH CHECK` est ÉCRIT même s'il répète le `USING` : une politique qui
-- n'énonce qu'un `USING` légifère en silence sur les écritures (L1-02c). Et il
-- compte ici plus qu'ailleurs : P5 du chapitre 9 fait ÉCRIRE un compte de
-- portail dans cette table.

ALTER TABLE "demande" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "demande" FORCE ROW LEVEL SECURITY;

CREATE POLICY "cloisonnement_parc" ON "demande"
  USING (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
    AND (
      NULLIF(current_setting('app.client_id', true), '') IS NULL
      OR "client_id" = NULLIF(current_setting('app.client_id', true), '')::uuid
    )
    AND (
      NULLIF(current_setting('app.perimetre_sites', true), '') IS NULL
      OR "site_id" = ANY(
        string_to_array(NULLIF(current_setting('app.perimetre_sites', true), ''), ',')::uuid[]
      )
    )
  )
  WITH CHECK (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
    AND (
      NULLIF(current_setting('app.client_id', true), '') IS NULL
      OR "client_id" = NULLIF(current_setting('app.client_id', true), '')::uuid
    )
    AND (
      NULLIF(current_setting('app.perimetre_sites', true), '') IS NULL
      OR "site_id" = ANY(
        string_to_array(NULLIF(current_setting('app.perimetre_sites', true), ''), ',')::uuid[]
      )
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON "demande" TO "codiplan_app";

-- ───────────────────────────────────────────────────────────────────────────
-- LE CYCLE DE VIE, TENU PAR LA BASE
-- ───────────────────────────────────────────────────────────────────────────
--
-- *Une action refusée à l'écran mais acceptée par la base est un trou* : un
-- écran se contourne par une requête, un déclencheur ne se contourne pas. Les
-- transitions sont celles de `lib/demandes/cycle-de-vie.ts`, et un scénario
-- d'isolation confronte les deux — deux lectures d'un même critère divergent en
-- silence (§9, 01/09).

CREATE OR REPLACE FUNCTION "demande_cycle_de_vie"()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."statut" = NEW."statut" THEN
    RETURN NEW;
  END IF;

  IF OLD."statut" = 'transformee' THEN
    RAISE EXCEPTION
      'Demande déjà transformée en intervention : elle ne change plus de statut. C''est l''intervention qui se poursuit ou s''annule.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF OLD."statut" = 'close_sans_suite' THEN
    RAISE EXCEPTION
      'Demande close sans suite : elle ne se rouvre pas. Le motif mesure le service rendu à distance, et le réécrire l''effacerait ; déposer une nouvelle demande.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW."statut" = 'transformee' AND OLD."statut" <> 'qualifiee' THEN
    RAISE EXCEPTION
      'Une demande se transforme en intervention depuis QUALIFIEE seulement : la qualification est ce qui décide du type, de la durée et de l''affectation.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW."statut" = 'nouvelle' THEN
    RAISE EXCEPTION
      'Une demande ne revient pas à NOUVELLE : ce qui a été qualifié l''a été.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "demande_cycle_de_vie" BEFORE UPDATE ON "demande"
  FOR EACH ROW EXECUTE FUNCTION "demande_cycle_de_vie"();

-- ───────────────────────────────────────────────────────────────────────────
-- L'AUDIT (I8, D55)
-- ───────────────────────────────────────────────────────────────────────────
--
-- Le périmètre est INVERSÉ : le gardien de `scripts/lib/perimetre-audit.ts`
-- réclame ce déclencheur le jour où la table apparaît au schéma. Aucune
-- exemption n'est demandée — la liste est vide et le reste.

CREATE TRIGGER "journal_audit" AFTER INSERT OR UPDATE OR DELETE ON "demande"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

COMMENT ON TABLE "demande" IS
  'Demande d''intervention, point d''entrée du flux (L2-06, D102). Table métier de la première catégorie de I1, forme « parc » — société ET app.client_id ET app.perimetre_sites. La clause de société SEULE est exclue par RG-DRO-01 : un compte portail lirait les demandes des autres clients de sa propre société, et P5 du chapitre 9 fait ÉCRIRE un compte portail dans cette table. Elle ne porte aucun lien vers l''intervention qu''elle devient : le chapitre 11 met demande_id sur intervention, et l''écrire des deux côtés serait deux écritures d''un même fait.';

COMMENT ON COLUMN "demande"."agence_id" IS
  'DÉDUITE du site, jamais saisie (D56). C''est elle qui décide du calendrier de référence de l''accusé de réception (D13, I7) : « Accusé de réception sous 30 minutes : en heures ouvrées de l''agence. »';

COMMENT ON COLUMN "demande"."compteur_accuse_le" IS
  'L''instant où le compteur des 30 minutes COMMENCE — l''ouverture suivante du calendrier de l''agence (D13). MATÉRIALISÉ et jamais recalculé : il dépend du calendrier tel qu''il était au dépôt, et déclarer un férié travaillé ferait reculer des mois plus tard le départ d''un compteur déjà consommé, sans qu''aucune écriture ne le dise. C''est le motif de D85 hors du cloisonnement.';

COMMENT ON COLUMN "demande"."accuse_le" IS
  'L''instant où l''accusé a RÉELLEMENT été donné. NUL ne veut pas dire « hors délai » : lib/demandes distingue trois états — répondu dans le standard, répondu hors standard, sans réponse — et jamais un booléen, qui ne peut pas porter trois états.';

COMMENT ON COLUMN "demande"."site_id" IS
  'NOT NULL, et c''est la colonne de périmètre de la politique. Une demande sans site serait une demande qu''aucun compte de portail restreint ne pourrait lire — c''est-à-dire une ligne invisible à celui qui l''a déposée.';
