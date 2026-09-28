# Captures — PG-B5-ANNULER-DEPLACEMENT

Décision QG-6 d'Alexis du 27/09/2026 : un déplacement DIRECT d'une carte déjà planifiée n'écrit
plus tout de suite. Il attend 10 s, pendant lesquelles « Annuler » revient en arrière sans aucune
requête, pour que le client ne reçoive jamais un second courriel pour un seul geste
(`avertirApresPlanification`, `lib/avertissements/planification.ts`, AVERTISSEMENTS-1).

Prises par `tests/e2e/captures-pg-b5-annuler-deplacement.spec.ts` (env `CAPTURES_PG_B5`), sur sa
propre scène (préfixe `PGB5-`) : une intervention 15:30–16:30 un MARDI, affectée à un technicien de
DUCOS (le créneau que PG-A7 a déjà mesuré libre de tout chevauchement avec les interventions de
démonstration, à la fois le MARDI et le MERCREDI), glissée vers le MERCREDI suivant en vue Semaine
à 1280 px, capturée dès que l'écran se stabilise après le dépôt.

- `case-visee-avant-*.png` — rejoué sur le code d'AVANT ce ticket (`git stash`, le commit `81b2f98`,
  9BJA-REPRISE-9BJ, le dernier avant ce ticket) : le dépôt écrit tout de suite, et la case du
  mercredi affiche déjà la carte « 15:30–16:30 PGB5 » — aucun bandeau n'existe.
- `case-visee-apres-*.png` — après le commit `b212d83` (PG-B5-ANNULER-DEPLACEMENT) : la case du
  mercredi affiche le bandeau « Déplacée — D. Guérin, 30/09/2026 à 15:30 · Annuler » à la place de
  la carte, et la case du mardi (l'ancienne place) ne montre plus la carte PGB5 — elle a été
  écartée pendant que l'écriture est en attente.

À 1280 px : le dépôt lui-même. À 375 px : la grille glissable n'existe pas sous `lg`
(`hidden ... lg:block`), et `ListeSemaine` (la liste mobile) n'utilise pas `BlocPosable` — aucune
case de dépôt, donc aucun bandeau possible à cette largeur. Les deux captures à 375 px sont
visuellement identiques (la carte PGB5 reste sur MAR 29, sa case d'origine, dans les deux) : la
liste mobile relit l'état d'ORIGINE, personne n'a pu y glisser quoi que ce soit, et c'est le
comportement attendu, pas un oubli.
