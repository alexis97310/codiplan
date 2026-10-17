-- ═══════════════════════════════════════════════════════════════════════════
-- 9F4H2-HORS-RESEAU-HEURE-ET-REJEU — le serveur accepte une saisie faite hors
-- réseau : l'heure du téléphone fait foi pour le compteur, signalée à l'ADV ;
-- les renvois ne doublent rien (décisions n° 107 et 108 d'Alexis du
-- 14/10/2026 ; voir docs/arbitrages.md D214).
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ## DEUX COLONNES, AUCUNE RELATION, AUCUNE POLITIQUE TOUCHÉE
--
-- `segment_travail.saisi_hors_reseau` — NOT NULL DEFAULT false : tout segment
-- déjà en base a été écrit EN LIGNE, à l'heure du serveur ; ce défaut leur est
-- donc VRAI pour chacun, pas une approximation commode.
--
-- `intervention.terminer_operation_id` — NULLABLE, SANS DÉFAUT, SANS CLÉ
-- ÉTRANGÈRE : même famille que `hors_ouverture_confirmee_par` (migration
-- 20261017070000) — une valeur fabriquée par l'APPAREIL, jamais une relation
-- vers une table qui n'existe pas pour elle (CLAUDE.md §6). Elle garde la
-- trace de QUELLE opération a terminé l'intervention, pour qu'un renvoi du
-- même `operation_id` soit reconnu comme LE MÊME geste et n'envoie pas un
-- second courriel au SAV.
--
-- Le cloisonnement (RLS) de `segment_travail` et `intervention` n'est pas
-- touché : deux colonnes de plus sur deux tables déjà en forme connue — même
-- geste que 20261017070000_pose_hors_ouverture_confirmee.

ALTER TABLE "segment_travail"
  ADD COLUMN "saisi_hors_reseau" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "intervention"
  ADD COLUMN "terminer_operation_id" UUID;

COMMENT ON COLUMN "segment_travail"."saisi_hors_reseau" IS
  'AJOUTÉE le 18/10/2026 (9F4H2-HORS-RESEAU-HEURE-ET-REJEU, décision n° 107 d''Alexis) : vrai quand le début ou la fin (ou les deux) ont été écrits avec l''heure du TÉLÉPHONE plutôt que celle du serveur. Visible par l''ADV avant la validation du temps.';

COMMENT ON COLUMN "intervention"."terminer_operation_id" IS
  'AJOUTÉE le 18/10/2026 (9F4H2-HORS-RESEAU-HEURE-ET-REJEU, décision n° 108 d''Alexis) : l''identifiant d''opération fabriqué par l''appareil qui a terminé l''intervention par ce chemin différé. NULL si jamais terminée ainsi. Permet à un renvoi du même operation_id de répondre accepté sans second courriel au SAV.';
