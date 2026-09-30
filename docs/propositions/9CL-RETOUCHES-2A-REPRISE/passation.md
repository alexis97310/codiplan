# 9CL-RETOUCHES-2A-REPRISE — passation

Reprise de 9CG-RETOUCHES-2A-TYPO (recalé deux fois le 30/09 à 21h02-21h05, jamais publié —
branche `9CG-RETOUCHES-2A-TYPO-garde`, 7 commits) : fusion sur `main` (qui avait avancé entre-temps
avec 9CI, 9CJ, 9CK), mémoire de `tsc`, et la hauteur de la liste du parc (`parc-tri.spec.ts:249`).

Commits : `ede0452` (fusion), `cdcff11` (mémoire de `tsc` + règle D143 réappliquée sur le code neuf
de 9CI/9CJ/9CK), `9183b17` (hauteur de la liste du parc).

## Ce que j'ai changé, et ce que ça change pour l'exploitation

1. **9CG est désormais publié sur `main`**, fusionné après 9CI (vues 2 semaines/mois), 9CJ
   (téléphone, « + Créer ici ») et 9CK (suite de la vue Jour) — ces trois tickets avaient avancé
   pendant que 9CG restait bloqué en file. Sa décision D143 (échelle typographique complète, 13 px,
   graisse 700 minimum sous 14 px, chiffres tabulaires, terrain à 16 px) s'applique maintenant à
   TOUT l'écran, y compris le code que 9CI/9CJ/9CK ont ajouté à `planning/page.tsx` après que 9CG
   avait arrêté de le regarder : douze classes qui avaient échappé à la règle (`text-[12.5px]`,
   `text-[13px]` sans graisse, `text-12` sans graisse ou avec `font-normal`) sont corrigées.
   **Pour l'exploitation** : la vue Jour/Mois du planning, au téléphone comme au bureau, lit
   maintenant d'une seule échelle cohérente — plus de texte fin à 12,5 px perdu au milieu de texte
   gras à 13 px.
2. **`pnpm typecheck` (et donc `pnpm verify`) ne meurt plus d'un manque de mémoire.** Le tas par
   défaut de V8 (~2,1 Gio dans cet environnement) est trop court pour ce dépôt, `main` seul compris
   — voir « ce que j'ai mesuré ». **Pour l'exploitation** : aucun changement visible ; pour la file
   de nuit, `pnpm verify` ne s'arrête plus avant d'avoir joué le moindre test.
3. **La liste du parc machines (`/parc`) retrouve ses 480 px visibles à 1280×800** (constat 30 de
   l'audit d'ergonomie du 25/09). **Pour l'exploitation** : une ligne de machine supplémentaire est
   visible sans défiler, à la résolution de référence d'un poste de travail.

## Ce que j'ai mesuré

**Mémoire de `tsc`** (`/usr/bin/time -v pnpm exec tsc --noEmit`, cache `tsconfig.tsbuildinfo`
retiré avant chaque mesure — une mesure « tiède » aurait été fausse) :

| État | Pic de mémoire (Maximum resident set size) | Durée | Résultat sous le tas par défaut (~2,1 Gio) |
|---|---|---|---|
| `main` seul (`a5b968e`, avant ce ticket) | 2 944 Mio | 20,6 s | **OOM** (`FATAL ERROR: Ineffective mark-compacts near heap limit`) |
| `main` + 9CG fusionné (`cdcff11`) | 3 017 Mio | 20,9 s | **OOM**, même famille d'erreur |

Delta fusion : **+73 Mio pour 340 fichiers touchés** — rien qui ressemble à un tableau littéral ou
un type union géant introduit par 9CG. `--extendedDiagnostics` sur `main` seul : 2 853 fichiers,
878 006 identifiants, et surtout **542 111 lignes de définitions** (`.d.ts`), dont **115 204 lignes
pour le seul client Prisma généré**
(`node_modules/.pnpm/@prisma+client@.../.prisma/client/index.d.ts`) — plus que les 261 571 lignes
de TypeScript propres au dépôt. La cause est structurelle (accumulation de neuf mois de tickets +
le client Prisma généré), pas localisée dans le contenu de 9CG.

**Le fichier « responsable »** n'existe donc pas au sens où le ticket l'attendait (« un tableau
littéral géant, un `as const` géant ») — j'ai cherché dans les plus gros fichiers du dépôt
(`planning/page.tsx` 4 483 lignes, `lib/i18n/fr.ts` 4 314 lignes, `lib/interventions/depot.ts`
3 814 lignes : aucun n'est anormal pour ce qu'il fait) et dans le diff de 9CG (4 334 insertions sur
340 fichiers, essentiellement des classes Tailwind changées une à une) : rien de la forme attendue.
**`NODE_OPTIONS=--max-old-space-size=4096` sur le seul script `typecheck`** (`package.json`, même
patron que `build` qui le fait déjà à 3072) : `pnpm typecheck` passe en 20,9 s, pic 3 017-3 089 Mio,
avec ~1 Gio de marge sous 4096.

