# Captures — 9DQ-TP-NAV1-HUB-AGENCES

`apres/` : jouées par `tests/e2e/captures-9dq-tp-nav1-hub-agences.spec.ts`
(`CAPTURES_9DQ`, `CAPTURES_9DQ_FASE=apres`), sur le code livré — hub en
sections avec la carte Identité, liste des établissements (PA-31 : les
groupes de jours à horaires identiques, « Lun–Ven » puis « Sam »), fiche
d'une agence (« Agence Dolbeau », territoire et fuseau en liste), création
d'une agence (territoire sans valeur par défaut, fuseau sur « Hérite de la
société »).

**`avant/` n'a pas été prise** : la recette à deux passes (rejouer ce fichier
depuis un worktree posé sur le commit de départ, puis sur le code livré) n'a
pas été exécutée faute de temps dans cette session. L'état antérieur est
documenté par les constats de l'audit du 28/09/2026 cités dans la décision
D167 (`docs/arbitrages.md`) — hub à onze portes plates, titre « Sociétés &
tarifs », colonne « Horaires » au seul premier jour travaillé, adresses
partagées entre agence et calendrier.

À 1280 px (hub, menu, liste, fiche, création) et 375 px (hub).
