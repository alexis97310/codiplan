-- ═══════════════════════════════════════════════════════════════════════════
-- UNE BASE QUI A DÉJÀ VÉCU — une réponse de checklist, avant que 9K28
-- REPOSE l'exclusivité de « checklist_reponse » sur SIX colonnes
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Jouée AVANT `20261111090000_checklist_reponse_photo_9k28`. Cette migration
-- DROP puis ADD la contrainte `checklist_reponse_valeur_unique` — sans une
-- ligne réelle à ce point de l'histoire, le resserrement se prouverait contre
-- une table vide, exactement ce que `checklist_reponse` a déjà subi pour
-- `20261110140000_checklist_cinq_types_reponse_9k18` (cette fois-là
-- légitimement « vide », voir `TABLES_VIDES_AU_RESSERREMENT`) — mais
-- `enregistrerReponses` a depuis gagné des appelants réels (9K21, 9K22) :
-- la table n'est PLUS prouvable vide à CE point-ci de l'histoire, elle a
-- besoin de sa propre ligne.
--
-- `checklist_point` N'A JAMAIS ÉTÉ AMORCÉE (toujours « vide » jusqu'ici,
-- `TABLES_VIDES_AU_RESSERREMENT`) : cette amorce pose donc la CHAÎNE ENTIÈRE
-- — modèle, version, point — avant la réponse elle-même, plutôt que de
-- supposer une ligne qu'aucune amorce précédente n'a jamais posée.
--
-- Même société/agence/client/site/intervention/compte que les amorces
-- précédentes (`20260913130000_annulation_import_l1_08j.sql`), qui
-- vieillissent depuis cette date : aucune raison d'en créer une seconde.
-- Type de réponse `conforme_non_conforme_sans_objet`, valeur `conforme` : la
-- ligne la plus simple qui porte déjà UNE des six colonnes de valeur — c'est
-- elle que la contrainte reposée doit continuer à accepter.

INSERT INTO "checklist_modele" ("id", "societe_id", "code", "libelle", "modifie_le")
VALUES ('01920000-0000-7000-8000-00000000a026',
        '01920000-0000-7000-8000-00000000a001', 'AGEE-CK', 'Checklist vieillie', now());

INSERT INTO "checklist_version" ("id", "societe_id", "checklist_modele_id", "numero")
VALUES ('01920000-0000-7000-8000-00000000a027',
        '01920000-0000-7000-8000-00000000a001',
        '01920000-0000-7000-8000-00000000a026', 1);

INSERT INTO "checklist_point" ("id", "societe_id", "checklist_version_id",
                                "section", "ordre", "libelle", "obligatoire",
                                "type_reponse")
VALUES ('01920000-0000-7000-8000-00000000a028',
        '01920000-0000-7000-8000-00000000a001',
        '01920000-0000-7000-8000-00000000a027',
        'Section vieillie', 1, 'Point vieilli', false,
        'conforme_non_conforme_sans_objet');

INSERT INTO "checklist_reponse" ("id", "societe_id", "intervention_id",
                                  "checklist_point_id", "libelle", "section",
                                  "obligatoire", "valeur_conforme", "auteur_id")
VALUES ('01920000-0000-7000-8000-00000000a029',
        '01920000-0000-7000-8000-00000000a001',
        '01920000-0000-7000-8000-00000000a00a',
        '01920000-0000-7000-8000-00000000a028',
        'Point vieilli', 'Section vieillie', false, 'conforme',
        '01920000-0000-7000-8000-00000000a008');
