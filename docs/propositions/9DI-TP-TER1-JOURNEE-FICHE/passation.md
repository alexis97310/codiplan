# 9DI-TP-TER1-JOURNEE-FICHE — passation

## Ce que j'ai changé, et ce que ça change pour l'exploitation

**R1/R2 (relecture de 9DG, demandée en tête du ticket).** `fragmentDuClientDuTechnicien`
(`lib/interventions/perimetre-technicien.ts`) portait une branche « toute intervention
non annulée, sans borne de date » plus large que celle du parc : un technicien pouvait
choisir, pour créer une machine, un client dont il ne verrait ensuite PAS la machine
créée. Alignée sur la seule fenêtre de sept jours de `fragmentDuParcDuTechnicien`. Ajout
des tests d'isolation manquants nommés par la passation de 9DG (`lireMachine`/
`informationDeLaMachine` hors périmètre, `creerMachine`/`modifierMachine` hors
périmètre, `lireDocument` sur le document d'un collègue).

**A — La fiche terrain** (`app/(mobile)/terrain/[id]/page.tsx`) montre désormais : la
priorité (toujours), le numéro et la référence client, le créneau « HH:MM – HH:MM » (ou
la date seule) dans le fuseau de l'agence, la panne signalée, TOUTES les machines
(désignation complète + n° de série, comme la fiche du bureau), et le contact de
l'intervention avec son nom et un ou deux liens `tel:`. `lireFicheIntervention`
(`lib/interventions/depot.ts`) lit désormais le téléphone et le mobile du contact, en
plus de son nom — le bureau continue de ne lire que le nom, rien n'y change pour lui.
Un technicien sur le terrain voit enfin, sans appeler le bureau, ce qu'il va faire, où,
avec quoi, et qui appeler sur place.

**B — La carte de Ma journée** (`app/(mobile)/terrain/page.tsx`) porte la priorité, la
première ligne de la panne (tronquée) et les machines en une ligne.

**C — Le bandeau « compteur en cours »** (`components/terrain/bandeau-compteur.tsx`)
s'affiche en tête de Ma journée (si le compteur tourne sur une intervention de la
journée affichée) et en tête de la fiche d'une AUTRE intervention que celle où il
tourne, avec un lien direct. Sur la fiche où il tourne lui-même, le texte devient
« Le compteur tourne depuis HH:MM » — l'heure manquait.

**D — Les boutons du compteur.** « Démarrer l'intervention » ne s'affiche plus
inconditionnellement : il suit désormais le verdict serveur (`peutDemarrerLeCompteur`,
inchangé) — sur une intervention annulée, clôturée ou suspendue, la raison refusée
prend la place du bouton. Une intervention déjà `en_cours`, sans aucun segment ouvert ni
ici ni ailleurs, affiche « Reprendre le compteur » au lieu de « Démarrer
l'intervention » — même route, même règle, un seul libellé qui change. Un technicien ne
peut donc plus démarrer un compteur que la base aurait refusé, et sait distinguer un
premier départ d'une reprise après pause.

