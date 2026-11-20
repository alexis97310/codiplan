-- ═══════════════════════════════════════════════════════════════════════════
-- 9L27-PLANCHER-JAMAIS-ZERO — le plancher de facturation n'est jamais zéro
-- (décision d'Alexis du 10/11/2026, « Non, jamais 0 »).
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `societe.facturation_plancher_min` (posée par
-- `20261031100000_regle_facturation_temps_9i8a1`) acceptait `0`, y compris
-- par un champ vide côté formulaire : une intervention de quelques minutes
-- aurait alors facturé zéro. Cette migration resserre la borne basse de la
-- contrainte existante, sans `NOT VALID` : la règle vaut pour TOUTE ligne,
-- ancienne ou nouvelle — aucune société n'en est exemptée.
--
-- Le défaut de la colonne (`60`) et les deux autres contraintes de la famille
-- ne changent pas. Aucune donnée de `societe` n'est réécrite ici : seule la
-- contrainte se resserre, et elle échoue si une ligne existante valait déjà 0
-- (aucune société de ce dépôt n'a jamais pu atteindre 0 par l'application —
-- le formulaire la génère depuis `REGLE_PAR_DEFAUT`, au pire un champ vide
-- coercé à 0 par la saisie, jamais écrit par un autre chemin).

ALTER TABLE "societe"
  DROP CONSTRAINT "societe_facturation_plancher_borne";

ALTER TABLE "societe"
  ADD CONSTRAINT "societe_facturation_plancher_borne"
    CHECK ("facturation_plancher_min" BETWEEN 1 AND 240);

COMMENT ON COLUMN "societe"."facturation_plancher_min" IS
  'AJOUTÉE le 31/10/2026 (9I8A1-REPRISE-9I8A), RESSERRÉE le 20/11/2026 (9L27-PLANCHER-JAMAIS-ZERO, décision d''Alexis du 10/11/2026) : minutes facturées dès qu''une minute est entamée (le plancher), jamais 0. 60 par défaut, pour toute société.';
