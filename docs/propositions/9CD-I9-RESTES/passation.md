# 9CD-I9-RESTES — passation

## Ce que j'ai changé, et ce que ça change pour l'exploitation

`9BY-TP-I9-NOMS-REELS` (commit `e0f545a2`) a renommé les quatre techniciens
de la scène de démonstration mais a laissé, hors de son Territoire, trois
tests non modifiés (patronyme ou toponyme réel employés comme simple chaîne
de test, sans lien avec la scène) et une ligne de sa propre passation qui se
contredisait elle-même. Ce ticket les finit, sans toucher à la logique ni au
semis :

- `tests/unit/techniciens/tri.test.ts:29` et `:36` — le patronyme de la
  fixture (préfixée `TPA6-`, lot `9BX-TP-A6-TRIS-MISE-EN-PAGE`) devient celui
  que la table de `9BY` donne à la même ligne (agence Dolbeau). Le prénom
  fictif de la fixture, les deux autres lignes, les identifiants et l'ordre
  attendu sont inchangés.
- `tests/unit/agences/tri-reglages.test.ts:20` et `:25` — le toponyme réel de
  la fixture devient « Anse Fictive », le remplacement déjà employé ailleurs
  par `9BY` pour ce même toponyme (`lib/sites/depot.ts`,
  `lib/tri/collation.ts`, `tests/unit/tri/collation.test.ts`). L'ordre
  attendu est inchangé.
- `tests/unit/ui/lot-a2.test.ts:125` — la `preuve` du bloc
  `nom-technicien-agence` citait littéralement un nom depuis la maquette
  (source de rang 1, non modifiable par ce ticket). Elle cite désormais le
  fragment de `weekPlan()` qui PRÉCÈDE le nom (`techs.map(t=>`… jusqu'à
  `<small>${t===`), propre à `weekPlan()`, sans aucun nom. Le `nom` du bloc,
  les dix autres blocs et le décompte (`:141-151`) sont inchangés.
- `docs/propositions/9BY-TP-I9-NOMS-REELS/passation.md:119` — l'exemple
  d'ancien courriel (`guerin@codima.test`) devient `<patronyme>@codima.test`
  : la ligne se contredisait avec `:44-47` de la même passation, qui
  s'interdit d'écrire les anciens patronymes.

Pour l'exploitation : rien ne change pour un utilisateur réel — ce sont des
fixtures de test et un exemple de documentation.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- **Chaque test modifié prouve qu'il mord**, par la méthode de `9BY` :
  - `tri.test.ts` : attente inversée (`"TPA6-Étienne Weber"` avant
    `"TPA6-alain Tein"`) → rouge (`AssertionError`, diff affichant les deux
    valeurs interverties) → attente remise → vert.
  - `tri-reglages.test.ts` : même méthode (`"TPA6-dolbeau"` avant
    `"TPA6-Anse Fictive"`) → rouge → remis → vert.
  - `lot-a2.test.ts` : un caractère altéré dans la nouvelle `preuve`
    (`"plan-cell tech"` → `"plan-cell TECH"`) → rouge (`toContain` échoue,
    le test affiche `FONCTION_PLANNING` en entier) → remis → vert.
