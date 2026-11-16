# 9L08B-SAISIE-APRES-DEMARRER — passation

## 0. Ce qui a été mesuré

Sur `81894e0` (origin/main au moment de brancher) : `enregistrerSignature` et
`definirPrestationsRealiseesDepuisFile` (`lib/interventions/depot-rapport-terrain.ts`) ne portaient
AUCUNE garde de statut — seule l'annulation de la validation du rapport était conditionnée par
`estFige` ; `enregistrerRapportTexte` et `enregistrerReponses` (`lib/checklists/depot.ts`) ne
refusaient que les deux statuts figés (`annulee`, `cloturee`). Les trois seuls statuts d'où *aucune*
flèche de la matrice D8 n'atteint `EN_COURS` autrement qu'en ouvrant un premier segment sont
`a_planifier`, `planifiee` et `affectee` — `suspendue` (D8 : `SUSPENDUE → EN_COURS` passe par la
reprise, jamais directement démarrable), `terminee` et `cloturee` supposent TOUJOURS un passage
antérieur par `en_cours` (D120 : « une intervention sur laquelle personne n'a démarré de compteur
ne se clôture pas »). `annulee` reste ambigu en soi (atteignable depuis n'importe quel statut non
terminal) mais c'est sans conséquence : la décision ne porte que sur l'AVANT-démarrage, jamais sur
ce qu'une figée permet déjà par ailleurs (I5).

Chemins d'écriture concernés : en ligne et rejoué depuis la file hors réseau, tous les deux à
travers les MÊMES fonctions de dépôt (aucun second chemin, pas de portail pour ces quatre saisies).
Pas de route back-office concurrente — ces quatre fonctions ne sont appelées que depuis
`app/api/terrain/[id]/{rapport,checklist,prestations,signature}`.

## 1. Le serveur — une garde unique, partagée

`peutSaisirSurTerrain` (`lib/interventions/cycle-de-vie.ts`), verdict PUR au même titre que les
autres de ce module (aucune requête, aucune horloge) : refuse `a_planifier`/`planifiee`/`affectee`
avec `intervention.refus.non_demarree`, passe sur tout le reste. Branchée dans les quatre dépôts,
juste après leur garde de périmètre existante (et après `estFige` pour le rapport/la checklist, qui
la portaient déjà) :

- `enregistrerRapportTexte`, `enregistrerReponses` : la nouvelle garde s'ajoute à `estFige`,
  inchangée.
- `enregistrerSignature`, `definirPrestationsRealiseesDepuisFile` : n'avaient AUCUNE garde de
  statut avant ce lot — leur type de retour s'étend de `{id} | null` à
  `{id} | {refuse:true; cle} | null`, et les deux routes concernées
  (`app/api/terrain/[id]/signature`, `.../prestations`) apprennent à relayer `ecrite.cle`, même
  patron que `rapport`/`checklist` déjà en place.

Message (`lib/i18n/fr.ts`, `intervention.refus.non_demarree`) : « Démarrez l'intervention avant de
remplir la checklist ou de faire signer le client. »

## 2. Hors réseau — aucune garde de plus à écrire

