-- ═══════════════════════════════════════════════════════════════════════════
-- L1-02f — LA TRANSITION D'ENRÔLEMENT, ET ELLE SEULE
-- ═══════════════════════════════════════════════════════════════════════════
--
-- D58 a décidé le principe : *dans un produit où l'accès est délivré, le
-- libre-service n'est pas une surface à borner, c'est une exception à justifier
-- transition par transition.* Et il n'en a ouvert QU'UNE : **l'enrôlement du
-- second facteur, dans un seul sens.** D59 en a posé le plancher — la ligne de
-- `second_facteur` ne peut plus être supprimée par personne — sans écrire le
-- chemin. Ce chemin est écrit ici.
--
-- ── CE QUE LA MESURE A TROUVÉ, ET QUI A DÉCIDÉ DE LA FORME ────────────────
--
-- Mesuré le 08/09/2026, chaîne réelle, base jetable, rôle `codiplan_app` :
-- `auth.api.enableTwoFactor` réussit et crée la ligne ; `auth.api.verifyTOTP`
-- avec un code JUSTE répond **HTTP 200** ; et pourtant `second_facteur.verifie`
-- reste `false`, `utilisateur.mfa_actif` reste `false`, et **le compte se
-- reconnecte sans qu'aucun second facteur ne lui soit demandé**.
--
-- *Un enrôlement qui répond « c'est fait » et n'a rien fait.* Les deux écritures
-- étaient refusées **en silence**, et pour deux raisons différentes :
--
--   1. la bibliothèque écrit `verified = true` en désignant la ligne par son
--      `id`, qui n'est pas une clé de désignation de `second_facteur` — aucune
--      variable posée, aucune ligne retenue, zéro ligne modifiée SANS ERREUR ;
--   2. `utilisateur_modification` exige `app.societe_id` **et**
--      `app_peut_administrer_identites()`. Le sujet qui s'enrôle n'a ni l'un ni
--      l'autre — et **ne peut pas les avoir** : son rôle exige justement le
--      second facteur qu'il est en train de poser. Un cercle parfait.
--
-- ── CE QUE CETTE MIGRATION FAIT, ET CE QU'ELLE REFUSE DE FAIRE ────────────
--
-- Elle ouvre la SECONDE écriture, et elle seule. La première est traitée par le
-- code applicatif, qui écrit `verifie` en désignant la ligne par son
-- `utilisateur_id` : `second_facteur_modification` l'accepte déjà, et
-- `CLES_DESIGNATION` ne bouge donc pas d'une entrée. **Une liste close qu'on
-- n'a pas eu besoin d'élargir est une liste close qui reste close.**
--
-- ── POURQUOI UNE POLITIQUE *ET* UN DÉCLENCHEUR : RLS EST PAR LIGNE ────────
--
-- C'est le point de conception du ticket, et il n'est pas évident. Une
-- politique `WITH CHECK` voit la ligne NOUVELLE ; un `USING` voit l'ANCIENNE ;
-- **aucune des deux ne voit les deux à la fois, et aucune ne raisonne par
-- COLONNE.** La politique ci-dessous dit donc « cette ligne passait de
-- `mfa_actif = false` à `mfa_actif = true` » — et ne dit RIEN des autres
-- colonnes. Sous elle seule, le sujet qui s'enrôle pourrait, dans la même
-- instruction, changer son courriel, son nom, ou se remettre `actif`.
--
-- Le déclencheur tient ce que la politique ne peut pas tenir. Et il le tient
-- **par différence de la ligne entière**, jamais par une liste de colonnes à
-- maintenir : `to_jsonb(OLD) - 'mfa_actif'` contre `to_jsonb(NEW) - 'mfa_actif'`.
-- Une colonne ajoutée demain est couverte le jour où elle est créée, sans que
-- personne ait à revenir ici — c'est la parade du §9 (01/09) appliquée à un
-- déclencheur : on DÉRIVE, on ne recopie pas.
--
-- ── LE DISCRIMINANT, ET POURQUOI IL EST CELUI-LÀ ──────────────────────────
--
-- Le déclencheur ne doit pas mordre sur le chemin ADMINISTRATIF, qui change
-- légitimement d'autres colonnes. Le discriminant est l'absence de société
-- active : `utilisateur_modification` EXIGE `app.societe_id`, si bien qu'une
-- modification qui arrive sans société n'a pu passer que par la politique
-- d'enrôlement ci-dessous. Le déclencheur ne se substitue donc jamais à la
-- politique — il ne parle que là où elle est la seule à avoir laissé passer.
--
-- ── CE QUE LE REFUS DIT, ET CE QU'IL NE DIT PAS (D50) ─────────────────────
--
-- Il nomme ce qui bloque et la marche à suivre. Il ne compte rien, ne nomme
-- aucune donnée, et ne dit pas si le compte existe : un message d'erreur est un
-- canal d'information, soumis au cloisonnement comme une requête.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. LA POLITIQUE — le cliquet, dans un seul sens
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `USING` lit l'ANCIENNE ligne : `mfa_actif = false`. `WITH CHECK` lit la
-- NOUVELLE : `mfa_actif = true`. Un compte peut donc se doter d'un second
-- facteur ; il ne peut jamais s'en défaire — ni en repassant le drapeau à
-- `false` (le `WITH CHECK` refuse), ni en supprimant sa ligne de
-- `second_facteur` (D59 : aucune politique de suppression).
--
-- Et le `WITH CHECK` est ÉNONCÉ, même s'il ne répète pas le `USING` : une
-- politique qui n'énonce qu'un `USING` légifère en silence sur les écritures
-- (L1-02c). Ici les deux expressions DIFFÈRENT, et c'est tout le cliquet.
CREATE POLICY "utilisateur_enrolement_mfa" ON "utilisateur"
  FOR UPDATE
  USING (
    "id" = NULLIF(current_setting('app.authentification_utilisateur_id', true), '')::uuid
    AND "mfa_actif" = false
  )
  WITH CHECK (
    "id" = NULLIF(current_setting('app.authentification_utilisateur_id', true), '')::uuid
    AND "mfa_actif" = true
  );

