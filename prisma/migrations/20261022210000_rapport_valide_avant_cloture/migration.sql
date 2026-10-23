-- ════════════════════════════════════════════════════════════════════════════
-- D135 (décision d'Alexis du 21/10/2026) — PAS DE CLÔTURE SANS RAPPORT VALIDÉ
-- (RG-INT-03), construite avant l'usage réel (audit 9F6, constat IN-20).
--
-- L'état « rapport validé » n'existait pas : `peutCloturer` ne jugeait que le
-- temps mesuré. Cette migration pose les deux colonnes qui le portent, MÊME
-- RÉGIME que `temps_valide_par`/`temps_valide_le` (D120) : QUI a validé, et
-- QUAND, les deux ensemble — une date sans auteur ne dit rien de plus qu'un
-- horodatage de ligne, un auteur sans date ne dit pas quand.
--
-- ── LE RATTRAPAGE, ET POURQUOI IL N'EST PAS SYMÉTRIQUE ─────────────────────
--
-- Les interventions DÉJÀ CLÔTURÉES l'ont été sous l'ANCIEN régime, où aucune
-- validation du rapport n'était exigée. Les laisser sans aucune trace ferait
-- lire, dans leur chronologie, « rapport non validé » sur des milliers
-- d'interventions closes de bonne foi il y a des mois — une lecture fausse,
-- puisque la clôture elle-même EST, sous l'ancien régime, ce qui validait le
-- travail. Elles sont donc RÉPUTÉES validées, à la date de leur clôture : on
-- SAIT quand, on ne sait pas QUI précisément parmi ceux qui ont pu la clore —
-- `rapport_valide_par` reste donc NULL, plutôt que de signer une validation
-- du nom de quelqu'un qui ne l'a pas forcément faite.
--
-- **C'est délibérément asymétrique** (`rapport_valide_par` NULL,
-- `rapport_valide_le` renseignée) — et c'est la MÊME famille que
-- `intervention_validation_tracee` (D104, D120) : une règle qui naît après
-- les données qu'elle gouverne. **Ce n'est PAS posé `NOT VALID`** : la liste
-- `CONTRAINTES_NON_VALIDEES` (`scripts/lib/contraintes-non-validees.ts`) a un
-- PLAFOND de quatre entrées, délibérément bas, et une quatrième y serait « un
-- arbitrage, jamais une mise à jour de ce fichier » (son propre test). La
-- contrainte ci-dessous reste donc pleinement VALIDÉE dès sa pose : elle
-- tolère l'asymétrie, mais SEULEMENT sur une ligne déjà `cloturee` — et une
-- ligne `cloturee` ne se modifie plus jamais (`intervention_cycle_de_vie`
-- l'interdit avant même d'atteindre cette colonne : le déclencheur est donc
-- SUSPENDU pour la durée du seul rattrapage ci-dessous, et rétabli avant la
-- fin de cette transaction — voir son commentaire). L'échappatoire ne s'ouvre
-- donc qu'au rattrapage de CETTE migration, jamais à une écriture future.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE "intervention"
  ADD COLUMN "rapport_valide_par" uuid,
  ADD COLUMN "rapport_valide_le"  timestamptz(3);

-- LE RATTRAPAGE — avant la contrainte, qui ne verra alors que l'état final.
--
-- Le déclencheur `intervention_cycle_de_vie` (BEFORE UPDATE FOR EACH ROW, sans
-- liste de colonnes — posé par 20260909200000_intervention_l2_planning) refuse
-- toute modification d'une ligne `OLD.statut = 'cloturee'`, y compris celle-ci.
-- `pas_sur_blocage_agenda` (AFTER INSERT OR UPDATE, posé par
-- 20260914210000_blocage_agenda_r3_14) se déclencherait aussi, sans liste de
-- colonnes. Les deux sont donc suspendus pour la durée du seul rattrapage, et
-- rétablis avant la fin de cette même transaction — jamais après :
-- `CREATE OR REPLACE FUNCTION` plus bas redéfinit le corps de l'un des deux,
-- pas son état d'activation sur la table.
--
-- **ET LE RÔLE DE MIGRATION EST PROPRIÉTAIRE, DONC SOUMIS À `FORCE`** — même
-- défaut que R3-02 (§9, 07/09, `scripts/lib/gardes-migration.ts`). Sans
-- contexte société posé, il ne verrait AUCUNE ligne d'`intervention` : l'
-- `UPDATE` ci-dessous ne toucherait rien tout en paraissant réparer. Et
-- `journal_audit` — lu en écriture par le déclencheur d'audit dès qu'une vraie
-- ligne est touchée — est FORCÉ lui aussi : sans la même levée, cette écriture
-- échouerait (violation de sa politique `WITH CHECK`) dès que l'`UPDATE`
-- toucherait une ligne, avortant tout le rattrapage. Les deux drapeaux sont
-- donc levés AVANT les déclencheurs, et la levée est CONSTATÉE — le témoin
-- porte sur le MÉCANISME, jamais sur un décompte, qu'un zéro légitime rendrait
-- muet.
ALTER TABLE "intervention" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "journal_audit" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "intervention" DISABLE TRIGGER "intervention_cycle_de_vie";
ALTER TABLE "intervention" DISABLE TRIGGER "pas_sur_blocage_agenda";

