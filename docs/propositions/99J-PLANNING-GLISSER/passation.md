# 99J-PLANNING-GLISSER — passation

## Ce que j'ai changé

Sur `/planning` (vues semaine et jour), à partir de `lg` (bureau), le
sous-titre porte désormais « · Glisser-déposer pour réaffecter » — le texte
de la maquette qui fait foi (D95, `docs/maquette/CODIPLAN_Maquette.html`
l.~261), après la date. Trois fichiers :

- `lib/i18n/fr.ts` — une clé neuve, `planning.glisser_pour_reaffecter`. Le
  séparateur `· ` est PORTÉ PAR LA CLÉ (`"· Glisser-déposer pour
  réaffecter"`), pas écrit à côté dans le JSX : `react/jsx-no-literals`
  refuse un littéral `{" · "}` entre deux expressions, même de la seule
  ponctuation — même patron que `planning.jour_avant`, qui porte déjà sa
  propre flèche dans la chaîne.
- `app/(back-office)/planning/page.tsx` — le `sousTitre` de `<Page>` passe
  d'une chaîne à un fragment : le texte de date existant, puis un `<span
  data-mention-glisser-reaffecter className="hidden lg:inline">` qui ne
  rend la mention qu'à partir de `lg` ET seulement si le rôle courant
  détient `modifier_planning` (`peutModifierLePlanning`, calculée une fois
  près de `contexte`, même patron que la fiche d'intervention).
- `tests/e2e/planning-glisser-annonce.spec.ts` — l'épreuve neuve (voir plus
  bas).

## Pourquoi le rôle compte, et comment je l'ai déterminé

`components/planning/pose.tsx` (`BlocPosable`/`CasePosable`) ne lit AUCUN
rôle : la grille est rendue draggable pour QUICONQUE voit `/planning`, et
c'est la route serveur `/api/interventions/[id]/deplacer` seule qui refuse
un dépôt sans `modifier_planning` (`exigerCapacite`, déjà en place). Ce
lot ne touche pas à cet écart préexistant (hors territoire, et `pose.tsx`
est explicitement interdit) — il se contente de ne pas l'AGGRAVER : la
mention neuve, elle, ne s'affiche qu'au rôle qui peut réellement déposer
(`peut(contexte.role, "modifier_planning")`, la même capacité que la route
exige et que la fiche d'intervention lit déjà pour son propre bouton
« Déplacer »). Un rôle sans cette capacité (`technicien`, `client`) ne
voit donc que la grille silencieuse — pas pire qu'avant, jamais un texte
qui promet un geste que la route refuserait en silence (D-06).

## Ce que j'ai mesuré

`tests/e2e/planning-glisser-annonce.spec.ts`, sous l'identité
`admin_societe` de la scène (`COMPTE_ADMIN_SOCIETE_EPREUVE`, `complet` sur
`modifier_planning`) :

- à 1280×800, `[data-mention-glisser-reaffecter]` est visible et contient
  `fr["planning.glisser_pour_reaffecter"]` ;
- à 375×812, la même mention n'est PAS visible (existe dans le DOM,
  `display: none` sous `lg`), et `planning.liste_lecture_seule` reste
  visible — les deux mentions ne se contredisent jamais à la même largeur.

Aucune donnée créée : la grille est non vide grâce aux témoins déjà posés
par la scène partagée (`poigoune@codima.test`, `guerin@codima.test`), donc
aucun risque de compter un semis sous `fullyParallel`.

## Ce que je n'ai PAS fait

- Je n'ai pas touché `components/planning/pose.tsx` ni
  `tests/e2e/glisser-deposer.spec.ts` (interdits du ticket).
- Je n'ai pas fait dépendre le RENDU de la grille (`BlocPosable`/
  `CasePosable`) du rôle — seul le TEXTE d'annonce est gardé par le droit.
  Corriger l'écart de `pose.tsx` (grille draggable pour tout rôle) est un
  ticket à part : plus large, et hors du budget de 150 minutes de celui-ci.
- Je n'ai posé aucune migration, aucune ligne de semis, aucun prix.
- Aucune capture n'a été ajoutée : le ticket ne le demande pas dans « CE QUE
  TU FAIS » (contrairement à 99F-CIBLES-375 ou 99E-EVITEMENT), seulement
  l'épreuve et la passation.

## `CI=1 pnpm verify:full`

Un seul passage complet, vert : 296 passés, 3 sautés, 0 échec (299 au
total, contre 296+3 avant ce lot — les deux épreuves neuves de ce ticket
sont donc bien comptées, sans régression ailleurs).

## Pièges pour la session suivante

- `react/jsx-no-literals` (`noStrings: true`) refuse même un littéral de
  PONCTUATION seul (`{" · "}`) entre deux expressions JSX : si un séparateur
  doit apparaître entre deux morceaux composés, le porter dans la clé du
  dictionnaire plutôt que de l'écrire à côté dans le JSX.
- `sousTitre` de `components/mise-en-page/page.tsx` accepte déjà
  `React.ReactNode` (pas seulement une chaîne) : aucun changement n'était
  nécessaire là pour composer un sous-titre à plusieurs morceaux.
