# 9L08D-TERRAIN-TAILLES-MAQUETTE — passation

## Décision d'Alexis

16/11/2026 (~09h15 NC) : « 2 — suivre la maquette, 17 et 13-14 px, en rouvrant D143. » Consignée en
**D263** (`docs/arbitrages.md`), qui amende D143 (point 8) pour la seule zone `data-zone="terrain"` posée
par D252 — le plancher 16/18/24/28 px tient partout ailleurs, inchangé.

## Ce qui a changé

1. **`docs/arbitrages.md`** — D263, nouvelle décision. Câblée dans `tests/unit/docs/amendements-arbitrages.test.ts`
   (`["D143", "D263"]`) et dans D143 elle-même (`**Amendé par D263.**`). `tests/unit/docs/citations-decisions-code.test.ts`
   dérive sa population du dépôt : aucune liste à tenir à jour pour les citations `D263` posées dans le code.
2. **`app/globals.css`** — `--text-17: 17px;` (nouvelle). Documentée comme une exception de ZONE, pas une neuvième
   taille de l'échelle générale de D138 : `tests/unit/theme/echelle-typographique.test.ts` la vérifie à part
   (`SUPPLEMENT_ZONE_TERRAIN`), et son propre test l'empêche de se mêler aux huit tailles de la spec.
3. **`app/(mobile)/terrain/[id]/page.tsx`** (en-tête de la fiche) :
   - le nom du client : `text-18` → `text-17` ;
   - la ligne « matériel · n° d'intervention » : `text-16` → `text-14` ;
   - **le chrono n'a pas bougé** (reste `text-16`) : la maquette du 13/11 ne nomme sa taille nulle part, seulement
     sa position (« à droite ») — ce n'est ni un libellé, ni une commande, mais une valeur affichée au même rang
     que les autres mesures de la fiche. Si Alexis veut une taille précise pour le chrono, c'est une réouverture
     de D263.
4. **`tests/unit/ui/retouches-2a.test.ts`** (point 8) — `TAILLES_TERRAIN` passe de `[16, 18, 24, 28]` à
   `[13, 14, 16, 17, 18, 24, 28]`. Un guard neuf refuse qu'un `<dt>` ou un `<label>` des sept fichiers porte
   lui-même une taille sous 16 px (le « jumeau » que le ticket demandait : « un libellé à 14 px doit faire
   échouer ») — construit sur une forme FABRIQUÉE, puisque rien dans le dépôt ne la viole aujourd'hui. Le test
   « reconnaît la forme qu'il refuse » qui prenait `text-13` comme exemple de taille hors échelle a été corrigé
   (`text-15`, toujours hors échelle) puisque 13 y entre désormais.

## Ce qui N'A PAS changé, et pourquoi

- **`components/terrain/liste-journee.tsx` (Ma journée) et `components/terrain/consultation-hors-reseau.tsx`
  (coquille hors réseau)** : ni l'un ni l'autre ne figure dans la population du point 8 (les sept fichiers que
  `retouches-2a.test.ts` nomme), et ni D252 ni D253 n'y documentent de substitution 18/16 px à corriger. Le point 3
  du ticket demandait d'appliquer les tailles « là où 9L04C/9L04D ont posé 18/16 px à la place » — cette
  substitution documentée n'existe QUE dans l'en-tête de la fiche en ligne. Les deux écrans restent donc à leurs
  tailles actuelles (16 px pour leurs textes secondaires). Si Alexis veut aussi 13-14 px sur ces deux écrans,
  c'est une extension du périmètre de D263 à nommer.
- **`components/terrain/checklist-terrain.tsx`** (titres de rubrique, textes secondaires, « Obligatoire ») :
  déjà à 13 px depuis D253 (point 11, la graisse) — ce fichier n'a jamais été dans la population du point 8 (la
  taille), seulement dans celle du point 11. Rien à faire ici.
