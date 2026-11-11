# 9K25A-FEUILLE-DE-ROUTE-AUDIT-TECHNICIEN — passation

Budget 45 min. T0 = 20:35 (Pacific/Noumea, 11/11/2026). Branche dédiée
`9K25A-FEUILLE-DE-ROUTE-AUDIT-TECHNICIEN`, partant d'`origin/main` (`8786d81df`) : `main`
était extrait ailleurs (`/home/aplou/codiplan`, worktree séparé). Jamais poussé.

## Ce qui a été fait

Lot de DONNÉES seulement, `lib/feuille-de-route/contenu.ts` : les 15 points de l'audit
UX de l'application technicien du 10/11/2026 entrent dans la feuille de route, sous
leurs numéros d'audit (B1, B2, M2, M8, M9, P6, m8/m10b/m13, m10a, m11/m12) et le nom de
la maquette correspondante — jamais un chemin, un nom de client ni une donnée qu'elle
contient (I9 ; demande d'Alexis du 10/11 ~23:45).

Commits, dans l'ordre :

1. `8b60d5bde` — points 1-2 : section neuve « Application technicien — audit du
     10/11/2026 » (9 éléments), placée juste après « À écrire après la démo » ; et
     l'élément de gel de l'application technicien complété (audit m3, réouverture
     D220). `DATE_ETAT_FEUILLE_DE_ROUTE` **inchangée** — ce lot ne remet pas à jour le
     reste de la page, comme demandé.
   - même commit — épreuve unitaire neuve `tests/unit/feuille-de-route/contenu.test.ts` :
     vérifie l'existence de la section et ses 9 titres mot pour mot, plus leurs statuts.
   - `5a55bb43d` — point 3 : captures AVANT/APRÈS, 375 et 1280 px, de
     `/feuille-de-route`.

## Les 9 éléments, et leur statut

| Statut | Élément |
|---|---|
| `pret` | B1 et M1 — alerte signature non recueillie (maquette 06-terminer) |
| `pret` | B2 et M3 — « Terminer » exige le commentaire (maquette 06-terminer) |
| `decision` | M2 — fiche en quatre étapes contre un seul écran (maquettes 02 à 05) |
| `a_ecrire` | M8 — Ma journée, tri et carte « À faire maintenant » (maquette 01-journee) |
| `decision` | M9 — « Annuler le démarrage » 10 s (maquette 02-infos) |
| `a_ecrire` | P6 — catalogue des prestations par import (maquette 03-rapport) |
| `a_ecrire` | m8, m10b, m13 — en-tête, Profil, pastille hors-ligne (maquettes 01-journee, 07-profil) |
| `a_ecrire` | m10a — signature agrandie, nom prérempli (maquette 05-signature) |
| `decision` | m11 et m12 — bleu/rouge, cases 26 px (maquette 03-rapport) |

## Les captures AVANT/APRÈS

Spec dédié `tests/e2e/captures-9k25a-feuille-de-route-audit.spec.ts` (variable
`MOMENT_CAPTURE`), recette « captures AVANT/APRÈS » déjà éprouvée sur d'autres lots :
APRÈS capturé directement ici (code courant) ; AVANT capturé dans un worktree
temporaire sur `origin/main` (`/tmp/9k25a-avant`, `node_modules` lié, `.env` copié,
`CI=1`), PNG recopiés puis worktree supprimé. Fichiers dans
`docs/propositions/9K25A-FEUILLE-DE-ROUTE-AUDIT-TECHNICIEN/captures/` :
`avant-1280.png`, `avant-375.png`, `apres-1280.png`, `apres-375.png`.

En relançant `tests/e2e/captures-9ic5-feuille-de-route.spec.ts` pour vérifier la chaîne
existante, ses propres PNG (`docs/propositions/9IC5-FEUILLE-DE-ROUTE/captures/`) ont été
régénérés à l'identique (page simplement plus longue) ; restaurés avec `git checkout --`
avant le commit pour ne pas polluer ce lot avec un diff hors périmètre.

## Épreuves jouées, au premier plan

- `pnpm vitest run tests/unit/feuille-de-route/contenu.test.ts
  tests/unit/navigation/feuille-de-route-entree.test.ts` — 15 passées.
- `pnpm exec playwright test tests/e2e/9ic5-feuille-de-route.spec.ts` — 3 passées.
- `pnpm exec playwright test tests/e2e/captures-9ic5-feuille-de-route.spec.ts` — 4
  passées (régénère ses propres PNG, restaurés ensuite, voir ci-dessus).
- `MOMENT_CAPTURE=apres pnpm exec playwright test
  tests/e2e/captures-9k25a-feuille-de-route-audit.spec.ts` — 2 passées.
- `CI=1 MOMENT_CAPTURE=avant pnpm exec playwright test
  tests/e2e/captures-9k25a-feuille-de-route-audit.spec.ts` (dans le worktree temporaire)
  — 2 passées.
- `CI=1 pnpm verify` — vert : format, typecheck, lint, 5719 épreuves unitaires
  (519 fichiers), 2147 épreuves d'isolation (239 fichiers), build.

`verify:full` n'a PAS été joué par cette session (la file le joue après coup, comme
demandé).

## Hors périmètre, par instruction du ticket

Aucune migration, aucun code d'écran, aucun composant ni style touché. Aucun fichier de
maquette ni relevé d'audit ajouté au dépôt. `docs/backlog.md` et les scripts de file non
touchés.

## Arbre au moment de rendre la main

`git fetch origin` + `git rebase origin/main` faits ; branche
`9K25A-FEUILLE-DE-ROUTE-AUDIT-TECHNICIEN` à jour sur `origin/main`, arbre propre, rien
poussé.
