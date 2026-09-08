-- ═══════════════════════════════════════════════════════════════════════════
-- Q4 — `forfait.heures_incluses_minutes` EST RETIRÉE
-- Arbitrage d'exploitation du 09/09/2026. Tranche la composition forfait/taux.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ## La règle, tranchée par l'exploitation
--
-- **Un forfait est un montant fixe qui vient EN PLUS du temps passé.** Il
-- n'absorbe jamais d'heures ; la notion d'« heure excédentaire » ne s'applique
-- pas aux forfaits.
--
-- ## Conséquence : la colonne ne modélise RIEN
--
-- `heures_incluses_minutes` a été posée à L1-06 sans consommateur, en attendant
-- que la composition soit tranchée. Elle l'est : **le cas qu'elle modélise
-- n'existe pas.**
--
-- *Une colonne qui modélise un cas qui n'existe pas est pire qu'une colonne
-- absente* — quelqu'un finira par « l'implémenter », et il implémentera une
-- règle que personne n'a décidée. C'est exactement la famille du mécanisme de D4
-- que le dépôt vient de retirer plutôt que d'arbitrer entre ses moitiés
-- (L1-05) : on ne garde pas un dispositif au motif qu'il pourrait servir.
--
-- ## LA RÉCIPROQUE, ÉCRITE PARCE QU'ELLE SERA UN JOUR INVOQUÉE
--
-- Si une société a un jour besoin qu'un forfait inclue du temps, **ce sera un
-- besoin réel avec un cas réel derrière** — un contrat, un client, un devis à
-- honorer. Ce ne sera pas « la colonne existait déjà ». La question à poser ce
-- jour-là est celle que Q4 a posée : *quelle intervention, chez quel client,
-- serait facturée de travers sans cela ?*

ALTER TABLE "forfait" DROP CONSTRAINT IF EXISTS "forfait_heures_incluses_positives";
ALTER TABLE "forfait" DROP COLUMN "heures_incluses_minutes";

COMMENT ON TABLE "forfait" IS
  'Catalogue de forfaits d''une société (chapitre 4.3, RG-TAR-06). La TABLE existe, elle naît VIDE : quels forfaits mettre au catalogue et à quels montants est une question d''exploitation. Le montant est un entier en unités les plus fines, avec sa devise (I2, I3). UN FORFAIT S''AJOUTE TOUJOURS AUX HEURES (arbitrage du 09/09/2026, Q4) : c''est un montant fixe qui vient EN PLUS du temps passé, il n''absorbe aucune heure, et la notion d''heure excédentaire ne s''applique pas à lui. C''est pourquoi heures_incluses_minutes a été retirée.';
