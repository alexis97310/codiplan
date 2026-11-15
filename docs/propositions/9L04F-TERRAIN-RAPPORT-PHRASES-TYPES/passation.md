# 9L04F-TERRAIN-RAPPORT-PHRASES-TYPES — passation

Aucune migration, aucun changement de schéma. Ce lot ajoute, au rapport de la fiche terrain
(`components/terrain/rapport-automatique.tsx`, monté aussi bien en ligne que par la coquille hors réseau),
un lien « Phrases types » (4 phrases fixes, insertion au curseur du commentaire) et un lien « Reprendre la
non-conformité de la checklist » (une ligne par point non conforme, affiché seulement s'il en existe au
moins un). Les deux zones « Commentaire » et « Suite à donner » passent au style épuré (fond
`#F1F3F6`/`bg-app-terrain-champ-fond`, sans bordure, rayon 12 px/`rounded-md`).

## 1. Ce qui a été mesuré avant d'écrire une ligne

- **`rapport-automatique.tsx` est le SEUL fichier qui rend « Commentaire »/« Suite à donner »** — la coquille
  hors réseau (`consultation-hors-reseau.tsx`) réutilise le même composant, `sansSession`, jamais une
  seconde composition du même écran (§9, 01/09). Les deux fichiers ont donc été touchés pour le PROP
  `checklistPourTerminer.points` (ajout de `typeReponse`, voir §2), jamais pour le rendu lui-même.
- **Aucun format de « ligne de reprise » n'existait** avant ce lot : `lib/checklists/suite-preremplie.ts`
  ne portait que `ligneNonConforme`/`suiteAvecLigne`, appelées au moment où `checklist-terrain.tsx` signale
  un point qui VIENT de passer non conforme (événement `EVENEMENT_CHECKLIST_NON_CONFORME`). Rien ne donnait,
  à `rapport-automatique.tsx`, la liste des points ACTUELLEMENT non conformes (la seule chose qu'il connaît
  déjà, par le même patron, est `obligatoiresManquantsDepuisFile` pour le bouton « Terminer », CK7/9K23).
  `nonConformesDepuisFile` (nouvelle fonction, même fichier) rejoue exactement cette discipline — copie
  locale (`checklistPourTerminer.reponsesInitiales`) puis file (`GesteChecklist.difference`, qui prend le
  pas point par point) — mais doit en plus savoir si un point est bien du type
  `conforme_non_conforme_sans_objet` : une réponse `choix_dans_une_liste` ou `texte_libre` pourrait en
  théorie porter la valeur littérale `"non_conforme"` sans que ce soit une non-conformité. `typeReponse`
  n'était donc pas optionnel dans `checklistPourTerminer.points` ; il a fallu l'y ajouter (page.tsx,
  consultation-hors-reseau.tsx, et le type de test `ProprietesScene`).
- **Conflit avec deux gardiens D143, pas un** (mesuré en faisant tourner `CI=1 pnpm verify` une première
  fois) :
  - **Point 11** (700 minimum pour un texte de 12-13 px) — déjà amendé par D253 pour
    `checklist-terrain.tsx` SEUL ; mes deux liens (`text-13 font-medium`) y seraient tombés aussi.
  - **Point 8** (dans les 7 fichiers du terrain dont `rapport-automatique.tsx`, toute taille hors
    16/18/24/28 px est refusée, sauf un surtitre `uppercase` ou une pastille `rounded-full`) — AUCUNE liste
    d'exemption n'existe pour ce point ; un lien n'est ni l'un ni l'autre.
  - **Décision prise sans ouvrir de nouvel arbitrage** : les deux liens passent à `text-16` plutôt que
    `text-13`. Le style épuré autorise « textes secondaires 13-14 px », il ne l'EXIGE pas ; la couleur
    (`text-app-terrain-encre-secondaire`) et le soulignement suffisent à les distinguer des libellés sans
    toucher à deux gardiens pour un simple lien. Si une future fiche technique redemande explicitement 13 px
    ici, ce choix devient un point d'arrêt (CLAUDE.md §8 : assouplissement d'un invariant de présentation
    déjà arbitré).
  - Les deux gardiens qui COMPTENT les `<Button>` du terrain (`composants-base.test.tsx`,
    `retouches-2a.test.ts`, même population, 21 → 22) ont dû être mis à jour : le bouton « Fermer » de la
    liste de phrases types est un `<Button>` de plus.
