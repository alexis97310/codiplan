# Captures — 9CS-EN-RETARD-VERT-A-ZERO

Prises par `tests/e2e/captures-9cs-en-retard-vert-a-zero.spec.ts` (env `CAPTURES_9CS`),
sans scène forgée — lecture seule, le jeu de démonstration du seed suffit (I9).

- `tableau-de-bord-avant-*.png` — rejoué sur le code d'AVANT ce lot (`git worktree` sur le
  commit `e785ae5`, 9CR-CI-CLOISONNEMENT-CONNEXION — passation, le dernier commit avant ce
  lot).
- `tableau-de-bord-apres-*.png` — après le commit de code de ce lot (`54fe6d5`).

## La tuile « En retard » N'EST PAS photographiée à 0

Le jeu de démonstration du seed (`prisma/seed.ts`) pose aujourd'hui **15** interventions
« en retard » sur CODIMA Nouvelle-Calédonie — la tuile s'y lit donc au-dessus de zéro, et
reste au ton **rouge** des deux côtés : les deux paires de captures sont identiques **au
bit près** (`cmp`, exit 0) à 1280 et 375 px, avant comme après ce lot.

Un spec de captures en lecture seule ne peut pas forcer ce compte à 0 sans écrire sur la
scène de démonstration partagée (I9, et le piège connu du ticket sur les épreuves qui
comptent large). **La preuve du ton vert à zéro est donc le test unitaire** —
`tests/unit/tableau-de-bord/presentation.test.ts`, describe « « En retard » passe au vert
à zéro (décision du 02/10/2026, point 4 ; D148) » : `tonEnRetard(0)` rend `"vert"`,
`tonEnRetard(1)` et `tonEnRetard(7)` restent `"rouge"`.
