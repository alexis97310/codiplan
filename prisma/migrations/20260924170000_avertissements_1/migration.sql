-- ═══════════════════════════════════════════════════════════════════════════
-- AVERTISSEMENTS-1 — la planification prévient le donneur d'ordre et le
-- technicien ; badge « Nouveau » côté technicien.
-- Arbitrages d'Alexis du 23/09/2026 (planification, jamais création) et du
-- 24/09/2026 à 17h25 (un déplacement de créneau prévient aussi les deux).
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ## CE QUE CETTE MIGRATION POSE, ET RIEN D'AUTRE
--
-- Une seule colonne : `intervention.vue_technicien_le`. Le COURRIEL lui-même
-- (client et technicien) n'a besoin d'AUCUNE table ni colonne nouvelle — il se
-- compose à la volée depuis ce que `intervention`, `site`, `machine` et
-- `contact` portent déjà, et il ne se relit jamais.
--
-- NULLABLE, et c'est l'état de départ pour TOUTE intervention existante :
-- aucune n'a jamais été « vue » par ce badge, y compris celles déjà en
-- production (I9 — cette migration ne pose aucune donnée réelle).
--
-- Le cloisonnement (RLS) de `intervention` n'est pas touché : une colonne de
-- plus sur une table déjà en forme « parc », jamais une relation nouvelle.

ALTER TABLE "intervention"
  ADD COLUMN "vue_technicien_le" TIMESTAMPTZ(3);

COMMENT ON COLUMN "intervention"."vue_technicien_le" IS
  'AJOUTÉE le 24/09/2026 (AVERTISSEMENTS-1) : l''instant où le technicien AFFECTÉ a ouvert sa fiche terrain — porte le badge « Nouveau ». NULL tant que non vue, ou depuis la dernière (ré)affectation d''un technicien.';
