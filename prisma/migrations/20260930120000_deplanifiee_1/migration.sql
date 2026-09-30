-- ═══════════════════════════════════════════════════════════════════════════
-- DEPLANIFIEE-1 — « Déplanifiée — absence de X le JJ/MM » dans la file et sur
-- la fiche (constat 38 de l'audit d'ergonomie du 25/09/2026, décision
-- d'Alexis du 26/09/2026, série 1, point 3).
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ## CE QUE CETTE MIGRATION POSE, ET RIEN D'AUTRE
--
-- Cinq colonnes sur `intervention`, NULLABLES, SANS DÉFAUT, SANS CLÉ
-- ÉTRANGÈRE : ce que la pose d'une absence (RG-PLA-06) recopie avant
-- d'effacer `date_planifiee`/`creneau_debut`/`creneau_fin`, pour que la file
-- « À planifier » et la fiche puissent dire d'où une carte déplanifiée vient.
--
-- `deplanifiee_absent_id` DÉSIGNE UNE IDENTITÉ, comme `technicien_id` —
-- jamais `absence.id` : voir `docs/decisions/2026-09-30-deplanifiee-1.md`
-- pour les options écartées (clé vers `absence`, lecture du journal d'audit,
-- table à part). En bref : la levée d'un blocage (`leverLeBlocage`)
-- SUPPRIME la ligne `absence`, et une clé étrangère interdirait la levée
-- (`Restrict`) ou effacerait la trace au moment même où le constat 38 la
-- réclame (`SetNull`).
--
-- NULLABLE, et c'est l'état de départ pour TOUTE intervention existante :
-- aucune n'a jamais été déplanifiée par ce mécanisme, y compris celles déjà
-- en production (I9 — cette migration ne pose aucune donnée réelle).
--
-- Le cloisonnement (RLS) de `intervention` n'est pas touché : cinq colonnes
-- de plus sur une table déjà en forme « parc », jamais une relation nouvelle
-- — même geste que `20260924170000_avertissements_1`.
--
-- Aucune contrainte n'est assouplie : `intervention_planifiee_a_sa_duree`
-- reste intacte, la déplanification posant `a_planifier`, statut hors de son
-- champ.

ALTER TABLE "intervention"
  ADD COLUMN "deplanifiee_date" DATE,
  ADD COLUMN "deplanifiee_creneau_debut" TIMESTAMP(3),
  ADD COLUMN "deplanifiee_creneau_fin" TIMESTAMP(3),
  ADD COLUMN "deplanifiee_absent_id" UUID,
  ADD COLUMN "deplanifiee_le" TIMESTAMPTZ(3);

COMMENT ON COLUMN "intervention"."deplanifiee_date" IS
  'AJOUTÉE le 30/09/2026 (DEPLANIFIEE-1) : l''ancienne date_planifiee, recopiée par la pose d''une absence avant d''être effacée. NULL tant qu''aucune déplanification n''a eu lieu, ou depuis la dernière repose d''une date (deplacerIntervention).';

COMMENT ON COLUMN "intervention"."deplanifiee_creneau_debut" IS
  'AJOUTÉE le 30/09/2026 (DEPLANIFIEE-1) : l''ancien creneau_debut, recopié par la pose d''une absence — NULL si la ligne n''avait pas d''heure (file d''attente datée sans heure).';

COMMENT ON COLUMN "intervention"."deplanifiee_creneau_fin" IS
  'AJOUTÉE le 30/09/2026 (DEPLANIFIEE-1) : l''ancien creneau_fin, recopié par la pose d''une absence — même régime que deplanifiee_creneau_debut.';

COMMENT ON COLUMN "intervention"."deplanifiee_absent_id" IS
  'AJOUTÉE le 30/09/2026 (DEPLANIFIEE-1) : l''IDENTITÉ de la personne dont l''absence a déplanifié cette ligne (comme technicien_id, aucune table technicien n''existant encore — CLAUDE.md §6). JAMAIS une clé vers absence.id : la levée d''un blocage supprime la ligne absence, voir docs/decisions/2026-09-30-deplanifiee-1.md.';

COMMENT ON COLUMN "intervention"."deplanifiee_le" IS
  'AJOUTÉE le 30/09/2026 (DEPLANIFIEE-1) : l''instant (fuseau de l''agence) où la pose de l''absence a déplanifié cette ligne — écrit, non affiché à ce jour (point ouvert en passation : le JJ/MM montré à l''écran est celui de deplanifiee_date, jour de l''absence).';
