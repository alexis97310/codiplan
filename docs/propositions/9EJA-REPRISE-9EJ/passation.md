# 9EJA-REPRISE-9EJ — passation

Reprise de 9EJ-CORRECTIFS-AUDIT-TUILES-ID après le conflit au rebase provoqué par la
publication de 9DLA-REPRISE-9DL (`5389b9ec`, statut de ressource du technicien, D163) à
22:08 pendant que la vérification indépendante de 9EJ (21:54–22:49) était en cours.

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

Rien de nouveau : cette session rejoue le contenu déjà décrit par
`docs/propositions/9EJ-CORRECTIFS-AUDIT-TUILES-ID/passation.md` (la tuile cliquable en
bloc dans `components/ui/kpi.tsx`, et la garde `estUuid` devant sept fiches `[id]` du
back-office) sur un `main` qui contient désormais aussi 9DL. Pour l'exploitation : les
mêmes effets que décrits là-bas, maintenant disponibles sur un `main` à jour.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- `git fetch origin` : `origin/main` à `5389b9ec` (9DLA-REPRISE-9DL), contenant bien 9DL
  (`69ed4261`) et toute la chaîne antérieure. La branche `9EJ-CORRECTIFS-AUDIT-TUILES-ID-garde`
  existait, avec ses trois commits au-dessus de `eb17c838` (base de départ de la session
  9EJ d'origine) :
  - `a1419f13` — partie A : la tuile cliquable en bloc
  - `f41d4e07` — partie B : identifiant mal formé = introuvable
  - `71296a25` — captures AVANT/APRÈS et passation
- Travail repris depuis la branche locale `main-work` (déjà à `origin/main`, `5389b9ec`,
  identique au `HEAD` détaché constaté à l'ouverture de session) ; les trois commits de la
  garde ont été rejoués par `git cherry-pick`, un par un, dans l'ordre chronologique.
  **Les trois se sont appliqués SANS AUCUN CONFLIT** : 9DL ne touche ni
  `components/ui/kpi.tsx`, ni aucune des sept pages `[id]` corrigées par la partie B, ni
  `lib/identifiant.ts` ; son seul changement partagé avec le territoire de 9EJ
  (`lib/i18n/fr.ts`, une ligne) ne chevauche aucune ligne modifiée par 9EJ.
- `git status --porcelain` vide avant toute vérification.
- `CI=1 pnpm verify:full`, tenté en un seul appel au premier plan : coupé deux fois à 30
  minutes par l'outil (le processus playwright reçoit un SIGTERM, ce n'est pas un échec de
  test — pas de ligne `FAIL`, pas de test rouge, juste la trace `ELIFECYCLE Command failed`
  propre à l'interruption). `format:check`, `typecheck`, `lint`, `test` (unitaire),
  `test:isolation`, `build`, `feries:horizon` et `audit:partitions` s'étaient tous terminés
  en vert AVANT la coupure, à chaque tentative — confirmé en relisant les deux journaux
  ligne à ligne, aucune erreur ni avertissement avant le début de `test:e2e`.
  `test:e2e` seul, rejoué sans découpage, a de nouveau été coupé à 30 minutes par l'outil,
  en plein milieu des 942 épreuves (serveur CI à 1 worker, comme prévu par
  `playwright.config.ts` ligne 79 — aucune modification apportée à ce réglage).
  Troisième et quatrième passes : `test:e2e` rejoué en quatre tranches (`--shard=1/4` à
  `4/4`, option native de Playwright, sans toucher `workers`/`retries`/`fullyParallel`),
  chacune sous 30 minutes, **toutes vertes** :
  - 1/4 : 234 passées, 2 sautées (préexistantes) — 9,8 min
  - 2/4 : 234 passées, 2 sautées (préexistantes) — 9,2 min
  - 3/4 : 237 passées, 0 sautée — 11,0 min
  - 4/4 : 230 passées, 3 sautées (préexistantes) — 10,2 min
  - Total : **935 passées, 7 sautées, 0 échec, sur 942** (la base de 9EJ d'origine comptait
    940 épreuves ; les 2 de plus viennent de 9DL, désormais sur `main`). Fin de la dernière
    tranche à 14:05 UTC / 01:05 heure de Nouméa (UTC+11) le 06/10/2026.
- Après chaque tranche de `test:e2e`, `git status --porcelain` listait des dizaines de
  captures PNG/PDF modifiées ou neuves, toutes étrangères à ce lot (`47-AVERTISSEMENTS-1`,
  `48-FICHE-360-1`, `9DF-TP-CY2-MATRICE-D8`, etc. — effet de bord connu de certains
  `tests/e2e/captures-*.spec.ts` qui écrivent sans variable d'environnement de garde).
  Aucune ne portait sur `docs/propositions/9EJ-CORRECTIFS-AUDIT-TUILES-ID/`. Toutes
  restaurées (`git checkout --` sur les modifiées) ou supprimées (`git clean -fd` restreint
  à `docs/propositions/`) avant tout commit — rien de tout cela n'a été committé.
- Les captures AVANT/APRÈS propres à 9EJ ont été conservées sans régénération : aucun code
  n'a changé entre la garde et ce rejeu (rejeu identique, zéro conflit), donc aucun écran
  n'a bougé.

## Ce que j'ai tranché et pourquoi

- **Découper `test:e2e` en quatre tranches (`--shard=N/4`)** plutôt que relancer la suite
  entière à chaque tentative : la suite tourne à 1 worker sous `CI=1` (réglage existant de
  `playwright.config.ts`, non modifié) et dépasse 30 minutes en continu ; la sharder est une
  option native de Playwright, orthogonale à `workers`/`retries`/`fullyParallel` (aucun des
  trois n'a été touché) et chaque tranche relance son propre `globalSetup` (migration +
  semis), sans dépendre d'un état laissé par la tranche précédente — cohérent avec la règle
  du lot (« chaque épreuve ne compte que ce qu'elle a forgé elle-même »).
- **Les deux coupures à 30 minutes ne sont pas comptées comme les « deux rouges » de la
  règle d'arrêt** : aucune épreuve n'a échoué, le processus a été interrompu par l'outil
  avant qu'un verdict existe. La règle « deux rouges et tu t'arrêtes » vise une épreuve qui
  échoue deux fois avec le même verdict, pas une coupure externe sans verdict.
- Les six dossiers/fichiers listés par la consigne (code de 9DL, garde `estUuid`/`block`,
  `fr.ts`, gardiens, `porte.test.ts`, territoire `parametres/agences/**`) n'ont donné lieu à
  **aucune résolution de conflit** : les trois cherry-picks se sont appliqués directement.
  Rien à trancher sur le sens d'une décision.

## Ce que je n'ai PAS fait

- Aucune fonctionnalité nouvelle, aucune migration, aucun prix, aucune ligne de semis.
- `app/(back-office)/parametres/agences/**` non touché — territoire 9DQ, hors de ce lot.
- Aucune des captures étrangères régénérées par `verify:full` n'a été committée.
- Pas de régénération des captures AVANT/APRÈS de 9EJ : aucun écran n'a bougé.

## Les pièges pour la session suivante

- **`pnpm test:e2e -- --shard=N/4` ne fonctionne PAS** : le `--` littéral se retrouve dans
  la commande transmise à Playwright (`playwright test -- --shard=1/4`), qui l'interprète
  comme fin d'arguments et ne trouve aucun fichier. Appeler `pnpm test:e2e --shard=N/4`
  SANS le `--` — pnpm transmet alors l'argument correctement.
- Sous `CI=1`, `pnpm verify:full`/`pnpm test:e2e` dépasse systématiquement 30 minutes dans
  cet environnement (942 épreuves à 1 worker, ~40 minutes au total) : prévoir d'emblée le
  découpage en tranches plutôt que de perdre deux tentatives à relancer la suite entière.
- `git status --porcelain` après CHAQUE tranche de `test:e2e` : des captures étrangères à
  ce lot réapparaissent à chaque exécution, à restaurer avant tout commit.

## Ce qui reste à faire

- Rien dans le territoire de ce lot. `parametres/agences/[id]` reste sans garde
  d'identifiant — territoire du lot 9DQ, à traiter quand ce lot sera rejoué sur `main`.