- **`pnpm captures:etat` signale 427 fichiers de surface changés depuis la prise `ad4feee` (2026-09-27)**,
  bien avant ce lot. Aucun écran `/terrain` ne figure dans `docs/captures/README.md` : ils y sont REFUSÉS
  (`COURRIEL_TERRAIN`/`MOT_DE_PASSE_TERRAIN` absents de la procédure documentée). Rejouer
  `scripts/captures.mts` au complet (3 identités à amorcer, un serveur de production à relancer) est un
  chantier à part, sans rapport avec ce lot précis, et hors de son budget de 90 minutes — **signalé plutôt
  que tenté à moitié**. Les captures PROPRES à ce ticket (voir §4) sont faites et committées, comme pour
  chaque lot récent.

## 2. Ce qui a été fait

- **`lib/i18n/fr.ts`** : bloc neuf sous `terrain.rapport.*` — lien et titre de la liste de phrases types,
  les 4 phrases (`phrase_1` à `phrase_4`, une clé chacune — le dictionnaire reste plat, jamais un tableau),
  et le libellé du lien de reprise.
- **`lib/terrain/phrases-types.ts`** (nouveau) : `phrasesTypesTerrain()` — les 4 clés énumérées UNE SEULE
  fois — et `texteAvecPhraseInseree(texteActuel, phrase, position)`, fonction pure : insère à `position`, ou
  en fin de texte sur une nouvelle ligne si `position` est inconnue.
- **`lib/checklists/suite-preremplie.ts`** : `suiteAvecLignes` (plusieurs lignes, même garde anti-doublon
  que `suiteAvecLigne`) et `lignesReprise(points)` — réutilise `ligneNonConforme`, donc EXACTEMENT le même
  format que l'ajout automatique de CK5/9K21. `PointNonConformePourReprise` porte `id` bien qu'inutilisé ici
  : c'est l'ancrage que 9L04I (détail par point : suite, commentaire) pourra enrichir sans changer cette
  forme.
- **`components/terrain/rapport-automatique.tsx`** :
  - `nonConformesDepuisFile` (miroir de `obligatoiresManquantsDepuisFile`), relu au montage et à chaque
    `EVENEMENT_FILE_MODIFIEE`, alimente `pointsNonConformesAffiches` — commande la présence du lien.
  - `ouvrirPhrasesTypes`/`choisirPhraseType` : la position du curseur du commentaire est relevée AVANT
    d'ouvrir la liste (l'ouverture déplace le focus), puis rejouée à l'insertion.
  - `reprendreLesNonConformites` : `suiteAvecLignes` sur la liste courante, jamais un remplacement.
  - Les deux zones de texte passent à `bg-app-terrain-champ-fond`/`rounded-md` (sans bordure), les libellés
    à `text-app-terrain-encre`/`font-medium` (500, jamais 700).
- **`app/(mobile)/terrain/[id]/page.tsx`**, **`components/terrain/consultation-hors-reseau.tsx`** :
  `typeReponse` ajouté aux points de `checklistPourTerminer` (voir §1).

## 3. Épreuves

- **`tests/unit/terrain/phrases-types.test.ts`** (neuf) : les 4 phrases dans l'ordre du dictionnaire ;
  insertion au curseur, en texte vide, en fin de texte (position inconnue ou hors bornes).
- **`tests/unit/checklists/suite-preremplie.test.ts`** : `suiteAvecLignes` (plusieurs lignes, anti-doublon
  parmi plusieurs) et `lignesReprise` (une ligne par point, même format que `ligneNonConforme`, tableau vide
  si aucun point).
- **`tests/unit/ui/composants-base.test.tsx`**, **`tests/unit/ui/retouches-2a.test.ts`** : comptes mis à
  jour (21 → 22), arithmétique continuée en commentaire.
