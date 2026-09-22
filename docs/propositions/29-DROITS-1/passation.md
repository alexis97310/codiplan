# DROITS-1 — passation

Travail commité **sur `main` en local**, non poussé : `c968480` (le cœur —
matrice, dépôt, VGP, cinq routes, gardien de porte), `4c7ce33` (la matrice
documentée, D131 dans `docs/arbitrages.md`), `ef66fee` (deux scénarios e2e
bout en bout), `e7a532e` (captures AVANT/APRÈS), `baa15a7` (formatage
prettier). `pnpm verify:full` rejoué en entier APRÈS le dernier commit,
intégralement vert.

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

**Le trou du constat est fermé.** Avant ce lot, `POST
/api/interventions/[id]/{cloturer,annuler,suspendre,reprendre}` et `POST
/api/vgp/enregistrer/[id]` appelaient `contexteCourant()` — session et
société, aucun rôle. N'importe quel compte de la société, technicien compris,
pouvait clôturer, annuler, suspendre ou reprendre l'intervention d'un
collègue, et enregistrer une VGP sur n'importe quelle machine.

- **`lib/auth/habilitations.ts`** — `cloturer_intervention` retrouve le `○`
  que l'arbitrage 3.17 avait retiré, mais SCOPÉ (voir plus bas). Trois
  capacités neuves, absentes du §5.2 : `annuler_intervention` (aucun `○` —
  le technicien n'annule jamais), `suspendre_reprendre_intervention` (même
  `○` scopé que clôturer), `enregistrer_vgp` (même `○` scopé). 25 → 28
  capacités.
- **`lib/interventions/perimetre-technicien.ts`** — `perimetreDuPlanning`
  est devenu un cas particulier d'une fonction généralisée,
  `perimetreParPersonne(contexte, capacite)` : le même « trois verdicts »
  qui servait `consulter_planning` sert maintenant n'importe quelle
  capacité. Deux fonctions neuves : `dansLePerimetre` (l'intervention visée
  est-elle celle du technicien restreint ?) et `accesSurCetteIntervention`
  (les deux composées).
- **`lib/interventions/depot.ts`** — `cloturerIntervention`,
  `suspendreIntervention`, `reprendreIntervention` jugent désormais le
  périmètre AVANT le verdict de statut (`peutCloturer`, etc.) : un rôle
  restreint hors de son intervention reçoit `intervention.refus.inconnue` —
  la même clé qu'une intervention inexistante (D35, D50 : ne pas renseigner
  qu'une intervention d'un collègue existe). `annulerIntervention` est
  INCHANGÉE : `annuler_intervention` ne porte aucun `○`, la porte suffit.
- **`lib/vgp/verification.ts`** — `enregistrerVerification` vérifie, pour un
  rôle restreint, l'EXISTENCE d'une intervention non annulée qui rattache la
  machine visée au technicien (`intervention_machine` + `intervention`) ;
  sinon elle lève, capturée par la route comme le cas « machine hors
  société » existant (même refus, même raison D50).
- **Les cinq routes** passent à `exigerCapacite(...)`, enveloppées dans
  `dansUnEchangeAuth(...)` — un gardien existant que je ne connaissais pas
  avant de le faire rougir (`tests/unit/auth/echange.test.ts`) l'exige dès
  qu'une route importe `@/lib/auth/`.
- **`tests/unit/auth/porte.test.ts`** — les cinq routes sortent de
  `EXEMPTIONS`, entrent dans `ROUTE_CAPACITE`. 58 → 63 routes gardées.
- **La fiche intervention**
  (`app/(back-office)/interventions/[id]/page.tsx`) — les blocs Clôturer,
  Suspendre/Reprendre et Annuler ne s'affichent plus DU TOUT (pas même en
  refus) quand `accesSurCetteIntervention` rend faux — lu depuis la même
  matrice, jamais une seconde liste de rôles.
- **Documentation** : `docs/arbitrages.md` porte D131 en entier (le tableau,
  le motif, les cas non tranchés pris au plus restrictif) ;
  `docs/cahier-des-charges.md` §5.2 gagne les trois lignes et rétablit le
  `○` de « Clôturer », avec un renvoi vers D131.

