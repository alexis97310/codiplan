# Passation — 9CF-PG-G11-JOUR-FRISE

Six commits de code, dans cet ordre : `16351ef` (D142, documentaire), `914fb7f`
(géométrie pure), `abf9c7d` (la frise elle-même, pose.tsx, fr.ts, route),
`7af300a` (tests e2e existants adaptés), `e48f1fd` (nouveau spec e2e + un
scope corrigé), `0a136a1` (captures APRÈS + un vrai défaut corrigé). Le
commit 4 (trajet, D107) n'a pas été fait — voir « Ce que je n'ai pas fait ».

## Ce que j'ai changé, et ce que ça change pour l'exploitation

- **La vue Jour du planning est maintenant une frise horizontale** : les
  techniciens en lignes, l'axe des heures en colonnes — plus les techniciens
  en colonnes qu'il fallait faire défiler pour en voir plus de quatre.
  L'exploitation retrouve la disposition du cahier des charges (M4) et de la
  maquette complète (`dayPlan()`, D125), amendée seulement sur ce point par
  D142 (`docs/arbitrages.md`).
- **Chaque intervention se dessine une seule fois**, à l'échelle de sa durée
  (`blocsDeLaLigne`, `lib/interventions/journee.ts`), plutôt que de répéter un
  lien dans chaque créneau de 30 minutes qu'elle couvre. Rien de ce que la
  carte montrait avant n'a disparu (référence, site, matériel, durée, « EN
  RETARD ») ; elle gagne l'en-tête heure+client et la puce de priorité de la
  carte normalisée de la vue Semaine (QG-1/QG-2).
- **Le geste de redimensionnement change de bord** : la poignée était en bas
  du bloc (axe vertical), elle est maintenant à droite (axe horizontal). Le
  calcul de la durée et la case visée n'ont pas changé — seule l'orientation
  visuelle. Le message de refus (`intervention.refus.duree_invalide`) dit
  désormais « à droite / à gauche » plutôt que « sous / au-dessus ».
- **La ligne « Journée — heure non fixée »** n'est plus une ligne du tableau
  des heures (impossible, les techniciens occupant déjà chaque ligne) : c'est
  un bloc séparé, en tête de la frise, qui gagne au passage le lien du tiroir
  qu'il n'avait pas dans la branche « axe vide » (`SansHeureVide`, commun aux
  deux branches désormais).
- **Un défaut réel, trouvé et corrigé en prenant les captures** : un bloc dont
  le contenu dépasse la hauteur de son rang peignait par-dessus la ligne
  technicien voisine. Corrigé par un `overflow-hidden` sur l'enveloppe qui
  positionne chaque bloc (commit `0a136a1`).

## Ce que j'ai mesuré

- `pnpm test` : 3507 tests, 344 fichiers, verts (avant et après chaque
  commit). `pnpm typecheck`, `pnpm lint`, `pnpm format:check` : verts.
  `pnpm test:isolation` : 1296 tests verts.
