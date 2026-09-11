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

ALTER TABLE "intervention"
  ADD CONSTRAINT "intervention_suspension_a_son_motif" CHECK (
    ("statut" = 'suspendue') = ("motif_suspension" IS NOT NULL)
  ),
  ADD CONSTRAINT "intervention_suspension_a_sa_date" CHECK (
    ("statut" = 'suspendue') = ("suspendue_le" IS NOT NULL)
  ),
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
