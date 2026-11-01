# 9I8F-STATUT-MACHINE-MODIFIABLE — passation

*Signalement d'Alexis du 31/10/2026 : « le status de la machine, (en service, en panne...), il
ne change jamais? ». Décide D227 (`docs/arbitrages.md`).*

## Ce que j'ai changé, et ce que ça change pour l'exploitation

- **Une seule écriture** : `changerStatutMachineDans`/`changerStatutMachine` (`lib/machines/depot.ts`)
  — cloisonnée (I1), périmètre par personne (QT-2, D152), tracée (le déclencheur `journal_audit`
  sur `machine` existe déjà depuis L2-01, aucune migration nécessaire). N'écrit jamais `fusionnee`
  — exclue du type `StatutMachineChoisissable` à la compilation.
- **La fiche machine** (`/parc/[id]`) porte un bouton « Changer l'état » : les CINQ valeurs
  choisissables, confirmation sur les deux sorties du parc (« remplacée », « ferraillée »),
  jamais sur les trois autres.
- **Le volet « Nouvelle demande »** et **l'écran « Nouvelle intervention »** portent un champ
  « État de la machine » (trois valeurs : en service, en panne, arrêtée), qui n'apparaît qu'une
  fois la machine désignée, PRÉREMPLI avec son état actuel (`machinesDesSites` rend désormais le
  `statut` de chaque machine), et écrit dans la MÊME transaction que la création
  (`lib/demandes/depot.ts`, `lib/interventions/depot.ts`) — jamais en deux temps.
- **La tuile Machine de la fiche intervention** porte le même bouton (trois valeurs, sans
  confirmation) : changer l'état après coup, sans quitter la fiche.
- **`demande.machine_arretee` reste cohérent** avec l'état choisi au dépôt — dérivé dans la route
  (`app/api/demandes/creer/route.ts`), jamais par `deposerDemande` (qui garde son comportement
  déjà éprouvé : un appelant peut toujours le poser directement, comme avant ce lot et comme
  l'éprouve `tests/isolation/demande.test.ts`).
- **Décision** : `docs/arbitrages.md` porte désormais D227.

## Ce que j'ai mesuré

- `exigerCapacite("gerer_machine")` est déjà accordée à ADMS, DIR, RM, RS, ADV, TEC (sans
  restriction de périmètre sur la capacité elle-même — le périmètre vient du dépôt, QT-2) : même
  garde que `modifierMachine`/`creerMachine`, aucune nouvelle capacité créée.
- `demande.machine_arretee` et `demande.etat_machine` n'étaient JAMAIS exposés dans le volet
  « Nouvelle demande » avant ce lot — `machine_arretee` valait donc toujours `false` par ce
  chemin, un champ mort depuis sa création.
- `lib/machines/depot.ts` importe déjà `lib/interventions/depot.ts` (`STATUTS_INTERVENTION_FERMES`)
  : un import en retour (`interventions/depot.ts` → `machines/depot.ts`) fermerait un cycle. L'état
  de la machine y est donc écrit par un `tx.machine.updateMany` DIRECT, pas par
  `changerStatutMachineDans` — seul `lib/demandes/depot.ts` (aucun cycle) réutilise la fonction
  partagée.
- `CI=1 pnpm format && pnpm typecheck && pnpm lint` verts après chaque point.
- `CI=1 pnpm test` — 491 fichiers / 5387 tests, tous passés (fin de session).
- `CI=1 pnpm test:isolation` — 199 fichiers / 1754 tests, tous passés (fin de session).
- `tests/e2e/9i8f-statut-machine-modifiable.spec.ts` rejoué seul : vert (1.9 min).
- `tests/e2e/captures-9i8f-statut-machine-modifiable.spec.ts` rejoué avec `CAPTURES_9I8F` : vert,
  8 captures produites (`docs/propositions/9I8F-STATUT-MACHINE-MODIFIABLE/captures/`).
- `CI=1 pnpm verify:full` en entier : voir `verify-final.txt`, à la fin de cette session.

## Ce que j'ai tranché, et pourquoi

- **La confirmation ne porte que sur les deux sorties du parc** (fiche machine) — RG-PAR-05 les
  désigne comme un geste qui sort la machine du parc actif ; les trois autres valeurs sont des
  allers-retours ordinaires (une panne réparée redevient « en service »).
- **`changerStatutMachine` accepte les CINQ valeurs quel que soit l'écran appelant** (la route
  `/api/machines/[id]/changer-statut` ne restreint pas par origine) : la tuile de la fiche
  intervention ne PROPOSE que trois boutons côté client, mais le serveur fait confiance à la même
  capacité `gerer_machine` partout, comme `modifierMachine` le fait déjà pour les autres champs
  d'une machine. Aucune des deux sorties du parc n'est atteignable depuis la tuile (l'écran ne les
  propose pas), donc le risque réel est nul ; le resserrer par écran aurait dupliqué une règle que
  la capacité porte déjà.
