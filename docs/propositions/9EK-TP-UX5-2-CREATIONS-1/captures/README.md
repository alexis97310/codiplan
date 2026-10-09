# Captures — 9EK-TP-UX5-2-CREATIONS-1

Commit photographié : `b5d848b7` (APRÈS).
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

## AVANT (solde 9EP point 42, 10/10/2026)

Rejoué `tests/e2e/captures-9ek-creations-1.spec.ts` (copie prise sur HEAD) dans un `git worktree`
jetable posé sur `171a3cc8` — le parent du commit A/B de ce lot (`54972a96`), donc l'état du
produit juste avant que 9EK-1 ne commence.

- `clients-nouveau-vide-avant-{1280,375}.png`
- `clients-nouveau-doublon-avant-{1280,375}.png`
- `sites-nouveau-depuis-client-avant-{1280,375}.png`

### Ce qui manque, et pourquoi

**`sites-nouveau-refus-saisie-gardee` n'a pas d'AVANT.** Mesuré : le formulaire de
`/sites/nouveau` à `171a3cc8` ne porte ni `input[name="adresse"]` ni
`textarea[name="consignes_acces"]` — ses seuls champs sont `agence_id`, `libelle`, `commune`,
`zone_geo` et `temps_trajet_min` (`grep 'name="' "app/(back-office)/sites/nouveau/page.tsx"` sur
ce commit). La scène qui remplit l'adresse et les consignes n'a donc littéralement rien à
remplir sur l'écran d'avant : ces deux champs sont arrivés avec le gabarit du 28/09 que ce lot
installe. Aucun contournement n'a été tenté — un AVANT qui ne montrerait pas ces champs
comparerait deux écrans différents sans le dire.

Par ailleurs, `830dd761` (cité par une version antérieure de ce fichier comme commit « APRÈS »)
n'est pas un objet atteignable depuis `main` : le commit réel de cette série est `b5d848b7`,
corrigé ci-dessus.
