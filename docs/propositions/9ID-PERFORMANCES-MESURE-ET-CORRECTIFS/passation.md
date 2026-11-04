# 9ID-PERFORMANCES-MESURE-ET-CORRECTIFS — passation

*Demande d'Alexis du 29/10/2026 : « est-ce qu'il y a un ticket prévu pour optimiser les
performances (le site est long à charger parfois et sur certaines pages) ? » → mesurer, corriger
les pires, poser un garde-fou.*

`main` était extrait dans un autre worktree (`/home/aplou/codiplan`) au début de cette session :
le travail a été fait sur une branche dédiée `9ID-PERFORMANCES-MESURE-ET-CORRECTIFS`, partant
d'`origin/main` (déjà à jour avec `main`).

## Point 1 — l'instrument de mesure

`tests/performance/instrument.ts` : une extension Prisma (`$extends`), jamais importée par
`lib/` — donc jamais active en production. `instrumenter(client)` rend un client qui compte les
requêtes (`compteur.requetes`) et les `$transaction` ouvertes (`compteur.transactions`), et qui,
si `MESURE_PERFORMANCE_DELAI_MS` est posée, retarde chaque requête de ce délai fixe avant de
l'exécuter. `profondeurSequentielle(dureeMs, delaiMs)` rend `Math.round(dureeMs / delaiMs)` :
tant que des requêtes s'enchaînent en séquence, le temps de rendu croît d'autant de fois le
délai ; regroupées en `Promise.all`, le délai ne compte qu'une fois.

Témoin : `tests/isolation/performance-instrument-temoin.test.ts`, qui prouve le compte et le
délai sur `listerPlanning`, seul puis en `Promise.all`.

**Limite mesurée, pas devinée** : `avecContexteApplicatif`/`avecContexteRls`/`lireSite`/
`lireAfficherMontants`/`lireRegleArrondi` (`lib/societes/identite.ts`, `lib/sites/depot.ts`)
n'acceptent aucun client injectable — elles passent toujours par le singleton `prisma` de
`lib/db/client.ts`. L'instrument ne peut donc pas les mesurer sans rediriger `DATABASE_URL`
avant tout import (patron de `tests/isolation/afficher-montants-societe.test.ts`), ce qui
empêcherait d'injecter le délai artificiel sur CE MÊME appel. Ces trois fonctions sont de
simples `findFirst` uniques (un aller-retour chacune) : leur coût est connu sans instrument,
seule leur PLACE dans la séquence (isolée ou groupée) comptait, et c'est elle qui a été corrigée
au point 3 — sans mesure chiffrée du gain exact sur ces trois appels précisément.

## Points 2 et 3 — la mesure et les correctifs

