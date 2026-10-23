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

-- La clé TECHNIQUE est "id", seule, NON l'ancienne clé composite : le
-- déclencheur d'audit générique (`journal_audit_tracer`, I8) désigne toute
-- ligne journalisée par sa colonne "id" — mesuré, une table qui ne l'expose
-- pas lève `journal_audit : la table « … » n'expose aucune colonne « id »`.
-- La clé NATURELLE (societe_id, nature, annee) reste l'unicité que
-- `prochainNumero` lit et écrit, portée par l'index ci-dessous.
CREATE TABLE "compteur_numerotation" (
  "id"              uuid                 NOT NULL,
  "societe_id"      uuid                 NOT NULL,
  "nature"          "NatureNumerotation" NOT NULL,
  "annee"           integer              NOT NULL,
  "dernier_numero"  integer              NOT NULL DEFAULT 0,
  "modifie_le"      timestamptz(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "compteur_numerotation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "compteur_numerotation_societe_id_nature_annee_key"
  ON "compteur_numerotation" ("societe_id", "nature", "annee");

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
-- UNE SEULE politique, sans clause `FOR`, couvrant les QUATRE verbes — même
-- forme que `temps_trajet_zone` (R3-03) : la première catégorie de I1, forme
-- « société », les couvre toutes les quatre (mesuré par
-- `tests/isolation/politiques-rls.test.ts`). `WITH CHECK` est écrit même
-- s'il répète le `USING` (L1-02c).

ALTER TABLE "compteur_numerotation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "compteur_numerotation" FORCE ROW LEVEL SECURITY;

CREATE POLICY "cloisonnement_societe" ON "compteur_numerotation"
  USING ("societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid)
  WITH CHECK ("societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "compteur_numerotation" TO "codiplan_app";

-- ───────────────────────────────────────────────────────────────────────────
-- L'AUDIT (I8, D55) — le périmètre est inversé : une table qui décide du
-- numéro remis au client le mérite sans qu'on ait à plaider.
-- ───────────────────────────────────────────────────────────────────────────

CREATE TRIGGER "journal_audit" AFTER INSERT OR UPDATE OR DELETE ON "compteur_numerotation"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

COMMENT ON TABLE "compteur_numerotation" IS
  'LE COMPTEUR DE NUMÉROTATION (9H2-NUMEROTATION-INTERVENTIONS, D135) — une ligne par (société, nature, année), incrémentée dans la MÊME transaction que la création qui consomme le numéro qu''elle rend. Table métier de la première catégorie de I1, forme GÉNÉRALE (D42) : société seule, comme temps_trajet_zone — un compte de portail qui dépose une demande doit pouvoir la faire avancer. ATTENTION À LA SUPPRESSION, bien qu''elle ne soit pas bloquée techniquement (forme « société », quatre verbes) : une ligne supprimée repartirait de zéro et REJOUERAIT un numéro déjà attribué par le rattrapage ou par une création antérieure.';

-- ───────────────────────────────────────────────────────────────────────────
-- LES DEUX COLONNES `annee`, ADDITIVES — NULLABLES comme `numero`
-- ───────────────────────────────────────────────────────────────────────────

ALTER TABLE "intervention" ADD COLUMN "annee" integer;
ALTER TABLE "demande" ADD COLUMN "annee" integer;

-- ───────────────────────────────────────────────────────────────────────────
-- LE RATTRAPAGE DES LIGNES EXISTANTES — avant de resserrer l'unicité
-- ───────────────────────────────────────────────────────────────────────────
--
-- `intervention_cycle_de_vie` (BEFORE UPDATE FOR EACH ROW, sans liste de
-- colonnes) refuse toute modification d'une ligne `OLD.statut IN ('cloturee',
-- 'annulee')`, QUE LE STATUT CHANGE OU NON — à la différence de
-- `demande_cycle_de_vie`, qui laisse passer une écriture qui ne touche pas le
-- statut (20260913140000_demande_l2_06). Le rattrapage ci-dessous écrit
-- "numero"/"annee" sur TOUTE ligne sans numéro, close ou non ; le déclencheur
-- est donc suspendu pour sa seule durée et rétabli avant la fin de cette
-- transaction — même motif que 20261022210000_rapport_valide_avant_cloture.
-- `pas_sur_blocage_agenda` (AFTER INSERT OR UPDATE, sans liste de colonnes)
-- se déclencherait aussi sur ce même `UPDATE` ; il est suspendu avec lui.
--
-- **ET LE RÔLE DE MIGRATION EST PROPRIÉTAIRE, DONC SOUMIS À `FORCE`** — même
-- défaut que R3-02 et que le rattrapage de RG-INT-03 (§9, 07/09,
-- `scripts/lib/gardes-migration.ts`). Sans contexte société posé, il ne
-- verrait AUCUNE ligne d'`intervention` ni de `demande` : les deux `UPDATE`
-- ci-dessous ne toucheraient rien tout en paraissant numéroter. `compteur_
-- numerotation`, créée plus haut DANS CETTE MÊME migration, est déjà FORCÉE :
-- l'`INSERT` qui la sème plus bas échouerait (violation de sa politique
-- `WITH CHECK`) sans la même levée. Et `journal_audit` — lu en écriture par le
-- déclencheur d'audit posé sur CHACUNE des trois tables dès qu'une vraie
-- ligne est touchée — est FORCÉE elle aussi. Les QUATRE drapeaux sont donc
-- levés AVANT tout rattrapage, et la levée est CONSTATÉE — le témoin porte
-- sur le MÉCANISME, jamais sur un décompte, qu'un zéro légitime rendrait
-- muet. Rendus tous les quatre, et constatés rendus, une fois le compteur
-- semé plus bas.
ALTER TABLE "intervention" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "demande" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "compteur_numerotation" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "journal_audit" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "intervention" DISABLE TRIGGER "intervention_cycle_de_vie";
ALTER TABLE "intervention" DISABLE TRIGGER "pas_sur_blocage_agenda";

DO $$
DECLARE
  levee_intervention boolean;
  levee_demande boolean;
  levee_compteur boolean;
  levee_journal boolean;
BEGIN
  SELECT NOT relforcerowsecurity INTO levee_intervention
    FROM pg_class WHERE relname = 'intervention';
  IF NOT COALESCE(levee_intervention, false) THEN
    RAISE EXCEPTION
      'Le rattrapage de la numérotation ne peut pas s''exécuter : FORCE ROW LEVEL SECURITY est toujours actif sur « intervention », si bien que cette écriture verrait zéro ligne — elle ne numéroterait rien tout en paraissant le faire. Le rattrapage s''arrête plutôt que de passer à l''aveugle.';
  END IF;

  SELECT NOT relforcerowsecurity INTO levee_demande
    FROM pg_class WHERE relname = 'demande';
  IF NOT COALESCE(levee_demande, false) THEN
    RAISE EXCEPTION
      'Le rattrapage de la numérotation ne peut pas s''exécuter : FORCE ROW LEVEL SECURITY est toujours actif sur « demande », si bien que cette écriture verrait zéro ligne. Le rattrapage s''arrête plutôt que de passer à l''aveugle.';
  END IF;

  SELECT NOT relforcerowsecurity INTO levee_compteur
    FROM pg_class WHERE relname = 'compteur_numerotation';
  IF NOT COALESCE(levee_compteur, false) THEN
    RAISE EXCEPTION
      'Le rattrapage de la numérotation ne peut pas s''exécuter : FORCE ROW LEVEL SECURITY est toujours actif sur « compteur_numerotation », si bien que l''ensemencement du compteur plus bas échouerait dès qu''une vraie ligne serait insérée.';
  END IF;

  SELECT NOT relforcerowsecurity INTO levee_journal
    FROM pg_class WHERE relname = 'journal_audit';
  IF NOT COALESCE(levee_journal, false) THEN
    RAISE EXCEPTION
      'Le rattrapage de la numérotation ne peut pas s''exécuter : FORCE ROW LEVEL SECURITY est toujours actif sur « journal_audit », si bien que le déclencheur d''audit échouerait dès qu''une vraie ligne serait touchée, avortant tout le rattrapage.';
  END IF;
END
$$;

-- L'ANCIEN INDEX D'UNICITÉ, AVANT LE RATTRAPAGE — réserve forte de la revue de
-- 9H1C (même migration) : le rattrapage ci-dessous pose le même "numero" sur
-- des lignes d'années civiles différentes d'une même société (deux "rang" 1,
-- l'un pour 2025, l'autre pour 2026). Fait APRÈS l'UPDATE, `DROP INDEX`
-- arriverait trop tard : l'ancien index (societe_id, numero) SEUL aurait déjà
-- refusé la seconde ligne pendant l'UPDATE. Le nouvel index (societe_id,
-- annee, numero) le remplace plus bas, une fois les DEUX tables rattrapées.
DROP INDEX "intervention_societe_id_numero_key";

-- LES TROIS CONTRAINTES « NOT VALID » PORTÉES PAR "intervention" (D104,
-- `scripts/lib/contraintes-non-validees.ts`) — une contrainte NOT VALID vaut
-- pour toute ligne NOUVELLE OU MODIFIÉE, jamais relue pour les lignes
-- d'avant : le rattrapage ci-dessous MODIFIE (UPDATE) des lignes héritées qui
-- ne satisfont aucune des trois ("planifiee"/"affectee" sans durée,
-- "cloturee" sans statut de facturation, temps validé sans auteur ni date),
-- et les réveillerait sans cette levée temporaire — exactement l'erreur
-- E23514 mesurée en production le 24/10/2026. Retirées ici, reposées à
-- l'identique — même nom, même expression, NOT VALID, même commentaire —
-- juste après l'UPDATE : rien n'est validé, rien n'est assoupli pour les
-- lignes NOUVELLES, qui restent gouvernées dès la fin de cette migration.
ALTER TABLE "intervention" DROP CONSTRAINT "intervention_cloture_a_son_statut_facturation";
ALTER TABLE "intervention" DROP CONSTRAINT "intervention_validation_tracee";
ALTER TABLE "intervention" DROP CONSTRAINT "intervention_planifiee_a_sa_duree";

-- "intervention"."cree_le" est SANS FUSEAU (`timestamp`, et non `timestamptz`
-- comme sur "demande" juste plus bas — mesuré par `information_schema.
-- columns`, les deux tables n'ont jamais partagé le même type malgré le même
-- nom de colonne). Sa valeur naïve EST l'heure UTC (toute écriture s'y fait
-- sous une session en UTC) : `"cree_le" AT TIME ZONE 'Pacific/Noumea'` EN UN
-- SEUL PAS la traiterait à tort comme une heure LOCALE de Nouméa et la
-- convertirait VERS l'UTC — l'inverse de ce qu'il faut. Le premier
-- `AT TIME ZONE 'UTC'` la requalifie d'abord en instant réel (`timestamptz`) ;
-- le second `AT TIME ZONE 'Pacific/Noumea'` convertit alors CET instant vers
-- l'heure locale de Nouméa, et c'est SEULEMENT à partir de là que l'année
-- civile voulue par le commentaire d'en-tête se lit juste à la frontière du
-- 31 décembre.
WITH "classees" AS (
  SELECT
    "id",
    EXTRACT(YEAR FROM (("cree_le" AT TIME ZONE 'UTC') AT TIME ZONE 'Pacific/Noumea'))::integer AS "annee_calculee",
    ROW_NUMBER() OVER (
      PARTITION BY "societe_id", EXTRACT(YEAR FROM (("cree_le" AT TIME ZONE 'UTC') AT TIME ZONE 'Pacific/Noumea'))
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

-- LES TROIS CONTRAINTES, REPOSÉES À L'IDENTIQUE — reprises mot pour mot de la
-- migration qui les a posées (citées en commentaire) ; aucune n'est validée.
ALTER TABLE "intervention"
  ADD CONSTRAINT "intervention_cloture_a_son_statut_facturation"
  CHECK ("statut" <> 'cloturee' OR "statut_facturation" IS NOT NULL) NOT VALID;

COMMENT ON CONSTRAINT "intervention_cloture_a_son_statut_facturation" ON "intervention" IS
  'POSÉE « NOT VALID » (D104) : les interventions déjà clôturées n''ont pas de statut de facturation, et personne ne peut en énoncer un à leur place — « à facturer » les ferait entrer dans une file de facturation, « non facturable » renoncerait à un montant. L''état non validé est tenu par scripts/lib/contraintes-non-validees.ts et observé chaque nuit par « pnpm veille ».';

-- Reprise mot pour mot de 20260915060000_les_deux_temps_d120/migration.sql:78-81
-- (aucun COMMENT ON CONSTRAINT n'existait sur celle-ci : aucun n'est ajouté ici).
ALTER TABLE "intervention"
  ADD CONSTRAINT "intervention_validation_tracee" CHECK (
    ("temps_valide_par" IS NULL) = ("temps_valide_le" IS NULL)
  ) NOT VALID;

-- Reprise mot pour mot de 20260923130000_parcours_1_creer_puis_planifier/migration.sql:132-137
ALTER TABLE "intervention"
  ADD CONSTRAINT "intervention_planifiee_a_sa_duree" CHECK (
    "statut" NOT IN ('planifiee', 'affectee') OR "duree_estimee_min" IS NOT NULL
  ) NOT VALID;

COMMENT ON CONSTRAINT "intervention_planifiee_a_sa_duree" ON "intervention" IS
  'PARCOURS-1, arbitrage Alexis du 23/09/2026 : une intervention ne passe au statut planifiee/affectee sans sa duree prevue — les deux SEULS statuts contraints, mot pour mot ceux que l''arbitrage nomme. POSEE « NOT VALID » (D104) : des interventions deja planifiees portent une date et un technicien sans duree, ce champ etant facultatif avant ce lot, et personne ne peut inventer la duree qu''elles n''ont pas eue. L''etat non valide est tenu par scripts/lib/contraintes-non-validees.ts et observe chaque nuit par « pnpm veille ».';

-- LE TÉMOIN : les trois contraintes existent et sont bien NON VALIDÉES — une
-- transaction qui échouerait entre le DROP et le ADD laisserait la règle
-- absente sans qu'aucun message ne le dise ; une contrainte redevenue
-- validée par erreur (p. ex. un ADD sans NOT VALID) relirait les lignes
-- héritées et échouerait avant même d'atteindre ce DO, mais le témoin le dit
-- en clair plutôt que de laisser PostgreSQL seul porter le message.
DO $$
DECLARE
  etat record;
BEGIN
  FOR etat IN
    SELECT unnest(ARRAY[
      'intervention_cloture_a_son_statut_facturation',
      'intervention_validation_tracee',
      'intervention_planifiee_a_sa_duree'
    ]) AS "nom"
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      WHERE rel.relname = 'intervention' AND con.conname = etat."nom"
    ) THEN
      RAISE EXCEPTION
        'La contrainte « % » est absente sur « intervention » après le rattrapage de la numérotation : elle devait être reposée à l''identique, pas seulement retirée.', etat."nom";
    END IF;

    IF EXISTS (
      SELECT 1 FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      WHERE rel.relname = 'intervention' AND con.conname = etat."nom" AND con.convalidated
    ) THEN
      RAISE EXCEPTION
        'La contrainte « % » est VALIDÉE après le rattrapage de la numérotation : elle devait rester NOT VALID, aucune ligne héritée n''ayant été réparée par ce lot.', etat."nom";
    END IF;
  END LOOP;
END
$$;

ALTER TABLE "intervention" ENABLE TRIGGER "intervention_cycle_de_vie";
ALTER TABLE "intervention" ENABLE TRIGGER "pas_sur_blocage_agenda";

-- MÊME RÉSERVE QUE CI-DESSUS, POUR "demande" : aucune contrainte NOT VALID
-- n'y est portée (liste close de `scripts/lib/contraintes-non-validees.ts`),
-- seul l'ancien index d'unicité doit céder la place avant l'UPDATE.
DROP INDEX "demande_societe_id_numero_key";

-- ICI, UN SEUL `AT TIME ZONE` SUFFIT, ET C'EST VOULU : "demande"."cree_le"
-- EST `timestamptz` (contrairement à "intervention"."cree_le" ci-dessus) —
-- l'ajout du même `AT TIME ZONE 'UTC'` de tête serait FAUX sur une colonne
-- qui porte déjà son fuseau : il la ferait relire comme si elle était naïve.
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
--
-- Les drapeaux de `compteur_numerotation` et de `journal_audit` sont ENCORE
-- levés ici (voir plus haut) : sans quoi cet `INSERT` échouerait lui-même
-- contre la politique `WITH CHECK` de `compteur_numerotation` dès qu'une
-- vraie ligne serait écrite.

-- "id" vient de `gen_random_uuid()`, pas d'un UUID v7 : même motif que le
-- rattrapage d'`intervention_machine` (L2-08a) — cette ligne ne naît sur
-- aucun appareil et ne porte aucune relation ; seule compte l'unicité.
INSERT INTO "compteur_numerotation" ("id", "societe_id", "nature", "annee", "dernier_numero")
SELECT gen_random_uuid(), "societe_id", 'intervention'::"NatureNumerotation", "annee", MAX("numero")
  FROM "intervention"
 WHERE "numero" IS NOT NULL
 GROUP BY "societe_id", "annee";

INSERT INTO "compteur_numerotation" ("id", "societe_id", "nature", "annee", "dernier_numero")
SELECT gen_random_uuid(), "societe_id", 'demande'::"NatureNumerotation", "annee", MAX("numero")
  FROM "demande"
 WHERE "numero" IS NOT NULL
 GROUP BY "societe_id", "annee";

ALTER TABLE "intervention" FORCE ROW LEVEL SECURITY;
ALTER TABLE "demande" FORCE ROW LEVEL SECURITY;
ALTER TABLE "compteur_numerotation" FORCE ROW LEVEL SECURITY;
ALTER TABLE "journal_audit" FORCE ROW LEVEL SECURITY;

-- LE TÉMOIN FINAL : les quatre drapeaux sont bien revenus, pas seulement
-- demandés — une transaction qui échouerait entre l'`ALTER TABLE` et son
-- effet laisserait le cloisonnement ouvert sans qu'aucun message ne le dise.
DO $$
DECLARE
  rendu_intervention boolean;
  rendu_demande boolean;
  rendu_compteur boolean;
  rendu_journal boolean;
BEGIN
  SELECT relforcerowsecurity INTO rendu_intervention
    FROM pg_class WHERE relname = 'intervention';
  IF NOT COALESCE(rendu_intervention, false) THEN
    RAISE EXCEPTION
      'FORCE ROW LEVEL SECURITY n''a pas été rétabli sur « intervention » à la fin du rattrapage de la numérotation : le cloisonnement resterait ouvert au-delà de la transaction qui devait le refermer.';
  END IF;

  SELECT relforcerowsecurity INTO rendu_demande
    FROM pg_class WHERE relname = 'demande';
  IF NOT COALESCE(rendu_demande, false) THEN
    RAISE EXCEPTION
      'FORCE ROW LEVEL SECURITY n''a pas été rétabli sur « demande » à la fin du rattrapage de la numérotation.';
  END IF;

  SELECT relforcerowsecurity INTO rendu_compteur
    FROM pg_class WHERE relname = 'compteur_numerotation';
  IF NOT COALESCE(rendu_compteur, false) THEN
    RAISE EXCEPTION
      'FORCE ROW LEVEL SECURITY n''a pas été rétabli sur « compteur_numerotation » à la fin du rattrapage de la numérotation.';
  END IF;

  SELECT relforcerowsecurity INTO rendu_journal
    FROM pg_class WHERE relname = 'journal_audit';
  IF NOT COALESCE(rendu_journal, false) THEN
    RAISE EXCEPTION
      'FORCE ROW LEVEL SECURITY n''a pas été rétabli sur « journal_audit » à la fin du rattrapage de la numérotation.';
  END IF;
END
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- L'UNICITÉ RESSERRÉE — (société, année, numéro), et non plus (société,
-- numéro) seul : le rattrapage ci-dessus vient de poser le même `numero` sur
-- des lignes d'années différentes d'une même société, ce que l'ancien index
-- aurait refusé. Les deux anciens index sont déjà tombés AVANT leur UPDATE
-- respectif (réserve 9H1C) ; il ne reste qu'à poser les nouveaux.
-- ───────────────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX "intervention_societe_id_annee_numero_key"
  ON "intervention" ("societe_id", "annee", "numero");

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
