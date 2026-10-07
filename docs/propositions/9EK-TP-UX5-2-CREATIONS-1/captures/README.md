# Captures — 9EK-TP-UX5-2-CREATIONS-1

Commit photographié : `830dd761` (APRÈS, cette série uniquement — voir « Ce qui manque » ci-dessous).
Date : 08/10/2026, matin (Nouméa).

Scène : fixture dédiée au ticket (préfixe `9EKCAP-`), créée en `beforeAll` et supprimée en
`afterAll` par `tests/e2e/captures-9ek-creations-1.spec.ts` — jamais `SCENE.*`.

## Fichiers

- `clients-nouveau-vide-{1280,375}.png` — `/clients/nouveau`, formulaire vide : section
  « Identité », colonne « Ensuite » numérotée, pied avec « Annuler » / « Créer et ajouter un
  site » / « Créer le client ».
- `clients-nouveau-doublon-{1280,375}.png` — même écran, raison sociale tapée en minuscules
  sans respecter la casse d'un client existant (même forme normalisée) : l'alerte de doublon
  nomme la fiche homonyme (lien, commune, nombre de sites), non bloquante.
- `sites-nouveau-depuis-client-{1280,375}.png` — `/sites/nouveau?client=…&motif=clients.cree`,
  tel qu'on y arrive depuis « Créer et ajouter un site » : bandeau de succès en vert, client
  prérempli, colonne « Sites existants de ce client » (« Aucun pour l'instant »).
- `sites-nouveau-refus-saisie-gardee-{1280,375}.png` — même écran, après un refus serveur
  (libellé vidé) : bandeau rouge, client/agence/adresse/consignes conservés dans le formulaire.

## Ce qui manque, et pourquoi

**Aucune capture AVANT.** Le recueil AVANT/APRÈS habituel (rejouer le même fichier de capture
dans un `git worktree` posé sur le commit qui précède ce lot, puis sur le commit livré) n'a pas
été fait : le budget du lot a été consacré en priorité à l'implémentation, aux épreuves
unitaires/isolation/bout en bout (toutes vertes, voir la passation) et à la décision D181. Les
quatre captures ci-dessus suffisent à vérifier le rendu APRÈS contre la maquette ; elles ne
prouvent pas, par la comparaison, ce qui a changé visuellement depuis `main`. À refaire si une
preuve AVANT/APRÈS est exigée pour ce ticket précis.
