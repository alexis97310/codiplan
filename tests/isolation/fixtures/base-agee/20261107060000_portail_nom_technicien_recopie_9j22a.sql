-- ═══════════════════════════════════════════════════════════════════════════
-- UNE BASE QUI A DÉJÀ VÉCU — un segment réel, avant que 9J22A-REPRISE-9J22
-- resserre `segment_travail`
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Jouée AVANT `20261107060000_portail_nom_technicien_recopie_9j22a`. Cette
-- migration BACKFILLE `nom_technicien_affiche` depuis `utilisateur.nom` sur
-- toute ligne existante de `segment_travail`, puis pose la colonne NOT NULL —
-- sans une ligne réelle, ni le backfill ni la contrainte ne se prouvent contre
-- rien.
--
-- Même société, intervention et utilisateur que les amorces précédentes
-- (`20260913130000_annulation_import_l1_08j.sql` pour la société et
-- l'intervention, qui vieillissent depuis cette date — « Compte vieilli »
-- pour l'utilisateur) : aucune raison d'en créer de seconds. Le segment est
-- FERMÉ (`fin` posée) : rien dans cette histoire n'a besoin d'un second
-- compteur ouvert pour cette même personne, et l'index
-- `segment_travail_un_seul_ouvert_par_personne` ne porte que sur les segments
-- ouverts.
--
-- `segment_travail.auteur` pointe vers `utilisateur_societe`, JAMAIS vers
-- `utilisateur` seul (quatrième catégorie de I1, voir le docblock du champ
-- dans `prisma/schema.prisma`) — « Compte vieilli » n'avait encore aucun
-- rattachement : cette ligne-là naît ici, seulement pour rendre le segment
-- possible.

INSERT INTO "utilisateur_societe" ("id", "utilisateur_id", "societe_id", "role")
VALUES ('01920000-0000-7000-8000-00000000a027',
        '01920000-0000-7000-8000-00000000a008',
        '01920000-0000-7000-8000-00000000a001', 'technicien');

INSERT INTO "segment_travail" ("id", "societe_id", "intervention_id",
                               "utilisateur_id", "debut", "fin", "modifie_le")
VALUES ('01920000-0000-7000-8000-00000000a026',
        '01920000-0000-7000-8000-00000000a001',
        '01920000-0000-7000-8000-00000000a00a',
        '01920000-0000-7000-8000-00000000a008',
        now() - interval '90 minutes', now(), now());
