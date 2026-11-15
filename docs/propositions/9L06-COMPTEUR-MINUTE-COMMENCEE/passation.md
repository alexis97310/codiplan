# 9L06-COMPTEUR-MINUTE-COMMENCEE — passation

Livré PARTIELLEMENT. Voir D256 (`docs/arbitrages.md`) pour la décision et sa condition de réouverture. Un point du ticket (la troncature de `mesurer`/`temps_mesure_min`) est BLOQUÉ par une contrainte de base que ce lot n'a pas mandat de migrer — voir plus bas, « Ce qui n'a PAS été corrigé ».

## Ce qui a été REPRODUIT, et ce qui ne l'a PAS été

Le constat d'Alexis portait sur deux cas : un compteur de moins d'une minute, et un compteur de plus d'une minute, tous deux affichant un temps final à 0.

1. **Le cas « plus d'une minute », comme décrit, NE REPRODUIT PAS** pour un compteur CONTINU (un seul « Démarrer », une seule fermeture) : `tests/e2e/9l06-compteur-minute-commencee.spec.ts`, les deux premiers scénarios, démarrent un compteur et attendent RÉELLEMENT plus de 2 minutes avant de terminer — en ligne, puis hors réseau. Dans les deux cas, le temps persisté (`intervention.temps_mesure_min`) n'est jamais tombé à 0 ; `Math.floor` d'une durée ≥ 60 s ne rend jamais 0, et rien d'autre ne touche cette valeur dans ce chemin.

2. **Un défaut RÉEL et DIFFÉRENT a été trouvé en cherchant (b)**, pendant le second scénario (hors réseau) : la feuille de confirmation de « Terminer » affichait « Temps mesuré : 0 min » — jamais le compteur qui défile — chaque fois qu'une coupure réseau survenait APRÈS un geste compteur réussi EN LIGNE (ex. « Démarrer ») et AVANT toute écriture dans la file locale. Indépendant de la durée écoulée : touchait l'AFFICHAGE uniquement, jamais le temps réellement persisté (vérifié en base après envoi, dans le même scénario). Cause : `RapportTerrainAutomatique` (`components/terrain/rapport-automatique.tsx`) ne relisait les props `segmentOuvertConnu`/`minutesConnues` qu'au montage et sur l'évènement de modification de la file, jamais quand ces props changent par un simple `router.refresh()` — ce qu'un geste compteur réussi EN LIGNE déclenche sans jamais toucher à la file. **Corrigé** : ces deux props sont désormais dans les dépendances de l'effet qui relit la feuille.

3. **Une RÉGRESSION de la même famille, confirmée et corrigée** : `mesureCompteurDeLaFile` (même fichier) arrondissait CHAQUE pause/reprise séparément avant de les additionner — trois cycles démarrer/arrêter de 25 s chacun (75 s au total) mesuraient zéro trois fois, pour un total pourtant supérieur à une minute pleine. **Corrigé** en additionnant les millisecondes de tous les cycles avant une unique conversion en minutes, partagée avec `mesurer` (`minutesDepuisMillisecondes`, `lib/interventions/compteur.ts`). Troisième scénario du fichier e2e, captures AVANT/APRÈS à l'appui (`docs/propositions/9L06-COMPTEUR-MINUTE-COMMENCEE/captures/avant-trois-pauses-courtes-feuille-confirmation-*.png` et `trois-pauses-courtes-feuille-confirmation-*.png`).

## Ce qui n'a PAS été corrigé — ARRÊT sur ce point précis

La partie centrale de la décision d'Alexis — « toute minute commencée compte », 1 s mesurerait 1 minute plutôt que 0 — **ne peut pas être appliquée à `mesurer()` ni à `temps_mesure_min` sans une migration.**

Le déclencheur SQL `intervention_temps_mesure_du_compteur` (`prisma/migrations/20260915060000_les_deux_temps_d120/migration.sql`, posé par D120) REFUSE toute écriture de `temps_mesure_min` qui ne soit pas exactement `floor(somme des secondes des segments fermés / 60)`. Un test d'isolation l'éprouve explicitement (`tests/isolation/temps-mesure-du-compteur.test.ts`, « la somme du déclencheur et celle de `mesurer()` sont la MÊME ») : j'ai changé `mesurer()` pour « toute minute commencée compte » (`Math.ceil`), et ce test a rougi immédiatement — pas une surprise de ma part après coup, c'est exactement ce que le déclencheur est fait pour empêcher. Appliquer la décision d'Alexis à cette colonne exige de changer la fonction SQL pour qu'elle applique la MÊME règle — une migration, explicitement hors mandat de ce ticket (« AUCUNE migration »).

