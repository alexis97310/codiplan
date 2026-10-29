# 9I7B2-PIECES-CORRECTIFS-DE-REVUE — passation

Revue (lecture seule) de 9I7B + reprise 9I7B0, publiés le 30/10 à 09:22
(`4a9740ff`), avait relevé deux défauts HAUTS, confirmés par le pilote. Les
six points du ticket sont traités ci-dessous, un par un.

## Point 1 — absent ≠ vide, une ancienne entrée de file ne touche plus aux pièces

`gesteReconnu` (`lib/terrain/file-saisies.ts`, cas « rapport ») posait
`pieces: piecesReconnues(g.pieces)` sur TOUTE entrée reconnue, qu'elle ait
porté `pieces` ou pas — `piecesReconnues(undefined)` rendait `[]`. Une entrée
écrite avant 9I7B, ou par un appelant qui ne connaît pas les pièces, rejouée
depuis la file, EFFAÇAIT les pièces déjà en base au premier envoi (via
`envoi-file.ts`, qui postait alors `pieces_remplacees=[]`, et
`enregistrerRapportTexte` qui remplace intégralement l'ensemble sur un
tableau présent — même vide).

Corrigé : `pieces` vaut désormais `undefined` quand `g.pieces` brut n'est pas
un tableau (absent, `null`, ou toute forme qui n'est pas un array) ;
`piecesReconnues` n'est appelée que sur un tableau RÉELLEMENT présent, et
continue de filtrer les éléments individuels de forme inconnue.
`envoi-file.ts` (`corpsDe`, cas « rapport ») n'émet le champ
`pieces_remplacees` QUE si `geste.pieces !== undefined` — un geste sans
pièces ne poste plus jamais `[]`.

Épreuves :
- `tests/unit/terrain/file-saisies.test.ts` — nouveau bloc
  « pièces : ABSENT ≠ VIDE » (absent → `undefined`, `[]` explicite reste `[]`,
  élément malformé filtré) ; les trois anciennes attentes `pieces: []` sur des
  gestes qui ne portaient jamais `pieces` sont corrigées (elles figeaient le
  défaut).
- `tests/unit/terrain/envoi-file.test.ts` — nouveau bloc « corpsDe —
  `pieces_remplacees` » : capture le corps réel envoyé à `fetch`, vérifie
  l'absence du champ sans `pieces`, sa présence (`"[]"`) avec `pieces: []`.

## Point 2 — le type est contrôlé au SERVEUR, jamais seulement à l'écran

`enregistrerRapportTexte` ne lisait jamais `type` de l'intervention ; la route
acceptait des pièces pour n'importe quel type, le filtrage ne vivant qu'à
l'écran (`afficherPieces`). Un appelant direct de la route (ou un ancien
écran) pouvait donc poser des pièces sur un préventif, une installation, etc.

Corrigé : `enregistrerRapportTexte` sélectionne désormais `type`, et refuse
EN BLOC — avant toute écriture, même doctrine que le refus `estFige`
déjà en place — quand `pieces_remplacees !== undefined` et que
`!aSectionPiecesRemplacees(type)` (curatif/garantie/reprise seulement).
Motif nommé : `terrain.rapport.pieces_type_refuse`. Rien ne s'écrit : ni les
pièces, ni le commentaire, ni la suite.

Épreuve : `tests/isolation/rapport-terrain.test.ts` — « des pièces envoyées
sur un type qui n'en porte pas sont refusées EN BLOC » (type de
`INTERVENTION_A2` basculé en `preventif_contrat` par un `UPDATE` direct,
restauré en `curatif` en `finally` — le déclencheur de cycle de vie ne garde
que `statut`, jamais `type`).

## Point 3 — champ mal formé : la route refuse, elle n'avale plus en silence

`piecesOuAbsentes` (route.ts) rendait `undefined` aussi bien pour un champ
ABSENT que pour un champ PRÉSENT mais invalide (JSON cassé ou schéma violé) —
la route répondait alors « Rapport enregistré » en ignorant silencieusement
des pièces que le technicien croyait avoir envoyées.

Corrigé : `piecesLues` distingue désormais trois issues (absent / présent et
valide / présent et invalide) ; le second cas refuse tout le rapport avant
d'appeler `enregistrerRapportTexte` — motif `terrain.rapport.pieces_invalides`.

Épreuves : `tests/unit/interventions/terrain-routes-json.test.ts` — quatre cas
nouveaux (JSON invalide, schéma violé, absent → `undefined` transmis au
dépôt, valide → tableau décodé transmis), avec `enregistrerRapportTexte`
mocké pour vérifier qu'il n'est PAS appelé sur les deux premiers.

## Point 4 — borne haute de quantité

