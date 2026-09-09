-- ═══════════════════════════════════════════════════════════════════════════
-- L2-10 — TECHNICIENS, INTERVENTIONS, TEMPS PASSÉ
-- Invariants I1, I5, I8 ; chapitre 11.2 (technicien, intervention,
-- intervention_temps) ; chapitre 7 / M3 pour le cycle de vie ;
-- arbitrages D10, D22, D49, D55, D81.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ## Pourquoi ces trois tables ensemble
--
-- Le planning est le cœur du produit, et il n'existait AUCUNE table pour le
-- porter : ni technicien, ni intervention, ni temps. Un écran de planning bâti
-- sur un jeu figé dans le composant n'aurait rien prouvé — ni le cloisonnement,
-- ni la valorisation, ni le refus d'affectation. Les trois naissent donc
-- ensemble, parce qu'aucune ne se tient seule : une intervention sans
-- technicien ne se pose pas sur une colonne, un temps sans intervention ne se
-- valorise pas.
--
-- **Ce n'est pas une règle inventée : le chapitre 11.2 énumère ces trois tables
-- colonne par colonne**, et le chapitre 7/M3 donne le cycle de vie. Ce qui est
-- écrit ici est ce qui y est écrit, moins les chaînages dont la cible n'existe
-- pas encore.
--
-- ## CE QUI EST DÉLIBÉRÉMENT ABSENT, ET POURQUOI
--
-- - `demande_id` et `contrat_id` : les tables `demande` et `contrat` n'existent
--   pas. Une colonne qui ne peut pas porter sa clé étrangère est une colonne
--   sans verrou (§9, 23/08 — une contrainte posée sur une colonne nullable est
--   une contrainte facultative). Elles arriveront avec leurs tables.
-- - L'AFFECTATION MULTIPLE. Le chapitre 11 la prévoit (« affectation multiple
--   avec un technicien référent ») ; elle appartient au dispatch, M4, lot 3.
--   `technicien_referent_id` seul est posé, et c'est lui qui fait la colonne du
--   planning. Une table d'affectation posée ici serait un écran de lot 3 écrit
--   en avance.
-- - L'ATTRIBUTION du `numero`. Comme pour `machine` (D7) : la colonne existe,
--   son unicité par société est posée, et aucun code ne l'attribue. Le format
--   `INT-AAAA-NNNNN` est écrit au chapitre 11 ; le compteur appartient à la
--   qualification, et l'inventer ici poserait une règle que personne n'a prise.
--
-- ## D81 — L'HORLOGE N'ENTRE PAS DANS LE CLOISONNEMENT
--
-- Aucune politique posée ici n'évalue l'heure. L'expiration d'une habilitation
-- refuse une AFFECTATION (RG-PLA-04, `lib/habilitations/affectation.ts`) ; elle
-- ne masque aucune ligne. C'est pourquoi il n'y a pas de colonne « refus » sur
-- `intervention` : le refus est un VERDICT calculé à la lecture, avec sa raison,
-- et le planning l'affiche à sa place plutôt que de le faire disparaître.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. LES ÉNUMÉRATIONS — en base, comme celles de `machine`
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Ce sont des états du cycle de vie et des natures d'engagement : une société
-- tierce aura les mêmes, et une valeur de plus doit être une migration qu'on
-- voit passer. À l'inverse des zones géographiques (D23) et des rôles de
-- contact, qui sont des nomenclatures d'un territoire ou d'une maison.

CREATE TYPE "TypeIntervention" AS ENUM (
  'preventif_contrat', 'preventif_hors_contrat', 'curatif', 'installation',
  'garantie', 'controle_reglementaire', 'expertise', 'reprise', 'recensement'
);

CREATE TYPE "PrioriteIntervention" AS ENUM ('p1', 'p2', 'p3', 'p4');

-- Le cycle de vie du chapitre 7/M3, dans son ordre de lecture. `suspendue`
-- couvre l'attente de pièce — quatre mois d'approvisionnement maritime — et
-- c'est la raison pour laquelle il est un statut et non un drapeau.
CREATE TYPE "StatutIntervention" AS ENUM (
  'brouillon', 'a_planifier', 'planifiee', 'envoyee', 'en_cours',
  'reportee', 'suspendue', 'terminee', 'rapport_a_valider', 'cloturee',
  'annulee'
);

