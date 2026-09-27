# 9AT-CG6-TRAJETS-ILES — passation

## Ce que j'ai changé

`Cellule` (`components/ui/tableau.tsx`) gagne une prop facultative `etendue?: number`,
rendue en `colSpan` sur le `<td>` — absente tant qu'un appelant ne la passe pas, comme
`libelle` sur `Tableau` : les 24 autres appelants du composant restent inchangés octet
pour octet.

Sur `/parametres/trajets`, la ligne « Îles » écrivait la phrase de D107 (« Déplacement
par avion — estimation impossible, à saisir par intervention. ») **deux fois** sur la
même ligne — une fois dans la colonne « Ce qui s'applique » (`appliqueAffiche`), une fois
dans la colonne « Régler » (`Reglage`), débordant visiblement à 1280 px (constat C-G7 de
l'audit captures du 26/09/2026). `LigneZone` (`app/(back-office)/parametres/trajets/page.tsx`)
distingue désormais les zones `sans_estimation` : elle rend quatre cellules — Zone, Valeur
de référence, Réglage de la société, puis une seule `<Cellule etendue={2}>` qui porte la
phrase sur toute la largeur des deux dernières colonnes. `Reglage` ne reçoit plus que les
zones qui admettent une estimation (elle garde un repli `return null` sur `nature ===
"sans_estimation"`, qui ne se rend jamais en pratique — il existe uniquement pour que
`ligne.defaut.minutes` type-vérifie) ; `appliqueAffiche` ne traite plus le motif d'absence
non plus.

Pour l'exploitation : rien ne change dans ce que l'ADV peut régler — la zone Îles reste
sans formulaire, D107 est intacte, aucune règle de gestion touchée. Seul l'affichage
change : le motif se lit une fois, sans répétition ni débordement visuel.

## Ce que j'ai mesuré

Captures AVANT/APRÈS de `/parametres/trajets` à 1280 et 375 px (`docs/propositions/
9AT-CG6-TRAJETS-ILES/captures/`, spec `tests/e2e/captures-9at-cg6-trajets-iles.spec.ts`,
rejouée avant le commit du code puis après, écran en lecture seule contre le semis) :
à 1280 px, la ligne Îles montre la phrase deux fois côte à côte AVANT (colonnes « Ce qui
s'applique » et « Régler », chacune portant le texte complet) contre une seule fois,
étalée sur les deux colonnes, APRÈS. Les cinq autres lignes (zones estimables) sont
identiques au pixel — non vérifié par diff de pixels, seulement à l'œil : les cinq lignes
au-dessus n'ont reçu aucune modification de code.

Épreuve fonctionnelle neuve, `tests/e2e/trajets-iles.spec.ts` (2 tests, incluse dans
`pnpm test:e2e`), en lecture seule (aucune donnée créée — la zone Îles refuse toute
écriture au niveau serveur, D107) :
- la ligne Îles (`getByRole("row").filter({ hasText: fr["zone.iles"] })`) porte la phrase
  de D107 exactement une fois, dans une cellule `colspan="2"` ;
- la ligne Îles compte une cellule de moins que la ligne Nord lue dans le même passage —
  comparaison relative, jamais un compte absolu.

Épreuve unitaire neuve, `tests/unit/ui/cellule-etendue.test.tsx` (2 tests) : `<Cellule>`
sans `etendue` ne porte aucun attribut `colspan` ; avec `etendue={2}`, elle porte
`colspan="2"`.

Avant chaque commit : `pnpm format:check` et `pnpm test` verts (292 fichiers, 3044 tests).
`pnpm typecheck` et `pnpm lint` verts aussi.

## Ce que j'ai tranché et pourquoi

- Le repli `return null` dans `Reglage` sur `nature === "sans_estimation"` : sans lui,
  `ligne.defaut.minutes` ne type-vérifie pas (`DefautZone` est une union, et la branche
  qui narrowait ce type a été retirée de `LigneZone` vers un appel conditionnel). Il ne
  se rend jamais en pratique — `LigneZone` n'appelle plus `Reglage` pour cette zone — mais
  reste nécessaire pour que le compilateur accepte l'accès à `.minutes`. Documenté dans le
  docblock de `Reglage`.
- `etendue` plutôt que `colSpan` comme nom de prop : `Cellule` nomme déjà ses props en
  français (`droite`, `mono`, `fort`) — un `colSpan` isolé aurait rompu cette convention
  pour un concept qui a un nom français naturel.
- Le mérite de fusionner les colonnes « Ce qui s'applique » et « Régler » plutôt que
  « Réglage de la société » et « Ce qui s'applique » : c'est la recommandation explicite
  de l'audit (« sur toute la largeur de la cellule Régler au lieu d'un débordement »), et
  ce sont les deux colonnes qui portaient chacune une copie de la même phrase.

## Ce que je n'ai PAS fait

- La moitié VGP du constat C-G6 (« Dernière information » coupée à 1280) : périmée — le
  registre VGP n'a plus cette colonne (`vgp/page.tsx:293-307` a six colonnes : Machine,
  Client, Dernier contrôle, Échéance, État, Action). Rien à faire, non touché.
- Le débordement du tableau lui-même (`minimum="1000px"`, `trajets/page.tsx:131`) et la
  largeur des colonnes à 390 px (C-B3) : non mesuré dans ce lot, hors périmètre — cité
  explicitement dans le ticket comme un chantier séparé.
- Aucune régression cherchée sur les 24 autres appelants de `Tableau`/`Cellule` : la prop
  `etendue` est facultative et absente partout ailleurs, donc leur rendu ne peut pas avoir
  changé — non revérifié à l'œil sur chacun d'eux.
- Aucune ligne de `lib/sites/trajet-zone.ts` touchée : aucune règle de gestion changée,
  D107 intacte.

## Les pièges pour la session suivante

- `Trajet.minutes === null` (dans `resoudreTempsTrajet`) n'arrive, pour les lignes que
  `catalogueAffichable` produit, QUE quand `defaut.nature === "sans_estimation"` — le
  paramètre `temps_trajet_min` y est toujours `null` et `zone_geo` toujours une zone
  connue. `appliqueAffiche` n'est donc plus jamais appelée avec `applique.minutes ===
  null` en pratique (elle garde un repli `ABSENT` par défensivité de type, jamais
  exercé). Si un jour cette fonction sert un autre appelant qui passe un vrai
  `temps_trajet_min`, revérifier cette hypothèse avant de la simplifier davantage.
- Le repli `null` de `Reglage` est un piège si on cherche à comprendre pourquoi le
  composant a l'air de « traiter encore » le cas sans estimation : il ne le traite plus,
  ce `null` n'est qu'une contrainte de type mort en pratique — voir le docblock.

## Ce qui reste à faire

Rien d'identifié dans le périmètre de ce lot. `pnpm typecheck`, `pnpm lint`, `pnpm test`
et les deux épreuves e2e neuves sont vertes ; `CI=1 pnpm verify:full` reste à lancer en
entier avant de rendre la main (voir le commit final).
