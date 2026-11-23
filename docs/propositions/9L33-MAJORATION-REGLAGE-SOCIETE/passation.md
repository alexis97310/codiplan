# 9L33-MAJORATION-REGLAGE-SOCIETE — passation

Écran de réglage du pourcentage de majoration hors ouverture, par société — complète **D269**
(`docs/arbitrages.md`), dont la condition de réouverture (« le jour où une route de paramétrage
écrit `societe.majoration_hors_ouverture_pct` ») s'est vérifiée aujourd'hui.

**MIGRATION À JOUER par Alexis : `20261123220000_majoration_hors_ouverture_bornes_9l33`.**

Requête de contrôle, à jouer AVANT sur la base réelle (lecture seule, ne modifie rien) :

```sql
SELECT id, code FROM "societe"
WHERE "majoration_hors_ouverture_pct" NOT BETWEEN 0 AND 200;
```

Si elle rend une ligne, corriger la valeur à la main avant de migrer — la contrainte `CHECK`
posée par cette migration refusera sinon de s'appliquer. Puis, dans l'ordre : `DB migrate &
seed` (Neon), puis Vercel.

## Ce qui a été mesuré avant d'écrire

- `societe.majoration_hors_ouverture_pct` (`Decimal(5,2)`) existait déjà, lue par
  `tauxMajorationDepuisPourcentage`/`lireTauxMajorationSociete` (`lib/tarification/majoration.ts`,
  D269) pour le calcul, et par `lireBaremePortail` (`app/api/portail/tarifs/lecture.ts`) pour le
  barème du portail — **aucun écran ne l'écrivait**.
- La page de Paramètres la plus proche était déjà `/parametres/societe` (une seule page, pas de
  nouvelle entrée de menu) : elle porte déjà trois cartes de réglage de société — logo, « Montants
  d'intervention » (`afficher_montants`), « Relances des suites à donner »
  (`delai_relance_suite_jours`) —, toutes réservées à la capacité `parametrer_societe`
  (`admin_societe`/`direction`, aucun rôle ○). La quatrième carte, « Majoration hors ouverture »,
  suit exactement le même patron.

## Ce qui a été posé

1. **La carte.** `app/(back-office)/parametres/societe/page.tsx` — un champ `<input
   type="number" min={0} max={200} step={0.01}>`, aucun montant affiché, seulement le pourcentage ;
   l'aide sous le champ dit que le nouveau réglage ne s'applique qu'aux clôtures SUIVANTES.
2. **La route.** `POST /api/parametres/societe/majoration-hors-ouverture` — même modèle que
   `/api/parametres/societe/delai-relance-suite` : `exigerCapaciteComplete("parametrer_societe")` à
   la porte, `schemaMajorationHorsOuverturePct` (0 à 200, deux décimales au plus, une CHAÎNE —
   jamais un nombre JS flottant) pour la saisie, refus nommé.
3. **Le dépôt.** `lireMajorationHorsOuverturePct`/`enregistrerMajorationHorsOuverturePct`
   (`lib/societes/identite.ts`) — la capacité se revérifie ICI, pas seulement à la porte ; même
   doctrine que les trois cartes voisines.
4. **La contrainte.** `societe_majoration_hors_ouverture_bornee` (`CHECK ... BETWEEN 0 AND 200`),
   migration `20261123220000_majoration_hors_ouverture_bornes_9l33` — EXACTEMENT la borne de
   `schemaMajorationHorsOuverturePct`, les deux se referment l'une sur l'autre.
5. **D269 complétée** (`docs/arbitrages.md`) — une section « COMPLÉTÉE LE 23/11/2026 » ajoutée
   après la condition de réouverture, sans toucher au texte du 10/11/2026 (laissé tel qu'écrit,
   fidèle à son époque).
