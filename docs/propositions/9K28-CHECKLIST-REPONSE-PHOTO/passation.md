# 9K28-CHECKLIST-REPONSE-PHOTO — passation

Décision verbatim d'Alexis du 11/11/2026 ~08h05, atelier des check-lists : « Oui, dès
maintenant » — revient sur le report du 29/10 inscrit au commentaire de `TypeReponseChecklist`
par 9K18-CHECKLIST-DOMAINE. Écrite en entier : `docs/arbitrages.md` D245 (renumérotée depuis D244
lors de la reprise 9K28B — voir plus bas, « Reprise 9K28B »).

## MIGRATION À JOUER par Alexis : staging puis DB migrate & seed, puis Vercel

**`20261112180000_checklist_reponse_photo_9k28`** — une seule migration neuve. Elle AJOUTE : la
valeur `photo` à l'énumération `TypeReponseChecklist`, la colonne `checklist_reponse.valeur_photo`
(booléen, exclusivité reposée sur SIX colonnes), la table `checklist_reponse_photo` (RLS, verrou
portail écriture, déclencheur d'audit). Elle ne modifie aucune migration déjà appliquée.

## Ce que ce ticket fait

1. **Le domaine** — `lib/checklists/depot.ts` gagne `enregistrerReponsePhoto(tx, params)`,
   appelée DANS la transaction de `deposerPhotoIntervention` (`lib/documents/depot.ts`) quand la
   route reçoit un `checklist_point_id`. **Tout ou rien (I6)** : un refus de la liaison lève
   (`RefusLienChecklistPhoto`, rattrapée) plutôt que de `return null` depuis une transaction
   Prisma interactive — un simple `return` la validerait quand même et laisserait le document
   orphelin. La classe de la photo est FORCÉE à `"client"` quand `checklist_point_id` est fourni
   (D235 : le client voit tous les points de sa checklist remplie).

   `enregistrerReponsePhoto` vérifie aussi que le document appartient à CETTE intervention
   (`document.intervention_id === interventionId`) — en plus de la clé étrangère composite qui
   ferme déjà l'autre société. Son seul appelant actuel (`deposerPhotoIntervention`) ne peut pas
   violer cette règle structurellement, mais la fonction est appelable directement (même patron
   que `checklistDuBon`) : le refus se tient ici, pas seulement chez cet appelant.

   La résolution/pin du gabarit (`resoudreOuPinnerVersionChecklist`) est EXTRAITE de
   `enregistrerReponses` et PARTAGÉE : une photo de point `photo` peut être la toute première
   réponse d'une intervention, et doit pinner exactement comme n'importe quelle autre réponse.

2. **Aucune seconde chaîne de dépôt** — `POST /api/terrain/[id]/photos` et
   `components/interventions/photos-terrain.tsx` gagnent un champ facultatif
   `checklist_point_id` (hidden input compris, pour le formulaire natif sans JavaScript), porté
   aussi par le geste hors réseau `GestePhoto` (`lib/terrain/file-saisies.ts`,
   `lib/terrain/envoi-file.ts`) — la photo et sa liaison au point partent par LA MÊME requête,
   dans l'ordre.

3. **Terrain** — `components/terrain/checklist-terrain.tsx`, cas `"photo"` de `champDuType` :
   une `PhotosTerrain` intégrée (`checklistPointId={point.id}`), `sansSession` enfin threadée
   (nouveau prop sur `ChecklistTerrain`, nécessaire parce que c'est la PREMIÈRE fois que cette
   tuile embarque un composant qui appelle `fetch` lui-même — avant 9K28 elle n'écrivait que par
   la file). Le nombre de photos déjà liées (`ReponseDeChecklist.nombrePhotos`,
   `valeurChecklistAffichee`) s'affiche en texte, sans galerie dédiée : la section « Photos »
   générale de la fiche terrain (déjà existante) montre les photos elles-mêmes — même Document,
   même route, elle les voit déjà sans aucun changement.

4. **Bons et fiche bureau** — `RenduReponseChecklistBon` gagne la nature `"photo"`
   (`documentIds`), rendue en vignette sous le point (`<img src="/api/documents/{id}/octets">`,
   déjà cloisonné par la politique « héritage » de `document`) dans `components/interventions/
   bon-tuiles.tsx` ET `app/(back-office)/interventions/[id]/page.tsx` (fiche bureau, 9K25) — deux
   call-sites, parce que la fiche bureau n'importe pas `TuileChecklist` du bon.

5. **Gardiens fermés mis à jour** — `tests/unit/db/inventaire.test.ts`,
   `tests/unit/db/perimetre-audit.test.ts` (49 tables désormais), `tests/isolation/portail-
   matrice.test.ts` (classification « client », chaînée), `scripts/lib/politiques-rls.ts`
   (`TABLES_FILIATION`/`FILIATION_ARBITREE`, et les trois politiques `verrou_ecriture_portail_*`
   écrites DANS la migration neuve — `checklist_reponse_photo` n'existait pas à 9K16, même patron
   que `sous_type_materiel` à 9K17A), `lib/db/migrations-attendues.ts`.

## UN FLAKE OUVERT, NON RÉSOLU — à lire avant de croire `pnpm test:isolation` rouge

**`tests/isolation/9k28-checklist-reponse-photo.test.ts`, le premier scénario (« accepte, lie la
photo au point… »), échoue par intermittence sous `pnpm test:isolation` COMPLET** (observé ~4 à 6
fois sur une dizaine d'exécutions complètes du run de ~240 fichiers) :

```
PostgresError: new row for relation "checklist_reponse" violates check constraint
"checklist_reponse_valeur_unique"
```

**Ce qui a été mesuré, et ce qui l'exclut :**
- Le scénario passe TOUJOURS seul, et TOUJOURS dans un sous-ensemble restreint (essayé : seul ;
  avec `9k24-checklist-bons.test.ts` + `9k25-checklist-fiche-bureau.test.ts`, 10 exécutions
  consécutives, jamais reproduit).
- Un diagnostic posé juste avant l'écriture (retiré du code final) a confirmé, à chaque
  occurrence de l'échec : `versionId`, `point` (type `photo`, bon `id`) et `params` sont corrects,
  et `checklist_reponse` ne porte AUCUNE ligne pour cette intervention au moment de l'appel.
  L'INSERT lui-même, dont le payload ne porte QUE `valeur_photo: true` parmi les six colonnes,
  est donc refusé par une contrainte qui ne devrait voir qu'une seule colonne non nulle.
- Remplacé l'`upsert` par un `findFirst` puis `create`/`update` explicites (donc sans `INSERT …
  ON CONFLICT`) : MÊME échec, à l'identique, sur le `create()` nu. Ce n'est donc pas un artefact
  de la forme SQL générée par `upsert`.
- Le code final a été REMIS à la forme `upsert` (plus idiomate, même patron qu'`enregistrerReponses`) :
  les deux formes échouent au même taux, aucune n'est donc préférable sur ce seul critère.

**Hypothèse, non vérifiée davantage faute de visibilité sur les requêtes réellement envoyées à
Postgres pendant l'échec** : un problème côté moteur de requêtes Prisma / pool de connexions sous
le débit très élevé d'une exécution complète (~2150 tests, ~120 s) — PAS un défaut de la donnée
métier, que le diagnostic a prouvée correcte à chaque occurrence.

**Ce qui n'a pas été fait, par discipline (§5, interdit absolu)** : ni retry, ni `skip`, ni
assouplissement de l'assertion. Le scénario reste tel qu'écrit.

**À faire par qui reprend** : rejouer `pnpm test:isolation` (plusieurs fois si besoin — le run
isolé passe toujours) ; si ça persiste, inspecter `pg_stat_activity`/les logs Postgres au moment
précis de l'échec, ou isoler avec `log_statement = 'all'` pendant un run complet pour voir la
requête SQL réellement reçue par le serveur sur ce `INSERT`.

## Points immuables (D235) inchangés

Aucun gabarit semé par ce lot — les points `photo` seront désignés à la saisie des gabarits
(CK10, décision du 11/11/2026, hors territoire ici).

## NON FAIT — budget de temps épuisé avant ces points

- **Épreuves de bout en bout** (375 px terrain, 1280 px bon/fiche bureau) : non écrites. Le
  chemin complet (migration, domaine, route, offline, bons, fiche bureau) est couvert par les
  épreuves unitaires et d'isolation ci-dessus, mais AUCUNE épreuve Playwright n'exerce l'écran
  réellement pour ce ticket.
- **Captures AVANT/APRÈS** (375 et 1280 px) : non prises. `docs/propositions/9K28-CHECKLIST-
  REPONSE-PHOTO/captures/` reste vide. `scripts/captures.mts` n'a pas été rejoué.
- **Relecture du gardien `getByText`/`getByRole` non exacts sur « Photo »/« Ajouter »** dans
  `tests/e2e/**` : non faite.

Ces trois points restent DUS. Le prochain lot sur ce territoire — ou une session dédiée avant de
livrer CK10 — doit les traiter avant de considérer 9K28 réellement terminé au sens de la
définition du §5.

## Portée (fichiers touchés)

Voir `docs/arbitrages.md` D245, section « Portée ».

## Reprise 9K28A (12/11/2026) — ce qui a été fait, et ce qui reste dû

**1. La cause du recalage (D243/D244) : une collision de numéro, pas une ligne mal écrite.**
9K29-PRESTATIONS-PAR-TYPE-INTERVENTION a publié SA décision sous le numéro D243 pendant que ce
ticket l'avait déjà pris pour la sienne — les deux sections partageaient le même titre `## D243`
dans `docs/arbitrages.md`. Le gardien (`scripts/lib/cablage-arbitrages.ts`,
`lireDecisions`) fusionne alors les deux corps sous UNE SEULE entrée (« deux sections distinctes
portent cette référence »), et le mélange qui en résulte casse la ligne `**Règles amendées :**`
des deux côtés — c'est cette casse, pas une faute de frappe, que les deux gardiens
(`tests/unit/docs/amendements-arbitrages.test.ts`, `tests/unit/docs/cablage-arbitrages.test.ts`)
rapportaient. **Renumérotée D244** (prochain numéro libre, mesuré par grep sur tout le dépôt avant
de l'écrire), avec la mise à jour de ses deux références dans ce document. Au passage, sa section
a été reformatée en `### ` (sous-titres), comme le fait TOUTE autre décision de ce document :
c'est cette forme — et non le texte de la ligne « Règles amendées » elle-même — qui fait sortir
cette ligne du corps scruté par `lireDecisions` une fois la section correctement reconnue (la
forme à bloc `**gras.**` que ce ticket avait écrite la laissait, elle, DANS le corps scruté, où
elle doit alors correspondre exactement à `**Règles amendées :** RG-xxx-nn[, …]` ou être absente —
jamais une prose libre). Les deux gardiens passent (`pnpm vitest run
tests/unit/docs/cablage-arbitrages.test.ts tests/unit/docs/amendements-arbitrages.test.ts`).

**2. L'échec intermittent d'isolation — trouvé et corrigé.** Reproduit en 2 essais sur 4 en
lançant `pnpm test:isolation` en boucle (jamais en solo : le fichier `9k28-checklist-reponse-
photo.test.ts` seul est toujours vert, la cause est donc forcément un AUTRE fichier de la suite).
Diagnostic posé dans `enregistrerReponsePhoto` (retiré avant de rendre la main) : au moment de
l'échec, AUCUNE ligne `checklist_reponse` ne préexistait sous la clé visée (donc pas une ligne
orpheline d'une autre épreuve) — mais `pg_get_constraintdef` montrait que la contrainte
`checklist_reponse_valeur_unique`, EN FORCE à cet instant, portait encore CINQ colonnes
(`valeur_conforme, valeur_mesuree, valeur_fait, valeur_choix, valeur_texte`), sans `valeur_photo`.
**Cause : `tests/isolation/checklists.test.ts`, test JUMEAU « la contrainte retirée, DEUX valeurs
à la fois PASSENT »** (describe `checklist_reponse — l'exclusivité…`) DROP la vraie contrainte
pour la durée du test, puis la REPOSE dans son `finally` — mais sur la forme à CINQ colonnes
d'avant 9K18/9K28, jamais mise à jour quand 9K28 a étendu la contrainte réelle à SIX colonnes. La
base de test étant PARTAGÉE entre tous les fichiers de la suite d'isolation (une seule base,
jamais réinitialisée entre fichiers), ce test laissait la contrainte affaiblie pour le reste de
l'exécution : toute réponse `photo` insérée APRÈS lui (num_nonnulls = 0 sur les cinq anciennes
colonnes, `valeur_photo` n'étant pas compté) violait alors la contrainte — selon l'ordre
d'exécution des fichiers, non garanti, d'où l'intermittence. **Corrigé** : la restauration du
`finally` porte désormais les SIX colonnes, avec un commentaire qui nomme explicitement le piège
pour la prochaine extension de cette contrainte. `pnpm test:isolation` complet joué **CINQ fois de
suite après le correctif : vert les cinq fois.**

**3. E2e et captures (375/1280) — ÉCRITES, NON VÉRIFIÉES.**
`tests/e2e/9k28a-point-photo-hors-reseau.spec.ts` : une photo au point en ligne, une seconde hors
réseau sur la page déjà chargée, l'envoi au retour du réseau (même patron que
`tests/e2e/offline/9f4h3-mode-avion.spec.ts`), puis le bon client et le bon interne à 1280 —
captures prévues dans `docs/propositions/9K28-CHECKLIST-REPONSE-PHOTO/captures/`. **Blocage
d'environnement, mesuré et reproduit indépendamment de ce lot** : `next build` (invoqué par
`playwright.config.ts` pour son serveur) sature le tas à 6144 Mo et échoue par
« JavaScript heap out of memory » — reproduit à l'identique par un `pnpm run build` NU, sur `main`
avant tout changement de ce lot, donc pas une régression de 9K28A. Le tas accepte 9500 Mo en
contournant le script (`NODE_OPTIONS=--max-old-space-size=9500 pnpm exec next build`, qui build
SEUL réussit deux fois de suite) mais `pnpm run build` RÉÉCRIT `NODE_OPTIONS` à 6144 quoi qu'on y
mette avant (`"${NODE_OPTIONS:-} --max-old-space-size=6144"` : la valeur la PLUS À DROITE gagne
toujours chez V8) — et lancer le serveur à la main en aval de ce contournement le prive des
variables que `environnementDuServeur()` lui aurait posées, la connexion échouant alors. L'épreuve
n'a donc **jamais tourné** ; ses sélecteurs et son scénario sont écrits par analogie stricte avec
des épreuves existantes déjà vertes (`9f4h3-mode-avion.spec.ts`, `9k22-checklist-hors-
reseau.spec.ts`) mais RIEN NE PROUVE qu'ils soient exacts. `tests/e2e/tous-les-ecrans-
rendent.spec.ts` et `CI=1 pnpm verify` (étape 5 de ce ticket) sont, pour la même raison,
**NON JOUÉS** — les deux exigent ce même `build`.

**CE QUI RESTE DÛ** : faire tourner `tests/e2e/9k28a-point-photo-hors-reseau.spec.ts` dès qu'un
environnement dispose d'assez de mémoire pour `next build` (ou que le plafond du script `build`
est revu — hors du périmètre de ce lot, qui touche aux scripts de file et à `depot/`, les deux
interdits ici), corriger ce que l'épreuve révélera, prendre les captures, puis rejouer
`tous-les-ecrans-rendent.spec.ts` et `CI=1 pnpm verify` au complet avant de considérer ce lot
terminé au sens du §5.

## Reprise 9K28B (12/11/2026) — la mémoire, la collision de migration, l'épreuve jouée

**1. LA COLLISION DE MIGRATION.** `20261111090000_checklist_reponse_photo_9k28` partageait son
horodatage avec `20261111090000_prestations_par_type_intervention_9k29` — publiée entre-temps sur
`origin/main`, et triée AVANT elle. Renommée **`20261112180000_checklist_reponse_photo_9k28`**
(contenu inchangé), strictement postérieure à toutes les migrations d'`origin/main` ; sa fixture
`tests/isolation/fixtures/base-agee/`, `lib/db/migrations-attendues.ts` et les deux mentions dans
ce document suivent. La fusion de `docs/arbitrages.md` collisionnait pareillement : D244 avait été
pris sur `origin/main` par 9L00 pendant que cette branche portait encore son propre D244 (déjà
renuméroté depuis D243 par la reprise 9K28A ci-dessus, pour une collision similaire avec 9K29).
Renumérotée **D245**.

**2. LA CAUSE DE L'OOM, TROUVÉE PAR BISSECTION — LE SCHÉMA, PAS LE CODE APPLICATIF.** `pnpm build`
de 9K28A mourait systématiquement à « Linting and checking validity of types », ~6,46-6,48 Go RSS
(`main`, 8ccdaff3c, passe au même endroit, ~6,40-6,48 Go — `tsc --noEmit` seul passe sur les deux,
6,23 Go `main` contre 6,34 Go cette branche, +108 Mo). Isolé en revenant TOUT le code applicatif de
9K28/9K28A (y compris les deux grosses épreuves neuves) à `origin/main`, un fichier à la fois puis
d'un bloc : avec SEUL `prisma/schema.prisma` gardant sa version neuve, le build échoue encore à
l'identique ; schéma ÉGALEMENT revenu, il passe (6,44 Go). La cause est donc le schéma, jamais le
code applicatif ni les épreuves.

**DANS le schéma**, le modèle neuf `ChecklistReponsePhoto` lui-même n'était pas en cause : ses
trois réciproques (`Societe.checklistReponsePhotos`, `ChecklistReponse.photos`,
`Document.checklist_reponses`) — posées sur trois des modèles déjà les plus reliés du schéma —
alourdissaient le type Prisma généré pour CHACUN d'eux, répété à travers tout le dépôt. Mesuré par
`grep` sur tout le dépôt : aucune des trois n'est jamais lue, ni par un `include`, ni par un accès
direct — `photosParReponse` (`lib/checklists/depot.ts`) interroge toujours `checklistReponsePhoto`
directement. `@ignore` (Prisma) les retire du client généré sans toucher au schéma RÉEL : aucune
des trois n'a de colonne propre, le lien réel reste `ChecklistReponsePhoto.{societe,reponse,
document}_id`, posé dans la migration — inchangée. **Après** : `pnpm build` passe, trois fois de
suite (6,47 / 6,46 / 6,45 Go RSS, comparable à `main`) ; `tsc --noEmit` seul : 6,24 Go, à 12 Mo de
`main` (contre +108 Mo avant correctif). Aucune limite de mémoire relevée, aucun contrôle
désactivé — voir le commentaire posé sur `ChecklistReponsePhoto` dans le schéma, qui porte cette
même mesure pour qui la retrouverait sans cette passation.

**3. L'ÉPREUVE DE BOUT EN BOUT, JOUÉE POUR LA PREMIÈRE FOIS — deux défauts, tous deux dans
L'ÉPREUVE, aucun dans l'application.** Une fois le build débloqué, `9k28a-point-photo-hors-
reseau.spec.ts` a révélé :
   - `input[type="file"]` et `getByRole("button", { name: "Ajouter une photo" })` SEULS y sont
     ambigus : la fiche terrain porte DEUX formulaires `PhotosTerrain` (la section « Photos »
     générale, et celle embarquée au point `photo`), même composant, même libellé de bouton.
     Corrigé par `formulaireDuPointPhoto`, qui scope les deux sur le champ caché
     `checklist_point_id` posé UNIQUEMENT par l'instance du point.
   - Les deux photos de la fixture étaient VISUELLEMENT identiques (même PNG 1×1 transparent) :
     `PhotosTerrain` les réduit côté client avant l'envoi, et le dépôt dédoublonne par empreinte
     SHA-256 du résultat, PAR INTERVENTION (`lib/documents/depot.ts`) — deux photos identiques
     après réduction produisent la MÊME empreinte, et la seconde ne crée donc aucun second lien
     (`liens` mesuré à 1 au lieu de 2 attendu, le temps de ce diagnostic). Remplacée par
     `construirePngDeTest` (même patron que `9ez-logo-societe.spec.ts`), une couleur distincte par
     photo.

   Les deux scénarios passent. Captures prises (375 terrain avant/après, 1280 bon client/interne,
   `docs/propositions/9K28-CHECKLIST-REPONSE-PHOTO/captures/`).

**4. CE QUI A ÉTÉ REJOUÉ, VERT** : `pnpm test:isolation` complet, deux fois de suite, puis une
troisième fois DANS `pnpm verify` — aucune trace du flake de la reprise 9K28A.
`tests/e2e/tous-les-ecrans-rendent.spec.ts` (61 passés, 4 ignorés — pré-existant, hors ce lot).
`CI=1 pnpm verify` au complet (format:check, typecheck, lint, test, test:isolation, build) :
**vert**.

**MIGRATION À JOUER par Alexis : staging puis DB migrate & seed, puis Vercel** —
**`20261112180000_checklist_reponse_photo_9k28`** (nom final, renommée au point 1 ci-dessus),
inchangée depuis 9K28 sur le fond (voir l'encadré en tête de ce document) ; pas encore jouée en
production.