- **`tests/e2e/9l04f-terrain-rapport-phrases-types.spec.ts`** (375 px) : « Phrases types » insère la phrase
  choisie et le texte reste modifiable ; « Reprendre la non-conformité de la checklist » est absent sans
  non-conformité, apparaît dès qu'un point bascule, insère une ligne par point (jamais en double au second
  clic), et reste visible même si une seule des deux non-conformités est ensuite corrigée (le texte déjà
  écrit n'est jamais retiré).
- `pnpm test:isolation` et `CI=1 pnpm verify` passent (build inclus).

## 4. Captures (375 px, avant/après)

`docs/propositions/9L04F-TERRAIN-RAPPORT-PHRASES-TYPES/captures/` :
- `rapport-vide-375.png` — avant.
- `phrases-types-ouvertes-375.png` — la liste des 4 phrases.
- `rapport-non-conformites-a-reprendre-375.png` — deux points non conformes, le lien de reprise visible.
- `rapport-remplie-375.png` — après : la suite porte les deux lignes reprises, une non-conformité corrigée.

Le refresh complet de `docs/captures/` (procédure de `docs/captures/README.md`) n'a PAS été rejoué — voir §1,
dernier point : la dérive (427 fichiers) précède ce lot de plusieurs semaines et aucun écran `/terrain` n'y
est photographié aujourd'hui.

## 5. Pour 9L04I (détail par point : suite, commentaire)

`lignesReprise` prend aujourd'hui `{ id, section, libelle }[]` et rend des `string[]` — une ligne de texte
libre, fusionnée dans « Suite à donner ». Si 9L04I doit porter un détail par point (une suite et un
commentaire propres à CHAQUE non-conformité, pas un texte unique), deux pistes sans rien casser ici :
- garder `lignesReprise` pour la fusion texte actuelle, et ajouter EN PLUS une structure dédiée (table ou
  state) indexée par `checklistPointId` — `PointNonConformePourReprise.id` existe déjà pour s'y ancrer ;
- ou remplacer le texte libre par cette structure, et faire de `lignesReprise` une simple PROJECTION
  d'affichage de cette dernière (la signature resterait valide, son corps changerait).
Rien dans ce lot ne verrouille l'un ou l'autre choix.

## 7. Reprise 9L04FA — rebase, cause mesurée, et sa portée réelle

Branche `9L04FA-REPRISE-RAPPORT-PHRASES-TYPES`, partie d'`origin/main` (tip `df1c83985`,
9L04EA-REPRISE-PHOTOS-EPUREES). Les 3 commits de `9L04F-TERRAIN-RAPPORT-PHRASES-TYPES-garde`
reportés par cherry-pick, dans l'ordre, sans modification de leur contenu propre — seuls les
conflits de fusion avec le code publié depuis ont demandé une résolution :

