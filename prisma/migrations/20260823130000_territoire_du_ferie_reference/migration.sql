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

-- Le couple : l'écart appartient à une agence, et il en porte le territoire.
-- Aucune de ses deux colonnes n'est nullable, la clé est donc contrôlée
-- TOUJOURS. `ON UPDATE CASCADE` : si une agence change de territoire, ses ponts
-- suivent — et ses fériés travaillés font échouer la mise à jour, faute de fait
-- public correspondant sur le nouveau territoire. C'est le comportement voulu :
-- un déménagement d'agence se règle en reprenant ses écarts, pas en les
-- laissant pointer sur les fêtes d'ailleurs.
ALTER TABLE "calendrier_ferie" ADD CONSTRAINT "calendrier_ferie_agence_id_territoire_fkey"
  FOREIGN KEY ("agence_id", "territoire") REFERENCES "agence"("id", "territoire")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Le triplet : le fait public surchargé, s'il y en a un. `jour_ferie_id` nul —
-- le PONT — rend la clé non contrôlée (`MATCH SIMPLE`), et c'est l'usage qu'on
-- veut garder. Renseigné, il ne peut désigner qu'un férié de MÊME date ET de
-- MÊME territoire que l'écart, donc du territoire de l'agence.
ALTER TABLE "calendrier_ferie" ADD CONSTRAINT "calendrier_ferie_jour_ferie_id_date_territoire_fkey"
  FOREIGN KEY ("jour_ferie_id", "date", "territoire")
  REFERENCES "jour_ferie"("id", "date", "territoire")
  ON DELETE RESTRICT ON UPDATE CASCADE;
