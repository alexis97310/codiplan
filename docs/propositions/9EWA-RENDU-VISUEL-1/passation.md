# 9EWA-RENDU-VISUEL-1 — passation

Les six défauts constatés en production par Alexis (décision n° 94, 13/10/2026) sont
corrigés, un commit par point. Aucune fonction n'a changé : seulement le rendu (et la
case en double du point 5, remplacée par sa phrase, D179).

## Point 1 — titres du menu illisibles (cause racine)

`lib/utils.ts` : `cn` = `twMerge(clsx(...))` sans configuration rangeait `text-12`…
`text-28` (échelle maison, `app/globals.css`) dans le groupe COULEUR de tailwind-merge
(`text-{couleur}`, qui accepte toute valeur) au lieu du groupe taille de police — une
classe de couleur voisine dans un même `cn(...)` était retirée à tort, quel que soit
l'ordre. `extendTailwindMerge` déclare désormais l'échelle maison comme taille de
police.

**Autres `cn(...)` affectés**, trouvés par le même motif (couleur + taille de l'échelle
maison dans un même appel), et donc améliorés sans y toucher : `components/ui/kpi.tsx`,
`components/ui/onglets.tsx` (les deux usages), `components/ui/puces-filtre.tsx`,
`components/navigation/barre-basse-bureau.tsx`, `components/terrain/barre-basse.tsx`,
`components/interventions/trouver-creneau.tsx`,
`app/(back-office)/parametres/equipe/page.tsx`. Avant ce correctif, selon l'ordre des
classes, c'était soit la couleur soit la taille qui disparaissait silencieusement.

Test : `tests/unit/theme/cn-echelle-typographique.test.ts`.

## Point 2 — encadré bleu autour de toute la page

`app/globals.css` : `main#contenu:focus, main#contenu:focus-visible` annule l'anneau
(outline/box-shadow/border-color) — ciblé sur `#contenu`, jamais sur
`[tabindex="-1"]` générique. La règle générale et celle de la barre sombre
(`[data-chrome] :focus-visible`) sont inchangées. Épreuve ajoutée dans
`tests/e2e/evitement.spec.ts` (navigation par le lien d'évitement, puis clic sur le
fond de `#contenu`).

## Point 3 — mini-barres de défilement verticales (Windows)

`overflow-x-auto` seul force `overflow-y` à `auto` par la cascade CSS2.1 (la place
réservée au défilement horizontal grignote la hauteur disponible). `overflow-y-hidden`
ajouté partout où seul l'horizontal sert : `components/ui/onglets.tsx`,
`components/ui/tableau.tsx` (`CadreDefilant`), les conteneurs listés de
`planning/page.tsx` (4) et `absences/page.tsx` (2). `overflow-x-auto` gardé partout
(épreuves existantes). Épreuve ajoutée : `tests/e2e/onglets-sans-mini-barre.spec.ts`
(vérifie `overflow-y: hidden` sur la nav des onglets de `/demandes`).

## Point 4 — filtres du Parc tronqués (« Tous l… »)

`app/(back-office)/parc/page.tsx` : les 4 `<select>` (statut, client, site, famille)
passent de `w-[100px]`/`w-[105px] truncate` à `min-w-[140px]`, sans troncature.
`lib/i18n/fr.ts` : options raccourcies (« Tous »/« Toutes » — le libellé du filtre est
déjà affiché au-dessus). Test : `tests/unit/parc/filtres-non-tronques.test.ts`.

## Point 5 — case du filtre « sans équipement » en double (D179)

D179 décidait que seule la case devienne la phrase de rappel ; la phrase existait déjà
mais la case native était restée sur `/sites` et `/clients`. Case retirée sur les deux
écrans. **Piège corrigé** : une fois `sans_equipement=1` posé, le nombre masqué vaut 0
et la phrase de rappel disparaît — sans rien pour re-masquer. Une phrase symétrique
(« Sites/Clients sans machine affichés · Masquer », fonctions
`phraseSitesAffiches`/`phraseClientsAffiches` et clés i18n neuves) prend le relais,
avec un lien SANS le paramètre. `tests/e2e/listes-1.spec.ts` suit désormais les liens
« Afficher »/« Masquer » plutôt que de cocher une case qui n'existe plus (le test
`/clients` navigue directement avec `?sans_equipement=1` pour éprouver « Masquer », le
jeu de démonstration par défaut n'ayant aucun client masqué pour éprouver « Afficher »
côté client — côté site, au moins un site masqué existe et les deux liens sont
éprouvés). `sites/page.tsx` et `clients/page.tsx` rejoignent le gardien
`tests/unit/ui/case-a-cocher.test.tsx`. Les fonctions et clés i18n qui ne servaient que
la case native (`libelleFiltreEquipement`, `sites.filtre_equipement_*`,
`clients.filtre_equipement`) sont retirées, devenues mortes.

