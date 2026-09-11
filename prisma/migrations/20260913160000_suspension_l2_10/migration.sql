-- ═══════════════════════════════════════════════════════════════════════════
-- LA SUSPENSION, ET LA FILE « EN ATTENTE DE PIÈCE » (L2-10, RG-INT-06)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- > *« Une intervention SUSPENDUE porte un motif et, pour une attente de pièce,
-- > la référence attendue et la date de disponibilité prévisionnelle. »*
-- > (RG-INT-06)
--
-- Le statut `suspendue` existait depuis D84 ; **rien ne portait le motif**, et
-- une intervention pouvait donc s'arrêter sans qu'on sache pourquoi.
--
-- ## AUCUNE ÉNUMÉRATION DE MOTIFS N'EST INVENTÉE
--
-- Le chapitre 10 n'en pose pas. *Fermer une énumération avant d'avoir tranché à
-- qui l'on vend est une erreur que ce dépôt a déjà faite* (§9, 20/08 — les dix
-- rôles arrêtés à neuf). Ce qui DÉSIGNE l'attente de pièce est donc la présence
-- de `piece_attendue_ref`, et non un code choisi ici.

ALTER TABLE "intervention"
  ADD COLUMN "motif_suspension"   text,
  ADD COLUMN "piece_attendue_ref" text,
  ADD COLUMN "date_dispo_prevue"  date,
  ADD COLUMN "suspendue_le"       timestamptz(3);

-- L'ANCIENNETÉ D'UNE SUSPENSION SE LIT, ELLE NE SE RECONSTITUE PAS.
-- Le journal d'audit porte l'instant du changement de statut ; *une trace n'est
-- pas un index*, et la file de L2-10 comme l'alerte « > 30 jours » du chapitre
-- 16.1 la liraient à chaque affichage. `cloturee_le` et `annulee_le` existent
-- pour la même raison : la table date chacun de ses états d'arrêt.
CREATE INDEX "intervention_societe_id_piece_attendue_idx"
  ON "intervention" ("societe_id", "suspendue_le")
  WHERE "piece_attendue_ref" IS NOT NULL;

-- ───────────────────────────────────────────────────────────────────────────
-- LES ÉQUIVALENCES, ÉCRITES DANS LES DEUX SENS
-- ───────────────────────────────────────────────────────────────────────────
--
-- *Le second sens est celui qu'on oublie.* Une suspension sans motif laisse une
-- intervention arrêtée sans qu'on sache pourquoi ; un motif posé sur une
-- intervention qui suit son cours dit qu'elle est arrêtée alors qu'elle ne
-- l'est pas.
--
-- ## DEUX D'ENTRE ELLES SONT `NOT VALID`, ET C'EST UNE DÉCISION (D104)
--
-- **Cette migration a cassé la production.** Écrite contre une base neuve, où
-- toute ligne respecte la règle par construction, elle a été jouée contre une
-- base qui portait déjà des interventions `suspendue` — nées avant que le motif
-- existe, donc sans motif. `23514`, puis `P3018` : les six autres migrations en
-- retard sont restées coincées derrière, et `/planning` a rendu une exception
-- serveur pendant plus de quatre heures.
--
-- **Les lignes antérieures n'ont pas de motif, et personne ne peut en écrire un
-- pour elles.** Un motif inventé serait une donnée que personne n'a énoncée ;
-- et `suspendue_le` est pire encore — *aucune valeur de date ne dit son propre
-- inconnu*, et celle qu'on écrirait alimenterait l'ancienneté que la file
-- « en attente de pièce » affiche et que l'alerte « > 30 jours » du chapitre
-- 16.1 surveille. **On ne fabrique pas l'âge d'une attente.**
--
-- `NOT VALID` dit exactement ce qu'on veut dire : *la règle vaut pour toute
-- ligne NOUVELLE ou MODIFIÉE, et les lignes d'avant ne sont pas relues.*
-- PostgreSQL l'applique à chaque `INSERT` et à chaque `UPDATE` — une ligne
-- ancienne qu'on touche doit donc se mettre en règle, et c'est le seul moment
-- où quelqu'un est là pour dire le motif. *Une échéance qui tombe au meilleur
-- moment n'est pas un report* (§9, 30/08, pris à l'endroit).
--
-- **Ce qui serait silencieux est refusé.** L'état non validé est VISIBLE :
-- `scripts/lib/contraintes-non-validees.ts` en tient la liste close, gardée
-- dans les deux sens, et `pnpm veille` la confronte chaque nuit à la base
-- hébergée. Une contrainte posée `NOT VALID` sans décision rougit ; une
-- contrainte de la liste devenue valide rougit aussi — c'est le sens qu'on
-- oublie, et c'est celui du rattrapage accompli.
--
-- **Les DEUX AUTRES restent VALIDÉES, et c'est mesuré** : `piece_attendue_ref`
-- et `date_dispo_prevue` viennent de naître, elles valent `NULL` partout, et
-- les deux équivalences sont donc vraies de toute ligne existante. Les poser
-- `NOT VALID` aurait affaibli sans cause, et ajouté deux entrées permanentes à
-- une liste qui doit se vider.

