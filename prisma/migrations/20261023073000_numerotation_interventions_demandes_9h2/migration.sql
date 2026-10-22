-- ════════════════════════════════════════════════════════════════════════════
-- 9H2-NUMEROTATION-INTERVENTIONS — CHAQUE INTERVENTION ET CHAQUE DEMANDE REÇOIT
-- UN VRAI NUMÉRO À LA CRÉATION (D135, décision d'Alexis du 21/10/2026)
-- ════════════════════════════════════════════════════════════════════════════
--
-- L'audit du 21/10 (`docs/audits/9F6/`) a mesuré que `intervention.numero` et
-- `demande.numero` existaient déjà, NUL, « en attendant la synchronisation » —
-- et que personne n'écrit ce chemin. L'écran affiche donc toujours
-- `Local-<6 caractères de l'UUID>`. D135 tranche : un vrai numéro avant
-- l'usage réel, attribué par le SERVEUR, à la CRÉATION, dans la même
-- transaction — ce lot le pose.
--
-- ── POURQUOI UNE COLONNE `annee`, PLUTÔT QUE L'ENCODER DANS `numero` ───────
--
-- Le ticket pose le choix et demande qu'il soit écrit
-- (`docs/decisions/2026-10-23-numerotation-annuelle.md`) : la numérotation
-- REPART À 1 CHAQUE ANNÉE CIVILE, et `@@unique([societe_id, numero])` seul ne
-- distingue plus deux lignes d'années différentes portant le même numéro.
--
-- Encoder l'année DANS `numero` (ex. 20260452) aurait évité cette colonne,
-- mais aurait cassé la recherche par numéro SEUL : le registre et la
-- recherche globale (`lib/interventions/depot.ts`, `numeroDeReference`)
-- comparent `numero` par ÉGALITÉ, jamais par `contains` ; une recherche sur
-- « 452 » n'aurait alors trouvé AUCUNE ligne, le stack imposé interdisant le
-- SQL brut (donc le modulo) hors migrations et politiques RLS (CLAUDE.md
-- §2). Une colonne `annee` séparée garde `numero` petit, cherchable seul par
-- égalité exactement comme avant, et la paire (`annee`, `numero`) reconstruit
-- `INT-AAAA-NNNN` sans aucun calcul.
--
-- ── LE RATTRAPAGE — DANS L'ORDRE DE CRÉATION, PAR SOCIÉTÉ ET PAR ANNÉE ─────
--
-- L'année retenue est celle de `cree_le`, AU FUSEAU DE NOUMÉA (UTC+11, sans
-- heure d'été, §1) : une ligne créée le 31/12 à 23 h locale ne doit pas
-- migrer vers le compteur de l'année suivante parce que `cree_le` est en UTC.
-- `ROW_NUMBER()` fixe le rang dans cet ordre ; le compteur est ensuite semé au
-- rang maximal observé par (société, année), pour que la PROCHAINE création
-- continue sans jamais rejouer un numéro déjà donné par ce rattrapage.
-- ════════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- LE COMPTEUR — une ligne par (société, nature, année)
-- ───────────────────────────────────────────────────────────────────────────

CREATE TYPE "NatureNumerotation" AS ENUM ('intervention', 'demande');

CREATE TABLE "compteur_numerotation" (
  "societe_id"      uuid                 NOT NULL,
  "nature"          "NatureNumerotation" NOT NULL,
  "annee"           integer              NOT NULL,
  "dernier_numero"  integer              NOT NULL DEFAULT 0,
  "modifie_le"      timestamptz(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "compteur_numerotation_pkey" PRIMARY KEY ("societe_id", "nature", "annee")
);

ALTER TABLE "compteur_numerotation"
  ADD CONSTRAINT "compteur_numerotation_societe_id_fkey"
    FOREIGN KEY ("societe_id") REFERENCES "societe"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ───────────────────────────────────────────────────────────────────────────
-- LE CLOISONNEMENT — forme GÉNÉRALE (D42)
-- ───────────────────────────────────────────────────────────────────────────
--
-- Société SEULE, sans `app.client_id` ni `app.perimetre_sites` : ce n'est pas
-- une donnée de parc, et un compte de portail qui dépose une demande (P5,
-- chapitre 9) doit pouvoir faire avancer CE compteur dans la même transaction
-- que son dépôt, alors même qu'il porte `app.client_id` — la forme « interne »
-- (D94), qui EXCLUT ce cas, serait fausse ici.
--
-- TROIS politiques, une par verbe utile — jamais de `DELETE` : un compteur
-- supprimé repartirait de zéro à la prochaine création et REJOUERAIT un
-- numéro déjà attribué par le rattrapage ou par une création antérieure.
-- Refusé DEUX FOIS plutôt qu'une (même doctrine que `segment_travail`,
-- D94) : aucune politique de suppression, ET le privilège retiré.

ALTER TABLE "compteur_numerotation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "compteur_numerotation" FORCE ROW LEVEL SECURITY;

CREATE POLICY "cloisonnement_societe_lecture" ON "compteur_numerotation"
  FOR SELECT
  USING ("societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid);

CREATE POLICY "cloisonnement_societe_ajout" ON "compteur_numerotation"
  FOR INSERT
  WITH CHECK ("societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid);

CREATE POLICY "cloisonnement_societe_modification" ON "compteur_numerotation"
  FOR UPDATE
  USING ("societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid)
  WITH CHECK ("societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE ON "compteur_numerotation" TO "codiplan_app";
REVOKE DELETE, TRUNCATE ON "compteur_numerotation" FROM "codiplan_app";

-- ───────────────────────────────────────────────────────────────────────────
-- L'AUDIT (I8, D55) — le périmètre est inversé : une table qui décide du
-- numéro remis au client le mérite sans qu'on ait à plaider.
-- ───────────────────────────────────────────────────────────────────────────

CREATE TRIGGER "journal_audit" AFTER INSERT OR UPDATE OR DELETE ON "compteur_numerotation"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

COMMENT ON TABLE "compteur_numerotation" IS
  'LE COMPTEUR DE NUMÉROTATION (9H2-NUMEROTATION-INTERVENTIONS, D135) — une ligne par (société, nature, année), incrémentée dans la MÊME transaction que la création qui consomme le numéro qu''elle rend. Table métier de la première catégorie de I1, forme GÉNÉRALE (D42) : société seule, comme temps_trajet_zone — un compte de portail qui dépose une demande doit pouvoir la faire avancer. AUCUNE politique ni privilège de suppression : une ligne supprimée repartirait de zéro et rejouerait un numéro déjà attribué.';

-- ───────────────────────────────────────────────────────────────────────────
-- LES DEUX COLONNES `annee`, ADDITIVES — NULLABLES comme `numero`
-- ───────────────────────────────────────────────────────────────────────────

ALTER TABLE "intervention" ADD COLUMN "annee" integer;
ALTER TABLE "demande" ADD COLUMN "annee" integer;

-- ───────────────────────────────────────────────────────────────────────────
-- LE RATTRAPAGE DES LIGNES EXISTANTES — avant de resserrer l'unicité
-- ───────────────────────────────────────────────────────────────────────────

WITH "classees" AS (
  SELECT
    "id",
    EXTRACT(YEAR FROM ("cree_le" AT TIME ZONE 'Pacific/Noumea'))::integer AS "annee_calculee",
    ROW_NUMBER() OVER (
      PARTITION BY "societe_id", EXTRACT(YEAR FROM ("cree_le" AT TIME ZONE 'Pacific/Noumea'))
      ORDER BY "cree_le", "id"
    ) AS "rang"
  FROM "intervention"
  WHERE "numero" IS NULL
)
UPDATE "intervention" "i"
   SET "annee" = "c"."annee_calculee",
       "numero" = "c"."rang"
  FROM "classees" "c"
 WHERE "i"."id" = "c"."id";

WITH "classees" AS (
  SELECT
    "id",
    EXTRACT(YEAR FROM ("cree_le" AT TIME ZONE 'Pacific/Noumea'))::integer AS "annee_calculee",
    ROW_NUMBER() OVER (
      PARTITION BY "societe_id", EXTRACT(YEAR FROM ("cree_le" AT TIME ZONE 'Pacific/Noumea'))
      ORDER BY "cree_le", "id"
    ) AS "rang"
  FROM "demande"
  WHERE "numero" IS NULL
)
UPDATE "demande" "d"
   SET "annee" = "c"."annee_calculee",
       "numero" = "c"."rang"
  FROM "classees" "c"
 WHERE "d"."id" = "c"."id";

-- LE COMPTEUR EST SEMÉ au rang maximal que le rattrapage a posé, pour que la
-- PROCHAINE création continue sans jamais rejouer un de ces numéros.

INSERT INTO "compteur_numerotation" ("societe_id", "nature", "annee", "dernier_numero")
SELECT "societe_id", 'intervention'::"NatureNumerotation", "annee", MAX("numero")
  FROM "intervention"
 WHERE "numero" IS NOT NULL
 GROUP BY "societe_id", "annee";

INSERT INTO "compteur_numerotation" ("societe_id", "nature", "annee", "dernier_numero")
SELECT "societe_id", 'demande'::"NatureNumerotation", "annee", MAX("numero")
  FROM "demande"
 WHERE "numero" IS NOT NULL
 GROUP BY "societe_id", "annee";

-- ───────────────────────────────────────────────────────────────────────────
-- L'UNICITÉ RESSERRÉE — (société, année, numéro), et non plus (société,
-- numéro) seul : le rattrapage ci-dessus vient de poser le même `numero` sur
-- des lignes d'années différentes d'une même société, ce que l'ancien index
-- aurait refusé.
-- ───────────────────────────────────────────────────────────────────────────

DROP INDEX "intervention_societe_id_numero_key";
CREATE UNIQUE INDEX "intervention_societe_id_annee_numero_key"
  ON "intervention" ("societe_id", "annee", "numero");

DROP INDEX "demande_societe_id_numero_key";
CREATE UNIQUE INDEX "demande_societe_id_annee_numero_key"
  ON "demande" ("societe_id", "annee", "numero");

COMMENT ON COLUMN "intervention"."numero" IS
  'Attribué par le SERVEUR, à la création, dans la MÊME transaction (9H2-NUMEROTATION-INTERVENTIONS, D135). Repart à 1 chaque année civile (fuseau de Nouméa) — annee porte la seconde moitié de la clé, dans intervention_societe_id_annee_numero_key.';

COMMENT ON COLUMN "intervention"."annee" IS
  'L''année civile de la numérotation, au fuseau de Nouméa — posée EN MÊME TEMPS que numero, jamais recalculée après coup (même famille que depose_le/compteur_accuse_le sur Demande, D85).';

COMMENT ON COLUMN "demande"."numero" IS
  'Attribué par le SERVEUR, à la création, dans la MÊME transaction (9H2-NUMEROTATION-INTERVENTIONS, D135). Même régime qu''intervention.numero.';

COMMENT ON COLUMN "demande"."annee" IS
  'Même régime qu''intervention.annee — voir son commentaire.';
