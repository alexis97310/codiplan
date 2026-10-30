-- ═══════════════════════════════════════════════════════════════════════════
-- 9I8A1-REPRISE-9I8A — la règle d'arrondi du temps facturé, par société
-- (décision d'Alexis du 29/10/2026), et la décomposition figée à la clôture
-- (décision A d'Alexis du 31/10/2026, point 0 de la reprise).
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ## CE QUE CETTE MIGRATION POSE
--
-- Trois entiers sur `societe` — `facturation_plancher_min`,
-- `facturation_palier_min`, `facturation_seuil_palier_min` — qui décrivent
-- n'importe quelle règle « plancher puis paliers » (voir `RegleArrondi`,
-- `lib/tarification/valorisation.ts`). Défauts `60 / 30 / 5` : la NOUVELLE
-- règle (première heure entière, puis palier de 30 min compté dès 5 min),
-- posée pour TOUTE société, y compris celles déjà en production — c'est la
-- décision confirmée « par société », et un défaut qui l'applique à tous est
-- le sens de défaillance voulu.
--
-- Une colonne sur `intervention` — `valorisation_figee` — qui mémorise, à la
-- clôture, la décomposition complète que la fiche affiche (temps réel, temps
-- facturé, plancher appliqué, la règle utilisée, taux, main-d'œuvre, forfait
-- de déplacement, majoration, total, motif d'un total inconnu). `NULL` tant
-- qu'une intervention n'est pas clôturée, et NULL pour toujours sur toute
-- intervention clôturée AVANT cette migration : rien n'est recalculé ni
-- reconstitué pour elles (aucune reprise de données), et
-- `lib/interventions/depot.ts#lireFicheIntervention` les relit avec la règle
-- HISTORIQUE constante (60/15/1), jamais avec le réglage de société.
--
-- Elle ne touche À AUCUNE politique RLS : les deux colonnes sont lues et
-- écrites par les mêmes requêtes, filtrées par société, qui lisent et
-- écrivent déjà `societe`/`intervention`.

ALTER TABLE "societe"
  ADD COLUMN "facturation_plancher_min" INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN "facturation_palier_min" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "facturation_seuil_palier_min" INTEGER NOT NULL DEFAULT 5;

ALTER TABLE "societe"
  ADD CONSTRAINT "societe_facturation_plancher_borne"
    CHECK ("facturation_plancher_min" BETWEEN 0 AND 240),
  ADD CONSTRAINT "societe_facturation_palier_borne"
    CHECK ("facturation_palier_min" BETWEEN 1 AND 120),
  ADD CONSTRAINT "societe_facturation_seuil_palier_borne"
    CHECK (
      "facturation_seuil_palier_min" BETWEEN 1 AND "facturation_palier_min"
    );

COMMENT ON COLUMN "societe"."facturation_plancher_min" IS
  'AJOUTÉE le 31/10/2026 (9I8A1-REPRISE-9I8A, décision d''Alexis du 29/10/2026) : minutes facturées dès qu''une minute est entamée (le plancher). 60 par défaut, pour toute société.';
COMMENT ON COLUMN "societe"."facturation_palier_min" IS
  'AJOUTÉE le 31/10/2026 (9I8A1-REPRISE-9I8A) : taille, en minutes, d''un palier facturé au-delà du plancher. 30 par défaut (nouvelle règle) ; 15 reproduit l''ancienne.';
COMMENT ON COLUMN "societe"."facturation_seuil_palier_min" IS
  'AJOUTÉE le 31/10/2026 (9I8A1-REPRISE-9I8A) : minutes, DANS un palier, qui le déclenchent. 5 par défaut (nouvelle règle) ; 1 reproduit l''ancienne (toute minute entamée).';

ALTER TABLE "intervention"
  ADD COLUMN "valorisation_figee" JSONB;

COMMENT ON COLUMN "intervention"."valorisation_figee" IS
  'AJOUTÉE le 31/10/2026 (9I8A1-REPRISE-9I8A, décision A d''Alexis du 31/10/2026) : la décomposition de la valorisation, telle que calculée à la clôture — NULL avant clôture, et NULL pour toujours sur une intervention clôturée avant cette migration (aucune reprise de données). lireFicheIntervention (lib/interventions/depot.ts) la lit au lieu de recalculer dès qu''elle est posée.';
