-- ═══════════════════════════════════════════════════════════════════════════
-- UNE BASE QUI A DÉJÀ VÉCU — un document réel, avant que BON-2 resserre
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Jouée AVANT `20260922100000_rapport_terrain_bon_2`. Cette migration RESSERRE
-- DEUX tables préexistantes :
--
--   — `document` : elle retire `document_cible_unique` et la repose avec une
--     troisième colonne, et elle DROP puis CREATE la politique
--     `cloisonnement_heritage` ;
--   — `prestation` : elle pose `prestation_societe_id_id_key`, cible du
--     chaînage composite qu'`intervention_prestation` pose ensuite.
--
-- Sans une ligne réelle de chacune à ce moment de l'histoire, les deux
-- resserrements se prouveraient contre rien.
--
-- Les deux lignes ciblent la MACHINE et la SOCIÉTÉ posées par l'amorce de
-- `20260913200000_reference_interne_unique_d6`, qui vieillissent jusqu'ici.
-- `document.intervention_id` n'existe pas encore à ce point de l'histoire :
-- la ligne de document ne porte que ce que le schéma d'AVANT permettait,
-- exactement la forme que `document_cible_unique` exigeait avant BON-2.

INSERT INTO "document" ("id", "societe_id", "machine_id", "classe", "libelle",
                        "nom_fichier", "type_mime", "taille_octets",
                        "empreinte", "objet_cle", "modifie_le")
VALUES ('01920000-0000-7000-8000-00000000a020',
        '01920000-0000-7000-8000-00000000a001',
        '01920000-0000-7000-8000-00000000a012',
        'interne', 'Certificat vieilli', 'certificat-agee.pdf',
        'application/pdf', 1024,
        '0000000000000000000000000000000000000000000000000000000000000000'::text,
        'objets/agee/certificat-agee.pdf', now());

INSERT INTO "prestation" ("id", "societe_id", "code", "libelle", "modifie_le")
VALUES ('01920000-0000-7000-8000-00000000a021',
        '01920000-0000-7000-8000-00000000a001',
        'AGEE-PREST', 'Prestation vieillie', now());
