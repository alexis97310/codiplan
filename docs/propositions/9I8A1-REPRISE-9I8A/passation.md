# 9I8A1-REPRISE-9I8A — passation

## Fait, dans l'ordre du brief

**Point 0 — la décomposition est FIGÉE à la clôture (décision A d'Alexis, 31/10/2026).**
Nouvelle colonne `intervention.valorisation_figee` (`JSONB`, nullable) : à la clôture,
`cloturerIntervention` (`lib/interventions/depot.ts`) y enregistre la décomposition complète —
temps réel, temps facturé, plancher appliqué, la règle utilisée (ses trois paramètres), taux,
main-d'œuvre, forfait de déplacement, majoration, total, motif d'un total inconnu —
sérialisée par `versJsonValorisationFigee`/`depuisJsonValorisationFigee`. `lireFicheIntervention`
la relit AU LIEU de recalculer dès que `cloturee_le` n'est pas `null` et que la colonne est
posée. Pour une intervention clôturée AVANT cette migration (`valorisation_figee` encore
`null`), elle recalcule avec `REGLE_HISTORIQUE` (60/15/1) — jamais le réglage courant de la
société — aucune reprise de données. Une intervention PAS ENCORE clôturée continue de calculer
EN DIRECT avec la règle COURANTE de la société.

**Point 2 — la règle, pure et paramétrée** (`lib/tarification/valorisation.ts`). `RegleArrondi
{ plancherMinutes, palierMinutes, seuilPalierMinutes }`. `arrondirSelonRegle` généralise
`arrondirAuQuartDHeureSuperieur` : en dessous du seuil, rien ne se compte ; dès qu'il est
atteint, le palier entier se compte. `REGLE_HISTORIQUE` (60/15/1) redonne EXACTEMENT
`arrondirAuQuartDHeureSuperieur` sur `m` de 0 à 1000 (épreuve dédiée) ; `REGLE_PAR_DEFAUT`
(60/30/5) est la nouvelle règle d'Alexis. `valoriserTempsPasse` prend désormais `regle` en
troisième argument, obligatoire — aucune valeur par défaut devinée. Le tableau d'Alexis est
rejoué intégralement (`it.each`), plus 0/59/61/64/125/300.

**Point 3 — migration** `20261031100000_regle_facturation_temps_9i8a1` (une seule — point 0 et
point 3 y tiennent ensemble) : trois colonnes `societe.facturation_plancher_min/palier_min/
seuil_palier_min` (`INTEGER NOT NULL DEFAULT 60/30/5`, trois `CHECK` bornés — plancher 0-240,
palier 1-120, seuil 1≤seuil≤palier) et `intervention.valorisation_figee` (`JSONB`). Aucune
politique RLS touchée ; `test:isolation` vert (1734 épreuves).

**Point 4 — branchement et libellés.** Les deux libellés qui disaient « au quart d'heure » et
« d'une heure » sont généralisés (`intervention.cloture.arrondi`/`plancher`, `lib/i18n/fr.ts`).
Une phrase composée depuis les trois paramètres RÉELS (`explicationRegle`,
`lib/interventions/presentation-partagee.ts`, partagée avec le composant CLIENT
`dialogue-cloturer.tsx`) remplace l'ancien texte en dur, aussi bien sur la fiche (règle de la
décomposition affichée — figée ou courante) que dans le dialogue « Clôturer » (règle COURANTE
de la société, lue séparément par `lireRegleArrondi` puisque `lireFicheIntervention` ne rend
encore aucune `ValorisationAffichee` avant clôture).

**Point 5 — le réglage**, dans `/parametres/tarifs` (même page que le taux horaire), Carte
« Règle de facturation du temps » : trois champs, un exemple calculé EN DIRECT dans le
navigateur (`FormulaireRegleFacturation`, composant client, réutilise la fonction pure
`arrondirSelonRegle` — jamais une seconde formule). `POST /api/parametres/tarifs/regle-
facturation`, garde `parametrer_societe` (ADMS/DIR seuls), enregistrée dans `PORTE_COMPLETE`/
`ROUTE_CAPACITE` (`tests/unit/auth/porte.test.ts`). Visible même quand l'affichage des montants
est désactivé (ce bloc paramètre un calcul, il n'affiche aucun montant d'intervention).

**Point 6 — registre.** `docs/arbitrages.md` — **D224** (le prochain numéro libre après D223) :
citation verbatim d'Alexis, le tableau qui fait foi, « par société », « non rétroactive »,
amende D83/D89 sans les réécrire.

**Point 7 — captures** (375/1280 px) dans `docs/propositions/9I8A1-REPRISE-9I8A/captures/` :
le réglage avec son exemple en direct, la décomposition d'une intervention clôturée (1 h 05 →
1 h 30, décomposition figée posée directement par SQL — simuler un parcours de clôture complet,
rapport/prestations/signature, était hors territoire), le bon.

