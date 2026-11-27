# 9L55-ACCESSIBILITE-TERRAIN — passation

## Ce qui a été fait

### Dépendance

`@axe-core/playwright` ajoutée en dépendance de **développement** seulement (MPL-2.0,
vérifiée avant ajout — `npm view @axe-core/playwright license` — même licence que
`axe-core` lui-même). Jamais embarquée dans le build de production : utilisée
uniquement par l'épreuve e2e ci-dessous.

### Point 1 — l'épreuve de mesure

`tests/e2e/9l55-accessibilite-terrain.spec.ts` (nouveau). Audite, à 375 px, les sept
écrans demandés — en pratique SIX passages d'`@axe-core/playwright`, parce que D161/D212
(« un seul écran qui défile ») fait de la checklist et de la signature des **sections
inline de la fiche**, jamais des sous-routes : les isoler aurait demandé un `include()`
CSS sans ancre stable dans le balisage, pour un gain nul (`checklist` partage le DOM de
`fiche` dès le premier chargement).

| Test | Écran(s) couverts | État mesuré |
|---|---|---|
| `375 px — Ma journée` | Ma journée | chargement direct, semis de démonstration |
| `375 px — la fiche, avec sa checklist en section inline` | fiche + **checklist** | fiche fraîche, `en_cours`, un point de checklist |
| `375 px — la signature` | signature | après « Signature recueillie » (nom, qualité, canevas) |
| `375 px — la confirmation « Terminer »` | terminer | feuille de confirmation ouverte |
| `375 px — Profil` | Profil | chargement direct |
| `375 px — mot de passe` | mot de passe | chargement direct |

Règles mesurées : `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` — pas les règles
« best-practice » d'axe, qui dépassent le mandat WCAG et auraient fait rougir l'épreuve
sur des choix déjà arbitrés par la maquette (ex. heading-order dans un flux à sections
répétées). `critical`/`serious` font échouer l'épreuve ; le reste est relevé sans
bloquer. Le relevé complet (règle, gravité, nombre de nœuds) est écrit à chaque
exécution dans `docs/propositions/9L55-ACCESSIBILITE-TERRAIN/releve-axe.json` — après
correction, il est vide pour les six écrans : **aucune règle, d'aucune gravité, ne
rougit ni n'est seulement relevée**.

### Point 2 — le défaut trouvé, et corrigé

Un seul défaut `serious` : `aria-progressbar-name` sur la barre d'avancement de la
checklist (`Avancement`, `components/terrain/checklist-terrain.tsx`) —
`role="progressbar"` sans nom accessible. Corrigé par un `aria-label` dédié, nouvelle
clé `checklist.terrain.avancement_titre` (« Avancement de la checklist »,
`lib/i18n/fr.ts`) — le texte visible juste dessous (`libelleAvancement`, « Checklist · 2
sur 5 ») ne sert pas de nom accessible à la barre elle-même, et `aria-labelledby` aurait
exigé un `id` sur un nœud qui n'en porte pas. Aucun changement visuel, aucun changement
de comportement.

### Point 3 — un faux positif, diagnostiqué et NON corrigé dans le code applicatif

Un `serious` intermittent sur `color-contrast`, exclusivement sur l'écran signature,
exclusivement sur le bouton juste cliqué (« Signature recueillie ») — une couleur de
fond DIFFÉRENTE à chaque exécution (`#3670b1`, `#3770b1`, `#286eaf`…), jamais le même
défaut deux fois. Diagnostiqué : `Button` porte `transition-all` dans
`components/ui/button.tsx`, et ce bouton passe de la variante `outline` à `default` au
clic qui le sélectionne (React re-rend immédiatement avec la nouvelle classe). Si
`axe-core` mesure `getComputedStyle` pendant que la transition CSS de
`background-color` est encore en cours, il lit une couleur **intermédiaire** de
l'animation — jamais la couleur finale (`var(--primary)` = `#0053a1`, ~7,3:1 avec le
blanc, largement conforme). Vérifié en isolant la classe `hover:bg-primary/90` réelle
(compilée en `color-mix(in oklab, var(--primary) 90%, transparent)`,
`.next/static/css/*.css`) : retirer la dilution d'opacité au point d'appel n'a PAS fait
disparaître le défaut (juste changé sa couleur mesurée), ce qui aurait été incohérent si
la cause avait été le survol lui-même plutôt que la transition.

