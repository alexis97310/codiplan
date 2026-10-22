-- ═══════════════════════════════════════════════════════════════════════════
-- UNE BASE QUI A DÉJÀ VÉCU — une demande SANS numéro, avant que 9H2 resserre
-- l'unicité de « demande » à (societe_id, annee, numero)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Jouée AVANT `20261023073000_numerotation_interventions_demandes_9h2`. Cette
-- migration BACKFILLE `numero`/`annee` sur toute ligne où `numero IS NULL`,
-- avant de poser l'unicité resserrée (societe_id, annee, numero) — sans une
-- ligne réelle à ce point de l'histoire, le rattrapage se prouverait contre
-- une table vide, et le resserrement ne serait pas éprouvé contre le seul
-- monde où il s'applique vraiment.
--
-- `intervention`, elle, porte déjà une ligne depuis l'amorce du rejeu
-- (`20260913130000_annulation_import_l1_08j.sql`, l'intervention `suspendue`
-- qui a cassé la production) : elle vieillit jusqu'ici sans qu'aucun fichier
-- n'ait besoin de l'y réinsérer. `demande` n'a jamais reçu de ligne dans
-- toute l'histoire rejouée — celle-ci l'amorce, sous la MÊME société,
-- agence, client et site que `intervention`, qui vieillissent depuis
-- `20260913130000`.

INSERT INTO "demande" ("id", "societe_id", "source", "client_id", "site_id",
                        "agence_id", "description", "depose_le",
                        "compteur_accuse_le", "modifie_le")
VALUES ('01920000-0000-7000-8000-00000000a023',
        '01920000-0000-7000-8000-00000000a001', 'appel',
        '01920000-0000-7000-8000-00000000a004',
        '01920000-0000-7000-8000-00000000a005',
        '01920000-0000-7000-8000-00000000a003',
        'Demande vieillie, sans numéro', now(), now(), now());
