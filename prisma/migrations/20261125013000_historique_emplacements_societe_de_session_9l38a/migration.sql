-- ═══════════════════════════════════════════════════════════════════════════
-- `app_historique_emplacements_machine` — LA SOCIÉTÉ VIENT DU CONTEXTE DE
-- SESSION, PLUS D'UN PARAMÈTRE (D284, 25/11/2026,
-- 9L38A-HISTORIQUE-EMPLACEMENTS-SOCIETE-DE-SESSION).
--
-- ## Ce que D283/9L38 avait posé, et le trou que ce lot ferme
--
-- `app_historique_emplacements_machine(p_societe_id uuid, p_machine_id uuid)`
-- recevait la société en PARAMÈTRE, fournie par l'appelant
-- (`lib/machines/emplacements.ts`, `exigerSocieteActive(contexte)`). C'était
-- juste alors — la fonction ne rendait que les lignes de LA société passée,
-- jamais plus — mais la base faisait confiance à l'appelant pour ce
-- cloisonnement, sur une fonction `SECURITY DEFINER` qui contourne déjà
-- `FORCE ROW LEVEL SECURITY` (`row_security = off`). Les trois autres
-- fonctions `SECURITY DEFINER` du dépôt ne commettent pas cette faute : D226
-- (`app_identite_exclusive_a_la_societe`) lit `app.societe_id` dans le
-- CONTEXTE, jamais en paramètre — même raisonnement que L1-02c/e cité par sa
-- propre note. Celle-ci s'aligne.
--
-- ## Le paramètre société est RETIRÉ, pas vérifié en double
--
-- Garder le paramètre et exiger qu'il égale le contexte aurait laissé un
-- appelant futur fournir la société « à la main » dans le cas normal, en ne
-- s'appuyant sur l'égalité que comme un filet — exactement la forme que D226
-- refuse. La fonction ne prend plus qu'UNE machine ; la société est lue par
-- `current_setting('app.societe_id', true)`, posée par
-- `avecContexteApplicatif` (`lib/db/rls.ts`) sur CHAQUE transaction
-- applicative. Absente : la fonction LÈVE, elle ne rend jamais zéro ligne
-- silencieusement (même fail-closed que D226).
--
-- ## Le discriminant du portail est refusé aussi
--
-- `app.client_id` (D10) distingue un compte portail d'un utilisateur interne.
-- Le journal d'audit n'est lisible par AUCUN compte portail (D283 ne l'ouvre
-- qu'aux rôles internes qui voient la fiche machine, back-office) ; un
-- contexte où `app.client_id` est posé fait donc lever cette fonction, par
-- construction, plutôt que de dépendre d'une vérification côté application
-- qui pourrait manquer demain.
--
-- ## Signature changée : DROP puis CREATE
--
-- `(uuid, uuid)` devient `(uuid)` — ce n'est pas un `CREATE OR REPLACE`
-- valide (PostgreSQL distingue les fonctions par signature), d'où le `DROP
-- FUNCTION` explicite qui suit.
--
-- ## Ce qui NE change PAS
--
-- Les colonnes rendues, le filtre `entite = 'machine'` /
-- `action = 'modification'` / site différent avant-après, `search_path` figé,
-- `SET row_security = off` (fail-closed), `REVOKE ALL FROM PUBLIC` +
-- `GRANT EXECUTE` au seul `codiplan_app` : identiques à D283.
-- ═══════════════════════════════════════════════════════════════════════════

DROP FUNCTION "app_historique_emplacements_machine"(uuid, uuid);

CREATE FUNCTION "app_historique_emplacements_machine"(
  "p_machine_id" uuid
) RETURNS TABLE (
  "id" uuid,
  "horodatage" timestamptz,
  "utilisateur_id" uuid,
  "valeurs_avant" jsonb,
  "valeurs_apres" jsonb
)
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path = pg_catalog, public
  SET row_security = off
  AS $fonction$
  DECLARE
    "v_societe_id" uuid;
    "v_client_id" text;
  BEGIN
    "v_societe_id" := NULLIF(current_setting('app.societe_id', true), '')::uuid;
    IF "v_societe_id" IS NULL THEN
      RAISE EXCEPTION
        'app_historique_emplacements_machine appelee sans app.societe_id : '
        'aucune societe active, l''historique des emplacements ne peut pas '
        'se prononcer.'
        USING ERRCODE = '42501';
    END IF;

    "v_client_id" := NULLIF(current_setting('app.client_id', true), '');
    IF "v_client_id" IS NOT NULL THEN
      RAISE EXCEPTION
        'app_historique_emplacements_machine appelee sous un contexte '
        'portail (app.client_id pose) : le journal d''audit n''est lisible '
        'par aucun compte portail.'
        USING ERRCODE = '42501';
    END IF;

    -- Alias "ja" obligatoire : en LANGUAGE plpgsql, les colonnes de
    -- RETURNS TABLE deviennent des variables du bloc, qui rendraient
    -- "id" ambigu face à la colonne "journal_audit"."id" (mesuré : 42702).
    RETURN QUERY
      SELECT "ja"."id", "ja"."horodatage", "ja"."utilisateur_id", "ja"."valeurs_avant", "ja"."valeurs_apres"
        FROM "journal_audit" AS "ja"
       WHERE "ja"."societe_id" = "v_societe_id"
         AND "ja"."entite" = 'machine'
         AND "ja"."entite_id" = "p_machine_id"
         AND "ja"."action" = 'modification'
         AND ("ja"."valeurs_avant" ->> 'site_id') IS DISTINCT FROM ("ja"."valeurs_apres" ->> 'site_id')
       ORDER BY "ja"."horodatage" DESC;
  END;
  $fonction$;

COMMENT ON FUNCTION "app_historique_emplacements_machine"(uuid) IS
  'D284/9L38A — rend les lignes de journal_audit qui portent un demenagement (entite = machine, site_id different avant/apres) de la machine recue en parametre, pour la societe du CONTEXTE DE SESSION (current_setting(''app.societe_id'', true)) — plus un parametre depuis D284. Leve si ce contexte est absent, ou si app.client_id est pose (session portail) : jamais zero ligne silencieuse. SECURITY DEFINER avec row_security = off : seule facon d''ouvrir cette lecture a tout role sans elargir journal_audit_lecture, qui reste le seul verrou du journal entier (gardien scripts/lib/politiques-rls.ts, forme « journal »). Ne recoit ni ne juge aucun role : le filtrage par role est la capacite consulter_historique_emplacements, cote application.';

REVOKE ALL ON FUNCTION "app_historique_emplacements_machine"(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "app_historique_emplacements_machine"(uuid) TO "codiplan_app";
