-- ═══════════════════════════════════════════════════════════════════════════
-- LES MACHINES D'UNE INTERVENTION — une visite, plusieurs matériels (L2-08a)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- > *« Une visite peut couvrir plusieurs machines : plusieurs lignes machine,
-- > chacune avec sa checklist et son état de sortie, un seul déplacement, un
-- > seul rapport. C'est le format naturel des visites de recensement et des
-- > visites préventives de contrat. »* (chapitre 7/M3)
--
-- **La colonne `intervention.machine_id` DISPARAÎT.** Elle n'est pas conservée
-- « pour la machine principale » : deux écritures d'un même fait divergent en
-- silence (§9, 01/09), et personne n'aurait su laquelle des deux sources fait
-- foi le jour où elles se contrediraient.
--
-- **Les lignes existantes sont REPRISES avant la suppression**, pas perdues.

CREATE TABLE "intervention_machine" (
  "id"              uuid NOT NULL,
  "societe_id"      uuid NOT NULL,
  "intervention_id" uuid NOT NULL,
  "machine_id"      uuid NOT NULL,
  "cree_le"         timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "modifie_le"      timestamptz(3) NOT NULL,

  CONSTRAINT "intervention_machine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "intervention_machine_societe_id_id_key"
  ON "intervention_machine" ("societe_id", "id");
-- La même machine ne se rattache pas deux fois à la même visite : ce serait
-- deux checklists pour un seul matériel, et personne ne saurait laquelle fait
-- foi.
CREATE UNIQUE INDEX "intervention_machine_intervention_id_machine_id_key"
  ON "intervention_machine" ("intervention_id", "machine_id");
CREATE INDEX "intervention_machine_societe_id_machine_id_idx"
  ON "intervention_machine" ("societe_id", "machine_id");

-- Les DEUX actions référentielles sont dites et justifiées (§9, 24/08).
--
-- `ON DELETE CASCADE` sur l'intervention est le SEUL du dépôt, et il se
-- justifie par la nature de la ligne : *elle n'est qu'un rattachement.* Une
-- trace se garde — c'est pourquoi `demande` et `intervention` sont en
-- `RESTRICT` —, un rattachement sans les deux objets qu'il relie ne veut rien
-- dire. Vers la MACHINE, au contraire, `RESTRICT` : effacer une machine
-- effacerait la preuve qu'on est intervenu dessus.
ALTER TABLE "intervention_machine"
  ADD CONSTRAINT "intervention_machine_societe_id_fkey"
    FOREIGN KEY ("societe_id") REFERENCES "societe"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "intervention_machine_societe_id_intervention_id_fkey"
    FOREIGN KEY ("societe_id", "intervention_id") REFERENCES "intervention"("societe_id", "id") ON DELETE CASCADE ON UPDATE RESTRICT,
  ADD CONSTRAINT "intervention_machine_societe_id_machine_id_fkey"
    FOREIGN KEY ("societe_id", "machine_id") REFERENCES "machine"("societe_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ───────────────────────────────────────────────────────────────────────────
-- LA REPRISE DES LIGNES EXISTANTES, AVANT DE SUPPRIMER LA COLONNE
-- ───────────────────────────────────────────────────────────────────────────
--
-- La base de démonstration porte des interventions rattachées à une machine.
-- Supprimer la colonne sans les reprendre les perdrait **sans rien dire** —
-- et c'est exactement le sens de défaillance que ce dépôt refuse.
--
-- `gen_random_uuid()` plutôt qu'un UUID v7 : ces identifiants ne naissent sur
-- aucun appareil et ne portent aucune relation (I10 vise `id` et `qr_token`
-- des objets terrain). Ce qui compte ici est l'unicité, pas l'ordre.

INSERT INTO "intervention_machine" ("id", "societe_id", "intervention_id", "machine_id", "modifie_le")
SELECT gen_random_uuid(), "societe_id", "id", "machine_id", now()
  FROM "intervention"
 WHERE "machine_id" IS NOT NULL;

ALTER TABLE "intervention" DROP COLUMN "machine_id";

-- ───────────────────────────────────────────────────────────────────────────
-- LE CLOISONNEMENT — forme « filiation » (D103)
-- ───────────────────────────────────────────────────────────────────────────
--
-- *Une fille est visible si son parent l'est.* La sous-requête est soumise à la
-- politique d'`intervention`, de forme « parc » : les trois filtres — société,
-- `app.client_id`, `app.perimetre_sites` — se propagent sans qu'aucun soit
-- réécrit ici. **Les recopier serait une seconde lecture d'un même critère**,
-- et c'est celle qui vieillit sans rougir.
--
-- La forme « parc » aurait exigé de recopier `client_id` et `site_id`, un
-- rattachement que la clé étrangère tient déjà ; c'est le raisonnement de
-- `site_habilitation_requise` à L1-04, et il vaut mot pour mot.
--
-- `WITH CHECK` écrit, et il répète le `USING` : une politique qui n'énonce
-- qu'un `USING` légifère en silence sur les écritures (L1-02c). Ici la
-- répétition est la bonne réponse — on ne rattache une machine qu'à une
-- intervention qu'on voit.

ALTER TABLE "intervention_machine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "intervention_machine" FORCE ROW LEVEL SECURITY;

CREATE POLICY "cloisonnement_filiation" ON "intervention_machine"
  USING (
    EXISTS (
      SELECT 1 FROM "intervention" "i"
       WHERE "i"."id" = "intervention_machine"."intervention_id"
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "intervention" "i"
       WHERE "i"."id" = "intervention_machine"."intervention_id"
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON "intervention_machine" TO "codiplan_app";

CREATE TRIGGER "journal_audit" AFTER INSERT OR UPDATE OR DELETE ON "intervention_machine"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

-- ───────────────────────────────────────────────────────────────────────────
-- RG-INT-01 DEVIENT VÉRIFIABLE, ET LA BASE LA TIENT
-- ───────────────────────────────────────────────────────────────────────────
--
-- > *« Une intervention est rattachée à un client et à un site. Elle porte au
-- > moins une machine, SAUF pour les types `expertise`, `installation` et
-- > `recensement`. Si la machine n'existe pas, elle est créée avant de
-- > démarrer. »* (RG-INT-01, amendée par D16)
--
-- **Le moment est « avant de démarrer », et la règle le dit elle-même.** Une
-- intervention naît sans machine — le dépannage à l'aveugle est le cas
-- ordinaire : on sait qu'un compresseur est en panne, pas lequel. Exiger la
-- machine à la CRÉATION aurait rendu impossible d'enregistrer un appel.
--
-- **Trois statuts, pas un.** La règle nomme le démarrage ; la base garde des
-- ÉTATS, pas des trajets. Ne surveiller que `en_cours` laisserait passer une
-- intervention qui saute directement à `terminee` — et la règle serait vraie
-- du chemin ordinaire et fausse de tous les autres.
--
-- Le contrôle est ajouté à la fonction de cycle de vie EXISTANTE plutôt qu'à
-- un second déclencheur : deux déclencheurs `BEFORE UPDATE` sur la même table
-- s'exécutent dans l'ordre alphabétique de leur nom, et faire dépendre un
-- refus de cet ordre serait une décision prise par personne.
--
-- ## CE QUE CE CONTRÔLE NE COUVRE PAS, ÉCRIT PLUTÔT QUE TU
--
-- **Il ne voit que les TRANSITIONS.** Une ligne INSÉRÉE directement dans un
-- statut de travail lui échappe — et c'est inévitable ici : au moment d'un
-- `INSERT`, aucune ligne de `intervention_machine` ne peut exister, puisque
-- l'intervention elle-même n'existe pas encore. Un contrôle `BEFORE INSERT`
-- refuserait donc TOUTE création, y compris légitime.
--
-- La forme qui fermerait ce chemin est une `CONSTRAINT TRIGGER ... DEFERRABLE
-- INITIALLY DEFERRED`, évaluée au COMMIT — les lignes filles existent alors.
-- **Elle n'est pas posée ici, et le motif est mesuré :** `prisma/seed.ts` ne
-- crée AUCUNE machine (vérifié), et il crée des interventions `en_cours`,
-- `terminee` et `cloturee` de types non dispensés. La contrainte différée les
-- refuserait toutes, et y répondre demanderait de décider ce que la
-- démonstration doit montrer — *ce qui appartient à l'exploitation, comme le
-- seed l'écrit déjà pour la collision d'identifiants du 10/09.*
--
-- **Condition de réouverture, vérifiable :** le jour où la synchronisation du
-- lot 3 insérera des interventions déjà terminées depuis un appareil hors
-- ligne, ce chemin cessera d'être théorique. Le contrôle devra alors passer en
-- contrainte différée, et la démonstration recevoir ses machines.

CREATE OR REPLACE FUNCTION "intervention_cycle_de_vie"()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."statut" = 'annulee' THEN
    RAISE EXCEPTION
      'Intervention annulée : elle ne se modifie plus. Une annulation n''efface rien et ne se défait pas ; créer une nouvelle intervention.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF OLD."statut" = 'cloturee' AND NEW."statut" <> 'annulee' THEN
    RAISE EXCEPTION
      'Intervention clôturée : elle ne se modifie plus sans trace. Seule l''annulation reste possible (I5 donne à ANNULEE la préséance sur CLOTUREE).'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW."statut" = 'cloturee' AND NEW."temps_reel_min" IS NULL THEN
    RAISE EXCEPTION
      'Clôture refusée : le temps réel n''est pas saisi. C''est l''entrée de l''arrondi au quart d''heure et du plancher d''une heure (RG-TAR-05, D83).'
      USING ERRCODE = 'check_violation';
  END IF;

  -- RG-INT-01 (amendée par D16) : au moins une machine pour démarrer, sauf
  -- expertise, installation et recensement.
  IF NEW."statut" IN ('en_cours', 'terminee', 'cloturee')
     AND OLD."statut" NOT IN ('en_cours', 'terminee', 'cloturee')
     AND NEW."type" NOT IN ('expertise', 'installation', 'recensement')
     AND NOT EXISTS (
       SELECT 1 FROM "intervention_machine" "im"
        WHERE "im"."intervention_id" = NEW."id"
     )
  THEN
    RAISE EXCEPTION
      'Aucune machine n''est rattachée à cette intervention. Rattachez-la avant de démarrer, ou créez la fiche machine si elle n''existe pas (RG-INT-01). Seuls les types expertise, installation et recensement en sont dispensés.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE "intervention_machine" IS
  'Les machines traitées par une intervention (L2-08a, chapitre 7/M3). Table métier de la première catégorie de I1, forme « filiation » (D103) : une fille est visible si son parent l''est, et les trois filtres de la forme « parc » d''intervention s''y propagent sans être réécrits. Elle REMPLACE intervention.machine_id, elle ne s''y ajoute pas : « la machine principale, plus les autres » aurait fait deux écritures d''un même fait. Elle ne porte NI diagnostic, NI travaux, NI état de sortie, NI relevé de compteur, NI résultat de checklist : le chapitre 11 les nomme, ils sont saisis sur le TERRAIN, et ils viennent au lot 3 avec la synchronisation hors-ligne.';
