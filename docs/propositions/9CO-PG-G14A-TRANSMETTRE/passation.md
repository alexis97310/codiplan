# Passation — 9CO-PG-G14A-TRANSMETTRE

Commit mesuré au départ : `5127b1b` (comme indiqué par le ticket) ; main relu à `10d00c0` avant le
premier commit de ce lot — rien de 9CM-RETOUCHES-2B-REPRISE ni de 9CN-RETOUCHES-3 n'a été défait.
Cinq commits, dans l'ordre : `d7d4ab7`, `ec32ca3`, `ffa3b92`, `e1bcf36`, `8fc3b7b`.

## Ce que j'ai changé

- **`peutTransmettre`** (`lib/interventions/cycle-de-vie.ts`) : une Planifiée se transmet si elle
  porte sa date, son heure, sa durée et son technicien — sinon un refus nommé par cle, un manque à
  la fois.
- **`transmettreIntervention`** (`lib/interventions/depot.ts`) : écrit `statut = 'affectee'`, rien
  d'autre, sous `modifier_planning`. Route neuve `POST /api/interventions/[id]/transmettre`,
  enregistrée dans `ROUTE_CAPACITE` (`tests/unit/auth/porte.test.ts`).
- **`statutApresDeplacement`** corrigé : une AFFECTÉE qu'on vide (date et créneau) retombe
  `a_planifier`, exactement comme une PLANIFIÉE (matrice D8/QG-4) — avant ce lot elle restait
  `affectee` sans date, un écart avec D8 qui préexistait à ce ticket.
- **Le courriel technicien** (`lib/avertissements/planification.ts`) ne part plus qu'à partir du
  moment où la ligne est `affectee` : transmission (raison « planification », texte inchangé),
  déplacement d'une Affectée (raison « déplacement », immédiat), changement de technicien sur une
  Affectée (nouveau « planification », ancien « retirée »). Rien ne part sur une simple Planifiée
  (ni à la planification, ni au déplacement, ni au changement de technicien) : le terrain ne la
  voit pas encore. Le client garde sa règle inchangée (prévenu à la planification).
- **`action-principale.ts`** : `planifiee` → `"transmettre"` (était `"affecter"`). « Affecter un
  technicien » reste disponible, en action SECONDAIRE partout — elle se replie désormais dans un
  `<details>` au lieu de s'ouvrir pour une Planifiée.
- **Fiche et tiroir** : bloc « Transmettre au technicien » (fiche, action principale d'une
  Planifiée) et bouton identique dans le tiroir du planning (PG-C5), au-dessus de « Poser… » et
  « Remettre dans la file ».

### Ce que ça change pour l'exploitation

Une Planifiée reste **invisible du terrain** tant qu'un planificateur n'a pas cliqué
« Transmettre au technicien » — depuis la fiche ou depuis le tiroir du planning. Ce clic, et lui
seul, envoie le courriel au technicien et fait apparaître l'intervention sur sa fiche terrain
(badge « Nouveau » compris, logique inchangée). **Ce lot ne retire RIEN du côté du terrain** :
PG-G14C (à venir) fera disparaître les Planifiées de ce que le terrain voit ; jusque-là, elles
restent visibles — état intermédiaire voulu, pas un oubli (voir D141).

## Ce que j'ai mesuré

**Unitaires et isolation (`pnpm test`, `pnpm test:isolation`)** : 3657 tests unitaires (357
fichiers), 1302 tests d'isolation (138 fichiers), tous verts à la fin de chaque commit. Je n'ai
pas mesuré le compte EXACT d'avant ce lot (plusieurs ajouts de tests ont précédé mon premier
`pnpm test`) — ce que je peux affirmer, mesuré directement : `tests/unit/interventions/
cycle-de-vie.test.ts` porte 7 `it` neufs pour `peutTransmettre` ; `tests/unit/auth/porte.test.ts`
passe de 66 à 67 routes gardées ; `tests/isolation/avertissements-transmission.test.ts` est un
fichier neuf de 5 `it` ; `tests/isolation/avertissements-reaffectation.test.ts` gagne 1 `it`
(« réaffecter sur une simple PLANIFIÉE »).

**« Qui reçoit quoi », avant → après (D141)** :

| Transition | Client (avant) | Client (après) | Technicien (avant) | Technicien (après) |
|---|---|---|---|---|
| Planifier (a_planifier → planifiee) | prévenu | **inchangé** : prévenu | prévenu | **plus prévenu** |
| Transmettre (planifiee → affectee) | — | — | — | **prévenu** (nouveau) |
| Déplacer une Planifiée | prévenu | **inchangé** : prévenu | prévenu | **plus prévenu** |
| Déplacer une Affectée | prévenu | **inchangé** : prévenu | prévenu | **inchangé** : prévenu, aussitôt |
| Changer le technicien d'une Planifiée | — | — | (n/a avant ce lot) | **toujours pas prévenu** |
| Changer le technicien d'une Affectée (ancien/nouveau) | — | — | (n/a avant ce lot) | **inchangé** : nouveau « planification », ancien « retirée » |
| Remettre dans la file (Planifiée ou Affectée) | — | — | — | — |

