# VGP-IMPORT — le neuvième gabarit, et le dixième : les vérifications réglementaires et leurs réserves

Travail commité **sur `main` en local**, sans proposition ni branche distante
(processus du 22/09/2026), **après** REPRISE-HISTORIQUE — qui dormait dans
`stash@{0}`, entier mais jamais commité, et qui a été commité tel quel en
tête de session (`4726c66`) une fois mesuré vert. Ce lot en reprend la forme :
dates rendues `JJ/MM/AAAA` par le dictionnaire de ligne, `indexerLesParcs`,
machines par série avec leur client, comptes de rattachement sur le rapport.

Captures prises le **2026-09-22 à 04:58 UTC** (15:58 à Nouméa), contre le
serveur de production compilé (`next start`) sur la base d'épreuve locale de
`pnpm test:e2e` : migrations, semis de `prisma/seed.ts`. Aucune donnée de la
base hébergée (I9) — les 333 rapports et 670 observations d'Alexis ne sont
pas dans le dépôt, et les mesures ci-dessous sont celles du ticket, refaites
par lui le 22/09. Largeur 1280 px. `mesure.json` est la sortie brute du
scénario `tests/e2e/imports-vgp.spec.ts` : empreinte du commit sous lequel
il a tourné, horodatage, les comptes tels que la page les a rendus, le texte
des cellules.

## Ce qui a été mesuré avant de coder

**Les tables.** `vgp_verification` : `machine_id` **NOT NULL**,
`date_verification`, `organisme`, `reference_rapport` (nullable), `origine`
(énumération close à quatre valeurs, sans défaut — D114), `document_id`. Ni
inspecteur, ni conformité, ni avis, ni client. `vgp_observation` :
`verification_id` NOT NULL, `libelle`, `intervention_id` nullable. Ni code,
ni date de signalement, ni statut, ni document de réponse. `vgp_campagne` ne
concerne pas ce lot.

**Aucun état « en attente de rattachement » n'existe** — ni colonne, ni
table, ni statut, nulle part dans le produit.

**Les chemins d'écriture.** `lib/vgp/verification.ts` crée et lit ;
**rien ne modifie** une vérification existante. `vgp_observation` : seul
`planifierLObservation` écrit, et il ne pose que `intervention_id`.
`observationsEnAttente` et `verificationsDeLaMachine` n'ont **aucun appelant**
dans `app/` — « consultable » veut dire aujourd'hui : dans le rapport du lot,
et par ces fonctions le jour où un écran les appellera.

**L'arbitrage 2 tient par construction.** `etatDeLInformation`
(`lib/vgp/information.ts`) rend `hors_registre` tant que la famille n'est pas
`soumis`, et l'échéance est DÉDUITE de la périodicité déclarée, jamais
stockée. Un PV importé ne recalcule rien : il n'y a rien à recalculer.
L'épreuve d'isolation le mesure après l'import plutôt que de le supposer.

**La grammaire du marqueur** (`lib/excel/format.ts`) :
`^CODIPLAN-([a-z0-9_]+)-v(\d+)$`. Le marqueur `CODIPLAN-vgp-observations-v1`
du ticket **est illisible** — le tiret n'est pas admis dans le type. Le type
est `vgp_observations`, et la grammaire n'a pas été touchée.

**La liste des riens de `cleDeRapprochement`** (`lib/excel/rapprochement.ts`,
hors territoire) tient déjà `?`, `sans`, `n/a`, `nc`, `-` — mais pas
`illisible`.

## Ce qui a été tranché, et pourquoi

### 1. La clé des vérifications est le RANG de la ligne — et c'est écrit

56 références pour 333 lignes ; 58 paires `(référence, n° de série)` en
double ; et le gabarit ne porte ni « équipement » ni « localisation » qui
les départageraient. **Aucune colonne du gabarit ne fait une clé.** La clé
est `LIGNE-<rang>` — la clé de dernier recours de `lib/excel/controle.ts`,
celle du gabarit « clients ».

Conséquence, écrite plutôt que subie : **un second dépôt du même fichier
recharge tout** — 333 vérifications de plus —, et l'annulation du lot est
le seul recours. Le détail du type le dit sur `/imports` avant le dépôt ;
`indexerLeParcVgp` (`lib/imports/parc-cibles.ts`) est un index **vide par
décision**, avec son motif, à l'endroit où le gardien de
`types-dimport.test.ts` exige un index par type applicable. L'épreuve
d'isolation redépose le même fichier et constate trois créations à nouveau.
Acceptable pour une archive qu'on importe une fois ; pas pour un
référentiel — c'est pourquoi aucun autre gabarit ne fait de même.

