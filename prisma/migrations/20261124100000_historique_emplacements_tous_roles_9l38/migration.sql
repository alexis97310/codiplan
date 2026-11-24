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
-- que soit la requête applicative.
--
-- ── POURQUOI PAS UNE SECONDE POLITIQUE RLS SUR `journal_audit` ────────────
--
-- Mesuré AVANT d'écrire la fonction ci-dessous : une seconde politique
-- PERMISSIVE de SELECT sur `journal_audit`, scopée aux seules lignes
-- `entite = 'machine'` dont le `site_id` diffère, fait ROUGIR
-- `scripts/lib/politiques-rls.ts` (`ecartsJournal`) — gardien fermé de la
-- forme « journal » (I8, L0-10) : TOUTE politique de SELECT sur cette table
-- doit exiger `app_peut_consulter_journal_audit()`, précisément pour qu'une
-- politique plus étroite ne puisse pas, demain, ouvrir le journal entier par
-- inadvertance. C'est le même raisonnement que D50 : élargir une liste close
-- par un ticket plutôt que par un arbitrage serait l'assouplissement qu'elle
-- existe pour refuser. Cette voie est donc écartée, pas seulement plus
-- étroite — et D280, qui la décrivait, est amendée sur ce point par D283.
--
-- ── LA FONCTION `SECURITY DEFINER`, ARBITRÉE (D283) ────────────────────────
--
-- Même patron que D226/D233/D281 (`tests/unit/db/security-definer-sous-
-- arbitrage.test.ts`, liste close) : `search_path` figé,
-- `SET row_security = off` pour échouer plutôt que de filtrer en silence sous
-- un propriétaire soumis à FORCE RLS (FAIL-CLOSED), `REVOKE ALL FROM PUBLIC`
-- puis `GRANT EXECUTE` au seul rôle applicatif. Elle ne reçoit QUE la société
-- et la machine visées — jamais un rôle — et ne peut rendre que les lignes de
-- déménagement de CETTE machine, dans CETTE société : un appelant qui se
-- serait trompé de société ne lirait que les lignes (absentes) de la société
-- qu'il a nommée, jamais celles d'une autre. Le filtrage par RÔLE reste la
-- responsabilité de l'application (`consulter_historique_emplacements`,
-- `lib/auth/habilitations.ts`) — la même répartition que partout ailleurs :
-- la base cloisonne par société et par PÉRIMÈTRE DE DONNÉES, l'application
-- juge le rôle (§12.2, deuxième barrière).
--
-- Les colonnes rendues sont EXACTEMENT celles que lisait déjà la requête
-- Prisma qu'elle remplace (`historiqueDesEmplacements`) : aucune colonne
-- supplémentaire du journal n'est exposée.
--
-- `consulter_journal_audit` (matrice §5.2) n'est PAS touchée : elle continue
-- de ne garder que la lecture GÉNÉRALE du journal, et `journal_audit_lecture`
-- reste l'unique politique de SELECT sur la table.

CREATE FUNCTION "app_historique_emplacements_machine"(
  "p_societe_id" uuid,
  "p_machine_id" uuid
) RETURNS TABLE (
  "id" uuid,
  "horodatage" timestamptz,
  "utilisateur_id" uuid,
  "valeurs_avant" jsonb,
  "valeurs_apres" jsonb
)
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = pg_catalog, public
  SET row_security = off
  AS $$
    SELECT "id", "horodatage", "utilisateur_id", "valeurs_avant", "valeurs_apres"
      FROM "journal_audit"
     WHERE "societe_id" = "p_societe_id"
       AND "entite" = 'machine'
       AND "entite_id" = "p_machine_id"
       AND "action" = 'modification'
       AND ("valeurs_avant" ->> 'site_id') IS DISTINCT FROM ("valeurs_apres" ->> 'site_id')
     ORDER BY "horodatage" DESC
  $$;

COMMENT ON FUNCTION "app_historique_emplacements_machine"(uuid, uuid) IS
  'D283/9L38 — rend les lignes de journal_audit qui portent un déménagement (entite = machine, site_id différent avant/après) de la machine et de la société reçues en paramètre. SECURITY DEFINER avec row_security = off : seule façon d''ouvrir cette lecture à tout rôle sans élargir journal_audit_lecture, qui reste le seul verrou du journal entier (gardien scripts/lib/politiques-rls.ts, forme « journal »). Fail-closed : pour tout rôle qui n''est ni le propriétaire ni BYPASSRLS, lève sous FORCE ROW LEVEL SECURITY plutôt que de filtrer en silence. Ne reçoit ni ne juge aucun rôle : le filtrage par rôle est la capacité consulter_historique_emplacements, côté application.';

REVOKE ALL ON FUNCTION "app_historique_emplacements_machine"(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "app_historique_emplacements_machine"(uuid, uuid) TO "codiplan_app";