**E2E (`CI=1 npx playwright test`, 758 tests + ma scène)** : un seul run complet à vide
(30,1 min) a trouvé **une** régression réelle hors du territoire nommé par le ticket —
`ecrans-largeur-utile.spec.ts:171` comptait cinq `<form>` dans l'aside d'une fiche Planifiée,
il en faut six (Affecter ET Transmettre coexistent désormais) — corrigée, puis rejouée seule
(7/7 verts). Les 750 autres tests du run complet étaient déjà verts. Avant cette correction, 8
fichiers ciblés (26 tests touchés par ce lot) avaient déjà été rejoués isolément sous `CI=1` et
étaient verts.

**`pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build`** : verts à chaque commit.

## Ce que j'ai tranché et pourquoi

- **Quatre nouvelles clés i18n** (`intervention.refus.pas_planifiee`,
  `...transmission_date_manquante`, `...transmission_duree_manquante`,
  `...transmission_technicien_manquant`) plutôt que réutiliser les clés de `peutPlanifier`
  (`...planification_date_manquante`, etc.) : le texte existant dit « obligatoire pour
  *planifier* » — une Planifiée l'est déjà, le message aurait menti sur l'action en cours.
- **`transmettreIntervention` sous `modifier_planning`**, pas `qualifier_affecter` : c'est la
  même capacité que « Planifier »/« Déplacer », cohérent avec le fait que Transmettre est la
  SUITE du geste de planification, pas une qualification.
- **La route `.../transmettre` négocie JSON comme `.../deplacer`** (`Accept: application/json`),
  alors que le ticket citait `affecter/route.ts` (formulaire seul) comme modèle : nécessaire pour
  que le bouton du tiroir (PG-C5) fonctionne sans recharger toute la page, exactement comme
  `remettreDansLaFile` le fait déjà pour `.../deplacer`.
- **`statutApresDeplacement` corrigé** alors que ce n'était pas explicitement listé dans le
  territoire : le constat du ticket lui-même pointait cet écart avec D8, et le point 1 de
  « CE QUE TU FAIS » le demande explicitement (« tout vide -> a_planifier pour une planifiee OU
  une affectee »).
- **`tests/isolation/verdict-pose-lecture.test.ts` adapté** (hors territoire nommé) : son dernier
  scénario démontrait précisément le bug que je venais de corriger (« AFFECTÉE sans durée, tout
  vidé — bloquée par PG-A4 ») ; le laisser tel quel aurait fait échouer `pnpm test:isolation`.
- **Scope e2e étendu bien au-delà des quatre fichiers nommés par le ticket**
  (`avertissements-1`, `fiche-trouver-creneau`, `fiche-telephone`,
  `intervention-technicien-select`) : « Affecter » n'étant plus jamais l'action principale d'une
  Planifiée, elle se replie désormais systématiquement dans un `<details>` — j'ai dû aussi
  adapter `blocage-agenda-visible.spec.ts`, `creation-duree-prevue.spec.ts`,
  `parcours-creer-puis-planifier.spec.ts` et, trouvé par le balayage complet en toute fin de
  lot, `ecrans-largeur-utile.spec.ts`. Le territoire du ticket citait une liste incomplète.
- **Captures AVANT/APRÈS du GESTE, pas d'un commit** (pas de `git worktree`) : ce ticket AJOUTE
  un geste sans modifier aucun autre affichage — la fiche d'une Planifiée avant/après le clic
  « Transmettre » est la paire la plus honnête, documentée ainsi dans le README des captures.

## Ce que je n'ai PAS fait

- **PG-G14B et PG-G14C** — explicitement hors périmètre (découpage du pilote) : pas de
  « Transmettre demain (n) », pas de « Transmettre toutes les planifiées prêtes », pas de
  récapitulatif par technicien, et le terrain continue de voir les Planifiées.
- **Aucune migration, aucune ligne de semis, aucun prix** — le statut `affectee` et sa contrainte
  existaient déjà depuis D8.
- **Je n'ai pas relu/modifié `listerPlanning`, `lireFicheIntervention`, `bon.ts`, les fixtures
  terrain** — strictement lues pour comprendre ce que PG-G14C devra toucher, jamais écrites
  (voir plus bas).
