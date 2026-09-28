# Captures — PG-A7-SEMAINE-GARDE-HEURE

Bug 9 de l'audit d'ergonomie du 27/09/2026 ; décision QG-4 d'Alexis du 27/09 : une intervention
planifiée garde une heure. En vue SEMAINE, une case ne porte pas de minutes
(`cible.minutes === null`) ; `components/planning/pose.tsx` n'envoyait alors NI `heure_debut` NI
`duree_min` au dépôt — la route traitait les deux comme un créneau qu'on RETIRE, et une
intervention planifiée à une heure, déplacée d'un jour à l'autre en vue Semaine, perdait son heure
sans que personne ne l'ait décidé.

Prises par `tests/e2e/captures-pg-a7-semaine-garde-heure.spec.ts` (env `CAPTURES_PG_A7`), sur sa
propre scène (préfixe `PGA7-`) : une intervention 15:30–16:30 un MARDI, affectée à un technicien
de DUCOS, glissée vers le MERCREDI suivant en vue Semaine à 1280 px (la grille glissable n'existe
pas sous `lg` — la capture à 375 px relit l'état déjà produit, dans la liste mobile
`ListeSemaine`, en lecture seule).

- `carte-apres-depot-semaine-avant-*.png` — rejoué sur le code d'AVANT ce ticket (`git worktree`
  sur le commit `91c8a47`, PG-A6-LIBELLE-SANS-DUREE, le dernier avant ce ticket) : la carte du
  mercredi affiche seulement « PGA7 » — l'heure a disparu.
- `carte-apres-depot-semaine-apres-*.png` — après le commit `6c42cf9` (PG-A7-SEMAINE-GARDE-HEURE) :
  la carte affiche toujours « 15:30 PGA7 ».

À 1280 et 375 px.
