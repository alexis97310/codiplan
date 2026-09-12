-- ═══════════════════════════════════════════════════════════════════════════
-- R3-02 — LE RATTRAPAGE DES SUSPENSIONS ANTÉRIEURES. IL RÉPARE, IL NE DÉTRUIT
-- PAS. (D117, 12/09/2026)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ## CE QU'IL VIENT FINIR, ET CE QU'IL VIENT REMPLACER
--
-- D104 a posé deux contraintes `NOT VALID` : les interventions `suspendue`
-- nées avant L2-10 n'ont ni motif ni date, et personne ne peut les énoncer à
-- leur place. L'état non validé était VISIBLE ; il n'était pas RÉPARÉ.
--
-- **Et le 12/09/2026 au soir, ce non-réparé a coûté une base.** Une
-- intervention créée le 11/09 portait l'état `suspendue` sans date : la
-- contrainte `NOT VALID` l'acceptait au repos et l'a REFUSÉE dès que le semis
-- l'a touchée — c'est exactement ce que « vaut pour toute ligne nouvelle ou
-- MODIFIÉE » veut dire. La seule sortie trouvée à 23 h a été de tout purger, et
-- c'est ainsi que les comptes ont été effacés.
--
-- *Une contrainte qu'on ne peut ni valider ni violer sans casser le semis n'est
-- pas un état stable : c'est une mine posée sous le chemin ordinaire.*
--
-- ## LA RÈGLE DE RÉPARATION, ET ELLE TIENT EN UNE PHRASE
--
--     UNE SUSPENSION QUI NE PEUT PAS DIRE POURQUOI N'EST PAS UNE SUSPENSION.
--
-- Trois gestes, et aucun n'invente une donnée :
--
--   1. `suspendue_le` absente → **REPRISE** depuis `journal_audit`, à l'instant
--      où la ligne est passée au statut `suspendue` (I8). *C'est une lecture,
--      jamais une invention* — le journal porte les valeurs avant et après.
--   2. `motif_suspension` absent → l'intervention **SORT** de `suspendue`.
--      Ce n'est pas inventer un motif : c'est constater qu'un état qu'on ne
--      peut pas justifier n'a pas lieu d'être tenu. Et ce n'est pas une règle
--      nouvelle — **c'est la REPRISE ordinaire du produit**, celle que
--      `cycle-de-vie.ts` écrit déjà : le statut rendu est celui que le CRÉNEAU
--      dicte, jamais celui d'avant.
--   3. Les RÉSIDUS — une ligne non suspendue qui porte pourtant l'une des deux
--      colonnes — sont **effacés** : le statut fait foi, et ces colonnes ne
--      décrivent alors rien.
--
-- **Pourquoi sortir plutôt qu'inventer, et pourquoi sortir plutôt que purger.**
-- Les trois issues perdent quelque chose ; il s'agit de choisir laquelle perd
-- le moins et le dit :
--
--   — *inventer un motif* est l'issue (a) que D104 a écartée, et elle écrit une
--     donnée que nul n'a dite, sur la ligne même qu'on produit ce jour-là ;
--   — *purger* détruit tout, y compris les comptes — c'est ce qui vient
--     d'arriver ;
--   — *sortir de l'état* perd UN fait, « elle était suspendue », **et ce fait
--     survit dans `journal_audit`** (I8), qui porte le statut avant et après.
--     Le travail terrain n'est pas touché (I5) : ni temps, ni diagnostic, ni
--     photo, ni signature. Seul un statut de planification bouge, et c'est
--     précisément la catégorie que I5 range du côté back-office.
--
-- ## LA BORNE DEMANDÉE A ÉTÉ ÉCRITE, MESURÉE FAUSSE, ET RETIRÉE
--
-- La consigne disait : *« ce qui ne t'appartient pas : l'appliquer à une base
-- portant des données réelles. Écris ce refus dans le script. »* Le refus a
-- d'abord été écrit ICI, sous la forme d'un bloc comptant les lignes à réparer
-- appartenant à une société hors du jeu de démonstration, **les deux
-- identifiants du seed recopiés dans la migration**.
--
-- **Le rejeu sur base âgée l'a démenti en une exécution** (12/09/2026,
-- `tests/isolation/migrations-sur-base-agee.test.ts`) :
--
--     ERROR: R3-02 refuse de réparer : 1 intervention(s) à rattraper
--     appartiennent à une société HORS du jeu de démonstration.
--
-- *Le refus s'est déclenché sur un cas parfaitement légitime*, et il se serait
-- déclenché de la même façon sur toute base qui n'est pas littéralement le
-- seed — c'est-à-dire sur la production. **Une migration ne sait pas ce qu'est
-- une base de démonstration** : c'est une propriété du DÉPLOIEMENT, pas du
-- schéma, et l'y recopier revient à écrire deux identifiants de fiction dans
-- une structure qui doit valoir partout. *Une borne qui refuse le cas
-- ordinaire n'est pas une borne, c'est une panne* — et elle aurait été la
-- quatrième de la semaine.
--
-- **Ce qui la remplace, et pourquoi ce n'est pas un renoncement.** Le danger
-- que la consigne visait est d'INVENTER une donnée sur des lignes réelles. La
-- règle ci-dessus n'invente rien, jamais : elle LIT une date dans le journal,
-- ou elle RETIRE un état que personne ne peut justifier. Et chaque geste
-- qu'elle pose est journalisé par le déclencheur d'audit (I8), avec les
-- valeurs avant et après — *rien ne disparaît en silence, ce qui est
-- exactement ce que la purge, elle, a fait.*
--
-- Ce qui demeure est le seul refus qui ait un sens pour une migration :
-- **elle refuse s'il reste une violation qu'elle n'a pas su réparer**
-- (contrôle de sortie ci-dessous). Elle ne valide jamais une contrainte sur
-- des lignes qui la violent. *Le refus par société, lui, est porté par la
-- borne 3 de D116, à l'endroit où il peut être vrai : le FLUX, qui sait quelle
-- base il vise.*
--
-- **Elle ne touche pas `statut_facturation`.** D115 l'a tranché la veille : les
-- clôtures antérieures se reprennent UNE PAR UNE, parce que la réponse est dans
-- la FACTURATION et jamais dans CODIPLAN. `intervention_cloture_a_son_statut_facturation`
-- reste donc `NOT VALID`, seule entrée de `CONTRAINTES_NON_VALIDEES`.
--
-- ## LE BLOC LIT DEUX TABLES SOUS `FORCE`, ET LA SECONDE A FAILLI ÊTRE OUBLIÉE
--
-- Le rôle de migration est propriétaire : sans contexte de société, il verrait
-- **zéro ligne**, ne refuserait rien, et la réparation elle-même ne toucherait
-- rien tout en paraissant réparer (§9, 07/09). Les drapeaux sont levés pour la
-- durée du rattrapage, rendus dans la même transaction, et **le bloc refuse
-- d'agir tant que la levée n'est pas CONSTATÉE** — le témoin porte sur le
-- MÉCANISME, jamais sur un décompte, qu'un zéro légitime rendrait muet.
--
-- **`journal_audit` EST LA SECONDE, et c'est un gardien qui l'a nommée** —
-- `tests/unit/db/gardes-de-migration.test.ts`, pas la relecture. La première
-- rédaction ne levait que `intervention` ; sur la base hébergée, la reprise de
-- `suspendue_le` aurait lu **zéro ligne de journal**, n'aurait repris aucune
-- date, et serait passée à la branche suivante **sans rien dire**. *C'est la
-- troisième fois que cette règle mord son propre auteur dans la semaine, et
-- c'est l'argument pour un gardien plutôt qu'une vigilance : connaître une
-- règle ne protège pas de l'enfreindre* (§9, 07/09).

