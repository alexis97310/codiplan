# 9F5C-DATE-PASSEE-PLANNING — passation

Contrat : `tickets/recales/9F5C-DATE-PASSEE-PLANNING.md` (hors dépôt, voir la reprise ci-dessous).

## Points 1-4 (garde `9F5C-DATE-PASSEE-PLANNING-garde`, 6 commits, partie de `013857b7`)

1. Glisser-déposer et fenêtre de pose proposent la confirmation « date passée » (D123) au lieu de refuser en silence.
2. Transmettre (tiroir ET ligne du registre) propose la question au lieu de se taire.
3. La file « Non affectées » de la vue Jour n'est plus jamais `hors_ouverture`.
4. Le compte des techniciens (Semaine / Deux semaines) ne compte plus la file.

Point 5 (BAS, référence `:231`→`:204`, date relative dans `pose-habilitation.test.ts`) : NON FAIT.
Point 6 (captures + verify + passation) : PARTIEL — seules les captures du point 1 existaient, aucune passation écrite.

## Reprise 9F5CA

### Cause prouvée (point 2 de l'orchestrateur)

`registre-ux3-2.spec.ts:374` (`expect(page.locator('tbody input[type="checkbox"]')).toHaveCount(2)`)
recevait **3** sur l'onglet « Aujourd'hui » (2 Planifiées affichées).

Fichier : `app/(back-office)/interventions/page.tsx:1454` (avant correction, commit `72c1c891`).

Le commit `08dd6242` (point 2 de 9F5C) avait posé une `CaseACocher` permanente
(`confirmer_date_passee`, `libelleVisible={false}`) sur **chaque** ligne
« Planifiée » de l'onglet « Aujourd'hui », par analogie avec le correctif du
tiroir (`components/planning/tiroir.tsx`). Cette case :

- s'ajoutait à celle de `CaseSelectionLigne` (la sélection de ligne du
  registre), faisant passer le compte de 2 à 3 checkboxes par ligne
  sélectionnable — cassant l'épreuve ;
- n'a **jamais** d'utilité : le formulaire de la ligne (`method="post"`,
  sans JS) redirige vers la fiche sur **tout** refus
  (`versLaFiche`, `app/api/interventions/[id]/transmettre/route.ts`) **avant**
  que quiconque puisse la cocher — rien ne la soumet jamais cochée ;
- était une case à cocher **sans texte visible** en permanence sur chaque
  ligne — l'INTERDIT explicite de la reprise.

### Correction (point 3)

`app/(back-office)/interventions/page.tsx` : le bouton de ligne « Transmettre »
(onglet « Aujourd'hui ») revient à un formulaire **sans case** (état
pré-9F5C). L'import `CaseACocher`, devenu inutile dans ce fichier, est retiré.

La question D123 reste systématiquement atteignable : sur un refus
`date_passee` confirmable, la redirection vers `/interventions/{id}?motif=…`
affiche le motif (bannière déjà existante, `[id]/page.tsx:1041`) **et**
`DialogueTransmettre` (`components/interventions/dialogue-transmettre.tsx`),
qui porte déjà la case `confirmer_date_passee`, **visible** — jamais un
silence, jamais une case cachée qui double une autre.

### Pourquoi aucun clic réel sur la ligne ne peut produire ce refus

