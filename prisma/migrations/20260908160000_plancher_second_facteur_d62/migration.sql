-- ═══════════════════════════════════════════════════════════════════════════
-- D62 — LE PLANCHER DU SECOND FACTEUR, ET L'ESCALADE QUI FERME L'ARITHMÉTIQUE
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ## Ce que cette migration NE fait PAS, et c'est le plus important
--
-- **Elle ne touche à AUCUNE politique.** Le compteur d'échecs de D62 était
-- inerte, et la connexion par second facteur ne fonctionnait pas du tout ; on
-- pouvait croire que les politiques de `second_facteur` et de `verification`
-- étaient trop serrées. Elles ne l'étaient pas.
--
-- Mesuré sur les huit flux réels : **69 opérations, dont 7 nomment un `id`, et
-- les 7 sont des ÉCRITURES.** La bibliothèque lit une ligne par sa clé de
-- désignation, puis réécrit celle qu'elle vient d'obtenir en la nommant par son
-- `id` — que l'enveloppe ne reconnaît pas. Aucune variable n'était donc posée,
-- la politique lisait une chaîne vide, et l'écriture était refusée en silence.
--
-- La réparation est dans la POSE, et elle vit dans `lib/auth/echange.ts`. Les
-- politiques d'ici gardent leur seconde moitié — `utilisateur_id = …` sur
-- `second_facteur`, `identifiant = …` sur `verification` —, et c'est elle qui
-- refuse un `id` rejoué venu d'un autre compte.
--
-- ## Ce qu'elle fait : l'ESCALADE, et pourquoi elle est ici
--
-- Le verrouillage de la bibliothèque est temporaire : dix échecs, quinze
-- minutes, puis dix de plus. À ce régime, un attaquant qui détient déjà le mot
-- de passe dispose d'environ 350 000 codes par an, pour un espace utile de
-- 3,3·10⁵ — la fenêtre TOTP acceptant trois codes à tout instant. **Le
-- verrouillage temporaire seul ne ferme donc rien** ; c'est l'escalade qui le
-- fait, en plafonnant l'attaque soutenue à trente codes AU TOTAL.
--
-- **Pourquoi un déclencheur et non du code applicatif.** La vérification a
-- TROIS chemins — `/two-factor/verify-totp`, `/verify-backup-code`,
-- `/verify-otp` — et ils sont atteignables depuis l'extérieur par le
-- gestionnaire attrape-tout. Une escalade écrite dans notre route ne serait donc
-- pas au point de passage obligé : deux des trois chemins la contourneraient.
-- La base, elle, est franchie par les trois.
--
-- **Et le compteur s'incrémente dans la même instruction que le verrouillage
-- qu'il compte** — c'est un `BEFORE UPDATE` qui modifie `NEW`, donc la même
-- ligne, la même transaction. Il ne peut pas compter autre chose que ce qui se
-- passe.

-- ── 1. LA COLONNE ──────────────────────────────────────────────────────────
--
-- Elle n'est JAMAIS écrite par l'application : le déclencheur la recalcule à
-- chaque mise à jour, en ignorant ce que l'appelant a passé. C'est ce qui la
-- range sous D58 — *ni le sujet ni un compte ordinaire ne remet à zéro ce qui
-- gouverne l'accès.*
ALTER TABLE "second_facteur"
  ADD COLUMN "verrouillages_consecutifs" INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN "second_facteur"."verrouillages_consecutifs" IS
  'Verrouillages temporaires enchaînés SANS connexion réussie entre eux. Écrite par le seul déclencheur second_facteur_escalade — jamais par l''application, jamais par le sujet (D58). Au troisième, le verrouillage cesse d''expirer et le déblocage devient l''acte administratif L7-04.';

-- ── 2. LA SENTINELLE ───────────────────────────────────────────────────────
--
-- **Pourquoi une date, et pas un drapeau.** La bibliothèque ne consulte QU'UNE
-- chose pour refuser : `verrouille_jusqu_a > now()`. Un drapeau à côté serait
-- une seconde lecture du même fait, que rien ne confronterait (§9, 01/09) — et
-- surtout il ne refuserait rien, la bibliothèque ne le lisant pas. L'escalade
-- écrit donc dans la colonne QUE LE REFUS CONSULTE, et lui donne une date qui
-- n'arrive pas.
--
-- `'infinity'::timestamptz` aurait dit la chose exactement, et c'est pourquoi il
-- faut écrire pourquoi il n'est pas retenu : côté JavaScript il devient une date
-- invalide, dont la comparaison `> Date.now()` est FAUSSE — le verrou
-- s'ouvrirait au lieu de se fermer. Une valeur finie est ici plus sûre qu'une
-- valeur juste.
CREATE OR REPLACE FUNCTION "second_facteur_sentinelle_verrouillage"()
RETURNS TIMESTAMPTZ
LANGUAGE SQL
IMMUTABLE
AS $$ SELECT TIMESTAMPTZ '9999-12-31 23:59:59+00' $$;

