# 9K29-PRESTATIONS-PAR-TYPE-INTERVENTION — passation

Décision verbatim d'Alexis du 11/11/2026 ~08:05, « Prestations proposées selon le type
d'intervention : Oui, par type » (D243) : une prestation du catalogue ne se propose désormais au
technicien, sur le rapport terrain, que pour les types d'intervention qu'elle porte. Origine :
signalement du 02/11/2026 — sur une intervention préventive, le technicien pouvait cocher
« remplacement écrou porteur », une prestation curative.

## CONTRADICTION SIGNALÉE EN COURS DE ROUTE, ET SA RÉSOLUTION — D243 amende D235

Le ticket demandait littéralement `TypeIntervention[]`. **D235** (09/11/2026, 9K08-CHECKLIST-
SCHEMA) avait déjà tranché CONTRE tout tableau d'énumération typé — sans précédent dans ce
dépôt — en remplaçant un brouillon qui en envisageait un (sur `checklist_modele`) par une colonne
nullable scalaire. La contradiction a été signalée avant d'agir (CLAUDE.md, en-tête), et résolue
par une **table de relation**, `prestation_type_intervention`, plutôt que le tableau : une
prestation vise zéro, un ou plusieurs types À LA FOIS sans pouvoir se dédoubler (son `code` est
unique par société, et `intervention_prestation` la désigne par un identifiant unique) — ce que la
colonne nullable de `checklist_modele` ne permet pas. La table de relation reste fidèle au
PRINCIPE de D235 (aucun tableau d'énumération typé n'existe dans ce dépôt) tout en répondant au
besoin réel. Écrit en entier dans **D243** (`docs/arbitrages.md`), qui amende D235 dans ce seul
sens, nommé.

## MIGRATION À JOUER par Alexis : staging puis DB migrate & seed, puis Vercel

`20261111090000_prestations_par_type_intervention_9k29` — une seule table nouvelle,
`prestation_type_intervention` (id, societe_id, prestation_id, type_intervention, cree_le), forme
de politique « filiation » (D103) sur `prestation`, verrou d'écriture du portail (D237, 9K16).
Aucune donnée migrée, aucune ligne existante touchée : une prestation sans ligne dans cette table
reste proposée pour TOUS les types (choix du pilote du 11/11, confirmé par Alexis au compte
rendu).

## Ce que le lot fait

1. **Schéma** : `Prestation.types` (relation vers `PrestationTypeIntervention`). `scripts/lib/
   politiques-rls.ts` — `prestation_type_intervention` rejoint `TABLES_FILIATION`/
   `FILIATION_ARBITREE`. Trois gardiens dérivés mis à jour : `tests/unit/db/inventaire.test.ts`,
   `tests/unit/db/perimetre-audit.test.ts`, `lib/db/migrations-attendues.ts`. `tests/isolation/
   portail-matrice.test.ts` — classée `"societe"` (même largeur de lecture que son parent
   `prestation`).
2. **Règle pure** : `lib/prestations/regle-type.ts`, `prestationsProposees(catalogue, type,
   idsDejaRealises)` — VIDE = tous les types ; une prestation DÉJÀ déclarée réalisée reste
   affichée même si elle ne serait plus proposée. Module SANS Prisma, même motif que
   `TYPES_AVEC_PIECES_REMPLACEES` (`lib/interventions/saisie.ts`) : la coquille hors réseau en a
   besoin côté client.
3. **Dépôt** (`lib/prestations/depot.ts`) : `LignePrestation`/`PrestationCatalogueTerrain` portent
   `types`. Écriture — `creerPrestationDans`/`creerPrestationsEnLot`/`modifierPrestationDans`
   écrivent la table enfant ; la modification REMPLACE L'ENSEMBLE (`ecrireLesTypes`, même
   discipline qu'`intervention_piece_remplacee`). `modifierPrestationDans` gagne un paramètre
   `societeId` (appelants mis à jour : `modifierPrestation`, `lib/imports/annulation.ts`, `lib/
   imports/application.ts`).
4. **Écran de réglage** (`app/(back-office)/parametres/prestations/page.tsx`) : une case par type
   (`TYPES_INTERVENTION`), une colonne « Types d'intervention » dans le tableau et les cartes
   mobiles, un indice sous les cases (« Aucun type coché = proposée pour tous les types »).
   `app/api/parametres/prestations/saisie-recue.ts` lit `formulaire.getAll("types")`.