Correctif retenu : **dans l'épreuve**, pas dans le composant — `couperLesTransitions`
(`page.addStyleTag`, `transition: none !important; animation: none !important` sur
`*`/`*::before`/`*::after`) avant chaque mesure. Deux exécutions consécutives,
déterministes (`CI=1`, port dédié à chaque fois pour exclure toute réutilisation d'un
serveur d'un autre worktree sur la même machine), confirment le diagnostic. Aucun
changement de comportement ni d'apparence dans `components/ui/button.tsx` — modifier ce
composant partagé aurait dépassé le périmètre de ce lot (bureau compris) pour corriger
un artefact de mesure, pas un défaut réel.

### Point 4 — captures

Un seul écran dont le balisage change réellement : la checklist (l'`aria-label`
ci-dessus, invisible à l'écran). `tests/e2e/zz-captures-9l55-accessibilite-terrain.spec.ts`
(nouveau) capture la fiche en section checklist à 375 px.

- APRÈS : code courant (`fiche-checklist-apres-375.png`).
- AVANT : worktree jetable sur `7b28d2624` (le commit précédent ce lot), même scénario,
  `node_modules` lié en symlink, `.env` copié (`fiche-checklist-avant-375.png`), supprimé
  ensuite (`git worktree remove --force`).

Les deux images ne diffèrent, par construction, que par un attribut invisible — pas
d'outil de diff pixel disponible sur ce poste (`imagemagick`/`PIL` absents) pour le
démontrer mécaniquement, mais le correctif du point 2 n'ajoute ni classe ni style, donc
aucune divergence de rendu n'est possible.

**Galerie `docs/captures/` non régénérée** — aucun écran ne change d'apparence (même
précédent que 9L54A-TERRAIN-PRECHARGE-FRAME-SELF, point 5 de sa passation) ; la procédure
(base PostgreSQL séparée, choix manuel d'un mot de passe par lien de premier accès)
n'aurait rien à montrer de différent.

### Point 5 — vérification

`pnpm test` : 543 fichiers, 6113 tests, vert. `pnpm test:isolation` : 269 fichiers, 2587
tests, vert. L'épreuve ciblée (`tests/e2e/9l55-accessibilite-terrain.spec.ts`), rejouée
à plusieurs reprises avec `CI=1` et un port dédié à chaque fois : vert, déterministe.
`CI=1 pnpm verify` : vert — une première passe a rougi sur `format:check` (deux specs
non formatées) puis sur `typecheck` (`AxeResults["violations"][number]["impact"]` est
`string | null | undefined`, pas seulement `string | undefined`) ; les deux corrigés,
`verify` rejoué intégralement vert (format, typecheck, lint, test, test:isolation,
build).

## `docs/arbitrages.md`

Aucune entrée — ce lot ne tranche aucune règle métier ni n'assouplit aucun invariant :
une dépendance de développement, un attribut ARIA, et le diagnostic d'un artefact de
mesure propre à l'épreuve elle-même.

## Pas de migration

Aucune migration dans ce lot.

## Rien d'autre ouvert

Les six écrans mesurés ne portent plus aucune violation `critical`/`serious`, ni
`moderate`/`minor`, sous les jeux de règles `wcag2a`/`wcag2aa`/`wcag21a`/`wcag21aa`
(`releve-axe.json`, vide pour chacun). Le diagnostic du point 3 (transitions CSS et
mesure de contraste) vaut pour TOUT bouton `Button` par défaut cliqué juste avant une
mesure d'accessibilité — utile à qui écrira une prochaine épreuve de ce type ailleurs
dans le dépôt, pour ne pas reproduire la même chasse.
