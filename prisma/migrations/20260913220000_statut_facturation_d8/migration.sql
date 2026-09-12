-- ═══════════════════════════════════════════════════════════════════════════
-- D8 — `statut_facturation` : LE SECOND AXE, ET IL N'EXISTAIT NULLE PART
-- Décision du 19/08/2026, appliquée le 12/09/2026.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ## CE QUE D8 A TRANCHÉ
--
-- > **1. Séparation des deux axes.** Le statut d'avancement et le statut de
-- > facturation sont deux colonnes distinctes. La chaîne d'états s'arrête à
-- > `CLOTUREE` ; `A_FACTURER` et `FACTUREE` disparaissent de `statut` et vivent
-- > uniquement dans `statut_facturation`.
--
-- > **Facturation** : `statut_facturation` passe à `a_facturer`
-- > automatiquement à l'entrée en `CLOTUREE`, **sauf** si le type est
-- > `garantie`, `recensement` ou si l'intervention est couverte par un contrat
-- > forfaitaire — auquel cas `non_facturable`.
--
-- `statut` porte bien huit valeurs depuis L2-07, sans `A_FACTURER` ni
-- `FACTUREE` : **la première moitié de D8 était faite.** La seconde ne l'était
-- pas — `statut_facturation` n'apparaissait **nulle part** dans `prisma/`, ni
-- dans `lib/`. La colonne est au chapitre 11 depuis l'origine, avec ses trois
-- valeurs, et rien ne la portait.
--
-- ## LES TROIS VALEURS SONT CELLES DU CHAPITRE 11, MOT POUR MOT
--
--     non_facturable, a_facturer, facturee
--
-- Aucune n'est inventée, aucune n'est ajoutée. **Ajouter une quatrième valeur
-- serait un changement de schéma touchant les statuts d'intervention**, que le
-- §8 du CLAUDE.md range parmi les points d'arrêt.
--
-- ## ET LA COLONNE EST NULLABLE, CE QUI EST UNE DÉCISION
--
-- **D8 est MUETTE sur la naissance.** Elle dit quand la valeur devient
-- `a_facturer` ou `non_facturable` — à la clôture — et ne dit pas ce qu'elle
-- vaut avant. Or les trois valeurs disponibles ne portent pas « pas encore
-- décidé » :
--
--   — naître `a_facturer` ferait entrer **toute intervention non clôturée** dans
--     la file de ce qui est à facturer ;
--   — naître `non_facturable` confondrait **« pas encore »** et **« jamais »** —
--     et `non_facturable` est précisément la valeur que les exemptions visent.
--     *Une nouvelle ligne ne naît jamais sur la réponse négative* (doctrine
--     d'arbitrage, §3 ; c'est la leçon de `a_determiner` sur les VGP).
--
-- `NULL` dit **« la question ne s'est pas encore posée »**, et il la dit sans
-- toucher à l'énumération close. *Un `CHECK` interdit la clôture sans réponse* :
-- une intervention `cloturee` porte forcément l'une des trois valeurs.
--
-- **CONDITION DE RÉOUVERTURE, vérifiable** : *le jour où un écran doit
-- DISTINGUER « pas encore décidé » d'une valeur absente pour une autre raison*,
-- `NULL` ne suffit plus et une quatrième valeur devient due — et ce sera un
-- arbitrage, parce qu'elle touche l'énumération des statuts.
--
-- ## LA TROISIÈME EXEMPTION EST ÉCRITE ET INERTE, ET C'EST DIT
--
-- *« … ou si l'intervention est couverte par un contrat forfaitaire »*. **Il
-- n'existe aucune table `contrat`** — les contrats sont au lot 4, et
-- `intervention` ne porte pas de `contrat_id`. La règle est donc écrite
-- ENTIÈRE, avec sa troisième branche inerte, *pour n'avoir pas à la rouvrir ce
-- jour-là* — le même traitement que le troisième axe de `forfaits.ts`, inerte
-- faute de types d'intervention.
--
-- ## LE DÉCLENCHEUR PLUTÔT QUE LE CODE, et le motif est le même que partout
--
-- D8 dit **« automatiquement »**. Écrire la règle en TypeScript la laisserait
-- hors d'un `INSERT` ou d'un `UPDATE` direct, d'un import ou d'une reprise ; et l'écrire des
-- deux côtés serait **deux lectures d'un même critère** (§9, 01/09) — dans
-- l'endroit qui décide si un client est facturé.
--
-- **Le NOM décide de l'ordre.** PostgreSQL exécute les déclencheurs `BEFORE`
-- d'une même table dans l'ordre ALPHABÉTIQUE :
--
--     intervention_cycle_de_vie < intervention_facturation_a_la_cloture
--                               < intervention_sortie_de_suspension
--
-- Le cycle de vie prononce donc ses refus AVANT que cette valeur ne soit posée :
-- *une transition refusée ne doit jamais avoir déjà écrit quelque chose.*
--
-- ## « À L'ENTRÉE EN CLOTUREE » COMPREND LA NAISSANCE — mesuré, pas supposé
--
-- Le déclencheur a d'abord été écrit `BEFORE UPDATE` seul, et **`pnpm db:seed`
-- a échoué** :
--
--     new row for relation "intervention" violates check constraint
--     "intervention_cloture_a_son_statut_facturation"
--
-- *Une intervention peut NAÎTRE clôturée.* Le semis en pose ; une reprise
-- d'historique en posera par milliers — c'est même le cas ordinaire d'un import
-- (chapitre 8, « Interventions historiques »). Un `INSERT` ne passe par aucun
-- `UPDATE`, si bien que la valeur n'était jamais posée et que la contrainte
-- refusait **la ligne honnête**.
--
-- **La leçon est celle du §11 du protocole** : `pnpm verify` migre une base
-- VIDE, et c'est `verify:full` — qui sème — qui a vu. *Une porte qui ne garde
-- pas ce que garde la porte suivante produit des verts sincères et faux.*
--
-- Le déclencheur couvre donc `INSERT` **et** `UPDATE`, et `TG_OP` distingue les
-- deux : sur un `INSERT` il n'y a pas d'`OLD`, et lire `OLD."statut"` y lèverait.
--
-- ## IL NE REVIENT JAMAIS SUR UNE VALEUR DÉJÀ POSÉE
--
-- `facturee` est écrit par le retour de facturation (chapitre 11,
-- `reference_facture`), et une réouverture pour correction —
-- `TERMINEE → EN_COURS` puis une nouvelle clôture — **ne doit pas rendre à
-- facturer ce qui l'a déjà été.** Le déclencheur n'agit donc que si la colonne
-- est `NULL`.

