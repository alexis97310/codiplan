-- ═══════════════════════════════════════════════════════════════════════════
-- L7-04 — DÉVERROUILLAGE D'UN COMPTE PARVENU À L'ESCALADE
-- Arbitrage Q2 du 09/09/2026 (D66). Ferme l'impasse laissée ouverte par D64.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ## L'état qu'on ferme
--
-- Au troisième verrouillage enchaîné, `second_facteur_escalade` remplace la date
-- d'expiration par une SENTINELLE : le verrouillage cesse d'expirer. L'état est
-- atteignable en **trente codes faux**, et **aucun chemin n'en sortait** — le
-- déclencheur laissait déjà passer la remise à zéro, mais aucune politique
-- n'accordait le droit de l'écrire.
--
-- **Ce n'est pas L7-01, et la distinction est de fond** : L7-01 rend un accès
-- PERDU, L7-04 ne rend que le droit de **RÉESSAYER**. Le facteur est intact ;
-- seule la série de verrouillages est rompue. La personne devra toujours
-- présenter un code valide, et n'a **rien** à réenrôler.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- CE QUE LA MESURE A CHANGÉ À LA FORME, ET C'EST LE CŒUR DE CETTE MIGRATION
-- ═══════════════════════════════════════════════════════════════════════════
--
-- La forme évidente — une politique d'`UPDATE` pour l'administrateur, et le code
-- qui écrit `WHERE utilisateur_id = <sujet>` — **NE FONCTIONNE PAS**, et elle
-- échoue en silence. Mesuré le 09/09/2026, sur cette base, sous le rôle
-- applicatif :
--
--     politique d'UPDATE seule, UPDATE … WHERE utilisateur_id = $1  →  0 ligne
--     politique de SELECT ajoutée, même UPDATE                      →  1 ligne
--
-- **PostgreSQL applique les politiques de `SELECT` au `WHERE` d'un `UPDATE`**
-- (§9, 08/09). Il aurait donc fallu OUVRIR UNE LECTURE de `second_facteur` à
-- l'administrateur — et la mesure dit exactement ce que cela lui donnerait :
--
--     ce que l'admin LIT alors : [{"secret":"…","codes_secours":"…"}]
--
-- *C'est-à-dire le matériel du second facteur de la personne qu'il est censé
-- dépanner.* Un `admin_societe` pourrait générer des codes valides au nom d'un
-- membre de sa société : **une prise de contrôle, pas un déverrouillage.** L7-04
-- ne doit rendre que le droit de réessayer ; ouvrir cette lecture rendrait bien
-- davantage.
--
-- ## LA SORTIE : UN `UPDATE` QUI NE LIT RIEN
--
-- Mesuré dans la foulée, et c'est la divergence qui l'a désignée — *quand deux
-- chemins qui devraient se ressembler ne se ressemblent pas, l'écart désigne
-- l'endroit exact où une hypothèse est fausse* (§9, 07/09) :
--
--     UPDATE … SET <constantes>  SANS clause WHERE      →  1 ligne
--     UPDATE … SET <constantes>  WHERE utilisateur_id   →  0 ligne
--     Prisma `updateMany` SANS `where`                  →  count 1
--
-- Un `UPDATE` dont le `SET` ne porte que des constantes et qui n'a pas de
-- `WHERE` **ne lit aucune colonne** : les politiques de `SELECT` ne s'y
-- appliquent pas, et c'est le `USING` de la politique d'`UPDATE` — et lui seul —
-- qui choisit les lignes. **Aucune lecture de `second_facteur` n'est donc
-- ouverte à qui que ce soit.** L'administrateur ne peut ni lire le secret, ni
-- lire les codes de secours, ni même constater que la ligne existe.
--
-- ## CE QUI DÉSIGNE ALORS LA LIGNE
--
-- Puisqu'il n'y a pas de `WHERE`, c'est une variable de session qui dit QUELLE
-- ligne : `app.deverrouillage_sujet_id`, posée par le seul chemin de production
-- qui compose le contexte (`lib/db/rls.ts`), et remise à VIDE par tout contexte
-- ordinaire — comme les désignations d'authentification.
--
-- **Elle ne suffit jamais seule**, et c'est la forme de D64 : la variable dit
-- QUELLE ligne, la politique dit QUI a le droit et DANS QUEL ÉTAT. Trois
-- exigences s'ajoutent, et aucune n'est décorative :
--
--   1. `app_peut_administrer_identites()` — `admin_societe` SEUL. Ni `direction`
--      de la société concernée, ni `admin_plateforme`, ni le sujet lui-même ;
--   2. le sujet est **habilité sur la société active** — la sous-requête est
--      soumise à la politique de `utilisateur_societe`, dont la clause de
--      société la borne exactement ;
--   3. la ligne est **à l'escalade** — `verrouille_jusqu_a` vaut la sentinelle.
--      Cette politique ne peut donc pas servir à autre chose qu'à rompre une
--      série : elle n'atteint aucune ligne saine.
--
-- ## ET LE FILET DE COLONNES, PARCE QU'UN `UPDATE` SANS `WHERE` EST LARGE
--
-- Un `UPDATE` sans `WHERE` s'appuie ENTIÈREMENT sur la politique. C'est le
-- contrat de RLS, et c'est aussi le sens permissif : une politique un jour
-- élargie écrirait toutes les lignes de la table. Deux filets, de natures
-- différentes :
--
--   — en base, un déclencheur qui, sous un contexte de déverrouillage, refuse
--     **toute** modification autre que les trois colonnes du verrouillage. Il
--     est écrit à l'ENVERS — tout est refusé sauf ce qui est nommé —, si bien
--     qu'une colonne ajoutée demain est protégée le jour où elle apparaît.
--     C'est le renversement de D55, appliqué aux colonnes ;
--   — dans le code, le geste refuse et annule si le décompte n'est pas
--     exactement UN. Voir `lib/auth/deverrouillage.ts`.
--
-- *C'est la leçon de D64 prise à l'endroit : on énumère ce que le verbe FAIT,
-- pas ce qu'on veut lui interdire.*

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. LA POLITIQUE
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `WITH CHECK` est ÉCRIT, et il n'est pas la copie du `USING` : la ligne
-- APRÈS l'écriture n'est plus à l'escalade — c'est tout l'objet du geste. Le
-- répéter refuserait l'écriture qu'on autorise (L1-02c : une politique qui
-- n'énonce qu'un `USING` légifère en silence sur les écritures).