6. **Feuille de route** (`lib/feuille-de-route/contenu.ts`) :
   - l'entrée « Pourcentage de majoration... (D269) » quitte « Décisions en attente » — livrée,
     elle rejoint « Livré depuis le 31/10 » ;
   - trois décisions du 23/11 (clôture technicien, coût de la garantie, protection GitHub) et M2
     (fiche en quatre étapes) quittent leurs sections d'origine pour une section neuve, « Décisions
     prises », avec un statut neuf `tranche` (badge vert, clé `feuille_de_route.statut.tranche`) —
     distinct de `livre` : une décision tranchée n'est pas forcément du code livré.

## Épreuves

- **Unitaire** (`pnpm test`) : `schemaMajorationHorsOuverturePct` — bornes 0/200, deux décimales au
  plus, espaces tolérés, refus nommés (`tests/unit/tarification/majoration.test.ts`). 6044/6044 au
  vert, suite complète.
- **Isolation** (`tests/isolation/majoration-hors-ouverture-societe.test.ts`) : écriture/lecture,
  cloisonnement I1 (écriture forcée sur une autre société refusée), capacité refusée à un rôle sans
  `parametrer_societe`, trace d'audit I8 avant/après, `CHECK` refuse une valeur hors bornes ou
  négative EN BASE, et son JUMEAU (contrainte retirée → la même valeur passe) — 7/7 au vert.
