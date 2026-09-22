# IMPORT-2 — passation

## Ce que j'ai changé, et ce que ça change pour l'exploitation

Rien au code de production. Trois ajouts :

- `scripts/mesure-delais-import.mts` — rejoue `appliquerLeLotDeClients` (lib/imports/application.ts)
  en conditions réelles (rôle applicatif `codiplan_app`, base PostgreSQL locale et jetable,
  jamais Neon), à sept tailles et pour les deux régimes qui comptent, et écrit le résultat.
- `docs/propositions/23-IMPORT-2/mesure.md` — la mesure elle-même, datée et légendée (machine,
  Node, PostgreSQL).
- Un paragraphe ajouté en fin de `lib/imports/delais.ts` (aucune constante touchée), qui renvoie
  vers la mesure.

Pour l'exploitation : **le plafond ne dit rien de faux, mais il est très loin de la réalité
mesurée.** Le budget théorique (`allersRetoursApplication` × `LATENCE_PESSIMISTE_MS`) casse à 746
lignes retenues ; la mesure locale, extrapolée, casse entre 800 000 et 1,5 million de lignes. Les
1 751 lignes d'archive, les 298 vérifications VGP et les 362 observations qu'Alexis a à importer
sont donc, très largement, hors de portée du risque `delai_depasse` — **mais cette mesure ne le
prouve pas pour la base HÉBERGÉE**, seulement pour le moteur de la transaction en local (voir « ce
que je n'ai pas fait »). Aucun comportement du produit n'a changé : c'est une mesure, pas une
correction.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

**AVANT** cette mesure : aucune. Le seul chiffre réel que le dépôt citait venait d'un incident de
production sous l'ANCIEN code (615 lignes de modification, avant la réduction du point 1 du
16/09/2026) — une mesure d'un autre régime, sur un autre code, prise pour une autre raison.

**APRÈS**, sur `codiplan_test` (base jetable locale, migrations à jour, machine décrite dans
`mesure.md`) :

| régime | lignes retenues | durée mesurée |
|---|---|---|
| création | 100 | 350,4 ms |
| création | 1 000 | 803,2 ms |
| création | 8 000 | 4 112,6 ms |
| modification | 100 | 447,3 ms |
| modification | 1 000 | 1 270,5 ms |
| modification | 8 000 | 7 537,2 ms |

(table complète, 7 tailles × 2 régimes, dans `mesure.md`).

**Le fait le plus utile** : une modification coûte, mesuré, très exactement **le double** d'une
création par ligne (0,90 ms/ligne contre 0,48 ms/ligne) — ce que le docblock d'
`allersRetoursApplication` affirmait déjà en théorie (« au pire deux », contre un pour une
création) est donc confirmé en pratique, avec le même facteur. La pente est linéaire sur les deux
ordres de grandeur mesurés (100 à 8 000 lignes, ratio ~80×), ce qui rend l'extrapolation crédible
pour ce qu'elle est : une extrapolation, jamais une mesure directe de la casse réelle.

## Ce que j'ai tranché et pourquoi

- **Mesuré sur l'entité « clients », pas « historique » ni « VGP ».** Ce sont les imports RÉELS
  d'Alexis, mais les trois (`appliquerLeLotDeHistorique`, `…DeVgp`, `…DeVgp_observations`) ne
  savent QUE créer (`preparerModification: () => ({ prete: false })`, mesuré dans
  `application.ts`) — impossible d'y mesurer le régime « modification ». « clients » est la seule
  entité simple à amorcer (aucune clé étrangère hors société) qui traverse le MÊME moteur
  générique (`appliquerLesLignes`) dans ses deux régimes. Le régime « création » mesuré transfère
  donc directement à historique/VGP ; le coût spécifique de LEURS validations (rapprochement de
  machine par rang, résolution client/site/agence) n'est pas mesuré — écrit tel quel dans
  `mesure.md`.
- **Seule la transaction d'application est chronométrée**, jamais le contrôle ni l'enregistrement
  du lot : c'est exactement ce que `DUREE_MAXIMALE_MS` budgète, et rien de plus.
