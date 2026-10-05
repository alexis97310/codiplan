# 9DQ-TP-NAV1-HUB-AGENCES — passation

*Premier ticket d'une série de quatre (NAV). Décide D167 (`docs/arbitrages.md`) : constats
MO-27, PA-07, MO-30, PA-29, PA-31, PA-32, PA-34, PA-35 de l'audit du 28/09/2026, et les
réponses de recommandation Q-MO-16, Q-MO-14. Reste à valider par Alexis.*

## Ce que j'ai changé, et ce que ça change pour l'exploitation

- **Le hub « Paramètres » passe de onze portes à plat à CINQ SECTIONS** (`lib/navigation/portes-parametrage.ts`) : Tarifs, Planification, Organisation, Référentiels, Données. Les portes « Clients » et « Sites », doublons du menu principal depuis D121, quittent le hub ; « Imports » y entre (section Données), atteinte jusqu'ici par la seule barre.
- **Le hub est renommé « Paramètres »** (`Q-MO-16`) — la maquette confrontée dessine encore « Sociétés & tarifs », écart nommé à D121.
- **Une carte « Identité » en tête du hub** (`lib/societes/identite.ts`) lit l'identité de la société active (raison sociale, territoire, fuseau, devise, libellé du code externe, mentions légales) sous le contexte cloisonné.
- **`/parametres/societe` redirige vers `/parametres`** plutôt que de disparaître (une adresse mémorisée reste valide) — la page « Charte de la société » (N-02) est retirée jusqu'au lot 7, elle ne réglait rien.
- **Une adresse par entité pour les agences** (PA-29) : le calendrier déménage à `/parametres/agences/calendrier/[id]` ; l'agence reçoit sa propre fiche à `/parametres/agences/[agenceId]`, avec son identité (code en lecture, libellé, territoire, fuseau, actif) et un lien vers ses horaires.
- **Les jours à horaires identiques se regroupent** dans la liste des agences (PA-31, `grouperJoursParHoraire`) — un samedi à horaires différents du reste de la semaine n'est plus masqué par le premier jour travaillé.
- **La colonne « Exceptions » est retirée** (PA-32) — elle comptait une table que rien n'écrit encore.
- **Aucune plage n'est proposée par défaut** à la création (PA-34) — les deux bornes partent vides.
- **Territoire et fuseau se choisissent dans une liste** plutôt qu'en saisie libre (PA-35) — `territoiresConnus` (`lib/calendar`) et `fuseauxConnus` (`Intl.supportedValuesOf("timeZone")`), avec une option explicite « Hérite de la société ».
- **Décision** : `docs/arbitrages.md` porte désormais D167.

## Ce que j'ai mesuré

- `CI=1 pnpm verify:full` (format:check, typecheck, lint, test, test:isolation, build, feries:horizon, audit:partitions, test:e2e) **vert en entier** — voir « Reprise 9DQB » ci-dessous pour le détail des deux passes jouées sur `main` à jour.
- Aucune ligne de semis (`prisma/seed.ts`) ni migration — ce lot ne touche que la navigation et la lecture.

## Ce que j'ai tranché, et pourquoi

