-- ═══════════════════════════════════════════════════════════════════════════
-- 9J19-SUITE-A-DONNER-NOTIFICATIONS — FLX-2, FLX-3, FLX-8
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Les relances devis/accord (FLX-2, FLX-3) sont des LECTURES calculées à la
-- visite d'un écran, même patron que `enRetard` (`lib/interventions/
-- retard.ts`) — JAMAIS une tâche planifiée, jamais un courriel envoyé seul.
-- La réception de pièce (FLX-8) reste un déclencheur applicatif, posé dans la
-- même transaction que le passage à `a_replanifier`. Aucune des trois ne
-- devient la table d'une file de jobs (§2 du CLAUDE.md) : rien ici ne part
-- sans qu'un écran soit ouvert.
--
-- ## Ce que cette migration établit
--
-- 1. Trois valeurs de plus à `EvenementNotification` (FLX-2/3/8).
-- 2. `societe.delai_relance_suite_jours` — NULLABLE, SANS DÉFAUT (CLAUDE.md
--    §8 : aucun délai ne s'invente). Nul tant que personne ne l'a réglé, et
--    dans cet état les deux lectures ne posent AUCUNE notification.
-- 3. `suite_a_donner` gagne `UNIQUE (societe_id, id)` — nécessaire à la clé
--    étrangère composite de `notification.suite_a_donner_id`, ci-dessous.
--    Même patron qu'`intervention`, `demande` et `notification` elle-même
--    (9J10A).
-- 4. `notification.suite_a_donner_id` — la CIBLE grandit à trois colonnes
--    disjointes (intervention, demande, suite à donner), toujours une seule
--    renseignée (`num_nonnulls`, même patron que `document_cible_unique`).
--
-- ═══════════════════════════════════════════════════════════════════════════
-- 1. TROIS ÉVÉNEMENTS DE PLUS
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Aucune ligne existante n'est touchée : un ajout de valeur, rien de plus.
-- Aucun DML de cette migration ne s'en sert — la contrainte PostgreSQL qui
-- interdit d'utiliser une valeur neuve dans la transaction qui l'ajoute ne
-- s'applique donc jamais ici.

ALTER TYPE "EvenementNotification" ADD VALUE 'devis_en_retard';
ALTER TYPE "EvenementNotification" ADD VALUE 'accord_attendu_en_retard';
ALTER TYPE "EvenementNotification" ADD VALUE 'piece_recue';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. LE RÉGLAGE DE SOCIÉTÉ
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "societe" ADD COLUMN "delai_relance_suite_jours" integer;

-- Un délai ne peut être négatif ni nul — un délai de zéro jour relancerait au
-- moment même de la qualification, ce qu'aucune demande n'a formulé. La
-- valeur elle-même reste un réglage humain, jamais devinée ici.
ALTER TABLE "societe"
  ADD CONSTRAINT "societe_delai_relance_suite_jours_positif" CHECK (
    "delai_relance_suite_jours" IS NULL OR "delai_relance_suite_jours" > 0
  );

COMMENT ON COLUMN "societe"."delai_relance_suite_jours" IS
  'LE DÉLAI DE RELANCE DES SUITES À DONNER, EN JOURS (FLX-2/FLX-3, 9J19-SUITE-A-DONNER-NOTIFICATIONS). NULLABLE, SANS DÉFAUT (CLAUDE.md §8) : NULL tant que personne ne l''a réglé, et dans cet état aucune notification de retard n''est posée.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. `suite_a_donner` — LA CIBLE DE LA CLÉ ÉTRANGÈRE COMPOSITE CI-DESSOUS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE UNIQUE INDEX "suite_a_donner_societe_id_id_key" ON "suite_a_donner" ("societe_id", "id");

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. `notification.suite_a_donner_id`
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "notification" ADD COLUMN "suite_a_donner_id" uuid;

CREATE INDEX "notification_societe_suite_a_donner_idx" ON "notification" ("societe_id", "suite_a_donner_id");

ALTER TABLE "notification" ADD CONSTRAINT "notification_societe_id_suite_a_donner_id_fkey"
  FOREIGN KEY ("societe_id", "suite_a_donner_id")
  REFERENCES "suite_a_donner" ("societe_id", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- La cible grandit à TROIS colonnes disjointes — `num_nonnulls` compte les
-- colonnes non nulles : exactement une, donc ni deux cibles ni aucune.
-- `DROP` puis `ADD` : PostgreSQL ne sait pas modifier un CHECK en place.
-- Aucune ligne existante ne peut enfreindre la nouvelle forme : toutes ont
-- `suite_a_donner_id` NULL, et la contrainte d'avant garantissait déjà
-- exactement une des deux premières colonnes non nulle.
ALTER TABLE "notification" DROP CONSTRAINT "notification_cible_unique";
ALTER TABLE "notification"
  ADD CONSTRAINT "notification_cible_unique"
  CHECK (num_nonnulls("intervention_id", "demande_id", "suite_a_donner_id") = 1);

COMMENT ON COLUMN "notification"."suite_a_donner_id" IS
  'La cible d''une notification FLX-2/FLX-3/FLX-8 (9J19-SUITE-A-DONNER-NOTIFICATIONS) — jamais en même temps qu''intervention_id ou demande_id (notification_cible_unique). ON DELETE RESTRICT, comme les deux autres cibles.';
