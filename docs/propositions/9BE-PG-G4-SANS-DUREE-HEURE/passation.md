# 9BE-PG-G4-SANS-DUREE-HEURE — passation

## PARTIE 1/2 — PG-A4-SANS-DUREE-AVANT-ECRITURE : FAITE, commitée (`046211e`)

## PARTIE 2/2 — PG-A3b-HEURE-OBLIGATOIRE : NON COMMENCÉE

Voir « Ce que j'ai tranché et pourquoi » : son préalable écrit dans le ticket
(« Après PG-A3a et PG-A7 ») n'est pas rempli sur `main`, et je me suis arrêté
avant de l'entamer plutôt que d'inventer le travail manquant.

---

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

**Le problème mesuré (bug 4 de l'audit du 27/09) :** la contrainte
`intervention_planifiee_a_sa_duree` (`prisma/migrations/20260923130000_.../migration.sql:132-135`)
est posée `NOT VALID` — PostgreSQL ne l'a pas vérifiée sur les lignes déjà en
base au moment où elle a été créée, mais il la vérifie sur **toute ligne
réécrite ensuite**, même par une colonne sans rapport avec le statut ou la
durée. En production, 5 interventions `planifiee` de la semaine 39 n'ont pas
de durée (posées avant que la contrainte n'existe). Toute écriture ultérieure
sur l'une de ces 5 lignes déclenchait l'exception PostgreSQL 23514, rattrapée
par `avecFilet` en un message générique et irrécupérable (« Une erreur est
survenue... réessayez » — réessayer échouait toujours) ; et pour
`marquerVuParTechnicien` (appelée par l'ouverture même de `/terrain/[id]`),
rien ne rattrapait l'exception : **la fiche terrain du technicien concerné ne
s'ouvrait plus du tout.**

**Le correctif :** `peutEcrireSansDuree(statutApres, dureeApresMin)`
(`lib/interventions/cycle-de-vie.ts`) — une fonction pure qui juge l'ÉTAT
APRÈS L'ÉCRITURE et refuse, nommé, quand ce sera `planifiee`/`affectee` sans
durée. Branchée AVANT l'écriture aux quatre points qui touchent une ligne
`intervention` sans forcément lui redonner de durée :

- `deplacerIntervention` — le statut après déplacement et la durée qui sera
  réellement posée (`saisie.duree_min ?? ligne.duree_estimee_min`, cohérent
  avec l'`undefined` déjà utilisé pour ne pas écraser une durée existante) ;
- `affecterTechnicien` — ni le statut ni la durée ne bougent, jugés tels quels ;
- `enregistrerNoteInterne` — même chose ; son type de retour passe de
  `{ id } | null` à `Resultat<{ id }>` pour porter la clé de refus (avant, un
  refus se confondait avec « intervention introuvable ») ;
- `marquerVuParTechnicien` — **n'écrit pas et NE LÈVE PAS** quand le verdict
  refuserait : le « vu » n'est qu'un repère d'affichage (le badge « Nouveau »),
  jamais une action demandée par le technicien, et l'ouverture de sa fiche ne
  doit pas échouer pour lui. Le « vu » s'écrira à la première écriture qui
  donne une durée à la ligne (typiquement : un déplacement qui la complète).

**Pour l'exploitation :** les 5 interventions concernées redeviennent
manipulables — affecter un technicien, noter une remarque, ouvrir la fiche
terrain fonctionnent à nouveau — SAUF l'action qui laisserait la ligne
`planifiee`/`affectee` sans durée, qui affiche désormais « Cette intervention
planifiée n'a pas de durée prévue : complétez-la — Déplacer, avec heure et
durée. » à la place de l'exception technique. La seule façon de sortir ces 5
lignes de cet état est de les DÉPLACER en leur donnant une heure et une durée
(ou de les retirer du planning, ce qui reste permis).

## Ce que j'ai mesuré (comptes AVANT/APRES)

**Je ne me suis connecté à aucune base de production** (interdit par le
ticket). La requête ci-dessous est à lire par Alexis, en lecture seule, s'il
souhaite confirmer AVANT/APRÈS le nombre exact de lignes concernées :

```sql
SELECT count(*) FROM "intervention"
WHERE "statut" IN ('planifiee', 'affectee')
  AND "duree_estimee_min" IS NULL;
```

**Mesuré ici, en local :** `pnpm test` (3091 tests, dont les 8 nouveaux sur
`peutEcrireSansDuree`) et `pnpm test:isolation` (1261 tests) passent tous les
deux, sans qu'aucune fixture n'ait dû porter une ligne dans cet état — la
constitution le dit dans le ticket : une telle ligne ne peut pas être
INSÉRÉE par le code applicatif (`peutPlanifier` l'empêche depuis
PARCOURS-1), seul un historique antérieur à la contrainte peut la produire,
ce qu'aucun harnais de test ne recrée. Le témoin est donc la fonction pure
seule, testée directement statut par statut (voir
`tests/unit/interventions/cycle-de-vie.test.ts`, describe
« peutEcrireSansDuree »).

## Ce que j'ai tranché et pourquoi

**J'ai changé le type de retour de `enregistrerNoteInterne`**
(`{ id } | null` → `Resultat<{ id }>`), plutôt que de garder `null` pour le
nouveau refus. Un `null` unique aurait rendu « intervention introuvable » et
« ligne sans durée » indiscernables pour l'écran — exactement le défaut que
ce ticket corrige ailleurs (un message générique à la place d'un motif nommé).
Deux appelants seulement à ajuster : la route `note-interne` et un test
d'isolation existant (`tests/isolation/intervention-pause.test.ts`) — les
deux mis à jour dans ce même commit.

**Je me suis arrêté avant PARTIE 2/2 (PG-A3b-HEURE-OBLIGATOIRE).** Son
préambule dit explicitement : *« Depot alexis97310/codiplan, main a jour...
**Apres PG-A3a et PG-A7**. »* J'ai vérifié : ces deux commits
(`54aeab7 PG-A3a-MESSAGES-POSE`, `6c42cf9 PG-A7-SEMAINE-GARDE-HEURE`)
**n'existent PAS sur `main`**. Ils vivent sur une branche locale distincte,
`9BC-PG-G2-POSE-LIBELLES-garde`, dont la base commune avec `main` est
`a246446` (9BB-PG-G1-DOCS-FERIES-ORDRE — passation) — `main` a divergé
ensuite vers PG-A5/PG-A8/9BD (et maintenant PG-A4, ce lot), tandis que cette
branche a suivi PG-A3a/PG-A6/PG-A7 jusqu'à sa propre passation
(`63f8feb 9BC-PG-G2-POSE-LIBELLES — passation`) sans jamais être fusionnée.

Deux raisons de m'arrêter plutôt que de faire PG-A3b quand même :

1. **Le préalable est écrit en toutes lettres dans le ticket** — ce n'est pas
   une supposition de ma part, c'est une condition posée par qui a écrit ce
   ticket. Une règle de la section « regroupement » de ce même ticket
   (point 3) dit d'arrêter plutôt que d'inventer quand un constat est faux
   sur `main`, et exactement ce cas de figure — une partie qui EXIGE l'état
   d'une autre avant de s'exécuter — y est cité comme motif d'arrêt complet
   plutôt que de passer outre.
2. **Le risque n'est pas seulement documentaire.** PG-A7 corrige `pose.tsx`
   pour qu'un glisser-déposer en vue Semaine RENVOIE l'heure et la durée déjà
   posées (sinon il n'envoie ni l'une ni l'autre). Si j'avais posé le futur
   garde-fou serveur de PG-A3b (refuser un déplacement qui viderait
   heure/durée d'une `planifiee` dont la date reste donnée) SANS que PG-A7
   soit sur `main`, tout glisser-déposer d'un jour à l'autre en vue Semaine
   — qui aujourd'hui sur `main` n'envoie toujours pas l'heure — se serait mis
   à être REFUSÉ au lieu de silencieusement perdre l'heure. Un déplacement
   qui fonctionne aujourd'hui (mal, en perdant l'heure) se serait cassé
   (refusé) tant que PG-A7 ne serait pas mergé. C'est précisément l'ordre que
   le ticket protège en écrivant « Après PG-A3a et PG-A7 ».

Je n'ai pas fusionné cette branche moi-même : l'intégration des lots est le
rôle de la file (`11-FILE.sh`), pas d'une session ponctuelle, et une fusion
que je n'ai pas fait relire par elle serait une action que je n'ai pas
autorité à prendre.

## Ce que je n'ai PAS fait

- **PARTIE 2/2 en entier** (PG-A3b-HEURE-OBLIGATOIRE) : aucun code écrit,
  aucun test écrit. Voir ci-dessus pour le pourquoi.
- Aucune migration, aucune ligne de semis (conforme aux interdits).
- Pas de captures pour la PARTIE 1 : elle n'ouvre aucun écran nouveau, et le
  refus nommé qu'elle ajoute ne se photographie pas sur la scène de test — il
  n'existe, par construction, que sur des lignes que le code applicatif ne
  peut plus créer lui-même (voir « Ce que j'ai mesuré »).
- Je n'ai touché à aucun fichier `docs/propositions/*/captures/*.png`
  préexistant marqué modifié dans le statut Git au début de la session — ces
  modifications sont antérieures à mon travail et hors du territoire de ce
  ticket ; je ne les ai ni ajoutées ni commitées.

## Les pièges pour la session suivante

- **`main` n'a pas PG-A3a ni PG-A7.** Avant de reprendre PG-A3b (ou tout
  autre lot PG-A qui suppose A3a/A6/A7 faits), vérifier
  `git log --oneline main` contient bien `54aeab7` et `6c42cf9` — sinon
  fusionner (ou rejouer) `9BC-PG-G2-POSE-LIBELLES-garde` d'abord. Cette
  branche contient aussi PG-A6-LIBELLE-SANS-DUREE, qui n'est donc pas non
  plus sur `main`.
- **`intervention.deplacement.heure`** porte aujourd'hui encore le libellé
  « Heure de début (laisser vide pour une journée sans heure) » — PG-A3b (la
  partie non faite) devait le changer en « Heure de début » et ajouter la
  note « Pour remettre l'intervention dans la file, videz la date, l'heure
  et la durée. » Ne pas confondre avec un défaut de CE ticket : c'est un
  travail non commencé, pas une régression.
- **`peutEcrireSansDuree` ne juge que `planifiee`/`affectee`.** Un futur
  ajout de statut qui porterait aussi l'exigence de durée devra l'y ajouter
  explicitement — la fonction ne généralise pas au-delà des deux statuts que
  porte la contrainte SQL elle-même (`intervention_planifiee_a_sa_duree`).
- Un `git stash` préexistant (`WIP on main: 98ba2fc AGENCE-2...`) était déjà
  présent au début de cette session, sans rapport avec ce ticket — je ne l'ai
  pas touché.

## Ce qui reste à faire

- **PARTIE 2/2 — PG-A3b-HEURE-OBLIGATOIRE**, en entier, une fois PG-A3a et
  PG-A7 confirmés sur `main` :
  - le verdict `cycle-de-vie.ts` (nom à choisir, à côté de `peutPlanifier`) :
    une `planifiee`/`affectee` dont la date reste donnée exige heure ET
    durée, sauf à tout vider (retour à la file) ;
  - le brancher dans `deplacerIntervention` avant l'écriture ;
  - la clé `intervention.refus.heure_obligatoire` (à créer, absente
    aujourd'hui de `fr.ts` sur `main`) ;
  - les libellés des deux blocs « Planifier »/« Déplacer » de la fiche
    (`app/(back-office)/interventions/[id]/page.tsx`) ;
  - `docs/arbitrages.md` — premier numéro libre sur `main` au moment de la
    reprise : **`D135`** au moment de cette passation (dernier constaté :
    D134, « UNE AGENCE INACTIVE SORT DES CHOIX, PAS DE L'HISTOIRE ») — à
    revérifier, un autre lot a pu en ajouter d'ici la reprise ;
  - les tests (unitaire + e2e « Deplacer », scène préfixée `PGA3B-`) ;
  - les captures avant/après des deux blocs, 1280 et 375 px.
- Lire la requête SQL de comptage ci-dessus en production, si Alexis le
  souhaite, pour confirmer que les 5 lignes signalées le 27/09 sont bien
  celles que ce correctif protège.