5. **Import** (`lib/imports/modeles.ts`) : colonne « Types d'intervention », libellés du
   dictionnaire séparés par « ; », vide = tous. `typesDepuisLaCellule` résout chaque libellé par
   `type_intervention.<code>` (le dictionnaire, jamais un code en dur) ; un libellé inconnu refuse
   la ligne ENTIÈRE avec `MOTIF_TYPE_INTERVENTION_INCONNU` (I6) — jamais résolu par
   approximation. `lib/imports/application.ts` — `CHAMPS_PRESTATIONS_ECRITES` gagne `"types"`,
   comparé comme un ENSEMBLE : `lib/imports/comparaison.ts::porteEncore` gagne une **cinquième
   forme** (un tableau de textes), sans quoi chaque réimport d'un catalogue aux types inchangés
   aurait réécrit la table de relation à l'identique — le défaut exact que ce module existe pour
   éviter. `app/(back-office)/imports/types.ts::cleDuMotif` gagne le cas.
6. **Terrain, en ligne et hors réseau** : `app/(mobile)/terrain/[id]/page.tsx` et `components/
   terrain/consultation-hors-reseau.tsx` filtrent par `prestationsProposees(…, ligne.type, …)`
   avant de les passer à `RapportTerrainAutomatique`.

## Trouvaille EN COURS D'ÉPREUVE — un message qui mentait sur la cause

La capture d'écran « après » a montré qu'un catalogue filtré à vide par le type affichait
**« Aucune prestation n'est définie dans le catalogue de votre société »** — un message qui dit
« rien n'est paramétré » quand la vraie réponse est « rien ne s'applique à ce type », qui n'est
PAS une anomalie. `RapportTerrainAutomatique` (`components/terrain/rapport-automatique.tsx`)
distingue désormais TROIS états vides, jamais deux : catalogue indisponible hors réseau (existant),
catalogue réellement vide (existant), et catalogue non vide mais rien proposé pour ce type
(NOUVEAU — `aucunePrestationPourCeType`, nouvelle clé `terrain.prestations.aucune_pour_ce_type`).
Les deux appelants (en ligne, hors réseau) posent ce booléen.

## Le back-office ne propose aujourd'hui aucun sélecteur de prestations (mesuré)

`app/(back-office)/interventions/[id]/page.tsx` n'affiche que la LISTE DES RÉALISÉES, en lecture
(`RealisationRapport`) — aucun chemin n'y propose de cocher une prestation. La règle n'a donc, à
ce jour, aucun second point d'application que le terrain. Écrit dans D243, « CE QUE ÇA NE TOUCHE
PAS ». Condition de réouverture : si un tel sélecteur naît un jour côté back-office, il devra
appeler la même `prestationsProposees`.

## Documentation

`docs/arbitrages.md` — **D243**, amende D235 dans le seul sens nommé. `docs/cahier-des-charges.md`
— **RG-INT-12** (nouvelle), chapitre 11.2 (`prestation_type_intervention`, entrée après
`prestation`). `docs/constitution/organisation-du-code.md` — section `lib/prestations/` complétée
(et son sommaire à lignes réindexé, `tests/unit/docs/constitution-indexee.test.ts`).

## i18n

`prestations.types`, `prestations.types_tous` (table/cartes), `prestations.types_tous_indice`
(sous les cases du formulaire), `imports.motif.type_intervention_inconnu`,
`terrain.prestations.aucune_pour_ce_type`, et quatre clés `terrain9k29.e2e.*` pour la scène de
l'épreuve de bout en bout (jamais de littéral dans un composant, L0-11).

## Épreuves

- **Unitaires** : `tests/unit/prestations/par-type-intervention.test.ts` (schéma — défaut vide,
  doublon refusé, type inconnu refusé ; `prestationsProposees` — vide = tous, filtre par type,
  réalisation jamais masquée ; `typesDepuisLaCellule` et `preparerUnePrestation` — libellés,
  séparateur « ; », libellé inconnu refuse LA LIGNE). `tests/unit/imports/comparaison.test.ts` —
  la cinquième forme de `porteEncore` (ensemble, ordre indifférent, tableaux vides). `tests/unit/
  terrain/rapport-automatique.test.tsx` — les trois états vides, et leur PRIORITÉ (hors réseau
  prime sur les deux autres).
