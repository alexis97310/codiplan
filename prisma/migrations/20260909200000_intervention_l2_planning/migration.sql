-- ═══════════════════════════════════════════════════════════════════════════
-- L'ORDRE D'INTERVENTION (lot 2, D84)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- La table que tout le lot 2 attendait. Ce qui la retenait n'était pas ses
-- colonnes : c'était sa FORME DE POLITIQUE, un arbitrage de cloisonnement.
-- D84 la tranche — forme « parc », le PLANCHER mesuré — et écrit sa condition
-- de réouverture. Voir `docs/arbitrages.md`.
--
-- Deux actions référentielles pour CHAQUE clé étrangère, et elles sont dites
-- (§9, 24/08) : `ON DELETE RESTRICT` — une intervention n'est jamais emportée
-- par la disparition de son client, de son site ou de sa machine, elle est ce
-- qui prouve ce qui a été fait ; `ON UPDATE RESTRICT` — aucune propagation
-- silencieuse, c'est la leçon de D49.

CREATE TYPE "TypeIntervention" AS ENUM (
  'preventif_contrat', 'preventif_hors_contrat', 'curatif', 'installation',
  'garantie', 'controle_reglementaire', 'expertise', 'reprise', 'recensement'
);

CREATE TYPE "PrioriteIntervention" AS ENUM ('p1', 'p2', 'p3', 'p4');

CREATE TYPE "StatutIntervention" AS ENUM (
  'a_planifier', 'planifiee', 'envoyee', 'en_cours', 'suspendue',
  'terminee', 'cloturee', 'annulee'
);

CREATE TYPE "ModeValorisation" AS ENUM (
  'forfait', 'temps_passe', 'forfait_plus_heures'
);

-- Le chaînage composite d'un forfait à sa société : sans lui, une intervention
-- de A pourrait porter le forfait de B. Même forme que D48 sur le territoire.
ALTER TABLE "forfait" ADD CONSTRAINT "forfait_societe_id_id_key"
  UNIQUE ("societe_id", "id");