- **Choix du pilote (document `claude/mesure-vgp-nav-03-10.md`, « ne reste pas bloqué »)** : la section « Société » proposée par l'audit devient « Planification », l'identité de la société devenant une CARTE plutôt qu'une section ; « Imports » entre au hub.
- **Redirection plutôt que suppression** pour `/parametres/societe` : une adresse mémorisée ou mise en favori ne doit pas rendre 404.
- **PA-28 (le calendrier ne reprend pas le nom d'une agence renommée) et PA-33 (jargon du bandeau rétroactif) ne sont PAS traités** — tickets suivants de la série NAV.

## Ce que je n'ai PAS fait

- Aucune migration, aucune ligne de semis, aucun prix.
- Les fériés travaillés et les ponts (MO-30, PA-30) — ticket suivant de la série NAV, nommément.
- PA-28 et PA-33 (voir ci-dessus).

## Les pièges pour la session suivante

- `/parametres/societe` n'est plus un écran court (il redirige vers le hub, 1407 px) — voir « Reprise 9DQB » : le témoin d'écran court de `tests/e2e/ecrans-largeur-utile.spec.ts` a dû être déplacé.
- `administrer_agences` (D153, aucun ○) ferme la lecture ET l'écriture de la fiche d'agence à qui n'a pas ce droit — une session de test qui vise cette fiche doit être une session admin de société (`COMPTE_ADMIN_SOCIETE_EPREUVE`).

## Ce qui reste à faire

- Validation d'Alexis sur D167 (voir sa condition de réouverture).
- Les tickets suivants de la série NAV : fériés travaillés et ponts (PA-30, MO-30), PA-28, PA-33.

## Reprise 9DQA (05/10/2026, 15:59–19:29)

*Section absente de la passation à l'écriture de cette reprise — la session 9DQA a été ARRÊTÉE par la file à la limite de 210 minutes avant de l'écrire. Reconstituée depuis la branche locale `9DQA-REPRISE-9DQA-garde` et son historique de commits (7 commits, identiques en contenu à `9DQ-TP-NAV1-HUB-AGENCES-garde`, rebasés sur `main` à jour incluant 9DP).*

- 1er recalage de 9DQ (ROUGE x2 lors de la session initiale) : repris intégralement par 9DQA, verification indépendante lancée 19:29, PASSÉE à 20:11.
- Conflit au rebase sur `origin/main` à 20:11 : `9DS-TP-MOD1-EXPORTER` publié `eb17c838` à 18:59 entre-temps — 2e recalage, non imputable au contenu du lot (sa propre vérification est passée).
- Travail intact laissé sur la branche locale `9DQA-REPRISE-9DQ-garde`, repris ci-dessous par 9DQB.

## Reprise 9DQB (05/10/2026–06/10/2026)

- **`git fetch origin`** : `origin/main` à `5389b9ec` (9DLA-REPRISE-9DL), contenant déjà `eb17c838`/9DS et `515bfeb9`/9DL (D163). Le worktree était déjà en HEAD détaché sur ce commit.
- **`git log --oneline origin/main..9DQA-REPRISE-9DQ-garde`** rendait exactement les 7 commits propres à 9DQ (`9ee16bc3`…`41d7eaee`) — `origin/main` portait déjà tout le reste (9DP, 9DIC, etc.) que la garde avait accumulé par rebase.
- **Rejeu** : `git cherry-pick` des 7 commits, un par un, dans l'ordre chronologique de la garde.
- **Le seul conflit** : `docs/arbitrages.md`, au cherry-pick de `22842f90` (D167). Conflit additif — `main` portait déjà D169 (9DS) et D163 (9DL) au même point d'insertion que D167 de la garde. Résolu en conservant les TROIS sections (D169, D163, D167) à la suite, sans perte de contenu. **Numéro de décision** : D167 était LIBRE sur `origin/main` — aucune renumérotation nécessaire.
- **Aucun autre conflit** : `lib/i18n/fr.ts` et `tests/unit/theme/lien-visible.test.ts` se sont fusionnés automatiquement (`Auto-merging`, sans marqueur) ; `tests/unit/auth/porte.test.ts` n'est pas touché par ce lot, donc aucun conflit avec les routes d'export de 9DS.
- **Cache `.next/types` périmé** après le rejeu : `pnpm typecheck` rougissait sur des routes renommées par ce lot (`[id]/modifier` → `[agenceId]`, `[id]` → `calendrier/[id]`) que l'ancien cache référençait encore. `rm -rf .next` puis nouveau `pnpm typecheck` : vert, sans aucune modification de code — artefact local, pas un défaut du lot.
- **Premier `CI=1 pnpm verify:full`** (05/10, 22h31–23h59 heure de Nouméa / 11h31–12h17 UTC) : UN ROUGE — `tests/e2e/ecrans-largeur-utile.spec.ts:281`, « la colonne latérale descend jusqu'en bas de la fenêtre, même sur un écran COURT ». Le témoin du scénario, `/parametres/societe`, est devenu une redirection vers `/parametres` PAR CE LOT MÊME (D167, Q-MO-14a) — le hub mesure désormais 1407 px, le témoin ne prouvait plus rien. **Vrai défaut du lot**, pas un rouge étranger : le scénario a été relu jusqu'à son propre commentaire, qui annonçait déjà la fragilité (« `/absences` servait ce rôle jusqu'au 03/10 »).
  - **Correction, sans affaiblir aucune assertion** : le témoin d'écran court déménage vers la fiche d'une agence (`/parametres/agences/[agenceId]`, créée par ce même lot) — titre, formulaire de quatre champs, aucune lecture de table, exactement le même profil que l'ancien témoin. La session par défaut du `beforeEach` ne voit pas le lien « Modifier » (D153, `administrer_agences`) : le scénario rouvre la session admin de société (`COMPTE_ADMIN_SOCIETE_EPREUVE`), même patron que le scénario voisin (« le réglage du pas… »). Rejoué seul : **vert** (hauteur document ≤ 900, hauteur colonne = 900 px). Rejoué sur tout le fichier : les 7 scénarios passent.
  - `pnpm format:check` rougissait sur le fichier modifié (indentation) — corrigé par `prettier --write`, revérifié vert. `pnpm lint` vert sans modification.
  - Commit séparé (`36268c02`) après ce correctif, avant la seconde passe de vérification.
- **Second `CI=1 pnpm verify:full`**, en entier (06/10, 00h17–00h58 heure de Nouméa / 12h17–12h58 UTC) : **vert en entier** — build, test, test:isolation, feries:horizon, audit:partitions compris ; `test:e2e` : 925 passées, 7 ignorées (36,8 minutes), **aucun rouge**.
- **Comptes AVANT/APRÈS** : `pnpm test` isolé — 382 fichiers / 4067 tests unitaires, tous passés. `pnpm test:isolation` isolé — 161 fichiers / 1449 tests, tous passés.
- **Captures écartées** : chaque passe de `test:e2e` a régénéré, comme effet de bord connu, une centaine de captures PNG/PDF étrangères à ce lot (dates ou scènes du jour dans des specs d'autres lots : 47-AVERTISSEMENTS-1, 9DE-TP-CY1-TERMINER-SIGNATURE, 9DK-PG-G15A-ABSENCE-ECOURTER, 9DF-TP-CY2-MATRICE-D8, etc.). Aucune ne portait sur `docs/propositions/9DQ-TP-NAV1-HUB-AGENCES/`. Toutes annulées (`git checkout -- docs/propositions` puis `git clean -fd docs/propositions`) avant chaque commit. Les six captures APRÈS propres à 9DQ (`docs/propositions/9DQ-TP-NAV1-HUB-AGENCES/captures/apres/`) n'ont pas bougé : le spec qui les produit (`tests/e2e/captures-9dq-tp-nav1-hub-agences.spec.ts`) n'écrit que sous un env var dédié, absent de `verify:full` — aucune régénération n'était due, aucune n'a eu lieu.
- **Numéro de décision final : D167.**
- **Aucun conflit non résolu** : les 7 commits de la garde ont tous été rejoués sans divergence de sens ; le seul conflit (additif, `docs/arbitrages.md`) ne touchait le sens d'aucune décision.
