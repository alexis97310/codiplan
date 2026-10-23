-- ═══════════════════════════════════════════════════════════════════════════
-- 9H1C-MIGRATIONS-SOUS-RLS — UNE BASE REMPLIE, SOUS LE VRAI RÔLE DE MIGRATION
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Jouée APRÈS toutes les migrations antérieures à
-- `20261022210000_rapport_valide_avant_cloture` (9H1), et AVANT elle et sa
-- suivante `20261023073000_numerotation_interventions_demandes_9h2` (9H2).
--
-- Jouée par `tests/isolation/9h1c-rattrapages-sous-role-reel.test.ts`, SOUS LE
-- PROPRIÉTAIRE DE LA BASE — ni superutilisateur ni `BYPASSRLS`, exactement la
-- forme qu'un hébergeur donne au rôle de migration. Le harnais LÈVE `FORCE ROW
-- LEVEL SECURITY` sur toutes les tables cloisonnées pour la durée de cette
-- amorce SEULEMENT, et la rend avant de jouer 9H1 et 9H2 : ce fichier peuple,
-- il ne prouve rien lui-même.
--
-- ## CE QUE CHAQUE LIGNE PROUVE
--
--   — DEUX SOCIÉTÉS (B-A en XPF, B-B en EUR) : le rattrapage de 9H2 numérote
--     chaque société indépendamment, et le compteur ne doit jamais mélanger
--     les deux ;
--   — une intervention CLÔTURÉE AVEC `cloturee_le` — le cas que 9H1 reprend ;
--   — une CLÔTURÉE SANS `cloturee_le` — que le `WHERE` de 9H1 doit exclure ;
--   — une ANNULÉE — `intervention_cycle_de_vie` bloque aussi
--     `OLD.statut = 'annulee'`, et ni 9H1 ni 9H2 ne doivent s'y heurter ;
--   — une ligne de type `reprise` — le correctif ne tient pas que pour les
--     types déjà couverts par les amorces de 9H1B ;
--   — une intervention SUR UN JOUR D'ABSENCE DE SON TECHNICIEN : le
--     déclencheur `pas_sur_blocage_agenda` (AFTER INSERT OR UPDATE, sans
--     liste de colonnes) se déclencherait sur l'`UPDATE` sans numéro de 9H2
--     s'il n'était pas suspendu à ses côtés — c'est le risque nommé par la
--     revue du pilote. **L'absence est posée APRÈS cette intervention**,
--     délibérément : la ligne existait avant que le blocage soit déclaré,
--     exactement le cas réel que ce lot répare, jamais une création qui
--     violerait elle-même le blocage ;
--   — des DEMANDES dans les QUATRE statuts de `StatutDemande`.
--
-- Aucune donnée de production, aucun client réel (I9) : deux sociétés
-- fictives, comme le seed en pose deux.

INSERT INTO "devise" ("code", "libelle", "decimales")
VALUES ('XPF', 'Franc Pacifique', 0) ON CONFLICT ("code") DO NOTHING;
INSERT INTO "devise" ("code", "libelle", "decimales")
VALUES ('EUR', 'Euro', 2) ON CONFLICT ("code") DO NOTHING;

-- ── SOCIÉTÉ A ────────────────────────────────────────────────────────────
INSERT INTO "societe" ("id", "code", "raison_sociale", "pays", "territoire",
                       "fuseau_horaire", "devise_code",
                       "majoration_hors_ouverture_pct", "langue")
VALUES ('01920000-0000-7000-8000-00000000b001', 'B-A', 'Société remplie A',
        'NC', 'NC', 'Pacific/Noumea', 'XPF', 50, 'fr');
INSERT INTO "calendrier" ("id", "societe_id", "code", "libelle")
VALUES ('01920000-0000-7000-8000-00000000b002',
        '01920000-0000-7000-8000-00000000b001', 'B-A-CAL', 'Calendrier A');
INSERT INTO "agence" ("id", "societe_id", "code", "libelle", "territoire", "calendrier_id")
VALUES ('01920000-0000-7000-8000-00000000b003',
        '01920000-0000-7000-8000-00000000b001', 'B-A-AG', 'Agence A', 'NC',
        '01920000-0000-7000-8000-00000000b002');
INSERT INTO "client" ("id", "societe_id", "raison_sociale")
VALUES ('01920000-0000-7000-8000-00000000b004',
        '01920000-0000-7000-8000-00000000b001', 'Client A');
INSERT INTO "site" ("id", "societe_id", "client_id", "agence_id", "libelle")
VALUES ('01920000-0000-7000-8000-00000000b005',
        '01920000-0000-7000-8000-00000000b001',
        '01920000-0000-7000-8000-00000000b004',
        '01920000-0000-7000-8000-00000000b003', 'Site A');

-- ── SOCIÉTÉ B — preuve que le rattrapage traverse les DEUX sociétés ───────
INSERT INTO "societe" ("id", "code", "raison_sociale", "pays", "territoire",
                       "fuseau_horaire", "devise_code",
                       "majoration_hors_ouverture_pct", "langue")
VALUES ('01920000-0000-7000-8000-00000000b101', 'B-B', 'Société remplie B',
        'FR', 'FR', 'Europe/Paris', 'EUR', 50, 'fr');
INSERT INTO "calendrier" ("id", "societe_id", "code", "libelle")
VALUES ('01920000-0000-7000-8000-00000000b102',
        '01920000-0000-7000-8000-00000000b101', 'B-B-CAL', 'Calendrier B');
INSERT INTO "agence" ("id", "societe_id", "code", "libelle", "territoire", "calendrier_id")
VALUES ('01920000-0000-7000-8000-00000000b103',
        '01920000-0000-7000-8000-00000000b101', 'B-B-AG', 'Agence B', 'FR',
        '01920000-0000-7000-8000-00000000b102');
INSERT INTO "client" ("id", "societe_id", "raison_sociale")
VALUES ('01920000-0000-7000-8000-00000000b104',
        '01920000-0000-7000-8000-00000000b101', 'Client B');
INSERT INTO "site" ("id", "societe_id", "client_id", "agence_id", "libelle")
VALUES ('01920000-0000-7000-8000-00000000b105',
        '01920000-0000-7000-8000-00000000b101',
        '01920000-0000-7000-8000-00000000b104',
        '01920000-0000-7000-8000-00000000b103', 'Site B');

-- ── UN TECHNICIEN (SOCIÉTÉ A) ───────────────────────────────────────────────
INSERT INTO "utilisateur" ("id", "nom", "email", "modifie_le")
VALUES ('01920000-0000-7000-8000-00000000b006', 'Technicien B-A',
        'technicien-b-a@9h1c.test', now());
INSERT INTO "utilisateur_societe" ("id", "utilisateur_id", "societe_id", "role")
VALUES ('01920000-0000-7000-8000-00000000b007',
        '01920000-0000-7000-8000-00000000b006',
        '01920000-0000-7000-8000-00000000b001', 'technicien');

-- ── INTERVENTIONS — SOCIÉTÉ A ───────────────────────────────────────────────

-- CLÔTURÉE AVEC "cloturee_le" — le cas que le rattrapage de 9H1 reprend.
INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id", "agence_id",
                            "type", "statut", "cloturee_le", "modifie_le")
VALUES ('01920000-0000-7000-8000-00000000b00b',
        '01920000-0000-7000-8000-00000000b001',
        '01920000-0000-7000-8000-00000000b004',
        '01920000-0000-7000-8000-00000000b005',
        '01920000-0000-7000-8000-00000000b003',
        'preventif_contrat', 'cloturee', TIMESTAMPTZ '2026-06-01 08:00:00+11', now());

-- CLÔTURÉE SANS "cloturee_le" — le `WHERE` du rattrapage de 9H1 doit l'exclure.
INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id", "agence_id",
                            "type", "statut", "modifie_le")
VALUES ('01920000-0000-7000-8000-00000000b00c',
        '01920000-0000-7000-8000-00000000b001',
        '01920000-0000-7000-8000-00000000b004',
        '01920000-0000-7000-8000-00000000b005',
        '01920000-0000-7000-8000-00000000b003',
        'curatif', 'cloturee', now());

-- ANNULÉE — `intervention_cycle_de_vie` bloque aussi `OLD.statut = 'annulee'`.
INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id", "agence_id",
                            "type", "statut", "annulee_le", "motif_annulation", "modifie_le")
VALUES ('01920000-0000-7000-8000-00000000b00d',
        '01920000-0000-7000-8000-00000000b001',
        '01920000-0000-7000-8000-00000000b004',
        '01920000-0000-7000-8000-00000000b005',
        '01920000-0000-7000-8000-00000000b003',
        'garantie', 'annulee', TIMESTAMPTZ '2026-06-02 08:00:00+11', 'Client annulé.', now());

-- LIGNE DE REPRISE.
INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id", "agence_id",
                            "type", "statut", "modifie_le")
VALUES ('01920000-0000-7000-8000-00000000b00e',
        '01920000-0000-7000-8000-00000000b001',
        '01920000-0000-7000-8000-00000000b004',
        '01920000-0000-7000-8000-00000000b005',
        '01920000-0000-7000-8000-00000000b003',
        'reprise', 'terminee', now());

-- SUR UN JOUR D'ABSENCE DE SON TECHNICIEN (l'absence est posée PLUS BAS,
-- après cette ligne) — voir l'en-tête.
INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id", "agence_id",
                            "type", "statut", "date_planifiee", "technicien_id",
                            "duree_estimee_min", "modifie_le")
VALUES ('01920000-0000-7000-8000-00000000b00f',
        '01920000-0000-7000-8000-00000000b001',
        '01920000-0000-7000-8000-00000000b004',
        '01920000-0000-7000-8000-00000000b005',
        '01920000-0000-7000-8000-00000000b003',
        'curatif', 'planifiee', '2026-06-10',
        '01920000-0000-7000-8000-00000000b006', 60, now());

-- ── INTERVENTION — SOCIÉTÉ B ────────────────────────────────────────────────
INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id", "agence_id",
                            "type", "statut", "modifie_le")
VALUES ('01920000-0000-7000-8000-00000000b10f',
        '01920000-0000-7000-8000-00000000b101',
        '01920000-0000-7000-8000-00000000b104',
        '01920000-0000-7000-8000-00000000b105',
        '01920000-0000-7000-8000-00000000b103',
        'curatif', 'a_planifier', now());

-- L'ABSENCE EST POSÉE ICI, APRÈS les interventions : la ligne « b00f »
-- existait déjà sur ce jour quand le blocage a été déclaré — une création
-- qui aurait violé le blocage lèverait elle-même, ce qui n'est pas ce que ce
-- fichier veut amorcer.
INSERT INTO "absence" ("id", "societe_id", "utilisateur_id", "du", "au", "modifie_le")
VALUES ('01920000-0000-7000-8000-00000000b008',
        '01920000-0000-7000-8000-00000000b001',
        '01920000-0000-7000-8000-00000000b006',
        '2026-06-10', '2026-06-10', now());

-- ── DEMANDES — LES QUATRE STATUTS, SOCIÉTÉ A ────────────────────────────────
INSERT INTO "demande" ("id", "societe_id", "source", "client_id", "site_id", "agence_id",
                        "description", "statut", "depose_le", "compteur_accuse_le", "modifie_le")
VALUES ('01920000-0000-7000-8000-00000000b020',
        '01920000-0000-7000-8000-00000000b001', 'appel',
        '01920000-0000-7000-8000-00000000b004',
        '01920000-0000-7000-8000-00000000b005',
        '01920000-0000-7000-8000-00000000b003',
        'Demande nouvelle', 'nouvelle', now(), now(), now());
INSERT INTO "demande" ("id", "societe_id", "source", "client_id", "site_id", "agence_id",
                        "description", "statut", "depose_le", "compteur_accuse_le", "modifie_le")
VALUES ('01920000-0000-7000-8000-00000000b021',
        '01920000-0000-7000-8000-00000000b001', 'appel',
        '01920000-0000-7000-8000-00000000b004',
        '01920000-0000-7000-8000-00000000b005',
        '01920000-0000-7000-8000-00000000b003',
        'Demande qualifiee', 'qualifiee', now(), now(), now());
INSERT INTO "demande" ("id", "societe_id", "source", "client_id", "site_id", "agence_id",
                        "description", "statut", "depose_le", "compteur_accuse_le", "modifie_le")
VALUES ('01920000-0000-7000-8000-00000000b022',
        '01920000-0000-7000-8000-00000000b001', 'appel',
        '01920000-0000-7000-8000-00000000b004',
        '01920000-0000-7000-8000-00000000b005',
        '01920000-0000-7000-8000-00000000b003',
        'Demande transformee', 'transformee', now(), now(), now());
INSERT INTO "demande" ("id", "societe_id", "source", "client_id", "site_id", "agence_id",
                        "description", "statut", "motif_cloture", "close_le",
                        "depose_le", "compteur_accuse_le", "modifie_le")
VALUES ('01920000-0000-7000-8000-00000000b023',
        '01920000-0000-7000-8000-00000000b001', 'appel',
        '01920000-0000-7000-8000-00000000b004',
        '01920000-0000-7000-8000-00000000b005',
        '01920000-0000-7000-8000-00000000b003',
        'Demande close sans suite', 'close_sans_suite', 'resolue_telephone',
        now(), now(), now(), now());

-- ── DEMANDE — SOCIÉTÉ B ─────────────────────────────────────────────────────
INSERT INTO "demande" ("id", "societe_id", "source", "client_id", "site_id", "agence_id",
                        "description", "statut", "depose_le", "compteur_accuse_le", "modifie_le")
VALUES ('01920000-0000-7000-8000-00000000b120',
        '01920000-0000-7000-8000-00000000b101', 'appel',
        '01920000-0000-7000-8000-00000000b104',
        '01920000-0000-7000-8000-00000000b105',
        '01920000-0000-7000-8000-00000000b103',
        'Demande B', 'nouvelle', now(), now(), now());

-- ═══════════════════════════════════════════════════════════════════════════
-- 9H1D — LES LIGNES HÉRITÉES QUI ONT CASSÉ LA PRODUCTION LE 24/10/2026
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Le rattrapage de 9H2 MODIFIE (UPDATE) toute ligne « numero IS NULL », sans
-- filtrer sur le statut — et une contrainte NOT VALID s'applique à toute
-- ligne NOUVELLE OU MODIFIÉE, jamais aux lignes d'avant SEULEMENT TANT QU'ON
-- NE LES TOUCHE PAS. Trois lignes ci-dessous reproduisent chacune l'état
-- hérité d'une des trois contraintes « NOT VALID » de
-- `scripts/lib/contraintes-non-validees.ts` portées par « intervention » —
-- la première est, champ pour champ, la ligne mesurée en production
-- (SqlState 23514 sur « intervention_planifiee_a_sa_duree »). Deux autres
-- lignes posent une société sur DEUX années civiles, dont une À LA FRONTIÈRE
-- du 31 décembre à Nouméa.
--
-- Pour les poser SANS violer la contrainte À L'INSTANT DE L'INSERT (NOT VALID
-- l'exigerait pour une ligne NOUVELLE), chacune recrée le contexte de D104 :
-- la contrainte retirée, la ligne posée, la contrainte reposée NOT VALID, à
-- l'identique — même nom, même expression, reprise mot pour mot de la
-- migration qui l'a posée (citée en commentaire dans
-- `20261023073000_numerotation_interventions_demandes_9h2/migration.sql`).

-- PLANIFIÉE SANS DURÉE — champ pour champ la ligne de production : statut
-- `planifiee`, date `2026-09-25`, `duree_estimee_min` NUL.
ALTER TABLE "intervention" DROP CONSTRAINT "intervention_planifiee_a_sa_duree";

INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id", "agence_id",
                            "type", "statut", "date_planifiee", "technicien_id",
                            "modifie_le")
VALUES ('01920000-0000-7000-8000-00000000b010',
        '01920000-0000-7000-8000-00000000b001',
        '01920000-0000-7000-8000-00000000b004',
        '01920000-0000-7000-8000-00000000b005',
        '01920000-0000-7000-8000-00000000b003',
        'curatif', 'planifiee', '2026-09-25',
        '01920000-0000-7000-8000-00000000b006', now());

ALTER TABLE "intervention"
  ADD CONSTRAINT "intervention_planifiee_a_sa_duree" CHECK (
    "statut" NOT IN ('planifiee', 'affectee') OR "duree_estimee_min" IS NOT NULL
  ) NOT VALID;

-- CLÔTURÉE SANS STATUT DE FACTURATION — la colonne n'existait pas quand
-- cette ligne a été close. `intervention_facturation_a_la_cloture`
-- (BEFORE INSERT) poserait « a_facturer » à sa place si elle n'était pas
-- suspendue pour la durée de cet INSERT, ce qui ne reproduirait pas l'état
-- hérité. SANS « cloturee_le », délibérément — même motif que « b00c »
-- ci-dessus : avec elle, le rattrapage de 9H1
-- (`20261022210000_rapport_valide_avant_cloture`, qui tourne AVANT 9H2 et
-- met à jour toute ligne `cloturee` dont `cloturee_le IS NOT NULL`) la
-- toucherait lui aussi et heurterait la MÊME contrainte, sur UNE migration
-- que ce lot n'a pas le droit de corriger.
ALTER TABLE "intervention" DROP CONSTRAINT "intervention_cloture_a_son_statut_facturation";
ALTER TABLE "intervention" DISABLE TRIGGER "intervention_facturation_a_la_cloture";

INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id", "agence_id",
                            "type", "statut", "modifie_le")
VALUES ('01920000-0000-7000-8000-00000000b011',
        '01920000-0000-7000-8000-00000000b001',
        '01920000-0000-7000-8000-00000000b004',
        '01920000-0000-7000-8000-00000000b005',
        '01920000-0000-7000-8000-00000000b003',
        'curatif', 'cloturee', now());

ALTER TABLE "intervention" ENABLE TRIGGER "intervention_facturation_a_la_cloture";
ALTER TABLE "intervention"
  ADD CONSTRAINT "intervention_cloture_a_son_statut_facturation"
  CHECK ("statut" <> 'cloturee' OR "statut_facturation" IS NOT NULL) NOT VALID;

-- TEMPS VALIDÉ INCOHÉRENT — un auteur sans date, posé avant que D120 exige
-- les deux ensemble.
ALTER TABLE "intervention" DROP CONSTRAINT "intervention_validation_tracee";

INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id", "agence_id",
                            "type", "statut", "temps_valide_par", "modifie_le")
VALUES ('01920000-0000-7000-8000-00000000b012',
        '01920000-0000-7000-8000-00000000b001',
        '01920000-0000-7000-8000-00000000b004',
        '01920000-0000-7000-8000-00000000b005',
        '01920000-0000-7000-8000-00000000b003',
        'curatif', 'terminee', '01920000-0000-7000-8000-00000000b006', now());

ALTER TABLE "intervention"
  ADD CONSTRAINT "intervention_validation_tracee" CHECK (
    ("temps_valide_par" IS NULL) = ("temps_valide_le" IS NULL)
  ) NOT VALID;

-- DEUX ANNÉES CIVILES, MÊME SOCIÉTÉ — le rattrapage de 9H2 numérote 2025 et
-- 2026 séparément ; avant son correctif, l'ancien index (societe_id, numero)
-- seul aurait refusé la seconde de ces deux lignes pendant l'UPDATE dès que
-- chacune reçoit le rang 1 de son année.
INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id", "agence_id",
                            "type", "statut", "cree_le", "modifie_le")
VALUES ('01920000-0000-7000-8000-00000000b013',
        '01920000-0000-7000-8000-00000000b001',
        '01920000-0000-7000-8000-00000000b004',
        '01920000-0000-7000-8000-00000000b005',
        '01920000-0000-7000-8000-00000000b003',
        'curatif', 'a_planifier', TIMESTAMPTZ '2025-06-15 09:00:00+11', now());

-- LA FRONTIÈRE : 00 h 30 le 1er janvier 2026 À NOUMÉA (UTC+11) est encore le
-- 31 décembre 2025 à 13 h 30 EN UTC. Si le rattrapage lisait l'année en UTC
-- plutôt qu'au fuseau de Nouméa (§1), cette ligne migrerait vers le compteur
-- 2025 au lieu du compteur 2026.
INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id", "agence_id",
                            "type", "statut", "cree_le", "modifie_le")
VALUES ('01920000-0000-7000-8000-00000000b014',
        '01920000-0000-7000-8000-00000000b001',
        '01920000-0000-7000-8000-00000000b004',
        '01920000-0000-7000-8000-00000000b005',
        '01920000-0000-7000-8000-00000000b003',
        'curatif', 'a_planifier', TIMESTAMPTZ '2026-01-01 00:30:00+11', now());