ALTER TABLE "intervention" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "journal_audit" NO FORCE ROW LEVEL SECURITY;

DO $$
DECLARE
  levee boolean;
  levee_journal boolean;
  dates_reprises integer;
  sorties integer;
  residus integer;
BEGIN
  SELECT NOT relforcerowsecurity INTO levee
    FROM pg_class WHERE relname = 'intervention';
  IF NOT COALESCE(levee, false) THEN
    RAISE EXCEPTION
      'Le rattrapage de R3-02 ne peut pas s''exécuter : FORCE ROW LEVEL SECURITY est toujours actif sur « intervention », si bien que cette lecture verrait zéro ligne — elle ne réparerait rien et ne refuserait rien, tout en paraissant faire les deux. Le rattrapage s''arrête plutôt que de passer à l''aveugle.';
  END IF;

  SELECT NOT relforcerowsecurity INTO levee_journal
    FROM pg_class WHERE relname = 'journal_audit';
  IF NOT COALESCE(levee_journal, false) THEN
    RAISE EXCEPTION
      'Le rattrapage de R3-02 ne peut pas reprendre les dates : FORCE ROW LEVEL SECURITY est toujours actif sur « journal_audit », si bien que la lecture du journal verrait zéro ligne et ne reprendrait AUCUNE date — sans rien dire, la branche suivante prenant le relais. Le rattrapage s''arrête plutôt que de perdre des motifs qu''il aurait pu garder.';
  END IF;

  -- ── 1. LA DATE SE REPREND — le journal la porte (I8) ───────────────────
  --
  -- **CETTE BRANCHE N'EST PAS ATTEIGNABLE PAR LE CHEMIN ORDINAIRE, et il vaut
  -- mieux l'écrire que le taire.** Elle vise une ligne qui porte un motif sans
  -- date. Or le motif et la date sont nés ENSEMBLE, à L2-10 : avant, ni l'une
  -- ni l'autre colonne n'existait ; après, `intervention_suspension_a_sa_date`
  -- refuse l'écriture d'un motif sans date, `NOT VALID` valant pour toute
  -- ligne nouvelle ou MODIFIÉE. *Le rejeu sur base âgée ne l'exerce donc pas,
  -- et aucune amorce ne peut l'exercer sans écrire un état que la base refuse.*
  --
  -- Elle est conservée quand même, et elle vient EN PREMIER. Le cas qu'elle
  -- couvre est la correction passée à la main dans une console — exactement ce
  -- qui s'est produit le 12/09 au soir. Sans elle, une ligne dont quelqu'un a
  -- écrit le motif tomberait dans la branche 2 et **le perdrait**. *Une
  -- réparation qui détruit une donnée que quelqu'un a prise la peine d'écrire
  -- n'est pas une réparation.*
  --
  -- L'instant retenu est le PLUS RÉCENT passage au statut `suspendue` : une
  -- intervention peut avoir été suspendue, reprise, puis suspendue à nouveau,
  -- et c'est la dernière suspension que `suspendue_le` décrit — c'est elle que
  -- la file « en attente de pièce » mesure.
  WITH derniere_suspension AS (
    SELECT j."entite_id" AS "id", max(j."horodatage") AS "quand"
      FROM "journal_audit" j
     WHERE j."entite" = 'intervention'
       AND j."valeurs_apres" ->> 'statut' = 'suspendue'
       AND ((j."valeurs_avant" ->> 'statut') IS DISTINCT FROM 'suspendue')
     GROUP BY j."entite_id"
  )
  UPDATE "intervention" i
     SET "suspendue_le" = d."quand"
    FROM "derniere_suspension" d
   WHERE d."id" = i."id"
     AND i."statut" = 'suspendue'
     AND i."suspendue_le" IS NULL
     AND i."motif_suspension" IS NOT NULL;
  GET DIAGNOSTICS dates_reprises = ROW_COUNT;

  -- ── 2. LE MOTIF NE SE REPREND PAS — la ligne SORT de l'état ────────────
  --
  -- Le statut rendu est celui que la DATE et le CRÉNEAU dictent, et cette
  -- expression est la TRANSCRIPTION EXACTE de `statutALaCreation` — la même
  -- règle, dans les mêmes termes, parce qu'une variante ici serait une seconde
  -- lecture d'un même critère (§9, 01/09) et qu'elle diverge en silence :
  -- *« à planifier » veut dire « sans date », et rien d'autre* — une
  -- intervention datée sans heure n'est plus dans la file d'attente, et
  -- l'écran l'a prouvé le 09/09.
  --
  -- `affectee` n'y figure PAS, et c'est délibéré : `statutALaCreation` ne le
  -- rend jamais. L'inventer ici aurait été écrire une troisième règle.
  --
  -- Les quatre colonnes de suspension partent avec l'état — les laisser ferait
  -- un résidu, c'est-à-dire l'autre sens de la même contrainte.
  UPDATE "intervention"
     SET "statut" = CASE
           WHEN "date_planifiee" IS NULL AND "creneau_debut" IS NULL
             THEN 'a_planifier'::"StatutIntervention"
           ELSE 'planifiee'::"StatutIntervention"
         END,
         "motif_suspension" = NULL,
         "suspendue_le" = NULL,
         "piece_attendue_ref" = NULL,
         "date_dispo_prevue" = NULL
   WHERE "statut" = 'suspendue'
     AND "motif_suspension" IS NULL;
  GET DIAGNOSTICS sorties = ROW_COUNT;

  -- ── 3. LES RÉSIDUS — le statut fait foi ────────────────────────────────
  UPDATE "intervention"
     SET "motif_suspension" = NULL,
         "suspendue_le" = NULL
   WHERE "statut" <> 'suspendue'
     AND ("motif_suspension" IS NOT NULL OR "suspendue_le" IS NOT NULL);
  GET DIAGNOSTICS residus = ROW_COUNT;

  RAISE NOTICE 'R3-02 — dates reprises du journal : % ; suspensions sorties de leur état : % ; résidus effacés : %.',
    dates_reprises, sorties, residus;

  -- ── LE CONTRÔLE DE SORTIE, et il n'est pas décoratif ────────────────────
  --
  -- `VALIDATE CONSTRAINT` refuserait de lui-même s'il restait une violation,
  -- mais son message ne nommerait qu'une contrainte. Celui-ci nomme le NOMBRE
  -- et l'endroit, et il prouve que les trois gestes ci-dessus ont bien porté.
  IF EXISTS (
    SELECT 1 FROM "intervention"
     WHERE ("statut" = 'suspendue' AND ("motif_suspension" IS NULL OR "suspendue_le" IS NULL))
        OR ("statut" <> 'suspendue' AND ("motif_suspension" IS NOT NULL OR "suspendue_le" IS NOT NULL))
  ) THEN
    RAISE EXCEPTION
      'R3-02 a réparé et il reste des violations : la règle de réparation ne couvre pas ce cas. Le rattrapage s''arrête plutôt que de valider une contrainte sur des lignes qui la violent.';
  END IF;
END
$$;

ALTER TABLE "intervention" FORCE ROW LEVEL SECURITY;
ALTER TABLE "journal_audit" FORCE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════════════
-- LA VALIDATION — c'est elle qui prouve que le rattrapage a eu lieu
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `VALIDATE CONSTRAINT` relit TOUTES les lignes, y compris celles que le bloc
-- ci-dessus n'a pas touchées. *C'est le seul geste qui transforme « vaut pour
-- les lignes nouvelles » en « vaut pour toutes ».* Les deux entrées quittent
-- `CONTRAINTES_NON_VALIDEES` dans le même commit, et le gardien exige ce
-- retrait — c'est ainsi que le dépôt le constate.

ALTER TABLE "intervention" VALIDATE CONSTRAINT "intervention_suspension_a_son_motif";
ALTER TABLE "intervention" VALIDATE CONSTRAINT "intervention_suspension_a_sa_date";