- **Le retour (`retour`) de la route de changement d'état est fermé à deux préfixes**
  (`/parc/` et `/interventions/`, suivis d'un UUID) — même discipline que
  `app/api/contacts/saisie-recue.ts`.

## Ce que je n'ai PAS fait (hors territoire, D227 le nomme)

- **Le portail client** : une demande déposée par un client (hors de ce lot — aucune route portail
  n'existe pour `/api/demandes/creer`) ne change pas l'état de la machine. Aucun champ ajouté à un
  formulaire client.
- **L'application technicien** : aucune politique RLS n'a été touchée. Si la RLS permettait un
  jour au technicien d'écrire `machine.statut` pour une machine de SON intervention, ce serait une
  question à trancher à part (périmètre, capacité restreinte éventuelle) — proposé en point ouvert,
  jamais décidé ici.
- **Aucune migration** — le déclencheur d'audit sur `machine` existe déjà ; aucune colonne neuve.

## Les pièges pour la session suivante

- `lib/machines/depot.ts` ↔ `lib/interventions/depot.ts` est déjà un cycle à sens unique
  (`machines` importe `interventions` pour `STATUTS_INTERVENTION_FERMES`) — toute fonction future
  que `interventions/depot.ts` voudrait réutiliser depuis `machines/depot.ts` butera sur la même
  contrainte. Le jour où ça devient gênant, casser le cycle (sortir `STATUTS_INTERVENTION_FERMES`
  dans un troisième module neutre) est la vraie réparation — ce lot ne l'a pas fait, hors budget.
- `DonneesMateriel` (`lib/machines/depot.ts`) porte désormais `statut` — `libelleMaterielComplet`
  (`lib/machines/presentation.ts`) a été resserré à un `Pick` des quatre champs qu'elle utilise
  réellement, pour ne pas forcer tous ses appelants de test à fournir un `statut` qu'elle ignore.
- Les identifiants fixes des deux scènes e2e (`9i8f-statut-machine-modifiable.spec.ts`,
  `captures-9i8f-statut-machine-modifiable.spec.ts`) commencent par `918face0-` (hex valide — « i »
  n'est PAS un chiffre hexadécimal, une première tentative avec un préfixe `9i8f…` a fait échouer
  Prisma avec « Error creating UUID »). Garder ce motif pour toute future fixture nommée d'après ce
  ticket.
- `getByText("En panne")` seul, sur la fiche machine, trouve D'ABORD le texte caché de
  `components/navigation/bandeau-mobile.tsx` (même titre + pastille, masqué à ce viewport mais
  présent dans le DOM) avant celui du `<h1>` visible — scoper à `page.locator("h1")` plutôt que
  `.first()` sur ce genre d'assertion, sur cette fiche en particulier.

## Ce qui reste à faire

- Validation d'Alexis sur D227 (condition de réouverture : si la lecture du pilote sur
  « au moment de saisir la demande ou l'intervention » ne correspond pas à ce qu'il attendait,
  ou si la fiche machine n'est pas le bon endroit pour les sorties du parc).
- Point ouvert nommé ci-dessus : l'application technicien, si un jour un besoin de terrain
  l'exige.
