# 9ER-E2E-FIXTURES-PREMIER-SITE — passation

Départ : `origin/main` à `291b074c` (9EHC-REPRISE-9EH-1), 2026-10-11 ~21:10 Nouméa.
Fin : même base, 23 commits dessus, `git status --porcelain` vide, 2026-10-11 23:40 Nouméa.
Aucun push — tout reste local, comme demandé.

## Tableau spec → changement → commit

| Spec / fichier | Changement | Commit |
|---|---|---|
| `parcours-creer-puis-planifier.spec.ts` | `siteDeDucos(ordre)` → `siteDeDucos(libelle)` : vise « Atelier principal » et « Atelier sous contrat (démonstration) » par leur libellé, jamais par `asc`/`desc` | `e95cb56d` |
| `blocage-agenda-visible.spec.ts` | `client: { actif: true }` + `libelle: "Atelier principal"`, `orderBy` retiré | `cd162691` |
| `fiche-intervention.spec.ts` | idem | `8618eac7` |
| `priorite-ton-partage.spec.ts` | idem | `67278865` |
| `creation-jour-ferme.spec.ts` | `siteDeKone()` : `client: { actif: true }` + `libelle: "Dépôt de brousse"` | `86a70243` |
| `planning-tiroir.spec.ts` | site DUCOS visé par son libellé | `6efadac9` |
| `planning-cibles-375.spec.ts` | idem | `9b6eced5` |
| `planning-survol-cases.spec.ts` | site KONÉ visé par son libellé | `6af93ad9` |
| `affichage-materiel.spec.ts` | site DUCOS visé par son libellé | `ea337c5a` |
| `planning-3.spec.ts` | idem | `ec71c41a` |
| `planning-technicien-actions-refusees.spec.ts` | idem | `718664fb` |
| `planning-filtres-aujourdhui.spec.ts` | idem | `4a4404d0` |
| `planning-jour-suite.spec.ts` | `lieu()` : constante `SITE_SEME_PAR_AGENCE`, les deux agences | `2a98a681` |
| `captures-pgd1b-jour-suite.spec.ts` | site KONÉ visé par son libellé | `411598e4` |
| `fiche-trouver-creneau.spec.ts` | `creerInterventionAPlanifier()` : même constante `SITE_SEME_PAR_AGENCE` | `bf01aec8` |
| `bon-intervention.spec.ts` | site DUCOS visé par son libellé | `747863db` |
| `planning-file-onglets.spec.ts` | idem | `0446641d` |
| `porte-capacites.spec.ts` | idem | `6d4ddc13` |
| `setup/scene-glisser.ts` | `lieuDe()` : même constante `SITE_SEME_PAR_AGENCE` (point 3) | `0d32b38b` |
| `captures-gr12-sites.spec.ts` | `.first()` → lien du site semé par son identifiant, lu depuis `@/prisma/seed-data` (`SOCIETES`), jamais un texte en dur dans la requête d'écran | `d536515c` |
| `captures-9ac-clients-compteur-gris.spec.ts` | idem, client « Atelier Ducos » et site « Atelier principal » | `f87f5a87` |
| `9efb-y13-contacts-telephone.spec.ts` | les deux changements d'identité attendent désormais `toHaveURL(/\/planning/)` après le clic « valider » (point 5) | `5ac9f84f` |
| `9efa-reprise-y19-debordement.spec.ts` | témoin de rendu (lien d'intervention) ajouté avant `sansDefilementHorizontal` sur « fiche client, aperçu » et « fiche site, aperçu » ; `.first()` car la carte entière est cliquable (plusieurs `<a>` au même `href`) (point 5) | `b1e1cdd9` |

Chaque spec a été rejouée deux fois, seule, avant son commit (`CI=1 pnpm exec playwright
test <fichier>` pour les quinze derniers ; les huit premiers sous l'invocation équivalente
sans `CI=1`, un worker, deux appels séparés — voir « Le conflit non résolu » plus bas pour
pourquoi `CI=1` a fini par devenir systématique). `setup/scene-glisser.ts` a été vérifié par
quatre de ses consommateurs (`glisser-deposer`, `planning-jour-frise`,
`planning-annuler-deplacement`, `planning-semaine-garde-heure`), chacun deux fois.

## Ce qui n'a pas été touché, et pourquoi

- **`setup/scene.ts`** — jamais modifié (V5 du pilote) : `agenceEtLieu()` n'est appelée
  qu'une fois, par `global.ts`, avant tout worker. Rien à y filtrer.
- **`creerSceneAvertissement`** (dans `fiche-trouver-creneau.spec.ts`) — forge son propre
  client et site à chaque appel, jamais le site semé. Hors motif de ce lot.
- **Les préfixes des fixtures existantes** (`9EFB…`) — non renommés, comme demandé :
  une fois les specs « premier site » filtrées par leur libellé exact, l'ordre
  alphabétique de ces fixtures ne les gêne plus.
- **`captures-pgd1-jour-frise.spec.ts`** — consommateur de `scene-glisser.ts` listé par le
  pilote (V6), non rejoué séparément par manque de temps : sa logique est identique à celle
  de `glisser-deposer.spec.ts` et `planning-jour-frise.spec.ts`, tous deux vérifiés deux fois
  et verts. Risque jugé faible, mais à confirmer si un doute se présente.

## Le conflit non résolu (au sens de la consigne — mesuré, pas laissé en l'état)

Deux artefacts de ma propre méthode de vérification, aucun n'est resté sans explication
dans le code ni n'a affaibli une assertion :

1. **`parcours-creer-puis-planifier.spec.ts` sous `--repeat-each=2`** : la première
   tentative de vérification (deux copies du fichier en parallèle, 2 workers) a fait
   échouer « PLANIFIER refuse… » une fois sur deux copies concurrentes visant le MÊME site
   forgé au même instant. Rejoué en deux invocations séparées et strictement
   séquentielles (la méthode retenue partout ensuite) : vert deux fois. La course venait de
   ma méthode de test, pas du code.
2. **`fiche-trouver-creneau.spec.ts` sous 4 workers (mode par défaut, hors CI)** : le témoin
   courriel du test « avec un donneur d'ordre » (compte un delta de +1 dans le fichier
   partagé `/tmp/codiplan-e2e-courriels.jsonl`, jamais vidé entre deux tests — voir
   `tests/e2e/setup/double-courriel.cjs`) a mesuré +2 au lieu de +1, deux fois de suite,
   sous 4 workers. Rejoué sous `--workers=1` : vert deux fois. `creerSceneAvertissement`
   forge sa PROPRE scène, jamais le site édité par ce lot — la cause est une course entre
   tests du MÊME fichier sur un fichier `/tmp` partagé, pas mon changement. Sous `CI=1`
   (le mode de `pnpm verify:full`, `workers: 1`), aucune course n'est possible : le
   `CI=1 pnpm verify:full` complet, joué une fois en entier à la fin, l'a confirmé (1232
   passed, 48 skipped, 0 failed, 47,7 min).

