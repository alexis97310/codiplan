-- ═══════════════════════════════════════════════════════════════════════════
-- 9J10A-NOTIFICATION-LUE-PAR-PERSONNE — « lu par personne »
-- Décision d'Alexis, 05/11/2026 ~08:40.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ## Ce qui était mesuré sur `origin/main` f34b423fa
--
-- `notification` ne porte qu'UNE colonne `lue_le` pour toute la table. Sous
-- `marquerLue` (`lib/notifications/depot.ts`, avant ce ticket) :
--
--   M1. une notification COLLECTIVE (`destinataire_id` NULL, « tous ceux qui
--       ont la capacité ») lue par UNE personne devient lue pour TOUTES ;
--   M2. `marquerLue` ne filtre par AUCUN `destinataire_id` : un compte peut
--       marquer lue la notification PERSONNELLE d'un collègue, en connaissant
--       seulement son identifiant.
--
-- Question posée à Alexis : « voulu ? » → NON. « Lu par personne » : chacun
-- garde la sienne jusqu'à ce qu'il la lise lui-même.
--
-- ## Ce que cette migration établit
--
--   1. `notification` gagne `UNIQUE (societe_id, id)` — nécessaire à la clé
--      étrangère composite de sa première fille, ci-dessous. Même patron
--      qu'`intervention` et `demande`.
--   2. `notification_lecture` : UNE ligne par (notification, utilisateur) qui
--      l'a lue. Forme « filiation » (D103, la forme EXISTANTE la plus proche
--      — aucune 14e forme n'est créée) : une lecture est visible si la
--      notification qu'elle lit l'est. Sa politique d'ÉCRITURE ajoute « la
--      ligne est à MOI », ancrée sur `app.utilisateur_id` (toujours posée par
--      `avecContexteApplicatif`, L0-06) — c'est elle qui ferme M2.
--   3. `SELECT, INSERT` seulement pour `codiplan_app` : aucun `UPDATE` ni
--      `DELETE`, la clé unique sur le couple empêchant de toute façon une
--      seconde ligne — même régime qu'`intervention_statut_historique` (9J08A).
--   4. Le périmètre d'audit (I8, inversé depuis D55) : table métier de la
--      première catégorie de I1, déclencheur `journal_audit`.
--
-- ## Ce qu'elle NE fait PAS
--
-- `notification.lue_le` n'est PAS supprimée (I6, aucune suppression) : elle
-- reste en base, et cesse d'être lue ou écrite par l'application à partir de
-- ce ticket. La REMPLACER par une migration qui la retire serait un second
-- geste, jamais demandé ici.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. `notification` — la cible de la clé étrangère composite de sa fille
-- ═══════════════════════════════════════════════════════════════════════════

CREATE UNIQUE INDEX "notification_societe_id_id_key" ON "notification" ("societe_id", "id");

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. `notification_lecture`
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE "notification_lecture" (
  "id"              uuid NOT NULL,
  "societe_id"      uuid NOT NULL,
  "notification_id" uuid NOT NULL,
  "utilisateur_id"  uuid NOT NULL,
  "lue_le"          timestamptz(3) NOT NULL,

  CONSTRAINT "notification_lecture_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_lecture_societe_id_id_key"
  ON "notification_lecture" ("societe_id", "id");
-- La clé unique sur le COUPLE (ticket, point 2) : c'est elle qui rend
-- `lue_le` non réécrivable sans qu'aucun `UPDATE` ne soit nécessaire — un
-- second INSERT du même couple échoue, et le dépôt l'absorbe par
-- `skipDuplicates`.
CREATE UNIQUE INDEX "notification_lecture_notification_id_utilisateur_id_key"
  ON "notification_lecture" ("notification_id", "utilisateur_id");
CREATE INDEX "notification_lecture_societe_id_notification_id_idx"
  ON "notification_lecture" ("societe_id", "notification_id");

ALTER TABLE "notification_lecture"
  ADD CONSTRAINT "notification_lecture_societe_id_fkey"
    FOREIGN KEY ("societe_id") REFERENCES "societe"("id")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "notification_lecture_societe_id_notification_id_fkey"
    FOREIGN KEY ("societe_id", "notification_id") REFERENCES "notification"("societe_id", "id")
    ON DELETE CASCADE ON UPDATE RESTRICT,
  ADD CONSTRAINT "notification_lecture_utilisateur_id_fkey"
    FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateur"("id")
    ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "notification_lecture" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_lecture" FORCE ROW LEVEL SECURITY;

-- DEUX politiques, forme « filiation » (D103) : une fille est visible si son
-- parent l'est. AUCUNE clause de société — ce serait une seconde source du
-- même fait que la clé étrangère composite porte déjà, et c'est la
-- visibilité de `notification` (forme « interne », D229) qui se propage ici
-- sans qu'aucun filtre soit réécrit.
CREATE POLICY "cloisonnement_filiation_lecture" ON "notification_lecture"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "notification" "n"
       WHERE "n"."id" = "notification_lecture"."notification_id"
    )
  );

