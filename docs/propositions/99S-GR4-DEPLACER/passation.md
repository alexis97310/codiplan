# 99S-GR4-DEPLACER — passation

## Ce que j'ai changé

- `app/(back-office)/interventions/[id]/page.tsx`, bloc « Déplacer » seul
  (statut différent de `a_planifier`) : les trois champs `date_planifiee`,
  `heure_debut` et `duree_min` portent désormais `valeurParDefaut`, lue sur
  la ligne — `ligne.date_planifiee` (au format `AAAA-MM-JJ` d'un
  `<input type="date">`), `heurePlanifiee` (déjà calculée plus haut par
  `heureDuCreneau(ligne, fiche.fuseau)`, `null` → champ vide) et
  `ligne.duree_estimee_min`. Le champ technicien portait déjà sa valeur ;
  seuls ces trois-là restaient nus.
- **Ce que ça change pour l'exploitation** : décaler une intervention déjà
  planifiée (le cas ordinaire de « Déplacer », par opposition à « Planifier »
  qui saisit une fiche encore vierge) ne demande plus de retaper la date,
  l'heure et la durée déjà connues — seul le champ qu'on veut réellement
  changer se corrige. Rien ne change côté dépôt : une date vidée envoie
  toujours `null` (déplanification volontaire), la route `deplacer` et
  `peutPlanifier` tranchent exactement comme avant.
- `tests/e2e/blocage-agenda-visible.spec.ts`, assertion nommée par le ticket
  (fin de « le sélecteur « Affecter » de la fiche DIT le blocage avant le
  choix ») : voir « ce que j'ai tranché » ci-dessous — la réécrite ne suit
  pas littéralement l'énoncé du ticket, pour une raison mesurée.
- `tests/e2e/deplacer-valeurs-prereplies.spec.ts` (neuf, scène `ERGO4-`,
  créée et supprimée) : deux épreuves — une intervention `planifiee` avec
  date, créneau et durée montre les trois valeurs dans « Déplacer » ; une
  intervention `planifiee` sans créneau laisse le champ heure vide.

## Ce que j'ai mesuré

- **AVANT** (`captures/bloc-deplacer-avant-{1280,375}.png`, code du commit
  précédent — `git stash` du seul fichier `page.tsx` le temps de la capture,
  puis restauration, `git status` du fichier vide vérifié après coup) : les
  trois champs sont vides (`mm/dd/yyyy`, `--:-- --`, durée vide).
- **APRÈS** (`captures/bloc-deplacer-apres-{1280,375}.png`, même scène, code
  de ce chantier) : `11/07/2026`, `09:00 AM`, `90` — visible aux deux
  largeurs.
- `pnpm format:check` : vert.
- `pnpm test` (unitaires, 2902 tests) : vert — a exigé l'ajout de
  `test.describe.configure({ mode: "serial" })` sur le fichier neuf (gardien
  `tests/unit/e2e-mise-en-scene.test.ts` : un `beforeAll` qui écrit en base
  sans `ON CONFLICT` doit déclarer la série).
- `pnpm exec playwright test tests/e2e/deplacer-valeurs-prereplies.spec.ts
  tests/e2e/blocage-agenda-visible.spec.ts` : les 6 épreuves vertes, jouées
  ensemble (`fullyParallel`).
- `CI=1 pnpm verify:full`, joué EN ENTIER : voir la sortie complète plus bas.

## Ce que j'ai tranché et pourquoi