### 2. « En attente de rattachement », sans migration — et ce que ça coûte

`machine_id` est NOT NULL : un PV sans machine **ne peut pas entrer dans
`vgp_verification`** sans migration. Le seul domicile qui existe est
`import_lot_ligne` — la ligne du fichier telle que lue, qui survit à
l'application et à l'annulation — et c'est déjà là que REPRISE-HISTORIQUE
range cinq colonnes sans arrivée.

**Représentation retenue** : la ligne est classée au contrôle sous l'un de
quatre motifs (`MOTIFS_ATTENTE`, `lib/imports/vgp.ts`) — sans série, série
inconnue, série ambiguë, série chez un autre client —, dans la colonne que
la base tient pour cela (`rejet_motif`). Le rapport la compte **à part**
(section « Rattachement aux machines » : rattachées / en attente / autres
rejets) avec le n° de série lu et le motif ; chaque libellé commence par
« En attente de rattachement — » et dit le geste ; et le fichier des rejets
(RG-IMP-03) la rend **rechargeable** : machine identifiée, cellule corrigée,
fichier redéposé, le PV entre par le chemin ordinaire.

**Ce que cela affirme de trop** : dans le vocabulaire de la base, cette ligne
est un `rejet`, et `lignes_rejets` la compte avec les vraies erreurs. Le PV
n'est pas dans le registre — `dernieresInformations` ne le voit pas. Le
libellé, le compte séparé et le fichier rechargeable disent la même chose
qu'un état, mais ce n'en est pas un.

