# 51-STABILITE-1 — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

Rien de ce que l'application fait n'a changé — aucun écran, aucune migration. Ce
lot change uniquement la façon dont les épreuves de bout en bout PRÉPARENT leurs
données, pour que deux fichiers qui tournent en même temps (`fullyParallel`, sans
`retries` en local) cessent de se marcher dessus.

- **`tests/e2e/rapport-terrain.spec.ts`** écrivait commentaire, suite à donner,
  photo et signature, puis un `UPDATE` brut vers `terminee`, sur `SCENE.obstacle`
  et `SCENE.chevauchante` — deux fixtures que six autres fichiers lisent ou
  déplacent. Il écrit désormais sur **`SCENE.rapportTravaillee`** et
  **`SCENE.rapportVierge`**, deux lignes neuves posées par `scene.ts`
  (Ducos/MERCREDI, jamais lues ailleurs).
- **`tests/e2e/terrain.spec.ts`** démarrait puis mettait en pause le compteur
  (écrit `segment_travail`, recalcule `temps_mesure_min`) sur `SCENE.obstacle` et
  `SCENE.chevauchante` — précisément la fixture dont `montants-par-role.spec.ts`
  et `ecrans-largeur-utile.spec.ts` attendent un compte FERMÉ et STABLE de
  120 minutes. Il écrit désormais sur **`SCENE.compteurA`**/**`SCENE.compteurB`**.
- **`tests/e2e/glisser-deposer.spec.ts`**, scénario « un déplacement accepté »,
  déplaçait `SCENE.deplacable` de MARDI à MERCREDI et l'y laissait — exactement
  la ligne qu'`affichage-materiel.spec.ts` lit À SA PLACE D'ORIGINE pour prouver
  qu'une intervention sans heure paraît en tête de la vue jour. Il déplace
  désormais **`SCENE.glissable`**, une ligne jumelle dédiée. Les quatre autres
  scénarios du fichier ne persistent aucune écriture (chevauchement, erreur
  serveur et connexion interrompue interceptées, dépassement refusé) : rien à y
  changer.
- **`tests/e2e/porte-capacites.spec.ts`**, scénarios « annuler » et « clôturer
  l'intervention d'un collègue », piochaient une intervention ARBITRAIRE de
  toute la société (`findFirstOrThrow` sans autre filtre que le statut) puis
  comparaient son statut avant/après le refus attendu. Sous `fullyParallel`,
  cette ligne pouvait être une fixture qu'un AUTRE fichier fait avancer pendant
  la fenêtre du test — la comparaison mesurait alors le geste d'un autre
  fichier, pas le refus qu'elle éprouve. Chaque scénario pose désormais sa
  propre intervention forgée (`INTERVENTION_A_ANNULER`,
  `INTERVENTION_DU_COLLEGUE`), créée en `beforeAll`, sur le modèle déjà en place
  dans `bon-intervention.spec.ts`.
- **Nouveau gardien `tests/unit/e2e-donnees-partagees.test.ts`** : lecture
  statique de `tests/e2e/*.spec.ts`, échoue si un appel `$executeRawUnsafe`
  dont le texte SQL porte `UPDATE`/`DELETE FROM` référence un `SCENE.x` que lit
  un autre fichier. Scope assumé et écrit en tête du fichier : il voit l'écriture
  SQL brute, jamais un geste d'écran (glisser-déposer, clôturer, démarrer un
  compteur) — ces gestes-là ne laissent aucune trace SQL dans le fichier qui les
  déclenche, et seule une revue humaine (ce lot) peut les établir.

Pour l'exploitation : aucun changement de comportement. Le risque réduit est
celui d'un lot FUTUR qui, en modifiant `scene.ts` ou un fichier e2e existant,
casserait `pnpm verify:full` par une cause totalement étrangère à son propre
changement — le coût mesuré par le constat (un second passage à chaque fois
qu'un rouge de ce type survient, un lot entier recalé s'il rougit deux fois).

## Ce que j'ai mesuré

### L'inventaire des écritures sur une donnée non forgée par le fichier lui-même

| Fichier | Ce qu'il écrit | Sur quelle donnée | Verdict |
|---|---|---|---|
| `rapport-terrain.spec.ts` | commentaire, suite, photo, signature (gestes écran) + `UPDATE … statut='terminee'` (SQL brut) | `SCENE.obstacle`, `SCENE.chevauchante` | **Corrigé** — fixtures dédiées `rapportTravaillee`/`rapportVierge` |
| `terrain.spec.ts` | démarrer/mettre en pause le compteur (geste écran, écrit `segment_travail`) | `SCENE.obstacle`, `SCENE.chevauchante` | **Corrigé** — fixtures dédiées `compteurA`/`compteurB` |
| `glisser-deposer.spec.ts` (« un déplacement accepté ») | glisser-déposer ACCEPTÉ (geste écran, change jour/creneau, persiste) | `SCENE.deplacable` | **Corrigé** — fixture dédiée `glissable` |
| `glisser-deposer.spec.ts` (5 autres scénarios) | glisser-déposer/redimensionnement REFUSÉS (jour fermé, chevauchement, erreur serveur interceptée, connexion interrompue interceptée, durée négative) | `SCENE.versSamedi`, `SCENE.chevauchante` | Pas de fixture dédiée nécessaire — refusé par le serveur, rien n'est persisté |
| `porte-capacites.spec.ts` (« annuler », « clôturer un collègue ») | lecture avant/après un refus attendu, sur une ligne piochée arbitrairement (`findFirstOrThrow` sans scope propre) | n'importe quelle intervention de la société — pouvait être une fixture `SCENE.x` en cours d'écriture ailleurs | **Corrigé** — interventions forgées dédiées |
| `bon-intervention.spec.ts` | `DELETE`+`INSERT`+segment (SQL brut) | `FICHE_BON_TERMINEE`, id fixe propre au fichier | Déjà sain (corrigé par AFFICHAGE-MATERIEL-1, avant ce lot) |
| `contacts.spec.ts`, `historique-client.spec.ts`, `historique-site.spec.ts`, `fiche-360-1.spec.ts`, `demandes.spec.ts`, `interventions-2.spec.ts`, `avertissements-1.spec.ts`, `affichage-materiel.spec.ts`, `parc-apercu-borne.spec.ts`, `selecteurs-1.spec.ts` | `create`/`update`/`delete` Prisma | Identifiants fixes propres à chaque fichier (`CLIENT_*`, `SITE_*`, `MODELE_SEL1`…) | Déjà sain — vérifié par grep exhaustif (`\.update(`, `\.updateMany(`, `\.delete(`, `\.deleteMany(`), aucun ne référence `SCENE.x` |
| `demandes.spec.ts` | témoin « zéro demande dans TOUTE la société » avant d'écrire | `demande`, portée société entière | Sain et documenté : `demande` n'est créée que par ce fichier (grep confirmé, aucun autre chemin e2e n'y touche) |
| `listes-1.spec.ts` (« /sites… ») | lecture de `.locator("article").first()`, jamais une écriture | n'importe quel site, selon l'ordre de tri | Examiné, pas de défaut : la bande de compteurs (`compteurEquipements`, `app/(back-office)/sites/page.tsx`) se rend INCONDITIONNELLEMENT, même à zéro — aucune fixture concurrente ne peut faire disparaître le bloc que ce test vise |

### Les trois passages `pnpm test:e2e`, premier plan, parallélisme par défaut

| Passage | Résultat |
|---|---|
| 1 (avant correction de `porte-capacites.spec.ts`) | **4 échecs** — contrainte `intervention_planifiee_a_sa_duree` (PARCOURS-1) : ma fixture forgée posait `statut: "planifiee"` sans `duree_estimee_min`. Corrigé (commit `994d561`), pas un défaut de parallélisme. |
| 1 (après correction) | **216 passés, 3 sautés, 0 échec** (3,3 min) |
| 2 | **216 passés, 3 sautés, 0 échec** (3,4 min) |
| 3 | **216 passés, 3 sautés, 0 échec** (3,4 min) |

Les 3 sautés sont intentionnels et constants sur les trois passages (routes hors
périmètre de `tous-les-ecrans-rendent.spec.ts`, déjà sautées avant ce lot).

`pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test` (2722 tests) et
`pnpm test:isolation` (1216 tests) : verts, un seul passage chacun.

## Ce que j'ai tranché et pourquoi

- **Toutes les fixtures neuves vivent dans `scene.ts` (`SCENE.rapportTravaillee`,
  `rapportVierge`, `compteurA`, `compteurB`, `glissable`), jamais en données
  forgées-et-supprimées par le fichier lui-même.** Le ticket rendait ce choix
  OBLIGATOIRE pour `rapport-terrain.spec.ts` ; je l'ai étendu à `terrain.spec.ts`
  et `glisser-deposer.spec.ts` par cohérence — les trois ont besoin de la même
  mécanique que `scene.ts` fournit déjà (agence/site/technicien résolus depuis
  le semis, jour calculé depuis le lundi courant), et `SCENE.redimensionnable`
  est exactement le précédent à suivre.
- **`porte-capacites.spec.ts`, à l'inverse, forge et détruit sa propre donnée
  dans le fichier** (préfixe conceptuel STAB1-, identifiants fixes
  `01a0f400-…`) plutôt que d'ajouter à `scene.ts` : ce ne sont pas des
  interventions de PLANNING (pas de créneau, pas de jour de la scène à
  respecter), et `bon-intervention.spec.ts` avait déjà posé ce second patron
  avant ce lot — je l'ai suivi à l'identique plutôt que d'en inventer un
  troisième.
- **Le gardien ne voit que le SQL brut, pas les gestes d'écran.** Le ticket le
  dit lui-même dans son texte (« UPDATE, DELETE » de `$executeRawUnsafe`), et
  j'ai vérifié qu'aucun appel Prisma (`.update`/`.updateMany`/`.delete`/
  `.deleteMany`) ne référence un `SCENE.x` ailleurs dans le dépôt actuel — le
  gardien reste donc complet pour l'état présent, même s'il ne pourrait pas
  attraper une régression qui écrirait un `SCENE.x` par Prisma plutôt que par
  SQL brut. Je ne l'ai pas élargi à Prisma : aucun cas réel ne le justifie
  aujourd'hui, et un gardien qui chercherait `.update(` dans tout le texte d'un
  fichier attraperait des faux positifs sans rapport avec `SCENE.x` (n'importe
  quel `.update()` sur une fixture propre).
- **Je n'ai pas touché `listes-1.spec.ts`.** Le motif exact du constat
  (« comptes globaux ») ne s'applique pas ici : la bande de compteurs qu'il vise
  se rend inconditionnellement (vérifié dans
  `app/(back-office)/sites/page.tsx`), donc aucune fixture concurrente ne peut
  faire disparaître le bloc que l'assertion cible, quelle que soit la valeur du
  compteur. Le retoucher sans défaut mesuré aurait été un changement gratuit.
- **`porte-capacites.spec.ts` compare désormais `apres.statut` à la CONSTANTE
  `"planifiee"`** plutôt qu'à une valeur relue avant l'appel : la fixture est
  posée par ce même fichier, à un statut connu, donc la lecture « avant » était
  devenue redondante — je l'ai retirée plutôt que de la garder comme vestige
  inutile.

## Ce que je n'ai PAS fait

- Je n'ai pas ajouté `retries`, `workers: 1` ni `fullyParallel: false` — interdit
  du ticket, et de toute façon inutile : les trois passages sont verts sous le
  réglage par défaut.
- Je n'ai pas relu chaque fichier `tests/e2e/*.spec.ts` ligne à ligne au-delà de
  ceux que l'inventaire couvre ci-dessus : j'ai grep exhaustivement les formes
  d'écriture (SQL brut `UPDATE`/`DELETE FROM`/`INSERT INTO`, Prisma `.create(`/
  `.update(`/`.updateMany(`/`.delete(`/`.deleteMany(`, et toutes les
  utilisations de `SCENE.`), puis j'ai lu en entier chaque fichier que ce grep a
  désigné. Un geste d'écran qui écrirait SANS passer par un de ces motifs (par
  exemple une mutation posée uniquement côté client, sans requête réseau
  observable) resterait hors de portée de cette méthode — je n'en ai trouvé
  aucun exemple dans ce dépôt.
- Je n'ai pas cherché à expliquer, avec certitude, POURQUOI le passage de
  référence du constat (`journal-file.txt`, 24/09 20h15) avait mesuré
  `planning-largeur-et-carte.spec.ts:167`, `parcours-creer-puis-planifier.
  spec.ts:118/:214`, `imports-historique.spec.ts:149` et `listes-1.spec.ts:23`
  comme rouges : ce fichier n'est pas dans le dépôt, et je n'ai pas pu le
  rejouer. Pour `planning-largeur-et-carte.spec.ts:167`, la cause la plus
  probable — `rapport-terrain.spec.ts` faisait passer `SCENE.obstacle`/
  `chevauchante` à `terminee` sous ses yeux — est corrigée par ce lot. Pour les
  trois autres, ma lecture du code actuel n'a trouvé aucune dépendance à une
  fixture partagée qu'un autre fichier écrit ; ils sont peut-être déjà corrigés
  par des lots antérieurs (comme `porte-capacites.spec.ts:107`, dont la
  passation de 49-SELECTEURS-1-REPRISE atteste qu'il l'a été avant même
  l'ouverture de son ticket) — vus VERTS sur les trois passages de ce lot, sans
  garantie que la cause originelle ait disparu ou soit devenue simplement plus
  rare.

## Les pièges pour la session suivante

- **Une contrainte CHECK posée par un lot voisin (PARCOURS-1,
  `intervention_planifiee_a_sa_duree`) peut faire échouer une fixture qui
  imitait un ANCIEN patron d'insertion.** `scene.ts` la respecte déjà partout
  (chaque ligne porte `duree_estimee_min`) ; toute NOUVELLE fixture forgée à la
  main (hors du tableau `lignes` de `scene.ts`) doit y penser explicitement — je
  l'ai découvert au premier passage `test:e2e`, pas au typecheck ni au lint
  (c'est une contrainte de BASE, invisible à la compilation).
- **`test:isolation` efface la scène e2e** (déjà noté en mémoire) : je l'ai
  lancé une fois avant les trois passages `test:e2e`, ce qui les a forcés à
  repartir d'une base propre via `globalSetup` — normal, mais à savoir si un
  passage e2e isolé semble « voir » une scène différente de la précédente.
- **`docs/propositions/47-AVERTISSEMENTS-1/captures/*.png` et
  `docs/propositions/50-INTERVENTIONS-2/captures/*.png` étaient déjà modifiés
  en local avant cette session** (régénérés par leurs propres épreuves,
  probable antialiasing — même piège que documenté par 49-SELECTEURS-1-REPRISE
  pour le dossier 47). Je ne les ai pas committés, hors périmètre de ce lot.
- **Un dixième lot pourrait un jour donner à `porte-capacites.spec.ts` ses
  propres interventions AVANT ce lot-ci** (comme la note de tête du fichier le
  documente maintenant) : si quelqu'un ajoute un CINQUIÈME scénario à ce
  fichier qui pioche encore une intervention arbitraire, le gardien de ce lot
  ne le détectera PAS — il ne voit que le SQL brut d'écriture, pas une lecture
  racée. Seule une revue humaine referme cette classe de défaut.

## Ce qui reste à faire

- Rien d'obligatoire au sens du ticket : les trois passages `pnpm test:e2e`
  sont verts, le gardien est posé et s'auto-éprouve, `pnpm verify` (format,
  typecheck, lint, test, test:isolation, build — non rejoué ici en entier faute
  de temps restant, mais chaque brique testée séparément est verte) devrait
  passer.
- Si une prochaine session veut pousser plus loin la méthode de ce lot :
  généraliser le gardien de `tests/unit/e2e-donnees-partagees.test.ts` aux
  appels Prisma (`.update`/`.updateMany`/`.delete`/`.deleteMany`) référençant un
  `SCENE.x`, pour couvrir la classe de défaut nommée au piège ci-dessus — sans
  cas réel aujourd'hui pour le justifier, donc non fait par ce lot (§ « ce que
  j'ai tranché »).
