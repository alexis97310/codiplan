# Captures — 9CL-RETOUCHES-2A-REPRISE

Écran du parc (le seul retouché par ce ticket) + un écran témoin par groupe du menu
(`nav.groupe_exploitation`, `nav.groupe_clients_parc`, `nav.groupe_parametres`), pour confirmer que
l'échelle typographique D143 (ticket 9CG) rend correctement une fois publiée par ce ticket.

| | |
|---|---|
| **Commit AVANT** | `cdcff11` — dernier commit de 9CL avant la retouche d'espacement du parc (fusion de 9CG + mémoire de `tsc`), c'est-à-dire l'état « constat 30 encore rouge » |
| **Commit APRÈS** | `9183b17` — la retouche d'espacement du parc |
| **Date de la prise** | 2026-10-01, ~04h35 UTC |
| **Base** | PostgreSQL 16 local et jetable (`E2E_DATABASE_URL`), rempli par `prisma migrate deploy` + `pnpm db:seed` — aucune donnée réelle (I9) |

## Comment elles ont été prises

AVANT a été rejoué sur un `git worktree` isolé au commit `cdcff11`, servi sur le port 3101 avec le
même `DATABASE_URL`/`BETTER_AUTH_SECRET` que `playwright.config.ts` construit pour `pnpm test:e2e`.
APRÈS a été joué sur le dépôt courant (port 3100, `pnpm exec playwright test` avec son propre
`webServer`). Les deux pointent vers la même base locale jetable, jamais l'hébergée. Le script de
capture était un fichier temporaire (`tests/e2e/zz-captures-9cl.spec.ts`), retiré après la prise —
il ne forge aucune scène, il lit la démonstration du semis (`pnpm db:seed`).

**Hauteur de viewport 900 px pour ces captures** (contre 800 px dans `parc-tri.spec.ts:239`, qui
mesure le nombre exact de pixels) : à 900 px la différence AVANT/APRÈS reste visible à l'œil (une
ligne de machine supplémentaire) sans que le bas de l'écran ne coupe la carte de droite. La mesure
au pixel près (459,2 px → 487,2 px à 800 px de haut) est celle de `parc-tri.spec.ts:249`, pas de ces
captures — voir le commit `9183b17` et la passation.

## Les écrans

- `parc-{1280,1024,375}-{avant,apres}.png` — la liste du parc. **AVANT**, à 1280 px : la liste
  s'arrête à « Tractel X-200 », le groupe « GARAGE DU NORD » suivant est coupé. **APRÈS** : une
  ligne de plus est visible (« Nussbaum SPL-4000 »— le début du groupe « GARAGE DU NORD »), parce
  que `rect.top` du bloc `[data-bloc="liste-machines"]` remonte de 32 px (les deux `-mt-4`). À 1024
  et 375 px, la disposition passe à une colonne — la liste occupe alors toute la largeur et le
  même geste d'espacement s'applique, sans régression mesurée (voir la mesure ci-dessous).
- `tableau-de-bord-1280-{avant,apres}.png`, `clients-1280-{avant,apres}.png`,
  `imports-1280-{avant,apres}.png` — un écran témoin par groupe du menu. Ce ticket ne les touche
  pas : ils confirment seulement que l'échelle D143 (déjà publiée par le commit `cdcff11`, avant la
  retouche du parc) rend à l'identique une fois ce ticket ajouté — AVANT et APRÈS sont, à l'œil et à
  la mesure, indiscernables sur ces trois écrans.

## La mesure du script de captures

`scripts/lib/mesure-captures.ts` (mêmes seuils que partout ailleurs : D138 texte < 12 px, D143 hors
échelle, D143 point 11 texte 12/13 px sous 700 de graisse) — identique AVANT et APRÈS sur les six
écrans communs aux deux passes :

| Écran | Largeur | Textes < 12 px | Hors échelle | Légers < 700 (12/13 px) | Débordement |
|---|---|---|---|---|---|
| `parc` | 1280 | 0 | 0 | 0 | 0 |
| `parc` | 1024 | 0 | 0 | 0 | 74 |
| `parc` | 375 | 0 | 0 | 0 | 0 |
| `tableau-de-bord` | 1280 | 0 | 0 | 8 | 0 |
| `clients` | 1280 | 0 | 0 | 0 | 0 |
| `imports` | 1280 | 0 | 0 | 0 | 0 |

**Aucune régression introduite par ce ticket** sur ces six colonnes : les mêmes nombres AVANT et
APRÈS. Le débordement de 74 px à 1024 px sur `/parc` est PRÉEXISTANT (nommé par 9CB comme un écart
non lié à la typographie, hors territoire de ce ticket — voir aussi la passation de 9CG). Les 8
« légers » de `/tableau-de-bord` sont `CLASSES_LIEN_TUILE` (« Voir X sur le planning → », etc.),
l'exemption fermée et nommée par `tests/unit/ui/retouches-2a.test.ts` (réservée à
9CH-RETOUCHES-2B-COMPOSANTS, hors territoire de ce ticket aussi).

Ce que cette mesure NE couvre PAS : la hauteur visible de la liste (480 px). C'est
`tests/e2e/parc-tri.spec.ts:249` qui la tient, avec ses propres nombres (459,2 → 487,2 px), cités
dans le message du commit `9183b17` et dans la passation.
