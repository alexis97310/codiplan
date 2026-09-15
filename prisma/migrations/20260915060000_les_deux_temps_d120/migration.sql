-- ════════════════════════════════════════════════════════════════════════════
-- D120 — LE COMPTEUR EST LA SEULE SOURCE DU TEMPS, ET DU STATUT DE TRAVAIL.
--
-- Trois réponses d'exploitation du 15/09/2026, et elles se tiennent : elles
-- touchent toutes le MÊME déclencheur, `intervention_cycle_de_vie`, et les
-- séparer en deux migrations ferait réécrire par la seconde ce que la première
-- vient de poser.
--
--   1. **Démarrer le compteur fait passer l'intervention EN COURS, sans
--      machine.** *« Une intervention peut porter sur autre chose qu'un
--      équipement — un réseau d'air comprimé, par exemple. »*
--   2. **Plus aucune saisie manuelle du temps** : elle se fait dans Winpro au
--      moment de facturer, hors de CODIPLAN.
--   3. **Deux temps, et non un** : le MESURÉ, que le compteur écrit et que
--      personne ne corrige ; le VALIDÉ, qu'un responsable arrête — avec son
--      nom et sa date. *Un compteur oublié fausse les indicateurs, et sans ces
--      deux colonnes on ne peut pas voir l'écart.*
--
-- **Ce sont les deux questions que `20260915010000_compteur_du_technicien_r5_02`
-- avait laissées ÉCRITES dans son propre en-tête plutôt que tranchées par
-- accident.** Elles y restent lisibles, et cette migration les ferme : *ce qui a
-- été décidé un jour se relit, et ce qui était ouvert doit dire où il s'est
-- refermé.*
--
-- ── CE QUE LA PREMIÈRE RÉPONSE RETIRE, ET JUSQU'OÙ ─────────────────────────
--
-- La consigne dit *« ne s'applique pas au démarrage du compteur »*. Le contrôle
-- est retiré du passage en statut de travail **TOUT ENTIER**, et le motif est
-- écrit plutôt que supposé : **un verrou que le compteur contourne ne garde
-- plus rien.** Si un technicien peut passer une intervention EN COURS sans
-- machine d'un seul geste, le laisser en place sur le chemin du back-office
-- ferait une règle qui refuse au planificateur ce qu'elle accorde au terrain —
-- c'est-à-dire la seconde lecture d'un critère qui vieillit sans rougir (§9,
-- 01/09). Et le motif donné — *une intervention peut porter sur autre chose
-- qu'un équipement* — ne dépend pas de qui agit.
--
-- RG-INT-01 est amendée en conséquence (D16 l'avait déjà réécrite).
--
-- ── CE QUI N'EST PAS RETIRÉ ────────────────────────────────────────────────
--
-- Les trois autres gardes du cycle de vie ne bougent pas d'un mot : une
-- intervention annulée ne se modifie plus, une clôturée ne se modifie que pour
-- être annulée (I5), et une clôture sans temps est refusée. **Seule la colonne
-- lue par la troisième change de nom**, et c'est un renommage, pas un
-- relâchement.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. LE RENOMMAGE, ET POURQUOI IL N'EST PAS COSMÉTIQUE ───────────────────
--
-- `temps_reel_min` portait DEUX rôles qui viennent de se séparer : ce qui a
-- été mesuré, et ce qui a été validé. Le garder pour l'un des deux aurait
-- laissé son nom affirmer l'autre — *le temps « réel » est le mesuré, et c'est
-- le validé qui se valorise.* Un nom qui dit le contraire de ce que la colonne
-- porte est la faute que le §9 nomme sur `code_winpro`.
--
-- Le renommage conserve les valeurs : les interventions déjà clôturées gardent
-- leur temps, désormais sous le nom de ce qu'il est — un temps validé, qu'aucun
-- compteur n'a mesuré. **Leur `temps_mesure_min` reste donc NULL, et c'est
-- exact** : le compteur n'existait pas.

ALTER TABLE "intervention" RENAME COLUMN "temps_reel_min" TO "temps_valide_min";

ALTER TABLE "intervention"
  ADD COLUMN "temps_mesure_min" integer,
  ADD COLUMN "temps_valide_par" uuid,
  ADD COLUMN "temps_valide_le"  timestamptz(3);

-- **LES DEUX COLONNES DE TRAÇABILITÉ VOYAGENT ENSEMBLE, ET LA BASE LE TIENT.**
-- *Une date sans auteur ne dit rien de plus qu'un horodatage de ligne ; un
-- auteur sans date ne dit pas quand.* C'est la forme des quatre colonnes de
-- suspension (D104) : ce qui ne se lit qu'ensemble s'écrit ensemble.
--
-- **Posée « NOT VALID », et c'est une DÉCISION** (D104) : les interventions
-- clôturées AVANT ce jour n'ont ni auteur ni date de validation, et personne ne
-- peut en énoncer un à leur place. La contrainte vaut pour toute ligne nouvelle
-- ou modifiée ; l'état non validé est VISIBLE — `scripts/lib/contraintes-non-validees.ts`
-- le lit chaque nuit, et un scénario d'isolation à chaque `verify`.
ALTER TABLE "intervention"
  ADD CONSTRAINT "intervention_validation_tracee" CHECK (
    ("temps_valide_par" IS NULL) = ("temps_valide_le" IS NULL)
  ) NOT VALID;

COMMENT ON COLUMN "intervention"."temps_mesure_min" IS
  'LE TEMPS MESURÉ — la somme des segments FERMÉS de segment_travail, écrite par le compteur et JAMAIS modifiable : le déclencheur intervention_temps_mesure_est_celui_du_compteur refuse toute valeur qui ne soit pas cette somme. Un temps qui se corrige n''est plus une mesure (D120).';

COMMENT ON COLUMN "intervention"."temps_valide_min" IS
  'LE TEMPS VALIDÉ — ce qu''un responsable ou l''ADV arrête à la validation, et la SEULE entrée de D83 (arrondi au quart d''heure supérieur, plancher d''une heure). Par défaut il égale le temps mesuré ; il n''en diffère que si quelqu''un a corrigé, et on sait alors qui et quand. Cette colonne s''appelait temps_reel_min : le nom a changé avec la règle (D120).';

COMMENT ON COLUMN "intervention"."temps_valide_par" IS
  'QUI a validé le temps. Va toujours avec temps_valide_le — une correction sans auteur ni date est une correction que personne n''assume (D120).';

-- ── 2. LE TEMPS MESURÉ NE SE CORRIGE PAS — la base le tient ────────────────
--
-- **« Écrit par le compteur et jamais modifiable » est une garantie, pas une
-- intention** : sans déclencheur, elle ne vivrait que dans la couche
-- applicative, et *une garantie qui ne vit que dans la couche applicative n'en
-- est pas une* (I1, L1-02c).
--
-- Ce que le déclencheur exige est exactement ce que `mesurer()` calcule : la
-- somme des DURÉES des segments fermés, en secondes, divisée par 60 et
-- TRONQUÉE — jamais la somme des minutes tronquées une à une. *Deux segments
-- de trente secondes font zéro minute, pas une.*
--
-- **C'est une seconde lecture d'un même critère, et elle est assumée comme
-- celles du cycle de vie** : le TypeScript explique, la base garde. Un scénario
-- les fait répondre l'une à côté de l'autre sur les mêmes segments — sans quoi
-- elles divergeraient en silence (§9, 01/09).

CREATE OR REPLACE FUNCTION "intervention_temps_mesure_du_compteur"()
RETURNS TRIGGER AS $$
DECLARE
  "attendu" integer;
BEGIN
  IF NEW."temps_mesure_min" IS NOT DISTINCT FROM OLD."temps_mesure_min" THEN
    RETURN NEW;
  END IF;

  SELECT floor(
           COALESCE(SUM(EXTRACT(EPOCH FROM ("s"."fin" - "s"."debut"))), 0) / 60
         )::integer
    INTO "attendu"
    FROM "segment_travail" "s"
   WHERE "s"."intervention_id" = NEW."id"
     AND "s"."fin" IS NOT NULL;

  IF NEW."temps_mesure_min" IS DISTINCT FROM "attendu" THEN
    RAISE EXCEPTION
      'Le temps mesuré ne se saisit pas : il est la somme des segments du compteur (%  minutes ici). Le compteur est la seule source du temps ; la saisie manuelle se fait dans Winpro au moment de facturer (D120).',
      "attendu"
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- **APRÈS l'écriture, jamais avant** — la leçon du 14/09 (R3-13). Un
-- déclencheur `BEFORE` qui lit la table qu'il garde voit la ligne candidate
-- avec un identifiant neuf sous `INSERT … ON CONFLICT`, et compare alors une
-- ligne à elle-même. Celui-ci lit `segment_travail`, pas `intervention`, mais
-- l'ordre reste le bon pour une autre raison : le compteur ferme le segment
-- PUIS écrit la somme, et un `BEFORE` sur une insertion d'intervention
-- n'aurait aucun segment à sommer.
CREATE TRIGGER "intervention_temps_mesure_est_celui_du_compteur"
  AFTER INSERT OR UPDATE OF "temps_mesure_min" ON "intervention"
  FOR EACH ROW EXECUTE FUNCTION "intervention_temps_mesure_du_compteur"();

-- ── 3. LE CYCLE DE VIE — une garde en moins, une colonne renommée ──────────
--
-- Le bloc RG-INT-01 disparaît. Les trois autres sont recopiés à l'identique :
-- `CREATE OR REPLACE` remplace la fonction ENTIÈRE, et n'en réécrire qu'une
-- partie n'est pas possible — c'est l'état final qui compte (§9, 26/08).

CREATE OR REPLACE FUNCTION "intervention_cycle_de_vie"()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."statut" = 'annulee' THEN
    RAISE EXCEPTION
      'Intervention annulée : elle ne se modifie plus. Une annulation n''efface rien et ne se défait pas ; créer une nouvelle intervention.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF OLD."statut" = 'cloturee' AND NEW."statut" <> 'annulee' THEN
    RAISE EXCEPTION
      'Intervention clôturée : elle ne se modifie plus sans trace. Seule l''annulation reste possible (I5 donne à ANNULEE la préséance sur CLOTUREE).'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW."statut" = 'cloturee' AND NEW."temps_valide_min" IS NULL THEN
    RAISE EXCEPTION
      'Clôture refusée : aucun temps validé. C''est l''entrée de l''arrondi au quart d''heure et du plancher d''une heure (RG-TAR-05, D83), et il se valide à partir du temps mesuré par le compteur (D120).'
      USING ERRCODE = 'check_violation';
  END IF;

  -- RG-INT-01 N'EXIGE PLUS DE MACHINE POUR DÉMARRER (D120). *Une intervention
  -- peut porter sur autre chose qu'un équipement — un réseau d'air comprimé.*
  -- Le bloc qui l'exigeait est retiré ici, et non commenté : une garde
  -- désactivée en commentaire est une garde qu'on croit avoir.

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON COLUMN "intervention"."statut" IS
  'L''AVANCEMENT, distinct de la facturation (D8). Depuis D120, le DÉMARRAGE DU COMPTEUR le porte à « en_cours » d''un seul geste, et SANS machine rattachée : une intervention peut porter sur autre chose qu''un équipement. Le technicien termine, le responsable ou l''ADV valide puis clôture — terminee et cloturee restent deux états distincts (arbitrage 3.17).';
