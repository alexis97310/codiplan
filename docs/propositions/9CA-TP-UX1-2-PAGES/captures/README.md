# 9CA-TP-UX1-2-PAGES — captures AVANT/APRÈS

- **Commit AVANT** (`captures/avant/`) : `03ca542` — HEAD juste avant ce ticket (passation de 9BZ-TP-UX1-1-ECHELLE).
- **Commit APRÈS** (`captures/apres/`) : `4b28269` — après les cinq commits de code de ce ticket (G1 planning, G2 interventions/demandes/absences/tableau de bord/arrivée/contacts, G3 clients/sites/parc/VGP, G4 paramètres/imports, G5 terrain/portail).
- Même commande (`scripts/captures.mts`), même liste d'écrans (les vingt et un existants, plus les quatorze ajoutés par ce ticket), mêmes largeurs (1280, 1024, 375 px), même base locale jetable et le même semis de démonstration (`pnpm db:seed`) — aucune donnée réelle (I9). Deux bases distinctes, l'une pour AVANT, l'une (resemée) pour APRÈS : le second facteur d'un compte de démonstration n'est pas rejouable sans son secret (piège déjà nommé par 9BZ).
- 120 images prises de chaque côté, 18 refusées des deux côtés (mêmes refus, mêmes causes — voir le détail dans `avant/README.md` et `apres/README.md`) : `arrivee-sans-societe` (le compte MULTI, identique à COURRIEL, porte déjà un second facteur à ce point de la prise) ; `portail` (aucun compte portail ne peut recevoir de mot de passe aujourd'hui, arbitrage antérieur) ; `intervention-detail` et `client-detail` (identifiants de démonstration périmés entre deux semis) ; `demande-detail` (le registre de démonstration ne porte aucune demande) ; `intervention-bon` (aucune intervention du semis n'est dans un statut qui autorise le bon).
- États photographiés en plus des écrans : le tiroir du planning (`captures/{avant,apres}/etats/tiroir-apres-*.png`) et la fenêtre de pose (`captures/{avant,apres}/etats/depot-semaine-*.png`), rejoués sans modification via `tests/e2e/captures-pg-c5-tiroir.spec.ts` (`CAPTURES_PG_C5=…`) et `tests/e2e/captures-pg-b2-fenetre-pose.spec.ts` (`CAPTURES_PG_B2=…`). Ces deux recettes ne rendent que 1280 et 375 px (pas 1024) : c'est la forme des specs elles-mêmes, inchangée par ce ticket. AVANT a été pris sur un `git worktree` posé sur `03ca542`, APRÈS sur `main` — même recette que celle documentée en tête de ces deux fichiers de spec.

## La mesure, AVANT → APRÈS, par largeur

Somme sur les écrans capturés à chaque largeur (voir le détail écran par écran dans `avant/README.md` et `apres/README.md`, section « Mesure »).

| Largeur | Textes < 12 px (D138) | Cibles sous le seuil | Débordement (somme, px) | Erreurs de console |
|---|---|---|---|---|
| 1280 px | 470 → **2** | 0 → 0 | 0 → 0 | 0 → 0 |
| 1024 px | 470 → **2** | 0 → 0 | 74 → 74 | 0 → 0 |
| 375 px | 477 → **2** | 368 → 367 | 52 → 52 | 0 → 0 |

**Ce que ce ticket a corrigé.** Les 197 classes du territoire (40 fichiers, groupes G1 à G5) expliquent la chute de 470/470/477 à 2/2/2 : la quasi-totalité des textes sous 12 px du produit. Les 2 occurrences restantes, à chaque largeur, viennent des écrans `planning` et `planning-jour` (un texte chacun) — `components/planning/pose.tsx` (3 classes) et `components/interventions/trouver-creneau.tsx` (2 classes), territoire de 9BW-AVERT-POSE-FICHE, explicitement HORS de ce ticket (voir passation).

**Ce que ce ticket n'a PAS touché, et pourquoi les autres colonnes ne bougent pas.** Les cibles sous le seuil et le débordement mesuré ne dépendent d'aucune taille de texte : seule la colonne « Textes < 12 px » pouvait bouger. La légère baisse des cibles à 375 px (368 → 367) est un effet de bord positif — une pastille agrandie à 12 px franchit de justesse le seuil de 32×32 px sur un écran — et non une régression : aucune largeur, hauteur, marge ni interligne n'a été changée par ce ticket (seule exception : `leading-[8px]` des libellés de filtre du parc, INCHANGÉ, voir passation).

**Une hypothèse n'est pas une mesure** : ces chiffres sont ceux que `scripts/captures.mts` a écrits dans chaque `README.md`, à la volée, sur une base fraîchement semée — pas une extrapolation depuis le grep statique du ticket.

## Écrans qui portent ENCORE un texte < 12 px après ce ticket

- `planning` (1280, 1024, 375 px) — `components/planning/pose.tsx`, territoire de 9BW-AVERT-POSE-FICHE.
- `planning-jour` (1280, 1024, 375 px) — même cause.

Aucun autre écran de la liste (35 existants + 14 ajoutés par ce ticket) ne porte de texte sous 12 px après ce ticket.
