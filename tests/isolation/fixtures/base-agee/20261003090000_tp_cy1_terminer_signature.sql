-- ═══════════════════════════════════════════════════════════════════════════
-- UNE BASE QUI A DÉJÀ VÉCU — une signature réelle, avant que 9DE-TP-CY1
-- resserre `intervention_signature`
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Jouée AVANT `20261003090000_tp_cy1_terminer_signature`. Cette migration
-- BACKFILLE `issue = 'signee'` sur toute ligne existante, rend `image_base64`
-- facultative puis pose `intervention_signature_issue_coherente` — sans une
-- ligne réelle, ni le backfill ni la contrainte ne se prouvent contre rien.
--
-- La ligne cible l'intervention `suspendue` posée par l'amorce de
-- `20260913130000_annulation_import_l1_08j`, qui vieillit jusqu'ici. Elle
-- porte la forme exacte que le schéma D'AVANT exigeait — `image_base64`
-- NOT NULL, `issue`/`motif` n'existent pas encore.

-- Pas de point-virgule dans la valeur : `instructionsDe` (le rejeu) découpe
-- naïvement sur `;`, sans respecter les littéraux entre guillemets.
INSERT INTO "intervention_signature" ("id", "societe_id", "intervention_id",
                                      "image_base64", "signataire_nom", "cree_le")
VALUES ('01920000-0000-7000-8000-00000000a022',
        '01920000-0000-7000-8000-00000000a001',
        '01920000-0000-7000-8000-00000000a00a',
        'VIEILLIE-PNG-BASE64-AAAA',
        'Signataire vieilli', now());