ALTER TABLE "intervention"
  ADD CONSTRAINT "intervention_suspension_a_son_motif" CHECK (
    ("statut" = 'suspendue') = ("motif_suspension" IS NOT NULL)
  ) NOT VALID,
  ADD CONSTRAINT "intervention_suspension_a_sa_date" CHECK (
    ("statut" = 'suspendue') = ("suspendue_le" IS NOT NULL)
  ) NOT VALID,
  -- RG-INT-06 exige les DEUX pour une attente de pièce. Une référence sans
  -- date ferait une file d'attente **sans horizon** — exactement ce que
  -- l'alerte du chapitre 16.1 est censée surveiller.
  ADD CONSTRAINT "intervention_piece_attendue_a_son_horizon" CHECK (
    ("piece_attendue_ref" IS NOT NULL) = ("date_dispo_prevue" IS NOT NULL)
  ),
  -- Et une attente de pièce n'existe que SOUS une suspension : une référence
  -- posée sur une intervention en cours dirait qu'on attend sans s'être arrêté.
  ADD CONSTRAINT "intervention_piece_attendue_suppose_la_suspension" CHECK (
    "piece_attendue_ref" IS NULL OR "statut" = 'suspendue'
  );

-- ───────────────────────────────────────────────────────────────────────────
-- LA REPRISE EFFACE CE QUI NE VAUT PLUS, ET LA BASE S'EN CHARGE
-- ───────────────────────────────────────────────────────────────────────────
--
-- Les quatre contraintes ci-dessus refusent une intervention reprise qui
-- garderait son motif. **Laisser l'appelant les remettre à NULL lui-même serait
-- une seconde lecture du même critère** — et le jour où un chemin l'oublierait,
-- l'écriture serait refusée par une contrainte au message technique plutôt que
-- par une règle lisible.
--
-- Le déclencheur nettoie donc À LA SORTIE du statut `suspendue`. Il ne décide
-- rien : il applique ce que les contraintes exigent déjà.

CREATE OR REPLACE FUNCTION "intervention_sortie_de_suspension"()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."statut" = 'suspendue' AND NEW."statut" <> 'suspendue' THEN
    NEW."motif_suspension"   := NULL;
    NEW."piece_attendue_ref" := NULL;
    NEW."date_dispo_prevue"  := NULL;
    NEW."suspendue_le"       := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- **Le NOM décide de l'ordre**, et c'est une décision. PostgreSQL exécute les
-- déclencheurs `BEFORE` d'une même table dans l'ordre ALPHABÉTIQUE de leur nom :
-- `intervention_cycle_de_vie` < `intervention_sortie_de_suspension`. Le cycle
-- de vie prononce donc ses refus AVANT que ce nettoyage n'ait lieu — *un refus
-- ne doit jamais s'appuyer sur des colonnes qu'un voisin vient d'effacer.*
CREATE TRIGGER "intervention_sortie_de_suspension" BEFORE UPDATE ON "intervention"
  FOR EACH ROW EXECUTE FUNCTION "intervention_sortie_de_suspension"();

COMMENT ON COLUMN "intervention"."motif_suspension" IS
  'RG-INT-06 : exigé dès que le statut est « suspendue », et refusé sinon — les deux sens. Texte LIBRE : le chapitre 10 ne pose aucune énumération de motifs, et fermer une énumération avant d''avoir tranché à qui l''on vend est une erreur que ce dépôt a déjà faite.';

COMMENT ON COLUMN "intervention"."piece_attendue_ref" IS
  'Ce qui DÉSIGNE une attente de pièce : sa présence dit que la suspension en est une. Aucun code de motif n''est inventé pour cela. RG-INT-06 exige qu''elle aille avec sa date de disponibilité prévisionnelle — une référence sans date ferait une file d''attente sans horizon, ce que l''alerte « > 30 jours » du chapitre 16.1 surveille précisément.';

COMMENT ON COLUMN "intervention"."suspendue_le" IS
  'Quand la suspension a commencé. L''ANCIENNETÉ s''en déduit, et rien d''autre ne la porte : le journal d''audit garde la trace du changement de statut, mais une trace n''est pas un index. Effacée par « intervention_sortie_de_suspension » à la reprise.';

COMMENT ON CONSTRAINT "intervention_suspension_a_son_motif" ON "intervention" IS
  'POSÉE « NOT VALID » (D104) : elle vaut pour toute ligne nouvelle ou modifiée, et les interventions suspendues ANTÉRIEURES à L2-10 ne sont pas relues — elles n''ont pas de motif, et personne ne peut en énoncer un à leur place. L''état non validé est tenu par scripts/lib/contraintes-non-validees.ts et observé chaque nuit par « pnpm veille » ; le rattrapage est au backlog.';

COMMENT ON CONSTRAINT "intervention_suspension_a_sa_date" ON "intervention" IS
  'POSÉE « NOT VALID » (D104), et pour une raison plus forte encore que sa jumelle : aucune valeur de date ne dit son propre inconnu. Une date inventée alimenterait l''ancienneté que la file « en attente de pièce » affiche et que l''alerte « > 30 jours » du chapitre 16.1 surveille — on ne fabrique pas l''âge d''une attente.';
