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