La vue « Aujourd'hui » du registre filtre strictement
`date_planifiee ∈ [aujourd'hui, demain[` (fuseau de la **société**,
`lib/interventions/depot.ts`, `criteresVue`/`debutDuJourSociete`) : une ligne
qui y est listée a, par construction, une date qui n'est **jamais** déjà
passée au moment du rendu. Le refus `date_passee` confirmable n'est donc
atteignable depuis ce bouton que par une **course** (page restée ouverte au
franchissement de minuit, fuseau agence vs société — `transmettreIntervention`
relit `maintenant(fuseau_agence)` à l'écriture, `lib/interventions/depot.ts:929`).

Un test e2e ne peut pas attendre minuit ni cliquer sur une ligne qui
n'existe pas dans le DOM. Le nouveau test (`tests/e2e/9f5c-date-passee-planning.spec.ts`,
section « 2b ») pose donc, depuis un vrai `<form>` soumis dans le navigateur
(mêmes cookies, même navigation suivant la redirection — aucun raccourci par
`fetch`), **exactement** la requête que le bouton de ligne poserait
(`method=post`, `action=/api/interventions/{id}/transmettre`, sans corps),
sur une Planifiée d'hier créée par la même fabrique que le test du tiroir
(`poserInterventionPassee`). Il vérifie ensuite toute la chaîne : redirection
avec motif → bannière → `DialogueTransmettre` ouvert avec sa case visible →
confirmation → `Affectée` en base.

### Épreuves touchées

- `registre-ux3-2.spec.ts` : 10/10 verts (`CI=1 --workers=1`).
- `tests/e2e/9f5c-date-passee-planning.spec.ts` : 4/4 verts, dont le nouveau
  test « transmettre depuis la ligne du registre… ».
- `tests/e2e/registre-*.spec.ts` + `tests/e2e/planning-*.spec.ts` +
  `tests/e2e/9f5b-date-passee.spec.ts` (132 tests) : tous verts.
- `CI=1 pnpm verify:full` : `format:check`, `typecheck`, `lint`, `test`
  (5040), `test:isolation` (1649), `build`, `feries:horizon`,
  `audit:partitions` tous verts ; `test:e2e` (1519 épreuves) interrompu par
  la limite d'1 h de l'outil, **aucun échec mesuré** dans la trace
  (`verify-final.txt`).

### Captures (`docs/propositions/9F5C-DATE-PASSEE-PLANNING/captures/`)

```
total 500
-rw-r--r-- 1 aplou aplou 113025 9f5c-fenetre-pose-accepte-1280.png
-rw-r--r-- 1 aplou aplou  35654 9f5c-fenetre-pose-dialogue-375.png
-rw-r--r-- 1 aplou aplou 108125 9f5c-glisser-deposer-accepte-1280.png
-rw-r--r-- 1 aplou aplou  51199 9f5c-glisser-deposer-dialogue-375.png
-rw-r--r-- 1 aplou aplou 129148 9f5c-ligne-registre-question-ouverte-1280.png
-rw-r--r-- 1 aplou aplou  54554 9f5c-ligne-registre-question-ouverte-375.png
```

Les quatre premières (point 1) existaient déjà. Les deux dernières (point 5
de la reprise) montrent la fiche après redirection depuis le bouton de ligne :
bannière « Cette date est déjà passée… » et `DialogueTransmettre` ouvert avec
sa case visible — la « ligne du registre, question ouverte » que demandait
la reprise (la ligne elle-même ne peut jamais afficher cet état, voir
ci-dessus : la fiche est où la question se pose réellement).

### Points ouverts (non traités par la reprise, budget de temps)

Point 4 de la reprise, explicitement « si le temps le permet » et de priorité
inférieure à la finalisation (point 5) :

- Captures 375/1280 de la vue Jour avec la file vide BLANCHE et de l'en-tête
  « 4 techniciens » — le CODE (points 3 et 4 de 9F5C) est déjà livré et
  couvert par des tests unitaires/e2e existants (garde `9F5C-DATE-PASSEE-PLANNING-garde`,
  commits `97b6d952`/`8b4a3cda`) ; seules les CAPTURES manquent.
- BAS (point 5 de 9F5C) : référence `planning-deux-semaines.spec.ts:231`→`:204`
  par une Précision dans `docs/arbitrages.md`, et date relative dans
  `tests/isolation/pose-habilitation.test.ts` — NON TRAITÉ.

### État du dépôt en fin de reprise

- `git fetch origin` + `git rebase origin/main` : à jour, rebase propre.
- `CI=1 pnpm verify` : vert.
- Arbre propre (`git status --porcelain` vide).
- Jamais de push.