CREATE TABLE "intervention" (
  "id"          UUID NOT NULL,
  "societe_id"  UUID NOT NULL,
  "numero"      INTEGER,

  "client_id"   UUID NOT NULL,
  "site_id"     UUID NOT NULL,
  "machine_id"  UUID,
  "agence_id"   UUID NOT NULL,

  "type"        "TypeIntervention" NOT NULL,
  "priorite"    "PrioriteIntervention" NOT NULL DEFAULT 'p3',
  "statut"      "StatutIntervention" NOT NULL DEFAULT 'a_planifier',

  "date_planifiee"    DATE,
  "creneau_debut"     TIMESTAMP(3),
  "creneau_fin"       TIMESTAMP(3),
  "duree_estimee_min" INTEGER,

  "technicien_id" UUID,

  "mode_valorisation"      "ModeValorisation" NOT NULL DEFAULT 'temps_passe',
  "forfait_deplacement_id" UUID,

  "temps_reel_min" INTEGER,
  "montant_ht"     BIGINT,
  "devise_code"    TEXT,

  "motif_annulation" TEXT,
  "cloturee_le"      TIMESTAMP(3),
  "annulee_le"       TIMESTAMP(3),

  "cree_le"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "modifie_le" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "intervention_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "intervention_societe_id_id_key" ON "intervention" ("societe_id", "id");
CREATE UNIQUE INDEX "intervention_societe_id_numero_key" ON "intervention" ("societe_id", "numero");
CREATE INDEX "intervention_societe_id_date_planifiee_idx" ON "intervention" ("societe_id", "date_planifiee");
CREATE INDEX "intervention_societe_id_technicien_id_date_planifiee_idx" ON "intervention" ("societe_id", "technicien_id", "date_planifiee");
CREATE INDEX "intervention_societe_id_client_id_idx" ON "intervention" ("societe_id", "client_id");
CREATE INDEX "intervention_societe_id_site_id_idx" ON "intervention" ("societe_id", "site_id");

ALTER TABLE "intervention" ADD CONSTRAINT "intervention_societe_id_fkey"
  FOREIGN KEY ("societe_id") REFERENCES "societe"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "intervention" ADD CONSTRAINT "intervention_societe_id_client_id_fkey"
  FOREIGN KEY ("societe_id", "client_id") REFERENCES "client"("societe_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "intervention" ADD CONSTRAINT "intervention_societe_id_site_id_fkey"
  FOREIGN KEY ("societe_id", "site_id") REFERENCES "site"("societe_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "intervention" ADD CONSTRAINT "intervention_societe_id_machine_id_fkey"
  FOREIGN KEY ("societe_id", "machine_id") REFERENCES "machine"("societe_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "intervention" ADD CONSTRAINT "intervention_societe_id_agence_id_fkey"
  FOREIGN KEY ("societe_id", "agence_id") REFERENCES "agence"("societe_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "intervention" ADD CONSTRAINT "intervention_societe_id_forfait_deplacement_id_fkey"
  FOREIGN KEY ("societe_id", "forfait_deplacement_id") REFERENCES "forfait"("societe_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "intervention" ADD CONSTRAINT "intervention_devise_code_fkey"
  FOREIGN KEY ("devise_code") REFERENCES "devise"("code") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ═══════════════════════════════════════════════════════════════════════════
-- LE CLOISONNEMENT — forme « parc » (I1, D10, D22, D84)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Société ET `app.client_id` ET `app.perimetre_sites`. La clause de société
-- SEULE est exclue par RG-DRO-01 et par la mesure du 07/09 : un compte portail
-- lirait alors les interventions des autres clients de sa propre société.
-- La colonne de périmètre est `site_id` — une intervention a lieu sur un site.
--
-- La branche `OR societe_id IS NULL` de L0-04 n'est pas reprise : sur une
-- colonne `NOT NULL` elle est inerte, et une table nouvelle s'écrit sans elle.
--
-- Le `WITH CHECK` est ÉCRIT même s'il répète le `USING` : une politique qui
-- n'énonce qu'un `USING` légifère en silence sur les écritures (L1-02c).

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

-- ═══════════════════════════════════════════════════════════════════════════
-- LES DEUX VERROUS DE CYCLE DE VIE, TENUS PAR LA BASE (D84)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Ils sont ici et pas seulement dans la couche applicative parce que le jumeau
-- qui compte est celui-là : *une action refusée à l'écran mais acceptée par la
-- base est un trou.* Un écran se contourne par une requête ; un déclencheur
-- ne se contourne pas.
--
-- 1. Une intervention CLÔTURÉE ou ANNULÉE ne se modifie plus. La seule
--    transition encore permise depuis `cloturee` est vers `annulee` — I5 donne
--    à `annulee` la préséance sur `cloturee`, et la lui retirer ici
--    contredirait un invariant.
-- 2. On ne clôture pas sans temps saisi. `temps_reel_min` est l'entrée de D83 ;
--    clôturer sans lui facturerait le plancher d'une heure sur un temps que
--    personne n'a mesuré.

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

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "intervention_cycle_de_vie" BEFORE UPDATE ON "intervention"
  FOR EACH ROW EXECUTE FUNCTION "intervention_cycle_de_vie"();

-- ═══════════════════════════════════════════════════════════════════════════
-- L'AUDIT (I8, D55) — « qui, quand, d'où vers où »
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Le périmètre est INVERSÉ : le gardien de `scripts/lib/perimetre-audit.ts`
-- réclame ce déclencheur le jour où la table apparaît au schéma. Et c'est ici
-- qu'il paie : le journal des DÉPLACEMENTS d'une intervention — de quel
-- créneau vers quel créneau, de quel technicien vers quel technicien — n'est
-- pas une table de plus, c'est `journal_audit` faisant son travail, avec les
-- valeurs avant et après.

CREATE TRIGGER "journal_audit" AFTER INSERT OR UPDATE OR DELETE ON "intervention"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

COMMENT ON TABLE "intervention" IS
  'Ordre d''intervention (lot 2, D84). Table métier de la première catégorie de I1, forme « parc » — société ET app.client_id ET app.perimetre_sites (D10, D22). La clause de société SEULE est exclue par RG-DRO-01 : un compte portail lirait les interventions des autres clients de sa propre société. La restriction des 7 jours de RG-DRO-02 n''est PAS exprimée ici : elle dépend de l''horloge, ce qui en ferait une dixième forme de politique, et elle reste applicative — voir D84 et sa condition de réouverture.';

COMMENT ON COLUMN "intervention"."agence_id" IS
  'DÉDUITE du site, jamais saisie : le site porte son agence de rattachement (D56), et c''est elle qui décide du calendrier de référence pour le SLA (I7). La saisir séparément ferait deux lectures d''un même critère, qui divergent en silence.';

COMMENT ON COLUMN "intervention"."temps_reel_min" IS
  'Le temps RÉELLEMENT passé, en minutes, saisi à la clôture. C''est l''ENTRÉE de RG-TAR-05 amendée par D83 : arrondi au quart d''heure supérieur, puis plancher d''une heure, appliqués UNE SEULE FOIS sur l''intervention entière. La valeur stockée ici n''est jamais arrondie — l''arrondi appartient à la valorisation, et écraser le temps réel rendrait le calcul invérifiable.';

COMMENT ON COLUMN "intervention"."montant_ht" IS
  'Total hors taxes, ENTIER dans l''unité la plus fine de sa devise (I2, I3) — jamais un numeric, les décimales appartenant à la DEVISE. Figé à la clôture : une facture qui change quand le tarif change est une facture fausse (RG-TAR-04).';
