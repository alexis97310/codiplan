# Captures — 9BT-TP-A5-LIBELLES

Prises le 29/09/2026.

- APRÈS photographié contre `main` au commit `e233820` (dernier commit de
  code du lot, avant cette passation).
- AVANT photographié contre le commit `11dc4da` (dernier commit de `main`
  avant ce lot), depuis un `git worktree` jetable — jamais en modifiant le
  code livré pour reculer.
- Les deux passages jouent les **mêmes fichiers**, `tests/e2e/
  captures-tpa5-libelles.spec.ts` et `tests/e2e/
  captures-tpa5-libelles-throwaway.spec.ts` (committés, inertes sous
  `pnpm test:e2e` ordinaire, ils n'écrivent rien sans leurs variables
  d'environnement `CAPTURES_TPA5`/`CAPTURES_TPA5_TAUX`). Aucune clé `fr[...]`
  n'y est lue, à dessein : ni fichier n'importe le dictionnaire.
- Deux largeurs par scène : 1280 px et 375 px. `fullPage`.

## Deux fichiers, deux bases

`captures-tpa5-libelles.spec.ts` tourne contre la base **partagée** de bout
en bout (`E2E_DATABASE_URL=…/codiplan_test`), en lecture et navigation
seules — parc, fiche machine, clients, refus de clôture.

`captures-tpa5-libelles-throwaway.spec.ts` exige une base **jetable
dédiée** (`E2E_DATABASE_URL=…/codiplan_captures_tpa5`, recréée par la
préparation globale à chaque invocation, détruite après) : PA-11 pose un
deuxième taux horaire daté du passé, et PA-18/PA-19 remplacent le catalogue
de déplacement par une seule ligne scopée à une zone — deux mutations qui
changeraient ce que d'autres scénarios (`taux-horaire-succession.spec.ts`,
`ecrans-largeur-utile.spec.ts`) mesurent si elles étaient écrites sur la
base partagée. Un gardien en tête du fichier refuse de s'exécuter si
`E2E_DATABASE_URL` nomme `codiplan_test`.

## Les sept scènes

| Fichier (préfixe) | Ce qui change |
|---|---|
| `parc-apercu-agence` | `/parc?machine={id}` — AVANT : `dt` compose « Agence CODIMA » ; APRÈS : « Agence » seul (PV-02, écart de contenu nommé) |
| `fiche-machine-agence` | `/parc/{id}` — même écart, côté fiche |
| `clients-badges` | `/clients?sans_equipement=1` — AVANT : badge vert « Active », badge gris « inactive » ; APRÈS : « Actif »/« Inactif », masculin comme le reste du produit (CS1) |
| `fiche-refus-temps-manquant` | `/interventions/{id}?motif=intervention.refus.temps_manquant` — AVANT : « ... se traite dans Winpro au moment de facturer. » ; APRÈS : « ... dans votre logiciel de facturation ... » (TR-53) |
| `taux-horaire-remplace` | `/parametres/taux-horaire` (base jetable, deuxième taux au 01/01/2018) — AVANT : cellule Statut vide pour l'ancien taux ; APRÈS : « Remplacé le 01/01/2020 » (PA-11) |
| `forfaits-zone-avec-deplacement` | `/parametres/forfaits?zone=grand_noumea` (base jetable) — AVANT : la prestation affiche aussi « Retenu » ; APRÈS : « Non appliqué par le calcul aujourd'hui » — le déplacement seul reste « Retenu » (PA-18) |
| `forfaits-zone-sans-deplacement` | `/parametres/forfaits?zone=sud` (base jetable, aucun forfait de déplacement scopé à cette zone) — AVANT : aucune phrase, la section se tait ; APRÈS : « Aucun forfait de déplacement pour cette zone : le déplacement n'est pas facturé. » (PA-19) |

## Non capturé — `/portail`

Aucun compte portail ne peut ouvrir de session aujourd'hui (D10 —
`utilisateur_societe.count` vaut zéro pour un compte portail,
`reemettreJetonPremierAcces` le refuse) : un scénario Playwright bute sur
`/connexion`. Même constat documenté par
`docs/propositions/ERGO-PRISE-DE-VUE/passation.md` — refus attendu, pas une
régression de ce lot. Les deux libellés touchés (`portail.sous_titre_avant/
apres`, `portail.sans_lieu_avant/apres`) sont couverts par un test unitaire
de rendu à la place : `tests/unit/portail/presentation.test.ts`.
