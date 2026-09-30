# Captures — PG-D2-DEUX-SEMAINES

Prises par `tests/e2e/captures-pgd2-deux-semaines.spec.ts` (env `CAPTURES_PGD2`), AVANT/APRÈS EN
UN SEUL FICHIER, par détection (même patron que `captures-pg-c5-tiroir.spec.ts`) : le scénario
compte les en-têtes de jour de `/planning?vue=deux_semaines&semaine=...` et nomme sa capture selon
ce qu'il observe — 13 en-têtes (1 technicien + 12 jours) sur le code livré, 7 sur le code d'avant
ce ticket (`vue=deux_semaines` y retombait sur la Semaine, `page.tsx:239` avant PG-D2). Rejoué une
première fois sur le commit `6bd58d7` (le dernier avant ce ticket, AVANT), une seconde fois sur le
code livré (APRÈS), sans `git worktree` : la seule différence entre les deux exécutions est l'état
non commité du dépôt à cet instant.

Scène propre au fichier (préfixe `PGD2CAP-`) : un client, un site, une intervention `planifiee`
posée sur le technicien DUCOS de la scène de démonstration (`reperesDeLaScene`), sur le premier
jour ouvert de la semaine +2 — jamais une donnée de production (I9), tout effacé en fin de
scénario.

- `deux-semaines-avant-*.png` — AVANT : `?vue=deux_semaines` rend la grille Semaine (six jours,
  colonnes à 150 px) — identique, capture pour capture, à `semaine-temoin-*.png`.
- `deux-semaines-apres-*.png` — APRÈS : douze colonnes de jour (deux fois lundi-samedi, sans les
  deux dimanches — décision d'Alexis du 27/09, 12 jours et non 14, spécification §3.7), colonnes à
  118 px, cartes compactes (heure de DÉBUT seule + client, une ligne), quatrième onglet « 2
  semaines » actif, sous-titre « Semaines 41 et 42 — du 05/10 au 17/10/2026 ». À 375 px (sous
  `lg`), c'est `ListeSemaine` (la liste téléphone, inchangée) qui remplace la grille — la carte
  `PGD2CAP-Client` s'y lit sous le jour où elle est posée.
- `semaine-temoin-*.png` — LA VUE SEMAINE, au même lundi, aux deux passes : TÉMOIN que la Semaine
  n'a pas changé d'un pixel (colonnes à 150 px, carte à trois lignes, inchangées).

À 1280, 1024 et 375 px.

## Mesure

`mesure-avant.md` et `mesure-apres.md` — sortie de `mesurer`/`ligneMesureReadme`
(`scripts/lib/mesure-captures.ts`), aux trois largeurs, pour `deux-semaines-*` et
`semaine-temoin` : zéro texte sous 12 px (D138), zéro débordement horizontal, zéro erreur de
console, aux deux passes. Les cibles ne sont pas mesurées ici (seuil de 32/44 px, hors territoire
de ce ticket, mesuré par ailleurs pour la grille Semaine).