**Pourquoi pas l'autre représentation** — classer `creation` et ne rien
écrire : le rapport mentirait (« 333 créations » validées, 319 écrites, et
les 14 manquantes indiscernables d'un parc qui a bougé). C'est ce que L1-08h
a fermé.

**Condition de réouverture, vérifiable** : une migration qui rend
`machine_id` nullable, ou une table des PV en attente. L'une et l'autre sont
un arbitrage (§8, changement de schéma), pas une ligne de ce lot. Deux
options, avec leurs conséquences, pour le jour où il sera rendu :
- *`machine_id` nullable* — une ligne, mais chaque lecteur du registre doit
  apprendre qu'un PV peut n'avoir pas de machine (`dernieresInformations`,
  la forme « filiation » de la politique RLS qui passe par `machine`) ;
- *une table `vgp_verification_en_attente`* — rien ne change pour le
  registre, et un geste de rattachement la vide ligne à ligne.

### 3. L'origine vient du FICHIER, par une colonne « Origine » obligatoire

`origine` est obligatoire et sans défaut : *une origine par défaut serait
une valeur probante inventée* (D114), et elle le serait 333 fois. Le gabarit
ne choisit rien : il expose une colonne **« Origine »**, obligatoire, aux
quatre codes que le formulaire de saisie accepte déjà (`rapport_organisme`,
`rapport_transmis_client`, `vignette_constatee`, `declaration_client`),
insensible à la casse. Une valeur hors liste est un rejet à son propre motif
(`origine_inconnue`), qui nomme les quatre.

**Le fichier remis à Alexis ne porte pas cette colonne.** La grammaire le
dira par son nom (`colonne_obligatoire_absente` : « Origine »), et une
colonne remplie d'une seule valeur se pose en un geste. *C'est celui qui
tient les rapports qui sait d'où ils viennent.*

### 4. Une référence de rapport couvre un PARC — et l'observation doit dire quelle machine

`vgp_observation.verification_id` désigne UNE vérification ; « Réf. rapport »
en désigne jusqu'à 44. Le ticket ne donne à l'observation aucune colonne de
machine. **Rattacher « la première » poserait une réserve sur la fiche
d'une machine qui n'est pas la sienne** — ce que D88 interdit de prétendre
savoir.

Le gabarit des observations expose donc une colonne **facultative**
« Machine (n° de série) » qui départage ; sans elle, une référence qui
couvre plusieurs PV est refusée `rapport_ambigu`, avec son motif. Une
référence inconnue est refusée `rapport_introuvable`, et le libellé dit
l'ordre : vérifications d'abord, appliquées, observations ensuite — les
parents se lisent dans `vgp_verification`, jamais dans un lot seulement
contrôlé.

**Ce que ce choix coûte, non mesurable d'ici** : sur l'archive réelle, la
part des 670 observations dont la référence couvre plusieurs PV — et qui
seront donc refusées tant que la colonne n'est pas remplie. Si le fichier
des observations de Bureau Veritas porte l'équipement, la colonne se remplit
depuis lui. **C'est le premier point à mesurer sur le vrai fichier.**

### 5. La clé d'une observation est le couple (rapport, code)

Le ticket tient le code pour LA clé, et rien ne le contredit : si les codes
sont uniques sur l'archive, le rapport dans la clé ne change rien. S'ils ne
le sont que par rapport — « 1 », « 2 », « 3 » sous chaque référence, ce que
la mesure n'a pas exclu —, une clé au code seul rejetterait en
`doublon_fichier` tout ce qui suit la première ligne. Une observation déjà
reprise (même couple, encore vivante en base) est refusée
`observation_deja_reprise` — la forme de `document_deja_repris`, par la
ligne de lot qui l'a écrite.

### 6. Les listes closes, mesurées et non supposées

- **Non-valeurs du n° de série** : `sans`, `?`, `illisible` — insensible à la
  casse (`NON_VALEURS_SERIE_VGP`). Lue d'abord ; le reste est confié à
  `rattacherLaMachine` de REPRISE-HISTORIQUE, la même fonction pour les
  trois rangs, étendue à un client `null` (sans client, le rang 2 n'existe
  pas : la série désigne une machine, ou elle est ambiguë).
- **Conformité** : `oui`, `non`, `?` — le « ? » est écrit tel quel, forcé
  ni à oui ni à non. Une quatrième valeur est refusée, jamais rangée.
- **Statut d'une observation** : les trois valeurs réelles, comparées après
  `normaliserRaisonSociale` (accents, casse, ponctuation). « Chiffrée -
  devis émis » n'est PAS rabattue sur « non levée ».

**Le modèle ne sait accueillir ni la conformité, ni l'avis, ni
l'inspecteur, ni le statut, ni le code, ni la date de signalement, ni la
réponse** : chacun est validé par le schéma de sa ligne
(`schemaLignePv`, `schemaLigneObservationVgp`) et conservé dans
`import_lot_ligne.valeurs`, retrouvable par `entite_id`. Ils n'apparaissent
sur aucune fiche. Les porter sur la fiche est une migration. **Le statut, en
particulier** : le produit ne sait dire d'une observation que « planifiée »
ou pas ; une « Levée - facturée » importée a `intervention_id` NUL comme une
« Non rattachée », et `observationsEnAttente` — sans appelant aujourd'hui —
la listerait le jour où un écran l'appellera. C'est un arbitrage (§8 :
« levée » est ce qu'un client voit).

### 7. « Client / Site » n'est qu'un contrôle de cohérence

Lue par la règle de RG-IMP-05 (code externe, à défaut raison sociale), puis
— l'en-tête porte une barre — par ce qui précède la première barre. Reconnue,
elle départage (rang 2) ou contredit (« série chez un autre client » → en
attente). Non reconnue, elle ne refuse rien : elle est conservée dans la
ligne et ne contrôle rien.

### 8. L'annulation, à rebours de l'import

Un PV est défait s'il est intact — reconstitué par le même `preparerUnPv`
que l'application, cinq colonnes comparées — et **si aucune observation ne le
retient** (`referencee_depuis`, jamais de cascade). Une observation est
défaite si son libellé est celui de la ligne et si **aucune intervention ne
l'a prise en charge** (I5). L'ordre est donc : annuler les observations,
puis les PV — l'épreuve d'isolation et le scénario e2e le jouent dans les
deux sens.

## Les épreuves, et leurs comptes

Écrites après une première implémentation dans cette session, puis
**mesurées rouges** en retirant `lib/` et `app/` du plan de travail
(`git stash push -- lib app`) : 26 échecs sur 27 dans
`tests/unit/imports/gabarit-vgp.test.ts` — puis vertes une fois restaurés.

- `tests/unit/imports/gabarit-vgp.test.ts` — **27 épreuves** : les deux
  gabarits confrontés à leur schéma (exposé ou écarté nommément, aucune
  colonne orpheline) ; quatre lignes identiques = quatre créations sous
  `LIGNE-3..6` ; les trois conformités et le refus d'une quatrième ; les
  quatre origines et le refus d'une inconnue ; chaque non-valeur écrite en
  mots → attente « sans série » ; inconnue / ambiguë / autre client ; le
  client qui départage, lu avant sa barre ; l'ISO refusé `date_format` ; les
  trois statuts, canonisés, et le refus d'un quatrième ; le parent
  introuvable, ambigu, départagé ; le doublon dans le fichier ; le déjà
  repris ; la date de réponse.
- `tests/isolation/application-import-vgp.test.ts` — **11 épreuves**, la
  chaîne entière sous le rôle applicatif, relue en SQL sous le
  propriétaire : 3 PV écrits (`vgp_verification` : +3), origine ligne à
  ligne, « ? » conservé, l'attente encore dans le lot sous son motif avec
  `entite_id` NUL ; **arbitrage 2** : `hors_registre` après l'import ; le
  même fichier redéposé → 3 créations à nouveau ; observations : 3 entrent,
  `rapport_ambigu` + `rapport_introuvable` ; **arbitrage 1** :
  `vgp_observation` +3, `demande` +0, `intervention` +0, `intervention_id`
  NUL partout ; le même fichier → `observation_deja_reprise` ×3 ; société B
  → `lot_introuvable` ; annulation des PV refusée ×3 `referencee_depuis` ;
  annulation des observations : 2 défaites, 1 retenue `referencee_depuis`
  (planifiée depuis) ; puis annulation des PV : 3 défaites,
  `vgp_verification` −3.
- `tests/e2e/imports-vgp.spec.ts` — **4 scénarios** : les deux types dans la
  liste, complets ; le rapport des PV (1 création, 3 rejets, dont 2 en
  attente comptées à part, motifs visibles) ; les observations (2 créations,
  1 refus « rapport introuvable ») ; l'annulation à rebours (partielle sur
  les PV tant que les observations existent, totale ensuite).

## Ce qui a changé

- `lib/imports/vgp.ts` *(neuf)* — listes closes, motifs d'attente, schémas
  des deux lignes, rattachement d'un PV, clés.
- `lib/imports/parc-vgp.ts` *(neuf)* — le registre par référence de rapport.
- `lib/imports/rapport-vgp.ts` *(neuf)* — les trois comptes, lus sur les lignes.
- `lib/vgp/depot-import.ts` *(neuf)* — l'écriture en lot, un `createMany`.
- `lib/imports/modeles.ts` — les deux gabarits, `preparerUnPv`,
  `preparerUneObservationVgp`, `ParcsDImport` étendu.
- `lib/imports/parc-cibles.ts` — `indexerLeParcVgp` (vide, motivé),
  `indexerLeParcVgp_observations` ; la lecture des lignes vivantes extraite
  de l'historique (`lignesVivantesDuType`) pour ne pas la recopier.
- `lib/imports/parcs.ts`, `application.ts`, `annulation.ts`,
  `types-dimport.ts`, `reprise.ts` (client `null`).
- `app/(back-office)/imports/` — les deux types, les huit motifs, la
  section « Rattachement aux machines » d'un lot de VGP.
- `lib/i18n/fr.ts` — 25 clés.
- `tests/unit/imports/gabarit-historique.test.ts` — les deux parcs neufs dans
  ses parcs fabriqués (le type l'exige) ; rien d'autre n'y change.

## Ce qui n'a pas été fait, et pourquoi

- **Pas de migration**, et donc pas de vrai état « en attente », pas de
  colonne pour la conformité, le statut, l'inspecteur : chacun est un
  arbitrage (§8), et ce lot les nomme sans les rendre.
- **Le marqueur du ticket n'est pas celui du gabarit** (`vgp_observations`
  au lieu de `vgp-observations`) : la grammaire, hors territoire, ne lit pas
  le tiret, et le ticket interdit de l'assouplir.
- **Le fichier d'Alexis n'a pas été lu** (I9) : les en-têtes du gabarit sont
  écrits en français accentué (« Date de vérification », « Réf. rapport »,
  « Avis général »), comme les huit autres gabarits ; si le classeur porte
  une autre graphie, la grammaire nommera la colonne et sa ressemblance. Et
  il lui manque **« Origine »** (obligatoire) — voir le point 3.
- **Le taux d'observations refusées `rapport_ambigu` sur le vrai fichier
  n'est pas mesuré** — voir le point 4. C'est la première chose à regarder.
- **`RIEN` de `lib/excel/rapprochement.ts` n'a pas reçu `illisible`** : hors
  territoire, et la liste de ce module dit autre chose (ce qui n'identifie
  pas une fiche du parc, D6) que celle de l'archive.
- **Pas de protection contre un second dépôt** au-delà de l'avertissement
  et de l'annulation : toute clé de contenu aurait refusé un PV légitimement
  identique à un autre — les quatre vérins de `315505382.1.R`.

## `pnpm verify:full`, en entier, avant de commiter

Un passage, du **2026-09-22 vers 05:00 UTC** : format, typecheck, lint,
**2 530 unitaires** (230 fichiers), **1 077 d'isolation** (101), build,
`feries:horizon`, `audit:partitions` (13 partitions couvertes, défaut vide),
e2e **126 verts, 2 sautés nommés** — `EXIT=0`.
