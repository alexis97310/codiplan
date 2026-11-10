# 9K21-CHECKLIST-TERRAIN-SAISIE — passation

CK5 : la tuile de saisie checklist sur la fiche terrain EN LIGNE, le geste
`checklist` dans la file d'envoi hors réseau, et la ligne préremplie dans
« Suite à donner » quand un point passe « non conforme ».

## Ce que 9K21 ouvre dans `lib/checklists/depot.ts` (9K18)

`ChecklistDeLIntervention.disponible: true` gagne `checklistModeleLibelle:
string` — le libellé du modèle RÉSOLU (figé ou cascade), lu dans la MÊME
transaction que les points/réponses, jamais une seconde résolution. La tuile
l'affiche telle quelle (« Checklist : <libellé> ») : aucune catégorie de
provenance (modèle/sous-type/famille/générique) n'est recomposée à l'écran —
le libellé que l'atelier a choisi en paramétrant (CK3, 9K19) porte déjà toute
la précision utile.

`checklistDeLIntervention` SE RETIRE de `FONCTIONS_SANS_CHEMIN`
(`scripts/lib/chemins-de-depot.ts`) : `app/(mobile)/terrain/[id]/page.tsx` la
lit désormais pour nourrir `ChecklistTerrain`.

## La tuile — `components/terrain/checklist-terrain.tsx` (nouveau)

