# Passation — 9CP-PG-G14B-TRANSMETTRE-GROUPE

## Constat re-mesuré sur `main` au départ

`9CO-PG-G14A-TRANSMETTRE` était bien sur `main` (dernier commit `bf3623f`) : `peutTransmettre`
(`lib/interventions/cycle-de-vie.ts`), `transmettreIntervention` (`lib/interventions/depot.ts`), la
route `POST /api/interventions/[id]/transmettre`, le courriel unitaire au technicien
(`avertirApresPlanification`) et D141 étaient tous en place. Rien de ce qu'il a posé n'a bougé — ce
ticket AJOUTE, il n'a touché ni `peutTransmettre`, ni `transmettreIntervention`, ni la route
`[id]/transmettre`, ni le tiroir, ni `avertirApresPlanification`.

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

- **`lib/interventions/cycle-de-vie.ts`** — `motifsNonTransmissible` : les trois mêmes conditions
  que `peutTransmettre`, mais TOUTES nommées à la fois plutôt que la première rencontrée.
- **`lib/interventions/depot.ts`** — `listerPlanifieesATransmettre` (lecture, triée
  pretes/laissées, filtre société explicite + RLS, `jour` optionnel) et `transmettreEnGroupe`
  (chaque id dans sa propre transaction, un refus au milieu n'annule pas les autres).
- **`lib/avertissements/planification.ts`** — `lignesCommunes`/`libelleCreneau`/
  `creneauLisible`/`natureLisible` exportées (sortie inchangée) ; `groupesParTechnicien` (pure),
  `sujetRecapitulatifTechnicien`/`corpsRecapitulatifTechnicien` (pures) et
  `avertirApresTransmissionGroupee` (impure : relit les lignes transmises, envoie UN courriel par
  technicien).
- **`app/api/interventions/transmettre/route.ts`** (neuf) — `POST`, `modifier_planning`, ids
  cochés ou `toutes=1` résolu côté serveur, redirection 303 vers `/planning` avec le compte-rendu
  en nombres et clés fermées.
- **`components/planning/transmettre-demain.tsx`** (neuf) — le dialogue `<dialog>` natif, aucune
  case cochée d'avance, « Tout cocher » par groupe, laissées nommées avec lien.
- **`app/(back-office)/planning/page.tsx`** — les deux boutons dans la rangée de commandes (jamais
  `actions`), le calcul de « demain » sur une fenêtre calendrier DÉDIÉE [J+1, J+15], le
  compte-rendu et la liste des laissées de « toutes », lus depuis l'URL.
- **`app/(back-office)/planning/presentation.ts`** — toute la composition de texte dynamique
  (labels, confirmation, compte-rendu, motifs) : L0-11 interdit un littéral visible dans un fichier
  qui contient du JSX, donc rien de tout cela n'est composé dans `page.tsx` ni dans
  `transmettre-demain.tsx` eux-mêmes.
- **`lib/i18n/fr.ts`** — clés neuves, toutes sous `planning.transmettre_*` /
  `planning.transmission.*`.
- **`docs/arbitrages.md`** — paragraphe « 14B » sous D141 (aucun numéro neuf).
- **`scripts/lib/chemins-de-depot.ts`** — les deux exemptions posées au premier commit sont
  retirées au troisième : la route leur donne un chemin réel.
- Tests neufs : `tests/unit/interventions/cycle-de-vie.test.ts` (motifs),
  `tests/unit/avertissements/composition.test.ts` (regroupement/tri/corps, purs),
  `tests/isolation/transmission-groupee.test.ts`,
  `tests/isolation/avertissements-transmission-groupee.test.ts`,
  `tests/e2e/pg-g14b-transmettre-groupe.spec.ts`,
  `tests/e2e/captures-9cp-pg-g14b-transmettre-groupe.spec.ts`.
- Pour l'exploitation : un planificateur voit désormais, dans l'en-tête du planning, combien
  d'interventions sont prêtes à transmettre demain et pour toute la société, peut les transmettre en
  un geste groupé, et voit en permanence ce qui est laissé de côté et pourquoi.

## Ce que j'ai mesuré

- **Avant** : aucune lecture « Planifiées prêtes », aucun geste groupé, aucun courriel
  récapitulatif — mesuré par `grep -rn "listerPlanifieesATransmettre\|transmettreEnGroupe"` sur
  `main` avant ce ticket : zéro résultat.
- **Après**, sur une vraie base (`E2E_DATABASE_URL`, migrée + semée), capturé en direct : l'en-tête
  affichait « Transmettre demain (3) » et « Transmettre toutes les planifiées prêtes (26) » avant
  toute action de la scène forgée par le spec de capture ; après avoir transmis UNE intervention de
  cette scène, « Transmettre demain » est passé à (2) et le bandeau a affiché « 1 intervention
  transmise. 1 technicien prévenu par courriel. ». Le bloc « Laissées, à compléter » montrait 4
  lignes réelles de la démonstration (durée/heure/technicien manquants), chacune nommée avec son
  lien.
- Suites, dans l'ordre où elles ont tourné : `pnpm vitest run --project unit` → 357 fichiers / 3673
  tests verts ; `pnpm test:isolation` → 140 fichiers / 1312 tests verts (avant l'ajout des captures,
  revérifié par le `CI=1 pnpm verify:full` final ci-dessous) ; `pnpm typecheck` et `pnpm lint` verts
  à chaque commit ; les deux specs e2e (fonctionnel et captures), 2 puis 8 tests, tous verts contre
  un navigateur réel.
- **Le texte exact du courriel récapitulatif**, à 2 interventions (sujet puis corps) :

  ```
  CODIPLAN — Interventions transmises (2)
  ```

  ```
  2 interventions vous sont affectées :

  Date : 09/10/2026 à 08:00
  Durée prévue : 60 min
  Lieu : Atelier Ducos — Nouméa
  Nature : Curatif
  https://codiplan.example/terrain/<id-1>

  Date : 09/10/2026 à 09:00
  Durée prévue : 60 min
  Lieu : Atelier Ducos — Nouméa
  Nature : Curatif
  https://codiplan.example/terrain/<id-2>
  ```

  (Les lignes « Machine » et « Référence client » n'apparaissent que si l'intervention les porte —
  même discipline que `lignesCommunes`, réutilisée telle quelle.)

## Ce que j'ai tranché et pourquoi

- **Le motif « sans_duree » ne se forge plus frais dans un test** : `intervention_
  planifiee_a_sa_duree` est `NOT VALID` sur l'existant (D104) mais reste vérifiée sur toute ligne
  ÉCRITE — impossible d'insérer une `planifiee` sans durée aujourd'hui. Il reste couvert par un test
  UNITAIRE pur (`motifsNonTransmissible`) ; l'isolation ne couvre que `sans_technicien`/`sans_heure`
  ensemble. Documenté dans le test lui-même.
- **Le compte-rendu après transmission voyage par des NOMBRES et des clés FERMÉES dans l'URL**,
  jamais du texte — même discipline que `clesAvertissementCourriel` (L1-02f, D50), mais plus
  stricte encore : même un nombre forgé ne peut rendre qu'un compte faux, jamais un texte injecté.
- **Simplification assumée, à signaler à Alexis** : le compte-rendu d'échec de courriel groupé est
  un COMPTE agrégé (« N techniciens n'ont pas reçu leur courriel récapitulatif… »), pas un message
  par technicien NOMMÉ comme l'illustrait la note du 02/10 (« Le courriel à X n'a pas pu être
  envoyé »). Nommer chaque technicien en échec aurait exigé de faire voyager ses identifiants par
  l'URL puis de les résoudre à nouveau via l'annuaire — faisable, mais pas fait dans ce lot faute de
  temps ; le compte seul reste correct et sans fuite.
- **« Transmettre toutes » résout SES ids côté serveur** (`toutes=1`, jamais une liste postée par
  le navigateur) : la liste des prêtes peut avoir changé entre le rendu de la page et le clic, et
  seul le serveur doit trancher ce qui est réellement prêt au moment de l'écriture.
- **Les deux formulaires (dialogue et bouton « toutes ») restent des POST natifs**, jamais un appel
  JSON intercepté côté client — plus simple, et cohérent avec le fait qu'aucun des deux ne doit
  rester « sur place » comme le tiroir (ils recomposent de toute façon tout l'en-tête après coup,
  comptes compris).
- **Les calendriers de « demain » sont rechargés sur une fenêtre DÉDIÉE [J+1, J+15]**, jamais la
  fenêtre affichée — c'est le piège explicitement nommé par le ticket (une vue Jour ne couvre qu'un
  jour).

