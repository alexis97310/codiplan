# 9J08B-PORTAIL-TEMPS-PAR-ETAT — passation

## 1. Mesure (demandée en tête du ticket)

- **Comment le portail lit une demande et une intervention (9J04, 9J07).**
  `app/(portail)/portail/demandes/page.tsx` lit `demandesOuvertes`/
  `demandesTraitees` (`lib/demandes/depot.ts`) sous le contexte
  `{ ...session.contexte, clientId: premier.clientId }` — aucune fiche par
  id, seulement une liste (pas de route `demandes/[id]`).
  `app/(portail)/portail/interventions/[id]/page.tsx` lit
  `ficheInterventionDuParc` (`../depot.ts:…`) par id, sous le même contexte.
  Les deux lisent sous la forme « parc » (D84) : société, `client_id`,
  périmètre de sites — aucune clause WHERE applicative, la RLS décide seule.
- **Sous quelle politique RLS.** `intervention`/`demande` portent la forme
  « parc » (D10/D22, politique `cloisonnement_parc` —
  `prisma/migrations/20260909200000_intervention_l2_planning/migration.sql:115-139`
  et `prisma/migrations/20260913140000_demande_l2_06/migration.sql:146-170`).
  `intervention_statut_historique`/`demande_statut_historique` (posées par
  9J08A) portent la forme « filiation » (D103) : `EXISTS (SELECT 1 FROM
  "intervention"/"demande" … WHERE … = fille."intervention_id"/"demande_id")`
  — aucune clause `client_id` ÉCRITE dans CETTE politique.
- **Un compte portail peut-il lire les lignes d'historique de SES demandes et
  interventions sous la politique posée par 9J08A ?** OUI, sans aucune
  politique neuve ni modifiée. La sous-requête `EXISTS` de la forme
  « filiation » s'exécute SOUS LE MÊME rôle restreint (`codiplan_app`, jamais
  `BYPASSRLS`) que la requête qui l'appelle : elle est donc elle-même
  soumise à la politique « parc » du parent, qui, elle, porte la clause
  `client_id`. L'héritage est automatique — même principe que D92
  (`docs/arbitrages.md:3022`, *« la sous-requête est elle-même soumise aux
  politiques »*). Mesuré par `tests/isolation/9j08b-portail-temps-par-etat.test.ts` :
  un compte portail qui lit l'historique d'une intervention/demande du MÊME
  client mais hors de son périmètre de sites, ou d'un autre client, ou d'une
  autre société, reçoit un tableau vide — jamais une ligne. **Aucune RLS ne
  change dans ce ticket**, conformément à la consigne.

## 2. Lecture portail — `lib/portail/historique-etats.ts`

Deux fonctions dédiées, chacune avec son propre `select` fermé
(`SELECTION_HISTORIQUE_INTERVENTION_CLIENT` : `statut_avant`, `statut_apres`,
`change_le` ; `SELECTION_HISTORIQUE_DEMANDE_CLIENT` : les trois mêmes plus
`demande_id`, nécessaire pour regrouper la lecture en LOT) — jamais
`historiqueStatutDeLIntervention` (`lib/interventions/depot.ts`, back-office),
même discipline que `lib/portail/interventions.ts` (9J05) pour les
commentaires.

- `historiqueInterventionDuClient(contexte, interventionId)` — une
  intervention, à appeler une fois la fiche déjà confirmée visible
  (`ficheInterventionDuParc`).
- `historiquesDemandesDuClient(contexte, demandeIds)` — un LOT, en un seul
  aller (`demande_id IN (...)`), parce que la liste des demandes n'a pas de
  fiche par id : chaque ligne de la liste a besoin de son historique au même
  moment (même idiome que `annuaireDesPersonnes`).

Épreuve qui fige les deux listes de colonnes, dans les deux sens
(`tests/unit/portail/historique-etats-colonnes-fermees.test.ts`) — même
patron que `intervention-colonnes-fermees.test.ts` (9J07).

## 3. Écrans portail

