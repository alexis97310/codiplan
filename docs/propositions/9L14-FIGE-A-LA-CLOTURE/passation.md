# 9L14-FIGE-A-LA-CLOTURE — passation

Branche `9L14-FIGE-A-LA-CLOTURE`, partant d'`origin/main` (`b356a2f74`). Jamais poussée. Arbre propre, 8 commits.

## MIGRATION À JOUER par Alexis

`20261121010000_fige_a_la_cloture_9l14` — une seule, neuve. Staging puis `DB migrate & seed`, puis Vercel.

Elle pose la table `saisie_apres_cloture` (filiation sur `intervention`), la valeur `saisie_apres_cloture` de l'énumération `EvenementNotification`, et quatre déclencheurs (`intervention_prestation`, `intervention_signature`, `intervention_machine`, `document`) qui refusent toute écriture dès que l'intervention visée est `cloturee`/`annulee` — sauf sous l'exemption nommée `fige_a_la_cloture.exemption` (`SET LOCAL`), posée uniquement par l'import d'archive (`reprise_historique`) et les scénarios d'isolation (`fixture_isolation`). Aucune colonne `NOT NULL` ajoutée sur une table existante : rien à défaut transitoire.

## Ce qui a été livré, point par point

1. **En base** : les quatre déclencheurs ci-dessus. Chacun a son test jumeau dans `tests/isolation/fige-a-la-cloture.test.ts` (épreuve applicative + épreuve « la base mord aussi », `INSERT` brut refusé).
2. **Saisies tardives** : `lib/interventions/saisie-tardive.ts` — `garderSaisieTardive` écrit la ligne `saisie_apres_cloture` et pose la `notification` (capacité `consulter_clients_sites`, l'ADV) dans la MÊME transaction que le refus. Le téléphone affiche « Gardé : l'intervention a été clôturée, le bureau est prévenu. » (`intervention.refus.cloturee_saisie_gardee`, via le mécanisme existant de refus de la file — rien de neuf côté `lib/terrain/`). La fiche bureau porte un nouveau bloc « Saisies arrivées après la clôture » (`components/interventions/saisies-apres-cloture.tsx`), en lecture, sur l'onglet Rapport — vide, il le dit plutôt que de disparaître.
3. **Dès « terminée »** : `peutDeplacer`/`peutAffecter` (`lib/interventions/cycle-de-vie.ts`) refusent aussi ce statut, motif `intervention.refus.terminee_figee` — un refus APPLICATIF, pas une garde de base (la matrice D8 autorisait déjà `TERMINEE → EN_COURS`/`CLOTUREE`, ni l'un ni l'autre ne concernant le créneau ou le technicien).
4. **Réouvrir** : `demarrerLeCompteur` (`lib/interventions/depot-compteur.ts`), en faisant repasser une `terminee` à `en_cours`, efface `rapport_valide_par`/`le` dans la MÊME écriture.
5. `docs/arbitrages.md` (D276), `docs/constitution/invariants.md` (I5) et `CLAUDE.md` portent la précision ; `docs/cahier-des-charges.md` (chapitre 11.2) porte la nouvelle table et les quatre tables désormais figées.

## Un bug réel trouvé et corrigé en cours de route

En câblant le bloc bureau, `annuaire` (page de la fiche) lisait `saisiesApresCloture` AVANT sa déclaration (le `Promise.all` qui le nomme vit plus bas dans la même fonction) — une `ReferenceError` de zone morte temporelle qui **cassait toute la fiche intervention en production**, mesurée via l'épreuve e2e (`fiche-onglets-sur-place.spec.ts` échouait aussi, avant correction). Corrigé par un second annuaire, propre au bloc, construit après que les saisies soient connues — voir le commit `f071d7064`. **Leçon pour la suite : un nouveau bloc sur cette fiche doit être éprouvé par une vraie requête HTTP (e2e ou `pnpm build && next start` + `curl`), jamais par le seul `pnpm build`, qui ne l'aurait pas vu.**

## Épreuves rejouées

- `pnpm test` (unit) : 537 fichiers, 6021 tests, vert.
- `pnpm test:isolation` : 259 fichiers, 2523 tests, vert — rejoué APRÈS la correction du bug ci-dessous, en dernier geste de ce lot.
- `pnpm typecheck`, `pnpm lint` : verts, à chaque commit.
- `pnpm exec playwright test tests/e2e/9l14-fige-a-la-cloture.spec.ts` : 2/2, captures posées (`docs/propositions/9L14-FIGE-A-LA-CLOTURE/captures/`).
- `pnpm exec playwright test tests/e2e/fiche-onglets-sur-place.spec.ts` : 4/4, rejoué sain après correction (témoin de non-régression de la fiche).
- `pnpm verify:full` n'a PAS été rejoué (la consigne le réserve à la file de nuit) — **le prochain `verify:full` de la file est le premier qui couvre ce lot en entier.**

## Ce qui reste ouvert, honnêtement

- Seuls le dépôt de photo (`deposerPhotoIntervention`) et la signature/prestations portent le refus-et-garde applicatif ; **la machine (`intervention_machine`) n'a aucun chemin applicatif qui l'écrit après la création** (mesuré : seules `creerIntervention` et l'import d'archive y écrivent) — le déclencheur de base suffit donc à la couvrir, et c'est ce que `tests/isolation/fige-a-la-cloture.test.ts` éprouve (base seule). Si un futur ticket ouvre un geste « déplacer/rattacher une machine » après coup, il devra rejuger `estFige` avant d'écrire et appeler `garderSaisieTardive`, exactement comme les trois autres.
- Les autres fichiers d'isolation qui fabriquaient une intervention déjà close pour y attacher une machine par un `INSERT` brut (`tests/isolation/9l08f-checklist-dernier-releve.test.ts`, `tests/isolation/parc-perimetre-technicien.test.ts`) ont été adaptés avec l'exemption `fixture_isolation`. **Si un nouveau fichier de test a besoin du même geste, le même patron s'applique** — jamais un `INSERT` brut séparé sur une ligne déjà cloturee/annulee sans cette exemption, et jamais une troisième valeur d'exemption sans un motif écrit (condition de réouverture de D276).

## Reprise 9L14SA — 21/11/2026

9L14S-FIGE-A-LA-CLOTURE (reprise directe de ce lot) a été recalé DEUX FOIS sur la même cause : `pnpm format:check` tombait sur 7 fichiers, avant toute épreuve (`tickets/recales/9L14S-FIGE-A-LA-CLOTURE.md`, traces `traces/9L14S-FIGE-A-LA-CLOTURE-verify-{1,2}.txt` — **ni l'un ni l'autre n'existe plus dans le dépôt ni dans son historique** ; cette reprise travaille donc sur le seul texte du ticket qui les cite, pas sur leur contenu).

**Question posée par le ticket, mesurée en premier, AVANT tout cherry-pick** : la session de 9L14S dit avoir trouvé une `ReferenceError` de zone morte temporelle qui « cassait toute la fiche intervention en production » (section ci-dessus, « Un bug réel trouvé et corrigé en cours de route »). Est-ce un bug déjà présent sur `origin/main`, ou un bug que 9L14 introduisait lui-même ? Mesuré en rejouant `tests/e2e/fiche-onglets-sur-place.spec.ts` sur `origin/main` SEUL, avant tout report de commit : **4/4, vert**. La fiche intervention ne plante pas aujourd'hui, sur `origin/main`. Le bug n'existait que dans le bloc que 9L14 ajoutait lui-même (`saisiesApresCloture` lu avant sa déclaration) — déjà corrigé dans la branche `9L14S-FIGE-A-LA-CLOTURE-garde` reportée ici (commit `f071d7064`, point « épreuve de bout en bout »), donc jamais réintroduit.

**Ce qui a été fait** :

1. Branche `9L14SA-REPRISE-FIGE-A-LA-CLOTURE`, partant d'`origin/main` (`845055bed`, après 9L29). Les 9 commits de `9L14S-FIGE-A-LA-CLOTURE-garde` (`72f0a4ddb^..f19414468`) reportés par `cherry-pick`, SANS LES MODIFIER. Deux conflits, les deux par collision avec du travail publié depuis (9L27, 9L29) sur les mêmes fichiers-registre, rien retiré d'aucun côté :
   - `lib/db/migrations-attendues.ts` : les deux lignes de migration (9L27 et 9L14) côte à côte.
   - `docs/arbitrages.md` : les deux arbitrages (9L27 = D275, 9L14 = D276 — voir point 2) côte à côte.
2. **Migration renommée** : `20261120080000_fige_a_la_cloture_9l14` → `20261121010000_fige_a_la_cloture_9l14` (contenu inchangé, `git mv`) — `origin/main` porte déjà `20261120113000_plancher_facturation_jamais_zero_9l27`, postérieure à l'ancien horodatage. **Arbitrage renuméroté** D275 → **D276** (D275 était pris par 9L27 sur `origin/main`). Toutes les références balayées et corrigées (`grep` sur `D275` et sur l'ancien nom de migration, dans tout le dépôt) : `docs/arbitrages.md`, ce `passation.md` (deux mentions), `lib/interventions/depot-rapport-terrain.ts` (un commentaire). `CLAUDE.md` et `docs/constitution/invariants.md` ne nommaient ni l'un ni l'autre explicitement — rien à corriger là.
3. **Client Prisma régénéré** (`pnpm exec prisma generate`) : le client de ce worktree datait d'avant le cherry-pick et ne connaissait pas `TypeSaisieApresCloture` ni `saisie_apres_cloture` — `pnpm typecheck` rougissait en cascade (y compris une erreur de type sur un littré de gabarit dans `saisies-apres-cloture.tsx` qui n'avait rien à voir avec le vrai problème). Aucune ligne de code changée pour ça : c'était l'étape manquante, pas un bug.
4. **Deux scènes e2e préexistantes, hors du périmètre de 9L14, cassées par le nouveau figement** — trouvées en rejouant les familles `*cloture*`/`*signature*`/`*photo*`/`*prestation*` au complet, pas par une recherche de localisateur (voir point 5) :
   - `tests/e2e/9l04j-prestations-par-materiel.spec.ts` fabriquait une intervention « historique » `cloturee` avec machine et prestation rattachées dans le MÊME `create()` Prisma imbriqué — le déclencheur refusait l'`INSERT` sur `intervention_machine`. Posé sous l'exemption `fixture_isolation`, via `$transaction([SET LOCAL, create])` — même patron que les fichiers d'isolation déjà adaptés par 9L14 lui-même.
   - `tests/e2e/captures-9l28-portail-bon-photos.spec.ts` créait l'intervention déjà `cloturee`, PUIS appelait `deposerPhotoIntervention` — désormais gardée à part (`garderSaisieTardive`) plutôt qu'écrite, donc jamais de `document`, jamais de photo visible au portail. La scène veut une intervention close QUI A une photo, pas une saisie tardive : le document est posé directement par `INSERT` sous la même exemption (dépôt ET teardown), sans passer par la fonction applicative.
   - **Aucune autre scène e2e n'a été trouvée touchée** : les deux ci-dessus sont les deux SEULES qui fabriquaient, par `INSERT`/`create` direct, une intervention déjà `cloturee`/`annulee` avec une ligne fille rattachée au même instant.
