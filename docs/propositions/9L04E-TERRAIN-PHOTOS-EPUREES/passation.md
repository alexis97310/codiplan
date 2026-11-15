# 9L04E-TERRAIN-PHOTOS-EPUREES — passation

Remplace B10 et l'ancien 9L04C-TERRAIN-PHOTOS. Refond complète de la rubrique Photos de la fiche terrain :
« Prendre une photo » bien visible (bouton principal 56 px, bleu plein, ouvre l'appareil), « Choisir dans
la bibliothèque » (sélection multiple), envoi automatique à la sélection, vignettes trois par ligne avec
légende et état, toucher une photo pour la légender (facultatif, après l'envoi) ou la supprimer (par son
auteur, jusqu'à « Terminer », derrière confirmation).

## 1. Ce qui a été mesuré avant d'écrire une ligne (point 0)

- **`components/interventions/photos-terrain.tsx`** (avant) : un `<input type="file">` natif visible (texte
  brut « Choisir un fichier… »), un bouton « Ajouter une photo » qui ne déclenchait aucune ouverture
  d'appareil, un champ légende saisi AVANT l'envoi. Aucune liste des photos déjà déposées dans ce
  composant lui-même : elle vivait dupliquée dans trois endroits appelants (`app/(mobile)/terrain/[id]/
  page.tsx`, `consultation-hors-reseau.tsx` en compteur seul, `checklist-terrain.tsx` en compteur seul).
- **`lib/documents/depot.ts`** : aucune fonction de suppression ou de modification de légende n'existait.
  `deposerPhotoIntervention` ne vérifie jamais le statut de l'intervention (seulement le périmètre
  technicien par affectation) — confirmé en lisant le code, jamais supposé.
- **Le modèle `Document`** ne porte AUCUNE colonne auteur. Premier réflexe (lu dans le docblock
  initialement écrit, puis **faux, mesuré faux**) : lire l'auteur dans `journal_audit`, puisque `document`
  est une table auditée par défaut depuis D55. **Mesure qui a cassé ce plan** : la politique de LECTURE du
  journal (`journal_audit_lecture`) exige la capacité `consulter_journal_audit`
  (`admin_societe`/`direction` seuls, `lib/auth/habilitations.ts`) — le rôle `technicien`, seul appelant
  possible de la route terrain, n'a jamais cette capacité. Un test d'isolation écrit pour le prouver
  (suppression par l'auteur réel) échouait systématiquement avec le refus « pas l'auteur », y compris pour
  le vrai auteur : la lecture sous ce rôle rend toujours zéro ligne. **D'où la seule migration de ce lot** :
  `Document.depose_par` (nullable, sans relation Prisma, même famille que `Notification.destinataire_id`,
  D39), posée à la création, jamais recalculée. Voir D258 (`docs/arbitrages.md`) et le docblock de la
  migration `20261114100000_photo_depose_par_9l04e`.
- **La contrainte `document_libelle_non_vide`** (migration `20260913100000_documents_l8`) interdit la
  chaîne vide en base. Puisque la légende n'est plus saisie au dépôt, `deposerPhotoIntervention` garde son
  repli existant sur `nom_fichier` quand aucune légende n'est fournie — ce repli est désormais ce que
  l'affichage détecte pour dire « Sans légende » (`libelle === nomFichier`), sans colonne ni migration
  supplémentaires.
- **Les photos d'un point de checklist** (`checklist_reponse_photo`, 9K28) sont déjà protégées par une clé
  étrangère `RESTRICT` vers `document` (`checklist_reponse_photo_societe_id_document_id_fkey`,
  migration `20261112180000_checklist_reponse_photo_9k28`) : la suppression tente, puis lit ce refus
  (même doctrine que la déduplication de `recevoir`, déjà écrite dans `lib/documents/depot.ts`) — jamais
  une seconde lecture qui pourrait diverger.

## 2. Ce qui a été fait

- **Migration** `20261114100000_photo_depose_par_9l04e` : `ALTER TABLE "document" ADD COLUMN "depose_par"
  uuid;`. Ajoutée à `lib/db/migrations-attendues.ts`. **MIGRATION À JOUER par Alexis** : staging, puis
  `pnpm db:deploy`, puis redéploiement Vercel (aucun seed à rejouer, colonne nullable).
- **`lib/documents/depot.ts`** : `deposerPhotoIntervention` écrit `depose_par: contexte.utilisateurId` à la
  création. `supprimerPhotoIntervention` (suppression réelle, catch `P2003` → `lien_checklist`) et
  `modifierLegendePhoto` (vide → repose `nom_fichier`), toutes deux via `photoModifiableDansTx` : périmètre
  technicien (même garde que le dépôt), statut fermé (`terminee`/`cloturee`/`annulee`, même liste que
  `lib/interventions/depot.ts:3247`), puis auteur (`depose_par === contexte.utilisateurId`). `auteursDesPhotos`
  (lecture en lot, pour l'affichage de `deposeParMoi` sur la fiche générale).
- **Deux routes neuves** : `app/api/terrain/[id]/photos/supprimer/route.ts`,
  `app/api/terrain/[id]/photos/legende/route.ts` — même capacité (`saisir_rapport`), même porte que le
  dépôt ; ajoutées à `ROUTE_CAPACITE` (`tests/unit/auth/porte.test.ts`, compte 114→116).
- **`components/interventions/photos-terrain.tsx`** : réécrit entièrement. Deux champs fichier CACHÉS
  (`sr-only`), chacun nommé par le `<label>` visible qui le déclenche (plus de bouton « Ajouter » séparé) ;
  envoi automatique PAR photo à la sélection (une photo en échec n'en bloque pas une autre) ; trois genres
  de vignette dans une seule grille (déjà confirmée par le serveur, encore en file hors réseau, tentative de
  cette session) ; une feuille (`Dialogue` existant) par photo au toucher, avec légende + quatre étiquettes
  rapides + Enregistrer sur une photo envoyée par son auteur, Supprimer derrière confirmation à deux temps,
  Retirer/Réessayer sur une tentative en file ou en échec. Nouveau geste `suppression_photo`
  (`lib/terrain/file-saisies.ts`, `lib/terrain/envoi-file.ts`) : une photo encore en file se retire LOCALEMENT
  sans appel réseau (son `documentId` n'existe pas encore côté serveur) ; une photo déjà envoyée part dans la
  MÊME file que l'ajout si le réseau manque.
- **`checklist-terrain.tsx`** et **`consultation-hors-reseau.tsx`** : adoptent le même composant avec
  `afficherExistantes={false}` — la checklist garde SON PROPRE compteur (`N photo(s) ajoutée(s)`), jamais une
  grille qui lirait `checklist_reponse_photo` (interdit par le ticket). Une photo prise sous un point de
  checklist pendant cette session s'affiche quand même (vignette « Envoyée » persistante, voir le docblock de
  `EtatTentative` dans le composant) — sans quoi elle disparaîtrait de l'écran dès l'envoi réussi, puisque rien
  d'autre (ni `router.refresh()`, ni la file) ne la rend visible sous un point.
- **`app/(mobile)/terrain/[id]/page.tsx`** : calcule `photosExistantes` (avec `deposeParMoi`) et
  `photosOuvertes` (statut), passés à `PhotosTerrain`. Les deux grilles codées en dur (page + ancienne liste)
  disparaissent, remplacées par le composant seul.
- **`lib/i18n/fr.ts`** : ~25 clés neuves (`terrain.photos.prendre`, `.bibliotheque`, `.etat_*`,
  `.etiquette_*`, `.supprimer*`, `.refus_*`, etc.), `terrain.photos.ajouter` et
  `checklist.terrain.ajouter_photo` retirées (plus aucun appelant).

## 3. Un défaut RÉEL trouvé par l'épreuve e2e (pas un artefact de test)

`selectionner` (gestionnaire `onChange`) lisait `evenement.currentTarget.files` puis remettait
`.value = ""` AVANT de parcourir cette liste. Sur le moteur de ce dépôt (Chromium, mesuré), `files` reste
une vue LIVE sur l'état de l'input : vider `value` vidait la liste AVANT que la boucle d'envoi ne la lise —
**aucune photo ne partait jamais**, ni en succès ni en échec, strictement rien ne s'affichait, en silence
(aucune erreur JS, aucun appel réseau). Corrigé en copiant (`Array.from`) la liste AVANT de vider le champ.
Sans l'épreuve de bout en bout — les épreuves unitaires et d'isolation, qui appellent les fonctions de
dépôt directement sans jamais passer par ce gestionnaire, ne pouvaient pas le voir — ce défaut serait parti
en production.

## 4. Épreuves

- **`tests/isolation/photo-suppression-legende.test.ts`** (10 cas, par la vraie route) : l'auteur supprime
  sa propre photo ; réaffectée, le nouvel affecté ne supprime pas la photo d'un autre (refus nommé) — et son
  JUMEAU, il supprime SA PROPRE photo après réaffectation ; une intervention terminée refuse (même pour
  l'auteur) ; une photo liée à une checklist est immuable ; une société B ne voit/supprime jamais le document
  d'une autre société ; légende posée, légende vidée (repose le nom de fichier), réaffectée refuse, terminée
  refuse.
  - **Pourquoi la réaffectation, et pas un second technicien « en renfort »** : le périmètre technicien
    (`dansLePerimetre`, forme « restreint ») n'admet qu'UN SEUL accès à la fois sur une intervention —
    exactement celui dont l'identifiant est affecté. Faire diverger auteur réel et affecté actuel exige donc
    de RÉAFFECTER l'intervention entre le dépôt et la tentative, jamais un second compte en accès simultané
    (qui n'existe pas à ce niveau).
- **`tests/e2e/9l04e-terrain-photos-epurees.spec.ts`** : scène jetable propre à ce fichier (même patron que
  `9k28a-point-photo-hors-reseau.spec.ts`), un seul test sériel : deux photos en ligne, légende par étiquette
  rapide, suppression confirmée, hors réseau (ajout ET suppression en file, envoyées au retour du réseau),
  intervention terminée (plus de Supprimer, message nommé). Six captures 375 px jouées par cette épreuve
  (`docs/propositions/9L04E-TERRAIN-PHOTOS-EPUREES/captures/`) : rubrique vide, deux photos envoyées
  (grille), feuille ouverte, confirmation de suppression, hors réseau, intervention terminée. **Capture
  manquante par rapport à la liste du ticket** : « trois photos aux trois états » simultanés (Envoyée/En
  attente/Échec côte à côte) — l'épreuve ne force jamais un échec explicite (hors budget de ce lot ; la
  grille affiche bien les trois états séparément dans d'autres captures : la suppression hors réseau MONTRE
  l'ambre, mais aucune n'a volontairement les trois en même temps).
- **Dix scènes e2e/unitaires existantes, mises à jour** pour la nouvelle disposition (`.getByRole("button",
  {name: "Ajouter une photo"})` disparu, `input[type="file"]` désormais deux champs distingués par
  `[capture]`) — même règle prouvée à chaque fois (une photo se dépose, s'affiche, fonctionne hors réseau),
  jamais assouplie : `rapport-terrain.spec.ts`, `offline/9f4h1-consultation.spec.ts`,
  `offline/9f4h3-mode-avion.spec.ts`, `offline/9f4h4-ouverture-a-froid.spec.ts`,
  `captures-9ewb-photos-en-base.spec.ts`, `9f5b-noms-accessibles.spec.ts`, `9k28a-point-photo-hors-reseau.
  spec.ts` (nouveau marqueur `data-checklist-point-id` sur la racine du composant, le `<form>` qui portait
  avant `checklist_point_id` ayant disparu avec la soumission native), `parcours-p1.spec.ts`,
  `parcours-navigateur-9f8.spec.ts`, `ecrans.spec.ts`. Gardiens D143/D144/D-12/Carte recalés sur le nouveau
  compte de `<Button>` (1→8) et de tailles de texte du fichier (déjà dans leurs listes fermées, aucune
  exemption nouvelle créée).
- `pnpm test` (5814 tests), `pnpm test:isolation` (2221 tests), `pnpm typecheck`, `pnpm lint` : tous verts.
  `pnpm verify:full` laissé à la file (consigne du pilote).

## 5. Ce qui N'A PAS été fait, et pourquoi

- **Légende hors réseau** : la modification de légende exige le réseau (route directe, jamais mise en
  file) — c'est une lecture littérale du ticket, qui ne nomme QUE la suppression pour la file hors réseau
  (« Hors réseau : la suppression part avec la file, comme l'ajout »). Un échec réseau sur la légende affiche
  un message d'erreur (« La légende n'a pas pu être enregistrée. Réessayez. ») sans rien garder : à signaler
  si Alexis attendait aussi la file ici.
- **Capture « trois photos aux trois états » simultanés** : voir §4.
- `pnpm verify:full` (feries:horizon, audit:partitions, test:e2e complet) non rejoué par moi (consigne
  explicite du pilote) — laissé à la file de nuit.

## 6. INTERDITS respectés

Check-lists, prestations et barre d'action non touchées — seules les DEUX lignes d'appel à `PhotosTerrain`
dans `checklist-terrain.tsx` ont changé (prop `afficherExistantes`, retrait de `libelleAjouter`), aucune
logique de checklist elle-même.

## 7. Reprise 9L04EA — rebase, cause mesurée, et ce que ce lot a trouvé en plus

Branche `9L04EA-REPRISE-PHOTOS-EPUREES`, partie d'`origin/main` (qui portait entre-temps 9L04I-CHECKLIST-
NON-CONFORME-DETAIL, 9L04K-REACTIVER-ACCES-INTERNE, 9L06-COMPTEUR-MINUTE-COMMENCEE, 9L04M-CHECKLIST-
RETRAIT-REPONSE). Les 7 commits de `9L04E-TERRAIN-PHOTOS-EPUREES-garde` reportés par cherry-pick, dans
l'ordre, sans modification de leur contenu propre — seuls les conflits de fusion avec le code publié
depuis ont demandé une résolution :

- **`lib/db/migrations-attendues.ts` / `prisma/schema.prisma`** : fusion triviale, les deux lignées
  ajoutaient des entrées différentes.
- **`tests/unit/auth/porte.test.ts`** : 114 (base commune) → 115 d'un côté (9L04K), 116 de l'autre
  (9L04E) ; les deux additions combinées donnent 117.
- **`docs/arbitrages.md`** : D254 était déjà pris par 9L04I au moment du cherry-pick (même jour,
  13/11/2026, deux lots distincts) — la décision de 9L04E (légende facultative après l'envoi,
  suppression par l'auteur jusqu'à « Terminer », D254 dans la version `-garde`) devient **D258**, suivant
  libre sur `origin/main`, et sa propre passation (§1 ci-dessus) corrigée en conséquence.
- **`app/(mobile)/terrain/[id]/page.tsx`** : conflit de structure (un autre lot a posé `BarreActionTerrain`
  autour de `<main>` entre-temps) — résolu à la main en conservant la structure actuelle et en appliquant
  SEULEMENT le changement de fond de 9L04E : la grille de photos codée en dur et l'ancien appel à
  `PhotosTerrain` remplacés par le nouvel appel (`photosExistantes`, `interventionOuverte`), dans la
  section « Photos » existante.

### La cause mesurée du recalage, et sa portée réelle

`tests/e2e/captures-9ewb-photos-en-base.spec.ts:131` (« capture — bloc photo avant envoi, à 1280px ») :
`getByText(fr["terrain.photos.titre"])` résout deux éléments dès qu'une photo d'un test PRÉCÉDENT de la
même scène sérielle existe déjà (le fichier partage une seule intervention entre ses 7 tests) — le `<h2>`
titre de la rubrique ET le `<h2 id=…>` du dialogue natif `<dialog>` d'une vignette (TOUJOURS dans le DOM,
même fermé — `getByText` lit le texte brut sans filtrer sur l'accessibilité, contrairement à `getByRole`)
portent la MÊME traduction. Corrigé par `getByRole("heading", { name: … })`, qui exclut un `<dialog>` sans
`open` (hors de l'arbre d'accessibilité). Le recalage touchait donc une photo d'un test antérieur dans la
MÊME scène, pas un défaut de rendu du premier test lui-même.

### Ce que la recherche de la même famille a trouvé EN PLUS (non listé par le contrat de recalage)

En rejouant la scène ci-dessus et sa famille, trois défauts RÉELS et DISTINCTS sont apparus — aucun n'était
nommé par `tickets/recales/9L04E-TERRAIN-PHOTOS-EPUREES.md` (fichier absent de ce poste au moment de cette
reprise ; la seule source disponible était ce passation-ci et les commits eux-mêmes) :

1. **Défaut de compilation** (`pnpm build` dans `pnpm verify`, PAS vu par `tsc` seul avant que le serveur
   e2e ne tente de compiler) : `components/terrain/checklist-terrain.tsx` gardait un second appel à
   `PhotosTerrain` avec `libelleAjouter` (le point non conforme AVEC détail, 9L04I — publié après le
   merge-base de 9L04E, donc jamais vu par ce lot) ; la prop a disparu avec la réécriture. Corrigé comme
   l'autre appel du même fichier (`afficherExistantes={false}`, pas de `libelleAjouter`).
2. **Même défaut, côté scènes** : `tests/e2e/9l04i-checklist-non-conforme-detail.spec.ts` et
   `9l04m-checklist-retrait-reponse.spec.ts` référençaient `fr["checklist.terrain.ajouter_photo"]`
   (retirée) — ET gardaient `formulaireDuPoint` scopé sur un `<form>` disparu avec la soumission native
   (9L04E l'avait déjà corrigé dans `9k28a-point-photo-hors-reseau.spec.ts`, jamais dans ces deux fichiers,
   publiés après coup). Passés au marqueur `data-checklist-point-id`, et la séquence
   `setInputFiles`+clic-bouton remplacée par l'envoi automatique + assertion sur l'état « Envoyée ».
3. **Un vrai blocage e2e, pas une histoire de locator imprécis** :
   `9l04m-checklist-retrait-reponse.spec.ts`, « refuse NOMMÉMENT le retrait d'une réponse qui porte une
   photo » — `getByRole("button").last()` visait jadis le bouton « Ajouter une photo » (disparu) et
   résolvait désormais le champ fichier caché de la bibliothèque, hors d'atteinte d'un clic réel (la scène
   retentait le clic jusqu'au timeout, 30 s × 2 tentatives). Mesuré : `detailNonConformeVide`
   (`lib/checklists/non-conformite.ts`) ne regarde QUE la suite et le commentaire, jamais la photo — la
   section reste DÉPLIÉE après rechargement même avec une seule photo déposée, donc rien à « rouvrir ». Le
   clic retiré ; la pastille « Non conforme » reste atteignable directement, même règle prouvée (retrait
   refusé, réponse intacte).
4. **Un défaut DISTINCT, pré-existant, révélé par la même réécriture** : `captures-9ewb-photos-en-
   base.spec.ts`, « le bon porte la photo déposée » — ce test visite `/interventions/[id]/bon` sous un
   compte TECHNICIEN, qui en est redirigé vers `/terrain/[id]` depuis D221 (9G8-TERRAIN-CONFIRMATIONS-ET-
   ACCES, 21/10/2026, antérieur à cette scène du 14/10/2026) : il a donc TOUJOURS testé la page terrain,
   jamais le vrai bon back-office. Il « passait » parce que l'ANCIENNE grille de la page terrain portait
   `alt={photo.libelle}` sur chaque miniature ; la nouvelle vignette (9L04E) pose `alt=""` (décoratif, la
   légende est un texte à côté). Assertion déplacée sur le `src` du document (`img[src*="/api/documents/"]`),
   qui prouve la même chose (une photo déjà déposée, pas une tentative locale, s'affiche) sans dépendre de
   l'alt. **À signaler à Alexis** : ce test n'a jamais capturé le vrai bon pour un technicien ; soit le
   compte de la scène change pour un rôle back-office, soit le test est renommé pour dire ce qu'il mesure
   réellement.
5. **Un second test unitaire corrigé deux fois** : `tests/unit/terrain/checklist-terrain.test.tsx` avait le
   même bouton disparu ; la première correction (`getByRole("button", { name: … })`) passait l'intention
   mais PAS l'épreuve — jsdom ne porte pas la correspondance HTML-AAM qui donne un rôle `button` implicite à
   `input[type=file]` dans un vrai navigateur (mesuré : l'épreuve e2e équivalente, sous Chromium, passe avec
   exactement ce rôle). `getByLabelText` corrige, en vérifiant l'association au `<label>` plutôt qu'un rôle
   calculé différemment selon le moteur.

### Flake observé, non corrigé (pas de cause mesurée, donc pas de délai changé)

`tests/e2e/9l04e-terrain-photos-epurees.spec.ts`, le test de bout en bout : `page.waitForResponse` posé
APRÈS `page.goto` peut manquer la réponse `/api/terrain/instantane` si elle revient avant l'enregistrement
du guetteur — observé une fois sur trois exécutions complètes de ce fichier, toujours rattrapé par la
retentative (`retries: 1` sous CI, déjà configuré, inchangé). Non touché : la cause réelle (l'ordre
`goto` → `waitForResponse`) est dans du code déjà publié par 9L04E lui-même, hors périmètre de cette
reprise, et CLAUDE.md §5 interdit d'assouplir une épreuve sans cause mesurée.

### Captures

Les captures 375 px de 9L04E lui-même (`docs/propositions/9L04E-TERRAIN-PHOTOS-EPUREES/captures/`) ne sont
PAS redevenues : aucun écran de CE ticket n'a changé de rendu dans cette reprise, seuls des localisateurs de
test et un appel de composant dans `checklist-terrain.tsx` (point non conforme AVEC détail, écran de
9L04I) l'ont été. Rejouer les scènes de cette famille a régénéré par effet de bord 33 PNG dans des tickets
sans rapport (dates affichées, antialiasing) — remis à l'état d'avant cette session (commit dédié), pour ne
pas polluer leur historique avec un bruit non intentionnel. Si Alexis veut les captures de 9L04I à jour
avec le nouveau bloc photo (bouton « Ajouter une photo » → « Prendre une photo »/« Choisir dans la
bibliothèque »), elles restent à refaire sous le ticket 9L04I, pas sous celui-ci.

### Vérification finale

`CI=1 pnpm verify` (format:check + typecheck + lint + test [5876 tests] + test:isolation [2255 tests] +
build) **vert**, rejoué deux fois. `pnpm test:isolation` seul avait d'abord montré un échec
(`performance-equipe.test.ts`, profondeur 48 pour un plafond de 46) — rejoué seul, passé ; rejoué dans la
suite complète, repassé vert aux deux tentatives suivantes : un aléa de charge machine (plusieurs
Playwright tournaient en parallèle sur ce poste), jamais un défaut du code.
