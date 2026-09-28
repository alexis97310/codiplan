# Captures — PG-A2-ORDRE-TECHNICIENS

Vue Jour du planning (`/planning?vue=jour`), sur le jeu de démonstration (`pnpm db:seed`,
compte `adv@codima.test`, société CODIMA-NC) — aucune scène forgée : le défaut se reproduit
directement avec les quatre techniciens du semis, dont les UUID ne trient pas dans le même
ordre que leurs noms.

Prises par `tests/e2e/captures-pg-a2-ordre-techniciens.spec.ts` (env `CAPTURES_PG_A2`), un jour
OUVERT de la scène, le lundi 21/09/2026 :

- `jour-21-09-2026-ordre-avant-*.png` — rejoué sur le code d'AVANT ce ticket (`git worktree` sur
  le commit `4496d00`, PG-A1-FERIES-GRILLE, le dernier avant PG-A2-ORDRE-TECHNICIENS) : les
  colonnes s'affichent dans l'ordre **D. Guérin, T. Wamytan, M. Poigoune, J. Lefèvre** — l'ordre
  de leur `technicienId` (UUID), pas celui de leur nom.
- `jour-21-09-2026-ordre-apres-*.png` — après le commit `PG-A2-ORDRE-TECHNICIENS` (empreinte
  `76cb01e`) : les colonnes s'affichent dans l'ordre **D. Guérin, J. Lefèvre, M. Poigoune,
  T. Wamytan** — l'ordre alphabétique, EXACTEMENT celui déjà rendu par la grille Semaine
  (`/planning`, visible dans les captures de PG-A1-FERIES-GRILLE).

À 1280 et 375 px.
