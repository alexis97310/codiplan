-- ═══════════════════════════════════════════════════════════════════════════
-- 9IA — RÉINITIALISATION DU SECOND FACTEUR (téléphone perdu)
-- Décision d'Alexis, 28/10/2026 (question 3 de l'audit, réponse « A et B »).
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ## CE QUE CE GESTE EST, ET CE DONT IL EST LE VOISIN
--
-- `lib/auth/deverrouillage.ts` (L7-04/D66) rompt une série de verrouillages :
-- le facteur reste INTACT, un code valide reste exigé. Ici, le téléphone est
-- PERDU : le facteur doit être rendu INERTE pour que la personne soit obligée
-- de ré-enrôler (`lib/auth/enrolement.ts`) à sa prochaine connexion. C'est
-- l'acte que D59/D58 avaient nommé et refusé de construire — « le retrait d'un
-- second facteur est un acte administratif » — et dont `second_facteur`
-- n'a toujours AUCUNE politique de suppression : cette migration n'en ajoute
-- aucune, elle écrit l'état qui force le ré-enrôlement SANS supprimer la ligne.
--
-- ## QUI : DEUX ACTEURS, DEUX PORTÉES — ET C'EST LA DÉCISION, PAS UNE DÉDUCTION
--
--   A — `admin_plateforme`, sur N'IMPORTE QUEL compte, SANS exclusion de soi ;
--   B — `admin_societe`, sur les AUTRES membres de SA société SEULE, JAMAIS
--       sur lui-même.
--
-- Ni `direction` ni aucun autre rôle n'y figurent : à la différence de
-- `app_peut_administrer_identites()` (D199), cette décision ne nomme que ces
-- deux-là. Une fonction DÉDIÉE, `app_peut_reinitialiser_second_facteur()`,
-- porte donc sa propre matrice plutôt que d'élargir une fonction existante à
-- une portée qu'elle n'a jamais eue.
--
-- ## POURQUOI DEUX TABLES, ET POURQUOI CHACUNE REPREND LA FORME DE L7-04
--
-- Forcer le ré-enrôlement exige DEUX écritures, mesurées (voir
-- `docs/propositions/9IA-REINITIALISER-SECOND-FACTEUR/mesure.md`) :
--
--   1. `second_facteur.verifie = false` (+ le verrouillage remis à zéro) —
--      sous peine du cercle parfait déjà mesuré par L1-02f : un compte dont
--      `mfa_actif` est vrai et `verifie` faux ne peut plus entrer du tout ;
--   2. `utilisateur.mfa_actif = false` — sans quoi Better Auth continuerait
--      d'exiger un code TOTP contre un secret que la personne a perdu.
--
-- Les deux sont donc écrites par le MÊME geste, sous la MÊME désignation, et
-- chacune reprend très exactement la forme mesurée par L7-04 : un `UPDATE`
-- SANS clause `WHERE`, à `SET` constants, qui ne lit AUCUNE colonne — un
-- `WHERE utilisateur_id = <sujet>` sur `second_facteur` rouvrirait la lecture
-- du secret et des codes de secours à l'administrateur (mesuré par L7-04) ;
-- sur `utilisateur`, la table n'a tout simplement AUCUNE politique de lecture
-- qu'`admin_plateforme` puisse emprunter (il n'a ni société active ni ligne
-- dans `utilisateur_societe` — c'est `app_peut_administrer_identites()` qui
-- gouverne `utilisateur_modification`, et il n'y figure pas), si bien qu'un
-- `WHERE` y échouerait de toute façon pour A, silencieusement.
--
-- La ligne est donc désignée par une variable de session dédiée,
-- `app.reinitialisation_sujet_id` (`lib/db/rls.ts`), remise à vide par tout
-- contexte ordinaire — comme `app.deverrouillage_sujet_id`.
--
-- ## LE PIÈGE DE D90, REJOUÉ SUR DEUX TABLES
--
-- Les politiques PERMISSIVES d'une même commande se combinent par OR. Sur
-- `second_facteur`, `second_facteur_modification` matcherait la PROPRE ligne
-- de l'acteur B (tout `admin_societe` en production porte son propre second
-- facteur, MFA obligatoire). Sur `utilisateur`, `utilisateur_modification`
-- matcherait tout aussi bien la PROPRE ligne de l'acteur B : son `USING` ne
-- nomme que « administre les identités » + « une identité de SA société » —
-- et l'acteur EST une identité de sa société. Sans borne, l'`UPDATE` sans
-- `WHERE` désactiverait alors le second facteur DE L'ADMINISTRATEUR en même
-- temps que celui du sujet. Chaque table reçoit donc sa politique RESTRICTIVE
-- « exclusive », au même principe que D90 : hors contexte de réinitialisation,
-- elle vaut toujours vrai ; sous ce contexte, elle borne TOUTE permissive à la
-- seule ligne désignée.
--
-- ## LE FILET DE COLONNES, SUR LES DEUX TABLES
--
-- Même raisonnement que L7-04 : un `UPDATE` sans `WHERE` s'appuie ENTIÈREMENT
-- sur sa politique. Un déclencheur, écrit À L'ENVERS, tient le second filet —
-- sous ce contexte, `second_facteur` n'accepte de bouger que les quatre
-- colonnes du verrouillage/vérification, jamais `secret` ni `codes_secours` ;
-- `utilisateur` n'accepte de bouger que `mfa_actif`.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. QUI PEUT RÉINITIALISER
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Le self-exclusion de B est posée ICI, dans la fonction : B est vrai
-- seulement si l'acteur diffère du sujet désigné. A ne porte aucune condition
-- de ce genre — la décision ne l'exige pas.