DO $$
DECLARE
  levee_intervention boolean;
  levee_journal boolean;
BEGIN
  SELECT NOT relforcerowsecurity INTO levee_intervention
    FROM pg_class WHERE relname = 'intervention';
  IF NOT COALESCE(levee_intervention, false) THEN
    RAISE EXCEPTION
      'Le rattrapage de RG-INT-03 ne peut pas s''exécuter : FORCE ROW LEVEL SECURITY est toujours actif sur « intervention », si bien que cette écriture verrait zéro ligne — elle ne réparerait rien tout en paraissant le faire. Le rattrapage s''arrête plutôt que de passer à l''aveugle.';
  END IF;

  SELECT NOT relforcerowsecurity INTO levee_journal
    FROM pg_class WHERE relname = 'journal_audit';
  IF NOT COALESCE(levee_journal, false) THEN
    RAISE EXCEPTION
      'Le rattrapage de RG-INT-03 ne peut pas s''exécuter : FORCE ROW LEVEL SECURITY est toujours actif sur « journal_audit », si bien que le déclencheur d''audit échouerait dès qu''une vraie ligne serait touchée, avortant tout le rattrapage. Le rattrapage s''arrête plutôt que d''avorter à mi-chemin.';
  END IF;

  UPDATE "intervention"
     SET "rapport_valide_le" = "cloturee_le"
   WHERE "statut" = 'cloturee'
     AND "cloturee_le" IS NOT NULL;
END
$$;

ALTER TABLE "intervention" ENABLE TRIGGER "intervention_cycle_de_vie";
ALTER TABLE "intervention" ENABLE TRIGGER "pas_sur_blocage_agenda";

ALTER TABLE "intervention" FORCE ROW LEVEL SECURITY;
ALTER TABLE "journal_audit" FORCE ROW LEVEL SECURITY;

-- LE TÉMOIN FINAL : les deux drapeaux sont bien revenus, pas seulement
-- demandés — une transaction qui échouerait entre l'`ALTER TABLE` et son
-- effet laisserait le cloisonnement ouvert sans qu'aucun message ne le dise.
DO $$
DECLARE
  rendu_intervention boolean;
  rendu_journal boolean;
BEGIN
  SELECT relforcerowsecurity INTO rendu_intervention
    FROM pg_class WHERE relname = 'intervention';
  IF NOT COALESCE(rendu_intervention, false) THEN
    RAISE EXCEPTION
      'FORCE ROW LEVEL SECURITY n''a pas été rétabli sur « intervention » à la fin du rattrapage de RG-INT-03 : le cloisonnement resterait ouvert au-delà de la transaction qui devait le refermer.';
  END IF;

  SELECT relforcerowsecurity INTO rendu_journal
    FROM pg_class WHERE relname = 'journal_audit';
  IF NOT COALESCE(rendu_journal, false) THEN
    RAISE EXCEPTION
      'FORCE ROW LEVEL SECURITY n''a pas été rétabli sur « journal_audit » à la fin du rattrapage de RG-INT-03.';
  END IF;
END
$$;

ALTER TABLE "intervention"
  ADD CONSTRAINT "intervention_rapport_validation_tracee" CHECK (
    ("rapport_valide_par" IS NULL) = ("rapport_valide_le" IS NULL)
    OR ("rapport_valide_par" IS NULL AND "statut" = 'cloturee')
  );

