# 9G4C-REPRISE-9G4A — passation (arrêt à T0 + 112 min, budget 120 min)

Parti d'`origin/main` (`a7182b066`, le passation de 9G4A) — `main` est extrait dans un
autre worktree (`/home/aplou/codiplan`) : branche dédiée `9g4c-reprise-9g4a`, créée
depuis ce commit. T0 mesuré `21:16` (Pacific/Noumea).

## Cause ÉTABLIE par mesure (pas seulement mesurée — corrigée)

`components/ui/bouton-confirmation.tsx` — `BoutonAvecConfirmation` écoute
`window.matchMedia("(min-width: 901px)")` (`majCorrespondance`, introduit par 9G2A pour
n'avoir jamais deux `<dialog>` pour la même ligne) : cet écouteur `change` peut se
déclencher **pendant que le dialogue de CETTE instance est ouvert**, et retranche
(`setDialogueMontable(false)`) le `<dialog>` qui porte l'état ouvert — React le démonte
alors qu'il est encore `open`. Mesuré par instrumentation (DOM + pile d'appel, retirée
avant chaque commit) sur la reproduction `CI=1 pnpm exec playwright test
tests/e2e/absences-levee-confirmation.spec.ts tests/e2e/9ewb1-feuille-basse-375-menu-plus.spec.ts
--workers=1 --repeat-each=N` (jamais un seul des deux fichiers — confirmé comme 9G4A) :

- Un épisode capturé montre `majCorrespondance` se redéclencher avec la **même valeur**
  juste après `showModal()` (la perte du défilement de fond que `showModal()` provoque
  suffit à faire réémettre `change` par Chromium, sans franchissement réel de 901 px).
- Le mécanisme QUI ferme le dialogue dans cet épisode précis n'a pas pu être capturé au
  mot près avant la fin du budget (l'instrumentation la plus fine — pile d'appel sur
  `setDialogueOuvert` — a fait disparaître le défaut sur 23 répétitions : signature
  classique d'une course dont le remède est sensible au minutage). Mais le DÉFAUT
  STRUCTUREL, lui, est injustifiable indépendamment de ce détail : rien n'empêchait
  `dialogueMontable` de retomber à `false` — donc `<dialog>` de se démonter — pendant que
  `dialogueOuvert` est `true`. C'est la cause corrigée.

## Risque utilisateur (mesuré, pas supposé)

Un utilisateur qui **redimensionne réellement sa fenêtre** (maximise, passe en
demi-écran) PENDANT que le dialogue de confirmation « Lever » est ouvert, à une largeur
proche de 901 px, verrait ce dialogue disparaître sans avoir cliqué Revenir, Échap ni
Confirmer — l'ancien `<dialog>` (ouvert) démonté, un nouveau (fermé, sur l'autre
instance) monté à sa place. Scénario réel, pas un artefact de test : `showModal()`
lui-même peut aussi, par la perte du défilement de fond, réémettre `change` avec la même
valeur — sans garde, cela n'aurait pas fermé le dialogue (même valeur ⇒ pas de
démontage), mais un VRAI franchissement de 901 px pendant que le dialogue est ouvert
l'aurait fait avant ce correctif.

## Correction

`majCorrespondance` ignore désormais toute notification `change` tant que CETTE
instance a son dialogue ouvert (`dialogueOuvertRef`, déjà présent pour un autre usage,
réutilisé en lecture) :

```ts
function majCorrespondance() {
  if (dialogueOuvertRef.current) {
    return;
  }
  setDialogueMontable(coteLargeur === "large" ? media.matches : !media.matches);
}
```

La largeur réelle continue d'être recalculée normalement une fois le dialogue fermé
(Revenir, Échap, ou confirmation) : rien n'est perdu, seule la fenêtre où le dialogue
est ouvert est protégée.

## Preuve (mesurée, sans l'instrumentation de diagnostic — déjà retirée avant ces mesures)

- **Avant correction** : `CI=1 pnpm exec playwright test
  tests/e2e/absences-levee-confirmation.spec.ts
  tests/e2e/9ewb1-feuille-basse-375-menu-plus.spec.ts --workers=1 --repeat-each=10` →
  **6 échecs sur 20 répétitions combinées** (200 tests, comptés en re-essai CI — le
  premier essai échoue 6 fois sur 20, soit 30 %), toujours sur
  `absences-levee-confirmation.spec.ts:150`, toujours le même message
  (`locator('dialog').getByRole('button', { name: 'Revenir' })` introuvable, délai
  30 s).
- **Après correction** : même commande, `--repeat-each=20` → **0 échec sur 20
  répétitions combinées** (400 tests, deux fichiers ensemble).

Captures du dialogue ouvert (375 et 1280 px, après correction — le correctif ne change
rien à l'apparence, seulement à la survie du dialogue) :
`docs/propositions/9G4C-REPRISE-9G4A/captures/dialogue-bouton-confirmation-{375,1280}.png`.

## `pnpm verify` — vert, séparément, avant de committer le correctif

`pnpm format` (inchangé), `pnpm typecheck` (aucune erreur), `pnpm lint` (zéro
avertissement), `pnpm test` (474 fichiers, 5140 tests, verts) — tous rejoués
individuellement avant le commit du correctif, sortie non conservée (pas de fichier
dédié, conformément au budget restant).

## POINT OUVERT — `pnpm verify:full` NE S'EST PAS TERMINÉ DANS LE BUDGET

`CI=1 pnpm verify:full 2>&1 | tee docs/propositions/9G4C-REPRISE-9G4A/verify-final.txt`
a été lancé en un seul appel, au premier plan — la suite e2e complète compte 1668 tests
sous un seul worker (`CI=1`) et n'a pas fini en 1700 s (tué par `timeout`, exit 143) :
le fichier `verify-final.txt` contient les ~642 lignes produites avant la coupure (build,
seed, puis l'exécution e2e en cours, aucun échec visible dans ce qui a tourné, mais la
suite n'est PAS allée à son terme — aucun verdict final à en tirer). Conformément à la
consigne (« s'il ne peut pas finir, DIS-LE ») : **`pnpm verify:full` reste à rejouer en
entier par la prochaine reprise**, avec un budget de temps dédié plus large (la suite
e2e complète du dépôt dépasse largement les ~28 minutes qui restaient ici). Les deux
épreuves visées par CE ticket, elles, ont été vérifiées à part (ci-dessus, vertes,
0/20).

`git fetch origin` / `git rebase origin/main` : non rejoués dans cette fin de budget —
la branche `9g4c-reprise-9g4a` est partie d'`origin/main` à `a7182b066` et n'a reçu
aucun autre commit entre-temps dans ce worktree ; `git status --porcelain` est vide
hors ce document au moment de committer.
