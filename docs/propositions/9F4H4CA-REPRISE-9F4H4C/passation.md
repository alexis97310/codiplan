# 9F4H4CA-REPRISE-9F4H4C — passation

## Cause

La vérification indépendante du 20/10 avait trouvé rouge `tests/e2e/offline/
9f4h3a-file-sans-perte.spec.ts:368` (« captures (point 7) ») : `getByRole("alertdialog")`
introuvable au clic sur « Se déconnecter », aussi au réessai.

`rafraichirEtat` (`components/terrain/effacement-copie-locale.tsx`) lisait
d'abord `lireCopie()` : si l'instantané de consultation était ABSENT en
IndexedDB au moment du clic — son écriture dépend d'un `fetch` réseau qui
court contre `context.setOffline`, sans garantie d'ordre —, l'état devenait
inconditionnellement `{ identite: null, n: 0 }`, et la déconnexion partait
SANS question même si la file des saisies (`lib/terrain/file-saisies.ts`,
magasin IndexedDB séparé, jamais vidé par l'absence d'instantané) contenait
des entrées en attente. C'était un défaut du produit, pas seulement de
l'épreuve : D115-3 (déconnexion avec saisies non envoyées → confirmation) ne
distingue pas selon que l'instantané existe.

## Correction

- `lib/terrain/file-saisies.ts` : nouvelle fonction exportée
  `compterEnAttenteToutesIdentites()` — compte la file ENTIÈRE de l'appareil
  (`toutesLesEntrees().length`, catch → 0), pour le cas où l'identité de la
  file reste inconnue sans instantané.
- `components/terrain/effacement-copie-locale.tsx` :
  - `Confirmation.identite` devient `Identite | null`.
  - `rafraichirEtat` : quand `lireCopie()` résout `null`, appelle
    `compterEnAttenteToutesIdentites()` au lieu de figer `n` à `0`.
  - Les deux branches de `surSoumission` (lecture déjà arrivée, et lecture en
    attente derrière `premiereLecturePromesseRef`) ne sautent plus la
    question sur `identite === null` — seul `n === 0` laisse partir la
    déconnexion directement.
  - Sans identité connue, le bouton « Envoyer d'abord » n'est plus rendu
    (l'envoi a besoin de l'identité pour cibler la file) ; seuls le message
    de comptage existant et « Se déconnecter quand même » restent affichés.
  - `deconnecterQuandMeme` est inchangée : `effacerCopie()` (no-op sans
    copie), marque, `requestSubmit()` — la file des saisies n'est jamais
    effacée par la déconnexion.
- Aucune clé i18n neuve — les trois clés déjà en place
  (`saisies_non_envoyees_singulier/pluriel`, `deconnecter_quand_meme`)
  suffisent.

## Mesures

- Unitaires neufs (`tests/unit/terrain/effacement-copie-locale.test.tsx`,
  describe « sans instantané, la file compte quand même ») : instantané
  absent + file non vide (2) → question posée, pas de bouton « Envoyer
  d'abord » ; instantané absent + file vide (0) → déconnexion directe, une
  seule fois (`effacerCopie` une fois, pas de `requestSubmit` espion inutile,
  pas d'`alertdialog`). Les trois épreuves déjà en place pour la fenêtre
  avant la première lecture restent vertes à l'identique (mock par défaut de
  `compterEnAttenteToutesIdentites` → `0`, comportement « file vide »
  retrouvé).
- `tests/unit/terrain/effacement-copie-locale.test.tsx` +
  `tests/unit/terrain/file-saisies.test.ts` : 24 passés.
- `pnpm test` (unitaires, dépôt entier) : 459 fichiers, 4907 tests, verts.
- `pnpm typecheck`, `pnpm lint`, `pnpm format` : verts, rien à reformater.
- `tests/e2e/offline/9f4h3a-file-sans-perte.spec.ts` seule, 5 fois,
  `CI=1 --workers=1` : 3 passed à chaque run (15/15).
- `tests/e2e/interventions-2.spec.ts` (fichier entier), 3 fois,
  `CI=1 --workers=1` : 5 passed à chaque run (15/15), aucun `ERR_ABORTED`.
- `tests/e2e/deconnexion.spec.ts` + `tests/e2e/offline/` (tout le dossier),
  `CI=1 --workers=1` : 15 passed.
- `CI=1 pnpm verify:full` (ce fichier, en entier) : 1420 passed, 48 skipped,
  0 failed — 15 dernières lignes ci-dessous.

```
MESURE bandeau-deplacement-differe@1280 — textes<12px: 0, cibles<32px: 0, débordement: 0
·············································°°·················
·······································································[Better Auth WARN — base URL non définie, sans conséquence]
·········
················································································
················································································
·········[Better Auth WARN — base URL non définie, sans conséquence]
·······································································
················································································
················································································
··°·°·············°····························································°
°°°°°°°°°°°°°°°°°°°°°°°°°°°°
  48 skipped
  1420 passed (55.7m)
::notice title=🎭 Playwright Run Summary::  48 skipped%0A  1420 passed (55.7m)
```

`git rev-parse --short HEAD` au moment de cette passation : `1eb6e9ee`
(avant rebase sur `origin/main`, qui n'avait pas avancé depuis — voir
ci-dessous).

## État du dépôt

Branche dédiée `9F4H4CA-REPRISE-9F4H4C`, créée depuis `origin/main`
(`main` est extrait dans un autre worktree) ; les deux commits de la garde
`9F4H4C-DECONNEXION-SANS-COURSE-garde` ont été rejoués par `cherry-pick`
avant ce correctif. `git fetch origin` puis `git rebase origin/main` : rien
de neuf côté `origin/main`, rebase sans effet. Arbre propre.
