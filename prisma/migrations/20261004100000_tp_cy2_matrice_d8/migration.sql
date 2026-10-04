-- ════════════════════════════════════════════════════════════════════════════
-- D160 — D8 TENUE EN BASE ET AU SERVEUR (QT-4, décision d'Alexis du 28/09/2026)
--
-- Jusqu'ici, `intervention_cycle_de_vie` ne portait que TROIS gardes : une
-- annulée est intouchable, une clôturée ne se modifie que pour être annulée
-- (l'ancienne lecture d'I5), et une clôture sans temps validé est refusée.
-- AUCUNE des transitions de la matrice D8 (docs/arbitrages.md, D8, §3) n'était
-- posée en base — seul le TypeScript de `lib/interventions/cycle-de-vie.ts`
-- en jugeait une partie, et imparfaitement (une « Terminer » pouvait se
-- clôturer depuis n'importe quel statut non figé, une suspension pouvait se
-- poser avant tout démarrage, un compteur pouvait démarrer depuis À planifier).
--
-- Cette migration pose la matrice COMPLÈTE, à la lettre :
--
--   A_PLANIFIER → PLANIFIEE, ANNULEE
--   PLANIFIEE   → A_PLANIFIER, AFFECTEE, EN_COURS, ANNULEE
--   AFFECTEE    → A_PLANIFIER, PLANIFIEE, EN_COURS, ANNULEE
--   EN_COURS    → SUSPENDUE, TERMINEE, ANNULEE
--   SUSPENDUE   → A_PLANIFIER, PLANIFIEE, EN_COURS, ANNULEE
--   TERMINEE    → EN_COURS, CLOTUREE
--   CLOTUREE    → (rien — terminale)
--   ANNULEE     → (rien — terminale)
--
-- **CLOTUREE DEVIENT TERMINALE AU SENS PLEIN.** L'ancienne garde laissait
-- `CLOTUREE → ANNULEE` passer, au nom de la préséance d'I5. La matrice D8, lue
-- à la lettre, ne porte aucune flèche sortante depuis CLOTUREE : cette
-- migration RETIRE cette exception plutôt que de la reconduire en silence —
-- c'est la décision du 28/09, QT-4(a), et `lib/interventions/cycle-de-vie.ts`
-- (`peutAnnuler`) le reflète déjà côté serveur.
--
-- **UNE ÉCRITURE QUI NE CHANGE PAS LE STATUT PASSE TOUJOURS** (sauf sur une
-- ligne déjà figée, immuable dans son entier) : la matrice ne juge que les
-- TRANSITIONS, jamais une mise à jour d'un autre champ sur un statut
-- inchangé — affecter un technicien sur une AFFECTÉE, corriger une note sur
-- une PLANIFIÉE, etc.
--
-- ── CONTRÔLE DE PRODUCTION, À LANCER PAR ALEXIS AVANT DE DÉPLOYER ───────────
--
-- Cette migration NE MODIFIE AUCUNE DONNÉE — seul le déclencheur change — mais
-- elle resserre ce qu'une écriture FUTURE peut faire. Si une intervention
-- FIGÉE (clôturée ou annulée) porte aujourd'hui un segment de travail encore
-- OUVERT (`fin IS NULL`), c'est le signe d'un état qu'aucune clôture propre
-- n'aurait dû produire : la requête de contrôle suivante doit rendre ZÉRO
-- ligne. Un résultat non vide n'est pas bloquant pour CETTE migration (elle ne
-- touche aucune ligne), mais il doit être regardé avant le lot suivant, qui
-- s'appuie sur « aucun segment ouvert sur une intervention figée » :
--
--   SELECT i."id", i."statut", s."id" AS "segment_id"
--     FROM "intervention" i
--     JOIN "segment_travail" s ON s."intervention_id" = i."id"
--    WHERE i."statut" IN ('cloturee', 'annulee')
--      AND s."fin" IS NULL;
-- ════════════════════════════════════════════════════════════════════════════

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

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON COLUMN "intervention"."statut" IS
  'L''AVANCEMENT, distinct de la facturation (D8). La matrice COMPLÈTE des transitions est tenue par le déclencheur intervention_cycle_de_vie (D160, 04/10/2026) : CLOTUREE et ANNULEE sont toutes deux terminales, une suspension ne se pose que depuis EN_COURS, une clôture ne part que de TERMINEE. Depuis D120, le DÉMARRAGE DU COMPTEUR porte AFFECTEE/PLANIFIEE/SUSPENDUE à EN_COURS d''un seul geste, et SANS machine rattachée.';
