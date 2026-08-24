-- CODIPLAN — Le territoire d'un jour férié référencé
-- (ticket L0-09a ; invariant I7 ; arbitrages D46 et D48).
--
-- ── LE TROU QUE CETTE MIGRATION FERME ──────────────────────────────────────
-- Depuis L0-08, `calendrier_ferie` référence le fait public par la clé
-- composite `(jour_ferie_id, date)`. Elle empêche les DATES de diverger, pas
-- les TERRITOIRES : une agence de territoire `NC` pouvait écrire un écart dont
-- le `jour_ferie_id` désignait un férié `FR` tombant le même jour — le
-- 1ᵉʳ novembre, par exemple. Le comportement restait juste, `appliquerEcarts`
-- composant par date ; c'est `jour_ferie_id` qui cessait d'être fiable comme
-- « le fait public que cet écart surcharge ».
--
-- D48 tranche : on ferme en base, par CHAÎNAGE DE CLÉS, et non par un contrôle
-- applicatif. Même mécanique que celle qui empêche déjà les dates de diverger —
-- c'est PostgreSQL qui refuse, et aucun chemin d'écriture n'y échappe.
--
--   `(agence_id, territoire)`              → `agence(id, territoire)`
--   `(jour_ferie_id, date, territoire)`    → `jour_ferie(id, date, territoire)`
--
-- Les deux chaînes partagent la colonne `territoire` de l'écart : l'agence la
-- fixe, le fait public doit s'y conformer. Un écart adossé au férié d'un autre
-- territoire ne peut plus être écrit.
--
-- ── LA CONSÉQUENCE À ASSUMER, ET C'EST LE CŒUR DU TICKET ───────────────────
-- Une clé étrangère dont une colonne vaut NULL n'est PAS contrôlée en
-- PostgreSQL (`MATCH SIMPLE`, la règle par défaut). Le chaînage serait donc
-- muet exactement là où la donnée manque. `agence.territoire` devient
-- OBLIGATOIRE.
--
-- Elle avait été posée nullable à bon droit en L0-08 : il n'existe aucun défaut
-- légitime, et un `DEFAULT 'NC'` aurait été un territoire codé en dur. Mais la
-- colonne est désormais renseignée partout, et le coût de la rendre obligatoire
-- ne sera jamais plus bas qu'aujourd'hui — deux sociétés, quatre agences,
-- uniquement des données de démonstration. Une colonne nullable posée « faute
-- de défaut légitime » devient obligatoire au moment où une contrainte s'appuie
-- dessus ; ce moment est le bon, pas plus tard.
--
-- Ce que le NULL reste, en revanche : `jour_ferie_id` est nullable, et c'est le
-- PONT — un jour ordinaire que l'agence chôme, sans aucun fait public en face.
-- `MATCH SIMPLE` le laisse passer, et c'est précisément l'usage qu'on veut
-- garder.
--
-- ── CETTE MIGRATION S'AJOUTE, ELLE NE RÉÉCRIT RIEN ─────────────────────────
-- La migration 20260821120000 a touché une base réelle : elle est immuable
-- (CLAUDE.md §7). Tout se fait ici, et les préalables ÉCHOUENT bruyamment
-- plutôt que d'inventer une valeur.
--
-- Si un préalable refuse, rien n'a été écrit — la transaction de Prisma retombe
-- entière. Prisma marque en revanche la migration comme échouée : après avoir
-- corrigé la donnée, la reprise passe par
-- `prisma migrate resolve --rolled-back 20260823130000_territoire_du_ferie_reference`
-- puis `prisma migrate deploy`. Les deux refus ont été éprouvés sur une base
-- réelle, données fautives comprises ; voir
-- docs/decisions/2026-08-23-territoire-du-ferie-reference.md.

-- ── 1. Préalable : aucune agence ne peut rester sans territoire ────────────
-- La migration REFUSE de s'appliquer plutôt que de combler le vide. Le
-- territoire d'une agence est une donnée d'exploitation ; il n'existe aucune
-- valeur par défaut qui ne soit pas un mensonge, et le `SET NOT NULL`
-- ci-dessous échouerait de toute façon — mais sur un message qui ne dirait pas
-- QUELLE agence, ni quoi en faire.

DO $$
DECLARE
  fautives TEXT;