Les deux sont documentés dans les commentaires du commit `bf01aec8` et de ce fichier ;
aucun code n'a été changé pour les faire taire, et je n'ai pas touché au mécanisme
`double-courriel.cjs` (hors territoire de ce lot).

## Vérification finale

- `CI=1 pnpm verify:full` (23:14→00:02 environ) : `format:check`, `typecheck`, `lint`,
  `test` (428 fichiers, 4615 tests), `test:isolation`, `build`, `feries:horizon`,
  `audit:partitions`, `test:e2e` (1232 passed, 48 skipped, 0 failed) — tout vert.
- Toutes les captures régénérées par ce run complet (PNG sous `docs/propositions/**/captures`,
  générées par les tests dont les variables d'environnement de capture sont restées actives)
  ont été restaurées (`git checkout --`) ou supprimées (nouvelles, jamais suivies) avant
  tout commit — aucune n'a été committée, conformément à « Captures : aucune ».
- `CI=1 pnpm verify` final (sans refaire tout `test:e2e`) : vert.
- `git fetch origin` : `origin/main` n'a pas bougé depuis le départ (`291b074c`) — pas de
  rebase nécessaire, les 23 commits sont directement dessus.
- `git status --porcelain` : vide.

## Reprise 9ERA (12/10, matin)

### 1 — Départ et rejeu de la garde

`git fetch origin` : `origin/main` toujours à `291b074c` (9EHC-REPRISE-9EH-1), inchangé
depuis le départ de 9ER. Branches de travail (journal-parallèle, 01:23) : garde =
`9ER-E2E-FIXTURES-PREMIER-SITE-garde` (24 commits dessus, dont celui-ci même : la passation
ci-dessus) ; reste non commité = `voie1-reste-1012-0123`.

`git diff origin/main voie1-reste-1012-0123 --stat` : **12 fichiers, uniquement des PNG de
capture** (`docs/propositions/**/captures/*.png`, 0 insertion/suppression de texte) —
**aucun code**. Le « reste non commité » de 01:23 ne contient donc RIEN du territoire de
9ER : pas un fichier `tests/e2e/*.spec.ts`, pas une ligne de `scene-glisser.ts`. Point 2 de
la consigne (« ne reprends QU'un fichier du territoire de 9ER qui porte un point non
commité ») ne s'applique à rien — et les captures, de toute façon interdites, ont été
nettoyées (`git clean -f`) sans être reprises.

Les 24 commits de la garde ont été rejoués par `git cherry-pick origin/main..garde` :
**sans conflit, un par un**, `git status --porcelain` vide à la fin.

### 2 — Tableau spec → changement → commit (repris de la garde)

Identique au tableau de 9ER ci-dessus (section « Tableau spec → changement → commit ») :
les 23 commits de spec plus le commit de passation ont tous été repris TELS QUELS, aucun
n'a été modifié ni recommis. Les 24 SHA sont désormais sur l'historique de cette reprise
(mêmes messages, mêmes diffs — seuls les hash de commit Playwright locaux changent par
rejouage, pas le contenu).

### 3 — La recherche du rouge

`CI=1 pnpm verify` (court) : **vert**. `CI=1 pnpm verify:full` en entier, au premier plan
(47,7 min) : **5 échecs**, tous dans DEUX fichiers, AUCUN des deux dans le territoire de
9ER :

- `tests/e2e/9eg2-tableau-de-bord-direction-admin.spec.ts:447` — « Priorités
  opérationnelles » : la catégorie « Retards » est absente des options
  (`Tous les besoins (3) Urgences (2) Pièces (1)`, pas de « Retards »).
- `tests/e2e/planning-creer-en-haut.spec.ts:58` (4 variantes, 1280/1440 px × semaine/jour) :
  `locator('main header p')` résout à DEUX éléments — le sous-titre de date ET le
  paragraphe « Laissées, à compléter » du bandeau, apparu dans l'en-tête du planning.

Pour mesurer AVANT de classer (règle du point 5 de 9EH-TP-UX-PL-PLANNING-1, déjà en
vigueur) :

1. Rejoué les 22 fichiers de spec du territoire de 9ER (hors `setup/scene-glisser.ts`, qui
   n'est pas un fichier de test) SEULS, sans les deux fichiers étrangers : **75 passed, 0
   failed (4,2 min)**.
2. Rejoué `9eg2-tableau-de-bord-direction-admin.spec.ts` SEUL (base fraîche, scène globale
   seule, AUCUN fichier de 9ER n'a tourné avant lui) : **même échec**, deux fois de suite.
3. Rejoué `planning-creer-en-haut.spec.ts` SEUL (même base fraîche) : **même échec**, 4/5
   tests rouges.
4. Basculé sur `origin/main` DÉTACHÉ (zéro commit de 9ER, fichiers inchangés) et rejoué
   CHACUN des deux SEUL : **même échec, identique**, sur le dépôt tel qu'il était AVANT que
   9ER n'écrive la moindre ligne. Revenu ensuite sur le commit de cette reprise
   (`git checkout <sha>`), rien d'autre n'a bougé.

### 4 — La cause du rouge, mesurée

**Les deux rouges sont étrangers au lot, au sens fort** : ils ne sont pas seulement « pas
touchés par 9ER », ils se reproduisent À L'IDENTIQUE sur `origin/main` SANS AUCUN commit de
9ER, et SEULS (aucune interférence d'ordre ou de parallélisme possible, scène globale
fraîche à chaque fois). Les deux portent la marque d'un défaut dépendant du jour civil
(aujourd'hui, 12/10/2026, est un LUNDI — « Semaine 42 · 12/10 → 17/10 », « lundi 12/10/2026 »
dans les messages d'échec) : une lecture globale à la société (`enRetard`/« Laissées »,
même famille de piège que celle déjà nommée par 9EH-TP-UX-PL-PLANNING-1, point 9) produit un
résultat différent selon le jour de semaine où tourne la scène semée par `global.ts` — hors
territoire de ce lot (`lib/interventions/retard.ts`, le bandeau « Laissées » du planning),
et la passation de 9ER (ci-dessus, « Vérification finale ») rapporte un `verify:full` vert
daté du 11/10 (un DIMANCHE) : cohérent avec un défaut qui ne se voit qu'un autre jour de la
semaine.

### 5 — Ce qui a été annulé, et pourquoi

**Rien.** Aucun commit de 9ER n'a été annulé : les 24 (23 specs + passation) sont tous
repris intacts, et les 22 fichiers de spec qu'ils touchent sont **100 % verts** rejoués
seuls. Il n'y avait rien à corriger « à la cause » dans le territoire de 9ER — le rouge
mesuré n'y habite pas.

### 6 — Vérification finale

- `CI=1 pnpm verify` (court) : **vert**.
- Les 22 fichiers de spec du territoire de 9ER (75 tests), rejoués ensemble, seuls : **tous
  verts (4,2 min)**.
- `CI=1 pnpm verify:full` en entier : **5 échecs, les deux mêmes fichiers étrangers**
  (`9eg2-tableau-de-bord-direction-admin.spec.ts`, `planning-creer-en-haut.spec.ts`),
  confirmés étrangers au lot par mesure (section 3-4 ci-dessus) — pas « Le conflit non
  résolu » au sens de la consigne (qui suppose une spec de CE lot), un rouge préexistant
  que ce lot ne peut pas réparer sans sortir de son territoire (`Aucun code applicatif`).
- `git fetch origin` : `origin/main` toujours à `291b074c`, pas de rebase nécessaire.
- `git status --porcelain` : vide (après nettoyage des captures régénérées par les runs de
  mesure, jamais committées).

## Reprise 9E3 (12/10, matin)

### 1 — Départ

`git fetch origin` : `origin/main` à `898ecb84` (9E2-E2E-MAIN-ROUGE-LUNDI — passation :
verify:full complet vert), qui répare précisément les deux rouges étrangers mesurés par
9ERA (`planning-creer-en-haut.spec.ts`, `9eg2-tableau-de-bord-direction-admin.spec.ts`).
La garde `9ERA-REPRISE-9ER-garde` existe, point de divergence avec `origin/main` à
`291b074c` — exactement la base de départ de 9ER et de 9ERA, inchangée.

### 2 — Rejeu de la garde

Branche de travail `9e3-reprise-9era` créée depuis `origin/main` (898ecb84).
`git cherry-pick 291b074c..9ERA-REPRISE-9ER-garde` : **25 commits rejoués sans aucun
conflit** — les 23 commits de spec de 9ER, le commit de passation de 9ER (`36fd051f`), et
le commit de passation de 9ERA (`0f3a087f`) ; 24 au sens de la consigne (23 specs + 1
passation 9ER) plus la passation 9ERA elle-même. `git status --porcelain` vide à la fin.
HEAD : `0d8a6cee`.

### 3 — Vérification

1. Les 22 fichiers de spec du territoire de 9ER, seuls (`CI=1 pnpm exec playwright test
   <les 22 fichiers>`) : **75 passed, 0 failed (4,2 min)**.
2. Les deux specs réparées par 9E2, seules (`planning-creer-en-haut.spec.ts`,
   `9eg2-tableau-de-bord-direction-admin.spec.ts`) : **21 passed, 0 failed (2,0 min)**.
3. `CI=1 pnpm verify:full` en entier, au premier plan, un seul appel (~50 min — 15
   dernières lignes ci-dessous) : **vert**, aucun échec nulle part dans la chaîne
   (`format:check`, `typecheck`, `lint`, `test`, `test:isolation`, `build`,
   `feries:horizon`, `audit:partitions`, `test:e2e`).

```
·MESURE glisser-en-cours@1280 — textes<12px: 0, cibles<32px: 0, débordement: 0
MESURE bandeau-deplacement-differe@1280 — textes<12px: 0, cibles<32px: 0, débordement: 0
·············································°°·
················································································
······[WARN Better Auth: Base URL is not set — bénin, répété tout le run]
··········································································
················································································
················································································
················································································
························································°·°··············°······
···················································°°°°°°°°°°°°°°°°°°°°°°°°°°°°°
  48 skipped
  1232 passed (47.8m)
::notice title=🎭 Playwright Run Summary::  48 skipped%0A  1232 passed (47.8m)
```

HEAD à la fin de la vérification : `0d8a6cee`.

### 4 — Nettoyage

Le `verify:full` complet régénère par effet de bord des PNG de capture sous
`docs/propositions/**/captures` (les variables d'environnement de capture restent actives
pendant `test:e2e`). Fichiers suivis modifiés restaurés (`git checkout --`), nouveaux
fichiers non suivis supprimés (`git clean -f` limité à `docs/propositions`) — aucune
capture committée, conformément à « Captures : aucune ». `git status --porcelain` vide
après nettoyage.

### 5 — Ce qui a été annulé, et pourquoi

**Rien.** Les deux specs étrangères au territoire de 9ER sont réparées par le lot
`9E2-E2E-MAIN-ROUGE-LUNDI`, déjà sur `origin/main` avant cette reprise — rien à corriger ni
à annuler ici.

### 6 — Vérification finale

- `git fetch origin` : `origin/main` toujours à `898ecb84`, inchangé depuis le départ —
  pas de rebase nécessaire.
- `CI=1 pnpm verify` (court) : vert.
- `git status --porcelain` : vide.