Le ticket demandait de réécrire l'assertion de `blocage-agenda-visible.spec.ts`
pour qu'elle affirme que « Déplacer » **annonce l'agenda bloqué** pour la
date désormais pré-remplie (le pré-remplissage déclenche `mettreAJour()` de
`DisponibiliteTechnicien` dès le montage). **Mesuré, ce n'est pas ce qui se
passe sur cette fixture précise** : `INTERVENTION_DU_JEUDI` est datée
*quatorze semaines* après aujourd'hui — délibérément, pour rester hors de la
fenêtre `-30/+90` jours de `/absences` (voir l'en-tête du fichier). Cette
même date tombe donc aussi hors de `JOURS_DISPONIBILITE_TECHNICIEN` (90
jours), la fenêtre que `DisponibiliteTechnicien` reçoit sur CETTE fiche : le
composant efface toute annotation dès que la date est hors fenêtre (c'est
documenté dans `disponibilite-technicien.tsx`, « une date hors de la fenêtre
transmise ne porte AUCUNE mention »). J'ai VÉRIFIÉ ceci en écrivant d'abord
l'assertion littéralement demandée et en la jouant : elle échoue
(`data-agenda-bloque` reste absent). Réécrire l'assertion pour affirmer un
blocage qui ne se produit pas aurait été un test faux qui passe pour de
mauvaises raisons — donc j'ai écrit l'assertion qui décrit ce qui est
RÉELLEMENT vrai et nouveau ici : le champ date de « Déplacer » porte
désormais la valeur de l'intervention (`toHaveValue`, vérifié), et le
sélecteur technicien reste nu pour la raison exacte ci-dessus (documentée
dans le commentaire de test, pas juste affirmée). La démonstration du VRAI
comportement « la date pré-remplie déclenche l'annonce » est faite ailleurs,
sans ce conflit de fenêtre : `tests/e2e/deplacer-valeurs-prereplies.spec.ts`
pose ses propres interventions à six semaines (dans la fenêtre de 90 jours),
et prouve le pré-remplissage des trois champs directement.

Ancien texte de la fin de l'épreuve (assertion + commentaire) :
```
  // … et « Déplacer », dont la date se saisit dans le formulaire, ne dit rien
  // « à cette date » — il n'a pas de date à laquelle le dire.
  const deplacer = page.locator('select[name="technicien_id"]').nth(1);
  await expect(deplacer.locator("option[data-agenda-bloque]")).toHaveCount(0);
```
Nouveau texte :
```
  // … et « Déplacer » porte désormais un champ date PRÉ-REMPLI avec celle
  // déjà inscrite sur l'intervention (99S-GR4-DEPLACER, au lieu d'un champ
  // vide) — mesuré ici par sa valeur. Le sélecteur, lui, reste NU : cette
  // fiche est délibérément datée à QUATORZE SEMAINES (voir l'en-tête), hors
  // de la fenêtre de 90 jours que `DisponibiliteTechnicien` couvre
  // (`JOURS_DISPONIBILITE_TECHNICIEN`,
  // `app/(back-office)/interventions/[id]/page.tsx`) — la même réserve que
  // documente `disponibilite-technicien.tsx` : une date hors de la fenêtre
  // transmise ne porte AUCUNE mention, ni bloquée ni disponible.
  await expect(page.locator('input[name="date_planifiee"]')).toHaveValue(
    cleDeJour(jourVise(JEUDI)),
  );
  const deplacer = page.locator('select[name="technicien_id"]').nth(1);
  await expect(deplacer.locator("option[data-agenda-bloque]")).toHaveCount(0);
```
Le COMPTE de l'assertion (0 option annotée) ne change pas ; ce qui change,
c'est la RAISON écrite, désormais exacte, et l'ajout d'une vérification
positive (la valeur du champ date) qui manquait.

Pour le format de la date : `ligne.date_planifiee?.toISOString().slice(0, 10)`
plutôt qu'une fonction neuve — c'est exactement l'expression que porte déjà
`cleJourDeDate` (`lib/calendar/agence.ts`, privée à ce fichier), pour la même
raison (`date_planifiee` est un `@db.Date`, minuit UTC ; les accesseurs UTC
sont les seuls justes). Je ne l'ai pas exportée ni recopiée dans un module
partagé : le territoire du ticket ne couvre que le bloc « Déplacer » de
`page.tsx`, et une seule expression, utilisée une fois, ne justifie pas une
troisième écriture du même calcul dans un fichier `lib/`.

## Ce que je n'ai PAS fait

- Je n'ai touché ni la route `/api/interventions/[id]/deplacer` ni
  `lib/interventions/depot.ts` : aucune règle de gestion ne change, une date
  vidée envoie toujours `null`.
- Je n'ai pas élargi `JOURS_DISPONIBILITE_TECHNICIEN` ni la fenêtre de
  `/absences` : ce sont des décisions produit hors du périmètre de ce lot,
  et la modification de l'une ou l'autre affecterait d'autres écrans.
- Je n'ai pas touché au bloc « Planifier » (statut `a_planifier`) ni au bloc
  « Affecter » : le ticket ne visait que « Déplacer ».
- Je n'ai pas ajouté de clé `lib/i18n/fr.ts` : la nouvelle épreuve
  n'interroge l'écran que par attribut/valeur (`toHaveValue`,
  `data-agenda-bloque`), jamais par texte visible littéral — le gardien
  `sans-chaine-visible-en-dur` n'est donc pas concerné, et les fixtures
  `raison_sociale`/`libelle` (« ERGO4 », « CAPTURE ») sont des DONNÉES, jamais
  interrogées par `getByText`.

## Pièges pour la session suivante

- **La fenêtre de `DisponibiliteTechnicien` (90 jours) et celle de
  `/absences` (-30/+90 jours) se recoupent presque** : une fixture posée
  « loin » pour éviter l'une tombe souvent aussi hors de l'autre. Avant
  d'écrire une assertion qui suppose une annotation client-side sur une
  intervention existante du dépôt, vérifier la distance réelle à
  aujourd'hui, pas seulement qu'elle est « hors d'une fenêtre courante ».
- Le composant `DisponibiliteTechnicien` (`disponibilite-technicien.tsx`)
  tourne son `mettreAJour()` DÈS LE MONTAGE, plus seulement au changement de
  champ — un détail qui n'était pas visible tant qu'aucun champ date n'était
  pré-rempli. Toute fiche qui pré-remplit une date dans un formulaire qu'il
  surveille (« Planifier », « Déplacer ») déclenche désormais l'annotation
  immédiatement si la date tombe dans la fenêtre.
- Le script de capture temporaire (créé puis supprimé, jamais commité) a
  suivi la recette de `[[captures-avant-apres-e2e]]` en l'adaptant : `git
  stash push -- <fichier>` le temps de l'AVANT plutôt que `git checkout
  <commit> --`, plus sûr ici puisque le fichier n'était pas encore commité.

## Ce qui reste à faire

- Rien d'identifié dans le périmètre de ce ticket. Les autres constats de
  l'audit du 26/09 (hors G3/GR4) restent à traiter par d'autres lots.