- **Le nouveau fragment de `lot-a2.test.ts` est propre à `weekPlan()`** :
  mesuré par un `node -e` jetable (jamais commité) sur
  `FONCTION_PLANNING` (de `function planning(){` à
  `function interventions(){`, comme le gardien lui-même l'extrait) :
  - AVANT : `'<small>${t==="P. Poigoune"?"Koné · brousse":"Ducos · SAV"}</small>'`
    → 1 occurrence.
  - APRÈS : `'${techs.map(t=>`<div class="plan-cell tech"><b>${t}</b><small>${t==='`
    → 1 occurrence, ne contient aucun nom (vérifié par une expression
    régulière sur les quatre patronymes). `dayPlan()` écrit
    `.map((t,n)=>` au lieu de `techs.map(t=>` : le fragment ne s'y trouve
    pas, donc il désigne bien `weekPlan()` seul.
  - La maquette (`docs/maquette/codiplan-maquette-complete.html`) n'a pas été
    modifiée — lecture seule, vérifié par `git status` avant chaque commit.
- **Mesure finale d'exhaustivité**, méthode `9BY` : fichier de motifs hors
  dépôt (`/tmp/motifs-tpi9-restes.txt`, jamais commité, supprimé après
  chaque usage), motifs dérivés de la table de correspondance du message de
  commit `e0f545a2` (les quatre anciens patronymes, formes accentuées et non
  accentuées) ; `git grep -inP -f <motifs>` sur tout le dépôt hors `.git`.
  - **Hors `prisma/seed-data.ts`** (`ancien_email`, 4 occurrences, VOULUES
    par `9BY` — inchangées par ce ticket) : **84 occurrences dans 32
    fichiers, ZÉRO hors `docs/`** — donc zéro dans `app/`, `lib/`,
    `components/`, `scripts/`, `prisma/` (hors `ancien_email`), `tests/`.
    Le détail par fichier (patronymes uniquement, jamais le nom) :

    | Fichier | Lignes | N |
    |---|---|---|
    | `docs/maquette/CODIPLAN_Maquette.html` | 203,204,205,206,216,275,284,293,302,347,353,394,395,396,397,398,399,400,401,479,639,841 | 22 |
    | `docs/maquette/codiplan-maquette-complete.html` | 81,82,83,84,85,86,91,94,95,98,103,104 | 12 |
    | `docs/propositions/planning-gmao/maquette-planning-gmao.html` | 299,300,302,360 | 4 |
    | `docs/propositions/planning-1/mesure.json` | 14,15,16,17 | 4 |
    | `docs/propositions/99G-PLANNING-JOUR/passation.md` | 25,72,78,102 | 4 |
    | `docs/propositions/planning-1/README.md` | 13,101,110 | 3 |
    | `docs/propositions/PG-A2-ORDRE-TECHNICIENS/captures/README.md` | 13,16,17 | 3 |
    | `docs/propositions/9BB-PG-G1-DOCS-FERIES-ORDRE/passation.md` | 61,62,63 | 3 |
    | `docs/propositions/fiche-1/README.md` | 100,112 | 2 |
    | `docs/propositions/PG-B2-FENETRE-POSE/captures/README.md` | 11,18 | 2 |
    | `docs/propositions/99M-REPRISE-99G/passation.md` | 45,67 | 2 |
    | `docs/propositions/99A-ARRIVEE/passation.md` | 48,69 | 2 |
    | `docs/backlog.md` | 1351,1352 | 2 |
    | `docs/registres/2026-09-11-file-de-nuit.md` | 180 | 1 |
    | `docs/propositions/fiche-1/mesure.json` | 13 | 1 |
    | `docs/propositions/PG-C4-CHARGE/captures/README.md` | 20 | 1 |
    | `docs/propositions/PG-B5-ANNULER-DEPLACEMENT/captures/README.md` | 18 | 1 |
    | `docs/propositions/PG-B4-SURVOL-CASES/captures/README.md` | 11 | 1 |
    | `docs/propositions/PG-A8-ANNULEES-MASQUEES/captures/README.md` | 6 | 1 |
    | `docs/propositions/ERGO-PRISE-DE-VUE/passation.md` | 164 | 1 |
    | `docs/propositions/9BO-TP-UX0-DOCS/passation.md` | 31 | 1 |
    | `docs/propositions/9BC-PG-G2-POSE-LIBELLES/passation.md` | 138 | 1 |
    | `docs/propositions/9AF-GR14-CHARGE-PLANNING/passation.md` | 60 | 1 |
    | `docs/propositions/9AE-GR14-DUREE-UNIQUE/passation.md` | 48 | 1 |
    | `docs/propositions/99J-PLANNING-GLISSER/passation.md` | 53 | 1 |
    | `docs/propositions/76-BON-4/passation.md` | 75 | 1 |
    | `docs/propositions/57-REGISTRE-2/passation.md` | 93 | 1 |
    | `docs/propositions/37-AFFICHAGE-MATERIEL-1/passation.md` | 63 | 1 |
    | `docs/propositions/29-DROITS-1/passation.md` | 76 | 1 |
    | `docs/audit-ergonomie-2026-09-26.md` | 115 | 1 |
    | `docs/audit-2026-09-26-captures/mobile.md` | 121 | 1 |
    | `docs/arbitrages.md` | 3167 | 1 |

    **Cette liste diffère de la « liste C » du ticket** (qui comptait 20
    fichiers pour les passations/audits/propositions) : ma mesure, jouée
    fraîche sur l'état actuel du dépôt, trouve 12 fichiers documentaires
    supplémentaires portant le même patronyme (`docs/arbitrages.md`,
    `docs/backlog.md`, `docs/registres/2026-09-11-file-de-nuit.md`,
    `29-DROITS-1`, `99M-REPRISE-99G`, `PG-A8-ANNULEES-MASQUEES`,
    `PG-B2-FENETRE-POSE`, `PG-B5-ANNULER-DEPLACEMENT`,
    `fiche-1/README.md`, `fiche-1/mesure.json` — tous déjà cités par la
    passation de `9BY` elle-même, section « Ce que je n'ai PAS fait », mais
    pour la scène des raisons sociales/toponyme, pas pour les patronymes).
    Je rapporte la mesure réelle plutôt que de recopier la liste du ticket
    telle quelle — « une hypothèse n'est pas une mesure ».
  - **Toponyme T1 (« Anse Vata »)** : zéro occurrence dans tout le dépôt,
    `docs/` compris, après le remplacement de
    `tests/unit/agences/tri-reglages.test.ts` (avant ce ticket, il ne
    subsistait que dans ce fichier, hors `docs/`).
- `pnpm format:check` et `pnpm test` (344 fichiers, 3500 tests) : verts après
  chaque commit.

## Ce que j'ai tranché et pourquoi

- **Rapporter ma propre mesure d'exhaustivité plutôt que recopier la
  « liste C » du ticket telle quelle.** Le ticket demandait de « recopier »
  cette liste, mais ma mesure — jouée par la méthode prescrite (motifs hors
  dépôt dérivés de la table de correspondance) — trouve 12 fichiers de plus
  que ce que la liste C énumère. Recopier une liste que ma propre mesure
  contredit aurait été une hypothèse maquillée en mesure ; je rapporte donc
  le compte réel, avec la liste C d'origine mise en regard.
- **`docs/propositions/9BY-TP-I9-NOMS-REELS/passation.md:119` corrigé** :
  seule cette ligne, comme prescrit — le reste de cette passation n'est pas
  dans mon Territoire.
- **Aucun garde-fou ajouté** : `9BY` n'a créé ni test ni script de
  vérification automatique (confirmé : aucun fichier sous `tests/unit/docs/`
  ou `scripts/` n'a été ajouté par `dd0093a1`, `e0f545a2` ou `8fcc37d8`), et
  ce ticket n'en ajoute pas non plus — la mesure reste manuelle, comme pour
  `9BY`.

## Ce que je n'ai PAS fait

- Je n'ai touché à aucun fichier `docs/maquette/*.html`, ni aux passations
  historiques, ni aux audits, ni à `docs/arbitrages.md`, ni à
  `docs/backlog.md`, ni à `docs/registres/**` — décision d'Alexis du
  29/09/2026 (« maquettes et passations historiques non touchées »). Le
  détail des 84 occurrences restantes est dans la mesure ci-dessus.
- Je n'ai pas touché `prisma/seed-data.ts` ni ses quatre champs
  `ancien_email` — voulus par `9BY`.
- Je n'ai ajouté aucun garde-fou (test ou script) contre la réapparition
  d'un nom réel — hors Territoire de ce ticket, voir « ce que j'ai
  tranché ».
- Aucune migration, aucune ligne de semis, aucun prix, aucune logique
  métier changée.

## Les pièges pour la session suivante

- **La « liste C » du ticket n'était pas exhaustive.** Une mesure fraîche
  par `git grep` sur les mêmes motifs trouve 12 fichiers documentaires de
  plus (voir le tableau ci-dessus) — toujours des documents hors Territoire,
  mais à connaître avant de croire un compte ancien sur parole.
- **Aucun gardien automatique n'existe pour I9 sur les noms réels** : toute
  vérification reste manuelle (fichier de motifs `/tmp`, jamais commité).
  Si un futur ticket doit traiter les 84 occurrences documentaires, il devra
  remesurer, pas recopier ce tableau tel quel (le dépôt continue de changer).
- `tests/unit/ui/lot-a2.test.ts` reste un gardien FRAGILE à toute
  réécriture de `weekPlan()`/`dayPlan()` dans la maquette : si leur forme
  change, la `preuve` de `nom-technicien-agence` (et les dix autres) devra
  être remesurée exactement comme documenté ici.

## Ce qui reste à faire

- **À décider par Alexis** (rien de fait) :
  1. Les maquettes (`docs/maquette/{codiplan-maquette-complete,CODIPLAN_Maquette}.html`,
     `docs/propositions/planning-gmao/maquette-planning-gmao.html`) : les
     renommer serait un ticket à part, qui changerait aussi toute preuve de
     test qui les cite — aujourd'hui, après ce ticket, aucune ne cite plus
     un nom réel.
  2. Les 30 fichiers documentaires restants (audits, propositions,
     passations historiques, `docs/arbitrages.md`, `docs/backlog.md`,
     `docs/registres/**`) — la liste complète, avec ses comptes, est dans la
     mesure ci-dessus.
  3. Le retrait du champ `ancien_email` (passation `9BY` :209-213), plus
     tard.
  4. La réécriture de l'historique git : hors de portée (passation `9BY`
     :200-205).
- `CI=1 pnpm verify:full` (format:check + typecheck + lint + test +
  test:isolation + build + feries:horizon + audit:partitions + test:e2e) :
  **vert** — 687 tests e2e passés, 7 ignorés (skip pré-existants, non liés à
  ce ticket), aucun échec.
