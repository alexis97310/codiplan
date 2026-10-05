-- ═══════════════════════════════════════════════════════════════════════════
-- 9DL-PG-G16-STATUT-RESSOURCE — SALARIÉ OU PATENTÉ, UN CHAMP DE LA FICHE
-- TECHNICIEN (QG-9, 27/09/2026 ; précisions du pilote du 03/10/2026, à
-- valider par Alexis — D163, docs/arbitrages.md).
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Une colonne, NULLABLE, SANS DÉFAUT : aucun technicien existant n'a jamais
-- répondu à cette question, et aucune valeur ne s'invente (CLAUDE.md §8).
-- Aucune reprise de données, aucun backfill — ils resteront « non renseigné »
-- jusqu'à ce qu'une fiche les pose explicitement.
--
-- Simple ADD COLUMN : aucune lecture des lignes existantes, donc aucun besoin
-- de lever `FORCE ROW LEVEL SECURITY` (contrairement à une migration qui
-- vérifierait ou recopierait des données déjà en place).

CREATE TYPE "StatutRessource" AS ENUM ('salarie', 'patente');

ALTER TABLE "technicien"
  ADD COLUMN "statut_ressource" "StatutRessource";

COMMENT ON COLUMN "technicien"."statut_ressource" IS
  'SALARIÉ OU PATENTÉ (QG-9, D163) — un champ de la fiche, un badge et un filtre. NULL tant que la question n''a pas été posée pour cette personne ; jamais réécrit vers NULL une fois posé (lib/techniciens/depot.ts, modifierTechnicien).';
