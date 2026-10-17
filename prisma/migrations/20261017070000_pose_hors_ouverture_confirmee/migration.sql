-- ═══════════════════════════════════════════════════════════════════════════
-- 9F3-POSE-HORS-OUVERTURE-CONFIRMEE — poser hors des horaires d'ouverture ou
-- un jour fermé devient POSSIBLE APRÈS CONFIRMATION (décision d'Alexis n°93
-- du 13/10/2026 ; amende RG-PLA-07 et D99, voir docs/arbitrages.md D211).
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ## CE QUE CETTE MIGRATION POSE, ET RIEN D'AUTRE
--
-- Deux colonnes sur `intervention`, NULLABLES, SANS DÉFAUT, SANS CLÉ
-- ÉTRANGÈRE : ce que `deplacerIntervention` (`lib/interventions/depot.ts`)
-- écrit quand une pose hors ouverture ou un jour fermé a été EXPLICITEMENT
-- confirmée (`confirmer_hors_ouverture` de la saisie). Même famille que
-- `deplanifiee_absent_id`/`temps_valide_par` sur cette même table : une
-- IDENTITÉ, jamais une clé vers `utilisateur.id` — la table `technicien` du
-- chapitre 11 n'existe pas encore (CLAUDE.md §6).
--
-- NULLABLES, et c'est l'état de départ pour TOUTE intervention existante :
-- aucune n'a jamais été posée par ce mécanisme, y compris celles déjà en
-- production (I9 — cette migration ne pose aucune donnée réelle).
--
-- Le cloisonnement (RLS) de `intervention` n'est pas touché : deux colonnes
-- de plus sur une table déjà en forme « parc », jamais une relation nouvelle
-- — même geste que `20260930120000_deplanifiee_1`.
--
-- Aucune contrainte n'est assouplie : les contrôles d'habilitation,
-- d'absence et de chevauchement restent des refus pleins, confirmés ou pas —
-- seul `verdictOuverture` lit ces deux colonnes, en écriture seulement.

ALTER TABLE "intervention"
  ADD COLUMN "hors_ouverture_confirmee_par" UUID,
  ADD COLUMN "hors_ouverture_confirmee_le" TIMESTAMPTZ(3);

COMMENT ON COLUMN "intervention"."hors_ouverture_confirmee_par" IS
  'AJOUTÉE le 17/10/2026 (9F3-POSE-HORS-OUVERTURE-CONFIRMEE, D93 d''Alexis) : l''IDENTITÉ de la personne qui a confirmé une pose hors ouverture ou un jour fermé (comme technicien_id, aucune table technicien n''existant encore — CLAUDE.md §6). NULL tant qu''aucune pose confirmée ne tient la ligne, ou depuis qu''un déplacement ultérieur l''a reposée dans l''ouverture.';

COMMENT ON COLUMN "intervention"."hors_ouverture_confirmee_le" IS
  'AJOUTÉE le 17/10/2026 (9F3-POSE-HORS-OUVERTURE-CONFIRMEE, D93 d''Alexis) : l''instant (fuseau de l''agence) où la pose hors ouverture ou le jour fermé a été confirmé. EFFACÉE dès qu''un déplacement ultérieur retombe dans l''ouverture — même régime que deplanifiee_le.';
