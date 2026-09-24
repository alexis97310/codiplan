-- ═══════════════════════════════════════════════════════════════════════════
-- 68-DEMANDES-2 — une intervention se crée DEPUIS une demande et garde le
-- lien (ref SAV-11).
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ## LE CONSTAT
--
-- Le chapitre 11 met `demande_id` sur `intervention` — colonne qui n'existait
-- pas avant cette migration. `demande` elle-même ne porte volontairement
-- AUCUN lien vers l'intervention qu'elle devient (voir son en-tête dans
-- `schema.prisma`) : une même demande peut donner PLUSIEURS interventions
-- (décision 4 — une intervention = une machine), et le lien ne peut donc
-- vivre que du côté qui porte zéro ou un parent, jamais l'inverse.
--
-- ## CE QUE CETTE MIGRATION POSE
--
-- Une colonne NULLABLE — une intervention peut naître sans être passée par
-- une demande, exactement comme aujourd'hui —, une clé étrangère composite
-- `(societe_id, demande_id)` vers `demande(societe_id, id)` (même forme que
-- `contact_id`, `forfait_deplacement_id` : `RESTRICT` en suppression et en
-- mise à jour), et un index de lecture.
--
-- **Aucune donnée existante n'est modifiée** : la colonne naît à `NULL`
-- partout, et une contrainte qui ne compare que des `NULL` n'a rien à
-- valider — posée directement, jamais `NOT VALID`.
--
-- ## LE CLOISONNEMENT NE BOUGE PAS
--
-- La politique `cloisonnement_parc` d'`intervention`
-- (`20260909200000_intervention_l2_planning`) ne nomme AUCUNE colonne autre
-- que `societe_id`, `client_id` et `site_id` : elle juge la LIGNE, pas une
-- colonne en particulier. Une colonne neuve sur une ligne déjà couverte est
-- donc déjà couverte — la ré-écrire ici serait une seconde déclaration du
-- même filtre, qui pourrait diverger en silence de la première (§9, 01/09).

ALTER TABLE "intervention" ADD COLUMN "demande_id" uuid;

COMMENT ON COLUMN "intervention"."demande_id" IS
  '68-DEMANDES-2 — la demande dont cette intervention est née, le cas échéant. NULLABLE : une intervention peut naître directement, sans demande. Une demande peut donner PLUSIEURS interventions (décision 4) ; le lien vit ici, jamais sur demande, qui n''en porte volontairement aucun.';

ALTER TABLE "intervention"
  ADD CONSTRAINT "intervention_societe_id_demande_id_fkey"
  FOREIGN KEY ("societe_id", "demande_id")
  REFERENCES "demande"("societe_id", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE INDEX "intervention_societe_id_demande_id_idx"
  ON "intervention" ("societe_id", "demande_id");