## Ce que je n'ai PAS fait

- Pas de message d'échec de courriel NOMMÉ par technicien (voir ci-dessus — compte agrégé
  seulement).
- Pas de nouveau motif « sans_date » : je me suis appuyé sur l'invariant existant (une `planifiee`
  porte toujours sa date, `statutApresDeplacement` la fait retomber en `a_planifier` sinon) sans
  écrire de test NEUF qui le vérifie spécifiquement pour ce ticket — non vérifié par moi, hérité du
  comportement déjà en place.
- Je n'ai touché à AUCUN écran ni route du terrain (`app/(mobile)/terrain/**`), ni à
  `listerPlanning`, ni à `restrictionParPersonne`, ni à `tests/e2e/setup/**` — hors périmètre,
  réservé à 14C.
- Je n'ai pas construit de bascule pour voir, à l'écran, les laissées de « Transmettre demain »
  AUTREMENT qu'à l'intérieur du dialogue (pas de bloc permanent pour elles, contrairement à celles
  de « toutes ») — le ticket ne le demandait que pour « toutes ».

## Pièges pour la session suivante

- **`app/api/interventions/transmettre/route.ts` (pluriel, sans `[id]`) est un SIBLING** de
  `app/api/interventions/[id]/transmettre/route.ts` — à ne pas confondre au premier coup d'œil,
  les deux coexistent et servent des gestes différents (unitaire vs groupé).
