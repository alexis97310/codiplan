# 9BD-PG-G3-FICHE-ANNULEES — passation

Ticket regroupé, deux parties : PG-A5-FICHE-CRENEAU, PG-A8-ANNULEES-MASQUEES. Chacune a son
commit de code+test et son commit de captures, dans cet ordre.

## Ce que j'ai changé

### PG-A5-FICHE-CRENEAU (commits `00e54b8`, `0fdfa79`)

- `app/(back-office)/interventions/presentation.ts` : nouvelle fonction exportée
  `resumeDuCreneau(ligne, fuseau)`, avec ses deux petits helpers privés
  (`jourAbregeDuJourCivil`, `jourEtDateAbregee`). Compose « jeu. 24/09 · 08:00–10:00
  (2 h 00) » (jour abrégé + date sans année, créneau complet, durée par `enDuree`),
  ou nomme l'absence : « jeu. 24/09 · heure non fixée » (pas de créneau), « jeu.
  24/09 · 08:00 · durée non renseignée » (créneau sans durée). Sans date, inchangé :
  « À planifier ».
- **Écart au territoire annoncé, et pourquoi** : le ticket demandait de tout garder
  dans `page.tsx`. `pnpm typecheck` refuse net : Next.js 15 (route typée) rejette
  tout export d'un `page.tsx` hors de la liste reconnue (`default`, `metadata`,
  config de segment...) — `resumeDuCreneau` exportée directement depuis la page
  casse `.next/types/.../page.ts` (TS2344). La fonction vit donc dans
  `../presentation.ts`, le compagnon DÉJÀ PARTAGÉ de cette même fiche
  (`heureDuCreneau`, `dateHeureLocale`, `retourFiche` y vivent déjà) — `page.tsx` se
  contente de l'importer et de l'appeler à la place de l'ancien calcul inline.
- `app/(back-office)/interventions/[id]/page.tsx` : le résumé (`datePlanifieeAffichee`)
  appelle désormais `resumeDuCreneau(ligne, fiche.fuseau)` ; `heurePlanifiee` reste
  calculé séparément, encore utilisé pour préremplir le formulaire « Planifier ».
- `lib/i18n/fr.ts` : neuf clés neuves — les sept jours abrégés
  (`intervention.resume.jour_abrege.*`, minuscules et point, DISTINCTES de
  `jour.court.N` qui sert les en-têtes de colonne, capitalisées et sans point) et
  les deux absences (`intervention.resume.heure_non_fixee`,
  `intervention.resume.duree_non_renseignee`).
- **Ce que ça change pour l'exploitation** : un planificateur qui ouvre une fiche
  voit maintenant la durée prévue dans le résumé, sans avoir à chercher le champ
  « Durée » du formulaire de planification. Une intervention planifiée sans heure ou
  sans durée le dit explicitement, plutôt que de simplement omettre l'information.

### PG-A8-ANNULEES-MASQUEES (commits `d05372c`, `6e56d10`)