Un composant client, rendu par la page SEULEMENT si `checklist.disponible ===
true` (sinon rien ne change pour l'intervention — aucun gabarit résolu).

- **Repliée par défaut** : un en-tête (« Checklist : <libellé> »), un résumé
  (`etatDeCompletude`, réimporté tel quel depuis `lib/checklists/
  completude.ts` — SEULE source de vérité du compte, jamais recalculé par un
  second chemin) — « 12/15 points, 1 non conforme », ou sans la seconde
  moitié si `nonConformes === 0`. Un bouton bascule « Afficher le détail »/
  « Masquer le détail ».
- **Dépliée** : les points groupés PAR SECTION (dans l'ordre où `ordre`
  les a déjà triés côté dépôt), chacun avec son champ selon son type :
  trois boutons (Conforme/non conforme/Sans objet), un nombre + unité, une
  case à cocher (`CaseACocher`, CG8), un `<select>` natif, un texte court.
  Le badge « Obligatoire » (réutilise `checklist.parametrage.point_
  obligatoire` — même mot, pas de doublon) ne bloque RIEN ici (CK7, hors
  territoire).
- **Champs 16 px, cibles ≥ 44 px** (`size="lg"` des `Button`, `CaseACocher`
  déjà conforme) — mesuré sur les captures 375/1280.

### Le geste s'écrit dans la file, JAMAIS tenté en ligne par la tuile

À la différence du rapport ou des prestations (`rapport-automatique.tsx`),
`ChecklistTerrain` ne fait AUCUN `fetch` : chaque réponse (`enregistrer`)
met à jour l'état local ET rappelle `ajouterSaisie` avec la **différence
cumulée depuis la dernière base connue** (un `Record<checklistPointId,
valeur>`, jamais une `Map` — IndexedDB et `JSON.stringify` ne portent que des
objets simples). `null` efface la clé (jamais une valeur `null` envoyée au
serveur, qui la refuserait) — un point répondu puis « désélectionné » (la
case `fait` décochée, le `<select>` revenu à vide, le texte vidé) redevient
simplement absent de la différence, comme s'il n'avait jamais été répondu.

Au montage, une saisie DÉJÀ en file (reprise après une coupure, ou un
rechargement avant que « Envoyer » ne soit cliqué) écrase les valeurs
serveur **point par point** — jamais l'ensemble, qui effacerait un point
répondu par un AUTRE geste resté en file entretemps (il n'y en a qu'un,
mais la discipline est la même que `fusionnerBrouillonPrestations`).

## Le geste `checklist` — `lib/terrain/file-saisies.ts`, `envoi-file.ts`

- `GesteChecklist = { type: "checklist"; difference: Readonly<Record<string,
  unknown>> }`, ajouté à `Geste`, à `TYPES_COALESCABLES` (remplace, ne
  s'empile jamais) et à `gesteReconnu` (`difference` doit être un objet,
  jamais un tableau — sinon `CLE_MOTIF_FORMAT_INCONNU`, même discipline que
  les autres formes inconnues).
- `EVENEMENT_CHECKLIST_NON_CONFORME` / `signalerChecklistNonConforme` —
  même patron que `EVENEMENT_PRESTATIONS_ENVOYEES` : deux composants frères
  qui ne se parlent pas directement (voir plus bas).
- `ORDRE_PIPELINE["checklist"] = 2`, **LE MÊME RANG QUE LES PRESTATIONS** —
  les deux sont indépendantes, aucune ne conditionne l'autre ; à rang égal,
  le tri départage par `id` (l'ordre chronologique), comme tout autre ex
  æquo du pipeline.
- `corpsDe` (cas `"checklist"`) poste `reponses`, un tableau de
  `{checklist_point_id, valeur}` — EXACTEMENT la forme que
  `app/api/terrain/[id]/checklist/route.ts` (9K18) attend déjà ; aucune
  route neuve.

## La ligne préremplie — `lib/checklists/suite-preremplie.ts` (nouveau)

Deux fonctions PURES, testables sans React :

- `ligneNonConforme(section, libelle)` → `"<section> — <libellé> : non
  conforme"`, composée avec `ponctuation.separateur`/`ponctuation.
  deux_points` (jamais un tiret ou des deux-points en dur).
- `suiteAvecLigne(suiteActuelle, ligne)` → ajoute `ligne` à la fin (séparée
  par `\n`), SAUF si elle y figure déjà (`.includes`) — jamais en double,
  qu'elle y soit depuis cette session ou une précédente. Une ligne EFFACÉE
  par le technicien est réécrite au prochain passage à « non conforme » :
  cette fonction ne connaît que le texte ACTUEL, jamais un historique.

`ChecklistTerrain` compose la ligne et appelle `signalerChecklistNonConforme`
CHAQUE FOIS qu'un point `conforme_non_conforme_sans_objet` devient `"non_
conforme"` (pas seulement la première fois) — c'est `suiteAvecLigne`,
côté récepteur, qui porte l'idempotence, jamais un suivi d'état côté tuile.

`RapportTerrainAutomatique` écoute `EVENEMENT_CHECKLIST_NON_CONFORME` et
fusionne via `suiteAvecLigne` dans son propre état `suite` (`suiteRef`),
puis `ecrireBrouillonCourant()` + `demarrerMinuteurRapport()` — le texte
rejoint le brouillon local ET l'envoi différé du rapport, exactement comme
une frappe du technicien dans le champ lui-même.

## `flushTout` porte aussi la checklist, mais ne bloque jamais « Terminer »

`envoyerChecklist()` (nouveau, dans `rapport-automatique.tsx`) relit la file
pour une entrée `checklist` en attente et tente de l'envoyer EN LIGNE (même
patron que `envoyerRapport`/`envoyerPrestations` : `pasApresInstant` relevé
AVANT la tentative, `retirerSaisieCoalescable` après succès, `marquerRefusee`
après refus). `flushTout` l'appelle et porte son verdict dans l'objet rendu,
mais **`onClickTerminer` ne le lit JAMAIS** dans ses conditions de blocage —
contrairement au rapport, aux prestations et à la signature, un échec ou une
absence de réseau sur la checklist ne retient pas « Terminer » (D235 : un
point répondu — ou non — ne juge jamais la fin de l'intervention ; CK7 lira
`EtatCompletude.obligatoiresManquants` pour ça, hors territoire ici).

## i18n — `checklist.terrain.*`, et `checklist.refus.*`/`checklist.
enregistree` enfin traduits

9K18 avait nommé ces motifs de refus (route, dépôt, validation) sans qu'aucun
écran ne les affiche encore — le dictionnaire ne les portait donc pas (L0-11).
CK5 leur donne leur premier lecteur réel : `BoutonEnvoyer` (`LigneRefus`)
affiche le motif d'une entrée `checklist` refusée restée en file, exactement
comme il le fait déjà pour `rapport`/`prestations`/`signature`.

Fixtures de l'épreuve de bout en bout : `checklist.terrain.e2e.*` (trois
libellés de points semés par le test, routés par le dictionnaire — même
raison que `terrain.e2e.*`, 9F4-TERRAIN-ENREGISTREMENT-AUTO : le gardien
L0-11 instrumente aussi `getByRole(..., {name})`/`getByLabel`, y compris sur
une donnée de test, jamais seulement sur une vraie copie produit).

## Épreuves

- **Unitaires** (`tests/unit/checklists/suite-preremplie.test.ts`,
  `tests/unit/terrain/file-saisies.test.ts`,
  `tests/unit/terrain/envoi-file.test.ts`) : la différence cumulée remplace
  l'entrée précédente (jamais la fusion dans la file elle-même — c'est
  l'appelant qui cumule) ; la coalescence ne touche jamais une autre
  intervention ; `gesteReconnu` traverse un `Record` sans changement et
  rejette un `difference` qui n'est pas un objet ; `corpsDe` poste la forme
  EXACTE attendue par la route ; le rang 2 (après le rapport, avant
  « terminer », quel que soit l'ordre d'insertion) ; `ligneNonConforme` et
  `suiteAvecLigne` (vide, à la fin, jamais en double, réécrite après
  effacement).
- **Isolation** (`tests/isolation/checklist-domaine.test.ts`, étendu) :
  `checklistModeleLibelle` rendu sur les deux chemins déjà éprouvés (pin
  direct, cascade au niveau famille) — aucune épreuve neuve de cloisonnement
  nécessaire, le champ voyage dans la MÊME lecture déjà cloisonnée.
- **Bout en bout** (`tests/e2e/9k21-checklist-terrain-saisie.spec.ts`,
  SÉRIEL — un modèle GÉNÉRIQUE s'applique à toute intervention de la
  société, deux tests qui en posent un chacun ne peuvent pas tourner en même
  temps) : une intervention avec un modèle semé PAR LA SCÈNE (les cinq
  types, section groupées, un point obligatoire) — résumé 0/5 replié,
  saisie des cinq types, 5/5 avec 1 non conforme, la ligne préremplie EXACTE
  dans « Suite à donner », l'envoi par « Envoyer », les cinq réponses en
  base, le pin posé ; une intervention SANS aucune machine portée (donc le
  modèle de démonstration 9K20, `exige_machine: true`, ne s'y résout
  jamais) → aucune tuile. Captures 1280/375, avant/déplié/après, dans
  `docs/propositions/9K21-CHECKLIST-TERRAIN-SAISIE/captures/`.
- **Aucune épreuve hors réseau** (9K22, hors territoire) — aucune existante
  cassée : le geste `checklist` ne touche à aucun autre geste du pipeline,
  seul son RANG partagé avec `prestations` est neuf.

## Ce qui reste dû

CK6 (9K22, la saisie hors réseau — la coquille `/terrain-hors-reseau` et son
instantané devront porter les points/réponses de checklist, aujourd'hui
absents de `/api/terrain/instantane`) ; CK7 (le blocage de « Terminer » sur
un point obligatoire manquant — lira `EtatCompletude.obligatoiresManquants`,
amendera `peutTerminer`) ; CK9. **Garde de mise en production** : aucun
gabarit créé en production avant que 9K22 soit publiée (rappel du ticket).

## Vérification

`CI=1 pnpm verify` : format, typecheck, lint, test, test:isolation, build.
`pnpm vitest run tests/e2e/9k21-checklist-terrain-saisie.spec.ts` (hors
`verify`, joué manuellement ici) : 2 passés. `verify:full` est laissé à la
file de nuit.
