-- ═══════════════════════════════════════════════════════════════════════════
-- UNE BASE QUI A DÉJÀ VÉCU — l'amorce du rejeu (panne du 11/09/2026)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Jouée AVANT `20260913130000_annulation_import_l1_08j`, c'est-à-dire au point
-- de l'histoire où la base de démonstration se trouvait quand les sept
-- dernières migrations lui sont arrivées. Les lignes posées ici restent en
-- place pour toutes les migrations suivantes : elles ne se recopient pas, elles
-- VIEILLISSENT.
--
-- ## CE QUE CES LIGNES DOIVENT ÊTRE
--
-- **Ce qu'une base RÉELLE portait à ce moment-là**, jamais ce qui ferait
-- échouer une migration. Une amorce choisie pour casser inventerait une panne ;
-- une amorce vide ne mesurerait rien. *La ligne qui compte est l'intervention
-- `suspendue` SANS motif* — le seed la créait ainsi depuis le 09/09, et c'est
-- exactement elle qui a bloqué la production.
--
-- Aucune donnée de client réel (I9) : une société fictive, comme le seed en
-- pose deux. Une seule suffit ici — le rejeu éprouve des MIGRATIONS, pas un
-- cloisonnement, et aucune assertion de ce scénario ne compare deux sociétés.

INSERT INTO "devise" ("code", "libelle", "decimales")
VALUES ('XPF', 'Franc Pacifique', 0)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "societe" ("id", "code", "raison_sociale", "pays", "territoire",
                       "fuseau_horaire", "devise_code",
                       "majoration_hors_ouverture_pct", "langue")
VALUES ('01920000-0000-7000-8000-00000000a001', 'AGEE', 'Société vieillie',
        'NC', 'NC', 'Pacific/Noumea', 'XPF', 50, 'fr');

INSERT INTO "calendrier" ("id", "societe_id", "code", "libelle")
VALUES ('01920000-0000-7000-8000-00000000a002',
        '01920000-0000-7000-8000-00000000a001', 'AGEE-CAL', 'Calendrier vieilli');

INSERT INTO "agence" ("id", "societe_id", "code", "libelle", "territoire",
                      "calendrier_id")
VALUES ('01920000-0000-7000-8000-00000000a003',
        '01920000-0000-7000-8000-00000000a001', 'AGEE-AG', 'Agence vieillie',
        'NC', '01920000-0000-7000-8000-00000000a002');

INSERT INTO "client" ("id", "societe_id", "raison_sociale")
VALUES ('01920000-0000-7000-8000-00000000a004',
        '01920000-0000-7000-8000-00000000a001', 'Client vieilli');

INSERT INTO "site" ("id", "societe_id", "client_id", "agence_id", "libelle")
VALUES ('01920000-0000-7000-8000-00000000a005',
        '01920000-0000-7000-8000-00000000a001',
        '01920000-0000-7000-8000-00000000a004',
        '01920000-0000-7000-8000-00000000a003', 'Site vieilli');

-- DEUX contacts du MÊME client : l'index unique de `20260913140000` porte sur
-- (societe_id, client_id, id) et ne peut donc rien refuser — *encore faut-il
-- que la table ne soit pas vide pour que le rejeu le montre.*
-- Le canal `email` exige un courriel, et la base le tient (L1-03). *Le verrou
-- fait son travail sur le premier chemin venu, y compris le nôtre.*
INSERT INTO "contact" ("id", "societe_id", "client_id", "nom", "email", "canaux", "roles")
VALUES ('01920000-0000-7000-8000-00000000a006',
        '01920000-0000-7000-8000-00000000a001',
        '01920000-0000-7000-8000-00000000a004', 'Contact vieilli',
        'contact-vieilli@example.invalid', '{email}', '{technique}'),
       ('01920000-0000-7000-8000-00000000a007',
        '01920000-0000-7000-8000-00000000a001',
        '01920000-0000-7000-8000-00000000a004', 'Second contact',
        'second-vieilli@example.invalid', '{email}', '{technique}');

INSERT INTO "utilisateur" ("id", "email", "nom", "modifie_le")
VALUES ('01920000-0000-7000-8000-00000000a008', 'vieilli@example.invalid',
        'Compte vieilli', now());

-- Un lot d'import DÉJÀ APPLIQUÉ : `20260913130000` pose deux contraintes qui
-- lient les dates au statut, et une ligne au statut `controle` ne les
-- éprouverait pas de la même façon.
INSERT INTO "import_lot" ("id", "societe_id", "type_import", "version_modele",
                          "utilisateur_id", "nom_fichier", "statut",
                          "applique_le")
VALUES ('01920000-0000-7000-8000-00000000a009',
        '01920000-0000-7000-8000-00000000a001', 'clients', 1,
        '01920000-0000-7000-8000-00000000a008', 'parc-vieilli.xlsx',
        'applique', now());

-- `technicien_calendrier` N'EST PAS AMORCÉE, ET C'EST UNE MESURE, pas un oubli.
-- Son déclencheur d'audit REFUSE toute écriture tant que la table n'a pas de
-- colonne « id » — et « id » n'arrive QUE dans 20260913170000_technicien_l3_01a :
--
--   ERROR: journal_audit : la table « technicien_calendrier » n'expose aucune
--   colonne « id ». Le journal désigne la ligne journalisée par sa clé
--   technique (I10) ; sans elle, l'historique d'une ligne ne peut pas se relire.
--
-- La table est donc PROUVÉE VIDE à ce point de l'histoire : aucun chemin, pas
-- même celui-ci, n'a jamais pu y écrire — son index unique ne peut rien
-- refuser. C'est l'unique entrée de TABLES_VIDES_AU_RESSERREMENT, et elle est
-- gardée dans les deux sens.

-- ── LA LIGNE QUI A CASSÉ LA PRODUCTION ──────────────────────────────────────
-- Une intervention SUSPENDUE, née avant que le motif existe. Les quatre
-- colonnes de `20260913160000` n'existent pas encore ici : cette ligne n'a donc
-- ni motif ni date de suspension, et rien ne peut lui en donner.
INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id",
                            "agence_id", "type", "priorite", "statut",
                            "modifie_le")
VALUES ('01920000-0000-7000-8000-00000000a00a',
        '01920000-0000-7000-8000-00000000a001',
        '01920000-0000-7000-8000-00000000a004',
        '01920000-0000-7000-8000-00000000a005',
        '01920000-0000-7000-8000-00000000a003',
        'curatif', 'p2', 'suspendue', now());
