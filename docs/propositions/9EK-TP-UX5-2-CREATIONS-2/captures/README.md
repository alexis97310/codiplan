# Captures — 9EK-TP-UX5-2-CREATIONS-2

Commit photographié : en cours (APRÈS ce lot, non encore poussé).
Date : 09/10/2026 (Nouméa).

Scène : fixture dédiée au ticket (préfixe `9EKMCAP-`), créée en `beforeAll` et supprimée en
`afterAll` par `tests/e2e/captures-9ekm-creations-2.spec.ts` — jamais `SCENE.*`.

## Fichiers

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

**Aucune capture AVANT** de `/parc/nouvelle` lui-même (même limite que celle documentée dans
`docs/propositions/9EK-TP-UX5-2-CREATIONS-1/captures/README.md`, le ticket jumeau de la première
moitié de TP-UX5-2) : le budget a été consacré en priorité à l'implémentation (trois sections,
famille, « Je ne peux pas le lire », trois états, refus sous le champ, « Créer et en ajouter une
autre »), aux épreuves unitaires (31/31 vertes, `tests/unit/ui/lot-parc.test.ts`), aux épreuves
bout en bout neuves (3/3 vertes, `tests/e2e/9ekm-creations-2.spec.ts`) et à la décision D184.
L'écran AVANT ce lot (une seule carte, sans section, criticité et statut en `<select>`) est décrit
dans le constat du ticket et dans D184 plutôt que photographié.

**Obstacle technique rencontré** : `pnpm run build` (donc le serveur de `pnpm test:e2e`) échoue
par épuisement mémoire sous son plafond habituel (`--max-old-space-size=3072`) dans cet
environnement au moment de ce lot — la phase de vérification des types du build Next.js sort de
ce plafond. Les captures ci-dessus ont été obtenues en relevant ce plafond à 6144 Mo le temps de
la prise, puis en le reposant à sa valeur d'origine (`git diff package.json` ne montre aucun écart
avant ce commit). Si ce plafond rougit à nouveau pour un lot futur, ce n'est pas un défaut de ce
lot-ci.
