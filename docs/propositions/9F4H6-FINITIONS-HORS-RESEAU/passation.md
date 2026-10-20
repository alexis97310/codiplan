# 9F4H6-FINITIONS-HORS-RESEAU — passation

`git rev-parse --short HEAD` au moment de cette passation : `ecc58262`
(7 commits, un par point, voir `git log --oneline -7`).

## Point 1 — « Terminer » gardé dans la coquille sur refus d'authentification

**Avant** : `components/terrain/rapport-automatique.tsx:924` —
`if (!navigator.onLine) { … }` ne traitait comme une coupure réseau (mise en
file du geste « terminer ») que le cas où l'appareil se croit RÉELLEMENT
hors réseau. Dans la coquille `/terrain-hors-reseau` ouverte EN LIGNE sans
session valide, le POST `/terminer` recevait `auth.refus`, `envoyerJson` le
traduisait en `null` (comme une coupure), mais `onClickTerminer` tombait
dans la branche `hors_ligne` du bas (ligne ~1002), qui affiche
`terrain.terminer.sans_reseau` SANS jamais appeler `ajouterSaisie` — le
geste n'était jamais gardé, rien ne repartait à la reconnexion.

**Après** (`rapport-automatique.tsx:924`) : `if (!navigator.onLine ||
sansSession)`. Dans la coquille, `sansSession` est toujours vrai et aucune
session n'y existe jamais (voir le docblock d'`envoyerJson`) — donc chaque
« Terminer » y est désormais traité comme une coupure réseau, point final,
qu'elle soit réelle ou due à l'absence de session.

e2e : `tests/e2e/offline/9f4h6-terminer-coquille-sans-session.spec.ts`
(modèle `9f4h4d-coquille-sans-session.spec.ts`) — réseau UP du début à la
fin, cookie supprimé, « Terminer » part en file et s'envoie à la
reconnexion.

## Point 2 — la déconnexion n'est plus jamais suspendue sans fin

**Avant** : `components/terrain/effacement-copie-locale.tsx:165-182` —
`!pretRef.current` bloquait le `submit` (`preventDefault`) et attendait
`premiereLecturePromesseRef.current` SANS BORNE. Une IndexedDB qui ne
répond jamais (magasin brisé, navigation privée dégradée) suspendait la
déconnexion pour toujours : ni la question, ni la déconnexion elle-même.

