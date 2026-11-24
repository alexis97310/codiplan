-- CODIPLAN — Ouvre l'historique des emplacements d'une machine à tout rôle qui
-- voit la fiche (D283, 23/11/2026, point 3 de la séance ; seconde moitié de
-- D280 ; ticket 9L38-HISTORIQUE-EMPLACEMENTS-TOUS-ROLES).
--
-- ── LE TROU QUE 9L34/D280 AVAIT DÉCRIT SANS LE COMBLER ─────────────────────
--
-- `historiqueDesEmplacements` (lib/machines/emplacements.ts) lit
-- `journal_audit` sous le contexte applicatif. La SEULE politique de lecture
-- qui existait, `journal_audit_lecture` (migration 20260829120000), n'ouvre
-- la table qu'à `admin_societe`/`direction` (`app_peut_consulter_journal_
-- audit`, matrice §5.2, `consulter_journal_audit`) — RM, RS et ADV, qui voient
-- pourtant la fiche machine entière, en recevaient ZÉRO LIGNE sous RLS, quelle
-- que soit la requête applicative. 9L34 a mesuré ce verrou et a choisi de NE
-- PAS retirer la garde côté écran plutôt que de livrer un bloc qui dirait
-- « jamais déplacée » d'une machine qui l'a pourtant été (D50, D280).
--
-- ── LA POLITIQUE AJOUTÉE, ET POURQUOI ELLE RESTE ÉTROITE ───────────────────
--
-- Une SECONDE politique PERMISSIVE de lecture, qui s'ajoute (OR) à
-- `journal_audit_lecture` plutôt que de la remplacer — PostgreSQL combine par
-- disjonction toutes les politiques permissives d'une même commande. Elle
-- n'ouvre que les lignes qui PORTENT un déménagement de machine :
-- `entite = 'machine'`, une action de modification, et un `site_id` qui
-- diffère entre `valeurs_avant` et `valeurs_apres`. Un rôle qui n'a pas
-- `consulter_journal_audit` continue de recevoir zéro ligne sur toute AUTRE
-- écriture du journal (un champ de machine qui change sans toucher le site, une
-- ligne sur `societe`, une ligne sur `utilisateur_societe`…) : le journal
-- entier reste réservé, exactement comme D280 l'exige — seule la vue étroite
-- de l'historique des emplacements s'ouvre.
--
-- AUCUN filtre de rôle dans cette politique : D280 la décrit ouverte « à TOUT
-- rôle de la société », parce que le filtrage par rôle reste la responsabilité
-- de l'application (`peutPleinement(contexte.role, "consulter_historique_
-- emplacements")`, `lib/auth/habilitations.ts`) — la même répartition que
-- partout ailleurs dans ce dépôt : la base cloisonne par société et par
-- PÉRIMÈTRE DE DONNÉES, l'application juge le rôle (§12.2, deuxième barrière).
--
-- `consulter_journal_audit` (matrice §5.2) n'est PAS touchée : elle continue
-- de ne garder que la lecture GÉNÉRALE du journal, et cette politique ne
-- l'élargit pas — elle ouvre une vue différente, sur des lignes différentes.
--
-- Comparateur `IS DISTINCT FROM`, pas `<>` : deux valeurs NULL ne doivent
-- jamais se compter comme « différentes » (une ligne de CRÉATION a
-- `valeurs_avant` NULL dans son ensemble, jamais seulement sa clé `site_id` —
-- mais l'opérateur sûr est le même que celui déjà choisi par
-- `historiqueDesEmplacements` et par D280 elle-même).

CREATE POLICY "journal_audit_lecture_emplacements_machine" ON "journal_audit"
  FOR SELECT
  USING (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
    AND "entite" = 'machine'
    AND "action" = 'modification'
    AND ("valeurs_avant" ->> 'site_id') IS DISTINCT FROM ("valeurs_apres" ->> 'site_id')
  );

COMMENT ON POLICY "journal_audit_lecture_emplacements_machine" ON "journal_audit" IS
  'D283/9L38 — ouvre la lecture des SEULES lignes de déménagement de machine (entite = machine, site_id différent avant/après) à tout rôle de la société, sans filtre de rôle : le filtrage par rôle est la responsabilité de l''application (capacité consulter_historique_emplacements). S''ajoute par disjonction à journal_audit_lecture, qui reste le seul verrou du journal entier.';
