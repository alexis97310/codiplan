# 99X-GR8-FILE — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

Sur `/planning`, la carte de la file « À planifier » (bloc `data-maquette-bloc="cartes-dossier-file"`)
ne titre plus la carte par le numéro provisoire (« Local-000001 »), avec le client relégué
en sous-ligne grise à côté du site — audit GR du 26/09, constat G2. La carte titre désormais
par le **client**, sous-titre par la **panne signalée** (à défaut la **nature** de
l'intervention quand la colonne `description` est nulle), et porte le **site** puis le
**numéro provisoire** en petit, texte secondaire, sur une troisième ligne. Rien n'est retiré :
le numéro reste toujours présent, le site aussi.

Pour l'exploitation : un planificateur qui balaie la file du matin voit désormais **chez
qui** intervenir en premier coup d'œil, là où « Local-000001 » ne disait rien avant d'ouvrir
la fiche — c'est exactement le manque relevé par l'audit, et le même choix que 99W-GR7 a déjà
fait la veille pour les cartes de « Priorités opérationnelles » du tableau de bord.

La sous-ligne (panne/nature) est tronquée proprement en CSS (`truncate` + attribut `title`
natif portant le texte entier), même geste que `siteDeLaCarte`/`materielDeLaCarte` déjà
présents dans ce fichier.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

Captures dans `docs/propositions/99X-GR8-FILE/captures/`, prises par un spec e2e temporaire
non conservé (recette de la mémoire `captures-avant-apres-e2e`) : AVANT sur l'état de `main`
avant ce lot (`git checkout <commit précédent> -- <fichiers de code>`), APRÈS sur le commit de
ce lot — à 1280 px et 375 px, sur la scène de démonstration du seed (`pnpm db:seed`), compte
non cloisonné puisqu'aucune donnée n'est créée par la capture (lecture seule).

- **AVANT** (1280 et 375 px) : quatre cartes, toutes titrées « Local-0000NN », client et site
  en sous-ligne grise (« Atelier Ducos · Site Atelier principal »).
- **APRÈS** (1280 et 375 px) : mêmes quatre cartes, même ordre, même pastille de priorité —
  titrées « Atelier Ducos », « Atelier Ducos », « Garage du Nord », « Garage du Nord », chacune
  sous-titrée par sa nature (« Curatif », « Curatif », « Curatif », « Préventif sous contrat »)
  et portant en petit « Site Atelier principal · Local-000001 » (etc.).
- Aucune des quatre lignes de démonstration ne porte de `description` non nulle dans le
  seed : les quatre sous-titres APRÈS retombent donc tous sur la NATURE — le cas « panne
  signalée » est couvert séparément par le test unitaire (`panneOuNatureDeLaCarte`, avec
  « Compresseur arrêté »).
- `verify:full` complet (format, typecheck, lint, test, test:isolation, build, feries:horizon,
  audit:partitions, test:e2e) rejoué APRÈS le commit final : 311 passés, 3 ignorés (préexistants
  hors territoire), 0 échec.

## Ce que j'ai tranché et pourquoi

1. **`panneOuNatureDeLaCarte` (nouvelle fonction, `app/(back-office)/planning/carte.ts`)**
   reprend le même repli que `panneOuNature` (`../tableau-de-bord/presentation.ts`, GR7,
   27/09/2026 — écrit la veille pour exactement le même choix), mais **sans l'importer** :
   les deux modules `presentation.ts`/`carte.ts` restent testables sans dépendance croisée
   entre écrans, même principe que celui qui a fait écrire `panneOuNature` plutôt qu'importer
   `objetDuBloc` (`../interventions/presentation.ts`). Trois lignes identiques valent mieux
   qu'un couplage entre deux écrans distincts pour ce lot.
2. **`min-w-0` ajouté sur `<aside data-maquette-bloc="carte-a-affecter">`** — piège trouvé par
   `verify:full` lui-même : les nouveaux spans `truncate` (CSS `white-space: nowrap` +
   `overflow: hidden`) sont des textes SANS retour à la ligne, et un enfant de grille CSS sans
   `min-w-0` prend pour largeur minimale celle de son contenu le plus long — exactement le
   piège déjà documenté par le commentaire PLANNING-2 pour l'AUTRE colonne de cette même
   grille, jamais appliqué à celle-ci faute d'en avoir eu besoin avant ce lot. Mesuré : 425 px
   de large pour un écran de 390 px avant le correctif, `tests/e2e/planning-largeur-et-carte.spec.ts`
   rouge, vert après.
3. **`lieuDeLaLigne` (fonction privée de `page.tsx`) supprimée** — son seul appelant a été
   remplacé par `ligne.client.raison_sociale` (titre) et `siteDeLaCarte(ligne.site)` (pied de
   carte) ; `grep` confirme qu'aucun autre appelant n'existait.
4. **Site et numéro joints par `t("ponctuation.point_median")`**, jamais un « · » en dur —
   même clé que GR7 a introduite la veille pour le même usage ; `lieuDeLaLigne` écrivait
   encore un « · » littéral avant sa suppression (code antérieur à cette clé), non reproduit.
5. **Aucune clé i18n neuve** : le dictionnaire portait déjà tout ce qu'il fallait
   (`type_intervention.*`, `ponctuation.point_median`, `vocabulaire.site` via `mot()`).

## Ce que je n'ai PAS fait

- **Aucun nouveau spec e2e conservé.** `tests/e2e/planning-largeur-et-carte.spec.ts` couvrait
  déjà le débordement de cette même colonne à quatre largeurs ; un test unitaire
  (`panneOuNatureDeLaCarte`) suffit à couvrir la seule logique neuve (repli panne → nature).
  Le spec de capture est temporaire, jamais commité (conforme à la consigne « e2e seulement si
  nécessaire »).
- **Aucune migration, aucune règle de gestion touchée.** L'ordre de tri de la file (urgence
  puis ancienneté puis id, L3-03) est inchangé ; seul le contenu affiché de chaque carte a
  changé.
- **`/tableau-de-bord` non touché**, bien que `panneOuNature` y existe déjà sous un nom quasi
  identique — hors territoire de ce ticket (`app/(back-office)/planning/` seulement).

## Les pièges pour la session suivante

- **`truncate` dans une grille CSS exige `min-w-0` sur l'ITEM DE GRILLE lui-même**, pas
  seulement sur l'élément tronqué : le span `truncate` peut être profondément imbriqué, la
  classe `min-w-0` doit être posée sur l'ancêtre qui est directement l'enfant de
  `display: grid` (ici `<aside>`), sinon l'automatic minimum size du spec CSS Grid/Flexbox
  fait remonter la largeur intrinsèque du texte non enveloppé jusqu'à la page entière. Ce
  piège a déjà coûté un tour de `verify:full` sur ce lot — le voir une fois suffit, mais il
  n'est écrit qu'ici et dans le commentaire du fichier, pas dans une doctrine générale.
- **Toujours rejouer `pnpm exec playwright test <spec> -g "390px"` isolément** après avoir
  touché la mise en page de `/planning` avant de relancer `verify:full` en entier (onze
  minutes) : la largeur à 390 px est le canari le moins cher.

## Ce qui reste à faire

Rien d'identifié dans le territoire de ce ticket. `priorite_demande_titre` (tableau de bord)
reste sans appelant, hors territoire — voir la passation de 99W-GR7-PRIORITES.