CREATE FUNCTION "app_peut_reinitialiser_second_facteur"() RETURNS boolean
  LANGUAGE sql
  STABLE
  SET search_path = pg_catalog, public
  AS $$
    SELECT COALESCE(
      "app_role"() = 'admin_plateforme'
      OR (
        "app_role"() = 'admin_societe'
        AND NULLIF(current_setting('app.utilisateur_id', true), '')
            IS DISTINCT FROM
            NULLIF(current_setting('app.reinitialisation_sujet_id', true), '')
      ),
      false
    )
  $$;

COMMENT ON FUNCTION "app_peut_reinitialiser_second_facteur"() IS
  '9IA, décision d''Alexis du 28/10/2026 (réponse « A et B ») — admin_plateforme sur n''importe quel compte (A, sans exclusion de soi), admin_societe sur un AUTRE membre de SA société (B, jamais lui-même). Matrice dédiée, distincte de app_peut_administrer_identites() : ni direction ni aucun autre rôle n''y figurent.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. `second_facteur` — LE VERROUILLAGE/VÉRIFICATION REMIS À ZÉRO
-- ═══════════════════════════════════════════════════════════════════════════
--
-- La branche « A » ne porte pas l'EXISTS : admin_plateforme n'a pas de société
-- active sous laquelle cette sous-requête pourrait seulement s'évaluer. La
-- branche « B » la porte, et c'est elle qui borne à SA société : la
-- sous-requête est soumise à la politique de `utilisateur_societe`, dont la
-- clause de société la ferme exactement — même mécanisme que
-- `second_facteur_deverrouillage`.

CREATE POLICY "second_facteur_reinitialisation" ON "second_facteur"
  FOR UPDATE
  USING (
    "app_peut_reinitialiser_second_facteur"()
    AND "utilisateur_id"
        = NULLIF(current_setting('app.reinitialisation_sujet_id', true), '')::uuid
    AND (
      "app_role"() = 'admin_plateforme'
      OR EXISTS (
        SELECT 1 FROM "utilisateur_societe" "us"
         WHERE "us"."utilisateur_id" = "second_facteur"."utilisateur_id"
      )
    )
  )
  WITH CHECK (
    "app_peut_reinitialiser_second_facteur"()
    AND "utilisateur_id"
        = NULLIF(current_setting('app.reinitialisation_sujet_id', true), '')::uuid
    AND (
      "app_role"() = 'admin_plateforme'
      OR EXISTS (
        SELECT 1 FROM "utilisateur_societe" "us"
         WHERE "us"."utilisateur_id" = "second_facteur"."utilisateur_id"
      )
    )
  );