CREATE TYPE "StatutFacturation" AS ENUM ('non_facturable', 'a_facturer', 'facturee');

COMMENT ON TYPE "StatutFacturation" IS
  'D8 — le SECOND axe de l''intervention, distinct de son avancement. Trois valeurs, celles du chapitre 11. NULL en porte une quatrième qui n''est pas dans l''énumération : « la question ne s''est pas encore posée ».';

ALTER TABLE "intervention"
  ADD COLUMN "statut_facturation" "StatutFacturation";

COMMENT ON COLUMN "intervention"."statut_facturation" IS
  'D8 — NULL tant que l''intervention n''est pas clôturée : « pas encore décidé » n''est aucune des trois valeurs, et naître « non_facturable » confondrait « pas encore » et « jamais ». Posé automatiquement par « intervention_facturation_a_la_cloture », jamais par l''application — l''écrire des deux côtés serait deux lectures d''un même critère, dans l''endroit qui décide si un client est facturé.';

-- ── UNE CLÔTURE SANS RÉPONSE EST REFUSÉE ────────────────────────────────────
--
-- Posée « NOT VALID » (D104) : les interventions `cloturee` ANTÉRIEURES à cette
-- migration n'ont pas de statut de facturation, et **personne ne peut en
-- énoncer un à leur place** — dire « à facturer » d'une intervention close il y
-- a six mois la ferait entrer dans une file de facturation, dire
-- « non facturable » renoncerait à un montant. *C'est exactement le cas que
-- D104 décrit, et le rattrapage appartient à l'exploitation.*
ALTER TABLE "intervention"
  ADD CONSTRAINT "intervention_cloture_a_son_statut_facturation"
  CHECK ("statut" <> 'cloturee' OR "statut_facturation" IS NOT NULL) NOT VALID;

COMMENT ON CONSTRAINT "intervention_cloture_a_son_statut_facturation" ON "intervention" IS
  'POSÉE « NOT VALID » (D104) : les interventions déjà clôturées n''ont pas de statut de facturation, et personne ne peut en énoncer un à leur place — « à facturer » les ferait entrer dans une file de facturation, « non facturable » renoncerait à un montant. L''état non validé est tenu par scripts/lib/contraintes-non-validees.ts et observé chaque nuit par « pnpm veille ».';

CREATE OR REPLACE FUNCTION "intervention_facturation_a_la_cloture"()
RETURNS TRIGGER AS $$
BEGIN
  -- IL N'AGIT QU'À L'ENTRÉE, et seulement si personne n'a répondu. Une
  -- réouverture pour correction suivie d'une nouvelle clôture ne doit pas
  -- rendre « à facturer » ce que le retour de facturation a déjà marqué
  -- « facturee ».
  IF NEW."statut" = 'cloturee'
     AND (TG_OP = 'INSERT' OR OLD."statut" <> 'cloturee')
     AND NEW."statut_facturation" IS NULL THEN
    -- LES TROIS EXEMPTIONS DE D8, ET LA TROISIÈME EST INERTE :
    -- « … ou si l'intervention est couverte par un contrat forfaitaire ».
    -- Aucune table « contrat » n'existe (lot 4) et « intervention » ne porte
    -- pas de « contrat_id ». La branche est écrite pour n'avoir pas à rouvrir
    -- cette fonction ce jour-là ; elle ne peut pas se déclencher aujourd'hui.
    IF NEW."type" IN ('garantie', 'recensement') THEN
      NEW."statut_facturation" := 'non_facturable';
    ELSE
      NEW."statut_facturation" := 'a_facturer';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION "intervention_facturation_a_la_cloture"() IS
  'D8 — « statut_facturation passe à a_facturer automatiquement à l''entrée en CLOTUREE, sauf si le type est garantie, recensement ou si l''intervention est couverte par un contrat forfaitaire ». La troisième exemption est écrite dans la décision et INERTE ici : aucune table « contrat » n''existe. Le nom place ce déclencheur APRÈS « intervention_cycle_de_vie » dans l''ordre alphabétique, si bien qu''une transition refusée n''a jamais rien écrit.';

CREATE TRIGGER "intervention_facturation_a_la_cloture"
  BEFORE INSERT OR UPDATE ON "intervention"
  FOR EACH ROW EXECUTE FUNCTION "intervention_facturation_a_la_cloture"();
