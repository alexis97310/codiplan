# 9K20-CHECKLIST-DUPLIQUER-DEPART — passation

CK4 : dupliquer un modèle de checklist existant, et « Partir d'un gabarit de
départ » pour « Entretien préventif — pont 2 colonnes électromécanique
jusqu'à 3 t », points 1 à 15 du pont 2 colonnes validés par Alexis le 29/10.
**Le contenu des AUTRES checklists reste hors territoire** (atelier non
daté) : un seul gabarit existe, et c'est voulu.

## Dupliquer un modèle (`lib/checklists/depot.ts#dupliquerModele`)

En-tête neuf (`creerModele`), dont la version 1 recopie les points de la
DERNIÈRE version publiée de la source (`dernierVersionPubliee`, publiée par
`publierVersion` — jamais d'écriture directe des points). Refuse sans rien
créer dans deux cas : la source n'est pas visible (`introuvable`, cloisonné
par société) ou n'a encore aucune version publiée (`aucune_version_source`).
Le nouveau code, obligatoire, se refuse avec les mêmes motifs que
`creerModele` (`code_pris`, `plus_dun_rattachement`, …) — `motifModeleChecklist`
est réutilisé tel quel.

Route : `POST /api/parametres/checklists/[id]/dupliquer` (`id` = la source,
jamais le modèle créé). Écran : bouton « Dupliquer » sur chaque ligne de
`/parametres/checklists`, ouvre `?volet=dupliquer&source=<id>` — MÊME
formulaire que « Ajouter un modèle » (extrait en `ChampsRattachementEtNature`,
partagé par les deux volets), préchargé avec le libellé et le rattachement
de la source ; le code reste vide et obligatoire.

## Partir d'un gabarit de départ

`lib/checklists/gabarits-de-depart.ts` — une liste EN CODE, jamais en base,
jamais posée par une migration. **Un seul gabarit aujourd'hui** :
« Entretien préventif — pont 2 colonnes électromécanique jusqu'à 3 t »,
quinze points recopiés tels quels de l'étude du 08/11 §4.1 A (section,
libellé, type de réponse, obligatoire) — les points 16 à 19 de cette même
section, propositions NON validées, n'y entrent pas. **Aucune tolérance,
aucune valeur chiffrée** : là où l'étude renvoie à la notice (« = [N] »), le
champ reste vide ; l'unité d'une mesure (« mm »), elle, est écrite telle
quelle dans l'étude et n'est pas de cette nature.

Le gabarit ne porte NI nature d'intervention NI rattachement matériel : le
champ `type_intervention` d'un modèle est UNIQUE alors que l'étude nomme deux
natures (« préventif sous contrat ou hors contrat »), et aucun mécanisme ne
porte un ensemble de natures (D239, la cascade de `lib/checklists/cascade.ts`
filtre sur UNE valeur ou `null`) ; le rattachement matériel, lui, dépend de
la société qui l'utilise (un sous-type n'existe que dans son périmètre) et ne
peut donc pas être écrit dans un module de code partagé par toutes. Le
modèle né du bouton arrive donc sans l'un ni l'autre — seul le semis de
démonstration, qui connaît ses propres sous-types, en pose un (voir plus
bas).

