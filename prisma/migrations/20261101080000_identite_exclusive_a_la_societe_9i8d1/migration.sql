-- ═══════════════════════════════════════════════════════════════════════════
-- `app_identite_exclusive_a_la_societe` — LA SEULE FONCTION SECURITY DEFINER
-- DU DÉPÔT, PAR ARBITRAGE EXPLICITE (D226, 01/11/2026, 9I8D1-REPRISE-9I8D).
--
-- ## Le trou qu'elle ferme
--
-- Copier un NOUVEAU lien d'accès (mot de passe oublié) pour un compte de
-- bureau ou un technicien suppose que la personne qui va l'utiliser est bien
-- celle visée. Si cette identité est aussi rattachée à une AUTRE société
-- (bureau ET technicien dans `utilisateur_societe`, portail dans
-- `utilisateur_client` — D223 ne couvre que les cibles protégées PAR RÔLE,
-- pas celles partagées entre sociétés), l'administrateur de la société A
-- copierait un secret au porteur qui ouvrirait aussi, potentiellement, un
-- accès déjà actif côté B. La règle métier (décision « A » d'Alexis du
-- 31/10/2026, 9I8D) : ne copier un nouveau lien QUE si l'identité est
-- EXCLUSIVE à la société active.
--
-- ## Pourquoi SECURITY DEFINER, et seulement ici (D50, D226)
--
-- Juger l'exclusivité exige de lire, pour une identité, les lignes des DEUX
-- tables qui la rattachent à une société — PAS SEULEMENT celle de la société
-- active. C'est structurellement une lecture AU-DESSUS du cloisonnement,
-- exactement ce que RLS existe pour empêcher à l'intérieur d'une société.
-- Mesuré (passation 9I8D, point 2) : sous SECURITY INVOKER et FORCE ROW LEVEL
-- SECURITY, une clause `societe_id <> app.societe_id` devient une conjonction
-- vide par construction — la politique a déjà filtré `societe_id =
-- app.societe_id` avant elle. Aucune écriture SECURITY INVOKER ne peut donc
-- répondre à la question ; SECURITY DEFINER ou rien. D226 l'autorise
-- NOMMÉMENT, sur le modèle de D36 (repli de consolidation, lot 5) : elle ne
-- rend qu'un booléen, aucun nom, aucun identifiant d'une autre société.
--
-- ## `SET row_security = off` — PAS UN CONTOURNEMENT DE PLUS, LE FAIL-CLOSED
--
-- `utilisateur_societe` et `utilisateur_client` portent toutes deux `FORCE
-- ROW LEVEL SECURITY` : même le PROPRIÉTAIRE du schéma y est normalement
-- soumis. `SECURITY DEFINER` fait exécuter cette fonction avec les droits du
-- propriétaire, mais SANS cet attribut, FORCE RLS continuerait à filtrer SES
-- lectures aussi — la clause « autre société » resterait vide, et la fonction
-- rendrait TOUJOURS vrai (faux « exclusif »), silencieusement. C'est le
-- comportement PostgreSQL documenté qui rend ceci sûr dans LES DEUX SENS :
-- pour un rôle qui est le propriétaire (ou BYPASSRLS), `row_security = off`
-- DÉSACTIVE réellement RLS ; pour tout autre rôle soumis à FORCE RLS, la MÊME
-- valeur `off` fait LEVER une erreur plutôt que filtrer en silence. Si cette
-- fonction s'exécutait un jour sous un rôle qui n'est ni le propriétaire ni
-- BYPASSRLS (SECURITY DEFINER mal posé, propriétaire changé), elle lève —
-- elle ne rend jamais un « exclusif » qu'elle n'aurait pas vérifié.
--
-- ## `app.societe_id` lu dans le CONTEXTE, jamais en paramètre
--
-- Un paramètre de société serait une valeur qui vient de l'appelant sans
-- être validée (même risque que L1-02c/e, voir
-- `20260909160000_designation_du_client_portail`). Le contexte absent LÈVE,
-- il ne rend jamais une société vide ni un booléen par défaut.
--
-- ## Ce qu'elle ne fait PAS
--
-- Aucune politique RLS n'est modifiée, aucune table n'est créée. Elle ne lit
-- que l'EXISTENCE de lignes, jamais leur contenu — ni nom, ni rôle, ni
-- identifiant de société rendus à l'appelant.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION "app_identite_exclusive_a_la_societe"(
  "p_utilisateur_id" uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
-- `search_path` figé : la fonction ne doit pas résoudre `utilisateur_societe`
-- ni `utilisateur_client` vers un schéma que l'appelant aurait glissé devant
-- `public`.
SET search_path = pg_catalog, public
-- LE FAIL-CLOSED (voir la note ci-dessus) : sans cet attribut, FORCE ROW
-- LEVEL SECURITY continuerait à mordre sur le propriétaire lui-même.
SET row_security = off
AS $fonction$
DECLARE
  "v_societe_id" uuid;
BEGIN
  "v_societe_id" := NULLIF(current_setting('app.societe_id', true), '')::uuid;
  IF "v_societe_id" IS NULL THEN
    -- Contexte absent : refus, jamais un booléen rendu au hasard.
    RAISE EXCEPTION
      'app_identite_exclusive_a_la_societe appelee sans app.societe_id : '
      'aucune societe active, le controle d''exclusivite ne peut pas se '
      'prononcer.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NOT EXISTS (
    SELECT 1
      FROM "utilisateur_societe" "us"
     WHERE "us"."utilisateur_id" = "p_utilisateur_id"
       AND "us"."societe_id" <> "v_societe_id"
  ) AND NOT EXISTS (
    SELECT 1
      FROM "utilisateur_client" "uc"
     WHERE "uc"."utilisateur_id" = "p_utilisateur_id"
       AND "uc"."societe_id" <> "v_societe_id"
  );
END;
$fonction$;

COMMENT ON FUNCTION "app_identite_exclusive_a_la_societe"(uuid) IS
  'D226, 9I8D1 — vrai seulement si l''identite n''a AUCUNE ligne '
  'utilisateur_societe ni utilisateur_client pour une societe AUTRE que '
  'app.societe_id du contexte courant. SECURITY DEFINER avec row_security = '
  'off : seule facon de lire au-dessus du cloisonnement FORCE RLS pour ce '
  'controle precis (D50, exception nommee). Leve si app.societe_id est '
  'absent — jamais vrai par defaut. Ne rend qu''un booleen : aucun nom, '
  'aucun identifiant d''une autre societe.';

-- Le rôle applicatif est le SEUL à l'appeler. `PUBLIC` est retiré : une
-- fonction SECURITY DEFINER laissée exécutable par tous serait un privilège
-- que personne n'a décidé (même famille que l'`ON UPDATE CASCADE` par
-- défaut, §9, 24/08) — et ici, le seul rôle qui en a l'usage.
REVOKE ALL ON FUNCTION "app_identite_exclusive_a_la_societe"(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "app_identite_exclusive_a_la_societe"(uuid) TO "codiplan_app";
