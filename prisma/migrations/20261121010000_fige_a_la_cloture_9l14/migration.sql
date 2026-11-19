-- ═══════════════════════════════════════════════════════════════════════════
-- TOUT EST FIGÉ À LA CLÔTURE, EN BASE (9L14-FIGE-A-LA-CLOTURE, décision
-- d'Alexis du 10/11/2026, option 1 — précise I5).
-- ═══════════════════════════════════════════════════════════════════════════
--
-- AVANT cette migration, I5 lisait « le travail terrain n'est jamais perdu,
-- même sur une intervention clôturée ou annulée » comme une autorisation
-- D'ÉCRIRE après coup sur la signature, les prestations réalisées, les
-- photos et la machine. La décision du 10/11/2026 la précise : CES QUATRE
-- TABLES FILLES SONT DÉSORMAIS FIGÉES À LA CLÔTURE — et ce que le terrain
-- tente malgré tout (téléphone resté hors réseau pendant la clôture, par
-- exemple) n'est pas perdu pour autant : il est gardé À PART
-- (`saisie_apres_cloture`), jamais appliqué d'office, et signalé à l'ADV.
--
-- ## CE QUE CETTE MIGRATION FAIT
--
--   1. `saisie_apres_cloture` — la table qui garde toute saisie refusée pour
--      cause de clôture (forme « filiation », D103, sur le modèle
--      d'`intervention_pause`).
--   2. `EvenementNotification` reçoit une nouvelle valeur,
--      `saisie_apres_cloture`, pour que `poserNotification` puisse alerter
--      l'ADV.
--   3. QUATRE déclencheurs `BEFORE` qui refusent, EN BASE, toute écriture sur
--      `intervention_prestation`, `intervention_signature`,
--      `intervention_machine` et `document` (quand sa cible est une
--      intervention) tant que l'intervention visée est `cloturee` ou
--      `annulee` — une seule fonction, partagée, qui lit le statut parent.
--      Chaque déclencheur ne porte que les verbes que le rôle applicatif
--      détient déjà sur sa table (mesuré : `intervention_signature` n'a plus
--      ni `UPDATE` ni `DELETE` depuis `20260922100000_rapport_terrain_bon_2`).
--
-- ## CE QU'ELLE NE FAIT PAS
--
-- Elle ne touche à aucune transition de `intervention.statut` : le refus de
-- déplacement/affectation dès « terminée » (point 3 du ticket) et
-- l'annulation de la validation du rapport à la réouverture (point 4) sont
-- des refus et des écritures APPLICATIFS (`cycle-de-vie.ts`,
-- `depot-compteur.ts`), pas une garde de base — la matrice D8
-- (`intervention_cycle_de_vie`) reste inchangée, elle autorisait déjà
-- `TERMINEE → EN_COURS`.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. LA SAISIE GARDÉE — `saisie_apres_cloture`
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TYPE "TypeSaisieApresCloture" AS ENUM ('prestations', 'signature', 'photo', 'machine');

CREATE TABLE "saisie_apres_cloture" (
  "id"              uuid NOT NULL,
  "societe_id"      uuid NOT NULL,
  "intervention_id" uuid NOT NULL,

  "type" "TypeSaisieApresCloture" NOT NULL,

  -- Le contenu tel que l'appareil l'a envoyé — pour que le bureau voie CE
  -- QUI a été tenté, jamais seulement qu'une tentative a eu lieu.
  "contenu" jsonb NOT NULL,

  -- QUI a tenté cette saisie — jamais NULL : l'auteur d'une tentative
  -- terrain est toujours la session qui l'a envoyée.
  "auteur_id" uuid NOT NULL,

  -- QUAND LE SERVEUR L'A REÇUE — aucune des quatre saisies visées
  -- (prestations, signature, photo, machine) ne porte aujourd'hui d'heure
  -- D'APPAREIL propre (contrairement au compteur ou à « terminer ») :
  -- inventer une heure appareil serait la faute que le §8 du CLAUDE.md
  -- interdit. `cree_le` reste donc la seule heure de cette table.
  "cree_le" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "saisie_apres_cloture_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "saisie_apres_cloture_societe_id_id_key"
  ON "saisie_apres_cloture" ("societe_id", "id");
CREATE INDEX "saisie_apres_cloture_societe_id_intervention_id_cree_le_idx"
  ON "saisie_apres_cloture" ("societe_id", "intervention_id", "cree_le");

-- Les DEUX actions référentielles sont dites (§9, 24/08). `CASCADE` vers
-- l'intervention, comme `intervention_pause` : une ligne gardée n'a aucun
-- sens sans son intervention. `RESTRICT` vers l'auteur : un compte qui a
-- tenté une saisie ne s'efface pas en emportant la trace.
ALTER TABLE "saisie_apres_cloture"
  ADD CONSTRAINT "saisie_apres_cloture_societe_id_fkey"
    FOREIGN KEY ("societe_id") REFERENCES "societe"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "saisie_apres_cloture_societe_id_intervention_id_fkey"
    FOREIGN KEY ("societe_id", "intervention_id") REFERENCES "intervention"("societe_id", "id")
    ON DELETE CASCADE ON UPDATE RESTRICT,
  ADD CONSTRAINT "saisie_apres_cloture_auteur_id_societe_id_fkey"
    FOREIGN KEY ("auteur_id", "societe_id") REFERENCES "utilisateur_societe"("utilisateur_id", "societe_id")
    ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "saisie_apres_cloture" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "saisie_apres_cloture" FORCE ROW LEVEL SECURITY;

-- DEUX politiques seulement — jamais `FOR ALL` (même raisonnement que
-- `intervention_signature`) : ni `UPDATE` ni `DELETE` n'en ont, et sous
-- `FORCE ROW LEVEL SECURITY` un verbe sans politique est refusé pour tout le
-- monde. *Une preuve qui se modifie ou disparaît n'en est plus une.*
CREATE POLICY "cloisonnement_filiation_lecture" ON "saisie_apres_cloture"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "intervention" "i"
       WHERE "i"."id" = "saisie_apres_cloture"."intervention_id"
    )
  );

CREATE POLICY "cloisonnement_filiation_ajout" ON "saisie_apres_cloture"
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "intervention" "i"
       WHERE "i"."id" = "saisie_apres_cloture"."intervention_id"
    )
  );