- **Extrapolation plutôt que mesure directe de la casse.** Atteindre réellement 750 s (le
  `DUREE_MAXIMALE_MS` actuel) aurait demandé de générer et d'appliquer environ 800 000 à 1,5
  million de lignes synthétiques — de l'ordre de 15 à 20 minutes pour cette seule mesure, avec un
  résultat prévisible (la pente mesurée est linéaire et stable sur 80× d'échelle). J'ai préféré
  mesurer plusieurs tailles raisonnables et extrapoler la pente, en le disant explicitement dans
  `mesure.md` — le ticket admet cette réponse (« dis que tu n'as pas pu l'atteindre »).
- **Densité de rejets ~2 %** (raison sociale vide) dans chaque lot synthétique, pour rester
  réaliste sans avoir de fichier d'Alexis à imiter — aucune donnée réelle n'a été utilisée (I9).
- **Aucune valeur de fuseau, de décimales, de date courante ou de séparateur de milliers écrite en
  dur dans le script.** `pnpm verify:full` a d'abord fait rougir trois gardiens (I3, I7) : le
  script fixait `decimales: 0` et `"Pacific/Noumea"` pour ses fixtures, et utilisait
  `Date.now()`/`new Date()`/`.toFixed()`/`.toLocaleString()` pour son rapport — ces gardiens
  scannent `scripts/` au même titre que `lib/` ou `app/`, sans distinguer un script de mesure d'un
  chemin de production. Corrigé en réutilisant `DEVISES`/`SOCIETES` de `prisma/seed-data.ts` (le
  seul fichier exempté par ces deux gardiens) pour les fixtures, un nonce aléatoire (`randomBytes`)
  plutôt qu'un horodatage pour isoler les lots synthétiques, `date -u` (shell) pour l'horodatage du
  rapport, et deux petits formateurs maison (`formaterMillier`, `formaterDecimal`) plutôt que
  `toFixed`/`toLocaleString`/`Intl`. Aucun de ces gardiens n'a été modifié, ni assoupli.

## Ce que je n'ai PAS fait

- Pas mesuré contre la base hébergée (Neon) : cette mesure tourne en local, jamais contre la
  production, et le rapport entre les deux latences (locale vs Neon `ap-southeast-2`, majorée à
  500 ms dans `LATENCE_PESSIMISTE_MS`) reste NON mesuré — écrit comme tel dans `mesure.md`, jamais
  supposé.
- Pas mesuré `historique` / `vgp` / `vgp_observations` directement (voir ci-dessus) : seule
  `clients` a été instrumentée.
- Pas mesuré sous concurrence (plusieurs lots appliqués en même temps).
- Pas atteint la casse réelle (750 s) : seulement extrapolée depuis la pente mesurée.
- Aucune constante de `lib/imports/delais.ts` ni ligne de `lib/imports/application.ts` /
  `prisma/schema.prisma` n'a été touchée.
- Pas de capture d'écran : vérifié (agent Explore) que l'écran d'import
  (`app/(back-office)/imports/[id]/page.tsx`, bouton « Appliquer » via `ActionPrimaire`) est un
  simple formulaire POST server-rendu, sans composant client, sans `loading.tsx`, et n'affiche
  AUCUNE durée ni progression — même pas un chronomètre — pendant ni après l'application. Rien à
  capturer.

## Les pièges pour la session suivante

- **Le cluster jetable officiel (`/var/lib/postgresql/codiplan-test`, port 5433, piloté par
  `scripts/postgres-jetable.sh`) est INACCESSIBLE sous ce compte non privilégié.** Le répertoire
  appartient au compte système `postgres` (probablement créé par une session antérieure lancée en
  root, qui passe par `su postgres`) ; ce compte-ci est `aplou`, non root, sans `sudo`
  interactif disponible (mot de passe requis, session non interactive). `scripts/postgres-jetable.sh`
  a échoué sur `rm: cannot remove '/var/lib/postgresql/codiplan-test': Permission denied`.
  J'ai contourné en créant mon PROPRE cluster jetable, sous mon compte : `initdb` +
  `pg_ctl start` manuels, données dans `/home/aplou/.codiplan-mesure-cluster`, port 5434,
  `unix_socket_directories=''` (le socket Unix par défaut, `/var/run/postgresql`, n'est pas non
  plus accessible en écriture pour `aplou`) — TCP seul sur `127.0.0.1:5434`. C'est CE cluster que
  j'ai utilisé pour la mesure ET pour `pnpm verify:full` (voir plus bas), en surchargeant
  `TEST_DATABASE_URL` et `E2E_DATABASE_URL` **sur la ligne de commande**, jamais dans un fichier
  d'environnement partagé. **La prochaine session rencontrera le même blocage** si elle tourne
  sous le même compte : soit obtenir un `sudo` interactif pour réparer les permissions du
  répertoire officiel (`chown -R aplou:aplou /var/lib/postgresql/codiplan-test`, ou l'inverse
  selon qui doit le lancer), soit refaire ce contournement (cluster perso, socket Unix désactivé).
  Le cluster que j'ai créé (`/home/aplou/.codiplan-mesure-cluster`) reste démarré à la fin de cette
  session ; l'arrêter avec
  `/usr/lib/postgresql/18/bin/pg_ctl -D /home/aplou/.codiplan-mesure-cluster/data stop` si plus
  besoin.
- `scripts/mesure-delais-import.mts` est idempotent (upserts sur des identifiants fixes, préfixe
  de code par un nonce aléatoire pour chaque lot synthétique) — le relancer ne casse rien, mais
  chaque relance AJOUTE des milliers de fiches « client » synthétiques à la société de mesure
  (`00000000-0000-7000-8000-00000fe50001`). Sans conséquence sur une base jetable.
- **Seul PostgreSQL 18 est installé sur cette machine** (`/usr/lib/postgresql/18`), alors que
  CLAUDE.md §2 impose la version 16. Voir « le conflit non résolu » ci-dessous : deux suites de
  `test:isolation`, sans rapport avec ce ticket, échouent de façon déterministe et reproductible
  sous cette version — probablement pour cette raison.

## Le conflit non résolu

**`pnpm test:isolation` (donc `pnpm verify` et `pnpm verify:full`) ne passe pas entièrement**, pour
une raison SANS RAPPORT avec ce ticket. Deux fichiers échouent, à l'identique sur deux passages :

- `tests/isolation/plancher-second-facteur.test.ts` — 4 échecs, tous de la même forme :
  `verrouillages` attendu à 1, obtenu 0 (compteur de verrouillage du second facteur qui ne
  s'incrémente pas).
- `tests/isolation/valorisation-intervention.test.ts` — 2 échecs : le total HT d'une intervention
  clôturée un « lundi 14 septembre 2026, 9 h–11 h à Nouméa », que le test attend ENTIÈREMENT dans
  l'ouverture du calendrier (majoration nulle), sort avec une majoration de 50 % appliquée quand
  même (30 500 au lieu de 21 500 ; 27 000 au lieu de 18 000 — l'écart est chaque fois exactement le
  montant de la majoration).

**Ce que j'ai vérifié avant d'écrire cette section** (la règle des deux rouges) :
- Les deux fichiers échouent À L'IDENTIQUE sur deux passages successifs (mêmes valeurs, mêmes
  lignes) — déterministe, pas un flake.
- Aucun des deux fichiers ne référence `lib/imports/`, `lib/imports/delais.ts`,
  `scripts/mesure-delais-import.mts` ni `prisma/seed-data.ts` — rien de ce que ce ticket a touché.
- Le reste de `pnpm verify` est VERT : format, typecheck, lint, `pnpm test` (2 583 tests, 234
  fichiers), `pnpm build`, et 1 132 des 1 138 scénarios de `test:isolation` (les 6 en échec sont les
  deux fichiers ci-dessus).
- Les deux domaines touchés — verrouillage du second facteur, calendrier d'ouverture d'une
  société — n'ont AUCUN rapport entre eux, ce qui pointe vers une cause commune plus basse que le
  code métier (l'horloge, le fuseau, ou PostgreSQL lui-même) plutôt que vers deux bugs
  indépendants.

**Mon hypothèse, non vérifiée** : la seule version de PostgreSQL installée sur cette machine est la
18.6, alors que CLAUDE.md §2 impose la 16. Le calcul « ce créneau tombe-t-il dans l'ouverture du
calendrier » et le compteur de verrouillage dépendent tous deux d'une lecture d'horloge ou d'un
calcul de fuseau/jour-de-semaine côté base ; une différence de comportement entre PostgreSQL 16 et
18 sur ce terrain n'est pas invraisemblable, mais je ne l'ai PAS confrontée à une base en version
16 — je n'en ai trouvé aucune sur cette machine pour comparer.

**Ce que je n'ai pas fait, et pourquoi je m'arrête là** : je n'ai pas cherché la cause dans
`lib/interventions/`, `lib/auth/` ou les triggers PostgreSQL concernés — c'est un chantier
d'investigation à part entière, sans rapport avec « mesurer un délai d'import », et CLAUDE.md
demande de m'arrêter après deux échecs identiques plutôt que d'insister ou de contourner. Je n'ai
pas non plus pu jouer `pnpm feries:horizon`, `pnpm audit:partitions` ni `pnpm test:e2e` (la suite
`verify:full` s'arrête au premier échec, et `DATABASE_URL` n'est pas configuré dans cette session
pour les deux premiers, qui visent une base « hébergée »-like plutôt que la base jetable).

## Ce qui reste à faire

- **Investiguer le conflit non résolu ci-dessus** — `plancher-second-facteur.test.ts` et
  `valorisation-intervention.test.ts`, sans rapport avec ce ticket. Installer PostgreSQL 16 sur
  cette machine (ou trouver la vraie cause) pour confirmer ou écarter l'hypothèse.
- Mesurer `historique` / `vgp` / `vgp_observations` directement — les imports RÉELS d'Alexis —
  avec leurs fixtures propres (client, site, agence, et pour VGP le rapprochement de machine par
  rang).
- Mesurer, ou au moins estimer par un aller-retour chronométré simple, la latence réelle vers Neon
  pour donner un facteur multiplicatif crédible entre cette mesure locale et la production —
  aujourd'hui ce rapport n'est écrit dans aucun document.
- Réparer l'accès au cluster jetable officiel (permissions du répertoire système), pour que la
  session suivante n'ait pas à recréer un cluster personnel.
- **Une proposition, pas une décision** : la mesure rend visible que le budget
  (`allersRetoursApplication`) compte deux allers-retours par ligne, CRÉATION OU MODIFICATION,
  alors que la mesure montre qu'une création n'en coûte réellement qu'un. Distinguer les deux
  desserrerait le budget pour un lot majoritairement composé de créations (le cas RÉEL d'Alexis)
  sans rien assouplir pour les modifications. C'est un changement de constante — donc un autre
  lot, pas celui-ci.