- **Isolation** : `tests/isolation/prestations.test.ts`, bloc « 9K29 » — écriture à la création,
  remplacement à la modification (y compris vers VIDE), lecture par `catalogueActifPourTerrain`,
  et le cloisonnement société B (`lirePrestation`/`modifierPrestation` sous SESSION_B rendent
  `null`/`introuvable`, jamais une fuite de types).
- **Bout en bout** : `tests/e2e/9k29-prestations-par-type-intervention.spec.ts` (375 terrain —
  préventif sans la prestation curative, curatif avec ; 1280 réglage — cocher et enregistrer,
  « tous les types » affiché sans case cochée). **Scène propre** (préfixe `9K29-`), DEUX
  interventions à elle (une curative, une préventive) : jamais `SCENE.rapportTravaillee`, que
  `rapport-terrain.spec.ts` modifie par SQL brut et que `tests/unit/e2e-donnees-partagees.test.ts`
  refuse de voir lu par un AUTRE fichier (trouvaille de ce lot — la première rédaction le lisait,
  le gardien l'a arrêtée net).

## Captures

`docs/propositions/9K29-PRESTATIONS-PAR-TYPE-INTERVENTION/captures/apres/` — réglage (1280 et
375), rapport terrain préventif et curatif (375). Prises par `tests/e2e/captures-9k29-
prestations-par-type-intervention.spec.ts` (même recette que `captures-9ah-gr14-prestations-
sites.spec.ts`), sous `CI=1` (1 worker) pour éviter la collision de semis partagé décrite plus
bas.

**L'« avant » n'a pas été rejoué, faute de temps dans le budget du ticket.** La commande de
reprise : `git worktree add /tmp/codiplan-avant-9k29 70d920bde`, y copier `tests/e2e/captures-
9k29-prestations-par-type-intervention.spec.ts` et les cinq clés `terrain9k29.e2e.*`/
`prestations.types*`/`terrain.prestations.aucune_pour_ce_type` dans son `lib/i18n/fr.ts` (non
commitées, juste pour cette prise), puis `CI=1 CAPTURES_9K29=.../captures/avant pnpm exec
playwright test tests/e2e/captures-9k29-prestations-par-type-intervention.spec.ts` depuis ce
worktree. Le message « rien n'est proposé pour ce type » n'existant pas avant ce lot, la capture
« avant » du rapport terrain préventif montrera l'ancien message générique — c'est attendu, et
c'est précisément ce que la trouvaille ci-dessus corrige.

## Fragilité mesurée, pas une régression de ce lot

Sous `fullyParallel` SANS `CI=1` (donc en LOCAL, plusieurs workers), `ergo14-prestations.spec.ts`
et les deux fichiers de ce lot posent chacun une prestation sur CODIMA-NC pendant que
`rapport-terrain.spec.ts` suppose, pour un de ses scénarios, un catalogue VIDE — fragilité déjà
connue du semis partagé (mesurée au ticket, jamais vue en CI où `playwright.config.ts` pose
`workers: 1`). Vérifié : les 15 épreuves des quatre fichiers passent ensemble sous `CI=1`.

## Ce que ce lot n'a pas touché

Aucune checklist (CK*). Aucun prix, taux ni durée inventés. Aucune prestation créée, modifiée ou
désactivée en production. Le gabarit Excel téléchargeable : mesuré au ticket — aucune bibliothèque
d'écriture `.xlsx` n'existe dans ce dépôt (`read-excel-file` ne LIT que), et les « modèles Excel
réellement téléchargeables » restent un écart nommé de l'audit ergonomie du 28/09/2026 (PA-48),
non construits par un ticket antérieur ni par celui-ci. La seule source de la colonne est déjà
`COLONNES_PRESTATIONS`/`modelePrestations().colonnes` : un générateur futur la reprendra sans
rien à faire de plus ici.

## État du dépôt

`git status --porcelain` vide, sept commits sur ce ticket, tous préfixés `9K29-PRESTATIONS-PAR-
TYPE-INTERVENTION`. Travaillé en HEAD détachée sur ce worktree (pas de branche nommée) : à
rebaser/fusionner sur `main` selon la procédure habituelle d'Alexis. Aucun push.
