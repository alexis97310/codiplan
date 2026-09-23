-- ═══════════════════════════════════════════════════════════════════════════
-- UNE BASE QUI A DÉJÀ VÉCU — un rattachement machine réel, avant que
-- PARCOURS-1 resserre « intervention_machine »
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Jouée AVANT `20260923130000_parcours_1_creer_puis_planifier`. Cette
-- migration pose `intervention_machine_intervention_id_key`, une contrainte
-- UNIQUE **validée** (jamais `NOT VALID`) : sans une ligne réelle à ce moment
-- de l'histoire, le contrôle qui la précède — « aucune intervention ne porte
-- déjà deux machines » — se prouverait contre une table vide, et la migration
-- ne serait pas éprouvée contre le seul monde où elle s'applique vraiment.
--
-- La ligne rattache l'INTERVENTION et la MACHINE posées par l'amorce de
-- `20260913130000_annulation_import_l1_08j` (l'intervention `suspendue` qui a
-- cassé la production) et de `20260913200000_reference_interne_unique_d6` (la
-- machine du même client) : les deux vieillissent jusqu'ici, sous la même
-- société — aucune ligne neuve à leur sujet, seulement le rattachement.

INSERT INTO "intervention_machine" ("id", "societe_id", "intervention_id",
                                     "machine_id", "modifie_le")
VALUES ('01920000-0000-7000-8000-00000000a022',
        '01920000-0000-7000-8000-00000000a001',
        '01920000-0000-7000-8000-00000000a00a',
        '01920000-0000-7000-8000-00000000a012', now());
