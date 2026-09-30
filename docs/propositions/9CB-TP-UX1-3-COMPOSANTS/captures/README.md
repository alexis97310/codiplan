# 9CB-TP-UX1-3-COMPOSANTS — captures AVANT/APRÈS

- **Commit AVANT** (`avant/`) : `6ad8e45` — HEAD juste avant ce ticket (passation de 9CA-TP-UX1-2-PAGES).
- **Commit APRÈS** (`apres/`) : `7af3c71` — après les trois commits de code de ce ticket (composants de base, tuile cliquable, icônes du menu).
- Même commande (`scripts/captures.mts`), même liste de 35 écrans, mêmes largeurs (1280, 1024, 375 px), deux bases locales jetables distinctes (`codiplan_captures_9cb`, `codiplan_captures_9cb_apres`) — même semis de démonstration (`pnpm db:seed`), aucune donnée réelle (I9). Comme 9BZ et 9CA : le second facteur d'un compte de démonstration activé pendant une prise n'est pas rejouable sans son secret, d'où deux bases plutôt qu'une seule resemée.
- 120 images prises de chaque côté, 18 refusées des deux côtés (mêmes refus, mêmes causes — voir `avant/README.md` et `apres/README.md`) : `arrivee-sans-societe`, `portail`, `intervention-detail`, `client-detail`, `demande-detail`, `intervention-bon` — tous des refus structurels déjà documentés par 9BZ/9CA, sans rapport avec ce ticket.
- États photographiés en plus des écrans, dans `captures/{avant,apres}/etats/`, via `tests/e2e/captures-9cb-menu.spec.ts` (nouveau, lecture seule, `CAPTURES_9CB=…`) :
  - Le tiroir de menu ouvert, à 375 px (AVANT : sans icônes ; APRÈS : avec les icônes du commit « icônes du menu »).
  - La tuile « Dossiers bloqués », au survol et au focus clavier, à 1280 px — capturée seulement APRÈS (le chevron et l'anneau de focus n'existent pas avant ce ticket).

## La mesure, AVANT → APRÈS, par largeur

Somme sur les 35 écrans capturés à chaque largeur (voir le détail écran par écran dans `avant/README.md` et `apres/README.md`, section « Mesure »).

| Largeur | Textes < 12 px (D138) | Cibles sous le seuil | Débordement (somme, px) | Erreurs de console |
| ------- | ---------------------- | --------------------- | ------------------------ | -------------------- |
| 1280 px | 2 → **2**               | 0 → 0                  | 0 → 0                     | 0 → 0                 |
| 1024 px | 2 → **2**               | 0 → 0                  | 74 → 74                   | 0 → 0                 |
| 375 px  | 2 → **2**               | 367 → 367              | 52 → 52                   | 0 → 0                 |

**Aucune colonne ne bouge.** C'est le résultat attendu : ce ticket pose des composants nouveaux (`Icone`, `Priorite`, `BandeDecomptes`, `Onglets`, `Message`), sans appelant dans `app/` — ils ne changent donc aucun écran déjà capturé — et il rend cliquables quatre tuiles existantes sans toucher leur taille de texte, leur mise en page ni leurs cibles tactiles. Les 2 occurrences de « textes < 12 px » qui subsistent aux trois largeurs viennent de `components/planning/pose.tsx`, territoire de 9BW-AVERT-POSE-FICHE, hors de ce ticket (déjà nommées par 9CA).

**Une hypothèse n'est pas une mesure** : ces chiffres sont ceux que `scripts/captures.mts` a écrits dans chaque `README.md`, à la volée, sur une base fraîchement semée — jamais une extrapolation depuis le grep statique du ticket.

## Ce que les captures d'état montrent

- `avant/etats/tiroir-menu-ouvert-375.png` : le tiroir de menu, quatorze/quinze destinations, sans aucune icône.
- `apres/etats/tiroir-menu-ouvert-375.png` : la même colonne, avec une icône devant chaque destination — sauf « Portail client », qui reste sans icône (la maquette du 28/09 ne la dessine pas, :5631).
- `apres/etats/tuile-survol-1280.png` : la tuile « Dossiers bloqués » au survol — le chevron change de couleur (`group-hover:text-app-marque`), le fond de la carte réagit.
- `apres/etats/tuile-focus-1280.png` : la même tuile, atteinte au clavier — l'anneau de focus de 9BZ (3 px, `--ring-focus`) l'entoure.