Méthode : pour les trois pages les plus profondes, chaque scénario reproduit DEUX ordres
d'appel — l'ANCIEN (les fonctions de dépôt réelles, attendues l'une après l'autre, exactement
comme la page les appelait) et le NOUVEAU (les mêmes fonctions, regroupées en paliers
`Promise.all`, exactement comme la page les appelle désormais) — sur le MÊME semis, pour que la
comparaison porte sur l'ordre, jamais sur une donnée différente. Pour les six pages déjà
construites en paliers, un seul ordre est mesuré (l'actuel, inchangé).

| Page | Rôle | Avant : transactions / requêtes / profondeur | Après : transactions / requêtes / profondeur | Cause du pire (fichier:ligne) |
|---|---|---|---|---|
| `/parametres/equipe` | admin_societe | 34 / 90 / **47** (seul fichier) | 34 / 90 / **17** | `app/(back-office)/parametres/equipe/page.tsx` : douze `await` isolés, aucun `Promise.all` au niveau de la page (ex-lignes 177–378) |
| `/planning` | admin_societe | 1 tx / 15 req / **16** (6 techniciens) | 1 tx / 25 req / **6** | `app/(back-office)/planning/page.tsx` : deux `for` séquentiels chargeant le calendrier de chaque technicien (ex-lignes ~989 et ~1071) |
| `/interventions/[id]` | adv | 10 / 24 / **26** (2 groupes instrumentables sur ~4) | 10 / 24 / **5** | `app/(back-office)/interventions/[id]/page.tsx` : quatre groupes d'`await` isolés (afficherMontants+regleArrondi ; deux `absencesDeLaPeriode` ; machines+segments+pauses+prestations+signature+pièces, 8 lectures ; exigences+site+contacts+photos+origine, 5 lectures) |
| `/interventions` (liste) | adv | — (déjà en paliers) | 5 / 15 / **6** | aucune, déjà deux paliers `Promise.all` |
| `/interventions/[id]/bon` | adv | — (déjà en paliers) | 6 / 23 / **12** | aucune majeure ; `societe` relu deux fois (bon.ts + `lireAfficherMontants`) |
| `/clients` (liste) | adv | — (déjà en paliers) | 10 / 20 / **6** | aucune majeure ; `clientsFiltresParTexte` relu trois fois en parallèle (`rechercherClients`/`compterClients`/`comptesVueClients`) |
| `/parc` (liste) | adv | — (déjà en paliers) | 4 / 10 / **2** | aucune ; `totalFiltre` redondant avec une entrée de `comptesVue` sur la vue par défaut |
| `/parametres/equipe`, `/terrain`, `/terrain/[id]` | technicien | — (déjà léger) | 3 / 6 / **7** (terrain) | aucune boucle, cinq lectures déjà sans N+1 |
| `/terrain/[id]` (fiche terrain) | technicien | — (déjà en paliers, 6/8 lectures instrumentées) | 11 / 28 / **13** | aucune majeure ; `machine` relue deux fois (mêmes ids), `mesureDeLIntervention` appelée deux fois (fiche courante + compteur ailleurs) |
| `/tableau-de-bord` | adv/direction | voir « points ouverts » — non corrigé | — | `app/(back-office)/tableau-de-bord/page.tsx:1275-1307`, `demandesACandidatesAQualifier` : un `for` avec `await avecContexteApplicatif` par demande candidate, N = nombre de demandes `nouvelle` en attente de qualification |

Sous `pnpm test:isolation` complet, les valeurs de `/parametres/equipe` montent à 66 (avant) et
35 (après) : `etatsAccesDesComptes`/`etatsAccesDesTechniciens` lisent en interne le journal de
CHAQUE administrateur `administrer_utilisateurs` de la société A par un `Promise.all` sans
plafond (hors territoire de ce lot), et d'autres fichiers de la suite en accumulent plusieurs
dizaines — même instabilité, même raison, que `tests/isolation/9ic-equipe-par-tranches.test.ts`,
qui documentait déjà ne pas mesurer ce plafond pour cette raison. Le garde-fou de cette page
plafonne donc un RATIO (nouveau ≤ 60 % de l'ancien) plutôt qu'une valeur absolue.

### Les trois correctifs

1. **`/parametres/equipe`** (`app/(back-office)/parametres/equipe/page.tsx`) — douze lectures
   regroupées en trois paliers : (a) ce qui ne dépend de rien d'autre — techniciens, agences,
   comptes de bureau, habilitations, société (5, de front) ; (b) ce qui ne dépend que de
   `comptesBureau`/`affiches` — états d'accès bureau, agences par technicien, interventions à
   venir, états d'accès techniciens, habilitations par technicien (5, de front) ; (c) les deux
   exclusivités (D226), qui dépendent du résultat de (b). Aucun changement de ce que l'écran
   affiche ; `agencesProposablesPourTechnicien` reste un N+1 par technicien (déjà signalé, hors
   territoire — une lecture BATCH exigerait une politique RLS que ce lot ne touche pas), mais il
   tourne désormais DE FRONT avec le reste du palier (b) plutôt qu'après.
2. **`/planning`** (`app/(back-office)/planning/page.tsx`) — les deux `for` séquentiels qui
   chargeaient le calendrier de chaque technicien (dénominateur de charge de la carte compacte,
   barre de charge du jour de chaque case) sont devenus `Promise.all`. Le cache partagé entre
   itérations (`CacheCalendrierAgence`) reste correct sous cette parallélisation : au pire, deux
   techniciens de la même agence dont aucun résultat n'est encore en cache déclenchent chacun une
   lecture de cette agence (d'où les 25 requêtes après contre 15 avant, sur 6 techniciens d'une
   seule agence — un sur-coût borné par le nombre d'AGENCES distinctes, jamais par le nombre de
   techniciens), jamais une valeur fausse.
3. **`/interventions/[id]`** (`app/(back-office)/interventions/[id]/page.tsx`) — quatre groupes
   d'`await` isolés regroupés en `Promise.all`, sans toucher à ce que l'écran affiche : (a)
   `lireAfficherMontants` + `lireRegleArrondi`, mutuellement indépendantes ; (b) les deux
   `absencesDeLaPeriode` (blocage à la date, disponibilité 90 jours) — `fenetreDisponibiliteTechnicien`
   avancée pour que les deux lectures partent de front ; (c) les trois lectures de machines
   (machines du site, matériel, dates) fusionnées dans le `Promise.all` de cinq qui existait déjà
   (segments, pauses, prestations, signature, pièces) — HUIT lectures de front au lieu de
   quatre rondes séquentielles ; (d) les cinq lectures de l'onglet Résumé (exigences du site,
   site, contacts du client, photos, origine demande/observation — ces deux dernières restent
   mutuellement exclusives).

Chaque correctif : `pnpm typecheck`/`pnpm lint`/`pnpm test`/`pnpm test:isolation` verts avant
commit ; aucune assertion existante modifiée.

## Point 5 — la mise en veille de la base hébergée

Ce que le code PEUT faire : rien dans ce dépôt ne réveille une base mise en veille — aucune tâche
planifiée, aucun "ping" n'a été ajouté (interdit explicite du ticket). La région des fonctions
(`syd1`) rapproche déjà l'application de la base (`vercel.json`), ce qui réduit la latence d'un
aller-retour UNE FOIS la base éveillée, mais ne change rien au délai du PREMIER aller-retour qui
la réveille.

Ce que le code NE PEUT PAS faire : la mise en veille après inactivité est un réglage du compte
chez l'hébergeur (hors du dépôt, hors de ce lot) — si la base de production est configurée pour
se mettre en veille, le premier visiteur après une période creuse paie le réveil (potentiellement
plusieurs secondes), quel que soit le nombre d'allers-retours que la page fait par ailleurs. C'est
un geste d'Alexis (désactiver la veille, ou l'accepter) : ce lot ne le propose pas à sa place.