- **Les fixtures globales d'isolation `INTERVENTION_A1`/`INTERVENTION_A2`** (`tests/isolation/
  setup/fixtures.ts` et `global.ts`) sont des `planifiee` DE SOCIETE_A, toujours là, toujours
  comptées par `listerPlanifieesATransmettre(contexte, {})` sans filtre de jour — tout futur test
  qui appelle cette lecture SANS `jour` doit utiliser `toContain`, jamais une égalité stricte (j'ai
  dû corriger cette erreur une fois pendant ce lot).
- **Ne JAMAIS confirmer « Transmettre toutes les planifiées prêtes » dans un test** : ce bouton agit
  sur toute la société, démonstration comprise. Le spec de capture l'ouvre et clique « Revenir »,
  jamais « Transmettre ».
- **Pour 14C** : les points d'accroche terrain restent ceux que 9CO avait déjà nommés — les
  fixtures `planifiee` de `tests/e2e/setup/scene.ts:405` et `tests/isolation/setup/global.ts:655`
  (`INTERVENTION_A1`/`A2`), et tout ce qui lit `statut: "planifiee"` côté `app/(mobile)/terrain/**`.
  Rien de neuf à ce ticket-ci de ce côté.

## Ce qui reste à faire

- **PG-G14C** (dernier du découpage) : retirer la visibilité des `PLANIFIEE` du terrain.
- Envisager, si Alexis le demande, le message d'échec de courriel NOMMÉ par technicien plutôt
  qu'agrégé (voir « Ce que j'ai tranché et pourquoi »).
- Rien d'autre d'identifié dans le périmètre de ce ticket.

## `CI=1 pnpm verify:full`

Vert, en entier, en un seul appel : `format:check`, `typecheck`, `lint`, `test` (357 fichiers /
3673 tests), `test:isolation` (140 fichiers / 1312 tests), `build`, `feries:horizon`,
`audit:partitions`, puis `test:e2e` — 761 tests passés, 7 ignorés (préexistants, sans rapport avec
ce ticket), zéro échec, ~30 minutes. La chaîne est `&&` de bout en bout
(`package.json`) : atteindre le résumé Playwright final prouve que chaque porte précédente a déjà
passé.
