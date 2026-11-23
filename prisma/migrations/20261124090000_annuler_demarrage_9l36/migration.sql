-- ════════════════════════════════════════════════════════════════════════════
-- 9L36-ANNULER-DEMARRAGE-10S — D282, décision d'Alexis du 23/11/2026, point 8.
--
-- « Annuler le démarrage » : pendant DIX SECONDES après avoir démarré son
-- compteur, un technicien peut se dédire. L'intervention revient à
-- `affectee`, et le segment ouvert est SUPPRIMÉ — aucun temps compté, comme
-- si le démarrage n'avait jamais eu lieu.
--
-- **DEUX EXCEPTIONS, NOMMÉES ET ÉTROITES**, l'une et l'autre bornées par la
-- MÊME fenêtre de temps, jugée à nouveau ici alors que `lib/interventions/
-- depot-compteur.ts` (`annulerLeDemarrage`) l'a déjà jugée AVANT d'écrire :
-- *un refus de base est un message technique arrivé trop tard, mais une
-- garantie qui ne vivrait QUE dans la couche applicative n'en est pas une*
-- (I1, L1-02c) — un essai direct, SOUS LE RÔLE APPLICATIF, après la fenêtre
-- ou sans segment ouvert, ne doit pas passer davantage que l'application ne
-- le laisse. Les gardes PLUS FINES (même personne, aucune saisie depuis,
-- premier démarrage seulement) restent, elles, SEULEMENT dans
-- `annulerLeDemarrage` — une table quelconque n'a pas ce qu'il faut pour les
-- juger à ce niveau (quelle personne a ouvert le segment qu'on referme n'est
-- pas une question que `intervention_cycle_de_vie` peut se poser, elle qui
-- ne voit que la ligne `intervention`), et c'est l'application qui reste la
-- SEULE à écrire cette transition — aucun autre appelant ne l'emprunte.
--
-- **LES DEUX GARDES NEUVES NE MORDENT QUE SOUS `codiplan_app`** (`current_user`)
-- — JAMAIS sous le propriétaire du schéma (migrations, scripts de maintenance,
-- harnais des tests d'isolation, qui écrivent et nettoient ces mêmes colonnes
-- par construction, hors de toute fenêtre). *Ce n'est pas un trou* : le
-- propriétaire n'est filtré par AUCUNE politique RLS non plus (D94) — c'est
-- la même frontière, déjà posée partout ailleurs par les `GRANT`/`REVOKE` de
-- ce dépôt, appliquée ici à un DÉCLENCHEUR parce qu'un privilège seul ne sait
-- pas dire « seulement pendant dix secondes ». Mesuré : sans cette portée, le
-- déclencheur de suppression refusait le nettoyage de `segment_travail` fait
-- par `clientOwner()` dans la quasi-totalité des fichiers d'isolation,
-- cassant des dizaines de scénarios sans rapport avec ce ticket.
--
--   1. LA MATRICE D8 (`intervention_cycle_de_vie`) s'ouvre d'UNE flèche,
--      `EN_COURS → AFFECTEE`, et seulement si un segment ouvert de MOINS DE
--      DIX SECONDES (marge réseau comprise) existe ENCORE sur cette
--      intervention au moment de l'écriture — c'est pourquoi `annulerLeDemarrage`
--      écrit l'intervention AVANT de supprimer le segment, jamais l'inverse.
--
--   2. `segment_travail` N'ACCORDAIT NI UPDATE NI DELETE AU-DELÀ DE LA
--      FERMETURE (20260915010000, 20261122200000) : *le travail terrain ne
--      se perd ni ne se réécrit* (I5, I8). Un segment tout juste ouvert, dans
--      les dix secondes, n'est encore AUCUN travail accompli — rien à perdre,
--      puisque rien n'a eu le temps d'être fait. Le DELETE est accordé, et un
--      déclencheur BEFORE DELETE referme tout le reste : hors de la fenêtre,
--      ou sur un segment déjà fermé, la suppression est refusée comme avant.
--
-- `journal_audit` couvre déjà `segment_travail` en DELETE depuis sa toute
-- première migration (20260915010000) — un geste jusqu'ici impossible, donc
-- jamais tracé ; il le devient par cette seule ligne, sans rien à ajouter ici
-- (I8, périmètre inversé).
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
    -- 'affectee' AJOUTÉ ICI (D282, 9L36) — « Annuler le démarrage » : voir la
    -- garde de fenêtre ci-dessous, propre à CETTE cellule.
    OR (OLD."statut" = 'en_cours' AND NEW."statut" IN ('suspendue', 'terminee', 'annulee', 'affectee'))
    OR (OLD."statut" = 'suspendue' AND NEW."statut" IN ('a_planifier', 'planifiee', 'en_cours', 'annulee'))
    OR (OLD."statut" = 'terminee' AND NEW."statut" IN ('en_cours', 'cloturee'))
  ) THEN
    RAISE EXCEPTION
      'Transition refusée : % → % n''est pas une transition permise par la matrice D8 (docs/arbitrages.md, D8 ; D160 ; D282).',
      OLD."statut", NEW."statut"
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW."statut" = 'cloturee' AND NEW."temps_valide_min" IS NULL THEN
    RAISE EXCEPTION
      'Clôture refusée : aucun temps validé. C''est l''entrée de l''arrondi au quart d''heure et du plancher d''une heure (RG-TAR-05, D83), et il se valide à partir du temps mesuré par le compteur (D120).'
      USING ERRCODE = 'check_violation';
  END IF;

  -- RG-INT-03 (D135, 20261022210000) — REPRISE SANS CHANGEMENT : cette
  -- migration recopiait déjà celle de D160 dans son propre en-tête
  -- (« reprend sans changement celle de 20261004100000 »), et la mienne
  -- aurait dû faire pareil avec CETTE VERSION-LÀ plutôt qu'avec celle de
  -- D160 directement — mesuré par `intervention.test.ts`, « la CLÔTURE sans
  -- rapport validé », qui serait sinon passée au vert pour la mauvaise
  -- raison (une clôture acceptée sans rapport validé).
  IF NEW."statut" = 'cloturee' AND NEW."rapport_valide_par" IS NULL THEN
    RAISE EXCEPTION
      'Clôture refusée : le rapport n''est pas validé. RG-INT-03 (D135) : un responsable, la direction ou l''administrateur valide le rapport du technicien avant que l''intervention ne se clôture.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- « ANNULER LE DÉMARRAGE », DANS LA FENÊTRE SEULEMENT (D282, 9L36) — la
  -- SEULE cellule de la matrice qui exige, en plus de la transition elle-
  -- même, qu'un FAIT extérieur à cette ligne reste vrai au moment où elle
  -- s'écrit : un segment ouvert depuis moins de dix secondes (marge réseau
  -- de trois secondes comprise, `MARGE_RESEAU_ANNULATION_MS`,
  -- `lib/interventions/compteur.ts`) sur CETTE intervention. Hors de cette
  -- fenêtre, ou sans un tel segment, la transition structurelle reste
  -- permise par la matrice ci-dessus mais REFUSÉE ici — c'est elle qui ferme
  -- ce qu'un appel direct, SOUS LE RÔLE APPLICATIF, pourrait sinon emprunter.
  -- `current_user = 'codiplan_app'` SEULEMENT (voir l'en-tête du fichier) :
  -- le propriétaire du schéma pose ce même statut hors de toute fenêtre dans
  -- ses propres fixtures et nettoyages, par construction.
  IF current_user = 'codiplan_app' AND OLD."statut" = 'en_cours' AND NEW."statut" = 'affectee' THEN
    IF NOT EXISTS (
      SELECT 1 FROM "segment_travail" s
       WHERE s."intervention_id" = NEW."id"
         AND s."fin" IS NULL
         AND now() <= s."debut" + INTERVAL '13 seconds'
    ) THEN
      RAISE EXCEPTION
        'Annulation du démarrage refusée : aucun segment ouvert depuis moins de dix secondes (marge réseau comprise) sur cette intervention (D282, 9L36).'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON COLUMN "intervention"."statut" IS
  'L''AVANCEMENT, distinct de la facturation (D8). La matrice COMPLÈTE des transitions est tenue par le déclencheur intervention_cycle_de_vie (D160, 04/10/2026) : CLOTUREE et ANNULEE sont toutes deux terminales, une suspension ne se pose que depuis EN_COURS, une clôture ne part que de TERMINEE. Depuis D120, le DÉMARRAGE DU COMPTEUR porte AFFECTEE/PLANIFIEE/SUSPENDUE à EN_COURS d''un seul geste, et SANS machine rattachée. Depuis D282 (9L36), EN_COURS → AFFECTEE existe aussi, pour « Annuler le démarrage » SEULEMENT dans les dix secondes qui suivent — borné ci-dessous par le même déclencheur, sur l''existence d''un segment ouvert assez récent.';

-- ── LE SEGMENT, SUPPRIMABLE, MAIS SEULEMENT DANS LA MÊME FENÊTRE ───────────
--
-- `segment_travail` est SOUS FORCE ROW LEVEL SECURITY depuis sa naissance
-- (20260915010000) avec TROIS politiques, une par verbe GARDÉ — **« un verbe
-- sans politique est refusé pour tout le monde »**, et `DELETE` n'en avait
-- aucune, à dessein. Accorder le seul privilège (`GRANT DELETE`, ci-dessous)
-- SANS politique laisserait encore tout filtrer à zéro ligne : MESURÉ ici
-- même en écrivant ce ticket, avant cette politique — un `DELETE` sous
-- `codiplan_app` résolvait silencieusement AUCUNE ligne, jamais une erreur,
-- cassant la suppression ET les scénarios qui en attendaient une. La forme
-- est celle, « interne », des trois politiques voisines (même `USING`).

CREATE POLICY "cloisonnement_interne_suppression" ON "segment_travail"
  FOR DELETE
  USING (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
    AND NULLIF(current_setting('app.client_id', true), '') IS NULL
  );

GRANT DELETE ON "segment_travail" TO "codiplan_app";

CREATE OR REPLACE FUNCTION "segment_travail_suppression_annulation_seulement"()
RETURNS TRIGGER AS $$
BEGIN
  -- `current_user = 'codiplan_app'` SEULEMENT (voir l'en-tête du fichier) :
  -- le propriétaire du schéma — migrations, scripts, harnais des tests
  -- d'isolation — supprime ces mêmes lignes hors de toute fenêtre, par
  -- construction (nettoyage de fixtures, jamais « Annuler le démarrage »).
  IF current_user <> 'codiplan_app' THEN
    RETURN OLD;
  END IF;
  IF OLD."fin" IS NOT NULL THEN
    RAISE EXCEPTION
      'Segment de travail fermé : il ne se supprime pas. Le compteur fait foi pour le temps (R5-02, D119) ; un segment fermé est un FAIT clos, au même titre qu''il ne se modifie plus (segment_travail_ferme_non_modifiable).'
      USING ERRCODE = 'check_violation';
  END IF;
  IF now() > OLD."debut" + INTERVAL '13 seconds' THEN
    RAISE EXCEPTION
      'Segment de travail ouvert : il ne se supprime que dans les dix secondes qui suivent son ouverture (marge réseau comprise) — « Annuler le démarrage » (D282, 9L36). Au-delà, c''est du travail accompli, et le travail terrain ne se perd ni ne se réécrit (I5, I8).'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "segment_travail_suppression_annulation_seulement"
  BEFORE DELETE ON "segment_travail"
  FOR EACH ROW EXECUTE FUNCTION "segment_travail_suppression_annulation_seulement"();

COMMENT ON TRIGGER "segment_travail_suppression_annulation_seulement" ON "segment_travail" IS
  'D282 (9L36) — seule exception au régime « jamais de DELETE » de segment_travail (20260915010000) : un segment ENCORE OUVERT, et ouvert depuis MOINS de dix secondes (marge réseau comprise). Au-delà, ou sur un segment fermé, la suppression reste refusée — le travail terrain ne se perd ni ne se réécrit (I5, I8).';
