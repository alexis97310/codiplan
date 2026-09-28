# Captures — PG-B4-SURVOL-CASES

Spécification §3.11 — pendant un glisser-déposer, rien n'indiquait qu'une case refuserait la pose :
absences et fermetures hebdomadaires sont dessinées sur la grille (PLANNING-1), mais le refus ne se
lisait qu'APRÈS le dépôt (`components/planning/pose.tsx`, `interpreterReponseDepot`). `etatDeLaCase`
(`lib/interventions/survol.ts`, neuf) donne PENDANT le glissé un indice tiré des mêmes données déjà
chargées par la page — jamais une requête.

Prises par `tests/e2e/captures-pg-b4-survol-cases.spec.ts` (env `CAPTURES_PG_B4`), sur sa propre
scène (préfixe `PGB4-`) : une intervention « À planifier » glissée au-dessus de la case de
M. Poigoune (agence Koné) un MERCREDI, où une absence a été déclarée pour ce test. Le glissé
s'arrête AVANT le dépôt (`mouse.up` hors de toute case) — le survol est un indice, il n'écrit rien.

- `survol-absent-semaine-avant-*.png` — rejoué sur le code d'AVANT ce ticket (`git worktree` sur le
  commit `ca9bcea`, 9BCA-REPRISE-9BC, le dernier avant ce ticket) : rien ne distingue la case
  survolée d'une case ordinaire pendant le glissé.
- `survol-absent-semaine-apres-*.png` — après le commit de PG-B4-SURVOL-CASES : la case se teinte
  en refus (jeton `app-rouge`, existant) et affiche « Absent » en clair, en plus de la pastille
  « Agenda bloqué » déjà dessinée par PLANNING-1.

**À 1280 px seulement.** Le glisser-déposer HTML5 n'a pas d'équivalent tactile — la grille
glissable est `hidden ... lg:block` (`app/(back-office)/planning/page.tsx`) — et, à la différence
de PG-B2 qui offrait un bouton « Poser » comme substitut clavier/mobile, le survol n'a pas de
substitut au clic : il n'existe donc pas de capture à 375 px pour ce ticket.