COMMENT ON COLUMN "intervention"."rapport_valide_par" IS
  'QUI a validé le RAPPORT (RG-INT-03, D135). Va toujours avec rapport_valide_le, SAUF sur une intervention déjà clôturée (grand-père du rattrapage de cette migration : réputée validée par sa clôture même, sans auteur identifiable) — intervention_rapport_validation_tracee tient les deux cas, et une ligne clôturée ne se modifie plus jamais.';

COMMENT ON COLUMN "intervention"."rapport_valide_le" IS
  'QUAND le rapport a été validé (RG-INT-03, D135). Sur une intervention clôturée avant D135 (rattrapage), porte la date de clôture elle-même alors que rapport_valide_par reste NULL — seule exception admise par intervention_rapport_validation_tracee, et elle ne peut plus se reproduire : une ligne clôturée est figée.';

-- ── LA GARDE DE CLÔTURE (RG-INT-03) ─────────────────────────────────────────
--
-- Même déclencheur que le temps validé (D120) : un refus lisible en TypeScript
-- (`peutCloturer`, `lib/interventions/cycle-de-vie.ts`) n'est une garantie que
-- si la base refuse aussi ce qu'il refuse (I1, L1-02c). Les autres gardes de
-- `intervention_cycle_de_vie` ne bougent pas d'un mot.
CREATE OR REPLACE FUNCTION "intervention_cycle_de_vie"()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."statut" = 'annulee' THEN
    RAISE EXCEPTION
      'Intervention annulée : elle ne se modifie plus. Une annulation n''efface rien et ne se défait pas ; créer une nouvelle intervention.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF OLD."statut" = 'cloturee' THEN
    RAISE EXCEPTION
      'Intervention clôturée : elle ne se modifie plus, y compris pour être annulée. CLOTUREE est terminale (matrice D8, D160) — l''ancienne préséance d''I5 sur ce point est refermée.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- UNE ÉCRITURE QUI NE CHANGE PAS LE STATUT N'EST PAS UNE TRANSITION : elle
  -- passe, sur toute ligne qui n'est pas déjà figée (jugée ci-dessus).
  IF NEW."statut" = OLD."statut" THEN
    RETURN NEW;
  END IF;

  IF NOT (
    (OLD."statut" = 'a_planifier' AND NEW."statut" IN ('planifiee', 'annulee'))
    OR (OLD."statut" = 'planifiee' AND NEW."statut" IN ('a_planifier', 'affectee', 'en_cours', 'annulee'))
    OR (OLD."statut" = 'affectee' AND NEW."statut" IN ('a_planifier', 'planifiee', 'en_cours', 'annulee'))
    OR (OLD."statut" = 'en_cours' AND NEW."statut" IN ('suspendue', 'terminee', 'annulee'))
    OR (OLD."statut" = 'suspendue' AND NEW."statut" IN ('a_planifier', 'planifiee', 'en_cours', 'annulee'))
    OR (OLD."statut" = 'terminee' AND NEW."statut" IN ('en_cours', 'cloturee'))
  ) THEN
    RAISE EXCEPTION
      'Transition refusée : % → % n''est pas une transition permise par la matrice D8 (docs/arbitrages.md, D8 ; D160).',
      OLD."statut", NEW."statut"
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW."statut" = 'cloturee' AND NEW."temps_valide_min" IS NULL THEN
    RAISE EXCEPTION
      'Clôture refusée : aucun temps validé. C''est l''entrée de l''arrondi au quart d''heure et du plancher d''une heure (RG-TAR-05, D83), et il se valide à partir du temps mesuré par le compteur (D120).'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW."statut" = 'cloturee' AND NEW."rapport_valide_par" IS NULL THEN
    RAISE EXCEPTION
      'Clôture refusée : le rapport n''est pas validé. RG-INT-03 (D135) : un responsable, la direction ou l''administrateur valide le rapport du technicien avant que l''intervention ne se clôture.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON COLUMN "intervention"."statut" IS
  'L''AVANCEMENT, distinct de la facturation (D8). La matrice COMPLÈTE des transitions est tenue par le déclencheur intervention_cycle_de_vie (D160, 04/10/2026) : CLOTUREE et ANNULEE sont toutes deux terminales, une suspension ne se pose que depuis EN_COURS, une clôture ne part que de TERMINEE et exige le temps validé (D120) ET le rapport validé (RG-INT-03, D135). Depuis D120, le DÉMARRAGE DU COMPTEUR porte AFFECTEE/PLANIFIEE/SUSPENDUE à EN_COURS d''un seul geste, et SANS machine rattachée.';
