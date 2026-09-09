-- D86 — LE FORFAIT PORTE UN RANG EXPLICITE.
--
-- « Le premier forfait applicable l'emporte » ne définissait pas « premier ».
-- La lecture ordonnait par `code`, c'est-à-dire par l'ALPHABET ; avant elle,
-- c'eût été l'ordre d'insertion, c'est-à-dire le PASSÉ. Dans les deux cas, deux
-- interventions identiques se factureraient différemment selon un fait sans
-- rapport avec le tarif. Un tarif qui dépend de cela ne se défend pas devant un
-- client.
--
-- Le rang est explicite, stocké, modifiable. LE PLUS PETIT L'EMPORTE.

ALTER TABLE "forfait" ADD COLUMN "rang" INTEGER;

-- ── Le rétro-remplissage, et pourquoi il lève FORCE ────────────────────────
-- `forfait` est cloisonnée et porte FORCE ROW LEVEL SECURITY, qui s'applique au
-- PROPRIÉTAIRE — donc à cette migration. Sans levée, l'UPDATE ci-dessous
-- toucherait ZÉRO ligne sur une table qui en porte, et le SET NOT NULL
-- échouerait plus bas en désignant une table qu'on croirait vide (CLAUDE.md
-- §9, 07/09). La levée est rendue dans la même transaction, et un TÉMOIN refuse
-- d'écrire tant qu'elle n'est pas constatée : il porte sur le MÉCANISME, jamais
-- sur un décompte — un décompte légitimement nul rendrait le témoin muet, et
-- c'est précisément le cas qu'on veut distinguer, le catalogue naissant VIDE.
ALTER TABLE "forfait" NO FORCE ROW LEVEL SECURITY;

DO $$
DECLARE force_encore BOOLEAN;
BEGIN
  SELECT c."relforcerowsecurity" INTO force_encore
    FROM "pg_class" c
    JOIN "pg_namespace" n ON n."oid" = c."relnamespace"
   WHERE c."relname" = 'forfait' AND n."nspname" = 'public';

  IF force_encore IS NULL THEN
    RAISE EXCEPTION 'La table forfait est introuvable : le rétro-remplissage du rang ne peut pas être constaté.';
  END IF;

  IF force_encore THEN
    RAISE EXCEPTION 'FORCE ROW LEVEL SECURITY est encore actif sur forfait : le rétro-remplissage du rang ne verrait aucune ligne et le SET NOT NULL échouerait sur une table qu''on croirait vide.';
  END IF;
END
$$;

-- L'ordre de rétro-remplissage est celui que le code appliquait jusqu'ici —
-- `code` croissant, par société et par nature. Ce n'est pas un choix de tarif :
-- c'est la conservation EXACTE du comportement d'avant, pour que la migration
-- ne change aucune facture. Le catalogue est vide aujourd'hui (aucun écrivain
-- n'existe dans le dépôt), donc cet UPDATE ne touche rien ; il est écrit pour
-- la base qui, un jour, ne le sera plus.
UPDATE "forfait" AS f
   SET "rang" = ordre."rang"
  FROM (
    SELECT "id",
           row_number() OVER (
             PARTITION BY "societe_id", "type" ORDER BY "code"
           )::int AS "rang"
      FROM "forfait"
  ) AS ordre
 WHERE f."id" = ordre."id";

ALTER TABLE "forfait" FORCE ROW LEVEL SECURITY;

ALTER TABLE "forfait" ALTER COLUMN "rang" SET NOT NULL;

-- ── L'ÉGALITÉ DE RANG EST UN ÉTAT INTERDIT, ET LA BASE LE REFUSE ───────────
-- Un contrôle qui se contenterait de SIGNALER laisserait partir la facture.
-- La clé porte le TYPE : un déplacement n'est jamais en concurrence avec une
-- prestation, et un rang unique sur tout le catalogue obligerait à renuméroter
-- des lignes sans rapport.
--
-- Ce que la base ne sait PAS refuser, et pourquoi on ne le lui demande pas :
-- « deux forfaits de même rang APPLICABLES AU MÊME CAS » est un recouvrement
-- sur trois axes où l'absence de condition vaut « toutes les valeurs ». Une
-- contrainte d'exclusion sur `zone_geo && zone_geo` dirait l'inverse — pour
-- PostgreSQL un tableau vide ne recouvre rien, alors qu'il signifie ici
-- « partout ». Une contrainte dont l'expression inverse le sens de sa colonne
-- est une contrainte que personne ne relit. L'unicité du rang par nature est
-- plus FORTE, totale et lisible : elle rend le cas litigieux IMPOSSIBLE au lieu
-- de le détecter.
CREATE UNIQUE INDEX "forfait_societe_id_type_rang_key"
  ON "forfait" ("societe_id", "type", "rang");

COMMENT ON COLUMN "forfait"."rang" IS
  'Ordre d''application quand plusieurs forfaits conviennent (D86). LE PLUS PETIT L''EMPORTE. Explicite, stocké, modifiable — jamais l''ordre d''insertion ni l''identifiant : deux interventions identiques se factureraient sinon différemment selon la minute d''une saisie passée. L''égalité de rang est refusée par forfait_societe_id_type_rang_key, sur (societe_id, type, rang) : le rang ne se compare qu''entre forfaits de MÊME NATURE.';