- **Le chrono de l'en-tête** : voir point 3 ci-dessus.
- **`components/terrain/consultation-hors-reseau.tsx` — l'en-tête de la fiche hors réseau elle-même**
  (fonction `Fiche`, ligne ~449) : son client est rendu en `text-24` avec le lien « Retour » sur une ligne
  séparée — PAS la forme « une ligne, retour + client » que D252 (point 5) décrit en prose pour ce fichier.
  Écart mesuré pendant ce lot, hors budget : ce fichier n'est de toute façon pas dans la zone de D263 (il n'est
  pas gouverné par le plancher du point 8), donc rien à faire ICI, mais la description de D252 et le code
  semblent avoir divergé sur CE point précis. À signaler, pas tranché.

## Contrastes AA (texte secondaire 13-14 px, `#5B6472` sur blanc)

Calculé (luminance relative WCAG 2.1, formule sRGB standard) : ratio **5,98:1**. Le seuil AA pour un texte
normal est 4,5:1 — la paire passe largement, y compris si elle n'était pas « texte large » (3:1). Le jeton
`--app-terrain-encre-secondaire` (#5b6472, D252) n'a pas changé de valeur dans ce lot ; seule sa taille
d'emploi change par endroits.

## Captures (375 px, AVANT/APRÈS)

`docs/propositions/9L08D-TERRAIN-TAILLES-MAQUETTE/captures/` — scène dédiée, recette de
`zz-captures-9l04c-terrain-style-epure.spec.ts` (intervention en cours + modèle de checklist générique à un
point). Cinq écrans : `entete-fiche`, `rubrique-checklist`, `rubrique-photos`, `ma-journee`,
`coquille-hors-reseau`. Seul `entete-fiche` diffère à l'octet (client non tronqué « 9L08D — Client de
capture » à 17 px, contre « 9L08D — Client de capt... » tronqué à 18 px) — les quatre autres sont identiques
avant/après, preuve que rien d'autre n'a bougé.

**Piège rencontré et corrigé** : le premier jet du script capturait `page.locator("header").first()`, qui
attrapait le `<header>` du bandeau de navigation mobile (`components/navigation/bandeau-mobile.tsx`), posé
AVANT celui de la fiche dans le DOM — identique avant/après par construction, donc un faux « rien n'a changé ».
Corrigé en `main header`.

**`scripts/captures.mts` (la prise de vue GLOBALE de `docs/captures/`) n'a PAS été rejouée** dans ce lot, faute
de budget (90 minutes, et cette commande exige un cycle complet base jetable + migration + semis + build +
cinquante écrans) — aucun des lots 9L04D à 9L04K n'a non plus de trace dans `docs/captures/README.md` pour
cette raison. Les deux écrans qu'elle photographie et que ce lot touche (`terrain`, `terrain-intervention`) sont
donc datés d'avant D263 dans `docs/captures/`. Si Alexis veut ces deux images à jour, c'est un geste séparé,
hors budget de ce ticket.

## Épreuves jouées au premier plan

`pnpm test` (5922 tests ; une seule panne, `atteignabilite-ecrans.test.ts`, un timeout de 5 s sous charge
parallèle — rejouée seule, verte ; flake préexistant, non lié à ce lot), `pnpm test:isolation` (2274 tests,
vert), les captures e2e ci-dessus. `CI=1 pnpm verify` à suivre.

## Aucune migration

Conforme à l'interdit du ticket.

## Reprise 9L08DA

**Cause du recalage, mesurée par le pilote** : les deux passages de `verify` tombaient sur
`tests/unit/navigation/atteignabilite-ecrans.test.ts:158` (délai de 5 s dépassé sous charge), aucune autre
panne. Corrigée par `9L08A0-ATTEIGNABILITE-ECRANS-RAPIDE`, déjà présent sur `origin/main` au moment de cette
reprise (vérifié avant d'ouvrir la branche). Les fichiers `tickets/recales/9L08D-TERRAIN-TAILLES-MAQUETTE.md`
et `traces/9L08D-TERRAIN-TAILLES-MAQUETTE-verify-{1,2}.txt` que le ticket de reprise donnait comme référence
sont introuvables dans ce dépôt (aucun worktree, aucun commit, aucune trace) — signalé avant d'agir ; le
contenu utile (cause mesurée, décision D261→D263) était déjà dans le prompt de reprise et dans cette
passation, donc le lot a continué plutôt que de s'arrêter sur un fichier absent sans rapport avec les deux
conditions d'ARRÊT IMMÉDIAT (toutes deux fausses : `origin/main` ne porte aucun commit
`9L08D-TERRAIN-TAILLES-MAQUETTE`, et la branche `-garde` existe).

