# Captures — 9CTA-REPRISE-9CT

`planning-vue-jour-avant-*.png` / `planning-vue-jour-apres-*.png` — `/planning?vue=jour`,
scène de démonstration (`prisma/seed.ts`), à 1280 px et 375 px.

- `*-avant-*.png` — rejoué sur le code d'AVANT ce lot (`git worktree` sur le commit
  `1d80437`, 9CT-RETOUCHES-5 — passation, le dernier commit reporté de la branche garde,
  juste avant le déplacement).
- `*-apres-*.png` — après le commit de ce lot (`0890980`, 9CTA-REPRISE-9CT — la liste des
  laissées sous la grille).

## Ce que la paire montre

AVANT : le bloc « Laissées, à compléter » se rend AU-DESSUS de la grille — son volume
(13 lignes au motif « Date passée », sur la scène de démonstration mesurée le 03/10/2026)
pousse la légende de la vue Jour (« 4 techniciens · 20 créneaux libres · pas de 30 min »)
et la grille elle-même hors du cadre visible à 1280×800, ce qui faisait échouer
`tests/e2e/planning-jour-en-tete.spec.ts:102`.

APRÈS : la légende et la grille se rendent juste après la bannière « Calendriers
d'agence respectés », visibles sans défiler ; le bloc « Laissées, à compléter » se rend
désormais APRÈS la grille — même contenu, même ordre de lignes, seule sa place a changé.

`vue-jour-legende-et-laissees.png` — capturé par le garde-fou e2e neuf
(`tests/e2e/planning-laissees-sous-la-grille.spec.ts`), sur sa propre scène forgée
(préfixe `9CTA-`, une Planifiée complète mais passée) : la légende reste dans le cadre
ET la liste des laissées, plus bas, porte la ligne forgée.

## Piège connu — le compte de lignes « Date passée » dérive avec le temps

Comme documenté dans `docs/propositions/9CT-RETOUCHES-5/captures/README.md` : le jeu de
démonstration pose des Planifiées sur des dates qui s'éloignent chaque jour un peu plus
d'aujourd'hui. Le nombre exact de lignes de la liste des laissées (13 ici, mesuré le
03/10/2026) n'est pas un invariant.
