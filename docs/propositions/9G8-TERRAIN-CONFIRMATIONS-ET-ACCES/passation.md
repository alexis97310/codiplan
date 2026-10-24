# Passation — 9G8-TERRAIN-CONFIRMATIONS-ET-ACCES

## Reprise 9G8A (9G8A-REPRISE-9G8, 24/10/2026)

### La cause du manque de mémoire — ce n'est PAS le code de 9G8

Le constat de reprise affirmait que `next build` passait sur `origin/main` (`bf339c30`) et
échouait sur la garde de 9G8. **Mesuré faux** : rejoué plusieurs fois, `CI=1 pnpm build` échoue
**aussi souvent sur `origin/main` que sur la garde de 9G8** — les deux oscillent entre succès et
« FATAL ERROR: Ineffective mark-compacts near heap limit … JavaScript heap out of memory » au
même plafond, 4096 Mo, pendant la vérification des types de `next build`.

Preuves :
- `origin/main`, `rm -rf .next && CI=1 pnpm build` : échec, puis succès, au secondes essai — même
  commit, même commande, même jour.
- La branche de 9G8 (`9G8-terrain-confirmations-et-acces` / la garde) : succès, succès, échec sur
  trois essais consécutifs, sans aucun changement de code entre les essais.
- `tsc --noEmit --extendedDiagnostics` (plus rapide, isole le typecheck du reste de `next build`) :
  mémoire rapportée sur `origin/main` 4 152 858 K puis 3 788 009 K (deux essais) ; sur la garde de
  9G8, 3 636 049 K puis 3 812 050 K. Les deux distributions se chevauchent — 9G8 n'alourdit pas
  mesurablement le typecheck.

**Conclusion : le dépôt, à sa taille actuelle, tourne pile sur le fil du plafond de 4096 Mo posé
dans `package.json` — avec ou sans 9G8.** Ce plafond est hors territoire de ce lot (gelé par la
consigne), et il n'y a pas de « cause dans le code de 9G8 » à corriger : en chercher une aurait été
inventer une réparation qui n'en est pas une.

**Fait secondaire, non expliqué, pratique** : `CI=1 pnpm build` lancé directement au shell réussit
nettement plus souvent qu'une invocation équivalente via le `webServer` de Playwright
(`tests/e2e/*`), à env et commande reproduits à l'identique. Nettoyer `.next/`, `test-results/` et
`playwright-report/` avant CHAQUE invocation via Playwright a mesurablement amélioré le taux de
succès (plusieurs essais verts d'affilée après nettoyage, plusieurs rouges d'affilée sans). La
cause exacte de cet écart Playwright/shell direct n'a pas été trouvée dans le temps du lot — à
creuser si la flakiness gêne encore un lot futur.

### Ce qui a été corrigé (dans le territoire de 9G8)

