-- ═══════════════════════════════════════════════════════════════════════════
-- UNE BASE QUI A DÉJÀ VÉCU — une suite à donner, avant que 9J19 resserre
-- l'unicité de « suite_a_donner » à (societe_id, id)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Jouée AVANT `20261107010000_suite_a_donner_notifications_9j19`. Cette
-- migration pose `CREATE UNIQUE INDEX suite_a_donner_societe_id_id_key` sur la
-- table `suite_a_donner`, née deux migrations plus tôt
-- (`20261106010000_suite_a_donner_9j17`) — sans une ligne réelle à ce point de
-- l'histoire, le resserrement se prouverait contre une table vide. `notification`
-- n'a PAS besoin de sa propre amorce ici : la sienne (`20261105020000_
-- notification_lecture_9j10a.sql`) a déjà posé une ligne qui vieillit encore,
-- et c'est elle qui prouve le CHECK et la clé étrangère que cette migration
-- ajoute sur `notification`.
--
-- Même société, agence, client, site et intervention que les amorces
-- précédentes (`20260913130000_annulation_import_l1_08j.sql`), qui
-- vieillissent depuis cette date : aucune raison d'en créer une seconde.
-- Statut par défaut `a_qualifier`, sans motif ni attente de pièce : la ligne
-- la plus simple qui satisfait déjà toutes les équivalences de 9J17.

INSERT INTO "suite_a_donner" ("id", "societe_id", "intervention_origine_id",
                              "statut", "modifie_le")
VALUES ('01920000-0000-7000-8000-00000000a025',
        '01920000-0000-7000-8000-00000000a001',
        '01920000-0000-7000-8000-00000000a00a',
        'a_qualifier', now());
