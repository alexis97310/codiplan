# Passation — 9CS-EN-RETARD-VERT-A-ZERO

Dépôt `alexis97310/codiplan`, `main` local. Trois commits : `54fe6d5` (le code — `tonEnRetard`
et D148), `e754d6c` (captures AVANT/APRÈS), et celui de cette passation. **Migration :
NON.** Aucun push.

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

La tuile « En retard » du tableau de bord passe au ton **vert** quand le compte est à
zéro — jusqu'ici elle restait rouge même à zéro, alors qu'elle était déjà muette (sans
lien, D144). Au-dessus de zéro, rien ne change : rouge, comme aujourd'hui. Pour
l'exploitation : un responsable qui ouvre le tableau de bord et voit cette tuile verte sait
d'un coup d'œil qu'aucune intervention n'est en retard, sans avoir à lire le chiffre.

`tonEnRetard(compte)` (`app/(back-office)/tableau-de-bord/presentation.ts`) rend `"vert"`
à 0, `"rouge"` au-dessus — fonction pure, câblée dans la tuile `kpi-en-retard`
(`app/(back-office)/tableau-de-bord/page.tsx`) à côté de `lienEnRetard` (D144, inchangée).
Seul le filet de 3 px de la tuile change de couleur (`CLASSES_FILET` de
`components/ui/kpi.tsx`, `TonKpi` déjà existant, `"vert"` déjà employé par
`kpi-occupation`) — aucune couleur nouvelle, aucune dépendance nouvelle.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

**Constat re-mesuré sur `main` au départ (`e785ae5`, bf3623f cité par le ticket est un
ancêtre)** : la tuile `kpi-en-retard` portait `ton="rouge"` sans condition
(`page.tsx:444`), comme décrit par le ticket.

**Garde-fou (`presentation.test.ts`)** : ROUGE constaté avant l'ajout de la fonction
(`tonEnRetard` n'existait pas, import impossible) ; VERT après. `tonEnRetard(0)` →
`"vert"` ; `tonEnRetard(1)` et `tonEnRetard(7)` → `"rouge"` (le cas qui doit rester vert :
au-dessus de zéro, rien ne bouge). Un troisième test statique relit `page.tsx` et vérifie
que la balise `<Kpi` du bloc `kpi-en-retard` passe bien `ton={tonEnRetard(`.

**Captures AVANT/APRÈS** : le seed de démonstration pose aujourd'hui **15** interventions
« en retard » sur CODIMA Nouvelle-Calédonie (mesuré par la capture elle-même, affichage
« INTERVENTIONS EN RETARD 15 ») — la tuile reste donc au-dessus de zéro, et les deux
captures (`git worktree` sur `e785ae5` pour l'avant, `54fe6d5` pour l'après) sont
**identiques au bit près** (`cmp`, exit 0) à 1280 et 375 px. Le cas « 0 → vert » n'est
visible nulle part à l'écran avec la scène actuelle ; il est prouvé par le test unitaire
(voir `docs/propositions/9CS-EN-RETARD-VERT-A-ZERO/captures/README.md`).

**`CI=1 pnpm verify:full`, en entier, un seul appel, premier plan** : EXIT 0. Toutes les
étapes enchaînées : `format:check`, `typecheck`, `lint`, `test` (3707 tests, 361 fichiers,
verts), `test:isolation`, `build`, `feries:horizon`, `audit:partitions`, `test:e2e` (765
passés, 7 ignorés, 30,5 min).

## Ce que j'ai tranché et pourquoi

- **Pas de capture à 0** plutôt que de forger une scène qui annule les 15 interventions en
  retard du seed : I9 (aucune ligne de semis), et le piège connu du ticket sur les
  épreuves qui comptent large — vider la scène partagée aurait pu fausser une autre
  épreuve e2e lancée en parallèle (`fullyParallel`). La preuve retenue est le test
  unitaire, comme le ticket l'anticipait déjà (« sinon un spec de captures en lecture
  seule ne peut pas forcer 0 »).
- **La valeur n'est pas teintée**, seul le filet — cohérence avec les autres tuiles
  (`kpi-occupation` ne teinte pas non plus sa valeur), choix déjà fait implicitement par
  D148 côté décision et repris tel quel ici.
- **Le ton au-dessus de zéro reste rouge**, pas orange comme la maquette (`"warn"`) — non
  décidé par Alexis (point 4 ne couvre que le cas 0), donc non touché.

## Ce que je n'ai PAS fait

- Pas d'orange au-dessus de zéro (non tranché, voir ci-dessus).
- Pas de teinte sur la valeur affichée de la tuile.
- Pas de capture montrant la tuile verte à l'écran (scène de démonstration à 15, voir
  « Ce que j'ai mesuré »).
- Aucune migration, aucune ligne de semis.

## Les pièges pour la session suivante

- Le seed de démonstration (`prisma/seed.ts`) pose aujourd'hui 15 interventions « en
  retard » pour CODIMA-NC — si un futur ticket veut une capture de la tuile verte, il
  faudra soit une scène dédiée et nettoyée par l'épreuve elle-même (jamais la scène
  partagée), soit attendre que le seed change.
- `tests/e2e/captures-pg-c1b-en-retard-tableau.spec.ts` (existant, non touché) montre déjà
  ce même renoncement : son message `« En retard » ne vaut pas 0 au moment de l'épreuve
  (16) — capture non prise, voir le README` est apparu pendant `verify:full` de ce lot —
  rien d'anormal, c'est le gardien d'un AUTRE ticket qui se comporte comme prévu.
- `tests/unit/docs/amendements-arbitrages.test.ts` porte une liste fermée
  `AMENDEMENTS_ATTENDUS` : toute nouvelle décision qui amende une décision existante doit y
  ajouter sa paire, sinon le gardien rougit (rencontré et corrigé dans ce lot : `["D144",
  "D148"]`).

## Ce qui reste à faire

Pour Alexis (rien de bloqué) :
- La valeur de la tuile n'est pas teintée en vert — aucune tuile du tableau de bord ne
  l'est, cohérence retenue plutôt que suivre la maquette au pixel près.
- Au-dessus de zéro, la tuile reste rouge alors que la maquette du 28/09 y met l'orange
  (« warn ») — à trancher s'il le souhaite ; une nouvelle décision rouvrirait D148 plutôt
  que d'étendre silencieusement le ton.
