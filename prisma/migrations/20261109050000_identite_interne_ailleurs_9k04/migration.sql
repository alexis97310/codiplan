-- ═══════════════════════════════════════════════════════════════════════════
-- `app_identite_interne_ailleurs` — DEUXIÈME ENTRÉE de `AUTORISEES_PAR_ARBITRAGE`
-- (D233, complément du 09/11/2026, 9K04-PORTAIL-INVITATION-EMPLOYE).
--
-- ## Le résidu que D233 nommait, sans le fermer
--
-- D233 (08/11/2026, 9K01) a posé `identiteExclusiveALaSociete` (D226) comme
-- seul filtre à l'invitation portail : une identité connue d'une AUTRE société
-- et déjà pourvue d'un mot de passe est acceptée (branche « a », déjà actif),
-- SANS distinguer un compte CLIENT déjà actif ailleurs (accepté, décision (a))
-- d'un compte d'EMPLOYÉ (interne) déjà actif ailleurs (refusé, décision (c) du
-- 08/11 ~09:00) — `app_identite_exclusive_a_la_societe` ne rend qu'UN booléen,
-- jamais LAQUELLE des deux tables (`utilisateur_societe`, `utilisateur_client`)
-- a répondu. D233 nommait ce résidu et posait sa condition de réouverture :
-- « une seconde fonction SECURITY DEFINER (sur le modèle de D226), donc une
-- migration ». C'est elle, ici.
--
-- ## Une question plus étroite que celle de D226 — et c'est voulu
--
-- `app_identite_exclusive_a_la_societe` répond à « cette identité a-t-elle UNE
-- ligne, dans N'IMPORTE LAQUELLE des deux tables, pour une société autre ? ».
-- Celle-ci répond à une question plus étroite, et c'est tout ce que (c)
-- demande : « cette identité a-t-elle une ligne `utilisateur_societe` — un
-- rattachement INTERNE, bureau ou technicien — pour une société autre ? »,
-- sans jamais regarder `utilisateur_client`. `utilisateur_societe` ne porte
-- aucune colonne `actif` (contrairement à `utilisateur_client`) : aucune
-- révocation souple n'existe sur cette table — l'EXISTENCE de la ligne EST le
-- rattachement actif, exactement comme pour l'EXISTS côté `utilisateur_societe`
-- de `app_identite_exclusive_a_la_societe` elle-même.
--
-- ## Même patron, mêmes précautions, mêmes droits que D226 (9K04, mandat)
--
-- `SECURITY DEFINER`, propriétaire du schéma (seul moyen de lire au-dessus de
-- `FORCE ROW LEVEL SECURITY` sur `utilisateur_societe` — même raisonnement que
-- D226, non répété ici), `SET search_path = pg_catalog, public` figé, `SET
-- row_security = off` en attribut de la fonction (même fail-closed : pour
-- tout rôle qui n'est ni le propriétaire ni `BYPASSRLS`, la même valeur fait
-- LEVER une erreur sous `FORCE ROW LEVEL SECURITY` plutôt que de filtrer en
-- silence), `STABLE`, `app.societe_id` lu dans le contexte et JAMAIS passé en
-- paramètre, contexte absent → elle lève, jamais vrai ni faux par défaut. Elle
-- ne rend qu'un booléen — aucun nom, aucun identifiant, aucun rôle d'une autre
-- société. `REVOKE ALL ... FROM PUBLIC`, `GRANT EXECUTE` au seul rôle
-- applicatif (`codiplan_app`). Aucune politique RLS modifiée, aucune table
-- nouvelle.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION "app_identite_interne_ailleurs"(
  "p_utilisateur_id" uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
-- `search_path` figé : la fonction ne doit pas résoudre `utilisateur_societe`
-- vers un schéma que l'appelant aurait glissé devant `public`.
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
      'app_identite_interne_ailleurs appelee sans app.societe_id : '
      'aucune societe active, le controle ne peut pas se prononcer.'
      USING ERRCODE = '42501';
  END IF;

  RETURN EXISTS (
    SELECT 1
      FROM "utilisateur_societe" "us"
     WHERE "us"."utilisateur_id" = "p_utilisateur_id"
       AND "us"."societe_id" <> "v_societe_id"
  );
END;
$fonction$;

COMMENT ON FUNCTION "app_identite_interne_ailleurs"(uuid) IS
  'D233 (complement 9K04) — vrai seulement si l''identite porte au moins une '
  'ligne utilisateur_societe (rattachement INTERNE, bureau ou technicien) '
  'pour une societe AUTRE que app.societe_id du contexte courant. Ne regarde '
  'jamais utilisateur_client. SECURITY DEFINER avec row_security = off : '
  'meme raisonnement que app_identite_exclusive_a_la_societe (D226) pour ce '
  'controle plus etroit. Leve si app.societe_id est absent — jamais vrai ni '
  'faux par defaut. Ne rend qu''un booleen : aucun nom, aucun role, aucun '
  'identifiant d''une autre societe.';

-- Le rôle applicatif est le SEUL à l'appeler — même restriction que D226.
REVOKE ALL ON FUNCTION "app_identite_interne_ailleurs"(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "app_identite_interne_ailleurs"(uuid) TO "codiplan_app";