REVOKE UPDATE, DELETE ON "saisie_apres_cloture" FROM "codiplan_app";
GRANT SELECT, INSERT ON "saisie_apres_cloture" TO "codiplan_app";

-- LE VERROU D'ÉCRITURE DU PORTAIL (I3, D237, 9K16) — recopié verbatim des
-- trois politiques posées par `20261110120000_portail_securite_base_9k16`,
-- et son fondement y est écrit en entier. `saisie_apres_cloture` n'existait
-- pas ce jour-là, d'où ces trois CREATE POLICY ici plutôt qu'une entrée de
-- plus dans le tableau de 9K16 — une migration déjà appliquée ne se modifie
-- jamais (CLAUDE.md §7). Aucun chemin du portail n'écrit cette table
-- aujourd'hui ; le verrou ferme ce que la forme « filiation » laisserait
-- ouvert si un tel chemin naissait sans qu'on y pense.
CREATE POLICY "verrou_ecriture_portail_insertion" ON "saisie_apres_cloture"
  AS RESTRICTIVE FOR INSERT
  WITH CHECK (NULLIF(current_setting('app.client_id', true), '') IS NULL);

CREATE POLICY "verrou_ecriture_portail_modification" ON "saisie_apres_cloture"
  AS RESTRICTIVE FOR UPDATE
  USING (NULLIF(current_setting('app.client_id', true), '') IS NULL)
  WITH CHECK (NULLIF(current_setting('app.client_id', true), '') IS NULL);

CREATE POLICY "verrou_ecriture_portail_suppression" ON "saisie_apres_cloture"
  AS RESTRICTIVE FOR DELETE
  USING (NULLIF(current_setting('app.client_id', true), '') IS NULL);

CREATE TRIGGER "journal_audit" AFTER INSERT OR UPDATE OR DELETE ON "saisie_apres_cloture"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

