# 9L14-FIGE-A-LA-CLOTURE — passation

Branche `9L14-FIGE-A-LA-CLOTURE`, partant d'`origin/main` (`b356a2f74`). Jamais poussée. Arbre propre, 8 commits.

## MIGRATION À JOUER par Alexis

`20261120080000_fige_a_la_cloture_9l14` — une seule, neuve. Staging puis `DB migrate & seed`, puis Vercel.

Elle pose la table `saisie_apres_cloture` (filiation sur `intervention`), la valeur `saisie_apres_cloture` de l'énumération `EvenementNotification`, et quatre déclencheurs (`intervention_prestation`, `intervention_signature`, `intervention_machine`, `document`) qui refusent toute écriture dès que l'intervention visée est `cloturee`/`annulee` — sauf sous l'exemption nommée `fige_a_la_cloture.exemption` (`SET LOCAL`), posée uniquement par l'import d'archive (`reprise_historique`) et les scénarios d'isolation (`fixture_isolation`). Aucune colonne `NOT NULL` ajoutée sur une table existante : rien à défaut transitoire.

## Ce qui a été livré, point par point

1. **En base** : les quatre déclencheurs ci-dessus. Chacun a son test jumeau dans `tests/isolation/fige-a-la-cloture.test.ts` (épreuve applicative + épreuve « la base mord aussi », `INSERT` brut refusé).
2. **Saisies tardives** : `lib/interventions/saisie-tardive.ts` — `garderSaisieTardive` écrit la ligne `saisie_apres_cloture` et pose la `notification` (capacité `consulter_clients_sites`, l'ADV) dans la MÊME transaction que le refus. Le téléphone affiche « Gardé : l'intervention a été clôturée, le bureau est prévenu. » (`intervention.refus.cloturee_saisie_gardee`, via le mécanisme existant de refus de la file — rien de neuf côté `lib/terrain/`). La fiche bureau porte un nouveau bloc « Saisies arrivées après la clôture » (`components/interventions/saisies-apres-cloture.tsx`), en lecture, sur l'onglet Rapport — vide, il le dit plutôt que de disparaître.
3. **Dès « terminée »** : `peutDeplacer`/`peutAffecter` (`lib/interventions/cycle-de-vie.ts`) refusent aussi ce statut, motif `intervention.refus.terminee_figee` — un refus APPLICATIF, pas une garde de base (la matrice D8 autorisait déjà `TERMINEE → EN_COURS`/`CLOTUREE`, ni l'un ni l'autre ne concernant le créneau ou le technicien).
4. **Réouvrir** : `demarrerLeCompteur` (`lib/interventions/depot-compteur.ts`), en faisant repasser une `terminee` à `en_cours`, efface `rapport_valide_par`/`le` dans la MÊME écriture.
5. `docs/arbitrages.md` (D275), `docs/constitution/invariants.md` (I5) et `CLAUDE.md` portent la précision ; `docs/cahier-des-charges.md` (chapitre 11.2) porte la nouvelle table et les quatre tables désormais figées.

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
- Les autres fichiers d'isolation qui fabriquaient une intervention déjà close pour y attacher une machine par un `INSERT` brut (`tests/isolation/9l08f-checklist-dernier-releve.test.ts`, `tests/isolation/parc-perimetre-technicien.test.ts`) ont été adaptés avec l'exemption `fixture_isolation`. **Si un nouveau fichier de test a besoin du même geste, le même patron s'applique** — jamais un `INSERT` brut séparé sur une ligne déjà cloturee/annulee sans cette exemption, et jamais une troisième valeur d'exemption sans un motif écrit (condition de réouverture de D275).