**Ce qui a changé par rapport à la garde** : les six commits de `9L08D-TERRAIN-TAILLES-MAQUETTE-garde` ont été
reportés tels quels par `git cherry-pick`, puis un seul conflit réel résolu — `docs/arbitrages.md` : pendant
que ce lot dormait, `origin/main` avait pris D261 (9L08-EN-TETES-SECURITE) et D262 (9L08B-SAISIE-APRES-
DEMARRER). La décision des tailles de la zone terrain, numérotée D261 dans la garde, devient **D263** (le
numéro libre sur `origin/main` au moment du rebase, comme prévu par le ticket). Renommé partout où D261
désignait cette décision précise : `docs/arbitrages.md` (section + `**Amendé par D263.**` dans D143),
`app/(mobile)/terrain/[id]/page.tsx`, `tests/unit/ui/retouches-2a.test.ts`,
`tests/unit/theme/echelle-typographique.test.ts`, `tests/unit/docs/amendements-arbitrages.test.ts`, cette
passation, `tests/e2e/zz-captures-9l08d-terrain-tailles-maquette.spec.ts`. Les D261/D262 propres à
9L08-EN-TETES-SECURITE et 9L08B-SAISIE-APRES-DEMARRER (dans leurs propres fichiers et passations) n'ont pas
été touchés — ce ne sont pas la même décision.

**Effet de bord découvert à `pnpm verify`** : `tests/unit/docs/coherence-backlog.test.ts` a rougi — le texte
de D143 cité par huit tickets du backlog (L1-01, L1-05b, L1-11, L3-04b, L3-06, L3-16, L7-01, L7-02) avait déjà
son empreinte mise à jour par le point 1 de la garde (contre le texte « D261 »), et a changé une seconde fois
avec le renommage en « D263 » ; remplacé par les huit nouvelles empreintes que le gardien a lui-même rendues
(`8397d9bc→76c68695`, `1033e84f→6b0e0043`, `117472c8→c5fa5730`, `b331ce91→457cac60`, `4ef3fbf3→09aab8a4`,
`90d7c95a→713af7a5`, `1c558d86→83b9af62`, `bfdbd1de→57902232`).

**Point 3 du ticket de reprise (localisateurs e2e de la même famille)** : rien à rendre précis. Le diff de ce
lot ne change que des classes Tailwind de taille (`text-18→text-17`, `text-16→text-14`) sur deux éléments déjà
existants — aucun libellé, aucun bouton, aucune structure DOM nouvelle ou renommée. Le seul piège de
localisateur de ce lot (`header` non scopé attrapant le bandeau mobile) était déjà dans la scène de capture
elle-même et déjà corrigé par la garde (`main header`). Recherché dans `tests/e2e/**` les `locator("header")`
non scopés sur d'autres scènes (`terrain-largeur.spec.ts`, `planning-bandeau-au-dessus-colonne-figee.spec.ts`,
`vgp-finitions.spec.ts`, `selecteurs-1.spec.ts`) : aucun ne vise la fiche `/terrain/[id]`, aucun n'est affecté
par ce lot.

**Épreuves rejouées au premier plan** : `tests/unit/navigation/atteignabilite-ecrans.test.ts` cinq fois de
suite (vert, ~3,5-3,8 s chacune, loin des 5 s) ; `tests/e2e/zz-captures-9l08d-terrain-tailles-maquette.spec.ts`
et `tests/e2e/tous-les-ecrans-rendent.spec.ts` (`CI=1`, 1 worker : 66 passés, 4 ignorés préexistants, 0 échec) ;
`pnpm test:isolation` (2274 tests, vert) ; `CI=1 pnpm verify` entier, vert (y compris le build de production).

**Captures** : les cinq paires avant/après de la garde sont présentes et inchangées dans
`docs/propositions/9L08D-TERRAIN-TAILLES-MAQUETTE/captures/` ; aucun écran supplémentaire touché par cette
reprise, donc aucune capture neuve à ajouter.