- **Fiche intervention** (`app/(portail)/portail/interventions/[id]/page.tsx`) :
  nouvelle section « Temps par état », après les commentaires. Livre CLI-2.4,
  que 9J07 avait explicitement repoussé (commentaire corrigé dans
  `lib/i18n/fr.ts`, qui l'annonçait encore « jamais »). La page lit en plus
  le fuseau de la société (même requête que `demandes/page.tsx`) et
  `historiqueInterventionDuClient`, puis compose `tempsParEtatDeLIntervention`
  (`../presentation.ts`).
- **Liste des demandes** (`app/(portail)/portail/demandes/vue.tsx`) : chaque
  `<li>` porte désormais sa propre section « Temps par état », sous la
  description — il n'existe aucune page par demande (voir point 1), c'est
  donc la ligne de la liste qui en tient lieu. `demandes/page.tsx` lit
  `historiquesDemandesDuClient` en UN SEUL aller pour toute la liste, compose
  une `Map<id, TempsParEtatPortail>` et la transmet.
- **`tempsParEtatDeLIntervention`/`tempsParEtatDeLaDemande`** (presentation.ts
  de chaque domaine, §6 — jamais importées l'une de l'autre, ni du
  back-office) : même calcul que la tuile du back-office
  (`tempsParEtatAffiche`), réécrit ici, avec les libellés `statut.<valeur>`/
  `demande.statut.<valeur>` DÉJÀ montrés par ces écrans — aucun libellé
  inventé, aucun état interne non montré. Historique incomplet : « Temps par
  état disponible à partir du JJ/MM/AAAA. » (clés `portail.interventions.
  temps_par_etat.*`/`portail.demandes.temps_par_etat.*`, texte identique sous
  deux clés séparées, même convention que le reste du dépôt).

## 4. Épreuves

- **Isolation** — `tests/isolation/9j08b-portail-temps-par-etat.test.ts`,
  sous la vraie base (6 épreuves) : un compte portail lit SON historique
  (intervention et demande), jamais celui d'un autre client de la même
  société ni d'une autre société — y compris dans un lot qui mélange son id
  avec des ids hors périmètre (`historiquesDemandesDuClient`).
- **e2e** — `tests/e2e/captures-9j08b-portail-temps-par-etat.spec.ts` : une
  intervention et une demande dédiées (client et site jetables, jamais le
  client de démonstration partagé), chacune avec DEUX transitions de statut
  RÉELLES (`UPDATE` SQL, le déclencheur pose les lignes — jamais une ligne
  fabriquée à la main). La demande (`nouvelle` → `qualifiee` → `transformee`)
  est celle qui prouve, À L'ÉCRAN, qu'un historique à plusieurs transitions
  affiche plusieurs durées. 4 scénarios (2 écrans × 2 largeurs), tous verts.
  **Piège mesuré et corrigé** : `effacerLaScene` (afterAll) échouait sur une
  contrainte de clé étrangère (`utilisateur_client_client_fkey`) — le compte
  portail invité reste rattaché au client jetable ; il faut effacer la ligne
  `utilisateur_client` avant le client lui-même (l'identité `utilisateur`,
  elle, est réutilisée d'un passage à l'autre, même idiome que 9J04/9J07).

## 5. Captures

`docs/propositions/9J08B-PORTAIL-TEMPS-PAR-ETAT/captures/` — 375 px et
1280 px :

- `fiche-intervention-temps-par-etat-375.png` (31 Ko),
  `fiche-intervention-temps-par-etat-1280.png` (44 Ko)
- `liste-demandes-temps-par-etat-375.png` (32 Ko),
  `liste-demandes-temps-par-etat-1280.png` (45 Ko)

Produites par le spec de capture ci-dessus. Les durées affichées sont
« 0 min » : les transitions de la scène s'enchaînent dans la même seconde
(aucune attente n'est ajoutée) — ce que l'épreuve e2e mesure, c'est la
PRÉSENCE des trois états (dont le courant, marqué « en cours »), jamais une
valeur de durée précise.

## Hors territoire, non fait (par construction du ticket)

Aucune migration, aucune politique RLS (confirmé au point 1 — aucune n'était
nécessaire), `lib/auth/**`, les capacités, le back-office, `CLAUDE.md`.
`demande_statut_historique` avait, depuis 9J08A, « encore aucun lecteur
applicatif » — c'est ce ticket qui le lui donne, côté portail uniquement :
le back-office ne lit toujours que `intervention_statut_historique`.

Pas de page `/portail/demandes/[id]` : elle n'existait pas avant ce ticket
(9J04 ne livre qu'une liste) et ce ticket ne l'ajoute pas — ajouter une route
n'était pas demandé, et la section « Temps par état » trouve sa place dans
la ligne de liste existante, qui est aujourd'hui la seule « page » d'une
demande côté portail.

## `verify` — rejoué à sec avant chaque commit

`format:check`, `typecheck`, `lint`, `test` (505 fichiers), `test:isolation`
(223 fichiers) sont tous passés sans un seul rouge à chaque point. `build`
n'a pas été rejoué séparément ici : `test:e2e` (ciblé sur le spec de ce
ticket) le déclenche lui-même via le `webServer` de Playwright
(`pnpm run build && next start`), et a construit puis servi sans erreur.
`pnpm verify:full` est laissé à la file, conformément à la consigne.

**Pour la session qui reprend ce fil** : `pnpm verify:full` (en particulier
`test:e2e` dans son ensemble, pas seulement ce spec) n'a pas été rejoué en
entier ici — même limite de temps déjà notée par 9J08A et 9J04 (`test:e2e`
seul dépasse 30 min, ~50 min sous `CI=1`).
