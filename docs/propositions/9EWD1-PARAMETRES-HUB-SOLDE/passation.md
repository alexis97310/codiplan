# 9EWD1-PARAMETRES-HUB-SOLDE — passation

## Ce qui est livré

1. **Textes des portes** (`lib/i18n/fr.ts`) : titres et descriptions des portes Trajets, Prestations, Agences,
   Équipe, Habilitations, Matériel, Imports, Données repris mot pour mot de la maquette (page Paramètres,
   `docs/propositions/ergonomie-2026-09-28/maquette-toutes-pages.html`, M:4381-4395). Taux horaire et
   Forfaits inchangés (le lot 9EWE les fusionne).
   - Deux textes de la maquette portent le mot imposé lui-même (« agence », D5/D47) : le titre de la porte
     Agences (« Agences ») et le résumé des Trajets (« …depuis l'agence… »). Écrire « agence »/« agences » en
     dur dans `lib/i18n/fr.ts` ailleurs que sous une clé `vocabulaire.*` fait rougir
     `tests/unit/i18n/vocabulaire-impose.test.ts` (D5/D47) — composé au point d'usage à la place :
     `PorteParametrage.titreCompose` (nouveau champ, `lib/navigation/portes-parametrage.ts`) appelle
     `mot("agence", true)`, comme déjà `app/(back-office)/parametres/agences/[agenceId]/page.tsx:87` ; le
     résumé des Trajets reprend le synonyme « établissement » déjà en usage dans cette clé avant ce lot.
   - Le « , dont » en dur de `decomptes-parametrage.ts` sort vers `parametres.decompte_agence_active_suffixe`.
2. **Décomptes paresseux** (`lib/navigation/decomptes-parametrage.ts`) : chaque entrée porte désormais une
   fabrique (`lire: () => ...`), appelée seulement après le filtre sur les portes ouvertes — une promesse
   démarre dès sa construction en JavaScript, donc l'ancien code lisait quand même une porte fermée.
3. **Unitaires neufs** :
   - `tests/unit/navigation/decomptes-parametrage.test.ts` — un espion par dépôt simulé : porte fermée, jamais
     appelée ; porte ouverte, appelée une fois ; une règle de mise en forme par cas (singulier/pluriel,
     « À jour », « Tous les accès sont ouverts », rien affiché à zéro habilitation expirée, suffixe « , dont »).
   - `tests/unit/societes/identite.test.ts` — `sigleDeLaRaisonSociale`.
   - `tests/unit/calendar/fuseau.test.ts` — `decalageUtc` (Nouméa UTC+11 toute l'année ; Paris change d'heure,
     horloge figée par `vi.setSystemTime` pour rester déterministe).
   - `tests/unit/navigation/portes-sections.test.ts` — Prestations range sous Planification (amende D167).
4. **E2E** (`tests/e2e/9ewd-parametres-hub-maquette.spec.ts`) : la pastille grise (Prestations) n'est jamais
   une seconde ancre dans sa carte (vérifié sur le `<li>`, pas seulement le compte de la carte) ; à 375 px,
   rien ne déborde (`scrollWidth`), même discipline que `parc-375.spec.ts`.
5. **Rendu** (`app/(back-office)/parametres/page.tsx`) : cartes d'une même ligne à hauteur égale
   (`items-stretch` sur la grille, `h-full`/`flex-1` du `<li>` à la carte-lien). Captures 375/1280 recapturées
   dans `docs/propositions/9EWD-PARAMETRES-HUB-MAQUETTE/captures/` (dossier du lot précédent, inchangé —
   l'e2e y écrit déjà).

## Points ouverts

- **Les 3 lectures « extraites » du lot 9EWD** (`compterAgences`, `compterHabilitationsExpirees`,
  `compterZonesSansForfaitDeDeplacement`, nommées dans la passation de 9EWD) n'ont toujours AUCUNE épreuve —
  ce sont des fonctions de dépôt sous `avecContexteApplicatif`, donc une épreuve réelle est une épreuve
  d'ISOLATION (base réelle), pas un unitaire simulé. Les construire proprement (fixtures multi-société,
  cloisonnement) dépasse le budget de ce lot — `decomptes-parametrage.test.ts` simule ces trois dépôts, il ne
  les éprouve pas eux-mêmes.
- **Cas e2e « À jour »** (`parametres.decompte_a_jour`, porte Données à compléter) : non ajouté. La scène
  CODIMA-NC du harnais e2e porte des données de démonstration riches (clients sans code, machines
  incomplètes…) et n'est pas garantie « à jour » sans fixture dédiée.
- **Épreuve d'isolation e2e des décomptes** (société B ne compte rien de la société A) : non ajoutée. Le seed
  crée bien une seconde société (CODIMA-EU, voir le log du seed), mais `tests/e2e/setup/scene.ts` ne porte
  aucun compte connu pour s'y connecter — en construire un pour ce seul test dépasse le budget de ce lot et
  risquerait la scène partagée par les autres spécifications e2e (`fullyParallel`).
- **Porte « Journal d'audit »** : la maquette la dessine (M:4395, section Données) mais l'écran n'existe pas
  dans le dépôt (confirmé par recherche, aucune route `/parametres/journal`) — déjà un écart nommé par D201
  (passation du lot 9EWD). Ce lot n'ajoute pas la porte, puisqu'ajouter une porte vers un écran absent romprait
  la navigation ; c'est hors du périmètre « titres et descriptions des portes EXISTANTES ».

## Hors territoire (inchangé)

`app/(back-office)/parametres/taux-horaire|forfaits/`, `prisma/` (aucune migration), toute valeur de prix,
les pages de destination des portes.

## Vérification finale

`CI=1 pnpm verify:full` lancé en entier, en un seul appel, après `git fetch origin` (aucun écart avec
`origin/main`, pas de rebase nécessaire). Toutes les étapes vertes : `format:check`, `typecheck`, `lint`,
`test` (4713 tests), `test:isolation` (1554 tests), `build`, `feries:horizon`, `audit:partitions`, `test:e2e`
(1320 passed, 48 skipped). Quinze dernières lignes :

```
MESURE bandeau-deplacement-differe@1280 — textes<12px: 0, cibles<32px: 0, débordement: 0
·············································°°···························
····························································[WARN] [better-auth] Base URL is not set…
····················
················································································
················································································
················································································
················································································
·····························································°·°··············°·
···························································°°°°°°°°°°°°°°°°°°°°°
°°°°°°°°
  48 skipped
  1320 passed (51.1m)
```

`git rev-parse --short HEAD` : `2a300d78`.

Les captures régénérées par effet de bord de `test:e2e` sur D'AUTRES lots (une centaine de fichiers, hors
`9EWD-PARAMETRES-HUB-MAQUETTE/captures/`) ont été restaurées (`git checkout --`) ou supprimées (fichiers
jamais suivis) avant ce commit — aucune ne devait être commitée par ce lot.