- e2e, contre une base locale jetable (`E2E_DATABASE_URL`, conteneur
  `codiplan-pg16`, port 5433) :
  - `glisser-deposer.spec.ts` : 8/8 (dont les deux scénarios de
    redimensionnement, adaptés).
  - `blocage-agenda-visible.spec.ts` : 4/4 (comptage d'occupation adapté).
  - `affichage-materiel.spec.ts` : 6/6.
  - `planning-jour-en-tete.spec.ts` : 2/2 ; `planning-5.spec.ts` : le
    scénario concerné, 1/1.
  - `ecrans-largeur-utile.spec.ts` : 7/7 ; `planning-cibles-375.spec.ts` : 2/2.
  - `tous-les-ecrans-rendent.spec.ts` : 38/38 (3 hors périmètre de ce lot).
  - `planning-jour-frise.spec.ts` (nouveau, 0.b) : 4/4.
  - `captures-pgd1-jour-frise.spec.ts` : 2/2 (une capture absente faute de
    donnée cette semaine-là — voir son README).
- Largeur d'une colonne d'heure : 40 px fixes (`<col>`), au-dessus du seuil
  de 32 px cité par l'audit. Hauteur d'une ligne : 64 px au moins (spec
  §3.6), davantage si des interventions se chevauchent (32 px par rang
  supplémentaire).
- **`pnpm verify:full` n'a pas été rejoué en entier avant ce commit** — voir
  « Ce qui reste à faire » : les briques qui le composent (`verify`,
  `test:e2e`) ont chacune été rejouées séparément (`test`, `test:isolation`,
  `lint`, `typecheck`, `format:check`, et les specs e2e listés ci-dessus),
  mais pas dans un seul appel `CI=1 pnpm verify:full`, faute de temps en fin
  de session.

## Ce que j'ai tranché, et pourquoi

- **D142 utilise « Aucune décision antérieure n'est amendée » plutôt que
  `**Décisions amendées :**`** : le gardien `amendements-arbitrages.test.ts`
  n'accepte dans ce champ que des numéros `Dxx` ; R2-14 est un ticket de
  backlog, pas une décision numérotée. Mesuré en le heurtant : corrigé en
  prose plutôt qu'en marque structurée.
- **Discrétisation vs barre continue** : le contenu d'un bloc (référence,
  DetailsDeLaCarte) est rendu dans une enveloppe positionnée en absolu, à
  l'échelle de sa durée réelle (`nombreDeColonnes`), et non recopié dans
  chaque case — c'est la lecture la plus proche à la fois du cahier (une
  frise, pas une grille de cases identiques) et de la spécification §3.6.
- **Koné plutôt que Ducos** pour le nouveau spec e2e (0.b) et les captures :
  mesuré que le technicien Ducos porte déjà, au semis, des interventions de
  08:00 à 13:00 le jour visé (le semis les pose relativement à AUJOURD'HUI,
  comme `reperesDeLaScene` — collision possible n'importe quel jour où les
  deux calculs tombent sur la même semaine). Koné n'a aucune intervention
  datée ce jour-là.