- **Pas de captures par `git worktree`** (code avant/après) — voir « ce que j'ai tranché ».

## Pièges pour la session suivante

- **`statutApresDeplacement` touche un chemin que `tests/isolation/verdict-pose-lecture.test.ts`
  documentait comme « le dernier endroit » où `peutEcrireSansDuree` pouvait encore refuser un
  déplacement** — ce chemin est maintenant fermé (plus aucune combinaison valide de
  `Deplacement` ne l'atteint). Si un futur ticket rouvre ce code, relire ce fichier en entier
  avant d'y toucher : son en-tête explique pourquoi.
- **Lancer les épreuves e2e de ce dépôt SANS `CI=1` fait courir plusieurs fichiers en parallèle
  sur le MÊME journal de courriels interceptés** (`FICHIER_COURRIELS_CAPTURES`, un seul chemin
  global) — les comptes `avant + N` deviennent faux par interférence entre fichiers (mesuré :
  +1 à +2 de trop). Toujours `CI=1` pour ces épreuves, jamais le run par défaut à 12 workers.
- **Exécuter les specs e2e touchées régénère des captures PNG dans des dossiers d'AUTRES
  tickets** (`docs/propositions/47-AVERTISSEMENTS-1/captures/*`,
  `docs/propositions/AVERT-POSE-FICHE/captures/*`) — je les ai laissées non commitées
  (working tree local seulement) ; elles étaient déjà modifiées AVANT que je ne touche quoi que
  ce soit (dérive d'une session précédente, non commitée elle non plus — voir aussi le stash
  `AGENCE-2` resté sur la pile, étranger à ce lot). Ne pas les confondre avec un travail à moi.
- **`peutTransmettre` relit le technicien, la date, l'heure et la durée par PRUDENCE** — en
  pratique, `peutPlanifier` garantit déjà qu'une Planifiée réelle porte les quatre (PARCOURS-1,
  création combinée), donc ces refus ne devraient jamais se voir sur une ligne née après ce
  ticket. Ils restent utiles pour les lignes grand-père (avant `intervention_planifiee_a_sa_duree`,
  PG-A4) et pour toute ligne manipulée hors écran.

### Pour PG-G14B et PG-G14C (le pilote les écrira)

- **`listerPlanning`** (`lib/interventions/depot.ts`) ne filtre par statut que via
  `filtreStatutAnnulee` — rien n'exclut `planifiee` aujourd'hui ; PG-G14C y ajoutera
  vraisemblablement un filtre explicite, ou une vue dédiée au terrain qui l'exclut déjà en amont
  (`app/(mobile)/terrain/**`, hors territoire de ce ticket).
- **`lireFicheIntervention`** ne distingue pas Planifiée/Affectée pour ce qu'elle rend au terrain
  — c'est `app/(mobile)/terrain/[id]/page.tsx` et la liste `/terrain` qui décideraient de
  masquer, jamais ce dépôt.
- **`bon.ts`** (`lib/interventions/bon.ts`) n'a pas été regardé en détail : `peutGenererLeBon` ne
  couvre que `terminee`/`cloturee`, sans rapport apparent avec Planifiée/Affectée — probablement
  hors sujet pour PG-G14C, à vérifier quand même.
- **`resume/route.ts`** (le tiroir) lit déjà `statut` BRUT — PG-G14C n'aura qu'à l'utiliser pour
  masquer le bouton « Transmettre » si la ligne n'est plus censée apparaître au terrain (ou
  l'inverse, selon la décision retenue).
- **Fixtures terrain `planifiee`** : `tests/e2e/setup/scene.ts:405` et
  `tests/isolation/setup/global.ts:655` posent des interventions terrain avec le statut
  `planifiee` — si PG-G14C change ce que le terrain voit, ces fixtures (et tout ce qui en
  dépend) devront probablement passer à `affectee`, avec toutes les épreuves qui s'y accrochent
  à revoir.
- **Pas de bouton de masse construit** (« Transmettre toutes les planifiées prêtes », par
  société) — PG-G14B, décision du 02/10/2026.

## Ce qui reste à faire

- PG-G14B : « Transmettre demain (n) », bouton de masse par société, récapitulatif par
  technicien (un seul courriel pour plusieurs interventions transmises d'un coup).
- PG-G14C : retirer les Planifiées de ce que `/terrain` montre, avec tout ce que ça implique
  pour `listerPlanning`, les fixtures et les épreuves citées ci-dessus.
- Réévaluer si les captures AVANT/APRÈS de ce ticket devraient être refaites par `git worktree`
  (code avant/après plutôt que geste avant/après) si la convention du dépôt l'exige strictement
  — voir « ce que j'ai tranché ».