- **`app/(mobile)/terrain/[id]/page.tsx`** (commit point 1-3) : conflit de fusion purement
  TEXTUEL, pas sémantique — 9L04D/9L04E/9L04EA ont réindenté toute cette portion de fichier
  (ajout de `<BarreActionTerrain>` autour de `<main>`, déplacement de `ChecklistTerrain`/
  `RapportTerrainAutomatique`/`sectionPhotos` plus loin dans l'arbre JSX), et par coïncidence
  les props finales de `BoutonCompteurTerrain` (ours) et de `PhotosTerrain` (theirs) partagent
  les mêmes noms (`interventionId`, `utilisateurId`, `societeId`, `statut`, …), ce qui a fait
  gonfler le hunk de fusion sur ~100 lignes sans rapport. Le changement RÉEL de ce commit pour
  ce fichier : une seule ligne, `typeReponse: point.typeReponse,` dans le mapping de
  `checklistPourTerminer.points` — résolu en prenant `--ours` en bloc puis en réappliquant
  cette seule ligne, au même endroit logique (la structure a bougé, pas le besoin).
- **`tests/unit/ui/composants-base.test.tsx` / `tests/unit/ui/retouches-2a.test.ts`** (commit
  point 5) : les deux gardiens comptent, en commentaire narratif ET en assertion, le nombre
  total de `<Button>` littéraux posés dans `app/`/`components/` ; `9L04F-…-garde` les avait
  incrémentés depuis sa propre base (21 → 22, le « Fermer » de la liste de phrases types), mais
  `9L04E-TERRAIN-PHOTOS-EPUREES`, publié après, les avait déjà incrémentés depuis la MÊME base
  pour une raison différente (21 → 28, `photos-terrain.tsx`). Les deux additions sont
  indépendantes et s'accumulent : **21 + 7 (9L04E) + 1 (9L04F) = 29**. Comptes et commentaires
  mis à jour en conséquence dans les deux fichiers.

### La cause mesurée par le pilote, et sa portée réelle

Le contrat de recalage nommait `tests/e2e/offline/9f4h1-consultation.spec.ts:104`,
`expect(getByRole('button')).toHaveCount(7)` recevant `8`. Une fois la branche rebasée, ce
mécanisme n'existe plus tel que décrit : la scène ne compare jamais à un total figé depuis
`9F4H4BA-REPRISE-9F4H4B` (correctif antérieur au point de divergence de `9L04F-…-garde`) — elle
réconcilie `page.getByRole("button")` contre une liste NOMMÉE (`nomsBoutonsAttendus`), chaque
nom compté séparément puis sommé. Le défaut réel, une fois la liste de boutons du rapport
enrichie par ce lot, est donc que cette liste ne nommait pas les deux boutons neufs : la somme
restait inférieure au total réel, et l'assertion aurait échoué (pas accidentellement passé).
Corrigé en ajoutant à `nomsBoutonsAttendus` (commit séparé de cette reprise, voir le journal
git) :
- `fr["terrain.rapport.phrases_types.lien"]` — toujours affiché sous le commentaire, geste
  utilisable hors réseau (insère une phrase sans appel réseau, 9L04F point 2).
- `fr["terrain.rapport.reprendre_non_conformites"]` — affiché seulement s'il existe un point
  non conforme, même discipline que `terrain.pieces.retirer` déjà dans la liste (`.count()`
  vaut 0 sinon, ce qui est le cas dans cette scène : aucune checklist non conforme n'y est
  posée).

### Recherche de la même famille (point 3 du contrat)

Localisateurs cherchés dans `tests/e2e/**` qui comptent des boutons sans portée ou pourraient
rencontrer l'écran modifié (`rapport-automatique.tsx`, `consultation-hors-reseau.tsx`,
`[id]/page.tsx`) :
- `tests/e2e/offline/9f4h4-ouverture-a-froid.spec.ts:472`,
  `tests/e2e/9ewe-tarifs-page-unique.spec.ts:238`,
  `tests/e2e/absences-ecourter-etat.spec.ts:268` — chacun vérifie `toHaveCount(0)` sur un état
  où AUCUNE fiche de rapport ne monte (copie absente, ou écran sans rapport) : sans rapport, le
  nouveau bouton ne peut pas apparaître. Inchangés.
- `tests/e2e/9l04i-checklist-non-conforme-detail.spec.ts` et
  `tests/e2e/9l04m-checklist-retrait-reponse.spec.ts` — `.getByRole("button").last()`, mais
  scopé sur `ligneDuPoint(...)` (une seule ligne de checklist), jamais sur la section rapport où
  vivent les boutons neufs. Inchangés.
- Aucun autre `getByText`/`getByRole` NON exact sur « Phrases types » ou « Fermer » (seule
  collision : `captures-pg-b3-trouver-creneau-fiche.spec.ts:150`, un `<button>` « Fermer » sur
  un écran de recherche de créneau sans rapport, jamais co-monté avec celui-ci).

### Captures

Aucune refaite : aucun écran de ce ticket n'a changé de rendu dans cette reprise (seul un
localisateur de test). Rejouer les scènes offline/rapport a régénéré par effet de bord 64 PNG
dans des tickets sans rapport (dates affichées, antialiasing), dont les 4 propres à ce ticket
— remis à l'état committé (`git checkout --/git clean -f` sur `*.png`), pas commités, même
discipline que la reprise 9L04EA.

### Vérification finale

`pnpm typecheck` vert. E2E ciblées (`CI=1 --workers=1`) : `tests/e2e/offline/`, la famille
`*rapport*`, `9l04f-terrain-rapport-phrases-types.spec.ts`,
`tests/e2e/tous-les-ecrans-rendent.spec.ts` — 124 tests, 120 passés, 4 ignorés (inchangé).
`pnpm test:isolation` — 2255 tests passés. `CI=1 pnpm verify` (format:check + typecheck + lint +
test + test:isolation + build) **vert**.
