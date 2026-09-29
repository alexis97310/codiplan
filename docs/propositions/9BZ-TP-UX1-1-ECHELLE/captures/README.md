# 9BZ-TP-UX1-1-ECHELLE — captures AVANT/APRÈS

- **Commit AVANT** (`captures/avant/`) : `8fcc37d8454334dbe8ee2e023e039d1a1bd11a97` (`8fcc37d`) — HEAD avant ce ticket.
- **Commit APRÈS** (`captures/apres/`) : `5f284f0` — après les quatre commits de code de ce ticket (UX1-d, jetons/focus/tabular-nums, plancher 12 px, e2e).
- Même commande (`scripts/captures.mts`), même liste d'écrans, mêmes largeurs (1280, 1024, 375 px), même base locale jetable et le même semis de démonstration (`pnpm db:seed`) — aucune donnée réelle (I9).
- 84 images prises, 12 refusées des deux côtés (mêmes refus, mêmes causes : `arrivee-sans-societe`/`portail` demandent des identités hors du périmètre de ce ticket ; `intervention-detail`/`client-detail` dépendent d'un identifiant de démonstration périmé entre deux semis).

## La mesure, AVANT → APRÈS, par largeur

Somme sur les 28 écrans capturés à chaque largeur (voir le détail écran par écran dans `avant/README.md` et `apres/README.md`, section « Mesure »).

| Largeur | Textes < 12 px (D138) | Cibles sous le seuil | Débordement (somme, px) | Erreurs de console |
|---|---|---|---|---|
| 1280 px | 534 → **300** | 0 → 0 | 0 → 0 | 0 → 0 |
| 1024 px | 534 → **300** | 0 → 0 | 74 → 74 | 0 → 0 |
| 375 px | 461 → **307** | 102 → 102 | 52 → 52 | 0 → 0 |

**Ce que ce ticket a corrigé.** Les 13 classes du territoire (`components/ui/`, `components/navigation/barre.tsx`, `components/navigation/marque.tsx`) expliquent la baisse : −234 à 1280 et 1024 px (la colonne de navigation, identique aux deux largeurs de poste de travail), −154 à 375 px (la coque mobile n'emploie pas les mêmes composants de navigation — `marque.tsx` plutôt que `barre.tsx`, moins d'écrans qui montrent un `Tableau` ou une `Pagination`).

**Ce que ce ticket n'a PAS touché, et pourquoi les autres colonnes ne bougent pas.** Les cibles sous le seuil et le débordement mesuré viennent de `app/` (formulaires, tableaux de bord mobiles) — hors territoire, réservé à TP-UX1-2. Les 307 textes restants sous 12 px à 375 px sont eux aussi dans `app/` (174 classes mesurées au 29/09, voir la passation) — la mesure du script confirme le grep statique, sur des écrans réels plutôt que sur un motif de fichier.

**Une hypothèse n'est pas une mesure** : ces chiffres sont ceux que `scripts/captures.mts` a écrits dans chaque `README.md`, à la volée, sur une base fraîchement semée — pas une extrapolation depuis le grep statique du ticket.
