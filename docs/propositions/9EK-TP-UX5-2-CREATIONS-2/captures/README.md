# Captures — 9EK-TP-UX5-2-CREATIONS-2

Commit photographié : AVANT = `e6854342` (`origin/main`, avant ce lot — page inchangée depuis
`eb17c838`, via un *worktree* temporaire). APRÈS = en cours (non encore poussé).
Date : 09/10/2026 (Nouméa).

Scène : fixture dédiée au ticket (préfixe `9EKMCAP-`), créée en `beforeAll` et supprimée en
`afterAll` par `tests/e2e/captures-9ekm-creations-2.spec.ts` — jamais `SCENE.*`. Les deux
captures AVANT n'ont besoin d'aucune fixture (page sans donnée affichée) et viennent d'un spec
jetable, jamais committé, lancé dans le worktree temporaire (9EKB-REPRISE-9EK-2).

## Fichiers

- `nouvelle-machine-avant-{1280,375}.png` — `/parc/nouvelle`, AVANT ce lot (`e6854342`) : une
  seule carte sans section, modèle puis n° de série puis client/site puis une grille de huit
  champs facultatifs, criticité et statut en `<select>`, aucun « (facultatif) », bouton unique
  « Enregistrer ».
- `nouvelle-machine-vide-{1280,375}.png` — `/parc/nouvelle?client=…&site=…`, tel qu'on y arrive
  depuis la fiche d'un site : trois sections numérotées, client et site préremplis, famille sans
  rien choisi, aucune case cochée pour l'état ou la criticité.
- `nouvelle-machine-famille-choisie-{1280,375}.png` — même écran, une famille choisie dans la
  section 2 : le sélecteur de modèle, remonté, ne propose que le modèle de cette famille.
- `nouvelle-machine-refus-numero-serie-{1280,375}.png` — après un envoi avec un numéro de série
  déjà pris par le même modèle : le refus s'affiche SOUS le champ, en rouge, la saisie reste à
  l'écran (aucun second bandeau).
- `nouvelle-machine-apres-creer-et-ajouter-{1280,375}.png` — après « Créer et en ajouter une
  autre » : un formulaire neuf, motif de succès en vert, client et site repris dans l'URL.
- `corriger-la-fiche-apres-{1280,375}.png` — `/parc/[id]/modifier`, APRÈS ce lot : preuve que le
  mode modification n'a pas bougé (pas de capture AVANT nécessaire pour cet écran précis — il
  n'est pas dans le territoire du ticket).

## Ce qui manque, et pourquoi

**Aucune capture AVANT** de `/parc/[id]/modifier` (« Corriger la fiche ») — cet écran n'est pas
dans le territoire du ticket, et son rendu n'a pas changé : la capture APRÈS seule suffit à en
porter la preuve.

**Obstacle technique rencontré, par la session garde (02/26-02:35, 09/10)** : `pnpm run build`
(donc le serveur de `pnpm test:e2e`) échouait par épuisement mémoire sous son plafond d'alors
(`--max-old-space-size=3072`) — la phase de vérification des types du build Next.js sortait de ce
plafond. Résolu depuis par 9EO-TAS-DU-BUILD (plafond relevé à 4096 Mo dans `package.json`, mesuré
sur deux essais consécutifs) : les captures AVANT ci-dessus (session 9EKB-REPRISE-9EK-2, reprise)
ont été prises sans aucun contournement, plafond de production inchangé.