**E/F — Barre basse et Profil.** Une barre fixe en pied d'écran (`components/terrain/
barre-basse.tsx` + `barre-basse-entrees.ts`), deux entrées : « Journée » et « Profil ».
`ENTREES_TERRAIN` reste vide (R5-01) — ce n'est pas une barre de domaine, c'est une
navigation d'étape. `app/(mobile)/terrain/profil/page.tsx` (neuve) : nom, courriel,
société active, « Se déconnecter ».

**G — Messages de succès et titre d'onglet.** Les trois routes
(`app/api/terrain/[id]/{rapport,prestations,signature}/route.ts`) posent désormais un
motif de succès (`terrain.rapport.enregistre`, etc.), affiché par le même
`BandeauMotif` que le reste du produit (sa liste fermée de clés de réussite passe de
onze à quatorze). Le titre d'onglet de la fiche devient le nom du client
(`generateMetadata`), plus jamais « Ma journée ».

**H — Décision D161** (`docs/arbitrages.md`) consigne les choix ci-dessus et revient sur
la phrase de D121 (« sa barre du terrain reste vide ») en expliquant qu'elle ne
tranchait qu'une barre de DOMAINE, jamais un second chrome d'ÉTAPE.

## Ce que j'ai mesuré

- `pnpm verify` (format, typecheck, lint, test unitaire, test d'isolation, build) :
  **vert**, rejoué en entier APRÈS le rebase final sur `origin/main`
  (`9a2f6ed`, commit `9DW-E2E-DIMANCHE`).
- Tests unitaires : 3931 passés (dont les 13 nouveaux de ce lot :
  `tests/unit/interventions/client-du-technicien.test.ts`,
  `tests/unit/terrain/presentation.test.ts` et les ajouts à `bandeau-motif.test.ts`).
- Tests d'isolation : 1354 passés (dont les 6 nouveaux de R1/R2).
- `pnpm test:e2e` complet, en 4 lots (`--shard=1/4` à `4/4`, sous `CI=1`,
  823 tests) : **tous verts**, à une exception près — voir « Le conflit ».
  Rejoué ensuite, ciblé sur les fichiers de ce lot et les fichiers voisins
  (terrain, rapport, bon-4, navigation, plancher-12, avertissements-1,
  9DD) + l'épreuve en conflit : 38/38 verts APRÈS le rebase.
- 12 captures AVANT/APRÈS (`docs/propositions/9DI-TP-TER1-JOURNEE-FICHE/captures/`) :
  Ma journée (375/1280, avec et sans bandeau), la fiche (375/1280), « Reprendre le
  compteur » (375), le profil (375/1280). AVANT pris dans un worktree au commit
  `bd9a6ce` (dernier commit de 9DG) — voir « Ce que j'ai tranché ».

## Ce que j'ai tranché, et pourquoi

- **La disposition de la fiche n'est PAS celle, littérale, listée par le ticket.** Le
  ticket ordonne « priorité, numéro et référence client, créneau, panne, machine(s),
  contact » ; j'ai gardé « site » et « type » (utiles, jamais dits à retirer) et composé
  l'ensemble en blocs distincts, en suivant la DISPOSITION de la maquette du 28/09
  (`tIv`, le bloc « Sur place » qui réunit le site et le contact) — jamais son contenu
  (D137, D125). Aucune épreuve ne fige un ordre vertical précis ; seules la présence et
  les valeurs sont éprouvées.
- **Recette de captures AVANT/APRÈS** : le code de ce lot est déjà committé en plusieurs
  commits, donc j'ai suivi la recette « code déjà committé » de ma mémoire de session —
  `git worktree add` au commit qui précède le lot, symlink de `node_modules`, un spec de
  capture écrit directement dans le worktree, lancé avec `CI=1`, PNG écrits directement
  dans le dépôt principal via `CAPTURES_9DI=/chemin/absolu`. Le worktree a été retiré
  après usage.
- **D161 cite deux documents du Projet (`claude/decisions-alexis-03-10.md`,
  `claude/mesure-tp-ter-acc-03-10.md`) que je n'ai PAS pu ouvrir** (ni dans le dépôt, ni
  via Google Drive, ni via un conteneur Claude Docs connu) : le contenu détaillé des
  « choix du pilote » n'est donc PAS recopié depuis ce document mais déduit de la
  section « CE QUE TU FAIS » du ticket lui-même, qui les énonce déjà concrètement. Si
  Alexis constate un écart avec le document original, la condition de réouverture de
  D161 s'applique.
- **`pnpm test:e2e` sous 30 minutes** : un run complet dépasse le plafond d'un seul
  appel d'outil ; je l'ai rejoué en 4 lots (`--shard=N/4`), chacun sous 10 minutes.
- **R1/R2 et le reste du lot partagent deux commits distincts** de ceux d'A à H, pour
  garder le travail de relecture de 9DG traçable séparément — ce n'est pas le découpage
  « un commit par partie » littéral demandé par le ticket (A, B, C… séparés), les
  fichiers partagés (`lib/i18n/fr.ts` notamment) rendant ce découpage plus risqueux
  qu'utile à refaire après coup ; voir le détail dans `git log`.

## Ce que je n'ai PAS fait

- Aucun écran séparé pour « Terminer » (rapport/signature restent sur le même écran,
  T2 est le ticket suivant), aucun scanner, aucune fiche « Mes machines », aucun
  itinéraire, aucune dictée, aucun bandeau réseau — tous explicitement hors lot.
- Aucune règle de cycle de vie, de droit ou de périmètre changée : `peutDemarrerLeCompteur`,
  `accesSurCetteIntervention`, `perimetreDuPlanning` sont lus, jamais réécrits.
- La reprise d'une intervention SUSPENDUE n'est PAS offerte au terrain dans ce lot
  (elle replanifie l'intervention et la ferait disparaître de la journée du technicien
  après 9DD) — question explicitement laissée ouverte par le ticket, non tranchée ici.
- Le profil ne porte ni absences ni habilitations (dessinées par la maquette du 28/09) —
  réservé à TP-ABS.
- Je n'ai pas corrigé `planning-laissees-sous-la-grille.spec.ts` — voir ci-dessous,
  hors territoire et déjà réparé par le rebase.

## Les pièges pour la session suivante

- **`ENTREES_BARRE_BASSE` vit dans un fichier `.ts` SANS JSX**
  (`components/terrain/barre-basse-entrees.ts`), jamais directement dans
  `barre-basse.tsx`. Le gardien `tests/unit/i18n/sans-chaine-visible-en-dur.test.ts`
  suit un identifiant constant jusqu'à son initialisation DANS LE MÊME FICHIER pour
  juger si un littéral atteint l'écran ; un tableau de configuration `.map()`-é
  directement dans un fichier qui rend du JSX se fait all flagger — tous ses champs,
  y compris des valeurs qui ne sont pas du texte (un chemin, un nom d'icône). Si vous
  ajoutez une troisième entrée à la barre basse, gardez-la dans ce fichier séparé.
- **Le compteur du compteur (`<Button>`) doit rester UNIQUE dans le JSX source.**
  `tests/unit/ui/composants-base.test.tsx` et `retouches-2a.test.ts` comptent les
  occurrences LITTÉRALES de `<Button` par fichier (regex statique, pas d'évaluation des
  branches) : scinder un bouton conditionnel en deux blocs JSX distincts (un par
  branche) casse ce compte même si un seul se rend jamais. Un seul `<Button>`, un
  `value`/label calculés par ternaire.
- **Les dates de fixture d'un spec e2e doivent utiliser `cleJour(jourDe(maintenant(fuseau).local))`**,
  jamais `new Date().toISOString().slice(0, 10)` : à certaines heures, UTC et Nouméa
  (UTC+11) sont sur deux jours civils différents, et `/terrain` filtre sur celui de la
  société. Un fixture daté en UTC peut donc rater le filtre « aujourd'hui » de la page
  sans qu'aucune erreur ne le dise — juste une carte absente.
- **`temps_mesure_min` ne se pose jamais à la main sur une ligne nouvellement créée** :
  un déclencheur (`intervention_temps_mesure_du_compteur`, D120) refuse toute valeur
  posée qui ne corresponde pas à la somme des segments déjà en base au moment de
  l'écriture — et à la création, cette somme est toujours nulle. Laissez la colonne
  `NULL` ; `mesureDeLIntervention` lit `segment_travail` directement, jamais cette
  colonne.
- **Un `Contact` ne se crée pas avec `roles: []` ni `canaux: []`** : deux contraintes
  (`contact_roles_non_vides`, `contact_canaux_non_vides`) l'interdisent, et `email` est
  le SEUL canal connu aujourd'hui (`lib/contacts/saisie.ts`) — un contact avec
  `canaux: ["email"]` doit donc porter un `email`.
- **`planning-laissees-sous-la-grille.spec.ts` a rougi DEUX FOIS** pendant ce lot
  (shard 4/4, puis rejoué seul) — fichier et fonctionnalité totalement hors territoire
  de ce ticket (`app/(back-office)/planning/page.tsx`, jamais touché). `git fetch` a
  montré que `origin/main` portait déjà le correctif, commité le même jour sous
  `9DW-E2E-DIMANCHE — la vue jour des laissées vise un jour ouvré, pas « aujourd'hui »`
  (`9a2f6ed`) : le rebase de fin de session l'a intégré, et l'épreuve est repassée
  verte juste après. **Pas une correction de ma part** — un cas d'école de la règle
  « deux rouges et tu t'arrêtes » suivie à la lettre, résolu par la mise à jour sur
  `main` elle-même.