**Ce qui manque pour livrer ce point** : une migration qui remplace, dans `intervention_temps_mesure_du_compteur`, `floor(... / 60)` par le même calcul que `minutesDepuisMillisecondes` appliquerait si la règle changeait (`ceil`, avec le cas `0` qui reste `0`) — et qui met à jour le commentaire de la colonne (`COMMENT ON COLUMN`, actuellement « la somme des segments FERMÉS… » sans mention de troncature, mais le docblock SQL du déclencheur, lui, nomme `floor` explicitement et devra changer). `mesurer()` (`lib/interventions/compteur.ts`) est alors un simple changement d'implémentation de `minutesDepuisMillisecondes` (`Math.floor` → `Math.ceil`), déjà isolé dans une seule fonction partagée par `mesurer` et `mesureCompteurDeLaFile` — le reste du code n'a pas à bouger. Jusque-là, `mesurer()` et le déclencheur restent sur `Math.floor`, volontairement, documenté dans les deux docblocks (`lib/interventions/compteur.ts`, en tête et sur `minutesDepuisMillisecondes`).

## Point 5 du ticket — NON TRANCHÉ, tel que demandé

« Un temps mesuré de 0 doit-il permettre de terminer ? » — le code actuel REFUSE : `peutTerminer`/`peutClore` (`lib/interventions/cycle-de-vie.ts`, lignes ~131 et ~238) refusent `intervention.refus.temps_manquant` dès que `tempsMesureMin === null || tempsMesureMin <= 0`. Ce lot n'y touche pas.

## Captures

`docs/propositions/9L06-COMPTEUR-MINUTE-COMMENCEE/captures/` :
- `en-ligne-plus-de-2min-termine-{375,1280}.png` — EN LIGNE, après un compteur continu de plus de 2 minutes, temps affiché correct.
- `hors-reseau-plus-de-2min-en-attente-375.png` — HORS RÉSEAU, « Terminer » mis en file en attente d'envoi.
- `avant-hors-reseau-plus-de-2min-termine-{375,1280}.png` / `hors-reseau-plus-de-2min-termine-{375,1280}.png` — AVANT/APRÈS la correction du défaut de staleness (point 2 ci-dessus) : AVANT montre « Temps mesuré : 0 min » statique, APRÈS montre la fiche terminée avec un temps non nul.
- `avant-trois-pauses-courtes-feuille-confirmation-{375,1280}.png` / `trois-pauses-courtes-feuille-confirmation-{375,1280}.png` — AVANT/APRÈS la correction de l'arrondi segment par segment (point 3) : AVANT « Temps mesuré : 0 min », APRÈS « Temps mesuré : 1 min ».

Les captures AVANT ont été prises en revenant temporairement à `lib/interventions/compteur.ts`/`components/terrain/rapport-automatique.tsx` d'avant ce lot (`git checkout HEAD~1 --`), jamais en assouplissant un test ni en commitant un état intermédiaire — le dépôt est resté propre (`git status` vide) entre les deux prises.

## Fichiers touchés

`lib/interventions/compteur.ts` (`minutesDepuisMillisecondes`, créé), `components/terrain/rapport-automatique.tsx` (`mesureCompteurDeLaFile`, effet de relecture de la feuille de confirmation), `tests/unit/interventions/compteur.test.ts`, `tests/unit/terrain/rapport-automatique.test.tsx`, `tests/e2e/9l06-compteur-minute-commencee.spec.ts` (créé), `docs/arbitrages.md` (D256).

## Pour la suite

Un ticket SÉPARÉ, avec mandat de migrer, pour : (1) la migration du déclencheur SQL décrite plus haut ; (2) `mesurer()` passé à `Math.ceil` ; (3) la question du point 5, si elle doit être tranchée.