## Épreuves ajoutées, au-delà de celles déjà citées plus haut

`tests/isolation/valorisation-intervention.test.ts` — trois scénarios qui ferment le point 0 :
la clôture écrit `valorisation_figee` cohérente ; un changement du plancher de société APRÈS
clôture ne change RIEN à une fiche déjà close (mesuré par contraste : un recalcul en direct
donnerait un résultat différent) ; une intervention insérée DÉJÀ clôturée sans décomposition
figée (ce qu'une ligne d'avant cette migration porte — se simule par une insertion directe,
jamais en figeant puis en effaçant : une intervention close ne se modifie plus, I5/D160) relit
avec la règle HISTORIQUE, jamais le réglage de société.

`tests/isolation/regle-arrondi-societe.test.ts`, `tests/unit/societes/identite.test.ts` —
`lireRegleArrondi`/`enregistrerRegleArrondi` : cloisonnement (I1), refus de rôle, trace d'audit,
sens de défaillance (`REGLE_PAR_DEFAUT` si aucune société active).

`tests/unit/interventions/explication-regle.test.ts` — la phrase dit la règle réelle, jamais
« quart d'heure » quand ce n'est pas la règle, change bien avec les paramètres.

## Pour reprendre / pour déployer

**Une seule migration à jouer**, en production comme sur le site de test :
`20261031100000_regle_facturation_temps_9i8a1` (`pnpm db:deploy`, ou le flux habituel). Elle est
non destructive (trois `ADD COLUMN ... DEFAULT`, une `ADD COLUMN JSONB` nullable, cinq
contraintes) et pose le même défaut (60/30/5) pour TOUTE société existante — c'est la décision
confirmée « par société », le défaut qui l'applique à toutes.

Rien n'est resté à faire des huit points du brief. Hors territoire, non touché : le calcul des
forfaits/mode forfait, le taux horaire, la majoration hors ouverture, `lib/auth/**`,
`app/(back-office)/template.tsx`, `CLAUDE.md`, `depot/`, `11-FILE.sh`.

## `verify:full` — COUPÉ en plein `test:e2e`, comme le lot précédent (9I8)

`CI=1 pnpm verify:full` a été rejoué DEUX FOIS, en un seul appel à chaque fois, au premier
plan. La PREMIÈRE a trouvé un vrai défaut : le gardien L0-11
(`tests/unit/i18n/sans-chaine-visible-en-dur.test.ts`) refusait trois chaînes visibles écrites
en dur dans `tests/e2e/captures-9i8a1-regle-facturation.spec.ts` (`"1 h 05"`/`"1 h 30"` dans des
requêtes d'écran) — corrigé par `enDuree(MINUTES_REELLES)`/`enDuree(MINUTES_FACTUREES)`, commit
séparé.

La SECONDE a été coupée à **1 h en plein `pnpm test:e2e`** (même limite que 9I8, dont la
passation note déjà « coupée à 50 min ») — **`pnpm verify` (format:check, typecheck, lint,
`pnpm test` 5334/5334, `pnpm test:isolation` 1734/1734, `pnpm build`), `pnpm feries:horizon` et
`pnpm audit:partitions` ont TOUS les trois réussi avant que `test:e2e` ne démarre** (la chaîne
`&&` ne les aurait pas atteints sinon). `test:e2e` a ensuite tourné 1801 scénarios, **zéro échec
constaté** dans la trace capturée (`grep -c "✘\|FAIL"` → aucun), encore en cours (environ 38
fichiers de scénarios vus passer) au moment de la coupure.

**Effet de bord connu et nettoyé** (même famille que la passation 9I8) : le `test:e2e` complet
régénère, sur place, les captures PNG d'AUTRES tickets (~300 fichiers vus modifiés, une dizaine
de neuves non suivies) — `git checkout --` restaure les fichiers suivis, les neufs non suivis
sont supprimés. Rien de tout cela n'est commité.

`docs/propositions/9I8A1-REPRISE-9I8A/verify-final.txt` porte la trace entière de ce second
essai, telle que coupée.

## Mesure du budget

T0 = 10:17 (Pacific/Noumea), limite 170 min. Travail sur la branche `9i8a-regle-de-facturation-
du-temps`, qui partait d'`origin/main` (identique à `9i8a-regle-de-facturation-du-temps` au
démarrage — `main` était extrait dans un autre worktree, `/home/aplou/codiplan`). Neuf commits,
un par point (plus un dixième pour des épreuves du point 0 mesurées manquantes en cours de
route). Passation écrite et commitée avant `verify:full`, bien avant la limite.