COMMENT ON POLICY "utilisateur_enrolement_mfa" ON "utilisateur" IS
  'L1-02f — la seule transition en libre-service que D58 ouvre : le sujet pose son second facteur, il ne le retire jamais. USING lit l''ancienne ligne (mfa_actif = false), WITH CHECK la nouvelle (mfa_actif = true) : c''est le cliquet. RLS étant par LIGNE et non par colonne, le déclencheur utilisateur_enrolement_mfa_seul tient les autres colonnes.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. LE DÉCLENCHEUR — ce que la politique ne peut pas tenir
-- ═══════════════════════════════════════════════════════════════════════════
--
-- **Pas de `SECURITY DEFINER`**, et il n'en a pas besoin : il ne lit aucune
-- table, seulement `OLD`, `NEW` et une variable de session.
CREATE OR REPLACE FUNCTION "utilisateur_enrolement_mfa_seul"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Hors chemin d'enrôlement : une société active est posée, donc c'est le
  -- chemin administratif, et il a le droit de changer ce qu'il veut. On ne
  -- parle que là où la politique d'enrôlement est la seule à pouvoir avoir
  -- laissé passer.
  IF NULLIF(current_setting('app.societe_id', true), '') IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- La ligne entière, MOINS ce que l'enrôlement a le droit de bouger. Une
  -- colonne ajoutée demain entre ici sans que personne ne revienne.
  --
  -- DEUX retraits, et le second est d'une autre nature que le premier :
  -- `mfa_actif` est la transition elle-même ; `modifie_le` est l'horodatage que
  -- Prisma pose sur TOUTE écriture (`@updatedAt`) et qui ne dit rien du compte.
  -- Le laisser dans la comparaison aurait fait échouer l'enrôlement pour la
  -- seule raison qu'il a eu lieu.
  IF (to_jsonb(OLD) - 'mfa_actif' - 'modifie_le')
     IS DISTINCT FROM (to_jsonb(NEW) - 'mfa_actif' - 'modifie_le') THEN
    RAISE EXCEPTION
      'Ce chemin n''autorise que l''activation du second facteur. Toute autre modification du compte passe par l''administrateur de la société.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION "utilisateur_enrolement_mfa_seul"() IS
  'L1-02f — RLS est par LIGNE : une politique ne sait pas dire « seule cette colonne ». Ce déclencheur le dit, et par DIFFÉRENCE de la ligne entière plutôt que par une liste de colonnes qui se périmerait au premier ALTER TABLE.';