- `lib/interventions/depot.ts` : `listerPlanning` gagne un 5ᵉ paramètre optionnel
  `options?: { inclureAnnulees?: boolean }`, lu via une nouvelle fonction privée
  `filtreStatutAnnulee`. **`true` par défaut** (comportement inchangé) — DEUX autres
  appelants existent (`/terrain`, `/tableau-de-bord`) et n'ont aucune connaissance de
  ce paramètre ; les casser était explicitement interdit par le ticket (« sans casser
  d'autre appelant »).
- `app/(back-office)/planning/page.tsx` : lit `?annulees=1` (`afficherAnnulees`,
  même discipline que `vue` juste au-dessus — toute autre valeur retombe sur le
  défaut) et passe `{ inclureAnnulees: afficherAnnulees }` à `listerPlanning`. Un
  nouveau composant `ToggleAnnulees` (lien qui bascule le paramètre d'URL, en
  préservant vue/jour/semaine) rend le bouton « Afficher les annulées », posé dans
  la même rangée que les onglets Semaine/Jour et le déplacement de période.
- `lib/i18n/fr.ts` : une clé neuve, `planning.afficher_annulees`.
- **Ce que ça change pour l'exploitation** : une intervention annulée ne polluait
  plus visuellement les autres écrans (fiche, bon...) mais restait dans la file
  d'attente et sur la grille du planning, barrée. Elle en disparaît maintenant par
  défaut, comme le prescrit l'annexe D du cahier des charges ; un bouton la
  remontre à la demande (ex. pour vérifier ce qui a été annulé sur une semaine).

## Ce que j'ai mesuré

**PG-A5-FICHE-CRENEAU** :

- Test unitaire neuf (`tests/unit/interventions/fiche-resume-creneau.test.ts`, 4 cas)
  rejoué sur `main` non modifié (`git stash` des trois fichiers touchés) : **4/4
  échouent** (`resumeDuCreneau is not a function` — l'export n'existe pas encore).
  Après restauration du correctif : **4/4 verts**.
- Captures AVANT/APRÈS (`docs/propositions/PG-A5-FICHE-CRENEAU/captures/`), à 1280 et
  375 px, sur trois interventions forgées par
  `tests/e2e/captures-pg-a5-fiche-creneau.spec.ts` : AVANT (rejoué sur le commit
  `a246446`, dernier avant ce lot, via `git stash`) affiche « 24/09/2026 08:00 » —
  aucune durée, aucune distinction entre absence d'heure et absence de durée. APRÈS
  affiche « jeu. 24/09 · 08:00–10:00 (2 h 00) », « jeu. 24/09 · heure non fixée » et
  « jeu. 24/09 · 08:00 · durée non renseignée », vérifiées visuellement sur les
  captures.

**PG-A8-ANNULEES-MASQUEES** :

- Test d'isolation neuf (`tests/isolation/planning-annulees-masquees.test.ts`, 3 cas
  — TÉMOIN sans option, `inclureAnnulees: false`, `inclureAnnulees: true`), rejoué
  sur `lib/interventions/depot.ts` non modifié (`git stash`) : le cas
  `inclureAnnulees: false` **échoue** (les deux formes annulées restent présentes) ;
  les deux autres passent trivialement (rien ne filtre encore, donc « avec option
  vraie » et « sans option » sont indiscernables de l'ancien comportement). Après
  restauration : **3/3 verts**.
- `pnpm test:isolation` complet (131 fichiers, 1261 tests) : vert — aucun des deux
  autres appelants de `listerPlanning` (`/terrain`, `/tableau-de-bord`) n'a
  régressé.
- Captures AVANT/APRÈS (`docs/propositions/PG-A8-ANNULEES-MASQUEES/captures/`), à
  1280 et 375 px, sur deux interventions annulées forgées par
  `tests/e2e/captures-pg-a8-annulees-masquees.spec.ts` (une sans date, une datée dans
  la semaine affichée) : AVANT (commit `0fdfa79`, via `git stash`), `decoche` et
  `coche` sont **identiques** — la carte annulée reste dans la file (5 dossiers) et
  sur la grille, `?annulees=1` n'ayant aucun effet. APRÈS, `decoche` la masque (4
  dossiers, grille sans la case barrée) et `coche` la remontre à l'identique de
  l'AVANT, bouton actif.

**Contrôle de fin de session** (une seule fois, sur les deux parties) :

1. `CI=1 pnpm verify` (format, typecheck, lint, test — 297 fichiers / 3087 tests —,
   test:isolation — 131 fichiers / 1261 tests —, build) : **vert**, code de sortie 0.
