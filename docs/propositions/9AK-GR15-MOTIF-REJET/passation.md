# 9AK-GR15-MOTIF-REJET — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

Le rapport d'un lot d'import (`/imports/{id}`) disait déjà **pourquoi** une ligne
était rejetée — le motif `saisie_refusee` traduit — mais jamais **quelle colonne**
ni **quelle valeur** était en cause. Un opérateur qui voulait corriger un fichier
de 300 lignes devait rouvrir le classeur et deviner.

Deux ajouts, aucune règle de gestion changée, aucune migration :

1. `lib/imports/modeles.ts` :
   - `colonneEnCause(valeurs, champs, schema)` — fonction pure qui rejoue
     `schema.safeParse(saisieDepuisLaLigne(valeurs, champs))` (la même lecture que
     `validerContre` et les `preparer*`, jamais une seconde règle) et rend
     `{ colonne, valeur }` de la première issue Zod qui désigne une colonne du
     gabarit, ou `null` (ligne saine, ou seule cause un parent résolu comme
     `client_id`).
   - `DETAIL_DE_SAISIE` — table `type → { champs, schema }` pour les SEPT types
     dont la saisie ne mélange pas colonnes brutes et valeurs calculées : clients,
     contacts, sites, modèles, prestations, familles, équipements.
2. `app/(back-office)/imports/types.ts` : `detailDuRejet(typeImport, rejetMotif,
   valeurs)` compose le rappel affiché — `"Colonne « <colonne> » : <valeur ou
   « vide »>"`, trois clés neuves de `lib/i18n/fr.ts`
   (`imports.motif.detail_prefixe`, `detail_milieu`, `valeur_vide`). `null` pour
   tout motif autre que `saisie_refusee` et pour les types absents de
   `DETAIL_DE_SAISIE`.
3. `app/(back-office)/imports/[id]/page.tsx` : sous le motif traduit de chaque
   ligne rejetée, le détail quand il existe, dans un `<span data-detail-rejet>`.

Pour l'exploitation : un rejet `saisie_refusee` sur un import de clients affiche
désormais, par exemple, « Colonne « Raison sociale » : vide » directement dans le
tableau des lignes rejetées, sans qu'aucune donnée nouvelle ne soit stockée — tout
est relu depuis `import_lot_ligne.valeurs`, déjà en base depuis le contrôle.

## Ce que j'ai mesuré

- `tests/unit/imports/colonne-en-cause.test.ts` (5 scénarios) : clients sans
  raison sociale → colonne + valeur vide ; ligne saine → `null` ; un autre
  gabarit (courriel de contact mal formé) → sa colonne et sa valeur ; un rejet
  dont la seule cause est un parent résolu (`client_id`, `roles`) → `null` ; un
  type absent de `DETAIL_DE_SAISIE` (historique, vgp, vgp_observations) → aucune
  entrée ; le code `MOTIF_SAISIE_REFUSEE` inchangé.
- `tests/unit/imports/types-dimport.test.ts` (+5 scénarios) : `detailDuRejet`
  composé, `null` sur autre motif, `null` sur motif absent, `null` sur type non
  couvert, `null` sur une ligne que la saisie accepte.
- `tests/e2e/imports-detail-rejet.spec.ts` : classeur clients fabriqué (une ligne
  `ERGO15B-1` sans raison sociale), contrôlé par l'écran, `[data-detail-rejet]`
  visible et contenant la colonne et « vide » — lot supprimé en `afterEach` par
  son propre id (cascade sur `import_lot_ligne`).
- Captures AVANT (`page.tsx` remisé par `git stash push -- ".../page.tsx"`) et
  APRÈS (code livré), 1280 et 375px, prises par
  `tests/e2e/captures-gr15-motif-rejet.spec.ts` —
  `docs/propositions/9AK-GR15-MOTIF-REJET/captures/`. AVANT : la ligne rejetée
  montre le motif seul. APRÈS : la même ligne montre en plus « Colonne «
  Raison sociale » : vide ».