**Pour Alexis** : un technicien ne peut plus toucher l'intervention d'un
collègue (clôturer, suspendre, reprendre), ni jamais annuler quoi que ce
soit — geste réservé au bureau. Sur SES PROPRES interventions, il garde
exactement ce qu'il avait. Le bureau (`admin_societe, direction,
responsable_materiel, responsable_sav, adv`) garde la main sur tout, sans
rien de changé pour lui — les captures `fiche-bureau--{avant,apres}` sont
identiques octet pour octet.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

**Le constat du ticket, rejoué sur `main` (`0ae8011`)** avant d'écrire une
ligne : `tests/unit/auth/porte.test.ts` listait les cinq routes dans
`EXEMPTIONS`, avec le motif « arbitrage en attente » — confirmé en lisant
directement les cinq fichiers, qui appelaient tous `contexteCourant()`.

**Captures AVANT/APRÈS**, 1280×900, même intervention (`Local-000002`,
affectée à D. Guérin), base d'épreuve locale (`pnpm test:e2e`) rejouée par
deux serveurs de production successifs — AVANT sur un `git worktree` au
commit `0ae8011` (port 3101), APRÈS sur `main` courant (port 3100), dans
`docs/propositions/29-DROITS-1/` :

| Capture | AVANT | APRÈS |
|---|---|---|
| `fiche-technicien` | bloc « Annuler l'intervention » présent et actionnable | bloc absent ; Clôturer/Suspendre restent (refusés par le statut, comme avant) |
| `fiche-bureau` | tous les blocs | identique, **octet pour octet** |

**`pnpm verify:full` intégral, vert** : format, typecheck, lint,
**2620 tests unitaires** (240 fichiers), **1154 tests d'isolation**
(113 fichiers, dont 11 nouveaux dans `tests/isolation/droits-cycle-de-vie.test.ts`),
build, `feries:horizon`, `audit:partitions`, **157 tests e2e** (3 attendus
sautés — sans rapport avec ce lot), dont 4 dans
`tests/e2e/porte-capacites.spec.ts` (2 existants + 2 neufs).

## Ce que j'ai tranché et pourquoi

- **Le refus de périmètre reprend `intervention.refus.inconnue`**, jamais un
  message neuf — cette clé disait déjà « elle n'est pas dans votre
  périmètre » avant ce lot (elle existait pour un tout autre chemin), et
  c'est exactement D35/D50 : ne jamais distinguer « hors périmètre » de
  « inexistante », sous peine de renseigner qu'une intervention d'un
  collègue existe.
- **Une seule capacité pour suspendre ET reprendre**
  (`suspendre_reprendre_intervention`), comme le tableau du ticket le
  regroupe en une ligne : la matrice ne distingue pas les deux sens d'une
  même pause.
- **Le cas non tranché par le tableau — une intervention non affectée
  (`technicien_id` NULL) — est pris au plus restrictif**, comme demandé :
  `dansLePerimetre` compare par égalité stricte, et `null !== technicienId`
  est toujours vrai. Un technicien restreint ne peut donc agir QUE sur une
  intervention explicitement affectée à lui — y compris s'il l'avait
  commencée avant d'en être retiré (cas nommé dans D131).
- **`perimetreDuPlanning` est généralisé plutôt que dupliqué** — le ticket
  demandait de RÉUTILISER le périmètre existant plutôt que d'en écrire un
  second ; la forme exacte (une liste de techniciens filtrés) ne convenait
  pas à « cette intervention précise », donc j'ai généralisé la fonction
  qui la PRODUIT (`perimetreParPersonne`, paramétrée par la capacité) plutôt
  que d'écrire une seconde lecture du même critère (§9, 01/09).
- **VGP : le périmètre se lit par EXISTENCE, pas par égalité** — une machine
  ne porte pas de `technicien_id` ; le critère est « existe-t-il une
  intervention non annulée, rattachant cette machine, affectée à ce
  technicien ». C'est un thème différent d'`accesSurCetteIntervention`, donc
  une requête dédiée dans `enregistrerVerification`, pas une réutilisation
  forcée.
- **Les captures passent par un `git worktree`**, pas par un `git checkout`
  transitoire du dépôt courant : zéro risque pour l'arbre de travail en
  session non interactive, et un `git worktree remove --force` en nettoie
  toute trace (confirmé : `git worktree list` ne montre plus que `main`).

## Ce que je n'ai PAS fait

- **Aucune migration**, conformément à l'interdit du ticket.
- **Aucun test HTTP direct des refus « suspendre/reprendre hors périmètre »
  ni « VGP hors périmètre » au niveau e2e** — seulement au niveau isolation
  (`droits-cycle-de-vie.test.ts`, 11 scénarios) et un échantillon de deux cas
  (annuler, clôturer-collègue) au niveau e2e bout en bout
  (`porte-capacites.spec.ts`). Le couple {porte.test.ts (session fabriquée),
  droits-cycle-de-vie.test.ts (dépôt + vraie base), porte-capacites.spec.ts
  (chaîne entière, 2 cas)} couvre les trois maillons, mais pas les cinq
  routes à travers les trois maillons À LA FOIS — un choix de coût, pas un
  oubli.
- **Je n'ai pas ajouté de capture pour le rôle CLIENT** ni pour un rôle
  éditeur sur la fiche — le ticket ne le demandait pas (« un rôle du bureau
  … puis un technicien »).

## Les pièges pour la session suivante

- **`tests/unit/auth/echange.test.ts` réclame `dansUnEchangeAuth(...)` dans
  TOUTE route qui importe `@/lib/auth/`** — pas seulement celles qui
  écrivent par `id`. Je l'ai découvert en cassant ce gardien : basculer une
  route de `contexteCourant()` vers `exigerCapacite(...)` la fait ENTRER
  dans sa population, même si elle n'était pas concernée avant. Le réflexe
  qui marche : copier la forme de `app/api/machines/creer/route.ts`
  (`POST` → `dansUnEchangeAuth(() => traiter(...))`), pas seulement changer
  l'appel de contexte.
- **`MACHINE_A1` est DÉJÀ légitimement accessible au technicien canonique du
  harnais d'isolation** — `INTERVENTION_A1` (fixture permanente de
  `tests/isolation/setup/global.ts`) lui est affectée et rattachée à
  `MACHINE_A1` depuis le lot 2, pour que « mes interventions » ait une
  population. Toute épreuve de périmètre VGP qui utiliserait `MACHINE_A1`
  serait donc verte QUELLE QUE SOIT la logique testée — j'ai découvert ce
  piège en écrivant `droits-cycle-de-vie.test.ts` et je suis passé à
  `MACHINE_A2`, qui n'a AUCUN rattachement de fixture. Le lire dans
  `tests/isolation/setup/global.ts` (section « LES MACHINES DES
  INTERVENTIONS ») avant d'écrire une épreuve de périmètre sur une machine.
- **Une capture standalone (hors `test()` de Playwright) qui ouvre deux
  identités doit ouvrir DEUX `BrowserContext`**, jamais deux `page()` du
  même contexte — les cookies de session se partagent au niveau du
  contexte, et la seconde connexion retrouve la première déjà active
  (`/connexion` redirige alors ailleurs, et `getByLabel` timeout sans dire
  pourquoi). C'est invisible dans un fichier `*.spec.ts` normal parce que
  chaque `test()` de Playwright a DÉJÀ sa propre isolation ; ça ne l'est
  plus dans un script `tsx` écrit à la main.
- **`pkill -f "next start …"` depuis ce poste tue le shell appelant**
  (retenu de la mémoire du poste, reconfirmé ici : exit 144 deux fois de
  suite). Utiliser un pattern plus précis ou vérifier après coup avec
  `ps aux` plutôt que de chaîner une commande derrière.
- **Ne jamais faire confiance au code de sortie d'un pipeline avec `tail`** :
  `pnpm verify:full | tail -400` masque l'échec éventuel de `pnpm` (c'est le
  code de `tail` que le shell voit). La bonne forme est `set -o pipefail`
  puis rediriger vers un fichier, ou vérifier `${PIPESTATUS[0]}`.

## Ce qui reste à faire

Rien d'identifié dans le territoire de ce ticket. Points ouverts, hors
territoire, nommés par D131 lui-même comme conditions de réouverture : la
distinction éventuelle entre « suspendre » et « reprendre » comme deux
capacités séparées, et le cas d'un technicien retiré d'une intervention EN
COURS qui voudrait garder la main dessus.