COMMENT ON POLICY "second_facteur_reinitialisation" ON "second_facteur" IS
  '9IA — téléphone perdu : remet verifie/echecs_verification/verrouille_jusqu_a/verrouillages_consecutifs à l''état qui force le ré-enrôlement. N''ouvre AUCUNE lecture, même raison que second_facteur_deverrouillage : un UPDATE sans WHERE, que les politiques de SELECT n''atteignent pas.';

-- RESTRICTIVE — borne TOUTE permissive d'UPDATE sur cette table à la seule
-- ligne désignée, sous ce contexte. Même rôle que
-- `second_facteur_deverrouillage_exclusif` (D90), pour la même raison :
-- `second_facteur_modification` matcherait sinon la propre ligne de l'acteur.

CREATE POLICY "second_facteur_reinitialisation_exclusif" ON "second_facteur"
  AS RESTRICTIVE
  FOR UPDATE
  USING (
    NULLIF(current_setting('app.reinitialisation_sujet_id', true), '') IS NULL
    OR "utilisateur_id"
       = NULLIF(current_setting('app.reinitialisation_sujet_id', true), '')::uuid
  )
  WITH CHECK (
    NULLIF(current_setting('app.reinitialisation_sujet_id', true), '') IS NULL
    OR "utilisateur_id"
       = NULLIF(current_setting('app.reinitialisation_sujet_id', true), '')::uuid
  );

COMMENT ON POLICY "second_facteur_reinitialisation_exclusif" ON "second_facteur" IS
  '9IA, même principe que D90 — RESTRICTIVE : hors contexte de réinitialisation elle vaut toujours vrai ; sous ce contexte, elle borne toute permissive (dont second_facteur_modification) à la seule ligne désignée, pour qu''un acteur B doté de son propre second facteur ne voie pas sa propre ligne comptée par l''UPDATE sans WHERE du geste.';

-- Le filet de colonnes — écrit À L'ENVERS, même forme que
-- `second_facteur_deverrouillage_borne`, étendue à `verifie` : c'est la seule
-- colonne de plus que ce geste doit pouvoir changer.

CREATE FUNCTION "second_facteur_reinitialisation_borne"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NULLIF(current_setting('app.reinitialisation_sujet_id', true), '') IS NULL THEN
    RETURN NEW;
  END IF;

  IF (to_jsonb(NEW) - 'verifie' - 'verrouille_jusqu_a' - 'echecs_verification'
        - 'verrouillages_consecutifs')
     IS DISTINCT FROM
     (to_jsonb(OLD) - 'verifie' - 'verrouille_jusqu_a' - 'echecs_verification'
        - 'verrouillages_consecutifs')
  THEN
    RAISE EXCEPTION
      'Une réinitialisation administrative (9IA) ne modifie que verifie, verrouille_jusqu_a, echecs_verification et verrouillages_consecutifs. Elle ne touche ni au secret, ni aux codes de secours, ni au rattachement de la ligne.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "second_facteur_reinitialisation_borne"
  BEFORE UPDATE ON "second_facteur"
  FOR EACH ROW
  EXECUTE FUNCTION "second_facteur_reinitialisation_borne"();

COMMENT ON FUNCTION "second_facteur_reinitialisation_borne"() IS
  '9IA — sous un contexte de réinitialisation administrative, refuse toute modification autre que verifie, verrouille_jusqu_a, echecs_verification et verrouillages_consecutifs. Même forme que second_facteur_deverrouillage_borne (L7-04), étendue à verifie.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. `utilisateur` — `mfa_actif` REMIS À `false`
