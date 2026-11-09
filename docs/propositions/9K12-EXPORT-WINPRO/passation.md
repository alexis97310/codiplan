# 9K12-EXPORT-WINPRO — passation

## 1. Mesure

### La route et ce qu'elle rendait avant ce lot

- `app/api/interventions/exporter/route.ts` — huit colonnes (Référence,
  Client, Machine, Site, Technicien, Date planifiée, Priorité, Statut),
  composées aux lignes 115-138 (avant ce lot) à partir de
  `listerInterventionsPourExport` (`lib/interventions/depot.ts:5172`, créée
  pour MO-9/D169) — la même `filtreDesInterventions` que `listerInterventions`,
  `skip`/`take` retirés : l'export rend tout le filtre, jamais la seule page.
- Deux capacités à la porte (`importer_exporter` + `consulter_planning`,
  D150) — non touchées par ce lot.

### D'où viennent les quatre champs demandés

- **Nature** = `intervention.type` (`prisma/schema.prisma:1775`, énumération
  `TypeIntervention:2038-2048`). Déjà traduite intégralement —
  `type_intervention.*` dans `lib/i18n/fr.ts:3418-3426` — et déjà projetée par
  une fonction existante, `objetDuBloc` (`app/(back-office)/interventions/
  presentation.ts:805`, « LA NATURE de l'intervention, et rien de plus »).
  Réutilisée telle quelle plutôt qu'un second appel à `t()`.
- **Code client externe** = `client.code_externe`
  (`prisma/schema.prisma:687`, unique par société, nullable — « clé de
  rapprochement à l'import », RG-IMP-05/D29). Son **libellé affiché** est
  paramétrable par société — `societe.libelle_code_externe` — et vit déjà
  dans `lib/clients/code-externe.ts:26` (`libelleCodeExterne`) : **jamais
  « Winpro » en dur**, c'est exactement l'erreur que D29 corrigeait sur
  cette même colonne (elle s'appelait `code_winpro` avant D29). CODIMA
  (`prisma/seed-data.ts:935`) a réglé le sien sur « Code Winpro » ; une
  société qui n'a rien réglé reçoit le libellé générique,
  `t("client.code_externe")` = « Code externe ».
- **Référence client** = `intervention.reference_client`
  (`prisma/schema.prisma`, déjà dans `CHAMPS_LIGNE`,
  `lib/interventions/depot.ts:135` — saisie une seule fois, à la création,
  PARCOURS-1). Déjà traduite : `intervention.reference_client`
  (`lib/i18n/fr.ts:2262`) = « Référence client / n° de bon de commande ».
  N'était pas encore dans `SELECTION_LIGNE_PLANNING`
  (`lib/interventions/depot.ts:4178`) car `CHAMPS_LIGNE` la porte déjà — rien
  à ajouter là.
- **Date de clôture** = `intervention.cloturee_le`
  (`prisma/schema.prisma:1878`, posée par le déclencheur de facturation /
  `lib/interventions/depot-reprise.ts:105` / `depot.ts:2313`, jamais écrite à
  la main). PAS dans `CHAMPS_LIGNE` ni dans `SELECTION_LIGNE_PLANNING` avant
  ce lot — ajoutée à `SELECTION_LIGNE_PLANNING` seule (même régime que
  `cree_le`/`deplanifiee_date`, juste au-dessus), pas à `CHAMPS_LIGNE` qui est
  partagée par le bon et l'historique machine (lesquels n'ont rien à faire
  d'une date de clôture). Déjà traduite : `intervention.realisation.
  cloturee_le` (`lib/i18n/fr.ts:2720`) = « Clôturée le ».
- **Temps validé** = `intervention.temps_valide_min`
  (`prisma/schema.prisma:1835`, D120 — « LE TEMPS VALIDÉ… C'est lui qui
  entre dans D83 »). **Un seul temps validé existe** — pas de segments à
  recompter, pas de 9I8A1 à relire pour cette colonne : D120 l'a déjà tranché
  et la colonne existe déjà dans `CHAMPS_LIGNE` (`depot.ts:148`). Formaté en
  lisible par `enDuree` (`lib/calendar/duree.ts:18`, « 1 h 30 », déjà
  partagée par trois écrans) et en minutes entières par `ouTiret`
  (`app/(back-office)/presentation.ts:40`, le signe d'absence partagé — un
  nombre, une chaîne, jamais un zéro).

Aucune des quatre n'exigeait une règle de gestion à inventer : les quatre
champs, leur règle et leur libellé existaient déjà, dispersés. Le travail de
ce lot est la composition, pas la définition.

## 2. Colonnes

Six colonnes ajoutées **en fin de ligne** (jamais insérées entre les huit
existantes, pour qu'un export déjà en usage ne voie aucune colonne connue
changer de position) : Nature, Code client, Référence client, Date de
clôture, Temps validé (lisible), Temps validé (minutes). Aucun montant,
aucun taux, aucun forfait chiffré (décision d'Alexis du 09/11/2026, ~10h30 —
Winpro calcule le prix).

- `lib/interventions/depot.ts` : `cloturee_le` et `client.code_externe`
  rejoignent `SELECTION_LIGNE_PLANNING`/`LignePlanning` (:4178, :2667-2684).
- `app/api/interventions/exporter/route.ts` : les six colonnes, composées à
  partir de fonctions déjà existantes et déjà éprouvées ailleurs
  (`objetDuBloc`, `ouTiret`, `enDuree`, `libelleCodeExterne`, `dateCivile`) —
  aucune nouvelle fonction de présentation écrite pour ce lot.
- `lib/i18n/fr.ts` : **une seule clé neuve**, `intervention.
  export_colonne_temps_valide_minutes` = « Temps validé (minutes) » — les
  cinq autres libellés réutilisent des clés déjà au dictionnaire
  (`intervention.type`, `intervention.reference_client`, `intervention.
  realisation.cloturee_le`, `intervention.realisation.temps_valide`), et le
  libellé du code client n'est délibérément PAS une clé du dictionnaire
  (voir §1). **Écart au ticket, à noter** : le point 2 demandait les
  libellés « dans `fr.ts` (bloc de l'export) » — j'ai préféré réutiliser les
  clés déjà portées par les écrans de l'intervention plutôt que dupliquer un
  texte identique sous une seconde clé, en suivant le principe déjà tenu
  ailleurs dans ce même fichier (cette route réutilisait déjà `intervention.
  reference`/`.client`/`.machine`/etc., les libellés de l'écran, plutôt
  qu'un bloc `export_colonne_*` dédié comme le fait `/api/parc/exporter`).
  **À confirmer par Alexis si un bloc dédié était attendu malgré tout.**

Effet de bord typé, corrigé : `lib/terrain/projection-journee.ts` typait son
paramètre d'entrée `LignePlanning`, alors qu'il reçoit aussi bien des lignes
de `listerPlanning` que de la file « à traiter »
(`LigneFileATraiter`/`SELECTION_LIGNE_FILE_A_TRAITER`, une sélection Prisma
distincte) — les deux ne portaient pas `cloturee_le`/`code_externe` avant ce
lot, et le typage le masquait par coïncidence structurelle. Le paramètre est
devenu une forme structurelle locale (`LigneSource`, les seuls champs que la
projection lit), pour ne plus coupler deux sélections indépendantes au
premier champ que l'une ajoute sans l'autre. `tests/unit/terrain/
projection-journee.test.ts` (fixture `LIGNE_COMPLETE`) mis à jour avec les
deux nouveaux champs requis par `LignePlanning`.

## 3. Épreuves

- `tests/isolation/export-interventions.test.ts` : une fiche clôturée
  dédiée (client A1, qui porte déjà `code_externe = 'C-001'` côté fixture)
  prouve d'abord les quatre champs un par un sur `listerInterventionsPourExport`
  (dépôt), puis les six colonnes dans le classeur rendu par la route
  GET — valeurs exactes, pas seulement les en-têtes. Le gardien « aucun
  montant » s'étend à « taux » et « forfait ».
- `tests/e2e/export-registres.spec.ts` : la scène EXPORT9DS (aucune des
  quatre valeurs renseignée) prouve que les quatre cellules restent des
  signes d'absence (`ouTiret`) et que « Code Winpro » — le libellé RÉEL de
  CODIMA (`prisma/seed-data.ts:935`) — apparaît bien en en-tête, jamais une
  chaîne du dictionnaire.
- `pnpm test` : 505 fichiers / 5565 tests, verts.
- `pnpm test:isolation` : 230/231 fichiers verts. **Un fichier rouge, sans
  rapport avec ce ticket** — `tests/isolation/transmission-groupee.test.ts`
  (3 tests), vérifié reproductible À L'IDENTIQUE sur le commit d'avant ce
  lot (`git stash`, rejoué isolément : même 3 échecs, mêmes messages). Je
  n'ai touché aucun fichier de transmission ; à signaler, pas à réparer dans
  ce lot (hors périmètre, budget de temps).
- `pnpm test:e2e tests/e2e/export-registres.spec.ts` : 3/3 verts.
- `CI=1 pnpm verify` : rouge, pour la seule raison ci-dessus
  (`transmission-groupee.test.ts`) — `format:check`, `typecheck`, `lint`,
  `test` (unit) et `build` n'ont pas été rejoués séparément après le dernier
  commit mais l'étaient déjà, sans écart, à chaque point.

## 4. État à la fin de la session

- `main` était extrait dans `/home/aplou/codiplan` (un autre worktree) —
  `git worktree list` l'a confirmé. Ce worktree (`codiplan-voie1`) était en
  HEAD détachée sur `origin/main` : un premier commit y a été posé avant que
  je ne m'en aperçoive, puis déplacé sur une branche dédiée,
  `9K12-EXPORT-WINPRO`, par `git checkout -b` (aucun commit perdu — vérifié
  par `git log` avant/après).
- Trois commits, un par point livré (colonnes, épreuves unitaires/isolation,
  épreuve e2e) :
  - `point 2 : six colonnes de saisie Winpro sur l'export du registre, sans
    aucun montant`
  - `point 3 (unitaire/isolation) : épreuve des six colonnes Winpro, aucun
    montant`
  - `point 3 (e2e) : le fichier téléchargé porte les six nouvelles
    en-têtes`
- `git fetch origin` puis `git rebase origin/main` : à faire avant de
  rendre la main si `origin/main` a bougé depuis — voir le dernier bloc de
  commandes ci-dessous.
- `verify:full` est laissé à la file, non joué ici.
- `git status --porcelain` : vide après le dernier commit.

**À valider par Alexis** :
1. Le libellé du code client reste le libellé CONFIGURÉ de la société
   (« Code Winpro » pour CODIMA, « Code externe » sinon), jamais la chaîne
   littérale « Winpro » — conforme à D29, mais à confirmer que c'est bien ce
   qui était voulu malgré le nom du ticket.
2. Les cinq libellés sur six réutilisent des clés déjà existantes plutôt
   qu'un bloc `export_colonne_*` dédié (voir §2) — à confirmer.
3. `transmission-groupee.test.ts` (3 tests) était rouge sur `main`
   indépendamment de ce ticket — **repris et corrigé ci-dessous (9K12A)**.

## 5. Reprise 9K12A (10/11/2026) — la cause signalée au §3/§4, et au-delà

### Ce qui était rouge, et pourquoi

`tests/isolation/transmission-groupee.test.ts` fixait `JOUR_SQL = "2026-11-09"`
et `AUTRE_JOUR_SQL = "2026-11-16"` en dur. Le 10/11/2026, le premier est devenu
`date_passee` (D141, `verdictDatePassee`, `lib/interventions/pose.ts:193`) :
`listerPlanifieesATransmettre`/`transmettreEnGroupe` refusaient alors les
lignes que l'épreuve posait comme « prêtes », pour une raison totalement
étrangère à ce que le fichier mesure (le tri prêt/laissée, le cloisonnement).

### La correction — un oracle, jamais une seconde date en dur

Remplacé par le calcul déjà en usage dans ce dépôt pour le même problème
(`tests/e2e/pg-g14b-transmettre-groupe.spec.ts`, mémoire de session) :
`chargerCalendrierAgence` (le calendrier RÉEL de l'agence A, fériés et ponts
compris) puis `prochainJourOuvert`, à partir d'aujourd'hui. `JOUR` est le
premier jour ouvré ≥ aujourd'hui ; `AUTRE_JOUR` le premier jour ouvré au moins
sept jours après `JOUR`. Les deux restent des lundis (le calendrier fixture de
l'agence A n'ouvre que ce jour-là), donc toujours distincts l'un de l'autre —
ce que l'épreuve du filtre « jour » exige.

### La bombe à retardement ne s'arrêtait pas à ce fichier

Une recherche de toute autre date en dur comparée (directement, ou par le
code appelé) à l'heure courante — `grep` sur les dates de 2026-11-11 à
2026-12-31 dans `tests/isolation/**` et `tests/e2e/**`, puis lecture au cas
par cas de chaque fonction appelée — a trouvé QUATRE autres épreuves qui
posaient le même piège, toutes via la même porte D141/D123
(`creerReprise`/`deplacerIntervention`, `confirmer_date_passee`) :

- `tests/isolation/suite-a-donner-reprise.test.ts` — `LUNDI` fixé au
  23/11/2026, avec `confirmer_date_passee: false` sur CHAQUE appel (le
  fichier attend l'ACCEPTATION, jamais le refus) : aurait cassé dès le
  24/11/2026. Son propre en-tête notait déjà que le `14/09/2026` de
  `verdict-pose-lecture.test.ts` était « tombé dans le passé au fil des
  exécutions de ce dépôt » — sans tirer la conséquence que sa propre date,
  simplement plus lointaine, subirait le même sort.
- `tests/e2e/fiche-suspendue-gestes.spec.ts` — le dialogue « Déplacer »
  rempli avec `15/12/2026` : aurait cassé dès le 16/12/2026.
- `tests/e2e/captures-9j18-suite-a-donner.spec.ts` et
  `tests/e2e/9k10-reprise-complete.spec.ts` — l'écran de reprise rempli avec
  `01/12/2026` (le premier avait un commentaire explicite expliquant avoir
  VÉRIFIÉ À LA MAIN que ce jour était ouvert et sans férié — exactement le
  geste que l'oracle rend inutile) : auraient cassé dès le 02/12/2026.

Les quatre sont corrigés par le même oracle (`chargerCalendrierAgence` +
`prochainJourOuvert`, sur l'agence A en isolation, sur DUCOS en e2e via
`cleDeJour` de `tests/e2e/setup/scene.ts`), chacun calculant son propre jour
dans son `beforeAll`.

### Ce qui a été examiné et volontairement GARDÉ en dur

Tout fichier portant une date de 2026-11-11 à 2026-12-31 a été lu, pas
seulement grep'é :

- `tests/isolation/verdict-pose-lecture.test.ts`,
  `pose-habilitation.test.ts`, `absence.test.ts`, `absences-2.test.ts`,
  `date-passee.test.ts` — utilisent délibérément une date PASSÉE avec
  `confirmer_date_passee: true` : ils éprouvent justement le chemin
  « date passée, forcée » (D141/D123). Une date qui reste dans le passé pour
  toujours ne peut pas casser — c'est l'inverse du défaut ci-dessus.
- `tests/isolation/avertissements-transmission-groupee.test.ts` — `JOUR` sert
  uniquement de contenu du courriel récapitulatif
  (`avertirApresTransmissionGroupee`, qui ne compare rien à l'horloge).
- `tests/isolation/taux-initial.test.ts`,
  `tests/isolation/succession-taux.test.ts` — `tauxEnVigueur` compare deux
  dates EXPLICITES l'une à l'autre (date d'effet vs. date demandée), jamais
  à l'heure réelle.
- `tests/isolation/blocage-agenda-verrous.test.ts` — commentaire du fichier :
  « aucun de ces scénarios ne lit l'horloge » (des bornes d'absence
  comparées entre elles, jamais à aujourd'hui).
- `dateDispoPrevue` (`suite-a-donner.test.ts`,
  `suite-a-donner-notifications.test.ts`, `suite-a-donner-reprise.test.ts`,
  `tests/e2e/captures-9k05-suites-a-donner-debloquees.spec.ts`,
  `tests/e2e/captures-9k07-suites-a-donner-relances.spec.ts`) — stockée
  telle quelle (`lib/suite-a-donner/depot.ts:206`), jamais validée contre
  « maintenant ».
- Plusieurs e2e (`9eq-fiche-intervention.spec.ts`, `9i8-*`,
  `captures-9i8*`) posent une ligne déjà `en_cours`/`cloturee`/`planifiee`
  par INSERT direct pour un test d'AFFICHAGE pur — aucune ne traverse
  `jugerPose`/`verdictDatePassee`.

### Épreuves rejouées

`pnpm test:isolation` (231 fichiers, 1997 tests, verts, `transmission-groupee`
et `suite-a-donner-reprise` compris) ; `CI=1 pnpm test:e2e --workers=1` sur
`export-registres.spec.ts`, `fiche-suspendue-gestes.spec.ts`,
`captures-9j18-suite-a-donner.spec.ts`, `9k10-reprise-complete.spec.ts` (10/10
verts) et `tous-les-ecrans-rendent.spec.ts` (60 verts, 3 ignorés — déjà
ignorés avant ce lot) ; `CI=1 pnpm verify` (format:check, typecheck, lint,
test, test:isolation, build) vert de bout en bout.

### État à la fin de cette reprise

- Partie d'`origin/main` (confirmé identique à `HEAD` avant de commencer),
  les quatre commits de la branche de garde `9K12-EXPORT-WINPRO-garde`
  rapportés par `cherry-pick` sans modification, puis ce commit-ci.
- `git status --porcelain` : vide après le dernier commit.
- Non rejoué ici (laissé à la file, comme demandé) : `verify:full`.
