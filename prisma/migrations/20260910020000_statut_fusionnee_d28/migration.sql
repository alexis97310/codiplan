-- ═══════════════════════════════════════════════════════════════════════════
-- D28 — LE STATUT `fusionnee` ENTRE DANS L'ÉNUMÉRATION. Nuit du 10/09/2026.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- D28 (rang 1) écrit que la fiche absorbée par une fusion de doublons « passe
-- au statut fusionnee ». L'énumération a été fermée à L2-01 à cinq valeurs sans
-- relire la décision qui en nommait une sixième — ne jamais fermer une
-- énumération avant d'avoir lu ce qui la nomme déjà (§9, 20/08, variante).
-- Le rang 1 l'emporte : la valeur est ajoutée.
--
-- Ce qu'elle veut dire est écrit dans D28 : l'état TERMINAL de la fiche
-- absorbée, qui garde son qr_token et dont la résolution rend la survivante.
-- Son seul producteur est la fusion de L3-10 ; jusque-là, rien ne l'écrit.
-- Un ajout de valeur, et rien d'autre : aucune ligne n'est touchée.

ALTER TYPE "StatutMachine" ADD VALUE 'fusionnee';
