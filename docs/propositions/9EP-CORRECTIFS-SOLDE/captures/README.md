# Captures — 9EP-CORRECTIFS-SOLDE-CREATIONS

AVANT : commit `8e9b760a` (base de mesure du solde).
APRÈS : ce lot, commit final (passation).
Date : 10/10/2026.

Scène : fixture dédiée au lot (préfixe `9EP-`), créée en `beforeAll` et supprimée en `afterAll`
par `tests/e2e/captures-9ep-correctifs.spec.ts` — jamais `SCENE.*`. AVANT rejoué dans un `git
worktree` jetable posé sur `8e9b760a` (copie du spec et de `tests/e2e/setup/scene-9ep.ts`, pris
sur HEAD) ; APRÈS rejoué sur ce lot une fois livré.

## Fichiers

- `parc-nouvelle-{avant,apres}-{1280,375}.png` — `/parc/nouvelle` (points 48, 49) : l'aide de la
  famille est sortie du `<label>` du select (AVANT/APRÈS identiques en apparence, le changement
  est dans le nom accessible — voir `tests/unit/ui/lot-parc.test.ts`, solde point 48). Point 49
  (refus serveur « statut_creation ») n'a pas de capture dédiée : les trois statuts refusés
  (remplacée/ferraillée/fusionnée) ne sont pas des options du formulaire de création — le refus
  est une garde serveur, inatteignable par un geste à l'écran — voir le test unitaire dédié
  (`tests/unit/machines/creer-route-statut.test.ts`) et le rendu (`tests/unit/ui/lot-parc.test.ts`,
  solde point 49).
- `parc-modifier-{avant,apres}-{1280,375}.png` — `/parc/<id>/modifier` (point 46) : AVANT montre
  le bouton générique gris (régression de D184) ; APRÈS montre le bouton bleu de l'action
  primaire, retrouvé.
- `clients-nouveau-homonymes-0-{avant,apres}-{1280,375}.png` — `/clients/nouveau`, aucun
  homonyme : aucune alerte. Visible aussi : AVANT, le bouton « ? » est DANS le label du code
  Winpro (Q10) ; APRÈS, il en est sorti.
- `clients-nouveau-homonymes-1-{avant,apres}-{1280,375}.png` — un seul homonyme : AVANT et APRÈS
  montrent la même alerte au SINGULIER (« Un client du même nom existe déjà »), inchangée par ce
  lot.
- `clients-nouveau-homonymes-2-{avant,apres}-{1280,375}.png` — deux homonymes : AVANT montre
  encore le texte au singulier (défaut mesuré, solde point 40 Q8) ; APRÈS montre le texte au
  PLURIEL (« Des clients du même nom existent déjà »).
- `sites-nouveau-{avant,apres}-{1280,375}.png` — `/sites/nouveau` (point 38) : rendu identique —
  la société de la scène porte plusieurs agences actives, donc aucune présélection CS41 dans
  les deux captures (voir la note du point 38 en passation : pas d'épreuve e2e à agence
  unique).

## Ce qui n'a manqué sur aucune des deux phases

Toutes les captures prévues (`/parc/nouvelle`, `/parc/<id>/modifier`, `/clients/nouveau` à 0/1/2
homonymes, `/sites/nouveau`) se sont rejouées sans écart de sélecteur entre `8e9b760a` et ce lot
— contrairement à 9EK-1 (voir `docs/propositions/9EK-TP-UX5-2-CREATIONS-1/captures/README.md`,
solde point 42), aucun champ n'a disparu ni changé de nom entre les deux commits.