BEGIN
  SELECT string_agg(format('%s (société %s)', a."code", s."code"), ', ' ORDER BY a."code")
    INTO fautives
    FROM "agence" a
    JOIN "societe" s ON s."id" = a."societe_id"
   WHERE a."territoire" IS NULL;

  IF fautives IS NOT NULL THEN
    RAISE EXCEPTION
      'Migration refusée : % agence(s) sans territoire — %. Le territoire est un code ISO 3166-1 alpha-2 (NC, FR), indépendant du fuseau (D46) : il se renseigne, il ne se déduit pas. Le poser AVANT de rejouer cette migration.',
      (SELECT count(*) FROM "agence" WHERE "territoire" IS NULL), fautives;
  END IF;
END
$$;

ALTER TABLE "agence" ALTER COLUMN "territoire" SET NOT NULL;

COMMENT ON COLUMN "agence"."territoire" IS
  'Territoire au sens des jours fériés, ISO 3166-1 alpha-2 (NC, FR). OBLIGATOIRE depuis L0-09a (D48) : le chaînage de calendrier_ferie s''appuie dessus, et une clé étrangère dont une colonne vaut NULL n''est pas contrôlée. Indépendant de fuseau_horaire, et jamais déduit de lui (D46).';

-- Le contrôle de forme perd sa branche `IS NULL` : elle est désormais morte, et
-- une contrainte qui décrit un cas impossible se relit mal. Même nom, pour que
-- les messages d'échec restent les mêmes.
ALTER TABLE "agence" DROP CONSTRAINT "agence_territoire_iso_alpha2";
ALTER TABLE "agence"
  ADD CONSTRAINT "agence_territoire_iso_alpha2"
  CHECK ("territoire" ~ '^[A-Z]{2}$');

-- ── 2. Les cibles du chaînage ──────────────────────────────────────────────
-- `id` étant déjà clé primaire de l'une et de l'autre, ces index n'ajoutent
-- aucune unicité : ils rendent le couple et le triplet RÉFÉRENÇABLES. C'est la
-- même mécanique que `jour_ferie(id, date)` posée en L0-08 — élargie d'une
-- colonne, parce que la date ne divergeait plus mais le territoire le pouvait.

CREATE UNIQUE INDEX "agence_id_territoire_key" ON "agence"("id", "territoire");
CREATE UNIQUE INDEX "jour_ferie_id_date_territoire_key"
  ON "jour_ferie"("id", "date", "territoire");

-- ── 3. Le territoire porté par l'écart — une redondance ASSUMÉE ────────────
-- Elle n'existe que pour rendre le chaînage déclaratif : sans colonne portée
-- par la ligne, aucune clé étrangère ne peut relier en un seul geste l'agence
-- et le fait public, et la règle retomberait dans un contrôle applicatif —
-- c'est-à-dire dans un chemin d'écriture qu'on peut oublier. Une redondance qui
-- rend une contrainte déclarative n'est pas une duplication de données : c'est
-- le prix du verrou, et il se dit.
--
-- Elle n'est jamais saisie : elle vient de l'agence, et les deux clés
-- étrangères la tiennent des deux côtés à la fois.

ALTER TABLE "calendrier_ferie" ADD COLUMN "territoire" TEXT;

COMMENT ON COLUMN "calendrier_ferie"."territoire" IS
  'Territoire de l''agence, recopié (D48). Redondance assumée : elle rend le chaînage déclaratif — (agence_id, territoire) vers agence, (jour_ferie_id, date, territoire) vers jour_ferie. Jamais saisie.';

-- Reprise des lignes existantes depuis leur agence. `territoire` y est
-- désormais NOT NULL : aucune ligne ne peut rester vide.
UPDATE "calendrier_ferie" cf
   SET "territoire" = a."territoire"
  FROM "agence" a
 WHERE a."id" = cf."agence_id";

ALTER TABLE "calendrier_ferie" ALTER COLUMN "territoire" SET NOT NULL;

-- ── 4. Préalable : aucun écart déjà adossé au férié d'un AUTRE territoire ──
-- C'est le défaut lui-même, s'il s'est déjà produit. La clé étrangère du
-- point 5 le refuserait, mais sur un message qui ne nommerait ni l'agence ni la
-- date. On le dit ici, et on refuse — jamais de correction silencieuse : un
-- écart mal adossé est une donnée d'exploitation, et c'est l'exploitant qui
-- décide s'il visait le bon férié ou s'il voulait un pont.

