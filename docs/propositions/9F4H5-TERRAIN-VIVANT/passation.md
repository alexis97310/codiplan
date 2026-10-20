# 9F4H5-TERRAIN-VIVANT — passation

Branche dédiée `9F4H5-TERRAIN-VIVANT` : le worktree était en HEAD détachée sur
`origin/main` (0956b292) au démarrage — une branche a été posée avant le
premier commit, comme l'exige le protocole quand `main` est ailleurs extrait.

## Point 1 — le compteur défile

**Avant** — `app/(mobile)/terrain/[id]/page.tsx:397` affichait
`enDuree(mesure.minutes)` (les segments FERMÉS seulement), recalculé une fois
côté serveur ; le bandeau `components/terrain/bandeau-compteur.tsx` et le
statut hors réseau de `components/terrain/compteur-terrain.tsx:244` ne
montraient qu'une heure de départ, jamais une durée qui avance.

**Après** — `lib/terrain/compteur-vivant.ts` (nouveau, part pure, D-13) :
`decalageHorloge` + `secondesEcoulees` calculent le total vivant (minutes
fermées + écoulé du segment, corrigé contre l'heure du SERVEUR). Point de
passage unique du gardien L0-08 : `instantAppareil()` y lit l'horloge pour une
DURÉE, jamais une lecture locale — exemption nommée dans
`tests/unit/calendar/sans-date-courante-implicite.test.ts`, à côté de
`lib/db/uuid.ts`. `components/terrain/compteur-vivant.tsx` (nouveau) affiche
`HH:MM:SS`, tic chaque seconde (`lib/calendar/duree.ts:enDureeHMS`, ajout).
Branché à trois endroits :
- `app/(mobile)/terrain/[id]/page.tsx:406-419` — la grande valeur et son
  libellé (`terrain.compteur.ferme_et_en_cours`, clé neuve) quand `ici &&
  enCours`.
- `components/terrain/bandeau-compteur.tsx` — la durée entre parenthèses,
  `instantServeur` optionnel (défaut `null`, aucune correction) pour ne
  casser aucun appelant déjà écrit.
- `components/terrain/compteur-terrain.tsx:244-259` — hors réseau, départ =
  `instantLocal` (heure de l'appareil, sans correction possible).

Rien n'est enregistré différemment : affichage seul, `lib/interventions/` non
touché.

## Point 2 — Ma journée et la fiche se mettent à jour seules

**Avant** — aucun `router.refresh()` hors des gestes ; une intervention
transmise par le bureau n'apparaissait qu'au rechargement manuel.

**Après** — `components/terrain/rafraichissement-auto.tsx` (nouveau) :
visibilité retrouvée, retour du réseau, minuterie de 60 s — posé sur
`app/(mobile)/terrain/page.tsx:200` et `[id]/page.tsx:298`. La règle « quand
rafraîchir » est pure (`lib/terrain/rafraichissement.ts:doitRafraichir`) :
visible ET en ligne ET aucune activité en cours. L'activité est un ensemble de
jetons partagé (`lib/terrain/activite-saisie.ts`, idempotent) — démarré/
terminé par `compteur-terrain.tsx` (autour de l'envoi), `bouton-envoyer.tsx`
(autour de l'envoi de la file), et `rapport-automatique.tsx` (un `useEffect`
qui observe `etatRapport`/`etatPrestations`/`etatSignature`/
`enEnvoiTerminer` : « attente » = debounce en cours, « envoi » = requête en
vol).

## Point 3 — « Nouvelle intervention »

**Avant** — aucune mémoire locale ; une ligne nouvellement transmise se
fondait dans la liste sans rien pour la distinguer tant que la fiche n'avait
pas été ouverte par CE technicien (le badge `vue_technicien_le` existe déjà,
mais côté serveur, sans lien avec un rafraîchissement SANS rechargement).

**Après** — `lib/terrain/vues-locales.ts` (nouveau, localStorage par
`utilisateurId`, try/catch) : deux ensembles — `connues` (tout ce qui a déjà
été affiché sur cet appareil, pour détecter une arrivée une seule fois) et
`en_attente` (ce qui est « Nouvelle » et pas encore ouvert — survit à un
rafraîchissement, s'efface seulement à l'ouverture, `marquerOuverte`).
`components/terrain/liste-journee.tsx` (nouveau) reprend `Section`/
`SectionJoursSuivants`/`Carte` TEL QUEL depuis `app/(mobile)/terrain/
page.tsx` (déplacement obligé : la mémoire d'appareil est illisible côté
serveur, et une seule comparaison doit courir sur TOUTE la liste, jamais
carte par carte — l'ordre d'effet entre composants frères n'est pas garanti
assez explicitement pour s'y fier). `ListeJournee` calcule `en_attente` une
fois (effet dépendant d'une clé stable d'ids, jamais le tableau lui-même —
`useEffect` refuse une taille de dépendances variable), rend l'annonce
`role="status"` en tête, et passe `estNouvelle`/`onOuvrir` à chaque `Carte`.
Clés neuves : `terrain.badge_nouvelle`, `terrain.nouvelles.singulier`,
`terrain.nouvelles.pluriel`. Aucune migration, aucune notification du
téléphone (arbitrage 3.19 maintenu, D130).

## Épreuves

- **Unitaires neufs** : `tests/unit/calendar/duree.test.ts` (`enDureeHMS`),
  `tests/unit/terrain/compteur-vivant.test.ts`,
  `tests/unit/terrain/rafraichissement.test.ts`,
  `tests/unit/terrain/activite-saisie.test.ts`,
  `tests/unit/terrain/vues-locales.test.ts`.
- **Bout en bout neufs** : `tests/e2e/9f4h5-compteur-vivant.spec.ts` (Démarrer,
  3 s, la valeur change), `tests/e2e/9f4h5-nouvelle-intervention.spec.ts`
  (transmission par le bureau, retour du réseau simulé par l'événement
  `online` — l'un des trois déclencheurs réels —, pastille sur SA carte,
  annonce, ouverture qui l'efface de façon persistante). Chacun sa PROPRE
  scène (I9) : `SCENE.compteurA` est partagée par `terrain.spec.ts`, et y
  toucher depuis un second fichier sous `fullyParallel` aurait créé une
  collision sur le compteur UNIQUE par personne.
- **Captures** : `tests/e2e/captures-9f4h5-terrain-vivant.spec.ts` —
  `fiche-compteur`, `bandeau-compteur`, `ma-journee-nouvelle`, aux deux
  largeurs. Une paire d'interventions PAR LARGEUR (démarrer un compteur ou
  transmettre est irréversible côté serveur) et le compteur est mis en pause
  entre les deux largeurs (une seule intervention en cours par personne).
- **Gardiens mesurés en cours de route** (`pnpm verify`, pas des
  assouplissements) : le gardien L0-08 (`sans-date-courante-implicite.test.ts`)
  exigeait l'exemption nommée pour `lib/terrain/compteur-vivant.ts` ; le
  gardien L0-11 (`sans-chaine-visible-en-dur.test.ts`) a trouvé `00:00:00` en
  dur dans une assertion de rendu (corrigé en expression régulière) et un
  libellé de scène hors dictionnaire (corrigé en clé `terrain9f4h5.e2e.*`,
  même discipline que `terrain9dd.e2e.*`) ; le gardien du vocabulaire imposé
  a ensuite refusé le mot « site » DANS LA VALEUR de ces clés — corrigé en
  « lieu », comme `terrain9dd.e2e.site_affectee` le fait déjà.
- **Épreuves voisines** — les 41 fichiers que `git grep -l "/terrain"
  tests/e2e` trouve (plus les 3 fichiers neufs de ce lot), rejoués en
  `--workers=1` avec les trois points : **198 passées, 3 ignorées
  (conditions préexistantes, sans rapport), 0 échec**.
- **`CI=1 pnpm test:e2e` (la suite ENTIÈRE, 334 fichiers)** — PAS rejouée
  jusqu'au bout : même limite déjà documentée par `9F4H3-HORS-RESEAU-
  ENVOYER`, `9F4H3AC-FILE-CORRECTIFS-REVUE` et `9F4H4B-OUVERTURE-A-FROID`
  (la suite complète est prévue pour tourner sans surveillance la nuit,
  CLAUDE.md §4, pas dans une session de 150 minutes qui livre aussi trois
  points de fonctionnalité). Remplacée par les épreuves voisines ciblées
  ci-dessus.
- **Mesuré, et PAS retenu comme un défaut de ce lot** : jouer le même
  sous-ensemble de 41+3 fichiers sous parallélisme complet (12 workers, le
  défaut hors CI) produit un ensemble d'échecs DIFFÉRENT à chaque exécution
  (3 à 6 échecs, jamais les mêmes), y compris SANS les deux fichiers neufs de
  ce lot — reproduit trois fois, sans ces fichiers. C'est une contention de
  scène partagée entre fichiers concurrents sous `fullyParallel` (compteur
  unique par personne, file d'envoi par identité), déjà le symptôme documenté
  par plusieurs lots précédents pour d'autres fichiers — jamais mesuré propre
  à ce lot, et absent dès `--workers=1` (ce que `CI=1` impose de toute façon).
- Toutes les captures régénérées par effet de bord des épreuves d'AUTRES lots
  (une centaine de PNG, sur deux exécutions groupées) ont été restaurées
  (`git restore`) ou supprimées quand nouvellement créées ; aucune n'entre
  dans un commit de ce lot.

## `pnpm verify`

`CI=1 pnpm verify` (format:check, typecheck, lint, test — 4943 tests —,
test:isolation, build) — vert, sortie complète dans
`docs/propositions/9F4H5-TERRAIN-VIVANT/verify-final.txt`. Rejoué une
dernière fois après `git fetch origin` (`origin/main` n'avait pas bougé
depuis T0, 0956b292 : rebase sans effet) — vert, arbre propre.

15 dernières lignes de la sortie :
```
├ ƒ /terrain-hors-reseau                             2.77 kB         197 kB
├ ƒ /terrain/[id]                                      232 B         196 kB
├ ƒ /terrain/profil                                    385 B         103 kB
├ ƒ /vgp                                             1.17 kB         165 kB
├ ƒ /vgp/a-determiner                                  853 B         118 kB
└ ƒ /vgp/enregistrer/[id]                              211 B         106 kB
+ First Load JS shared by all                         102 kB
  ├ chunks/0c86f1d0-e396209ab64996d1.js              54.2 kB
  ├ chunks/8817-050d255d41a76bbe.js                    46 kB
  └ other shared chunks (total)                      1.93 kB


○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```

SHA final : `3ee5c117`.

## Points ouverts

- `pnpm verify:full` (feries:horizon, audit:partitions, et surtout la suite
  `test:e2e` entière) n'a pas été rejoué en entier — voir « Épreuves »
  ci-dessus. À jouer par la vérification nocturne (CLAUDE.md §4).
- La contention sous parallélisme complet, mesurée étrangère à ce lot (voir
  ci-dessus), reste un défaut d'ENVIRONNEMENT de la suite e2e en général —
  rien à corriger dans ce lot, mais un futur lot qui ajoute encore un fichier
  touchant `/terrain` sous la MÊME identité (`garnier@codima.test`) gagnerait
  à le savoir.
- Le badge « Nouveau » (`vue_technicien_le`, serveur) et le badge « Nouvelle »
  (mémoire d'appareil, ce lot) peuvent s'afficher simultanément sur la même
  carte — assumé : deux faits distincts, jamais fusionnés en un seul badge.