## Point 6 — bas du planning en rendu brut

`app/(back-office)/planning/page.tsx` : le bloc « Transmettre / Laissées » passe dans
`components/ui/carte.tsx` (titre + compte), `data-laissees-transmission` et sa place
sous la grille conservés.

`app/(back-office)/planning/statistiques.tsx` : « Charge par technicien » garde son
`<details>` natif (D190, repli pur état d'affichage) mais habillé en carte
(`bg-app-surface border-app-bord rounded-lg border`), triangle natif masqué
(`[&::-webkit-details-marker]:hidden`) et remplacé par une icône `chev-r` qui pivote à
l'ouverture (`group-open:rotate-90`), jetons `app-*` à la place des jetons shadcn
(`text-muted-foreground`, `bg-muted`, `text-foreground`, `text-lg`…). `tauxOccupation`
garde ses trois termes (`heures_engagees`, `heures_ouvrables`, `formule`) — rien n'a
changé pour `tests/unit/interventions/occupation-affichee.test.ts`.

Un effet de bord corrigé au passage : `tests/unit/ui/retouches-2a.test.ts` (D143,
point 11 — un texte à 12/13 px doit porter une graisse d'au moins 700) a rougi une
fois sur `Entete` (le `<div>` d'en-tête de ligne portait `text-13` sans `font-bold`,
la graisse n'étant que sur un `<span>` enfant) ; corrigé en posant `font-bold`
directement sur le `<div>`.

## Captures et vérification finale

**Les captures AVANT/APRÈS (375 et 1280 px) demandées au point 7 n'ont PAS été
prises** — budget de temps épuisé par les six points eux-mêmes (recherche, édition,
et surtout les épreuves e2e réelles jouées à chaque point pour vérifier les causes
racines avant de corriger, plutôt que de les supposer). À reprendre dans un ticket
suivant, ou par le pilote avant mise en ligne.

**Captures involontaires évitées** : à deux reprises, jouer les épreuves e2e (d'abord
par point, puis `CI=1 pnpm verify:full` en entier) a régénéré des dizaines de PNG
d'AUTRES lots (toute capture dont le spec a tourné dans la même commande). Chaque
fois, `git status --porcelain` après coup, `git checkout --` sur les PNG modifiés et
`git clean -fd docs/propositions/` sur les PNG neufs — rien de tout cela n'est
commité, conformément à l'interdit.

## CI=1 pnpm verify:full — joué en entier, deux régressions trouvées et corrigées

Joué une fois en entier (≈ 50 min, HEAD `ae899f9a`, le commit du point 7) : 1273
passed, 2 failed, 48 skipped.

- `parc-tri.spec.ts` (constat 30) — `min-w-[140px]` du point 4 faisait passer la
  barre de filtres du Parc sur deux lignes à 1280px, perdant la hauteur de liste
  sous le seuil de 480px.
- `clients-sites-vues.spec.ts` — retirer la case native du point 5 retirait aussi le
  SEUL champ qui portait `sans_equipement` dans le formulaire de recherche :
  relancer la recherche (tri, zone…) perdait le filtre, silencieusement.

Les deux causes sont dans ce lot, pas étrangères (aucune mesure sur `origin/main`
nécessaire : les deux fichiers de test visent exactement ce que ce lot a touché).
Corrigées par le commit `5588a2a0`, chacune re-vérifiée individuellement en vert
(`playwright test tests/e2e/parc-tri.spec.ts tests/e2e/clients-sites-vues.spec.ts
tests/e2e/listes-1.spec.ts` — tout vert). `CI=1 pnpm verify` (format:check,
typecheck, lint, test, test:isolation, build) rejoué sur l'état final — vert, HEAD
`5588a2a0`.

**`CI=1 pnpm verify:full` N'A PAS été rejoué EN ENTIER après la correction** — le
budget de 150 minutes du lot ne laissait plus la marge pour un second tour complet
(≈ 50 min) sans dépasser la limite. Les deux épreuves qui avaient rougi sont
revérifiées individuellement en vert ; le reste de la suite e2e (1273 épreuves)
n'a pas été rejoué depuis cette dernière correction — seul un rejeu complet de
`verify:full` le confirmerait. À faire avant mise en ligne si ce lot n'est pas
rejoué par le pilote.