CREATE TYPE "ModeValorisation" AS ENUM (
  'forfait', 'temps_passe', 'forfait_plus_heures'
);

CREATE TYPE "StatutFacturation" AS ENUM (
  'non_facturable', 'a_facturer', 'facturee'
);

-- Les quatre natures de temps du chapitre 11. `trajet` est la seule dont le
-- caractère facturable est décidé ailleurs qu'ici — D74 en fait une donnée de
-- PLANIFICATION, et la charte visuelle lui impose d'être VISIBLE et marqué
-- « non facturé ». Un temps qu'on ne montre pas est un temps qu'on croit gratuit.
CREATE TYPE "TypeTempsIntervention" AS ENUM (
  'trajet', 'intervention', 'attente', 'pause'
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. `technicien` — table métier ORDINAIRE, forme « société »
-- ═══════════════════════════════════════════════════════════════════════════
--
-- **Elle se rattache à `utilisateur_societe`, jamais à `utilisateur` seul**, et
-- pour la raison exacte de `technicien_habilitation` (L1-04) : on est technicien
-- EN TANT QUE salarié d'une société. Le chaînage composite
-- `(utilisateur_id, societe_id)` interdit déclarativement de faire technicien
-- quelqu'un qui n'appartient pas à la société — les contrôles d'intégrité
-- référentielle contournant les politiques RLS par construction.
--
-- Elle ne recopie AUCUNE habilitation : celles-ci vivent dans
-- `technicien_habilitation`, clées sur le même couple. Deux sources d'un même
-- fait divergent en silence (§9, 01/09).

CREATE TABLE "technicien" (
  "id"             uuid PRIMARY KEY,
  "societe_id"     uuid NOT NULL,
  "utilisateur_id" uuid NOT NULL,

  -- L'agence de rattachement. C'est elle qui décide de la majoration (I7) et,
  -- à défaut de calendrier propre, des jours et heures travaillés.
  "agence_id"      uuid NOT NULL,

  -- **L'EXCEPTION PAR TECHNICIEN**, et elle est NULLE par défaut. Un technicien
  -- sans calendrier propre suit celui de son agence : c'est le cas général, et
  -- une colonne obligatoire aurait obligé à recopier le calendrier de l'agence
  -- sur chaque ligne — c'est-à-dire à créer la divergence qu'on veut éviter.
  "calendrier_id"  uuid,

  -- Coût interne, en unités mineures de la devise de la société (I2, I3).
  -- Aucune décimale n'est supposée ici : c'est `devise.decimales` qui décide.
  "cout_horaire"   bigint,
  "vehicule"       text,
  "actif"          boolean NOT NULL DEFAULT true,

  "cree_le"        timestamptz NOT NULL DEFAULT now(),
  "modifie_le"     timestamptz NOT NULL DEFAULT now()
);

-- Une personne n'est technicien qu'une fois dans une société.
CREATE UNIQUE INDEX "technicien_utilisateur_id_societe_id_key"
  ON "technicien" ("utilisateur_id", "societe_id");

-- Cible des chaînages composites — `intervention` et `intervention_temps` s'y
-- adossent, de sorte qu'aucune intervention ne puisse désigner le technicien
-- d'une AUTRE société.
CREATE UNIQUE INDEX "technicien_societe_id_id_key"
  ON "technicien" ("societe_id", "id");

CREATE INDEX "technicien_societe_agence_idx"
  ON "technicien" ("societe_id", "agence_id");

ALTER TABLE "technicien"
  ADD CONSTRAINT "technicien_cout_horaire_positif"
  CHECK ("cout_horaire" IS NULL OR "cout_horaire" >= 0);

-- ── Chaînages : les DEUX actions écrites, et justifiées (§9, 24/08) ────────
--
-- `ON DELETE RESTRICT` partout : retirer une agence, un calendrier ou une
-- habilitation de société à quelqu'un qui porte des interventions est une
-- décision d'exploitation, jamais un effet de bord.
-- `ON UPDATE RESTRICT` partout : `societe_id` entre dans chaque clé, et une
-- propagation silencieuse ferait changer de société un technicien entier.

ALTER TABLE "technicien" ADD CONSTRAINT "technicien_societe_id_fkey"
  FOREIGN KEY ("societe_id") REFERENCES "societe" ("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "technicien" ADD CONSTRAINT "technicien_membre_fkey"
  FOREIGN KEY ("utilisateur_id", "societe_id")
  REFERENCES "utilisateur_societe" ("utilisateur_id", "societe_id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "technicien" ADD CONSTRAINT "technicien_agence_fkey"
  FOREIGN KEY ("societe_id", "agence_id") REFERENCES "agence" ("societe_id", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "technicien" ADD CONSTRAINT "technicien_calendrier_fkey"
  FOREIGN KEY ("calendrier_id") REFERENCES "calendrier" ("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "technicien" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "technicien" FORCE ROW LEVEL SECURITY;

-- Forme « société ». PAS la forme « parc » : un technicien n'appartient à aucun
-- client, et lui donner un `client_id` serait recopier un rattachement qui
-- n'existe pas. Un compte portail ne lit donc pas cette table du tout — la
-- clause de société ne le sert pas, et c'est correct : le nom du technicien qui
-- vient chez lui lui arrivera par l'intervention, au lot 5.
CREATE POLICY "cloisonnement_societe" ON "technicien"
  USING ("societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid)
  WITH CHECK ("societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "technicien" TO "codiplan_app";

CREATE TRIGGER "journal_audit" AFTER INSERT OR UPDATE OR DELETE ON "technicien"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. `intervention` — table métier ordinaire, forme « PARC »
-- ═══════════════════════════════════════════════════════════════════════════
--
-- La forme « parc » et non « société » : une intervention porte `client_id` et
-- `site_id`, et c'est par elle qu'un compte portail verra ses propres visites
-- (D10). Lui donner la clause de société seule aurait laissé un compte portail
-- du client A lire les interventions du client B de la même société — la fuite
-- exacte que L1-02b a mesurée sur les tables d'habilitation.

CREATE TABLE "intervention" (
  "id"                     uuid PRIMARY KEY,
  "societe_id"             uuid NOT NULL,

  -- Numéro AFFICHÉ, INT-AAAA-NNNNN, unique par société. NUL tant que la
  -- qualification ne l'a pas attribué — et rien ne l'attribue à ce jour.
  "numero"                 text,

  "client_id"              uuid NOT NULL,
  "site_id"                uuid NOT NULL,
  "agence_id"              uuid NOT NULL,

  "type"                   "TypeIntervention" NOT NULL,
  "priorite"               "PrioriteIntervention" NOT NULL DEFAULT 'p3',
  "statut"                 "StatutIntervention" NOT NULL DEFAULT 'brouillon',
  "libelle"                text NOT NULL,

  -- Le créneau. `creneau_debut` et `creneau_fin` sont des INSTANTS ; la date
  -- planifiée est une date LOCALE de l'agence, et les deux ne se déduisent pas
  -- l'une de l'autre sous UTC+11 (L0-08).
  "date_planifiee"         date,
  "creneau_debut"          timestamptz,
  "creneau_fin"            timestamptz,
  "duree_estimee_min"      integer,

  "technicien_referent_id" uuid,

  -- La valorisation. `taux_horaire_applique` est HISTORISÉ à la qualification
  -- (RG-TAR-04) : une facture qui change quand le tarif change est une facture
  -- fausse. Il est en unités mineures, comme tout montant (I3).
  "mode_valorisation"      "ModeValorisation" NOT NULL DEFAULT 'temps_passe',
  "forfait_id"             uuid,
  "taux_horaire_applique"  bigint,
  "montant_ht"             bigint,
  "devise_code"            text NOT NULL,
  "statut_facturation"     "StatutFacturation" NOT NULL DEFAULT 'a_facturer',

  "motif_suspension"       text,
  "sla_echeance_at"        timestamptz,

  "cree_le"                timestamptz NOT NULL DEFAULT now(),
  "modifie_le"             timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "intervention_societe_numero_key"
  ON "intervention" ("societe_id", "numero");

CREATE UNIQUE INDEX "intervention_societe_id_id_key"
  ON "intervention" ("societe_id", "id");

CREATE INDEX "intervention_planning_idx"
  ON "intervention" ("societe_id", "technicien_referent_id", "creneau_debut");
CREATE INDEX "intervention_societe_site_idx"
  ON "intervention" ("societe_id", "site_id");

-- Un créneau se termine après avoir commencé. Les deux sont nuls ensemble ou
-- renseignés ensemble : un créneau à moitié posé n'est pas un créneau.
ALTER TABLE "intervention"
  ADD CONSTRAINT "intervention_creneau_coherent"
  CHECK (
    ("creneau_debut" IS NULL AND "creneau_fin" IS NULL)
    OR ("creneau_debut" IS NOT NULL AND "creneau_fin" IS NOT NULL
        AND "creneau_fin" > "creneau_debut")
  );

ALTER TABLE "intervention"
  ADD CONSTRAINT "intervention_libelle_non_vide"
  CHECK (btrim("libelle") <> '');

ALTER TABLE "intervention"
  ADD CONSTRAINT "intervention_montants_positifs"
  CHECK (
    ("taux_horaire_applique" IS NULL OR "taux_horaire_applique" >= 0)
    AND ("montant_ht" IS NULL OR "montant_ht" >= 0)
    AND ("duree_estimee_min" IS NULL OR "duree_estimee_min" > 0)
  );

ALTER TABLE "intervention" ADD CONSTRAINT "intervention_societe_id_fkey"
  FOREIGN KEY ("societe_id") REFERENCES "societe" ("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "intervention" ADD CONSTRAINT "intervention_client_fkey"
  FOREIGN KEY ("societe_id", "client_id") REFERENCES "client" ("societe_id", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "intervention" ADD CONSTRAINT "intervention_site_fkey"
  FOREIGN KEY ("societe_id", "site_id") REFERENCES "site" ("societe_id", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "intervention" ADD CONSTRAINT "intervention_agence_fkey"
  FOREIGN KEY ("societe_id", "agence_id") REFERENCES "agence" ("societe_id", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "intervention" ADD CONSTRAINT "intervention_technicien_fkey"
  FOREIGN KEY ("societe_id", "technicien_referent_id")
  REFERENCES "technicien" ("societe_id", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- La cible manquait : `forfait` n'avait que `(societe_id, code)`. On la pose
-- ici, comme L1-05 avait posé celle de `modele_materiel` — un couple
-- (société, objet) référençable d'un seul geste, de sorte qu'une intervention
-- ne puisse pas appliquer le forfait d'une AUTRE société.
CREATE UNIQUE INDEX "forfait_societe_id_id_key" ON "forfait" ("societe_id", "id");

ALTER TABLE "intervention" ADD CONSTRAINT "intervention_forfait_fkey"
  FOREIGN KEY ("societe_id", "forfait_id") REFERENCES "forfait" ("societe_id", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "intervention" ADD CONSTRAINT "intervention_devise_fkey"
  FOREIGN KEY ("devise_code") REFERENCES "devise" ("code")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "intervention" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "intervention" FORCE ROW LEVEL SECURITY;

CREATE POLICY "cloisonnement_parc" ON "intervention"
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

GRANT SELECT, INSERT, UPDATE, DELETE ON "intervention" TO "codiplan_app";

CREATE TRIGGER "journal_audit" AFTER INSERT OR UPDATE OR DELETE ON "intervention"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. `intervention_temps` — LA PREMIÈRE TABLE FILLE RÉELLE, forme « FILIATION »
-- ═══════════════════════════════════════════════════════════════════════════
--
-- **La dixième forme de politique, et elle était attendue.** Le critère de
-- `scripts/lib/politiques-rls.ts` la réclame depuis L1-02 : *la première table
-- FILLE réelle d'une table du parc.* `intervention_temps` en est une — une
-- ligne de temps n'a pas de rattachement propre au parc, elle a un PARENT.
--
-- Le principe, tranché depuis L1-02 : **une fille est visible si son parent
-- l'est.** La clause s'adosse à la clé étrangère, et rien n'est réécrit :
--
--     EXISTS (SELECT 1 FROM intervention WHERE … id = … intervention_id)
--
-- **Pourquoi PAS la forme « parc », qui était la rédaction de première main.**
-- Elle exigeait de porter `client_id` et `site_id` sur la ligne de temps. Ces
-- deux colonnes auraient été une SECONDE SOURCE d'un fait que l'intervention
-- porte déjà (§9, 01/09), et l'argument « la clé étrangère composite les tient
-- égales » ne répond qu'à moitié : il rend la divergence impossible, il ne rend
-- pas la duplication utile. La question de cette table est bien « mon parent
-- est-il visible ? », et c'est celle-là que la forme doit poser.
--
-- **Pourquoi PAS la forme « société ».** Elle laisserait un compte portail
-- restreint au site S1 lire les temps passés sur le site S2 du même client —
-- c'est-à-dire la durée des visites d'un atelier dont il n'a pas le périmètre.
--
-- **Ce que la sous-requête coûte, mesuré et non supposé** : PostgreSQL la
-- résout en *hash semi-join*, soit UNE visite du parent et non une par ligne
-- lue. L'index `intervention_temps_intervention_idx` la sert.
--
-- **Et la sous-requête est elle-même soumise aux politiques de `intervention`**,
-- qui est de forme « parc » : le périmètre du portail mord donc une fois, sur le
-- parent, et se propage. C'est exactement ce que « visible si son parent l'est »
-- veut dire, et c'est ce qui rend la duplication inutile.

CREATE TABLE "intervention_temps" (
  "id"              uuid PRIMARY KEY,
  "societe_id"      uuid NOT NULL,
  "intervention_id" uuid NOT NULL,
  "technicien_id"   uuid NOT NULL,

  "type"            "TypeTempsIntervention" NOT NULL,
  "debut"           timestamptz NOT NULL,
  "fin"             timestamptz NOT NULL,

  -- Le temps RÉEL, en minutes. Il n'est jamais arrondi ici : l'arrondi est une
  -- règle de VALORISATION, appliquée une seule fois sur l'intervention entière
  -- (D45), et l'appliquer par ligne le multiplierait par le nombre de tâches.
  "duree_min"       integer NOT NULL,

  -- Le trajet est du temps réel qui n'est PAS facturé (D74). La colonne le dit
  -- ligne par ligne plutôt que de le déduire du type : une société qui
  -- facturerait le déplacement au temps passé existe, et le déduire du type
  -- écrirait sa politique tarifaire dans le schéma.
  "facturable"      boolean NOT NULL,

  "cree_le"         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "intervention_temps_intervention_idx"
  ON "intervention_temps" ("societe_id", "intervention_id");
CREATE INDEX "intervention_temps_technicien_idx"
  ON "intervention_temps" ("societe_id", "technicien_id", "debut");

ALTER TABLE "intervention_temps"
  ADD CONSTRAINT "intervention_temps_intervalle_coherent"
  CHECK ("fin" > "debut" AND "duree_min" > 0);

ALTER TABLE "intervention_temps"
  ADD CONSTRAINT "intervention_temps_societe_id_fkey"
  FOREIGN KEY ("societe_id") REFERENCES "societe" ("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- LE chaînage dont la politique se sert. Composite par la société, comme tous
-- les autres : une ligne de temps ne peut pas désigner l'intervention d'une
-- AUTRE société, les contrôles d'intégrité référentielle contournant les
-- politiques RLS par construction.
--
-- `ON DELETE CASCADE` — et c'est la SEULE cascade de cette migration, écrite
-- comme une décision : une ligne de temps n'a aucun sens sans son intervention,
-- et la garder orpheline ferait un temps qu'aucun écran ne peut plus rattacher.
-- `ON UPDATE RESTRICT` : `societe_id` entre dans la clé.
ALTER TABLE "intervention_temps"
  ADD CONSTRAINT "intervention_temps_intervention_fkey"
  FOREIGN KEY ("societe_id", "intervention_id")
  REFERENCES "intervention" ("societe_id", "id")
  ON DELETE CASCADE ON UPDATE RESTRICT;

ALTER TABLE "intervention_temps"
  ADD CONSTRAINT "intervention_temps_technicien_fkey"
  FOREIGN KEY ("societe_id", "technicien_id")
  REFERENCES "technicien" ("societe_id", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "intervention_temps" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "intervention_temps" FORCE ROW LEVEL SECURITY;

-- La clause de société est CONSERVÉE à côté de la filiation, comme sur
-- `site_habilitation_requise` : elle ne coûte rien, elle est indexée, et elle
-- refuse une écriture inter-société avant même que la sous-requête soit
-- évaluée. La filiation n'est pas un remplacement du cloisonnement, elle est ce
-- qui s'y ajoute.
CREATE POLICY "cloisonnement_filiation" ON "intervention_temps"
  USING (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
    AND EXISTS (
      SELECT 1 FROM "intervention" "parent"
      WHERE "parent"."id" = "intervention_temps"."intervention_id"
    )
  )
  WITH CHECK (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
    AND EXISTS (
      SELECT 1 FROM "intervention" "parent"
      WHERE "parent"."id" = "intervention_temps"."intervention_id"
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON "intervention_temps" TO "codiplan_app";

CREATE TRIGGER "journal_audit"
  AFTER INSERT OR UPDATE OR DELETE ON "intervention_temps"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

COMMENT ON TABLE "technicien" IS
  'Le technicien EN TANT QUE salarié d''une société (chapitre 11.2). Table métier de la première catégorie de I1, forme « société ». Rattachée à utilisateur_societe et jamais à utilisateur seul, comme technicien_habilitation (L1-04) : le chaînage composite (utilisateur_id, societe_id) interdit déclarativement de faire technicien quelqu''un qui n''appartient pas à la société. calendrier_id est l''EXCEPTION par technicien, nulle par défaut — sans elle, ce sont les jours et heures de son agence qui valent (I7).';

COMMENT ON TABLE "intervention" IS
  'L''intervention (chapitre 11.2, cycle de vie 7/M3). Table métier de la première catégorie de I1, forme « parc » — société ET app.client_id ET app.perimetre_sites (D10, D22) : c''est par elle qu''un compte portail verra ses propres visites, et la clause de société seule aurait laissé le client A lire les interventions du client B. AUCUNE colonne ne porte un refus d''affectation : le refus est un VERDICT calculé à la lecture (RG-PLA-04) et affiché à sa place, l''horloge n''entrant pas dans le cloisonnement (D81).';

COMMENT ON COLUMN "intervention"."taux_horaire_applique" IS
  'Taux HISTORISÉ à la qualification (RG-TAR-04), en unités mineures de devise_code. Il est figé sur la ligne parce qu''une facture qui change quand le tarif change est une facture fausse : la lecture ne rappelle jamais le taux courant.';

COMMENT ON TABLE "intervention_temps" IS
  'Le temps passé, ligne par ligne (chapitre 11.2). PREMIÈRE table FILLE réelle d''une table du parc, et donc la première à porter la forme « FILIATION » que le critère de politiques-rls.ts réclamait depuis L1-02 : une fille est visible si son parent l''est, par une clause adossée à sa clé étrangère. Elle ne porte NI client_id NI site_id — ils auraient été une seconde source d''un fait que l''intervention porte déjà — et la sous-requête étant elle-même soumise aux politiques de intervention, qui est de forme « parc », le périmètre du portail mord une fois sur le parent et se propage.';

COMMENT ON COLUMN "intervention_temps"."facturable" IS
  'Dit ligne par ligne si ce temps se facture, plutôt que de le déduire du type. Le trajet est du temps RÉEL non facturé (D74) et il doit rester VISIBLE : un temps qu''on ne montre pas est un temps qu''on croit gratuit. Le déduire du type écrirait une politique tarifaire dans le schéma — une société qui facture le déplacement au temps passé existe.';