2. `pnpm feries:horizon && pnpm audit:partitions` : **vert** (deux territoires, au
   moins douze mois d'avance ; 13 partitions couvertes, partition par défaut vide).
3. `CI=1 pnpm exec playwright test` sur `captures-pg-a5-fiche-creneau.spec.ts`,
   `captures-pg-a8-annulees-masquees.spec.ts`, `fiche-intervention.spec.ts` (repérée
   par recherche : elle lit le texte du résumé via `fr["intervention.date"]`),
   `tous-les-ecrans-rendent.spec.ts`, `ecrans-largeur-utile.spec.ts`,
   `coque-375.spec.ts`, `planning-largeur-et-carte.spec.ts`,
   `planning-cibles-375.spec.ts`, `fiche-375.spec.ts` — **81 épreuves, 78 passées, 3
   ignorées (sans rapport), 0 échec**.

## Ce que j'ai tranché, et pourquoi

- **`resumeDuCreneau` vit dans `presentation.ts`, pas dans `page.tsx`** — contrainte
  technique de Next.js (voir plus haut), pas un choix de confort. Documenté dans le
  commit et ici plutôt que laissé silencieux.
- **L'heure de fin se lit sur `creneau_fin`, jamais recalculée depuis
  `creneau_debut + duree_estimee_min`** : c'est la même colonne que la pose écrit
  déjà aux côtés de `creneau_debut` (`lib/interventions/depot.ts`), et une seconde
  lecture d'un même fait diverge en silence (§9, 01/09).
- **`listerPlanning` garde `true` comme valeur implicite d'`inclureAnnulees`**,
  inverse de ce que `/planning` demande. Alternative rejetée : filtrer par défaut
  dans `listerPlanning` lui-même (plus « pur », mais aurait changé silencieusement
  le comportement de `/terrain` et `/tableau-de-bord`, ni testés ni mentionnés par
  ce ticket — risque que je n'ai pas pris).
- **Le filtre est un lien qui bascule `?annulees=1`, pas une case à cocher dans un
  `<form>`** : `/planning` n'a pas de formulaire de recherche comme `/interventions`,
  et tous ses autres contrôles (vue, période) sont déjà des liens GET qui préservent
  l'état par l'URL — cohérent avec le reste de l'écran plutôt qu'une forme nouvelle.
- **Les captures et le test d'isolation de PG-A8 réutilisent les fixtures partagées
  `SOCIETE_A`/`CLIENT_A1`/`SITE_A1_S1`/`AGENCE_A`** (`tests/isolation/setup/fixtures.ts`)
  — ce ne sont PAS les scènes `SCENE.*` de `tests/e2e/setup/`, que l'interdiction du
  ticket vise ; c'est le patron déjà suivi par tous les fichiers voisins
  (`planning-du-technicien.test.ts`, `semis-affectation-agenda-bloque.test.ts`).
  Les deux lignes forgées portent leur propre identifiant (`uuidv7()`) et sont
  supprimées en `afterEach`.

## Ce que je n'ai PAS fait

- Je n'ai pas touché `/terrain` ni `/tableau-de-bord` : ils continuent de voir les
  interventions annulées exactement comme avant ce lot (comportement par défaut de
  `listerPlanning` inchangé). Si un futur ticket décide qu'elles doivent aussi
  disparaître du terrain, c'est un point d'arrêt (§8 CLAUDE.md) — pas une extension
  silencieuse de celui-ci.
- Je n'ai pas ajouté de mémorisation de préférence pour le filtre « Afficher les
  annulées » (cookie, session) : il retombe à décoché à chaque navigation, comme
  demandé (« masqué par défaut »).
- Je n'ai pas revu le tri ou le regroupement de la file d'attente / de la grille :
  seule la POPULATION change (une ligne de moins par défaut), jamais l'ordre.
- Aucune migration, aucune ligne de semis, aucun prix touché.

## Les pièges pour la session suivante

- **`page.tsx` de l'App Router ne peut exporter QUE la liste reconnue par Next
  (`default`, `metadata`, `generateMetadata`, config de segment...)** — toute autre
  fonction nommée y casse `pnpm typecheck` (TS2344 dans `.next/types/`), jamais
  `pnpm lint`. Si un futur ticket demande d'isoler une fonction pure d'un écran pour
  la tester directement, vérifier d'abord qu'un fichier `presentation.ts` compagnon
  existe déjà (la plupart des écrans back-office en ont un) plutôt que de l'exporter
  depuis la page.
- **`enDuree(120)` rend « 2 h 00 », pas « 2 h »** — le texte illustratif du ticket
  simplifiait ; le format réel garde toujours deux chiffres de minutes après
  l'heure, même à zéro. Les captures et le test le montrent tel quel.
- **`getUTCDay()` sur `date_planifiee` donne le jour ISO SANS fuseau**, exactement
  comme `dateCivile` — la date de test 2026-09-25 est un VENDREDI, pas un jeudi
  (l'exemple du ticket datait d'une autre année de calendrier) ; les fixtures de ce
  lot utilisent le 24/09/2026, un jeudi réel, pour rester lisibles.
- Le compte `pnpm test` est passé de 3085 à 3087 entre le début et la fin de la
  session (4 cas ajoutés par PG-A5, 0 par PG-A8 côté unitaire) — la variation de
  +1 vue en cours de route sur un run intermédiaire n'a pas été creusée plus loin,
  aucun test n'a jamais été rouge sur `pnpm test`.

## Ce qui reste à faire

- Rien d'identifié dans le périmètre des deux parties. Le ticket ne demandait aucune
  suite explicite.