DO $$
DECLARE
  fautifs TEXT;
BEGIN
  SELECT string_agg(
           format('agence %s le %s (férié %s du territoire %s, agence en %s)',
                  a."code", cf."date", jf."libelle", jf."territoire", a."territoire"),
           ', ' ORDER BY cf."date")
    INTO fautifs
    FROM "calendrier_ferie" cf
    JOIN "agence" a ON a."id" = cf."agence_id"
    JOIN "jour_ferie" jf ON jf."id" = cf."jour_ferie_id"
   WHERE jf."territoire" <> a."territoire";

  IF fautifs IS NOT NULL THEN
    RAISE EXCEPTION
      'Migration refusée : écart(s) local(aux) adossé(s) au férié d''un AUTRE territoire — %. Un écart surcharge le fait public de SON territoire (D46) : corriger le jour_ferie_id visé, ou en faire un pont (jour_ferie_id à NULL), puis rejouer.',
      fautifs;
  END IF;
END
$$;

-- ── 5. Le chaînage ─────────────────────────────────────────────────────────
-- Les deux clés étrangères de L0-08 sont REMPLACÉES par leurs formes
-- chaînées : la même contrainte, une colonne de plus. L'index sur `agence_id`
-- reste utile — il porte la colonne de tête du nouveau couple.

ALTER TABLE "calendrier_ferie" DROP CONSTRAINT "calendrier_ferie_agence_id_fkey";
ALTER TABLE "calendrier_ferie" DROP CONSTRAINT "calendrier_ferie_jour_ferie_id_date_fkey";

-- L'ancienne cible `(id, date)` n'est plus référencée par rien : le triplet la
-- remplace. Un index d'unicité que plus aucune clé étrangère ne vise coûte une
-- écriture à chaque ligne et laisse croire à une garantie qui a déménagé.
DROP INDEX "jour_ferie_id_date_key";

-- ── AUCUNE PROPAGATION : `ON UPDATE RESTRICT` des deux côtés (D49) ────────
-- C'est la question que le chaînage soulève : que se passe-t-il si le
-- territoire d'une agence change ? Cas réel — une faute de saisie corrigée
-- trois semaines plus tard.
--
-- `ON UPDATE CASCADE` a été essayé, et mesuré : sur une agence dont les écarts
-- sont tous des PONTS, la correction réécrit leurs territoires en silence,
-- `UPDATE 1`, sans un mot. Sur une agence qui travaille un férié, elle échoue —
-- mais en désignant `jour_ferie`, c'est-à-dire pas le vrai problème. Une même
-- correction qui passe ou casse selon le contenu du calendrier, et qui ne dit
-- jamais ce qu'elle a fait : c'est le pire des deux comportements.
--
-- Un changement de territoire INVALIDE réellement les écarts de l'agence : ils
-- désignent les fériés d'ailleurs. Le refus de PostgreSQL est donc le bon
-- comportement — mieux vaut bloquer et forcer une décision humaine que laisser
-- une correction anodine réécrire un calendrier en silence.
--
-- La procédure est écrite dans
-- docs/decisions/2026-08-24-territoire-agence-sans-propagation.md, et le
-- déclencheur du point 6 la rappelle dans le message d'erreur.

-- Le couple : l'écart appartient à une agence, et il en porte le territoire.
-- Aucune de ses deux colonnes n'est nullable, la clé est donc contrôlée
-- TOUJOURS. `ON DELETE CASCADE` est conservé — supprimer une agence emporte ses
-- écarts, qui n'ont aucun sens sans elle.
ALTER TABLE "calendrier_ferie" ADD CONSTRAINT "calendrier_ferie_agence_id_territoire_fkey"
  FOREIGN KEY ("agence_id", "territoire") REFERENCES "agence"("id", "territoire")
  ON DELETE CASCADE ON UPDATE RESTRICT;

