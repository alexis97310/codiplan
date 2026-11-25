# 9L42B-LOCALISATEURS-STATUS-TERRAIN — passation

## Constat de départ

9L42 (publié, `3a1a6ef95`) a posé `role="status"` sur la pastille réseau
(`components/terrain/pastille-reseau.tsx`, ligne ~89), visible sur `/terrain`
(Ma journée) et `/terrain/profil`. Sur « Ma journée », un second
`role="status"` existe déjà — le message d'annonce des nouvelles
interventions (`components/terrain/liste-journee.tsx`, ligne ~113,
`libelleAnnonceNouvelles`). Les deux coexistent dans le DOM dès qu'il y a au
moins une intervention non ouverte.

`tests/e2e/captures-9f4h5b-journee-sans-montant.spec.ts:155` faisait
`expect(page.getByRole("status")).toBeVisible()` sans filtre : dès que la
pastille et le message d'annonce sont visibles ensemble, Playwright lève
« strict mode violation: resolved to 2 elements ». 9L42A n'a pas commité sa
correction avant d'épuiser son budget ; le défaut est resté sur `main`.

## Ce qui a été fait

1. **`role="status"` conservé** sur la pastille réseau — c'est l'annonce
   accessible du changement de réseau, le rôle est correct et n'a pas été
   touché.
2. **`captures-9f4h5b-journee-sans-montant.spec.ts:155`** : le localisateur
   vise désormais précisément le message d'annonce,
   `page.getByRole("status").filter({ hasText: /transmis/ })`. Le motif
   `/transmis/` est commun aux deux formes du libellé (`terrain.nouvelles.
   singulier` → « …transmise », `terrain.nouvelles.pluriel` → «
   …transmises ») : il reste correct quel que soit le nombre de lignes non
   ouvertes au moment du test, sans dépendre d'un compte exact qui varie
   selon les autres données de la société de l'épreuve. Il ne matche pas la
   pastille réseau (« En ligne » / « Hors ligne » / « N en attente »), qui ne
   contient jamais ce mot.
3. **Revue de toutes les occurrences `getByRole("status")` des e2e** (`grep
   -rn` sur `tests/e2e/`, 40 fichiers). Démarche : j'ai d'abord isolé, parmi
   ces 40, les fichiers dont le contenu mentionne « terrain » (12 fichiers),
   puisque la pastille réseau n'est rendue que sur `app/(mobile)/terrain/
   page.tsx` et `app/(mobile)/terrain/profil/page.tsx` — elle n'existe nulle
   part ailleurs (vérifié par `grep -rln PastilleReseau app/ components/`).
   Résultat, fichier par fichier :
   - `9ec-absences-gabarit.spec.ts`, `9g8g-declaration-sans-lien-bureau.
     spec.ts`, `9g8f-declaration-absence-formulaire-seul.spec.ts` (2
     occurrences) : tous sur `/absences`, jamais sur `/terrain` ni
     `/terrain/profil` — la pastille n'y est pas rendue, aucune ambiguïté
     possible. Laissés tels quels.
   - `captures-9f4h2a-fin-avant-debut.spec.ts`, `fiche-trouver-creneau.
     spec.ts`, `9k21-checklist-terrain-saisie.spec.ts`,
     `9l14-fige-a-la-cloture.spec.ts`, `captures-9l08b-saisie-apres-
     demarrer.spec.ts`, `offline/9f4h3a-file-sans-perte.spec.ts`,
     `offline/9f4h3-mode-avion.spec.ts` : déjà `.filter({ hasText: … })`
     sur une clé `fr[...]` précise — déjà précis, et la plupart ouvrent
     `/terrain/[id]` (la fiche), où la pastille n'est pas rendue non plus.
     Laissés tels quels.
   - `indicateurs-donnees.spec.ts:310` : `toHaveCount(0)` sur `/parametres/
     donnees` — sans rapport avec `/terrain`. Laissé tel quel.
   - J'ai aussi vérifié spécifiquement toutes les visites e2e de
     `/terrain/profil` (`grep -rl '/terrain/profil' tests/e2e/`, 8
     fichiers) : aucune n'enchaîne un `getByRole("status")` non filtré
     juste après — `offline/9f4h3a-file-sans-perte.spec.ts` y navigue bien,
     mais son seul appel `getByRole("status")` (ligne 382) précède cette
     navigation et est déjà filtré.

   Aucune autre occurrence à corriger : `captures-9f4h5b-journee-sans-
   montant.spec.ts:155` était la seule ambiguë.

## Épreuves jouées

- `pnpm test:e2e tests/e2e/captures-9f4h5b-journee-sans-montant.spec.ts` —
  2 passed.
- `pnpm test` — 540 fichiers, 6095 tests, vert.
- `pnpm test:isolation` — 267 fichiers, 2578 tests, vert.
- `CI=1 pnpm verify` (format:check + typecheck + lint + test + test:
  isolation + build) — vert.
- `pnpm verify:full` NON joué (laissé à la file, comme demandé).

## Ce qui reste ouvert

Rien d'identifié. Aucune migration, aucune règle d'arbitrage nouvelle — ce
lot est une correction pure de localisateur e2e, sans changement de code
produit.