5. **Recherche de localisateurs non exacts** touchant l'écran modifié (la fiche intervention, bloc « Saisies arrivées après la clôture ») : `grep` sur `getByText`/`getByRole` dans `tests/e2e/**` pour les nouveaux libellés (`Signature`, `Prestations`, `Photo`, `Machine`, `Gardé : …`, `Saisies arrivées après la clôture`) — **aucune collision trouvée**. Ces mots génériques n'apparaissent dans aucun `getByText`/`getByRole` existant sans `exact: true` sur la fiche ; le bloc étant net-new et vide par défaut (aucun scénario pré-existant n'a de ligne `saisie_apres_cloture`), rien à rendre précis.
6. **Épreuves rejouées, au premier plan, après chaque correctif** :
   - `CI=1 pnpm exec playwright test` sur les 21 fichiers des familles `9l14-fige-a-la-cloture`, `*cloture*`, `*signature*`, `*photo*`, `*prestation*`, `tous-les-ecrans-rendent` (liste complète dans les commits ci-dessous) : **122 passed, 4 skipped**, `--workers=1`.
   - `pnpm test:isolation` : 259 fichiers, 2525 tests, vert.
   - `CI=1 pnpm verify` : vert de bout en bout (`format:check`, `typecheck`, `lint`, `test` — 537/6026 —, `test:isolation` — 259/2525 —, `build`).
7. **Effet de bord constaté et ANNULÉ, pas committé** : plusieurs fichiers `captures-*.spec.ts` d'autres tickets (9EE, 99R, 99T, 9DE, 9H1B, 9K09, 9K28, 9L04E, 9L04H…) écrivent leurs PNG de référence dans `docs/propositions/.../captures/` à chaque exécution, SANS garde par variable d'environnement — contrairement à `captures-9l28-portail-bon-photos.spec.ts` qui, lui, se tait hors `CAPTURES_9L28`. Rejouer les familles du point 6 a donc régénéré ~50 PNG sans rapport avec ce lot (aucun écran n'a été touché ici). Restaurés par `git checkout --` après chaque passage, jamais ajoutés à un commit.
8. **Aucune migration nouvelle** : la seule portée est le renommage du dossier existant (point 2, déjà répercuté dans l'en-tête de ce document). **MIGRATION À JOUER par Alexis** : `20261121010000_fige_a_la_cloture_9l14` — staging puis `DB migrate` (production, `reinitialiser_demo` décoché), puis Vercel.
