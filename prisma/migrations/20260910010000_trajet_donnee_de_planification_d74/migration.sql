-- ═══════════════════════════════════════════════════════════════════════════
-- D74 — LE TRAJET EST UN FORFAIT : `site.temps_trajet_min` EST UNE DONNÉE DE
-- PLANIFICATION, ET RIEN D'AUTRE. Décision d'exploitation du 09/09/2026,
-- inscrite dans la nuit du 10/09.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Le déplacement se facture par un forfait conditionné par zone (RG-TAR-06),
-- un seul par intervention (D11) ; le temps de trajet ne s'ajoute JAMAIS aux
-- heures facturées (RG-INT-07 amendée). Sans cette phrase, quelqu'un
-- additionnerait un jour `temps_trajet_min` aux heures et facturerait le
-- déplacement deux fois — une fois par le forfait, une fois au temps.
--
-- La dépendance est écrite LÀ OÙ QUELQU'UN LA LIRA, sur le modèle de D56 : la
-- règle métier, le schéma Prisma, le code qui rend la colonne, l'aide du champ
-- à l'écran — et ici, sur la colonne elle-même, pour qui ouvrira une console
-- sans ouvrir le dépôt. Cette migration ne change AUCUNE donnée, AUCUNE
-- contrainte, AUCUNE politique : un commentaire, et rien d'autre.

COMMENT ON COLUMN "site"."temps_trajet_min" IS
  'DONNEE DE PLANIFICATION, ET RIEN D''AUTRE (D74) : calcul de charge et tournees. Ne s''ajoute JAMAIS aux heures facturees - le deplacement se facture par forfait de zone (RG-INT-07, RG-TAR-06). Temps de trajet de reference en minutes, DEPUIS site.agence_id (D23, D56, RG-PLA-05) : le declencheur trajet_suit_agence refuse de changer agence_id sans revoir cette valeur. NULL = pas de mesure, estimation par zone.';
