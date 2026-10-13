-- CODIPLAN — La direction administre désormais les identités, comme
-- l'administrateur de société (D199, décision n° 85 d'Alexis, 13/10/2026,
-- 9EV-DIRECTION-TOUS-DROITS).
--
-- ── LA DÉCISION ─────────────────────────────────────────────────────────
--
-- « La direction doit pouvoir modifier ce qu'elle souhaite, elle a tout
-- pouvoir » — tous les droits de l'administrateur de société, partout, en
-- plus de ce qu'elle a déjà (le financier, que l'administrateur n'a pas).
--
-- `app_peut_administrer_identites()` gouverne TROIS politiques posées par
-- `20260907130000_identites_cloisonnees_l1_02c` et `20260909110000_
-- deverrouillage_escalade_l7_04` — `utilisateur_ouverture`, `utilisateur_
-- modification`, `second_facteur_deverrouillage` — sans qu'aucune d'elles
-- ne soit touchée ici : `CREATE OR REPLACE FUNCTION`, même signature, même
-- corps hors la condition de rôle, et les trois politiques qui l'appellent
-- en héritent sans recréation.
--
-- `SECURITY INVOKER` — le défaut, inchangé, comme l'original.

CREATE OR REPLACE FUNCTION "app_peut_administrer_identites"() RETURNS boolean
  LANGUAGE sql
  STABLE
  SET search_path = pg_catalog, public
  AS $$
    SELECT COALESCE("app_role"() IN ('admin_societe', 'direction'), false)
  $$;

COMMENT ON FUNCTION "app_peut_administrer_identites"() IS
  'Vrai si le rôle courant peut ouvrir ou modifier une identité — matrice §5.2, ligne « Administrer les utilisateurs » : admin_societe ET, depuis D199 (décision n° 85 d''Alexis, 13/10/2026), direction. Transcrite aussi dans lib/auth/habilitations.ts ; un test compare les deux.';
