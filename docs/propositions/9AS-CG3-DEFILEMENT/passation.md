# 9AS-CG3-INDICE-DEFILEMENT — passation

## Ce que j'ai changé

Le composant partagé `Tableau` (`components/ui/tableau.tsx`) enveloppe désormais son
conteneur `overflow-x-auto` dans `CadreDefilant` (`components/ui/cadre-defilant.tsx`,
neuf), qui pose un voile dégradé, décoratif (`aria-hidden`, sans texte), sur chaque bord
où il reste du contenu à découvrir horizontalement. Le calcul lui-même —
`indicesDeDefilement`, `components/ui/defilement.ts`, neuf — est une fonction pure sans
DOM, éprouvée seule. La classe `overflow-x-auto` elle-même n'a pas bougé : elle reste
lisible par `tests/e2e/planning-largeur-et-carte.spec.ts:159`, un écran étranger à
`Tableau`.

Pour l'exploitation : les 24 appelants de `Tableau` (dont le registre VGP `/vgp` et la
fiche client `/clients/[id]`) montrent maintenant, à l'œil, quand une colonne reste hors
cadre — sans qu'aucun de ces écrans n'ait été touché individuellement. Le geste de
défilement lui-même est inchangé (aucune logique de tri, filtre ou pagination modifiée).

## Ce que j'ai mesuré

**Comptes AVANT/APRÈS** (10 fichiers dans `captures/`, spec
`tests/e2e/captures-9as-cg3-defilement.spec.ts`, rejoué avant puis après le commit du
code — voir « piège » ci-dessous) :

- `/vgp` à 1280 et 375 px, plus une capture à 375 px après défilement complet
  (`vgp-defile-*`) : à 375, le registre déborde et l'indice de droite est visible dès le
  chargement (bande dégradée verticale sur ~24 px à droite, mesurée par diff de pixels :
  région x=331–353 sur 375, soit l'exacte largeur `w-6`) ; après défilement au bout,
  l'indice de gauche apparaît (vérifié visuellement sur `vgp-defile-apres-375.png`, crop
  x=0–60).
- Fiche client (`Atelier Ducos`, société de démonstration) à 1280 et 375 px : diff de
  pixels entre avant/après localisé en x=331–353, y=1230–2302 — la bande à droite du
  tableau « Lieux d'intervention » / « Historique des interventions », rien ailleurs sur
  la page.
- À 1280 px, aucune différence visible n'était attendue ni mesurée si le tableau ne
  déborde pas à cette largeur (non vérifié par diff de pixels à 1280, seulement à l'œil).

**Épreuve fonctionnelle** (`tests/e2e/defilement-tableau.spec.ts`, incluse dans
`pnpm test:e2e`) : à 375 px sur `/vgp`, `scrollWidth > clientWidth` est vérifié dans le
même passage que `data-defile-droite`, puis après `scrollLeft = scrollWidth`,
`data-defile-gauche` apparaît et `data-defile-droite` disparaît (`toHaveAttribute` /
`not.toHaveAttribute`, aucun `waitForTimeout`) ; à 1280 px, `data-defile-droite` est
présent si et seulement si `scrollWidth > clientWidth` du même passage — deux passages,
deux verts au premier essai.

Avant chaque commit : `pnpm format:check` et `pnpm test` verts (290 fichiers, 3040
tests). `pnpm typecheck` et `pnpm lint` verts aussi.

## Ce que j'ai tranché et pourquoi

- Tolérance de 1 px dans `indicesDeDefilement` : `scrollLeft` et `scrollWidth -
  clientWidth` sont des flottants arrondis différemment selon le moteur de rendu ; sans
  tolérance, l'indice de gauche clignoterait à la fin exacte d'un défilement.
- `minWidth` reste posé sur `<table>`, jamais sur le conteneur de `CadreDefilant` : le
  déplacer sur le conteneur scrollable aurait fait grandir ce conteneur lui-même plutôt
  que de le faire déborder — plus aucun défilement n'aurait eu lieu. Repéré avant tout
  test, en relisant la logique CSS plutôt qu'en la découvrant en observant un échec.
- Le sélecteur du client de capture (`main a[href^='/clients/']`) exclut explicitement
  `/clients/nouveau` — un lien de création listé avant les lignes du tableau, qui ne
  porte aucun `Tableau` du tout. Sans cette exclusion, la capture cliquait sur ce lien et
  produisait des images AVANT/APRÈS strictement identiques (piège détaillé ci-dessous).
- `CadreDefilant` observe `scroll` ET un `ResizeObserver` : un tableau peut déborder ou
  cesser de déborder sans qu'aucun défilement n'ait eu lieu (redimensionnement de
  fenêtre, contenu chargé après coup).

## Ce que je n'ai PAS fait

- Aucun écran appelant de `Tableau` n'a été modifié — le changement est entièrement dans
  le composant partagé et les deux nouveaux fichiers.
- `/parametres/trajets` et `/parametres/agences` (C-B3) : leurs colonnes manquantes sont
  un chantier séparé, hors périmètre de ce lot — non touchées, non réparées.
- Aucune mesure de largeur utile absolue à 1280 px n'a été refaite : le registre VGP
  « tient à 1280 » est une mesure antérieure, reprise telle quelle, non revérifiée ici.
- Aucune régression cherchée sur la grille du planning (`/planning`) : elle n'utilise pas
  `Tableau`, et n'a reçu aucune modification.

## Les pièges pour la session suivante

- **Le piège du lien de création.** Sur `/clients`, le premier lien dont l'`href`
  commence par `/clients/` est `/clients/nouveau`, rendu AVANT les lignes du tableau. Un
  sélecteur naïf (`main a[href^='/clients/']:first`) clique dessus et produit des
  captures AVANT/APRÈS identiques au pixel près — aucune erreur, aucun rouge, juste une
  preuve qui ne prouve rien. Repéré ici par diff de pixels (aucun outil d'image
  disponible sur ce poste — ni `pip`, ni `ImageMagick`, ni `pngjs` en dépendance directe ;
  contourné avec `@playwright/test` déjà installé : `chromium.launch()` + un `<canvas>`
  pour décoder les deux PNG et comparer `getImageData`).
- **`page.locator(...).click()` ne garantit pas la navigation.** Un `expect(main).
  toBeVisible()` juste après un clic sur un lien Next.js passe même si la navigation n'a
  pas eu lieu, parce que `<main>` existe déjà sur la page de départ. Il faut
  `page.waitForURL(...)` explicitement pour prouver qu'on est ailleurs.
- Pour rejouer un AVANT après un commit déjà posé (ce lot l'a fait deux fois, une fois
  pour le spec en entier, une fois pour corriger la fiche client seule) :
  `git show HEAD~1:<fichier> > <fichier>` sur le seul fichier de composant concerné, puis
  `git checkout HEAD -- <fichier>` pour revenir — plus rapide qu'un stash quand le code
  est déjà commité et qu'un seul fichier est en cause.

## Ce qui reste à faire

- Rien d'identifié dans le périmètre de ce lot. `pnpm typecheck`, `pnpm lint`, `pnpm
  test` et les deux épreuves e2e neuves (`defilement-tableau.spec.ts`,
  `captures-9as-cg3-defilement.spec.ts`) sont vertes ; `CI=1 pnpm verify:full` reste à
  lancer en entier avant de rendre la main (voir le commit final).