**La liste du parc** (`pnpm exec playwright test tests/e2e/parc-tri.spec.ts -g "480 px"`, sur la
vraie base, à 1280×800) :

| État | `rect.top` de la liste | Hauteur visible | Verdict |
|---|---|---|---|
| `main` + 9CG (`cdcff11`, avant ce commit) | 340,8 px | **459,2 px** | rouge (< 480) |
| + `leading-none` seul, sans compensation | 344,8 px (+4) | **455,2 px** | rouge, pire — confirme la mesure de 9CG |
| + `leading-none` + deux `-mt-4` (16 px chacun) | 312,8 px | **487,2 px** | **vert**, ~7 px de marge |

`rectHeight` de `[data-bloc="liste-machines"]` vaut 680 px (plafond `max-h-[680px]`, contenu réel
1001 px) dans les trois cas : la hauteur visible est donc bornée par `window.innerHeight - rect.top`
— ce qui compte est la position du HAUT de la liste, jamais son propre contenu.

## Ce que j'ai tranché, et pourquoi

- **`NODE_OPTIONS=4096` plutôt qu'une correction dans 9CG.** Le ticket demandait de chercher la
  cause DANS 9CG avant d'envisager ce recours, et de ne l'appliquer que si « la cause n'est PAS
  dans 9CG (main seul est déjà à moins de 10 % de la limite) ». La mesure montre mieux que ça :
  `main` seul n'est pas à moins de 10 % de la limite, il la DÉPASSE déjà (`main` OOM, sans 9CG).
  La condition du ticket supposait un cas que la mesure ne trouve pas — je m'appuie sur l'esprit de
  la clause (la cause n'est pas localisée dans 9CG) plutôt que sur sa lettre (qui présuppose que
  `main` seul passerait la barre). 4096 plutôt que les 6144 que la passation de 9CG citait comme
  contournement « intermittent » : mesuré précisément (pic ~3,02-3,09 Gio), 4096 laisse ~1 Gio de
  marge sans sur-allouer.
- **`-mt-4` (marge négative) plutôt qu'un changement dans `Page`/`MaitreDetail`/`CarteListe`.** Ces
  trois composants sont épinglés au pixel près par `tests/unit/ui/composants-maquette.test.ts`
  contre `codiplan-maquette-complete.html` (`.master-detail{gap:16px}`, `.card-head{padding:16px
  18px}`, `.machine-row{padding:14px 16px}`, `h1{margin-bottom:3px}`, etc.) — les toucher aurait
  fait rougir ce gardien ET changé la mise en page de 25 autres écrans qui partagent `Page`. Les
  deux `gap-5` de `Page` (header→bloc filtres/KPI, bloc filtres/KPI→liste) ne sont PAS dans le
  territoire de ce ticket ; une marge négative posée sur MES propres éléments, dans
  `app/(back-office)/parc/page.tsx` seulement, encroche visuellement sur ces `gap-5` sans y toucher
  — c'est un espacement, exactement ce que le ticket autorise.
- **Le `h-[40px]` des `<select>` n'a pas bougé** : épinglé par le même gardien
  (`expect(PARC_PAGE).toContain("h-[40px]")`, ligne 892) contre `.field,.select{height:40px}` de la
  maquette — l'abaisser aurait cassé la cohérence visuelle avec le champ de recherche (40 px, non
  plus dans mon territoire) ET fait rougir le gardien.
- **`leading-none` appliqué malgré son coût (+4 px)** : demandé explicitement par le ticket comme
  reprise du point laissé par 9CG, « AVEC compensation » — je l'ai fait, puis compensé, plutôt que
  de le sauter en argumentant que la compensation seule suffisait sans lui.

## Ce que je n'ai PAS fait

- **Je n'ai pas touché `tests/e2e/parc-tri.spec.ts`** — ni l'assertion (480 px), ni la scène. Le
  fichier de test est revenu strictement à son état d'origine après mon débogage (diagnostic
  temporaire ajouté puis retiré, vérifié par `git diff` vide sur ce fichier avant le commit).
- **Je n'ai pas audité les ~50 lignes à graisse faible sans jeton de taille propre**, nommées
  « reste à faire » par la passation de 9CG (ligne 74, 88) — hors territoire de ce ticket (mémoire
  de `tsc` + hauteur du parc, pas un audit typographique complet).