- **e2e fonctionnel** (`tests/e2e/9l33-majoration-reglage-societe.spec.ts`) : à 1280 et 375 px,
  remplir le champ, soumettre, relire la valeur persistée EN BASE (pas seulement à l'écran) ; une
  saisie hors bornes contournant les attributs HTML est refusée côté serveur, réglage précédent
  intact. 3/3 au vert. La valeur AVANT est relue et restituée dans un `afterAll` (mode série),
  comme `captures-9l12-majoration-pourcentage-societe.spec.ts`.
- **Captures AVANT/APRÈS** (`docs/propositions/9L33-MAJORATION-REGLAGE-SOCIETE/captures/`) :
  `/parametres/societe`, page entière, 1280 et 375 px, avant et après l'ajout de la carte — recette
  `MOMENT_CAPTURE`, même patron que `captures-9l30-feuille-de-route-22-11.spec.ts`.
- **Non re-prouvé en e2e, et c'est voulu** : que le barème du portail et le calcul suivant lisent
  bien `societe.majoration_hors_ouverture_pct` est déjà établi par
  `tests/isolation/9j20-portail-tarifs.test.ts` et `tests/isolation/valorisation-intervention.test.ts`
  (D269, lot 9L12) — ce lot n'ajoute que l'ÉCRITURE de cette même colonne, sous la même politique
  RLS que sa lecture ; reconstituer le parcours d'invitation portail en e2e pour re-prouver la
  lecture aurait dupliqué une preuve déjà faite, hors budget du lot.

## Gardiens mis à jour (découverts en cours de route)

- `tests/unit/i18n/vocabulaire-impose.test.ts` (D5/D47) : le premier texte d'aide écrit disait
  « hors ouverture de l'agence » — refusé, « agence » ne s'écrit jamais en dur dans `fr.ts`.
  Remplacé par « établissement », déjà le mot employé par les motifs existants de
  `lib/tarification/majoration.ts`.
- `tests/unit/auth/porte.test.ts` / `tests/unit/auth/route-capacite.ts` (D153) : la nouvelle route
  ajoutée à `ROUTE_CAPACITE` et `PORTE_COMPLETE`, compteur `118` → `119`.
- `lib/db/migrations-attendues.ts` : la migration ajoutée à la liste attendue.
- `tests/unit/feuille-de-route/contenu.test.ts` : mis à jour pour les cinq éléments restants de la
  section « Application technicien — audit du 10/11/2026 » (M2 en est parti).

## Ce qui reste dû à Alexis

- **`pnpm test:isolation` (et donc `pnpm verify`) rouge sur UN test sans rapport avec ce lot** :
  `tests/isolation/absence.test.ts > ... LEVER LE BLOCAGE NE REND PAS LES CRÉNEAUX`, dépendant de
  la date courante (`VENDREDI_A_VENIR_JOUR`). Reproduit À L'IDENTIQUE sur `origin/main` non modifié
  (`3090a5c30`), vérifié dans un worktree jetable avant d'écrire la moindre ligne de ce lot — donc
  PAS une régression de 9L33. Pas touché, par discipline (CLAUDE.md §5 : jamais assouplir un test
  pour faire passer la vérification) : hors du périmètre de ce ticket, et probablement un effet de
  bord de la date du jour (23/11/2026) sur un calcul de « vendredi à venir ». `format:check`,
  `typecheck`, `lint`, `test`, `build` sont tous au vert ; `test:isolation` l'est aussi hors ce test.
- **`docs/captures/` (le jeu complet de captures régénérées par `scripts/captures.mts`) n'a pas été
  rejoué.** La procédure (`docs/captures/README.md`) demande une base PostgreSQL locale dédiée, un
  build, un serveur, un amorçage de compte — et son dernier commit photographié
  (`6d207f061ad258910f70e8ced9528b033956c49d`, 9L04K) date d'il y a une vingtaine de lots : aucun
  des lots intermédiaires (9L05 à 9L32) ne l'a rejouée non plus. Pour rester dans le budget de 120
  minutes de CE lot, je n'ai pas lancé cette régénération complète — seulement les captures
  AVANT/APRÈS ciblées de l'écran touché, qui sont commitées. À signaler explicitement à Alexis :
  soit la regénération complète redevient une tâche à part (périodique), soit elle doit être exigée
  à chaque lot qui touche un écran capturé — ce lot ne tranche pas la question lui-même.
- Aucune autre migration que celle-ci n'a été touchée ; `depot/` et les scripts de file n'ont pas
  été modifiés ; aucun push.

## Reprise 9L33A-REPRISE-ABSENCE-ISOLATION

9L33 était RECALÉ (`tickets/recales/9L33-MAJORATION-REGLAGE-SOCIETE.md`) sur `pnpm test:isolation`
rouge, deux fois sur la MÊME cause, dans `tests/isolation/absence.test.ts` › RG-PLA-06 ›
« LEVER LE BLOCAGE NE REND PAS LES CRÉNEAUX, et c'est écrit — LA TRACE SURVIT ».

**1. Report.** Branche `9L33A-REPRISE-ABSENCE-ISOLATION` à jour d'`origin/main`
(`c25a14f0d`, 9L32A). Les quatre commits de `9L33-MAJORATION-REGLAGE-SOCIETE-garde` reportés par
cherry-pick, sans modification ; trois auto-fusions (`lib/i18n/fr.ts`,
`tests/unit/auth/porte.test.ts`, `tests/unit/auth/route-capacite.ts`, `docs/arbitrages.md`,
`lib/feuille-de-route/contenu.ts`), aucun conflit réel. Le travail de 9L33 lui-même n'est pas
touché.

**2. Mesure, avant de corriger.** Le test visé ne touche PAS `lib/interventions` ni l'oracle de
calendrier ; 9L33 n'a ajouté qu'une contrainte `CHECK` sur `societe.majoration_hors_ouverture_pct`,
sans rapport. `tests/isolation/absence.test.ts` seul : **vert, 25/25**, trois fois de suite.
`pnpm test:isolation` en série (`--maxWorkers=1`, deux fois) et en parallélisme par défaut (deux
fois) : **vert, 264/264 fichiers, 2551/2551 tests**, à chaque passage — aucune reproduction de la
cause rapportée à 22:42 la veille. Le projet `isolation` de `vitest.config.mts` pose
`fileParallelism: false` : aucune course entre fichiers n'est possible AU SEIN d'une même
exécution de `pnpm test:isolation`, ce qui écarte l'hypothèse d'une collision avec le nouveau
fichier d'isolation ajouté par 9L33 (`majoration-hors-ouverture-societe.test.ts`). Dans ce fichier,
`LUNDI_A_VENIR` (la seule date CALCULÉE — « aujourd'hui + prochain lundi ouvert ») n'est utilisée
qu'à CE seul endroit (ligne 465) ; les douze autres poses du fichier utilisent `LUNDI`, une date
FIXE. Piste retenue, NON prouvée mais la seule qui survive à la mesure : deux processus
`pnpm test:isolation` concurrents (deux worktrees/sessions sur ce poste, cf. mémoire
« Bases de test sur le poste d'Alexis » — la base `codiplan_test` y est partagée) calculent la
MÊME date (l'oracle n'est fonction que du calendrier réel et de « aujourd'hui ») et partagent le
même UUID de fixture `TECHNICIEN` : une collision externe au test sur
`intervention_sans_chevauchement_technicien`, pas une faute de logique du test ni du produit.

**3. Correction appliquée.** La donnée du scénario (créneau, technicien, calendrier) est déjà celle
voulue par 9L31A — rien à y changer sans réintroduire le risque que l'oracle a justement éliminé.
Ce qui manquait réellement : le retour de la pose PRÉALABLE
(`deplacerIntervention(..., deplacement(LUNDI_A_VENIR), ...)`, ligne 463) n'était pas vérifié —
un refus silencieux (qu'il vienne d'une collision externe ou d'une cause future) aurait fait
échouer l'assertion suivante sur `blocage.fiche.deplanifiees` égal à `[]` au lieu de
`[interventionId]`, pointant vers RG-PLA-06 plutôt que vers sa vraie cause. Assertion ajoutée :
`expect(posePrealable.accepte).toBe(true)`. Commit `14cc94b9d`.

**4. Les autres scénarios du fichier qui déplacent sans vérifier le retour** (recherche demandée,
non corrigés — hors de la cause mesurée, et leur date `LUNDI` est fixe donc hors du risque
identifié) :
  - ligne 516 — « REPLANIFIER (AVEC UNE DATE) EFFACE LA TRACE »
  - ligne 548 — « UN DÉPLACEMENT SANS DATE NE TOUCHE PAS LA TRACE »
  - ligne 883 — scénario de la section « l'alerte de rupture de service »

**5. Localisateurs e2e de la même famille.** Recherche dans `tests/e2e/**` des locators non exacts,
non scopés, ou qui comptent des boutons, susceptibles de rencontrer l'écran modifié par 9L33
(`/parametres/societe`) : AUCUN risque trouvé. Trois boutons de cette page partagent le même nom
accessible « Enregistrer » (`societe.montants_enregistrer`, `societe.delai_relance_enregistrer`,
`societe.majoration_enregistrer`) mais aucun e2e existant ne les cible par ce nom — l'e2e de 9L33
lui-même (`tests/e2e/9l33-majoration-reglage-societe.spec.ts`) clique via le sélecteur CSS du
`<form action=".../majoration-hors-ouverture">`, jamais par le texte du bouton. Rien à corriger.

**6. Épreuves rejouées, toutes au premier plan :**
  - `tests/isolation/absence.test.ts` seul : vert (25/25), avec l'assertion ajoutée.
  - `pnpm test:isolation` deux fois : vert (264 fichiers, 2551 tests) à chaque fois.
  - `tests/e2e/9l33-majoration-reglage-societe.spec.ts` +
    `tests/e2e/captures-9l33-majoration-reglage-societe.spec.ts` : vert (5/5).
  - `tests/e2e/tous-les-ecrans-rendent.spec.ts` : vert (61 passés, 4 ignorés — les mêmes `skip`
    nommés et préexistants, sans rapport avec ce lot).
  - `pnpm test` (projet unit) : vert (538 fichiers, 6058 tests).
  - `CI=1 pnpm verify` : vert de bout en bout (chaîné par `&&` — le `build` affiché en sortie
    prouve que `format:check`, `typecheck`, `lint`, `test` et `test:isolation` l'ont précédé avec
    succès).

**Ce qui reste dû à Alexis, en plus de ce que 9L33 devait déjà :** si `test:isolation` redevient
rouge sur ce même test un autre soir, regarder d'abord si une AUTRE session (`ps`, un autre
worktree) faisait tourner `test:isolation` ou `verify` au même instant sur ce poste — la piste
retenue ici n'a pas pu être confirmée positivement, seulement déduite par élimination.
