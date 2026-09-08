-- ═══════════════════════════════════════════════════════════════════════════
-- Q1 — LE GESTE D'OUVERTURE DU PREMIER COMPTE
-- Arbitrage d'exploitation du 09/09/2026 (D65). Ticket L1-02h.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ## Le problème que cette migration résout, et il était bloquant
--
-- `utilisateur_ouverture` exige une société active ET `app_peut_administrer_
-- identites()`. Pour la PREMIÈRE identité d'une société, il n'existe personne à
-- être : aucun compte n'y est habilité, donc aucun rôle ne peut être tenu.
-- **Personne ne peut se connecter à CODIPLAN, et rien ne peut y remédier.**
--
-- ## LA SORTIE N'EST PAS QUE LE SCRIPT S'ATTRIBUE UNE AUTORITÉ
--
-- La nuit du 08/09 avait refusé de poser le geste pour cette raison exacte : un
-- script d'amorçage qui poserait lui-même `app.role = 'admin_societe'`
-- **s'attribuerait une autorité que personne ne lui a accordée**. Le refus était
-- juste.
--
-- Ce que l'arbitrage tranche est une troisième voie : *ce n'est pas au script de
-- prétendre à une autorité, c'est à la BASE d'admettre un cas — et ce cas doit
-- se détruire en s'exerçant.*
--
-- La politique d'ouverture reçoit donc **une branche de plus** : une identité
-- peut être ouverte sans rôle qui administre **si et seulement si la société
-- visée ne porte AUCUNE habilitation**. Pas « aucun administrateur » — aucune
-- habilitation, quelle qu'elle soit.
--
-- **C'est un CLIQUET, pas une auto-habilitation.** Le script n'affirme rien : il
-- ne pose aucun rôle et ne se déclare rien. Il franchit une porte que la base
-- ouvre, et **l'acte lui-même la referme** — la première habilitation créée rend
-- la branche inapplicable pour toujours. Même forme que le cliquet de l'escalade
-- du second facteur (D62) : un état qui ne se rouvre pas tout seul.
--
-- ## POURQUOI LA SOUS-REQUÊTE EST FIDÈLE, ET NON PAS SEULEMENT PLAUSIBLE
--
-- `app_societe_active_vierge()` est `SECURITY INVOKER` — le défaut, et D50 reste
-- close et vide. Sa sous-requête est donc soumise aux politiques de
-- `utilisateur_societe`, ce qui pourrait, en théorie, MASQUER des lignes et
-- répondre « vierge » à tort : ce serait le sens permissif.
--
-- **Ce n'est pas atteignable, et la raison est exacte plutôt que rassurante.**
-- La politique `cloisonnement_societe` de `utilisateur_societe` porte
-- `societe_id = app.societe_id`, et la clause `WHERE` de la fonction porte la
-- MÊME condition : les deux coïncident, aucune ligne de la société active ne
-- peut être masquée. La seule autre politique de la table,
-- `utilisateur_societe_mes_habilitations` (D61), n'AJOUTE que des lignes ; une
-- addition ne peut que fermer la branche, jamais l'ouvrir.
--
-- ## CE QUE LA BRANCHE NE DONNE PAS
--
-- Elle n'ouvre qu'un `INSERT` sur `utilisateur`. Ouvrir une identité **n'accorde
-- rien** : sans ligne de `utilisateur_societe`, le compte ne lit aucune donnée
-- cloisonnée (mesuré par les scénarios de L0-05 depuis le lot 0). Ce qui accorde
-- est l'habilitation, et elle reste gouvernée par la clause de société — la
-- branche est déjà refermée quand elle s'écrit.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. LA SOCIÉTÉ ACTIVE EST-ELLE VIERGE DE TOUTE HABILITATION ?
-- ═══════════════════════════════════════════════════════════════════════════

CREATE FUNCTION "app_societe_active_vierge"() RETURNS boolean
  LANGUAGE sql
  STABLE
  SET search_path = pg_catalog, public
  AS $$
    SELECT
      NULLIF(current_setting('app.societe_id', true), '') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "utilisateur_societe" "us"
         WHERE "us"."societe_id"
               = NULLIF(current_setting('app.societe_id', true), '')::uuid
      )
  $$;

COMMENT ON FUNCTION "app_societe_active_vierge"() IS
  'Q1 / D65 — vrai si une société est active ET qu''elle ne porte AUCUNE habilitation. C''est la condition du geste d''amorçage : la toute première identité d''une société s''ouvre sans rôle qui administre, parce qu''il n''existe encore personne à être. L''acte referme la porte — la première habilitation créée rend cette fonction fausse pour toujours. SECURITY INVOKER : la sous-requête est soumise aux politiques de utilisateur_societe, dont la clause de société coïncide exactement avec le WHERE ci-dessus, si bien qu''aucune ligne de la société active ne peut être masquée.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. LA BRANCHE D'AMORÇAGE SUR L'OUVERTURE D'UNE IDENTITÉ
-- ═══════════════════════════════════════════════════════════════════════════
--
-- La société active reste exigée dans les DEUX branches : c'est elle qui dit de
-- quelle société on ouvre la première identité, et sans elle
-- `app_societe_active_vierge()` est fausse par construction.

DROP POLICY "utilisateur_ouverture" ON "utilisateur";

CREATE POLICY "utilisateur_ouverture" ON "utilisateur"
  FOR INSERT
  WITH CHECK (
    NULLIF(current_setting('app.societe_id', true), '') IS NOT NULL
    AND (
      "app_peut_administrer_identites"()
      OR "app_societe_active_vierge"()
    )
  );

COMMENT ON POLICY "utilisateur_ouverture" ON "utilisateur" IS
  'Deux branches, et la seconde est un CLIQUET (Q1 / D65). Le cas général : une société active et le rôle qui administre (admin_societe, D37). Le cas d''AMORÇAGE : une société active qui ne porte encore AUCUNE habilitation — il n''existe alors personne à être, et la première identité doit pouvoir naître. La branche se détruit en s''exerçant : la première habilitation créée la rend inapplicable pour toujours. Ouvrir une identité n''accorde rien ; ce qui accorde est l''habilitation, gouvernée par la clause de société.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. L'OUVERTURE D'UNE IDENTITÉ EST UN ÉVÉNEMENT D'ACCÈS
-- ═══════════════════════════════════════════════════════════════════════════
--
-- **Règle générale, arbitrée le 09/09/2026, et elle ne vaut pas que pour
-- l'amorçage :** la création et la suppression d'une identité sont des
-- ÉVÉNEMENTS D'ACCÈS, pas des événements métier. Elles vont à `journal_acces`,
-- jamais à `journal_audit` — et la raison est mécanique, non doctrinale : **une
-- identité n'appartient à aucune société**, alors que `journal_audit` est
-- cloisonné par société et partitionné. L'y faire entrer casserait son
-- partitionnement.
--
-- La règle vaudra telle quelle pour le chemin ADMINISTRATIF d'ouverture de
-- compte du lot 7 : c'est pourquoi la valeur ajoutée nomme l'ÉVÉNEMENT
-- (« une identité a été ouverte ») et non le chemin. Le chemin va dans
-- `detail` — une valeur d'énumération qui nommerait un script provisoire
-- deviendrait un vestige le jour où le script disparaît.

ALTER TYPE "EvenementAcces" ADD VALUE 'ouverture_identite';