- **`data-fin-heure` plutôt qu'une seconde lecture de la base** pour prouver
  la fin d'un redimensionnement dans les tests e2e : l'attribut porte la fin
  réelle (`BlocDeLigne.finMinutes`, non bornée à l'axe), posé sur l'enveloppe
  qui positionne le bloc — évite une requête Prisma supplémentaire dans
  chaque scénario, et l'écran ET la base sont vérifiés par les mêmes
  scénarios existants (rechargement complet avant la seconde assertion).
- **`finDuBloc` scopée par `id` (`:has()`)** dans les deux fichiers e2e qui
  l'emploient : un sélecteur non scopé résout à plusieurs éléments dès que
  deux blocs commencent à la même heure pour la même personne — trouvé en
  écrivant le nouveau spec, corrigé aussi dans `glisser-deposer.spec.ts` par
  cohérence, sans qu'aucun de ses tests n'en dépendait avant (mesuré : les
  deux passent toujours après correction).
- **Texte de `intervention.refus.duree_invalide`** : « à droite du début du
  bloc, jamais à gauche » — validé par Alexis le 30/09/2026 (cité dans le
  ticket, point 1 de la liste à confirmer).

## Ce que je n'ai PAS fait

- **Le commit 4 (trajet aller/retour, D107)** n'a pas été fait. Le ticket
  autorisait explicitement à le sauter si la mesure ne tenait pas sans
  requête ni route nouvelle — je ne suis pas allé jusqu'à cette mesure, faute
  de temps après les commits 1 à 3 et leur vérification e2e. `trajetDesJournees`
  (`lib/interventions/trajet.ts`) et `occupationsDuPlanning`
  (`lib/interventions/occupation.ts`) n'ont pas été touchés.
- **Les captures AVANT** (avant le premier commit de code, `git worktree` sur
  `6ad8e45a`) n'ont pas été prises — seulement les captures APRÈS. La recette
  est dans `docs/propositions/9CF-PG-G11-JOUR-FRISE/captures/README.md`.
- **La capture du glisser en cours** (bouton de souris enfoncé, case
  survolée) n'a pas été prise, même raison.
- **`pnpm verify:full` en un seul appel** n'a pas été rejoué avant ce commit
  (voir « Ce que j'ai mesuré » et « Ce qui reste à faire »).
- **Les points explicitement hors territoire** du ticket n'ont pas été
  touchés : onglets technicien sous 900 px (PG-D4), « + Créer ici », heure
  pré-remplie dans la fenêtre de pose ouverte depuis la frise, cartes « heure
  non fixée » glissables.

## Les pièges pour la session suivante

- **Le semis pose ses propres démonstrations relativement à AUJOURD'HUI** —
  `reperesDeLaScene()` aussi. Deux lectures indépendantes de « maintenant »
  peuvent tomber sur la même semaine et faire collision sur un technicien
  précis à une heure précise (mesuré : Ducos, 08:00–13:00, le mardi de cette
  session). Avant de poser une intervention par `poserInterventionGlisser`
  sur un technicien/jour/heure précis, vérifier par une requête directe
  (comme celle qui a servi à ce diagnostic) plutôt que de supposer un
  créneau libre — même un créneau qui l'est aujourd'hui peut ne plus l'être
  demain.
- **`finDuBloc` (et tout sélecteur posé sur `[data-depot-heure]` +
  `[data-depot-technicien]` seuls) doit être scopé par `id`** dès qu'un
  scénario peut coexister avec un autre bloc démarrant à la même heure pour
  la même personne — `div:has(> [data-bloc="id"])`, pas
  `caseDHeure(...).locator("[data-fin-heure]")` nu.
- **Le rendu d'un bloc chevauché (rang > 0) reste visuellement serré** : à
  32 px par rang, le contenu complet (en-tête + référence + DetailsDeLaCarte)
  ne tient pas confortablement — `overflow-hidden` empêche qu'il déborde sur
  la ligne voisine (corrigé), mais le texte lui-même peut se couper au milieu
  d'un mot plutôt qu'à une limite propre. Pas mesuré si c'est gênant en usage
  réel ; à observer à l'usage plutôt qu'à deviner une solution ici.
- **`components/planning/pose.tsx` `CasePosable`** porte désormais une prop
  facultative `etat` (`data-etat`) — l'employer plutôt que de recompter par
  la présence d'un lien, dès qu'une épreuve future a besoin de savoir si une
  case de la vue Jour est occupée.

## Ce qui reste à faire

1. **Rejouer `CI=1 pnpm verify:full` en un seul appel**, au premier plan,
   avant tout autre travail sur ce ticket — les briques individuelles sont
   vertes, mais la porte de sortie du lot ne l'a pas été formellement.
2. **Le trajet aller/retour (D107, commit 4)**, si la mesure permet de
   l'ajouter sans requête ni route nouvelle — sinon le dire et fermer le
   ticket sur ce point.
3. **Les captures AVANT et la capture du glisser en cours** (recette dans le
   README des captures).
4. **À confirmer par Alexis** (repris du ticket, toujours ouvert) :
   - les clés i18n du trajet (si le commit 4 est fait) ;
   - le libellé de la ligne sans heure : garder « Journée — heure non
     fixée » (inchangé par ce lot) ou « Heure à fixer » (spécification
     §3.6) ?
   - après un dépôt d'une carte de la file sur la frise, la fenêtre de pose
     reprend le technicien et le jour, jamais l'heure de la case — inchangé
     par ce lot, toujours pas décidé ;
   - les cartes sans heure restent non glissables — inchangé, toujours pas
     décidé ;
   - sous 900 px, la frise défile dans son conteneur en attendant PG-D4.