**Après** : `avecBorne` (nouveau, même fichier, 2 s —
`DELAI_PREMIERE_LECTURE_MS`) court-circuite l'attente ; passé ce délai,
pose la question PRUDENTE (même dialogue que « sans instantané » —
`identite: null`, donc jamais de bouton « Envoyer d'abord »).

Unitaire : `tests/unit/terrain/effacement-copie-locale.test.tsx` — une
lecture qui ne se résout JAMAIS (`new Promise(() => {})`), minuteurs
factices, la question apparaît après 2 s, jamais avant.

## Point 3 — les prestations deviennent saisissables depuis la coquille

**Avant** : `app/api/terrain/instantane/route.ts` ne portait que
`prestationsRealisees` (libellés, sans `id`) ; `consultation-hors-reseau.tsx`
passait `prestations={[]}` à `RapportTerrainAutomatique` avec
`catalogueIndisponibleHorsReseau`. Limite D216 explicitement acceptée.

**Après** :
- `lib/prestations/depot.ts` — nouvelle `catalogueActifPourTerrain` (id,
  code, libelle SEULEMENT, jamais `duree_standard_min` ni `famille_id`).
- `app/api/terrain/instantane/route.ts` — ajoute `catalogue` (société
  entière, une fois) et `FicheJSON.prestationsRealiseesIds` (les `id` des
  prestations déjà faites — **sans ce champ, cocher une prestation NOUVELLE
  dans la coquille aurait REMPLACÉ l'ensemble envoyé au serveur et PERDU
  celles déjà faites avant la coupure**, `definirPrestationsRealisees`
  posant l'ensemble entier).
- `components/terrain/consultation-hors-reseau.tsx` — `prestations`/
  `prestationsInitiales` alimentés par le catalogue réel ; `fiche` reçoit un
  nouveau prop `catalogue`.
- `docs/arbitrages.md`, D216 — précision ajoutée, la limite est barrée.

Cloisonnement : `tests/isolation/terrain-instantane-route.test.ts` — une
prestation INACTIVE de A et une prestation (active) de B n'apparaissent
jamais dans le catalogue rendu à A.

e2e : `tests/e2e/offline/9f4h4-ouverture-a-froid.spec.ts` (mis à jour — la
section 6 cochait avant un message « indisponible », elle coche désormais
réellement une prestation et vérifie `prestations_realisees` en base
après l'envoi) ; `9f4h6-terminer-coquille-sans-session.spec.ts` (capture c).

## Point 4 — le bandeau ne dit plus « lecture seule » au-dessus d'une fiche de travail

**Avant** : `components/terrain/presentation.ts:134`,
`libelleCopieDu(genereLe, fuseau)` composait toujours
`terrain.bandeau.suffixe` (« , lecture seule »), au-dessus de `/terrain`
(liste, vrai) COMME au-dessus de `/terrain/[id]` et de la fiche de la
coquille (fausses — compteur/rapport/signature restent saisissables hors
réseau).

**Après** : `libelleCopieDu(genereLe, fuseau, fiche = false)` — nouvelle
clé `terrain.bandeau.suffixe_travail` (« , saisies gardées sur ce
téléphone ») quand `fiche` est vrai. `BandeauReseau` reçoit le même prop.
Appelants : `/terrain/page.tsx` inchangé (liste, `fiche` par défaut) ;
`/terrain/[id]/page.tsx:297` → `fiche` ; `consultation-hors-reseau.tsx` →
`fiche={id !== null}` (faux sur la journée, vrai sur une fiche précise).

Unitaire : `tests/unit/terrain/presentation.test.ts`.

## Point 5 — renfort : le verdict local de « Terminer » ne lit plus le segment d'un AUTRE technicien

**Avant** : `app/(mobile)/terrain/[id]/page.tsx:469-472` —
`segmentOuvertConnu` venait de `mesure.ouvert`
(`mesureDeLIntervention`, TOUTES PERSONNES CONFONDUES par construction,
voir son docblock — un renfort compte dans `minutes`). Si le SEUL segment
ouvert sur l'intervention était celui d'un renfort, ce prop le faisait
passer pour celui de la personne connectée : le verdict LOCAL hors réseau
de « Terminer » (`mesureCompteurDeLaFile`) l'acceptait alors à tort, alors
que le serveur refuse (`intervention.refus.compteur_tourne_encore`).

**Après** : nouvelle fonction pure `segmentOuvertDeLaPersonne(ici, enCours)`
(`lib/interventions/compteur.ts`), nourrie par `compteurEnCours`/`ici` —
déjà filtrés sur `contexte.utilisateurId` seul. `page.tsx` l'utilise à la
place de `mesure.ouvert`.

Unitaire : `tests/unit/interventions/compteur.test.ts`.

## Point 6 — captures

8 fichiers dans `docs/propositions/9F4H6-FINITIONS-HORS-RESEAU/captures/`
(375 et 1280 px, viewport, commités) :

```
bandeau-saisies-gardees-375.png / -1280.png        (point 4)
deconnexion-sans-instantane-375.png / -1280.png    (point 2, question SANS « Envoyer d'abord »)
prestation-cochee-coquille-375.png / -1280.png     (point 3)
terminer-garde-coquille-375.png / -1280.png        (point 1)
```

```
$ ls -la docs/propositions/9F4H6-FINITIONS-HORS-RESEAU/captures/
-rw-r--r-- bandeau-saisies-gardees-1280.png      49103
-rw-r--r-- bandeau-saisies-gardees-375.png        41992
-rw-r--r-- deconnexion-sans-instantane-1280.png   34476
-rw-r--r-- deconnexion-sans-instantane-375.png    30137
-rw-r--r-- prestation-cochee-coquille-1280.png    50573
-rw-r--r-- prestation-cochee-coquille-375.png     43666
-rw-r--r-- terminer-garde-coquille-1280.png       52751
-rw-r--r-- terminer-garde-coquille-375.png        42231
```

Toutes prises par `tests/e2e/offline/9f4h6-terminer-coquille-sans-session.spec.ts`,
qui a gagné au passage une prestation dans sa scène et une épreuve dédiée à
« déconnexion sans instantané, file non vide ».

## Point 7 — partiel, points ouverts

**Fait** : isolation — `dejaFerme` (`arreterLeCompteur`,
`lib/interventions/depot-compteur.ts:335`) filtrait DÉJÀ sur
`utilisateur_id` ; comportement confirmé correct (pas de correctif de code),
mais rien ne le prouvait. Nouvelle épreuve dans
`tests/isolation/9f4h2-hors-reseau-heure-et-rejeu.test.ts` : un renfort
ferme un segment à H30, puis le technicien (sans rien avoir démarré) tente
un « arrêter » différé au MÊME instant H30 — refusé
`compteur.refus.aucun_en_cours`, jamais rejoué comme s'il s'agissait de son
propre segment.

**Points ouverts** (budget de temps épuisé avant de les traiter
honnêtement) :

- **épreuves `sansSession` pour photos et signature** — `photos-terrain.tsx`
  a déjà son propre traitement `sansSession`/`auth.refus` (ligne ~184-186,
  distinct de celui de `rapport-automatique.tsx`) ; aucune épreuve unitaire
  ou e2e ne l'exerce directement aujourd'hui (seul
  `compteur-terrain.test.tsx` teste `sansSession`). À écrire.
- **« Arrêter » en ligne trop ancien (−8 jours) refusé** — énoncé AMBIGU
  sans plus de contexte : `arreterLeCompteur` borne déjà `instant_appareil`
  à 7 jours dans le passé (`verifierInstantAppareil`, QUEL QUE SOIT
  `depuisFile`, 9F4H4D) — mais `effectif` y est TOUJOURS l'instant du geste
  « arrêter » lui-même (donc ~« maintenant » pour un clic réellement en
  ligne), jamais l'âge du SEGMENT qu'il ferme : je ne vois pas de scénario
  où un « Arrêter » EN LIGNE (pas depuis la file) daterait de 8 jours. Deux
  lectures possibles : (a) le point vise en réalité un « Arrêter » **depuis
  la file**, resté en attente plus de 7 jours (refusé
  `compteur.refus.instant_trop_ancien`, déjà couvert par le code — reste à
  écrire l'épreuve) ; (b) un scénario distinct que je n'ai pas identifié. Je
  n'ai pas voulu deviner et écrire un correctif ou une épreuve sur une base
  incertaine — **à clarifier avec Alexis avant d'y toucher**.

## Vérification

`CI=1 pnpm verify` (format:check, typecheck, lint, test — 4959 épreuves —,
test:isolation — 1640 épreuves —, build) : **VERT**, deux fois.

`CI=1 pnpm verify:full` : tenté une fois en entier, EN UN APPEL — tué après
55 min par le harnais de session, en cours de `test:e2e` (1481 épreuves),
AUCUNE épreuve rouge observée avant la coupure. Même limite que 9F4H5B (voir
sa passation) : la suite complète dépasse le budget d'une session. Détail et
sous-ensembles rejoués séparément (tous verts, à 1 worker/`CI=1`) :
`docs/propositions/9F4H6-FINITIONS-HORS-RESEAU/verify-final.txt`.

**Captures régénérées par effet de bord** (47-AVERTISSEMENTS-1,
9DF-TP-CY2-MATRICE-D8) pendant la tentative `test:e2e` complète —
restaurées (`git checkout --`) avant tout commit, jamais recommises.

15 dernières lignes de `verify-final.txt` :

```
Mesuré SANS `CI=1` (plusieurs workers) avant de rejouer à 1 worker : 5
épreuves de ce même sous-ensemble rougissaient par CONTENTION DE
PARALLÉLISME — plusieurs spécifications (9f4h3-mode-avion, 9f4h4-ouverture-
a-froid, 9f4h6) créent chacune une prestation « Filtre à air » dans la même
société du semis ; à plusieurs workers, ces fixtures coexistent et le
catalogue désormais emporté par `/api/terrain/instantane` (point 3 de ce
lot) en voit plusieurs à la fois — `getByRole("checkbox", {name:…})`
échoue alors en mode strict. Confirmé étranger à ce lot : REJOUÉ à 1
worker (`CI=1`, le régime réel de la CI), les 5 passent. Rien n'a été
assoupli pour les faire passer — c'est un artefact du harnais local, pas
une régression.

La tentative de `test:e2e` complet a régénéré, par effet de bord, des
captures PNG d'AUTRES tickets déjà commités (47-AVERTISSEMENTS-1,
9DF-TP-CY2-MATRICE-D8) — restaurées à leur état commité (`git checkout --`)
avant ce commit, jamais recommises.
```

## Territoire touché

`components/terrain/rapport-automatique.tsx`,
`components/terrain/effacement-copie-locale.tsx`,
`components/terrain/consultation-hors-reseau.tsx`,
`components/terrain/bandeau-reseau.tsx`, `components/terrain/presentation.ts`,
`app/api/terrain/instantane/route.ts`, `app/(mobile)/terrain/[id]/page.tsx`,
`lib/prestations/depot.ts`, `lib/interventions/compteur.ts`,
`lib/i18n/fr.ts` (deux clés neuves), `docs/arbitrages.md` (précision D216),
tests (unit/isolation/e2e), captures. Aucune migration, aucune dépendance
nouvelle, aucun montant au terrain.
