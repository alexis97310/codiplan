-- ═══════════════════════════════════════════════════════════════════════════
-- UNE BASE QUI A DÉJÀ VÉCU — une notification, avant que 9J10A resserre
-- l'unicité de « notification » à (societe_id, id)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Jouée AVANT `20261105020000_notification_lecture_9j10a`. Cette migration
-- pose `CREATE UNIQUE INDEX notification_societe_id_id_key` sur la table
-- `notification`, née une migration plus tôt (`20261105010000_notification_
-- interne_9j09`) — sans une ligne réelle à ce point de l'histoire, le
-- resserrement se prouverait contre une table vide.
--
-- Même société, agence, client, site et intervention que les amorces
-- précédentes (`20260913130000_annulation_import_l1_08j.sql`), qui
-- vieillissent depuis cette date : aucune raison d'en créer une seconde.

INSERT INTO "notification" ("id", "societe_id", "intervention_id", "evenement",
                            "capacite_requise", "destinataire_id")
VALUES ('01920000-0000-7000-8000-00000000a024',
        '01920000-0000-7000-8000-00000000a001',
        '01920000-0000-7000-8000-00000000a00a',
        'signature_absente_ou_refusee', 'annuler_intervention',
        '01920000-0000-7000-8000-00000000a008');