CREATE POLICY "second_facteur_deverrouillage" ON "second_facteur"
  FOR UPDATE
  USING (
    "app_peut_administrer_identites"()
    AND "utilisateur_id"
        = NULLIF(current_setting('app.deverrouillage_sujet_id', true), '')::uuid
    AND "verrouille_jusqu_a" = "second_facteur_sentinelle_verrouillage"()
    AND EXISTS (
      SELECT 1 FROM "utilisateur_societe" "us"
       WHERE "us"."utilisateur_id" = "second_facteur"."utilisateur_id"
    )
  )
  WITH CHECK (
    "app_peut_administrer_identites"()
    AND "utilisateur_id"
        = NULLIF(current_setting('app.deverrouillage_sujet_id', true), '')::uuid
    AND EXISTS (
      SELECT 1 FROM "utilisateur_societe" "us"
       WHERE "us"."utilisateur_id" = "second_facteur"."utilisateur_id"
    )
  );

COMMENT ON POLICY "second_facteur_deverrouillage" ON "second_facteur" IS
  'L7-04 / D66 — rompre la série de verrouillages d''un compte parvenu à l''escalade. admin_societe SEUL, sur un sujet habilité sur SA société, et uniquement sur une ligne DÉJÀ à la sentinelle. Elle n''ouvre AUCUNE lecture : le geste écrit un UPDATE sans clause WHERE, que PostgreSQL ne soumet pas aux politiques de SELECT — mesuré, parce qu''un UPDATE … WHERE aurait exigé d''ouvrir la lecture du secret et des codes de secours à l''administrateur, c''est-à-dire une prise de contrôle et non un déverrouillage.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. LE FILET DE COLONNES — ÉCRIT À L'ENVERS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE FUNCTION "second_facteur_deverrouillage_borne"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Hors contexte de déverrouillage, ce déclencheur ne dit rien : les chemins
  -- de vérification et d'enrôlement sont bornés par leurs propres politiques.
  IF NULLIF(current_setting('app.deverrouillage_sujet_id', true), '') IS NULL THEN
    RETURN NEW;
  END IF;

  -- À L'ENVERS : tout est refusé, moins les trois colonnes du verrouillage.
  -- Une colonne ajoutée demain est protégée le jour où elle apparaît, sans que
  -- personne n'ait à revenir compléter une liste.
  IF (to_jsonb(NEW) - 'verrouille_jusqu_a' - 'echecs_verification'
        - 'verrouillages_consecutifs')
     IS DISTINCT FROM
     (to_jsonb(OLD) - 'verrouille_jusqu_a' - 'echecs_verification'
        - 'verrouillages_consecutifs')
  THEN
    RAISE EXCEPTION
      'Un déverrouillage administratif (L7-04) ne modifie que le verrouillage : verrouille_jusqu_a, echecs_verification et verrouillages_consecutifs. Il ne touche ni au secret, ni aux codes de secours, ni au rattachement de la ligne — déverrouiller n''accorde aucun accès.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- Le nom compte : les déclencheurs `BEFORE` s'exécutent dans l'ordre
-- ALPHABÉTIQUE, et `…_deverrouillage_borne` passe avant `…_escalade`. Le filet
-- juge donc ce que l'APPELANT a écrit, jamais ce que l'escalade a corrigé
-- ensuite.
CREATE TRIGGER "second_facteur_deverrouillage_borne"
  BEFORE UPDATE ON "second_facteur"
  FOR EACH ROW
  EXECUTE FUNCTION "second_facteur_deverrouillage_borne"();

COMMENT ON FUNCTION "second_facteur_deverrouillage_borne"() IS
  'Sous un contexte de déverrouillage administratif (L7-04), refuse toute modification autre que les trois colonnes du verrouillage. Écrit à l''ENVERS — tout est refusé sauf ce qui est nommé — pour qu''une colonne ajoutée plus tard soit protégée le jour où elle apparaît. Un UPDATE sans clause WHERE s''appuie entièrement sur sa politique : ce déclencheur est le second filet, de nature différente.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. LA TRACE
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Un déverrouillage est un événement d'ACCÈS : il enjambe l'identité et la
-- société, et il doit rester lisible par les deux. `journal_acces` porte
-- l'auteur, la société et — dans `detail` — le compte concerné.

ALTER TYPE "EvenementAcces" ADD VALUE 'deverrouillage_second_facteur';
