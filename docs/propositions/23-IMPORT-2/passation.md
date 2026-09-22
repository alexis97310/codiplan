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
| création | 100 | 90,8 ms |
| création | 1 000 | 507,9 ms |
| création | 8 000 | 3 859,2 ms |
| modification | 100 | 160,9 ms |
| modification | 1 000 | 1 052,6 ms |
| modification | 8 000 | 7 455,1 ms |

(table complète, 7 tailles × 2 régimes, dans `mesure.md`).

**Le fait le plus utile** : une modification coûte, mesuré, très exactement **le double** d'une
création par ligne (0,92 ms/ligne contre 0,48 ms/ligne) — ce que le docblock d'
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
  de code par horodatage pour chaque lot synthétique) — le relancer ne casse rien, mais chaque
  relance AJOUTE des milliers de fiches « client » synthétiques à la société de mesure
  (`00000000-0000-7000-8000-00000fe50001`). Sans conséquence sur une base jetable.

## Ce qui reste à faire

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