`quantite` ne portait qu'un plancher (`min(1)`). Ajouté `.max(9999)` dans
`schemaPieceRemplacee` (`lib/interventions/depot-rapport-terrain.ts`) et la
même borne côté écran (`components/terrain/rapport-automatique.tsx`, clamp
`Math.min(9999, Math.max(1, …))`), sans migration : la borne est applicative.
Couvert par le schéma lui-même (pas de nouvelle épreuve dédiée, cohérent avec
les épreuves existantes de `pieces-remplacees.test.ts` qui bornent déjà les
autres champs).

## Point 5 — idempotence au rejeu

Déjà garanti par construction : `enregistrerRapportTexte` REMPLACE
intégralement l'ensemble des lignes à chaque appel (`deleteMany` puis
`createMany`), donc un rejeu du même geste (réponse perdue puis second envoi)
produit le même état final, jamais une série doublée — seuls les `id`
internes changent, jamais le nombre de lignes ni leur contenu.

Épreuve ajoutée : `tests/isolation/rapport-terrain.test.ts` — « rejoué deux
fois avec les MÊMES pièces... : une seule série de lignes » (deux appels
identiques, vérifie le contenu ET `count(*) = 2`, pas 4).

## Point 6 — offline spec et motif codé en dur

**6a — `tests/e2e/offline/9f4h1-consultation.spec.ts` : POINTS OUVERTS.**
Cette épreuve choisit sa fiche dynamiquement (`premiereFiche`, le premier
lien d'intervention affiché sur « Ma journée ») parmi les interventions de la
scène PARTAGÉE (`tests/e2e/setup/scene.ts`). Mesuré : cette scène ne pose
QUE des interventions de type `preventif_contrat` (`grep 'type:' scene.ts` —
une seule occurrence, ligne 498, appliquée à toutes les lignes du tableau) —
aucune curative/garantie/reprise n'existe un jour donné pour le technicien de
cette épreuve. Affirmer la présence/absence de « Ajouter une pièce » dans la
coquille hors réseau exigerait soit de modifier la scène PARTAGÉE (hors
territoire de ce ticket, risque de régression sur les dizaines d'autres
spécs qui s'appuient sur son contenu exact), soit de forcer un type fixe
(contredirait le choix délibéré de `premiereFiche`, qui ne dépend d'aucun
état précis). La présence/absence par type EST déjà couverte, en ligne, par
`tests/e2e/9i7b-pieces-remplacees.spec.ts` (`CURATIF_SAISIE` → présente,
`PREVENTIF_ABSENCE` → absente) sur sa propre scène dédiée. Rejoué quand même
tel quel pour confirmer l'absence de régression : vert (voir ci-dessous).

**6b — motif `/^Envoyer \(\d+\)$/` codé en dur : CORRIGÉ.**
`tests/e2e/9i7b-pieces-remplacees.spec.ts` (~l.304) comparait le bouton de la
file à un texte français en dur. Remplacé par un `RegExp` construit sur
`fr["terrain.file.envoyer"]` (la même clé que `BoutonEnvoyer`), suivi du
compte entre parenthèses — seule occurrence de ce motif explicitement visée
par le territoire de ce ticket ; les occurrences du même motif dans d'autres
spécs (`9f4h3-mode-avion.spec.ts`, etc.) sont hors territoire et non touchées.

## Épreuves rejouées

- `pnpm vitest run tests/unit/terrain/file-saisies.test.ts
  tests/unit/terrain/envoi-file.test.ts
  tests/unit/interventions/pieces-remplacees.test.ts` — 63/63 verts.
- `pnpm vitest run --project isolation tests/isolation/rapport-terrain.test.ts`
  — 27/27 verts (3 nouveaux).
- `pnpm test:isolation` (suite complète) — 194 fichiers, 1708 tests, tous
  verts.
- `pnpm test` (suite unitaire complète) — 485 fichiers, 5265 tests, tous
  verts.
- `pnpm typecheck`, `pnpm lint`, `pnpm format:check` — verts.
- `npx playwright test tests/e2e/9i7b-pieces-remplacees.spec.ts
  tests/e2e/offline/9f4h1-consultation.spec.ts` — 4/4 verts (seed+migrations
  rejoués depuis zéro).

`CI=1 pnpm verify:full` est lancé en entier à la suite de ce document, sortie
dans `verify-final.txt` ci-contre.

## Territoire — rien touché hors de sa liste

`prisma/` : aucune migration (point 4 est applicative, point 2/3 ne changent
aucune colonne). Format de stockage de la file : aucune clé ni version
nouvelle — seule la valeur `undefined` vs tableau d'un champ déjà optionnel
change de sens à la LECTURE. `depot/`, `11-FILE.sh` : non touchés.