## Reprise après redémarrage (15/10)

Le PC a redémarré pendant la vérification indépendante de ce lot (après le dernier commit ci-dessus, donc
sans toucher au travail déjà consigné) ; rien n'avait été publié. Les 6 commits de ce lot (points 1 à 5,
jusqu'à `f890c37d`) ont été mis à l'abri par Alexis sur `9EWD1-PARAMETRES-HUB-SOLDE-redemarrage`, posée
directement sur `origin/main` (8e49387a) — aucun écart, aucun cherry-pick nécessaire.

Vérifications faites avant de reprendre :
- Les quatre fichiers PNG touchés par le commit du point 5 sont tous dans
  `docs/propositions/9EWD-PARAMETRES-HUB-MAQUETTE/captures/` (dossier du lot précédent, inchangé) — aucune
  capture étrangère à restaurer.
- Relecture des cinq points du ticket face au contenu des commits et à la section « Points ouverts »
  ci-dessus : les cinq points sont couverts ; les deux manques du point 4 (cas « À jour », épreuve
  d'isolation des décomptes) restent les mêmes, avec la même justification (fixture dédiée hors budget,
  risque sur la scène e2e partagée) — aucun code neuf nécessaire à cette reprise.
- `pnpm typecheck` et les quatre unitaires neufs (`decomptes-parametrage`, `portes-sections`, `identite`,
  `fuseau`) rejoués isolément avant le grand run : verts.

`CI=1 pnpm verify:full` rejoué en entier, en un seul appel, après `git fetch origin` (`origin/main` toujours
à `8e49387a`, pas de rebase nécessaire). Toutes les étapes vertes, mêmes volumes que la veille : `test` (4713
tests), `test:isolation` (1554 tests), `build`, `feries:horizon`, `audit:partitions`, `test:e2e` (1320
passed, 48 skipped, 51.1m). Quinze dernières lignes :

```
MESURE bandeau-deplacement-differe@1280 — textes<12px: 0, cibles<32px: 0, débordement: 0
·············································°°···························
····························································[WARN] [better-auth] Base URL is not set…
····················
················································································
················································································
················································································
················································································
·····························································°·°··············°·
···························································°°°°°°°°°°°°°°°°°°°°°
°°°°°°°°
  48 skipped
  1320 passed (51.1m)
```

`git rev-parse --short HEAD` au moment de ce run : `f890c37d`. Les captures régénérées par effet de bord
sur D'AUTRES lots (plus de deux cents fichiers hors `9EWD-PARAMETRES-HUB-MAQUETTE/captures/`) ont de
nouveau été restaurées ou supprimées avant ce commit.
