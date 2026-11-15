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