-- L'ÉCRITURE ajoute « la ligne est à MOI » à la filiation : sans cette
-- branche, un compte qui connaît l'identifiant d'une notification visible
-- pourrait poser la lecture d'un AUTRE utilisateur — exactement le défaut M2
-- mesuré sur l'ancienne colonne unique. `app.utilisateur_id` est posée par
-- TOUT chemin de session (`avecContexteApplicatif`, L0-06) : jamais vide sous
-- un contexte applicatif réel.
CREATE POLICY "cloisonnement_filiation_ajout" ON "notification_lecture"
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "notification" "n"
       WHERE "n"."id" = "notification_lecture"."notification_id"
    )
    AND "utilisateur_id" = NULLIF(current_setting('app.utilisateur_id', true), '')::uuid
  );

-- Aucun `UPDATE` ni `DELETE` : la date de première lecture ne se réécrit
-- jamais, et sous `FORCE ROW LEVEL SECURITY` l'absence de politique referme
-- ces deux verbes pour tout le monde — même régime qu'`intervention_statut_
-- historique` (9J08A) et que `journal_audit` (I8).
REVOKE UPDATE, DELETE, TRUNCATE ON "notification_lecture" FROM "codiplan_app";
GRANT SELECT, INSERT ON "notification_lecture" TO "codiplan_app";

CREATE TRIGGER "journal_audit" AFTER INSERT OR UPDATE OR DELETE ON "notification_lecture"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

COMMENT ON TABLE "notification_lecture" IS
  'LA LECTURE D''UNE NOTIFICATION, PAR PERSONNE (9J10A-NOTIFICATION-LUE-PAR-PERSONNE, décision d''Alexis du 05/11/2026) : chacun garde la sienne jusqu''à ce qu''il la lise, même sur une notification COLLECTIVE. Forme « filiation » (D103) : visible si la notification qu''elle lit l''est. Écriture restreinte en plus à « la ligne est à MOI » (app.utilisateur_id). SELECT, INSERT seulement pour codiplan_app ; la clé unique sur (notification_id, utilisateur_id) tient la date de première lecture sans aucun UPDATE.';

COMMENT ON COLUMN "notification_lecture"."utilisateur_id" IS
  'Aucune relation Prisma déclarée vers Utilisateur (même choix que notification.destinataire_id, D39) : une relation ferait naître son inverse sur utilisateur, que le gardien de D39 refuserait. La clé étrangère existe en base.';

COMMENT ON COLUMN "notification"."lue_le" IS
  'CONSERVÉE (I6, aucune suppression) mais n''est plus ni lue ni écrite par l''application depuis 9J10A-NOTIFICATION-LUE-PAR-PERSONNE (05/11/2026) : l''état de lecture par personne vit désormais dans notification_lecture.';
