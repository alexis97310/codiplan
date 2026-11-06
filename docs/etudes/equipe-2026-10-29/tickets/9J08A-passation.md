# 9J08A-REPRISE-9J08 — passation

Budget : T0 11:49 (Pacific/Noumea), limite 130 min.

## Point par point

1. **Composition partagée** (`lib/interventions/bon.ts`) — `lireBonIntervention` (back-office) délègue
   désormais à `composerBon`, une fonction privée paramétrée par la restriction supplémentaire à appliquer
   sur `intervention` : `restrictionParPersonne(contexte)` pour le back-office (inchangé bit pour bit), `{}`
   pour le portail. `lireBonDuParc`, nouvelle, l'appelle avec `{}` — la seule porte devient alors la politique
   RLS « parc » (D84), exactement comme `ficheInterventionDuParc`/`interventionsDuParc`. Rien d'autre ne change
   dans la composition : zéro recopie de la mise en forme.

2. **La condition de clôture, propre au PORTAIL** (`app/(portail)/portail/interventions/depot.ts`,
   `bonInterventionDuParc`) — rend `{ etat: "introuvable" }` (D35, D50, jamais nommé), `{ etat:
   "non_cloturee" }` (nommé, clé `portail.interventions.bon.refus_non_cloturee`) ou `{ etat: "disponible", bon
   }`. Le back-office n'est PAS concerné : `peutGenererLeBon` continue d'autoriser `terminee` ET `cloturee`,
   inchangé. La décision du pilote (voir le ticket) est appliquée telle qu'écrite : le portail attend un
   palier de plus que le back-office, parce qu'un rapport `terminee` peut encore être renvoyé au technicien
   (M5) et qu'un bon déjà vu par le client deviendrait obsolète si le renvoi en changeait le contenu.

3. **Lecture portail dédiée** — `bonInterventionDuParc` ci-dessus EST cette lecture : elle appelle
   `lireBonDuParc` (forme « parc » seule), vérifie `cloturee_le`, et ne relaie jamais aucun paramètre `version`
   (elle n'en reçoit même pas). Deux champs composés restent structurellement VIDES sous le contexte portail,
   **par des politiques RLS déjà en vigueur, non touchées par ce ticket** :
   - `segments` est toujours `[]` — `segment_travail` ferme sa lecture à `app.client_id IS NULL` (D94, forme
     « interne »), et un contexte portail porte toujours un `client_id`.
   - Le technicien affecté se résout toujours en `null`/« — » — `utilisateur` ferme sa branche de
     « rattachement » au même discriminant (décision d'exploitation du 07/09/2026 : *« un compte portail n'a
     rien à connaître du personnel de la société »*).

   Ni l'une ni l'autre n'est un défaut à corriger ici — les corriger toucherait une politique RLS, point
   d'arrêt explicite du ticket. La page omet donc simplement le tableau des segments et le nom du technicien
   plutôt que d'afficher un champ structurellement toujours vide ou toujours « — ».

4. **Route et écran** — `app/(portail)/portail/interventions/[id]/bon/page.tsx` (+ `presentation.ts` pour les
   formats de date et les phrases de signature, propres à cette page, non partagés avec le back-office — ce
   sont des phrases d'affichage, pas une règle de gestion recopiée). Aucun paramètre de requête n'est jamais lu
   : la page ne déclare même pas `searchParams`. Aucun montant n'est jamais composé à l'écran — ni
   `formatMoney`, ni `accesAuxMontants`, ni `versionDuBon`, ni la tuile de valorisation : un gardien statique
   (`tests/unit/portail/bon-sans-montant.test.ts`) le tient, avec un témoin qui mord sur le bon back-office.
   Lien ajouté sur la fiche portail (`[id]/page.tsx`), visible seulement si `fiche.statut === "cloturee"`.

5. **Épreuves** :
   - Unitaire (`tests/unit/portail/bon-sans-montant.test.ts`) — **exécutée, verte** (3 tests).
   - Isolation (`tests/isolation/9j08a-portail-bon.test.ts`) — **écrite, NON EXÉCUTÉE dans cette session**
     (consigne du pilote du 05/11, en tête du ticket : « ne lance JAMAIS … `test:isolation` »). Couvre : lecture
     du bon d'une intervention jetable clôturée du client A1 ; refus nommé `non_cloturee` sur la même
     intervention seulement `terminee` ; introuvable pour un autre client de la même société (même sur une
     intervention clôturée — jamais le motif de clôture ne fuite un périmètre) ; introuvable pour une
     intervention d'une autre société, avec témoin que la ligne existe. À faire rejouer par la file.
   - Épreuves du bon back-office : **non rejouées par une commande** (test:isolation bloqué, voir plus haut) —
     mais `lireBonIntervention` n'a subi AUCUN changement de comportement (point 1), et `pnpm test` (unitaire)
     est vert sur l'ensemble du dépôt, y compris `tests/unit/interventions/bon-3.test.ts`,
     `profil-bon.test.ts`, `version-bon.test.ts`.

6. **Captures** — **NON FAITES**. Le ticket les demande via Playwright (`tests/e2e/`), et le rappel du pilote
   interdit explicitement de lancer `test:e2e` dans cette session. Contradiction signalée plutôt que résolue en
   silence : à faire par la file ou une session autorisée à lancer l'e2e.

## Portes de sortie jouées dans cette session

`pnpm format` / `pnpm format:check` : vert. `pnpm typecheck` : vert. `pnpm lint` (`--max-warnings 0`) : vert.
`pnpm test` (unitaire, `--project unit`) : **503 fichiers, 5522 tests, vert**. `pnpm build` : vert (les deux
routes `/interventions/[id]/bon` et `/portail/interventions/[id]/bon` sont bien générées).

**NON JOUÉ** : `pnpm test:isolation`, `pnpm test:e2e`, `pnpm verify`, `pnpm verify:full` — les quatre chaînent
ou sont l'une des commandes nommées par le rappel du pilote (« ne lance JAMAIS `verify:full`, `test:e2e`,
`test:isolation` »). `pnpm verify` chaîne `test:isolation` (voir `package.json`) et n'a donc pas été lancé non
plus ; ses autres étapes (format:check, typecheck, lint, test, build) ont été jouées une à une ci-dessus et
sont toutes vertes. **La file doit rejouer `pnpm test:isolation` puis `CI=1 pnpm verify:full`** avant de
considérer ce lot livré.

## Arbre

`git fetch origin` : `origin/main` est inchangé depuis le départ de cette session (`0a163f73a`), pas de
rebase nécessaire. Deux commits ajoutés par-dessus. Arbre propre après ce commit. Aucun push.
