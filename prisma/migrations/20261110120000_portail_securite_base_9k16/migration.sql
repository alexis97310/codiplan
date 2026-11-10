-- CODIPLAN — Fermer la base au compte client (9K16-PORTAIL-SECURITE-BASE),
-- décision d'Alexis du 10/11/2026 (~06:45) ; étude du 08/11
-- (`etude-0811/portail-securite.md`, §4 I2, I3, I4 b) ; matrice d'entrée
-- `tests/isolation/portail-matrice.test.ts` (9K15) ; arbitrage D237.
--
-- ── CE QUE SEUL LE CODE TENAIT JUSQU'ICI ────────────────────────────────────
--
-- Aucun écran ne laisse un compte client écrire ailleurs que ses demandes et
-- ses contacts, ni lire les tables internes de forme « société ». Mais la
-- BASE le permettait : `scripts/lib/politiques-rls.ts` accordait déjà
-- `SELECT, INSERT, UPDATE, DELETE` à `codiplan_app` sur toutes les tables
-- (`20260820130000_force_rls_role_applicatif`), et la plupart des politiques
-- « société »/« filiation »/« habilitation » ne regardent jamais
-- `app.client_id` à l'écriture. C'est de la défense en profondeur absente,
-- pas une fuite démontrée aujourd'hui — et c'est exactement ce que cette
-- migration pose.
--
-- ── TROIS VERROUS, UN PRINCIPE UNIQUE ───────────────────────────────────────
--
-- Chaque verrou est une politique AS RESTRICTIVE, qui s'AJOUTE par ET à la
-- forme déjà en place — elle ne la remplace pas, elle la BORNE pour le seul
-- cas où `app.client_id` est posé (un compte portail) :
--
--   1. VERROU TOTAL (I4 b + I3 combinés) — `FOR ALL` : lecture ET écriture
--      fermées. Pour les tables qu'aucun chemin du portail ne lit ni n'écrit
--      aujourd'hui (mesuré par grep le 10/11/2026, voir D237).
--   2. VERROU D'ÉCRITURE (I3 seul) — trois politiques, `FOR INSERT`,
--      `FOR UPDATE`, `FOR DELETE` (jamais `FOR ALL`, qui fermerait aussi la
--      lecture) : la table reste lisible, elle devient non écrivable.
--   3. VERROU D'IDENTITÉ (I2) — même forme que le verrou d'écriture, sur
--      `utilisateur_client`/`utilisateur_client_site` seules, avec une
--      échappatoire nommée : `app_peut_administrer_identites()`.
--
-- La clause est unique, et c'est délibéré : `NULLIF(current_setting(
-- 'app.client_id', true), '') IS NULL` — vraie pour tout contexte INTERNE
-- (bureau, technicien, tâche planifiée), où `app.client_id` n'est jamais
-- posé (D10). Aucun rôle interne ne perd quoi que ce soit : la restrictive
-- est TOUJOURS satisfaite hors contexte portail.
--
-- ── CE QUI RESTE OUVERT, ET POURQUOI (contrat d'entrée de 9K15) ─────────────
--
-- `demande`, `contact`, `compteur_numerotation` : le portail les écrit
-- réellement (chapitre 9, P5). `demande_statut_historique` LES REJOINT, et
-- ce n'est PAS une table que le portail écrit directement : c'est le
-- déclencheur `demande_statut_historique_tracer` (jamais SECURITY DEFINER,
-- D50) qui y insère, SOUS LE RÔLE ET LE CONTEXTE DE L'APPELANT, à chaque
-- dépôt de demande. Un verrou d'écriture ici aurait rejeté l'historique du
-- PREMIER geste que ce ticket protège — mesuré en lisant
-- `20261104100000_historique_des_etats_9j08a/migration.sql:133-151`, pas
-- supposé. `utilisateur_client`/`utilisateur_client_site` reçoivent leur
-- propre verrou (I2, point 1), pas le verrou générique. `societe` (forme
-- « adhésion », SELECT seul hors société active) et `journal_audit` (forme
-- « journal », INSERT seul et déjà habilité) sont déjà fermés par leur
-- propre forme : un verrou de plus n'y ajouterait rien, et y toucher
-- risquerait de fermer l'audit lui-même, que I8 veut inconditionnel.
--
-- ── LES SEPT TABLES DU VERROU TOTAL (I4 b + un constat de 9K15) ────────────
--
-- Cinq confirmées par l'étude (§4 I4 b) : `technicien`, `habilitation`,
-- `technicien_habilitation`, `temps_trajet_zone`, `vgp_campagne`.
--
-- `utilisateur_societe` : constat AU-DELÀ de l'étude (9K15, §4) — aucun
-- filtre client sur sa forme « appartenance », et aucun chemin du portail
-- ne la lit (grep le 10/11/2026 sur `prisma.utilisateurSociete` dans
-- `lib/portail/`, `app/(portail)/`, `app/api/portail/` : zéro résultat
-- pertinent — les deux seules mentions sont des COMMENTAIRES disant que le
-- compte portail n'y a aucune ligne, D10). Le verrou s'AJOUTE à la forme
-- « appartenance » ; il ne la remplace pas — la branche « mes habilitations »
-- (`utilisateur_societe_mes_habilitations`, ancrée `app.utilisateur_id`)
-- reste entière pour tout compte interne : `app.client_id` n'y est jamais
-- posé, et la restrictive y est donc toujours satisfaite.
--
-- `intervention_pause` : candidate de la passation 9K15 (§4), reconfirmée au
-- 10/11/2026 — zéro chemin dans `app/(portail)/**`, `app/api/portail/**`,
-- `lib/portail/**`, NI dans `lib/interventions/bon.ts`/`depot-rapport-
-- terrain.ts` (ce second grep couvre le code PARTAGÉ avec le bureau et le
-- terrain, que le grep de 9K15 ratait — voir ci-dessous), NI dans aucun
-- fichier `tests/isolation/*.test.ts` qui pose un contexte portail : aucune
-- épreuve ne mesure ni ne réclame sa lecture par un compte client.
--
-- ── QUATRE CANDIDATES DE 9K15 QUI NE REÇOIVENT PAS CE VERROU ────────────────
--
-- Sept autres candidates de la passation 9K15 (§4) ont été reconfirmées une
-- par une au 10/11/2026 — PAS PAR LE MÊME GREP QUE 9K15, qui s'arrêtait à
-- `lib/portail/**` et ratait donc tout ce qui passe par le code PARTAGÉ avec
-- le bureau ou le terrain, OU tout ce qu'un GARDIEN DE TEST, et non un écran,
-- réclame déjà. Les sept se répartissent en DEUX raisons distinctes, aucune
-- des deux fermable :
--
--   — `intervention_prestation`, `intervention_signature`,
--     `intervention_piece_remplacee` SONT lues par le bon du portail, via
--     `prestationsRealisees`/`derniereSignature`/`piecesRemplacees`
--     (`lib/interventions/depot-rapport-terrain.ts`), appelées par
--     `composerBon` (`lib/interventions/bon.ts:501-506`) pour les DEUX
--     appelants, bureau ET portail. Les fermer aurait cassé le bon
--     téléchargeable du client.
--   — `site_habilitation_requise`, `suite_a_donner`, `vgp_verification`,
--     `vgp_observation` portent chacune un SCÉNARIO D'ISOLATION DÉDIÉ,
--     ÉCRIT ET VERT, qui pose un contexte PORTAIL et VÉRIFIE la lecture
--     filtrée par périmètre — `tests/isolation/habilitations.test.ts`
--     (describe « LA FILIATION — un compte portail ne voit que les
--     exigences de SON périmètre »), `tests/isolation/suite-a-donner.test.ts`
--     (« le filtre de PÉRIMÈTRE se propage »), `tests/isolation/
--     vgp-verification.test.ts` (« un compte PORTAIL retrouve les rapports
--     de SES machines »). Ce n'est PAS une question « pas tranchée » comme
--     D231 le dit de `suite_a_donner` pour un ÉCRAN : la COUCHE DE DONNÉES,
--     elle, est déjà construite, éprouvée et commitée pour que le portail
--     lise ces quatre tables — fermer leur LECTURE casserait une épreuve
--     existante, ce qui est la preuve qu'elles ne sont pas des candidates
--     mais des tables déjà ouvertes PAR CONSTRUCTION. La première ébauche de
--     cette migration les avait closes à tort, sur la foi du seul grep
--     applicatif de 9K15 ; `pnpm test:isolation` l'a immédiatement démenti.
--
-- Ces sept restent de forme « filiation », ouvertes en LECTURE, et reçoivent
-- seulement le VERROU D'ÉCRITURE (point 2) : aucun chemin du portail n'en
-- ÉCRIT aucune, seul le terrain écrit les trois premières
-- (`app/api/terrain/**`), et rien n'écrit les quatre autres.
--
-- ── M3 — LES SEGMENTS DU TECHNICIEN, SEULEMENT UNE FOIS CLÔTURÉE ───────────
--
-- La brèche `cloisonnement_filiation_lecture_portail` (9J22A) ouvrait les
-- segments de TOUTE intervention visible au client, pas seulement celle
-- déjà clôturée — c'est le CODE seul qui n'affichait le bon qu'après
-- clôture. `ALTER POLICY` resserre son `EXISTS` sur
-- `"i"."cloturee_le" IS NOT NULL`, pour que la base porte désormais la même
-- borne.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. VERROU D'IDENTITÉ (I2) — utilisateur_client, utilisateur_client_site
-- ═══════════════════════════════════════════════════════════════════════════
--
-- La clause des deux tables (`cloisonnement_habilitation`,
-- `…20260907120000_perimetre_sites_l1_02b/migration.sql:306-350`) exige
-- « société ET (pas de client posé OU ma propre ligne) » — elle ne dit RIEN
-- du `client_id` INSÉRÉ. Un compte du client A1 peut donc, par une seule
-- écriture, se rattacher LUI-MÊME à A2, le voisin de sa société, ou
-- modifier le `client_id` de son rattachement, ou supprimer son périmètre
-- de sites. Non exploitable aujourd'hui (aucun chemin de code n'écrit ces
-- tables depuis le portail), et c'est exactement pourquoi un verrou en
-- base, pas seulement un test, est la bonne défense : le jour où un écran
-- futur laisserait passer une saisie, la base refuserait d'elle-même.

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['utilisateur_client', 'utilisateur_client_site']
  LOOP
    EXECUTE format(
      $f$CREATE POLICY "verrou_identite_portail_insertion" ON %I
           AS RESTRICTIVE FOR INSERT
           WITH CHECK (
             NULLIF(current_setting('app.client_id', true), '') IS NULL
             OR "app_peut_administrer_identites"()
           )$f$,
      v_table
    );
    EXECUTE format(
      $f$CREATE POLICY "verrou_identite_portail_modification" ON %I
           AS RESTRICTIVE FOR UPDATE
           USING (
             NULLIF(current_setting('app.client_id', true), '') IS NULL
             OR "app_peut_administrer_identites"()
           )
           WITH CHECK (
             NULLIF(current_setting('app.client_id', true), '') IS NULL
             OR "app_peut_administrer_identites"()
           )$f$,
      v_table
    );
    EXECUTE format(
      $f$CREATE POLICY "verrou_identite_portail_suppression" ON %I
           AS RESTRICTIVE FOR DELETE
           USING (
             NULLIF(current_setting('app.client_id', true), '') IS NULL
             OR "app_peut_administrer_identites"()
           )$f$,
      v_table
    );
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. VERROU D'ÉCRITURE (I3) — toutes les tables que le portail ne lit QUE,
--    jamais n'écrit
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'client', 'site', 'machine', 'intervention',
    'document', 'modele_materiel', 'famille_materiel',
    'document_recu', 'absence', 'import_lot', 'import_lot_ligne',
    'notification', 'checklist_modele', 'segment_travail',
    'intervention_machine', 'intervention_prestation', 'intervention_signature',
    'intervention_piece_remplacee', 'intervention_statut_historique',
    'checklist_version', 'checklist_point', 'notification_lecture', 'checklist_reponse',
    'site_habilitation_requise', 'suite_a_donner', 'vgp_verification', 'vgp_observation',
    'agence', 'calendrier', 'calendrier_plage', 'calendrier_ferie',
    'forfait', 'prestation', 'taux_horaire', 'technicien_calendrier'
  ]
  LOOP
    EXECUTE format(
      $f$CREATE POLICY "verrou_ecriture_portail_insertion" ON %I
           AS RESTRICTIVE FOR INSERT
           WITH CHECK (NULLIF(current_setting('app.client_id', true), '') IS NULL)$f$,
      v_table
    );
    EXECUTE format(
      $f$CREATE POLICY "verrou_ecriture_portail_modification" ON %I
           AS RESTRICTIVE FOR UPDATE
           USING (NULLIF(current_setting('app.client_id', true), '') IS NULL)
           WITH CHECK (NULLIF(current_setting('app.client_id', true), '') IS NULL)$f$,
      v_table
    );
    EXECUTE format(
      $f$CREATE POLICY "verrou_ecriture_portail_suppression" ON %I
           AS RESTRICTIVE FOR DELETE
           USING (NULLIF(current_setting('app.client_id', true), '') IS NULL)$f$,
      v_table
    );
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. VERROU TOTAL (I4 b + I3) — les tables qu'aucun chemin du portail ne lit
--    ni n'écrit
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'utilisateur_societe',
    'technicien', 'habilitation', 'technicien_habilitation',
    'temps_trajet_zone', 'vgp_campagne',
    'intervention_pause'
  ]
  LOOP
    EXECUTE format(
      $f$CREATE POLICY "verrou_portail" ON %I
           AS RESTRICTIVE FOR ALL
           USING (NULLIF(current_setting('app.client_id', true), '') IS NULL)
           WITH CHECK (NULLIF(current_setting('app.client_id', true), '') IS NULL)$f$,
      v_table
    );
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. M3 — segment_travail : le client suit SON technicien, jamais en direct
-- ═══════════════════════════════════════════════════════════════════════════

ALTER POLICY "cloisonnement_filiation_lecture_portail" ON "segment_travail"
  USING (
    NULLIF(current_setting('app.client_id', true), '') IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM "intervention" "i"
       WHERE "i"."id" = "segment_travail"."intervention_id"
         AND "i"."cloturee_le" IS NOT NULL
    )
  );

COMMENT ON POLICY "cloisonnement_filiation_lecture_portail" ON "segment_travail" IS
  '9J22A, resserrée par 9K16/M3 (D237) : la brèche n''ouvrait que sur l''intervention visible au client, sans condition de statut — la base laissait donc suivre un technicien MINUTE PAR MINUTE pendant une intervention en cours, le code seul réservant l''affichage du bon à la clôture. `"i"."cloturee_le" IS NOT NULL` porte désormais la même borne en base.';