COMMENT ON TABLE "saisie_apres_cloture" IS
  'UNE SAISIE TERRAIN ARRIVÉE APRÈS LA CLÔTURE (9L14-FIGE-A-LA-CLOTURE, décision d''Alexis du 10/11/2026, précisant I5) : gardée à part, jamais appliquée d''office, signalée à l''ADV. Table métier de la première catégorie de I1, forme « filiation » (D103). INALTÉRABLE : ni UPDATE ni DELETE ne sont accordés au rôle applicatif, même régime qu''intervention_signature.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. LA NOTIFICATION DE L'ADV — une valeur neuve d'`EvenementNotification`
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TYPE "EvenementNotification" ADD VALUE 'saisie_apres_cloture';

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. FIGÉ À LA CLÔTURE, EN BASE — signature, prestations, machine, photos
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Une seule fonction, partagée par les quatre tables : elle lit le statut de
-- l'intervention parente (`NEW.intervention_id` à l'écriture, `OLD.
-- intervention_id` à la suppression) et refuse si elle est `cloturee` ou
-- `annulee`. `document` porte aussi des cibles SANS intervention (modele_id,
-- machine_id) : `intervention_id` y est alors NULL et la fonction laisse
-- passer, par construction (`COALESCE` ne trouve rien à juger).
--
-- **UNE SEULE EXEMPTION, NOMMÉE, JAMAIS IMPLICITE** : `fige_a_la_cloture.
-- exemption`, un réglage LOCAL À LA TRANSACTION (`SET LOCAL`, jamais
-- `SET`), posé PAR LE SEUL `lib/interventions/depot-reprise.ts` (import
-- d'archive, D127) avant ses deux `createMany`. Une intervention reprise
-- NAÎT `cloturee`, machine comprise — ce n'est pas une saisie arrivée APRÈS
-- la clôture, c'est un fait archivé déjà clos à sa naissance même, et
-- `SET LOCAL` retombe de lui-même à la fin de la transaction, jamais
-- besoin d'un `RESET`. Mesuré : aucun autre chemin applicatif ne pose ce
-- réglage — `cloturerIntervention` et `annulerIntervention`
-- (`lib/interventions/depot.ts`) ne le posent pas, et ne touchent de
-- toute façon que les colonnes de `intervention` elle-même.
CREATE OR REPLACE FUNCTION "intervention_fille_figee_a_la_cloture"()
RETURNS TRIGGER AS $$
DECLARE
  v_intervention_id uuid;
  v_statut "StatutIntervention";
BEGIN
  v_intervention_id := COALESCE(NEW."intervention_id", OLD."intervention_id");

  IF v_intervention_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- `fixture_isolation` est la SEULE autre valeur reconnue — posée par les
  -- scénarios d'isolation qui fabriquent une intervention JETABLE déjà
  -- close pour en lire le parc ou l'historique (jamais par le rôle
  -- applicatif, jamais par un chemin qu'un utilisateur atteint) : même
  -- raisonnement que `reprise_historique`, un fait qui naît clos n'est pas
  -- une saisie arrivée après coup.
  IF current_setting('fige_a_la_cloture.exemption', true)
       IN ('reprise_historique', 'fixture_isolation') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT "statut" INTO v_statut FROM "intervention" WHERE "id" = v_intervention_id;

  IF v_statut IN ('cloturee', 'annulee') THEN
    RAISE EXCEPTION
      'Intervention % : figée à la clôture, % refusé sur %. Décision d''Alexis du 10/11/2026, précisant I5 (9L14-FIGE-A-LA-CLOTURE).',
      v_intervention_id, TG_OP, TG_TABLE_NAME
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- `intervention_prestation` et `intervention_machine` portent les trois
-- verbes (SELECT, INSERT, UPDATE, DELETE accordés à `codiplan_app`).
CREATE TRIGGER "intervention_prestation_figee_a_la_cloture"
  BEFORE INSERT OR UPDATE OR DELETE ON "intervention_prestation"
  FOR EACH ROW EXECUTE FUNCTION "intervention_fille_figee_a_la_cloture"();

CREATE TRIGGER "intervention_machine_figee_a_la_cloture"
  BEFORE INSERT OR UPDATE OR DELETE ON "intervention_machine"
  FOR EACH ROW EXECUTE FUNCTION "intervention_fille_figee_a_la_cloture"();

-- `document` aussi, mais sa cible n'est pas toujours une intervention — la
-- fonction le laisse passer d'elle-même (voir son corps ci-dessus).
CREATE TRIGGER "document_figee_a_la_cloture"
  BEFORE INSERT OR UPDATE OR DELETE ON "document"
  FOR EACH ROW EXECUTE FUNCTION "intervention_fille_figee_a_la_cloture"();

-- `intervention_signature` n'a plus ni UPDATE ni DELETE accordés (depuis
-- `20260922100000_rapport_terrain_bon_2`) : seul INSERT reste à fermer ici.
CREATE TRIGGER "intervention_signature_figee_a_la_cloture"
  BEFORE INSERT ON "intervention_signature"
  FOR EACH ROW EXECUTE FUNCTION "intervention_fille_figee_a_la_cloture"();
