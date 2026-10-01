# 9CM-RETOUCHES-2B-REPRISE — captures AVANT/APRÈS

| | |
|---|---|
| **Commit AVANT** | `5127b1b` — main au départ de ce lot (dernier commit de 9CL-RETOUCHES-2A-REPRISE, avant toute retouche de 9CM) |
| **Commit APRÈS** | `3005e43` — dernier commit de code de ce lot (le spec de capture compris) |
| **Date de la prise** | 2026-10-02, ~06h50-06h55 UTC |
| **Base** | PostgreSQL 16 local et jetable (`E2E_DATABASE_URL`/`TEST_DATABASE_URL`, poste d'Alexis), remplie par `prisma migrate deploy` + `pnpm db:seed` — aucune donnée réelle (I9) |
| **Compte** | Le compte de l'épreuve (`adv@codima.test`, rôle `adv`) — le seul compte utilisé pour toutes ces captures |

## Comment elles ont été prises

Même recette que `9CL-RETOUCHES-2A-REPRISE` (note « Captures AVANT/APRÈS par
spec e2e ») pour un AVANT déjà committé : **APRÈS** a été pris d'abord, sur le
dépôt courant, avec `tests/e2e/captures-9cm-etats.spec.ts` (committé,
territoire de ce lot) et `CAPTURES_9CM=<dossier>` ; **AVANT** a été pris
ensuite sur un `git worktree` isolé au commit `5127b1b`
(`git worktree add /tmp/9cm-avant 5127b1b`, `node_modules` lié par symlink —
aucune réinstallation, le store pnpm est content-addressable —, `.env`
copié), avec un fichier JETABLE écrit directement dans le worktree
(`tests/e2e/zz-captures-9cm-avant.spec.ts`, jamais commité, retiré avec le
worktree) : les MÊMES écrans et actions que le spec APRÈS, mais SANS les
assertions propres au code livré (l'icône de la barre du portail, absente
avant ce ticket) — seule la capture importe pour un AVANT. Lancé avec `CI=1`
(jamais `reuseExistingServer`, pour ne pas réutiliser le serveur 3100 de
l'AUTRE code). Le worktree a été retiré après la prise
(`git worktree remove /tmp/9cm-avant --force`).

## Les écrans

- `tiroir-menu-375` — le tiroir de menu ouvert, à 375 px. **AVANT** et
  **APRÈS** sont quasi identiques (les icônes du menu existent depuis 9CB,
  avant ce ticket) : ce lot n'y change que l'icône de « Portail client »
  (`globe`), NON photographiée — aucun rôle de back-office ne porte
  `consulter_parc_propre` (réservée à `CLI`), donc l'entrée ne s'affiche pour
  aucun compte de l'épreuve, avant comme après (voir le docblock du spec).
- `barre-portail-parc-1280` — la barre du portail. **AVANT** : « Votre parc »
  sans icône. **APRÈS** : l'icône `machine` apparaît devant le libellé
  (décision du 30/09, point 15 ; D144).
- `focus-colonne-au-repos-1280` / `focus-colonne-active-1280` — le focus
  clavier sur la colonne sombre. **AVANT** : l'anneau est à peine visible
  (contraste ≈1,40:1 au repos un contour bleu très affaibli sur le fond marine
  — voir la mesure de `tests/unit/theme/focus-barre-sombre.test.ts`).
  **APRÈS** : un anneau clair et net (`--app-chrome-lien`, contraste ≥3:1).
- `tableau-de-bord-tuiles-1280` — **AVANT** : « Dossiers bloqués » et
  « En retard » portent chacune un second lien texte sous la tuile (« Voir
  les dossiers bloqués → », « Voir les interventions en retard → »).
  **APRÈS** : ce lien a disparu, la tuile elle-même reste le seul chemin.
- `interventions-tuiles-1280` — même écart, sur « En cours » et
  « En attente ».
- `tableau-de-bord-en-retard-1280` (AVANT) /
  `tableau-de-bord-en-retard-zero-1280` (APRÈS, NON produite) — la scène
  partagée portait 15 interventions en retard au moment de la prise, des deux
  côtés : la capture « zéro » n'a donc PAS été prise (le spec le dit en
  sortie), conformément à sa propre règle (« seulement si la scène le montre
  ainsi »). La preuve que la tuile n'a plus de lien à zéro reste le test
  unitaire `tests/unit/tableau-de-bord/presentation.test.ts`
  (`lienEnRetard(0)` → `undefined`) et le gardien e2e forgé
  `tests/e2e/tuiles-cliquables.spec.ts` (scène `RET2B-`, en retard non nul).

## Ce que ces captures ne couvrent PAS

**Le terrain** (boutons `size="lg"`, 32→44 px) et **`EtatVide`** (12→14 px,
sans appelant dans `app/`) n'ont pas de capture dédiée dans ce dossier :
`EtatVide` n'a aucun écran à photographier (voir la passation) ; le terrain
est couvert par la suite e2e existante (`rapport-terrain.spec.ts`,
`bon-4.spec.ts`, `terrain-largeur.spec.ts`, inchangées et vertes après le
changement de taille — voir la passation), plutôt qu'un balayage complet de
`scripts/captures.mts` (48 écrans, quatre identités dont deux nécessitant un
second facteur) : la justification en coût/portée est dans la passation,
section « Ce que je n'ai pas fait ».