- `pnpm format:check`, `pnpm typecheck`, `pnpm lint` verts avant chaque commit ;
  `pnpm test` : 279 fichiers, 2983 tests verts (2 commits, mesuré aux deux) ;
  `pnpm exec playwright test tests/e2e/imports-detail-rejet.spec.ts` et
  `captures-gr15-motif-rejet.spec.ts` (avant et après le stash) : verts.
  `CI=1 pnpm verify:full` lancé en un seul appel au premier plan après le second
  commit (voir résultat dans le message final).

## Ce que j'ai tranché, et pourquoi

- **`colonneEnCause` rejoue la MÊME lecture que le contrôle**, jamais une
  seconde règle : elle appelle `schema.safeParse(saisieDepuisLaLigne(valeurs,
  champs))`, exactement ce que `validerContre` et les `preparer*` appellent déjà.
  Une seconde règle de validation aurait divergé en silence un jour (§9, 01/09).
- **`DETAIL_DE_SAISIE` ne couvre QUE sept types**, pas les dix gabarits. Mesuré
  non établi pour l'historique, la VGP, ses observations et le second schéma des
  familles : leur saisie mélange colonnes brutes du fichier et valeurs calculées
  (dates lues, montants, origine posée par le chemin) — établir la
  correspondance colonne → chemin d'erreur pour ces quatre est un ticket à part,
  nommé dans le constat du ticket.
- **Le motif générique et son code restent inchangés** : `saisie_refusee` en
  base et dans les épreuves existantes n'a pas bougé — c'est un DÉTAIL qui
  s'affiche À CÔTÉ, jamais à sa place. Vérifié explicitement par un test.
- **Aucun stockage nouveau** : la ligne brute (`import_lot_ligne.valeurs`) porte
  déjà tout ce dont `colonneEnCause` a besoin — même principe de relecture que
  les rattachements d'historique (« ce n'est pas un recalcul, c'est la même
  lecture »).
- **Les captures AVANT/APRÈS** suivent la recette de
  `captures-9ah-gr14-prestations-sites.spec.ts` : un fichier séparé de la
  fonctionnelle, qui n'affirme PAS la présence de `[data-detail-rejet]` (pour
  rester rejouable avant le lot), rejoué deux fois avec `git stash` sur le seul
  `page.tsx`.

## Ce que je n'ai PAS fait

- Aucune migration, aucune colonne nouvelle sur `import_lot_ligne`.
- Aucune couverture des quatre types hors `DETAIL_DE_SAISIE` (historique, vgp,
  vgp_observations, second schéma des familles) — ils gardent le motif seul,
  comme avant.
- Aucun changement au fichier téléchargeable des rejets
  (`app/api/imports/[id]/rejets/route.ts`) : hors territoire, nommé comme ligne
  de passation dans le ticket.
- Aucune modification de `depot/` ni de `11-FILE.sh`.

## Les pièges pour la session suivante

- `colonneEnCause` ignore silencieusement toute issue Zod dont le `path[0]` ne
  correspond à aucune colonne de `champs` (un parent résolu comme `client_id`
  ou `roles`) — c'est voulu, mais un futur type ajouté à `DETAIL_DE_SAISIE` avec
  un champ obligatoire NON résolu et NON exposé par une colonne produirait un
  `null` silencieux plutôt qu'un détail. Vérifier la couverture
  colonne/champ existante (`tests/unit/imports/modeles.test.ts`,
  `gabarits-materiel.test.ts`) avant d'ajouter un type.
- Le format du rappel (`"Colonne « X » : Y"`) est composé par trois clés du
  dictionnaire concaténées dans `detailDuRejet` — si le texte doit changer, les
  trois clés (`detail_prefixe`, `detail_milieu`, `valeur_vide`) doivent rester
  cohérentes entre elles ; un test unitaire les vérifie composées ensemble.

## Ce qui reste à faire

- Étendre `DETAIL_DE_SAISIE` à l'historique, la VGP, ses observations et le
  second schéma des familles, le jour où la correspondance colonne brute ↔
  valeur calculée aura été établie pour chacun (mesuré non établi, voir le
  constat du ticket).