- **Je n'ai pas confirmé ni infirmé la lecture du point 8 de D143** (pastilles/surtitres du terrain
  sous le plancher de 16 px) ni l'écart nommé du h1 à 24 px plutôt que 28 px (spec §3.2) — ce sont
  des décisions de valeur, pas des espacements, et ce ticket ne les rouvre pas.
- **Je n'ai pas cherché de fichier unique « responsable » de la mémoire** au sens où le ticket le
  supposait : la mesure montre une cause structurelle (accumulation + client Prisma généré), pas un
  fichier isolable. Pas de découpage tenté (un `as const` ou un JSON externalisé n'auraient réduit
  qu'une fraction des 542 111 lignes de définitions, dont 115 204 sont hors de mon contrôle).
- **Je n'ai pas repris les captures des 48 écrans de 9CG** — seuls `/parc` (les trois largeurs) et
  un écran témoin par groupe de menu (`/tableau-de-bord`, `/clients`, `/imports`, à 1280 px) ont été
  repris, comme demandé par la précision du ticket.

## Les pièges pour la session suivante

- **`tsconfig.tsbuildinfo` fausse toute mesure de mémoire/durée de `tsc`** si on ne le supprime pas
  avant une mesure « à froid » — une exécution incrémentale retombe à ~1 Gio et 3-4 s, un chiffre
  qui n'a rien à voir avec ce qu'une CI fraîche verra. Toujours `rm -f tsconfig.tsbuildinfo` avant
  de mesurer.
- **`/usr/bin/time -v pnpm exec tsc` mesure `pnpm`, pas `tsc`**, si on ne passe pas par
  `pnpm exec` correctement — vérifié que le pic rapporté correspond bien au process Node de `tsc`
  (cohérent avec `--extendedDiagnostics`, qui rapporte son propre `Memory used` bien plus bas car il
  mesure la seule table de types, pas le processus entier).
- **Un serveur `next start` lancé à la main (hors `playwright.config.ts`) échoue à l'authentification**
  (`connexion?motif=auth.indisponible`) faute des variables que `environnementDuServeur()` calcule
  (`DATABASE_URL` avec l'utilisateur `codiplan_app`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
  `COURRIEL_*`, le `--require` du double courriel) — je les ai répliquées à la main pour servir le
  commit `cdcff11` sur le port 3101 (captures AVANT) ; `reuseExistingServer: true` (hors CI) permet
  ensuite à `pnpm exec playwright test` de réutiliser un serveur déjà démarré sur `PORT`.
- **La marge négative (`-mt-4`) est un geste local à `parc/page.tsx`, pas un patron à copier
  ailleurs** : elle encroche sur un `gap-5` de `Page` sans le déclarer nulle part — un futur ticket
  qui changerait la valeur de `gap-5` dans `Page` (actuellement 20 px, hors territoire de 9CG comme
  de 9CL) devra relire ces deux `-mt-4` et remesurer `parc-tri.spec.ts:249`, sinon le calcul silencieux
  (52 px de colonne filtre + labels, moins 32 px de marge négative) peut redevenir faux sans qu'aucun
  gardien statique ne le voie — seul `parc-tri.spec.ts:249` le détecterait.
- **9CH-RETOUCHES-2B-COMPOSANTS reste à redéposer** (branche
  `9CH-RETOUCHES-2B-COMPOSANTS-inacheve`, `0491432`, 2 fichiers, arrêté faute de 9CG) — il peut
  maintenant repartir de `main`, 9CG y étant publié.

## Ce qui reste à faire

- **Redéposer 9CH-RETOUCHES-2B-COMPOSANTS**, qui s'était arrêté en attendant 9CG.
- **L'audit complet des ~50 lignes à graisse faible sans jeton de taille propre** (passation de 9CG,
  « ce qui reste à faire ») — toujours pas fait, toujours hors du territoire d'un ticket qui ne
  porte que sur la mémoire de `tsc` et la hauteur du parc.
- **Confirmer ou infirmer auprès d'Alexis la lecture du point 8** (pastilles/surtitres du terrain) et
  l'écart nommé du h1 à 24 px (spec §3.2 demande 28 px) — toujours ouvert depuis 9CG.
- **La marge de 487,2 px (~7 px au-dessus de 480) est correcte mais pas généreuse** : un futur écart
  de quelques pixels (une police système différente, un changement de zoom navigateur) pourrait la
  refaire rougir. Si `parc-tri.spec.ts:249` redevient rouge de quelques pixels seulement, regarder
  d'abord `rect.top` avant de chercher une nouvelle cause.