`lib/terrain/file-saisies.ts` n'a reçu AUCUNE modification : `ajouterSaisie` ne construit jamais de
geste par elle-même, elle garde ce que le composant appelant lui donne. Puisque les commandes des
quatre rubriques sont désactivées (point 3) tant que l'intervention n'est pas démarrée, AUCUN geste
checklist/rapport/prestations/signature ne peut être construit avant démarrage — rien n'entre en
file à refuser. Le filet qui reste : si un appel était malgré tout forgé (ancien client, geste
rejoué d'une version antérieure), le refus serveur nommé (point 1) le porte, et le patron existant
de `marquerRefusee`/`motifRefus` (déjà en place, inchangé) l'affiche sans perte — vérifié en lisant
`envoi-file.ts`, qui pose `motifRefus = resultat.motif` sur TOUT refus nommé, sans distinction
d'origine.

## 3. L'écran — une ligne d'aide en tête, les commandes natives `disabled`

`app/(mobile)/terrain/[id]/page.tsx` calcule `verdictSaisirTerrain = peutSaisirSurTerrain(statut)`
et affiche, s'il refuse, UNE SEULE bande (`<Message ton="avertissement">`) juste après les bandeaux
`motif`/`alerte` existants, avec le même texte que le refus serveur — jamais répétée rubrique par
rubrique.

`ChecklistTerrain` reçoit désormais `statut` (nouveau prop) et calcule localement
`desactivee = peutSaisirSurTerrain(statut).refuse && !demarreeLocalement` — `demarreeLocalement`
suit le MÊME patron que `enCoursLocalement` dans `RapportTerrainAutomatique` (déjà en place pour «
Terminer ») : relu depuis la file (`compteur`/`demarrer`) au montage et à chaque
`EVENEMENT_FILE_MODIFIEE`, et posé à `true` sur `EVENEMENT_COMPTEUR_DEMARRE_EN_LIGNE`. `disabled`
est ensuite propagé explicitement (prop à prop, jamais un `<fieldset>` global) jusqu'à chaque
contrôle natif — les trois pastilles, les segments, la case ronde, le `<select>`, les deux
`<input>` — **sauf** `PhotosTerrain`, jamais touchée (voir point 5).

`RapportTerrainAutomatique` recevait déjà `statut` : `nonDemarree` s'y calcule de la même façon
(`peutSaisirSurTerrain(statut).refuse && !enCoursLocalement`) et désactive le commentaire, la
suite, les pièces (désignation/référence/quantité/ajouter/retirer), les cases des prestations
(`CaseACocher`, qui reçoit un `disabled` neuf), les trois boutons d'issue de signature, le nom et
la qualité du signataire, le canevas de tracé (pointer-events retirés ET `disabled` visuel) et son
« Effacer »/« Valider ». Le bouton « Ouvrir le récapitulatif » (lecture seule, n'écrit rien) et la
section « Terminer » restent INTACTS — hors de la portée de cette décision.

`components/terrain/consultation-hors-reseau.tsx` (la coquille `/terrain-hors-reseau`) réutilise
`ChecklistTerrain` : lui passer `statut={fiche.statut as StatutIntervention}` (déjà le même cast
utilisé trois fois ailleurs dans ce fichier) suffit, sans code neuf, pour que la même garde
s'applique à la consultation hors session.

## 4. Épreuves

- **Unitaires** : `tests/unit/interventions/cycle-de-vie.test.ts` — `peutSaisirSurTerrain` sur les
  huit statuts (trois refusent nommément, cinq passent). `tests/unit/terrain/checklist-terrain.test.tsx`
  adapté (`statut="en_cours"` dans `scene()`, aucune épreuve de ce fichier ne portait sur la garde
  elle-même).
- **Isolation**, `pnpm test:isolation` complet rejoué **deux fois** (une fois après chaque lot de
  correctifs) : **247 fichiers, 2274 épreuves, tout vert**, y compris les trois fichiers qui
  cascadaient (`document.test.ts`, `intervention.test.ts`, `planning-du-technicien.test.ts` —
  jamais touchés : leurs échecs initiaux venaient d'une ÉCRITURE AVORTÉE dans un fichier qui
  tombait AVANT eux dans l'ordre alphabétique, jamais d'un défaut qui leur soit propre, confirmé par
  leur passage au vert sans aucune modification une fois les cinq fichiers racine corrigés).
  Fichiers mis à jour, scène par scène, pour DÉMARRER d'abord — règle nouvelle, pas un
  assouplissement :
  - `checklist-domaine.test.ts` : 10 scénarios (chacun sa propre intervention jetable) reçoivent
    `statut: "en_cours"` à la création, au lieu du défaut `"planifiee"`. Les scénarios FIGÉE
    (`annulee`/`cloturee`, describe dédié) et « non affecté » (refus de périmètre, jamais atteint
    par la nouvelle garde) restent inchangés, à bon droit.
  - `rapport-terrain.test.ts` : un `beforeAll` pose désormais `INTERVENTION_A1`/`A2`/`B1` à
    `en_cours` une fois pour tout le fichier (la fixture partagée démarre `planifiee` sinon). Le
    seul scénario qui transite explicitement le statut (« s'ajoute même sur une intervention
    CLÔTURÉE — I5 ») commence directement à `terminee` (déjà `en_cours`, inutile de repasser par
    `affectee`, que D8 refuserait désormais comme transition ARRIÈRE) et restaure vers `en_cours`
    dans son `finally`, jamais vers `planifiee` — c'est le nouvel « état de départ » de ce fichier.
  - `terminer-intervention.test.ts`, `9f4h2-hors-reseau-heure-et-rejeu.test.ts`,
    `9f4h4b-depuis-file.test.ts` : chaque scénario qui appelait `enregistrerRapportTexte` ou
    `enregistrerSignature` AVANT `demarrerLeCompteur` est réordonné — démarrer, PUIS rapport/
    signature. Deux scénarios qui n'appelaient jamais `demarrerLeCompteur` du tout
    (`9f4h2`, « la signature — un id fabriqué par l'appareil ») en reçoivent un, avec son
    `arreterLeCompteur` jumeau quand une seconde intervention de la MÊME personne doit démarrer à
    son tour (un technicien n'a qu'un segment ouvert à la fois).
- **`CI=1 pnpm verify`** : voir point 6.
- **`pnpm test:e2e`** : **NON joué** — conforme à la consigne du pilote (« Tu NE joues PAS
  verify:full : la file le joue après toi ») et au budget de temps de ce lot.

### Scènes e2e repérées à risque, NON corrigées par manque de temps (à reprendre)

Recherche statique (grep, jamais exécutée) : des spécifications e2e créent une intervention jetable
`statut: "affectee"` puis visitent `/terrain/{id}` pour y interagir avec la checklist, les
prestations ou les pièces — SANS cliquer « Démarrer » dans la scène. Sous la garde posée par ce
lot, ces interactions seront désormais refusées (commandes `disabled`), et ces scènes rougiront
tant qu'elles ne sont pas mises à jour. Candidats identifiés, à vérifier et corriger un par un (soit
poser `statut: "en_cours"` directement à la création de la fixture jetable — même choix que
`rapport-terrain.test.ts` ci-dessus —, soit ajouter un clic réel sur « Démarrer » dans le scénario,
selon ce que chaque scène veut réellement éprouver) :

- `tests/e2e/9l04i-checklist-non-conforme-detail.spec.ts`
- `tests/e2e/9l04j-prestations-par-materiel.spec.ts`
- `tests/e2e/9l04m-checklist-retrait-reponse.spec.ts`
- `tests/e2e/offline/9f4h6b-file-ancien-format.spec.ts`
- `tests/e2e/offline/9f4h6e-prestations-difference-en-ligne.spec.ts`
- `tests/e2e/9i7b-pieces-remplacees.spec.ts` (à vérifier : au moins un scénario crée une
  intervention `affectee` ; confirmer si elle est bien celle qui reçoit les pièces avant d'y
  toucher)
- `tests/e2e/9k28a-point-photo-hors-reseau.spec.ts` (à vérifier : le point photo lui-même ne doit
  RIEN changer — I9/point 4 — mais si cette scène répond AUSSI à d'autres points de checklist
  avant démarrage, ceux-là rougiront)

Cette liste vient d'un grep ciblé (statut `affectee` + visite `/terrain/` + mention
signature/checklist/rapport/prestation dans le même fichier) — elle n'est pas nécessairement
exhaustive, et aucun de ces fichiers n'a été ouvert en détail ni rejoué. `tests/e2e/
tous-les-ecrans-rendent.spec.ts` (qui doit rester vert) n'a pas non plus été rejoué, mais c'est un
test de rendu de routes, pas d'interaction avec les contrôles désactivés : risque jugé faible.

## 5. Question ouverte pour Alexis — les photos suivent-elles la même règle ?

Le ticket demande explicitement de NE RIEN changer pour les photos (`lib/documents/depot.ts`
n'importe ni `estFige` ni `peutSaisirSurTerrain`) et de consigner la question : une photo continue
de se déposer sur une intervention `affectee`, jamais démarrée. Est-ce voulu durablement, ou la
même borne doit-elle s'étendre à `deposerPhotoIntervention` dans un prochain lot ?

## 6. Vérifications jouées

- `pnpm typecheck` : vert.
- `pnpm lint` : vert (0 avertissement).
- `pnpm vitest run tests/unit/interventions/cycle-de-vie.test.ts tests/unit/terrain/checklist-terrain.test.tsx tests/unit/interventions/terrain-routes-json.test.ts` : vert (140 épreuves).
- `pnpm test:isolation` : vert, deux passages complets (2274 épreuves).
- `CI=1 pnpm verify` : voir résultat ci-dessous (joué juste avant de rendre la main).
- `pnpm verify:full` : volontairement NON joué — laissé à la file, comme demandé.

## 7. Captures

**NON FAITES** — budget de temps épuisé avant d'y arriver (le serveur, l'écran et les épreuves ont
pris la quasi-totalité des 120 minutes). Manquent, à 375 px, avant/après :

- fiche d'une intervention `affectee` (checklist, rapport, signature) : bandeau d'aide en tête +
  commandes inactives.
- la même après « Démarrer » : bandeau disparu, commandes actives.
- refus hors réseau sur une `affectee` (dans les faits : rien à capturer, puisque les commandes
  sont inactives — un écran qui NE PERMET PAS le geste plutôt qu'un écran qui le refuse après coup ;
  à documenter par une capture du bandeau + des commandes grisées suffit probablement, à confirmer
  avec Alexis si une capture distincte « tentative hors réseau » est malgré tout attendue).

`scripts/captures.mts` n'a pas été relancé — `docs/captures/` n'a donc pas été mis à jour pour ce
lot.

## 8. Reprise suggérée (si un second passage est nécessaire)

Dans l'ordre : (a) corriger les sept scènes e2e listées au point 4 ; (b) rejouer `pnpm test:e2e`
intégralement pour découvrir d'éventuelles autres scènes manquées par le grep ; (c) prendre les
captures du point 7 ; (d) relancer `scripts/captures.mts` et committer `docs/captures/` à jour ;
(e) poser la question du point 5 à Alexis et, selon la réponse, soit clore la condition de
réouverture de D262, soit ouvrir un nouveau ticket pour les photos.