-- ═══════════════════════════════════════════════════════════════════════════

CREATE POLICY "utilisateur_reinitialisation" ON "utilisateur"
  FOR UPDATE
  USING (
    "app_peut_reinitialiser_second_facteur"()
    AND "id"
        = NULLIF(current_setting('app.reinitialisation_sujet_id', true), '')::uuid
    AND (
      "app_role"() = 'admin_plateforme'
      OR EXISTS (
        SELECT 1 FROM "utilisateur_societe" "us"
         WHERE "us"."utilisateur_id" = "utilisateur"."id"
      )
    )
  )
  WITH CHECK (
    "app_peut_reinitialiser_second_facteur"()
    AND "id"
        = NULLIF(current_setting('app.reinitialisation_sujet_id', true), '')::uuid
    AND (
      "app_role"() = 'admin_plateforme'
      OR EXISTS (
        SELECT 1 FROM "utilisateur_societe" "us"
         WHERE "us"."utilisateur_id" = "utilisateur"."id"
      )
    )
  );

COMMENT ON POLICY "utilisateur_reinitialisation" ON "utilisateur" IS
  '9IA — téléphone perdu : remet mfa_actif à false pour forcer le ré-enrôlement. Un UPDATE sans WHERE, désigné par app.reinitialisation_sujet_id : admin_plateforme (A) n''a aucune société active sous laquelle utilisateur_modification pourrait le faire lire ou écrire cette ligne.';

-- RESTRICTIVE — même raison que sur `second_facteur` : `utilisateur_modification`
-- matcherait sinon la propre ligne de l'acteur B (il est lui-même une identité
-- de sa société).

CREATE POLICY "utilisateur_reinitialisation_exclusif" ON "utilisateur"
  AS RESTRICTIVE
  FOR UPDATE
  USING (
    NULLIF(current_setting('app.reinitialisation_sujet_id', true), '') IS NULL
    OR "id"
       = NULLIF(current_setting('app.reinitialisation_sujet_id', true), '')::uuid
  )
  WITH CHECK (
    NULLIF(current_setting('app.reinitialisation_sujet_id', true), '') IS NULL
    OR "id"
       = NULLIF(current_setting('app.reinitialisation_sujet_id', true), '')::uuid
  );

COMMENT ON POLICY "utilisateur_reinitialisation_exclusif" ON "utilisateur" IS
  '9IA — RESTRICTIVE, même principe que son homonyme sur second_facteur : borne toute permissive d''UPDATE (dont utilisateur_modification) à la seule ligne désignée sous un contexte de réinitialisation.';

CREATE FUNCTION "utilisateur_reinitialisation_borne"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NULLIF(current_setting('app.reinitialisation_sujet_id', true), '') IS NULL THEN
    RETURN NEW;
  END IF;

  -- `modifie_le` est exemptée comme `mfa_actif` : Prisma la touche sur TOUT
  -- `@updatedAt`, à chaque écriture, qu'on le lui demande ou non — ce n'est
  -- pas une colonne que ce geste choisit de changer.
  IF (to_jsonb(NEW) - 'mfa_actif' - 'modifie_le')
     IS DISTINCT FROM
     (to_jsonb(OLD) - 'mfa_actif' - 'modifie_le')
  THEN
    RAISE EXCEPTION
      'Une réinitialisation administrative (9IA) sur `utilisateur` ne modifie que mfa_actif.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "utilisateur_reinitialisation_borne"
  BEFORE UPDATE ON "utilisateur"
  FOR EACH ROW
  EXECUTE FUNCTION "utilisateur_reinitialisation_borne"();

COMMENT ON FUNCTION "utilisateur_reinitialisation_borne"() IS
  '9IA — sous un contexte de réinitialisation administrative, refuse toute modification de `utilisateur` autre que mfa_actif (modifie_le exemptée comme elle, Prisma la touche sur tout @updatedAt).';

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. LA TRACE
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TYPE "EvenementAcces" ADD VALUE 'reinitialisation_second_facteur';
