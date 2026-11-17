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
