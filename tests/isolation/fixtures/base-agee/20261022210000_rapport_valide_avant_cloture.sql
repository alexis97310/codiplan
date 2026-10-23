-- ═══════════════════════════════════════════════════════════════════════════
-- 9H1B — UNE BASE QUI A DÉJÀ DES INTERVENTIONS CLÔTURÉES, avant le rattrapage
-- de 20261022210000_rapport_valide_avant_cloture
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Jouée AVANT cette migration. Elle écrit `"rapport_valide_le" = "cloturee_le"
-- WHERE "statut" = 'cloturee' AND "cloturee_le" IS NOT NULL` — un `UPDATE` sur
-- des lignes `cloturee`, que le déclencheur `intervention_cycle_de_vie`
-- (posé par 20260909200000_intervention_l2_planning) refusait AVANT le
-- correctif de 9H1B : il bloque toute modification d'une ligne
-- `OLD.statut = 'cloturee'`, y compris celle que le rattrapage lui-même pose.
-- Sans une ligne CLÔTURÉE à ce point de l'histoire, le rattrapage se
-- prouverait contre une table qui ne porte aucune ligne dans l'état qu'il
-- cible — exactement le défaut que ce dossier répare.
--
-- Deux clôturées, délibérément : l'une AVEC `cloturee_le` (le cas courant, que
-- le rattrapage doit reprendre), l'une SANS (le rattrapage doit la laisser
-- intacte — son `WHERE` l'exclut, et `intervention_rapport_validation_tracee`
-- tolère `rapport_valide_par`/`rapport_valide_le` NULS des deux côtés). Une
-- ANNULÉE vérifie que le même déclencheur, qui bloque aussi `OLD.statut =
-- 'annulee'`, ne gêne pas un rattrapage qui ne la touche pas. Une ligne de
-- TYPE `reprise` vérifie que le correctif ne tient pas seulement pour le type
-- `curatif` de l'amorce précédente. Les autres statuts restants couvrent ce
-- que 9H1B doit laisser traverser sans y toucher.
--
-- MÊME société, agence, client et site que `intervention` depuis
-- `20260913130000_annulation_import_l1_08j.sql` — ils vieillissent ensemble
-- depuis cette amorce-là.

-- CLÔTURÉE AVEC "cloturee_le" — LE CAS QUE LE RATTRAPAGE DOIT REPRENDRE.
INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id",
                            "agence_id", "type", "statut", "cloturee_le",
                            "modifie_le")
VALUES ('01920000-0000-7000-8000-00000000a00b',
        '01920000-0000-7000-8000-00000000a001',
        '01920000-0000-7000-8000-00000000a004',
        '01920000-0000-7000-8000-00000000a005',
        '01920000-0000-7000-8000-00000000a003',
        'preventif_contrat', 'cloturee',
        TIMESTAMPTZ '2026-06-01 08:00:00+11', now());

-- CLÔTURÉE SANS "cloturee_le" — LE `WHERE` DU RATTRAPAGE DOIT L'EXCLURE.
INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id",
                            "agence_id", "type", "statut", "modifie_le")
VALUES ('01920000-0000-7000-8000-00000000a00c',
        '01920000-0000-7000-8000-00000000a001',
        '01920000-0000-7000-8000-00000000a004',
        '01920000-0000-7000-8000-00000000a005',
        '01920000-0000-7000-8000-00000000a003',
        'curatif', 'cloturee', now());

-- ANNULÉE — le même déclencheur bloque aussi `OLD.statut = 'annulee'`.
INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id",
                            "agence_id", "type", "statut", "annulee_le",
                            "motif_annulation", "modifie_le")
VALUES ('01920000-0000-7000-8000-00000000a00d',
        '01920000-0000-7000-8000-00000000a001',
        '01920000-0000-7000-8000-00000000a004',
        '01920000-0000-7000-8000-00000000a005',
        '01920000-0000-7000-8000-00000000a003',
        'garantie', 'annulee',
        TIMESTAMPTZ '2026-06-02 08:00:00+11', 'Client annulé.', now());

-- TYPE `reprise` — le correctif ne tient pas que pour `curatif`/`preventif_contrat`.
INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id",
                            "agence_id", "type", "statut", "modifie_le")
VALUES ('01920000-0000-7000-8000-00000000a00e',
        '01920000-0000-7000-8000-00000000a001',
        '01920000-0000-7000-8000-00000000a004',
        '01920000-0000-7000-8000-00000000a005',
        '01920000-0000-7000-8000-00000000a003',
        'reprise', 'terminee', now());

-- LES STATUTS RESTANTS — que 9H1B doit laisser traverser sans y toucher.
-- `duree_estimee_min` : `intervention_planifiee_a_sa_duree` (D104, NOT VALID
-- mais vérifiée à l'écriture) l'exige sur `planifiee`/`affectee`.
INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id",
                            "agence_id", "type", "statut", "duree_estimee_min",
                            "modifie_le")
VALUES ('01920000-0000-7000-8000-00000000a00f',
        '01920000-0000-7000-8000-00000000a001',
        '01920000-0000-7000-8000-00000000a004',
        '01920000-0000-7000-8000-00000000a005',
        '01920000-0000-7000-8000-00000000a003',
        'curatif', 'planifiee', 60, now());

INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id",
                            "agence_id", "type", "statut", "duree_estimee_min",
                            "modifie_le")
VALUES ('01920000-0000-7000-8000-00000000a010',
        '01920000-0000-7000-8000-00000000a001',
        '01920000-0000-7000-8000-00000000a004',
        '01920000-0000-7000-8000-00000000a005',
        '01920000-0000-7000-8000-00000000a003',
        'curatif', 'affectee', 60, now());

INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id",
                            "agence_id", "type", "statut", "modifie_le")
VALUES ('01920000-0000-7000-8000-00000000a011',
        '01920000-0000-7000-8000-00000000a001',
        '01920000-0000-7000-8000-00000000a004',
        '01920000-0000-7000-8000-00000000a005',
        '01920000-0000-7000-8000-00000000a003',
        'curatif', 'en_cours', now());

INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id",
                            "agence_id", "type", "statut", "motif_suspension",
                            "suspendue_le", "modifie_le")
VALUES ('01920000-0000-7000-8000-00000000a012',
        '01920000-0000-7000-8000-00000000a001',
        '01920000-0000-7000-8000-00000000a004',
        '01920000-0000-7000-8000-00000000a005',
        '01920000-0000-7000-8000-00000000a003',
        'curatif', 'suspendue', 'Pièce en commande.', now(), now());