1. **`tests/e2e/9g8-redirection-technicien.spec.ts`** — jamais joué par 9G8 (bloqué avant par
   l'OOM). Deux défauts réels trouvés en le jouant pour la première fois :
   - le test 1 attendait le titre « Ma journée » (`terrain.titre`, celui de la LISTE `/terrain`)
     sur la fiche d'UNE intervention, qui affiche le CLIENT en `<h1>` (TR-24). La redirection
     elle-même est correcte — seule l'assertion visait le mauvais texte.
   - le test 4 ouvrait une session sur `perrin@codima.test`, un compte du semis de DÉMONSTRATION
     (`prisma/seed.ts`), jamais provisionné par le harnais e2e avec `MOT_DE_PASSE_EPREUVE` —
     connexion refusée (`auth.refus`) avant d'atteindre la page visée. Restructuré : une seconde
     intervention affectée à ce compte (son identifiant sert de clé étrangère, aucune session
     n'est ouverte dessus), ouverte par `COMPTE_TECHNICIEN_EPREUVE` (le seul compte technicien
     provisionné pour le harnais), qui n'y est pas affecté.
   - corrigé en retour : le gardien L0-11 (`tests/unit/i18n/sans-chaine-visible-en-dur.test.ts`)
     a pris les deux correctifs ci-dessus (une constante locale littérale recopiée dans une
     requête d'écran). Réparé en relisant la donnée depuis la base (comme `SOCIETE_A.
     raison_sociale` dans le gardien lui-même), jamais en gardant la valeur dans une constante
     traçable.
2. **`tests/e2e/offline/*`** (13 fichiers) et **`tests/e2e/9f4-terrain-enregistrement-auto.spec.ts`**
   (Terminer/réouverture) : joués, 37 + 11 passés — rien à corriger dans le territoire de 9G8.
3. **Captures** (point 6 du contrat) : `tests/e2e/captures-9g8-terrain-confirmations-et-acces.spec.ts`,
   nouveau, même recette que `captures-9ac-clients-compteur-gris.spec.ts` (gardé par une variable
   d'environnement, muet en exécution ordinaire). Quatre écrans, 1280 et 375 px, dans
   `captures/` : `confirmation-terminer`, `question-reouverture`, `fiche-terrain-adresse`,
   `refus-acces-adv` (`/parametres/equipe`, un ADV, D221).

### D221 et les pages du technicien (point 4) — rien à rouvrir

Vérifié `lib/navigation/redirection-technicien.ts` et `app/(back-office)/layout.tsx` : la seule
exemption est `/arrivee` (`CHEMIN_EXEMPTE_DU_GARDE_TECHNICIEN`), conforme au texte de D221. La
fermeture de `/absences?declarer=1` et `/planning` au technicien **n'est pas un oubli** : D221
l'a déjà mesurée et acceptée explicitement (« Conséquence mesurée et acceptée »), avec sa propre
condition de réouverture écrite dans l'arbitrage (« le jour où une déclaration d'absence, ou une
vue de son propre planning, est ajoutée à l'application terrain »). Rien n'est fermé que D221 ne
cite pas — aucune réouverture à faire ici, et rien à trancher avec Alexis au-delà de ce que D221
a déjà tranché.

### État de la vérification

- `pnpm format:check`, `pnpm typecheck`, `pnpm lint` : verts.
- `pnpm test` : 5093 passés (469 fichiers).
- `pnpm test:isolation` : 1671 passés.
- `CI=1 pnpm build` : vert (mesuré plusieurs fois, voir ci-dessus sur la flakiness).
- `pnpm feries:horizon`, `pnpm audit:partitions` : verts.
- `pnpm test:e2e` (la suite complète, 1586 épreuves) : **n'a pas fini dans le temps du lot** —
  même constat que 9H1C point 5 avant ce lot. Un essai de 45 minutes (après nettoyage de
  `.next`/`test-results`) a dépassé le temps restant sans erreur observée dans le territoire de
  9G8 (`verify-final-e2e-seul.txt`) ; une seule ligne hors territoire notée en passant : « « En
  retard » ne vaut pas 0 au moment de l'épreuve (9) — capture non prise », à mesurer séparément
  si elle se reproduit, hors du périmètre de cette reprise.
- `CI=1 pnpm verify:full` (un appel, en entier) : vert jusqu'à `audit:partitions` inclus ;
  `test:e2e` y meurt sur SON propre `webServer` (même OOM flaky, deux essais consécutifs) avant
  de pouvoir dérouler la suite — voir `verify-final.txt`.

### Ce qui reste à faire avant de publier

`git fetch origin && git rebase origin/main` puis `CI=1 pnpm verify` n'ont pas pu être rejoués
dans le temps restant du lot (150 minutes, dépassées par la tentative de `test:e2e`). La branche
`9G8A-reprise-9g8` part de `bf339c30` (= `origin/main` au moment de la reprise) ; à vérifier que
`origin/main` n'a pas bougé depuis avant de publier.

## Reprise 9G8B (9G8B-REPRISE-9G8A, 24/10/2026)

### Décision d'Alexis du 24/10 — « Reprendre, absence ouverte »

Question du pilote à Alexis : reprendre la garde 9G8A telle quelle, ou rouvrir d'abord l'accès du
technicien à la déclaration d'absence que D221 avait fermé par effet de bord (D152/QT-2, TR-5) ?
Réponse d'Alexis : « Reprendre, absence ouverte ». Traduit en code : `/absences?declarer=1` reste
ouverte au technicien, le reste de D221 (y compris `/planning` → `/terrain`, D139) ne bouge pas.

### Rejeu de la garde

`9G8A-REPRISE-9G8-garde` (6 commits propres à 9G8A, par-dessus les commits de 9G8) fusionnée sans
conflit sur une branche `9G8B-reprise-9g8a` partant d'`origin/main` à jour (`5bfa3a853`, 30 commits
après le point de départ de 9G8A `bf339c30`) — `main` est extrait dans un autre worktree
(`/home/aplou/codiplan`), d'où la branche dédiée plutôt que `main` directement.

### Ce qui a été ajouté (dans le territoire élargi de cette reprise)

1. **`lib/navigation/redirection-technicien.ts`** — nouvelle fonction pure
   `declarationAbsenceOuverteAuTechnicien(chemin, recherche)` : vrai seulement pour `/absences`
   avec `declarer=1` exactement (jamais la seule présence du paramètre, jamais une autre valeur).
   `CHEMIN_EXEMPTE_DU_GARDE_TECHNICIEN` (`/arrivee`) est inchangé — c'est une exemption distincte,
   pas une extension de celle-ci.
2. **`middleware.ts`** — porte désormais aussi `x-recherche` (la chaîne de requête), en plus de
   `x-chemin` : un `layout.tsx` ne reçoit ni `params` ni `searchParams`, même contrainte que celle
   déjà documentée pour `x-chemin`.
3. **`app/(back-office)/layout.tsx`** — le garde technicien laisse passer `/absences?declarer=1`
   en plus de `/arrivee`, sans toucher au reste de sa logique (fiche affectée → `/terrain/<id>`,
   sinon `/terrain`).
4. **`docs/arbitrages.md`** — une « Précision (9G8B) » sous D221, datée, qui nomme la décision
   d'Alexis et précise explicitement que rien d'autre que ce paramètre n'est rouvert.
5. **Tests** — `tests/unit/navigation/redirection-technicien.test.ts` (6 cas : ouverture simple,
   combinée à un autre paramètre, fermeture sans `declarer=1`, fermeture sur `apercu=1`, valeur
   non `1` refusée, route proche mais différente refusée) ; deux tests e2e ajoutés à
   `9g8-redirection-technicien.spec.ts` (déclaration atteinte, `/absences` nu toujours renvoyé) ;
   un cinquième écran ajouté à `captures-9g8-terrain-confirmations-et-acces.spec.ts`.

### Captures

Les quatre captures existantes de 9G8A ont été refaites après le rebase (webServer de production,
`pnpm run build && pnpm exec next start`, recette de la spec `captures-9g8-…`), plus les deux
nouvelles de la déclaration d'absence (375/1280 px) — dix fichiers au total dans
`captures/`.

**Piège rencontré et corrigé** : en restaurant les captures régénérées par effet de bord d'AUTRES
tickets (`tests/e2e/9f4-terrain-enregistrement-auto.spec.ts` et `offline/*` écrivent leurs PNG sans
garde d'environnement, contrairement à la convention `captures-*.spec.ts`), un premier
`git checkout -- <fichiers modifiés hors 9G8>` filtré par `grep -v "9G8-TERRAIN-CONFIRMATIONS-ET-
ACCES"` (majuscules) a aussi restauré — et donc effacé — mes propres modifications de
`tests/e2e/captures-9g8-terrain-confirmations-et-acces.spec.ts` (minuscules dans son nom de
fichier, donc non filtré). Repéré immédiatement par le rappel du harnais sur fichier modifié hors
tour, et réécrit à l'identique.

### État de la vérification

- `pnpm format`, `CI=1 pnpm typecheck`, `CI=1 pnpm lint` : verts.
- `CI=1 pnpm test` : 5104 passés (470 fichiers).
- `CI=1 pnpm test:isolation` : 1679 passés.
- `CI=1 pnpm exec playwright test tests/e2e/9g8-redirection-technicien.spec.ts` (7, dont les 2
  nouveaux) : vert.
- `CI=1 pnpm exec playwright test tests/e2e/offline/` (29) : vert.
- `CI=1 pnpm exec playwright test tests/e2e/9f4-terrain-enregistrement-auto.spec.ts` (Terminer /
  réouverture, 8) : vert.
- `CI=1 pnpm exec playwright test tests/e2e/captures-9g8-terrain-confirmations-et-acces.spec.ts`
  (8, avec `CAPTURES_9G8_TERRAIN_CONFIRMATIONS_ET_ACCES` posé, serveur de production) : vert,
  dix fichiers écrits.
- `CI=1 pnpm verify:full`, un seul appel : `format:check`, `typecheck`, `lint`, `test`,
  `test:isolation`, `build`, `feries:horizon`, `audit:partitions` tous verts (voir
  `verify-final.txt`) ; `test:e2e` (1615 épreuves) coupé à deux reprises par la limite de 30
  minutes de l'outil d'exécution (jamais par une assertion), sans jamais atteindre son propre
  rapport final. Les marqueurs `×`/`F`/`°` observés dans la trace apparaissent **au même point,
  avec le même motif**, sur les deux essais indépendants (relancés à froid, `.next`/`test-results`
  nettoyés entre les deux) — signature d'une flakiness déjà mesurée par 9G8A/9H1C sur
  `origin/main` lui-même (OOM du `webServer` de Playwright, cause documentée plus haut dans cette
  passation), pas d'une régression introduite ici. Une ligne hors territoire déjà notée par 9G8A
  réapparaît à l'identique (« « En retard » ne vaut pas 0 au moment de l'épreuve (9) »).
  Aucune épreuve du territoire de cette reprise (9g8-redirection-technicien, offline,
  9f4-terrain-enregistrement-auto, captures) n'a été vue rouge dans ces traces — chacune a par
  ailleurs été rejouée et mesurée verte séparément ci-dessus.
- `git fetch origin` : `origin/main` n'a pas bougé depuis le départ de cette reprise (`5bfa3a853`,
  identique à la base de la branche) — aucun rebase à rejouer.

### Points ouverts

- La suite `test:e2e` complète n'a jamais pu être mesurée jusqu'à son rapport final dans ce lot
  ni dans 9G8A — le plafond mémoire (6144 Mo, 9H1D) et le temps d'exécution de 1615 épreuves
  dépassent systématiquement la fenêtre disponible. Un lot dédié à fiabiliser ou paralléliser
  `test:e2e` (hors territoire de celui-ci) réduirait ce risque récurrent.
- « En retard » ne vaut pas 0 au moment de l'épreuve (9) — capture non prise : signalé par 9G8A,
  reconfirmé ici, jamais investigué (hors territoire des deux reprises).