CREATE TRIGGER "utilisateur_enrolement_mfa_seul"
  BEFORE UPDATE ON "utilisateur"
  FOR EACH ROW
  EXECUTE FUNCTION "utilisateur_enrolement_mfa_seul"();

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. « APPARTENANCE » — la HUITIÈME forme de politique (D61)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ── LE MUR, MESURÉ AVANT D'ÊTRE CONTOURNÉ ────────────────────────────────
--
-- Un compte qui vient de se connecter n'a **aucune société active** : la
-- connexion n'établit que l'identité (D35), et `basculerSociete` exige qu'on lui
-- NOMME la société visée. Or rien ne pouvait la nommer : `utilisateur_societe`
-- portait la forme « société » (`societe_id = app.societe_id`), si bien que la
-- question « sur quelles sociétés suis-je habilité ? » rendait **zéro ligne**
-- tant qu'une société n'était pas déjà active. Un cercle parfait, et le premier
-- écran s'y heurte de plein fouet : il n'existait aucun chemin par lequel un
-- utilisateur réel puisse atteindre sa propre société.
--
-- ── CE QUE LA HUITIÈME FORME AJOUTE, ET CE QU'ELLE COÛTE ─────────────────
--
-- *Un compte lit SES lignes d'habilitation, toutes sociétés confondues ; jamais
-- celles d'autrui.* La clause est ancrée sur l'identité connectée, pas sur la
-- société — c'est la première fois qu'une ligne de la PREMIÈRE catégorie de I1
-- devient lisible hors de sa société, et cela s'écrit plutôt que de se glisser
-- dans une politique existante.
--
-- **Le coût est nommé** : la liste des sociétés d'une personne est désormais
-- lisible par cette personne. Ce n'est pas une donnée d'exploitation d'une
-- société — c'est un fait sur l'identité, du même genre que « existe-t-il un
-- compte pour ce courriel » que D35 a déjà tranché. Elle ne rend ni les noms de
-- ces sociétés (`societe` reste de forme « identité », D42), ni aucune de leurs
-- données.
--
-- ── POURQUOI UNE POLITIQUE SÉPARÉE, ET EN `SELECT` SEUL ──────────────────
--
-- C'est le point qui décide de tout. `cloisonnement_societe` couvre les QUATRE
-- commandes ; y ajouter `OR utilisateur_id = app.utilisateur_id` aurait laissé
-- un compte **ÉCRIRE sa propre habilitation** — c'est-à-dire s'attribuer le rôle
-- de son choix sur la société de son choix. La branche est donc une politique
-- DISTINCTE, en `SELECT` et en `SELECT` seul, et l'écriture reste entièrement
-- gouvernée par la clause de société.
--
-- Et elle n'énonce pas de `WITH CHECK` — non par oubli, mais parce que
-- PostgreSQL n'en accepte pas sur une politique `FOR SELECT` : il n'y a pas
-- d'écriture à gouverner. C'est le seul cas où la règle de L1-02c (« toute
-- politique couvrant une écriture énonce son `WITH CHECK` ») ne s'applique pas,
-- et c'est parce qu'elle n'en couvre aucune.
CREATE POLICY "utilisateur_societe_mes_habilitations" ON "utilisateur_societe"
  FOR SELECT
  USING (
    "utilisateur_id" = NULLIF(current_setting('app.utilisateur_id', true), '')::uuid
  );

COMMENT ON POLICY "utilisateur_societe_mes_habilitations" ON "utilisateur_societe" IS
  'L1-02f / D61 — huitième forme, « appartenance ». Un compte lit SES lignes d''habilitation, toutes sociétés confondues, et jamais celles d''autrui. SELECT SEUL : la même branche sur les quatre commandes aurait laissé un compte s''attribuer le rôle de son choix. Sans elle, aucun chemin ne permettait à un utilisateur de découvrir sa propre société, et basculerSociete exige qu''on la lui nomme.';
