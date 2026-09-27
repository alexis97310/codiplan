# 9AU-CG8-CASES-A-COCHER — passation

*Note sur le nom du dossier* : le ticket se contredit lui-même sur l'emplacement des
captures et de cette passation — trois occurrences (§0, §2, « Territoire ») donnent
`docs/propositions/9AU-CG8-CASES-44/`, la seule occurrence de la section « LA PASSATION »
donne `docs/propositions/9AU-CG8-CASES-A-COCHER/`. J'ai retenu `9AU-CG8-CASES-44` — c'est
le nom utilisé à chaque étape concrète du ticket et celui qui correspond à la nomenclature
du test fonctionnel (`cases-parametrage-44.spec.ts`). Signalé ici plutôt que tranché en
silence.

## Ce que j'ai changé

Huit `<input type="checkbox">` natifs, chacun recopié dans son propre `<label>`, sur six
écrans de paramétrage : `habilitations/page.tsx` (`actif`, modification seulement),
`materiel/page.tsx` (`CaseActive`, `actif`, familles et modèles), `agences/[id]/modifier/page.tsx`
(`actif`, `value="true"`), `prestations/page.tsx` (`actif`), `equipe/page.tsx` (`actif`,
création et modification) et `components/forfaits/formulaire.tsx` (`cumulable_temps`,
`actif`). Sous 768 px, ces cases n'offraient qu'une cible de la taille du glyphe rendu par
le navigateur, en dessous des 44 px recommandés (WCAG 2.5.5 niveau AAA, retenue ici comme
repère d'ergonomie tactile) — constat C-G10 de l'audit captures du 26/09/2026.

`components/ui/case-a-cocher.tsx` porte l'écriture unique : `CaseACocher({ name, value?,
defaultChecked?, libelle, className? })` rend `<label className={cn("min-h-11 min-w-11
md:min-h-0 md:min-w-0", className)}><input type="checkbox" …/>{libelle}</label>`. La cible
de 44 px est posée sur le `<label>` (`min-h-11 min-w-11`, échelle Tailwind : 44 px), et
effacée dès 768 px (`md:min-h-0 md:min-w-0`) — le rendu bureau ne change pas d'un pixel.
`className` porte les classes de mise en page propres à chaque appelant (`flex items-center
gap-…`, `pb-1`, `font-semibold`…) et compose avec la cible via `cn` (tailwind-merge),
jamais ne la remplace.

**Pour l'exploitation** : aucune règle de gestion n'est touchée. `name`, `value` et
`defaultChecked` sont transmis tels quels à l'`<input>` sous-jacent — les huit routes POST
qui lisent ces champs (activité d'une habilitation, d'une famille, d'un modèle, d'une
agence, d'une prestation, d'un technicien, cumulabilité et activité d'un forfait) reçoivent
exactement la même forme de requête qu'avant ce lot. Ce qui change pour un utilisateur sur
téléphone : la zone cliquable autour de chaque case « Active »/« Actif »/« Cumulable dans le
temps de travail » est désormais large d'au moins 44 px, sans qu'aucune valeur par défaut,
aucun libellé ni aucun état initial n'ait bougé.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

**Épreuve unitaire** `tests/unit/ui/case-a-cocher.test.tsx` (3 tests) : rendu de
`CaseACocher` — `getByLabelText(fr["prestations.active"])` résout une case dont le label
porte `min-h-11` et `md:min-h-0`, avec `value`/`defaultChecked`/`name` transmis à
l'identique ; une case sans `defaultChecked` ni `value` reste décochée et sans attribut
`value`. Plus une garde de source, paramétrée sur les 6 fichiers du territoire
(`it.each`) : aucun ne contient plus la chaîne `type="checkbox"` — chaque fichier est
relu et son contenu vérifié non vide, pour qu'un chemin cassé ne se lise pas comme un
succès.

**Épreuve fonctionnelle** `tests/e2e/cases-parametrage-44.spec.ts` (2 tests, en série,
lecture seule — aucune donnée créée) sur `/parametres/prestations`, formulaire de
CRÉATION : à 375×812, la boîte du `<label>` de `fr["prestations.active"]` mesure
**≥ 44 px de haut** (mesuré, `boundingBox()`) ; à 1280×900, elle mesure **< 44 px**
(bureau inchangé). La case est ciblée par `getByLabel`, jamais par un texte nu — la même
chaîne « Active » apparaît aussi en simple texte de statut dans le tableau du catalogue
dès qu'il porte des lignes, et `getByLabel` ne la verrait pas.

**Captures AVANT/APRÈS** des 7 écrans à 1280 et 375 px (`docs/propositions/
9AU-CG8-CASES-44/captures/`, spec `tests/e2e/captures-9au-cg8-cases-44.spec.ts`, rejouée
une fois sur le code d'avant le lot — `git stash` du code et du composant neuf, capture,
`git stash pop` —, une fois sur le code livré) : habilitations, matériel, agence en
modification, prestations, équipe, forfaits (création) et forfaits (modification, un
identifiant réel découvert sur la liste). Pour les trois écrans dont la case n'existe que
dans un formulaire de modification replié par défaut (`<details>`, ERGO-1) —
habilitations, matériel, équipe —, la capture ouvre tous les replis par script
(`element.open = true`) plutôt que de cliquer un `<summary>` dont le texte varie d'une
ligne à l'autre. Les 14 captures AVANT et les 14 APRÈS ont été prises avec succès (28
fichiers PNG, aucun refus).

*Ce que je n'ai pas mesuré par diff de pixels* : la comparaison AVANT/APRÈS est visuelle,
à l'œil, comme les lots précédents de cette famille (9AT-CG6). Une case à cocher HTML
garde sa taille de glyphe native quel que soit le lot — c'est le label qui grossit,
invisible à l'écran —, si bien que les deux captures d'un même écran se ressemblent
fortement : c'est attendu, la preuve du changement est dans l'épreuve géométrique
`cases-parametrage-44.spec.ts`, pas dans une différence visuelle.

`pnpm format:check`, `pnpm typecheck`, `pnpm lint`, `pnpm test` (292 fichiers, 3050 tests)
vérifiés verts avant le premier commit. `CI=1 pnpm verify:full` (format + typecheck + lint
+ test + test:isolation + build + feries:horizon + audit:partitions + test:e2e) rejoué en
entier après le second commit : 493 tests passés, 3 ignorés (sautés par le harnais lui-même,
non liés à ce lot), 0 échec.

## Ce que j'ai tranché et pourquoi

- **Le nom du dossier de captures/passation** (`9AU-CG8-CASES-44` plutôt que
  `9AU-CG8-CASES-A-COCHER`) — voir la note en tête de ce document.
- **`className` porte les classes de mise en page, jamais la cible** : les huit appelants
  utilisaient chacun une classe de label différente (`flex items-center gap-1.5 pb-1
  text-[12.5px]` pour habilitations/matériel/prestations/équipe, `flex items-center gap-2
  text-[12.5px] font-semibold` pour agences/forfaits). Recopier une neuvième classe dans
  `CaseACocher` aurait été la même faute que recopier une couleur (§9, 01/09) — la classe
  de mise en page appartient à l'appelant, la cible tactile appartient au composant, et
  `cn` les compose sans conflit (aucune des deux ne touche aux mêmes propriétés CSS).
- **`value` et `defaultChecked` en props optionnelles distinctes**, plutôt qu'un objet ou
  un spread de props HTML : seul un appelant sur huit passe `value` (agence, `"true"`), et
  exposer exactement les trois props utilisées documente ce que le composant
  transmet sans ouvrir la porte à une prop HTML arbitraire qu'aucun appelant ne demande.
- **La garde de source dans le test unitaire plutôt qu'un gardien séparé** : huit
  occurrences sur six fichiers, un territoire fermé et daté (ce ticket) — un gardien
  générique aurait été une deuxième écriture de la même règle que le test unitaire porte
  déjà en un `it.each`.

## Ce que je n'ai PAS fait

- **Les cases hors paramétrage** (`sites/[id]/page.tsx`, `sites/page.tsx`, `clients/page.tsx`,
  `interventions/page.tsx`, `contacts/presentation.tsx`, `(mobile)/terrain/[id]/page.tsx`) :
  explicitement hors territoire du ticket, non touchées.
- **La taille des boutons `h-9`** (`components/ui/button.tsx:24`, même constat de l'audit) :
  cité comme hors lot, non touché.
- **Aucun libellé changé**, aucune valeur par défaut, aucun état initial de case modifié.
- **Aucune comparaison par diff de pixels** entre AVANT et APRÈS — voir la section
  précédente.
- **Aucune migration, aucune ligne de semis, aucun prix** — territoire respecté à la
  lettre.

## Les pièges pour la session suivante

- **La contradiction de nommage du dossier** (voir en tête) : si un prochain lot cite
  `9AU-CG8-CASES-A-COCHER/passation.md`, c'est cette contradiction qui en est la source —
  le contenu vit sous `9AU-CG8-CASES-44/`.
- **`getByLabelText` n'existe pas sur `Page` de Playwright** — c'est `getByLabel`. Piège
  rencontré et corrigé pendant ce lot (`tsc --noEmit` l'a arrêté avant tout commit).
- **Les captures AVANT exigent un stash ciblé par chemin** (`git stash push -u -- <fichiers>`),
  jamais un stash global : ce dépôt porte de nombreux fichiers PNG déjà modifiés par des
  sessions précédentes (`docs/propositions/47-…` à `99T-…`, hors de ce lot), et un stash
  sans pathspec les aurait engloutis avec le code de ce ticket.
- **`ouvrirLesReplis` (ouvrir tous les `<details>` par script) est plus robuste qu'un clic
  sur `<summary>`** quand le texte du repli varie d'une ligne à l'autre (code d'une
  habilitation, désignation d'un modèle, nom d'un technicien) — un prochain lot de capture
  sur un écran à repli par ligne peut réutiliser ce motif.
- **Le rendu AVANT/APRÈS d'une case à cocher se ressemble à l'œil** : ne pas conclure d'un
  clichet identique que rien n'a changé — la mesure qui compte est géométrique
  (`boundingBox`), pas visuelle.

## Ce qui reste à faire

- Les cases hors paramétrage listées ci-dessus, si un futur constat les vise.
- La taille des boutons `h-9`, même remarque.
- Rien d'autre dans le périmètre de ce ticket : les 8 occurrences visées sont toutes
  converties, testées et capturées.