## Points ouverts

- **`/tableau-de-bord`, `demandesACandidatesAQualifier`** (`page.tsx:1275-1307`) — un `for` avec
  `await avecContexteApplicatif` par demande `nouvelle` en attente de qualification : N
  transactions séquentielles, N = nombre de ces demandes à l'instant du rendu. Non corrigé dans ce
  lot (repéré après le troisième correctif, hors budget de temps) : candidat naturel pour un
  prochain lot performances, sur le même patron que `/planning` (le calendrier d'agence s'y cache
  déjà par `CacheCalendrierAgence` partagé entre itérations — le passage à `Promise.all` suit le
  même raisonnement de sûreté).
- **Duplications mineures déjà repérées, non corrigées** (toutes à `Promise.all` constant, donc
  sans coût de LATENCE, seulement de requêtes) : `societe` relu deux ou trois fois par rendu sur
  plusieurs pages (`/interventions/[id]/bon`, `/parametres/equipe` avant ce lot) ; `clientsFiltresParTexte`
  relu trois fois en parallèle sur `/clients` ; `machine` relue deux fois (mêmes identifiants,
  deux `select` différents) sur `/interventions/[id]` et `/terrain/[id]` ; `totalFiltre` de
  `/parc` redondant avec une entrée de `comptesVue` sur la vue par défaut ; `listerLesTechniciens`/
  `compterInterventionsSansDuree`/`famillesADeterminer` relus deux à trois fois sur
  `/tableau-de-bord` selon la composition du rôle (direction/admin_societe). Aucun n'ajoute de
  palier séquentiel ; les regrouper économiserait des requêtes, pas du temps de rendu perceptible.
- **Aucun index manquant identifié** pendant ce lot — les pires cas mesurés étaient tous des
  défauts de SÉQUENCEMENT (await isolés, `for` au lieu de `Promise.all`), jamais des requêtes
  individuellement lentes.
- **`lireSite`/`lireAfficherMontants`/`lireRegleArrondi` n'acceptent aucun client injectable** —
  contrairement à la quasi-totalité des autres fonctions de dépôt de ce dépôt. Ajouter ce
  paramètre (comme `envoyerLienDAccesBureau` et la plupart des fonctions mesurées ici) les
  rendrait testables par l'instrument et cohérentes avec le reste du dépôt ; non fait ici
  (`lib/societes/identite.ts`, `lib/sites/depot.ts` sont hors territoire de ce lot — aucune de
  leurs politiques RLS n'est touchée par un tel ajout, mais la signature, elle, l'est).

## Captures

Aucune capture : aucun écran ne change (interdiction du ticket, respectée — tous les correctifs
ne changent que l'ORDRE des lectures, jamais une donnée affichée ni une capacité).