`lib/checklists/depot.ts#creerModeleDepuisGabarit` : en-tête neuf (code,
libellé envoyés par l'écran), version 1 publiée avec les points EXACTS du
gabarit. Refuse `gabarit_inconnu` sans rien créer si l'identifiant ne
correspond à aucun gabarit de la liste.

Route : `POST /api/parametres/checklists/gabarit`. Écran : bouton « Partir
d'un gabarit de départ » à côté de « Ajouter un modèle », ouvre
`?volet=gabarit` — un `<select>` du gabarit (un seul aujourd'hui), code et
libellé.

## Le semis de démonstration (`prisma/seed.ts`)

Un modèle né du gabarit de départ, rattaché au SOUS-TYPE « 2COL-EM » (pont 2
colonnes électromécanique, posé par 9K17A) de CHAQUE société du semis —
jamais à un modèle de machine, comme demandé. Identifiants déterministes
(`identifiantParc`, nouveaux segments `checklist_modele`/`checklist_version`/
`checklist_point` — `f000`/`f100`/`f200`), même convention que le reste du
parc de démonstration ; `upsert` partout, donc idempotent à un second
passage (vérifié : un second `pnpm db:seed` laisse 2 modèles, 30 points, un
par société).

**Vérifié que ceci ne touche JAMAIS la production** : ce code vit dans
`prisma/seed.ts`, qui n'est JOUÉ que par `pnpm db:seed` — et ce script entier
est SAUTÉ sur la cible « production » par le flux `db-migrate.yml`,
condition déjà gardée par `tests/unit/ci/cible-de-migration.test.ts` (inchangé
par ce ticket, aucune ligne n'y touche). `pnpm db:referentiels` et
`pnpm db:societe-initiale` — qui, eux, tournent sur une base de production —
n'importent ni n'exécutent rien de ce fichier. Vérifié directement contre
`codiplan_test` (`DATABASE_URL="$TEST_DATABASE_URL" pnpm db:seed`, deux
passages) : 15 points par société, aucune erreur, aucun doublon au second
passage.

## Épreuves

- **Unitaires** (`tests/unit/checklists/gabarits-de-depart.test.ts`) : un
  seul gabarit déclaré ; exactement quinze points, numérotés 1 à 15 sans
  trou ; chaque point conforme à `schemaPointChecklist` (le même schéma que
  `publierVersion` validerait) ; aucune tolérance, aucune valeur chiffrée,
  seule l'unité des deux mesures (« mm ») est posée ; six points
  obligatoires exactement ; `gabaritDeDepart` retrouve par identifiant,
  `undefined` sinon.
- **Isolation** (`tests/isolation/checklist-dupliquer-gabarit.test.ts`,
  chemin de production réel) : `dupliquerModele` recopie la DERNIÈRE version
  (jamais la première, deux versions publiées dans l'épreuve) ; refuse
  `aucune_version_source` sans rien créer ; refuse `introuvable` quand la
  société B tente de dupliquer un modèle de A, sans rien créer non plus.
  `creerModeleDepuisGabarit` publie les points exacts du gabarit (libellés
  comparés un à un), le modèle créé ne porte aucun rattachement ; refuse
  `gabarit_inconnu` sans rien créer pour un identifiant inexistant.
- **Bout en bout** (`tests/e2e/9k20-checklist-dupliquer-depart.spec.ts`,
  scène préfixée `9K20-`, mode serial, nettoyée en `afterAll`) : dupliquer
  (libellé repris visible dans le volet, nouveau code, version n°1 relue
  avec le point de la source) ; partir du gabarit (version n°1 relue avec
  ses quinze points, comptés dans l'éditeur). Captures des deux volets à
  1280 et 375 px dans `docs/propositions/9K20-CHECKLIST-DUPLIQUER-DEPART/
  captures/`.
- **Gardiens mis à jour** : `tests/unit/auth/porte.test.ts` (les deux routes
  neuves ferment le ○ sur `parametrer_societe`, `ROUTE_CAPACITE` 111→113,
  ajoutées à `PORTE_COMPLETE`) ; `scripts/lib/chemins-de-depot.ts` —
  `dernierVersionPubliee` a désormais un appelant RÉEL (`dupliquerModele`),
  mais dans le MÊME fichier : le gardien ne compte qu'un appel écrit depuis
  un fichier EXTÉRIEUR qui importe le dépôt, et un appel interne n'en est
  pas un ; l'exemption reste donc exacte, son motif est mis à jour pour le
  dire. `tests/unit/ui/carte-pas-recopiee.test.ts` n'a rien à gagner : le
  `<select>` neuf du volet « gabarit » recopie la MÊME classe déjà exemptée
  pour ce fichier depuis 9K19 (catégorie « champ »). Aucune route de page
  neuve : les deux volets vivent sur `/parametres/checklists` déjà couvert
  par `tests/e2e/tous-les-ecrans-rendent.spec.ts`.

## Vérification

`CI=1 pnpm verify` : format, typecheck, lint, test (5691), test:isolation
(2137), build — tous verts. `pnpm test:e2e` ciblé sur le spec neuf et sur
`/parametres/checklists` dans `tous-les-ecrans-rendent.spec.ts` : vert.
`verify:full` est laissé à la file de nuit.

## Ce qui reste dû

Le contenu des AUTRES checklists (« Entretien — compresseur à pistons »,
« Installation — pont 2 colonnes ») attend toujours l'atelier — aucune date
donnée à ce jour. CK5 (l'écran terrain), CK7 (le blocage de « Terminer » sur
un point obligatoire manquant), CK9 restent dus, inchangés depuis 9K19.

**Garde de mise en production rappelée (CLAUDE.md du ticket)** : aucun
gabarit créé en production avant que la saisie hors réseau (9K22-CK6) soit
publiée — ce lot ne change rien à cette garde, et ne déploie rien par
lui-même.