- **`pnpm test:e2e` complet dépasse 30 minutes** : utiliser `--shard=N/4` (ou plus) pour
  rester sous le plafond d'un appel d'outil, plutôt que `pnpm verify:full` d'un seul
  tenant.
- Toute exécution de `pnpm test:e2e` (même partielle) régénère les PNG de capture
  d'AUTRES tickets qui en prennent (une quarantaine de fichiers à la racine de
  `docs/propositions/`) : `git status` après coup, `git checkout --` dessus et
  `git clean -fd docs/propositions/` sur les nouveaux avant de committer quoi que ce
  soit — jamais les committer par erreur.

## Ce qui reste à faire

- Faire valider par Alexis les choix du pilote consignés dans D161 (la disposition
  exacte de la fiche, la non-offre de reprise d'une suspendue au terrain, et plus
  largement la condition de réouverture de D161 elle-même).
- T2 (ticket suivant annoncé) : séparer rapport et signature en écrans distincts.
- TP-PARC : « Machines » et « Scanner » rejoignent la barre basse (actuellement deux
  entrées seulement, par construction — voir le docblock de `barre-basse.tsx`).
- TP-ABS : le profil reçoit les absences et les habilitations dessinées par la maquette
  du 28/09 (`route("/terrain/profil")`, :5366) — rien de cela n'est dans ce lot.
- Le document du Projet `claude/mesure-tp-ter-acc-03-10.md` (§« Choix du pilote
  TP-TER ») n'a pas pu être consulté directement pendant cette session (voir « Ce que
  j'ai tranché ») : si son contenu diverge de ce que D161 décrit, D161 doit être
  corrigée en conséquence.