COMMENT ON FUNCTION "second_facteur_sentinelle_verrouillage"() IS
  'La date qui n''arrive pas : elle encode « ce verrouillage n''expire plus ». Lue en base par les scénarios plutôt que recopiée en TypeScript : une seconde écriture de cette date serait une seconde source du même fait.';

-- ── 3. LE DÉCLENCHEUR ──────────────────────────────────────────────────────
--
-- ## LE POINT DÉLICAT : DEUX ÉCRITURES IDENTIQUES, DEUX SENS OPPOSÉS
--
-- « Trois verrouillages CONSÉCUTIFS » suppose de distinguer une connexion
-- réussie d'une simple expiration du verrou. Or la bibliothèque produit dans les
-- deux cas la MÊME nouvelle ligne — `echecs_verification = 0`,
-- `verrouille_jusqu_a = NULL`. C'est le piège du 08/09 au §9 : *deux chemins qui
-- rendent le même résultat, et c'est la forme de l'appel que le code lit.*
--
-- Un déclencheur ne voit pas la forme de l'appel. Il voit l'ANCIENNE LIGNE, et
-- elle suffit — parce que les deux chemins ne partent pas du même état :
--
--   * la purge paresseuse d'un verrou expiré exige `OLD.verrouille_jusqu_a`
--     NON NUL et déjà passé (sans quoi la bibliothèque sort sans rien écrire) ;
--   * la remise à zéro après succès, elle, trouve `OLD.verrouille_jusqu_a` NUL —
--     soit parce qu'aucun verrou n'était posé, soit parce que la purge vient de
--     l'effacer juste avant, dans la même requête.
--
-- `OLD.verrouille_jusqu_a IS NULL` sépare donc exactement les deux. Sans cette
-- distinction, la purge remettrait le compteur à zéro toutes les quinze minutes
-- et **l'escalade ne se déclencherait jamais** — une garantie verte qui ne
-- garde rien.
CREATE OR REPLACE FUNCTION "second_facteur_escalade"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  seuil CONSTANT INTEGER := 3;
BEGIN
  IF NEW."verrouille_jusqu_a" IS NOT NULL
     AND NEW."verrouille_jusqu_a" > now()
     AND NEW."verrouille_jusqu_a" IS DISTINCT FROM OLD."verrouille_jusqu_a"
  THEN
    -- Un verrouillage vient d'être posé : on le compte, dans la même
    -- instruction que lui.
    NEW."verrouillages_consecutifs" := OLD."verrouillages_consecutifs" + 1;
    IF NEW."verrouillages_consecutifs" >= seuil THEN
      NEW."verrouille_jusqu_a" := "second_facteur_sentinelle_verrouillage"();
    END IF;

  ELSIF NEW."verrouille_jusqu_a" IS NULL
        AND NEW."echecs_verification" = 0
  THEN
    IF OLD."verrouille_jusqu_a" IS NULL THEN
      -- Connexion réussie : la série est rompue.
      NEW."verrouillages_consecutifs" := 0;
    ELSIF OLD."verrouille_jusqu_a" = "second_facteur_sentinelle_verrouillage"()
    THEN
      -- DÉBLOCAGE ADMINISTRATIF (L7-04) : la seule main qui a le droit de
      -- rompre la série sans connexion réussie. Le déclencheur le laisse
      -- passer ; c'est à L7-04 d'écrire QUI en a le droit — aucune politique
      -- ne l'accorde aujourd'hui, et c'est voulu.
      NEW."verrouillages_consecutifs" := 0;
    ELSE
      -- Purge paresseuse d'un verrou expiré : la série CONTINUE.
      NEW."verrouillages_consecutifs" := OLD."verrouillages_consecutifs";
    END IF;

  ELSE
    -- Tout le reste — un échec compté, un enrôlement, une correction : la
    -- colonne n'est pas à l'appelant. Elle ne bouge pas.
    NEW."verrouillages_consecutifs" := OLD."verrouillages_consecutifs";
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "second_facteur_escalade"
  BEFORE UPDATE ON "second_facteur"
  FOR EACH ROW
  EXECUTE FUNCTION "second_facteur_escalade"();

COMMENT ON FUNCTION "second_facteur_escalade"() IS
  'Compte les verrouillages temporaires ENCHAÎNÉS et, au troisième, remplace la date d''expiration par la sentinelle. Distingue la purge d''un verrou expiré d''une connexion réussie par l''ANCIENNE ligne : les deux produisent la même nouvelle ligne, seule OLD.verrouille_jusqu_a les sépare.';
