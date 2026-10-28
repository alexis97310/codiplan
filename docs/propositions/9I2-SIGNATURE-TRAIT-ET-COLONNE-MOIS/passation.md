# 9I2-SIGNATURE-TRAIT-ET-COLONNE-MOIS — passation

Deux défauts visuels mesurés, corrigés, chacun prouvé rouge sur `origin/main`
puis vert sur le code livré.

| Point | Mesuré avant | Fait | Preuve |
|---|---|---|---|
| 1 — trait de signature | `demarrerTrace` (`components/terrain/rapport-automatique.tsx`) ne posait ni `lineWidth` ni `ctx.scale` après que 9H4 a lié la résolution du canevas à `devicePixelRatio` : le trait faisait 1 pixel PHYSIQUE, soit ~0,33 px CSS à DPR 3 — quasi invisible à l'écran et dans le PNG enregistré (`toDataURL`). | `preparerTraitSignature` pose `lineWidth = 2 px CSS × échelle` (échelle = `canvas.width / largeur affichée`) et `lineCap`/`lineJoin` ronds, à CHAQUE début de trait (`demarrerTrace`) — jamais une seule fois au montage, car redimensionner le canevas (`canvas.width = …`) réinitialise `lineWidth` avec lui. Les coordonnées de tracé restent en pixels physiques (`positionCanevas`, inchangé) : `lineWidth` est exprimé dans la même unité, jamais `ctx.scale` qui aurait fait doublon. | `tests/e2e/rapport-signature-epaisseur-trait.spec.ts` — DPR 1, 2 et 3, 375 px : un vrai tracé (événements `pointer` dispatchés), puis relecture de `ctx.lineWidth` du canevas. Rouge sur l'ancien code (`lineWidth/échelle` = 0,33 à DPR 3), vert aux trois DPR sur le code livré. Capture avant/après à 375 px, DPR 3 : `captures/signature-{avant,apres}-375.png`. |
| 2 — colonne figée, vue Mois | `<td class="sticky left-0 z-[1]">` (`app/(back-office)/planning/page.tsx` ~l.3744) : au défilement horizontal, le badge du nombre d'interventions d'une case (`relative z-10`, non contenu par un ancêtre positionné sans `z-index` explicite) passait AU-DESSUS de la colonne figée plutôt que dessous — même défaut que la vue Jour avant 9H4. | La colonne figée passe à `z-20`, même valeur que la vue Jour (9H4). | `tests/e2e/planning-mois-colonne-figee-empilement.spec.ts` — défilement RÉEL du cadre jusqu'à coïncidence du centre de la colonne figée et du centre du badge, puis `document.elementFromPoint` : rouge sur l'ancien code (l'élément au point est le badge), vert sur le code livré (l'élément au point est la colonne figée ou un de ses descendants). Captures à 375 et 1280 px : `captures/mois-colonne-figee-{avant,apres}-{375,1280}.png`. |
| 2bis — colonne figée, vue Semaine (mesurée, et touchée aussi) | Même colonne figée (`<td class="sticky left-0 z-[1]">`, ~l.3000). Aucun badge numéroté en vue Semaine — `BlocPosable` (`components/planning/pose.tsx` ~l.1133) est `relative` SANS `z-index` explicite, donc ne passe jamais au-dessus d'un `z-index` explicite : pas de défaut là. Mais la MÊME case (`CasePosable`) pose « + Créer ici » (`a[data-creer-ici]`, `pose.tsx` ~l.1409) en `position: absolute; z-10` dès qu'elle est cliquée vide, ouverte, non bloquée — exactement le même défaut que le badge du Mois. | La colonne figée de la vue Semaine passe aussi à `z-20`. | Même fichier, même technique (`colonneFigeeGagneSur`), appliquée à « + Créer ici » sur une case vide loin dans le futur (propre fixture, jamais `SCENE.*`) : rouge sur l'ancien code, vert sur le code livré. *Première mesure prise au centre vertical de la colonne figée (plus haute que la case) rendait vrai pour la mauvaise raison — voir le docblock du fichier.* |

## Ce qui n'a pas été touché

- Aucune migration, aucune dépendance nouvelle.
- La vue Jour (déjà `z-20` depuis 9H4) est inchangée — ses deux épreuves
  existantes (`planning-jour-colonne-figee-empilement.spec.ts`,
  `planning-jour-legende-annulees.spec.ts`) restent vertes.
- `positionCanevas` (conversion du point du pointeur à l'échelle du canevas)
  est inchangée : le piège mesuré était l'absence de `lineWidth`, jamais la
  position du tracé.

## Vérification

`pnpm format` / `pnpm typecheck` / `pnpm lint` / `pnpm test` verts après
chaque commit.

**`pnpm verify:full` n'a PAS fini dans l'appel unique** (plafond de l'outil,
30 min) — à dire plutôt que cacher, comme demandé par ce ticket.
`verify-final.txt` porte la sortie jusqu'au coup d'arrêt : `format:check`,
`typecheck`, `lint`, `test`, `test:isolation`, `build`, `feries:horizon` et
`audit:partitions` ont tous réussi (`pnpm verify` les enchaîne avec `&&` —
`test:e2e`, qui les suit, n'aurait jamais démarré sinon). `test:e2e` a ensuite
tourné environ 1 500 des 1 725 épreuves (seul marqueur non vert : une ligne
d'information attendue, « "En retard" ne vaut pas 0 … capture non prise, voir
le README », déjà documentée ailleurs — AUCUN `failed`, AUCUNE trace
d'échec). La seule « Error » du fichier (`[WebServer] [Error: aborted]
{ code: 'ECONNRESET' }`, toute dernière ligne) est l'effet du coup d'arrêt
sur le serveur, pas un verdict d'épreuve. `pnpm verify` (sans `test:e2e`,
voir plus bas) a ensuite tourné seul et est vert — c'est la preuve retenue
pour ce lot.