-- Le triplet : le fait public surchargé, s'il y en a un. `jour_ferie_id` nul —
-- le PONT — rend la clé non contrôlée (`MATCH SIMPLE`), et c'est l'usage qu'on
-- veut garder. Renseigné, il ne peut désigner qu'un férié de MÊME date ET de
-- MÊME territoire que l'écart, donc du territoire de l'agence.
--
-- `ON UPDATE RESTRICT` ici aussi, et pour la même raison : corriger la date ou
-- le territoire d'un fait public ne doit pas réécrire en silence l'écart d'une
-- agence. Le référentiel est écrit par l'éditeur, l'écart appartient à la
-- société : l'un ne modifie pas l'autre sans que quelqu'un le décide.
ALTER TABLE "calendrier_ferie" ADD CONSTRAINT "calendrier_ferie_jour_ferie_id_date_territoire_fkey"
  FOREIGN KEY ("jour_ferie_id", "date", "territoire")
  REFERENCES "jour_ferie"("id", "date", "territoire")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ── 6. Le message, à côté du verrou — et jamais à sa place (D49) ───────────
-- `ON UPDATE RESTRICT` refuse, mais son message parle de clés : « update or
-- delete on table "agence" violates foreign key constraint ... is still
-- referenced ». Il dit que c'est interdit, pas quoi faire. Ce déclencheur
-- s'exécute AVANT le contrôle de la clé et lève le premier, avec le décompte
-- des écarts, leurs dates extrêmes et la marche à suivre.
--
-- **Il ne remplace pas la clé, il la double.** Retiré, la clé refuse encore —
-- avec le message générique. C'est l'ordre voulu : le verrou est déclaratif, le
-- déclencheur n'est qu'une voix. Un test éprouve les deux séparément.
--
-- `SECURITY INVOKER` (le défaut) : le décompte passe donc par les politiques de
-- cloisonnement, comme toute lecture applicative. Si elles masquaient les
-- écarts, le décompte vaudrait zéro et le déclencheur laisserait passer — la
-- clé étrangère, elle, contrôle l'intégrité hors RLS et refuserait quand même.
-- Le pire cas est donc un message générique, jamais une écriture acceptée.

CREATE FUNCTION "agence_territoire_verrou_ecarts"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  nombre BIGINT;
  premiere DATE;
  derniere DATE;
BEGIN
  -- Une écriture qui ne change pas le territoire n'est pas concernée : le seed
  -- réécrit ses agences à chaque exécution, et il doit rester idempotent.
  IF NEW."territoire" IS NOT DISTINCT FROM OLD."territoire" THEN
    RETURN NEW;
  END IF;

  -- Un code MAL FORMÉ n'est pas l'affaire de ce déclencheur : c'est une autre
  -- faute, et elle a déjà sa contrainte et son message
  -- (`agence_territoire_iso_alpha2`). Sans ce passe-droit, un déclencheur
  -- `BEFORE` lèverait le premier et répondrait « écarts subsistants » à
  -- quelqu'un qui vient d'écrire « NOUVELLE_CALEDONIE » — un message juste sur
  -- une question qu'on ne pose pas. On laisse donc filer vers le contrôle de
  -- forme, qui refusera de toute façon.
  IF NEW."territoire" !~ '^[A-Z]{2}$' THEN
    RETURN NEW;
  END IF;

  SELECT count(*), min("date"), max("date")
    INTO nombre, premiere, derniere
    FROM "calendrier_ferie"
   WHERE "agence_id" = OLD."id";

  IF nombre > 0 THEN
    RAISE EXCEPTION
      'Territoire de l''agence % : changement % → % refusé. % écart(s) de calendrier subsistent (du % au %) et désignent les fériés de %. Un changement de territoire les invalide. Marche à suivre : traiter d''abord les écarts de cette agence — supprimer les ponts qui n''ont plus lieu d''être, et réadosser chaque férié travaillé au fait public du NOUVEAU territoire — puis changer le territoire. Voir docs/decisions/2026-08-24-territoire-agence-sans-propagation.md.',
      OLD."code", OLD."territoire", NEW."territoire", nombre, premiere, derniere,
      OLD."territoire";
  END IF;

  RETURN NEW;
END
$$;

COMMENT ON FUNCTION "agence_territoire_verrou_ecarts"() IS
  'Message actionnable devant le refus de ON UPDATE RESTRICT (D49). Double la clé étrangère, ne la remplace pas : retiré, la clé refuse encore.';

CREATE TRIGGER "agence_territoire_verrou_ecarts"
  BEFORE UPDATE ON "agence"
  FOR EACH ROW
  EXECUTE FUNCTION "agence_territoire_verrou_ecarts"();
