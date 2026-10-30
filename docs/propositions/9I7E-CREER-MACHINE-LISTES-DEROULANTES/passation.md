# 9I7E-CREER-MACHINE-LISTES-DEROULANTES — passation

Bug signalé par Alexis (30/10/2026) : sur « Créer une machine », les champs déroulants ne se
déploient pas. Précision du même jour (~18:55), avec capture : sur `/parc/nouvelle`, le champ
Client ouvre bien sa liste, mais elle est coupée par le bas de la carte qui le contient.

## Point 1 — reproduction

Mesuré, puis éprouvé par `tests/e2e/9i7e-creer-machine-listes-deroulantes.spec.ts` : la cause
est `components/ui/carte.tsx:180` — `overflow-hidden` sur la racine de `Carte`, posé pour garder
les coins arrondis sur tout contenu (y compris un tableau qui va jusqu'au bord). `/parc/nouvelle`
pose chaque champ dans une `Carte` par `SectionFormulaire` (`components/ui/section-formulaire.tsx:36`).
La section 1, « Où est la machine », ne contient que les champs Client et Site côte à côte — la
carte qui les entoure est donc très courte (un titre, un `gap-4`, une seule rangée de champs), et
le panneau de résultats de `SelecteurRecherche` (`max-h-64`, jusqu'à 256 px, posé en `absolute`
juste avant ce lot) dépassait largement le bas de cette carte courte. `overflow-hidden` rognait
ce dépassement.

**Les épreuves existantes ne pouvaient pas le voir** : `choisirPremierResultat` et
`choisirResultatParTexte` (`tests/e2e/setup/selecteur-recherche.ts`) cliquent toujours le PREMIER
résultat, qui reste visible (il se rend juste sous le champ, avant la coupure). La nouvelle aide
`assertListeVisibleEtCliquable` exige au moins deux résultats et éprouve le DERNIER — boîte non
nulle, dans la fenêtre, et son centre retombe bien sur l'option par `elementFromPoint` (pas sur ce
qui la recouvre).

**Mesuré AVANT correctif, un seul champ reproduit vraiment le rognage sur cette page** :

| Champ | 1280 px | 375 px (tactile) |
|---|---|---|
| `client_id` | rouge (`recouverte: true`) | rouge (`recouverte: true`) |
| `site_id` | non rejoué — le test s'arrête à la première assertion rouge (`client_id`) | idem |
| `modele_id` | idem | idem |

`site_id` partage EXACTEMENT la même carte courte que `client_id` (section 1, deux champs côte à
côte) — la mesure s'arrête à la première assertion rouge, mais la cause (la même carte, la même
hauteur insuffisante) s'applique identiquement, et le correctif du point 2 le couvre comme
`client_id` (voir la colonne « après » ci-dessous, où les trois passent). `modele_id` est dans la
section 2, beaucoup plus longue (famille, numéro de série, aide, date de vente, référence) : sa
carte est assez haute pour ne pas rogner le panneau dans mes mesures, mais rien ne le garantit à
l'avenir si cette section raccourcit — le correctif s'applique à elle aussi, sans condition.

**Balayage des quatre écrans qui emploient `SelecteurRecherche`** (`git grep -n SelecteurRecherche`,
30/10/2026) : `/sites/nouveau`, `/interventions/nouvelle` et `/demandes?nouvelle=1` NE
reproduisent PAS le rognage aujourd'hui — leurs cartes portent plus de contenu sous le champ
touché (champ + libellé + rattachement pour `/sites/nouveau` ; champ + note + machines + contact
pour `/interventions/nouvelle` ; le volet de `/demandes` n'est même pas dans une `Carte`, mais
dans un panneau à `overflow-y-auto`). Les quatre sont couverts par la nouvelle épreuve
(`assertListeVisibleEtCliquable`), à 1280 et 375 px tactile, pour qu'une évolution future de leur
disposition ne fasse pas revenir ce défaut sans qu'un gardien ne le voie.

## Point 2 — correctif

`components/ui/selecteur-recherche.tsx` : le panneau de résultats se rend désormais par
`createPortal` dans `document.body`, en `position: fixed`, ses coordonnées (`top`, `left`,
`width`) recalculées depuis le champ texte (`getBoundingClientRect`) à l'ouverture, au
défilement (écoute posée en CAPTURE sur `window`, pour voir aussi un ancêtre scrollable qui ne
ferait pas remonter son évènement par bouillonnement — le volet de `/demandes`) et au
redimensionnement.

**Pourquoi pas retirer `overflow-hidden` de `Carte`** : ce `overflow-hidden` tient les coins
arrondis de TOUT le contenu d'une carte, y compris un tableau qui va jusqu'au bord (voir la note
de tête de `carte.tsx`) — le retirer aurait replacé un défaut (liste rognée) par un autre (coins
carrés derrière un tableau). Le correctif reste confiné à `SelecteurRecherche`, le seul composant
qui pose un panneau flottant à côté d'une carte, et vaut pour les QUATRE écrans d'un seul geste,
sans toucher à `Carte` ni changer ce que les listes proposent ou qui peut les voir.

`tests/unit/ui/lot-parc.test.ts` : son aide `choisirModeleTape` cherchait le panneau dans le
`container` du rendu — devenu faux puisque le panneau n'est plus un descendant de `container`
(il est sous `document.body`). Corrigé pour chercher dans `document.body`, seul changement requis
par les tests unitaires existants ; tout le reste de la suite (`pnpm test`, 488 fichiers,
5289 épreuves) passe sans autre modification.

## Point 3 — rejeu

`CI=1 pnpm test:e2e tests/e2e/9i7e-creer-machine-listes-deroulantes.spec.ts --workers=1
--repeat-each=2` : 16/16 vertes (8 épreuves × 2).

## Point 4 — captures

`docs/propositions/9I7E-CREER-MACHINE-LISTES-DEROULANTES/captures/{avant,apres}/` — sélecteur de
client sur `/parc/nouvelle`, focus simple (aucun texte tapé, comme Alexis), à 375 et 1280 px,
rejouées sur les clients de démonstration du semis (`tests/e2e/captures-9i7e-creer-machine-listes-deroulantes.spec.ts`).

- **1280 px, AVANT** : AUCUNE ligne du panneau visible — rogné en entier (pire que la capture
  d'Alexis en production, où une ligne et demie dépassait ; écart probablement dû à un rendu de
  police ou une fenêtre légèrement différente, sans conséquence sur le diagnostic).
- **1280 px, APRÈS** : les deux options se voient entières, par-dessus la carte suivante.
- **375 px, AVANT et APRÈS** : IDENTIQUES — les deux clients de démonstration actifs ne suffisent
  pas à faire déborder la carte en disposition une colonne (le champ Site descend sous le champ
  Client, dans la MÊME carte, qui devient assez haute pour contenir le panneau). Cette capture ne
  mesure donc rien à 375 px ; c'est l'épreuve e2e du point 1, avec sa propre scène à trois
  résultats, qui mesure le rognage aux DEUX largeurs (voir le tableau du point 1).

## Point 5 — vérification

`CI=1 pnpm verify:full` lancé en entier, au premier plan, en un seul appel — **coupée par le
budget (45 min), en plein `pnpm test:e2e`, avant son résumé final** ; voir `verify-final.txt`.

`format:check`, `typecheck`, `lint`, `test` (488 fichiers, 5289 épreuves) et `test:isolation`
(195 fichiers, 1723 épreuves) sont allés au bout, **tous verts**. `build` est allé au bout (la
suite a enchaîné sur `feries:horizon`/`audit:partitions` puis `test:e2e`, qui ne se lance
qu'après). Le point 3 (rejeu ciblé `CI=1 --workers=1 --repeat-each=2` du seul fichier de ce lot,
16/16 vertes) reste la preuve directe que le correctif tient.

**Contrairement au `verify-final.txt` du lot précédent (9I7D), je NE PEUX PAS écrire « aucun échec
observé »** : le reporteur de `test:e2e` (1781 épreuves au total, large suite, pas seulement
celles de ce lot) montre des marques `F` (25) et `×` (12) avant la coupure — des échecs ou des
reprises, sur des fichiers que je n'ai pas identifiés nommément, le run s'étant arrêté avant son
résumé. Je n'ai pas eu le budget pour les mesurer aussi sur `origin/main` (§ budget) et ne peux
donc PAS affirmer qu'ils sont étrangers à ce lot — seulement que mon territoire (`selecteur-
recherche.tsx` et ses quatre appelants) est confiné, que son épreuve dédiée est verte, répétée, et
que je n'ai touché aucun autre fichier sous `tests/e2e/` que ceux que je liste au point 1 et 4.
**À vérifier avant la prochaine étape** : relancer `CI=1 pnpm test:e2e` (sans `--grep`) jusqu'à son
résumé, ou comparer ces marques à un rejeu sur `origin/main`.

`git fetch origin` / `git rebase origin/main` / `CI=1 pnpm verify` de fin de lot : NON JOUÉS,
faute de budget restant après la coupure ci-dessus.

## Ce qui reste ouvert

1. Les marques `F`/`×` de `test:e2e` ci-dessus, non attribuées.
2. Le rebase de fin de lot et le `pnpm verify` qui le suit.

Rien d'autre identifié dans le territoire de ce lot. Le correctif est au niveau du composant
partagé, pas d'une page particulière ; aucune carte n'a été modifiée.

## Reprise 9I7E1-REPRISE-9I7E (31/10/2026)

Vérification indépendante du lot ci-dessus : **38 épreuves e2e rouges**, cause mesurée dans la
consigne de reprise — `createPortal` sortait le panneau de `[data-selecteur="…"]`, le sous-arbre
que `tests/e2e/setup/selecteur-recherche.ts` cherche (`ul[role="listbox"] li[role="option"]`
DESCENDANT du bloc). Le portail cassait aussi la portée d'un dialogue (`aria-modal`) et l'arbre
d'accessibilité attendu (la liste n'est plus voisine de son champ).

### Ce qui a changé

Branche dédiée `9I7E1-REPRISE-9I7E`, partant d'`origin/main` (`fa314d8cd`, `main` étant extrait
ailleurs) — les cinq commits de la garde `9I7E-CREER-MACHINE-LISTES-DEROULANTES-garde` repris par
cherry-pick, sans conflit.

`components/ui/selecteur-recherche.tsx` : retrait de `createPortal` et de son import. Le panneau
reste un ENFANT ordinaire de `<label data-selecteur="…">` — même DOM, mêmes attributs `role`,
`id`, `data-*` qu'avant 9I7E — mais toujours en `position: fixed`, coordonnées recalculées depuis
le champ texte (même mécanique qu'avant : ouverture, défilement en capture, redimensionnement).
`position: fixed` se positionne par rapport à la FENÊTRE (ou au bloc conteneur le plus proche avec
`transform`/`filter`/`contain`) — MESURÉ qu'aucun ancêtre (`Carte`, `Volet`,
`app/(back-office)/template.tsx`) ne pose l'une de ces trois propriétés (`grep -n
"transform\|filter\|contain\|backdrop"`, aucune occurrence) : rien ne recrée de bloc conteneur qui
ramènerait le panneau dans le flux rogné. Il échappe donc à `overflow-hidden` de `Carte` sans
sortir du sous-arbre que les épreuves attendent.

`tests/unit/ui/lot-parc.test.ts` : son aide `choisirModeleTape`, que 9I7E avait fait chercher dans
`document.querySelectorAll` (pour suivre le panneau hors du `container`), revient à chercher dans
`container.querySelectorAll` — exact comme avant 9I7E, puisque le panneau y est de nouveau.

### Rejeu — 40 fichiers e2e touchés par `SelecteurRecherche` (`data-selecteur=`, le composant, ou
ses aides), `CI=1 --workers=1 --repeat-each=2`, EN UN SEUL APPEL

**297 passées, 6 rouges, 20 ignorées, 1 non jouée (16 min).** Les six rouges —
`creation-jour-ferme.spec.ts:193`, `fiche-technicien-nomme.spec.ts:185`,
`intervention-technicien-select.spec.ts:178/194/275`, `parcours-creer-puis-planifier.spec.ts:129`
— portent TOUTES sur `select[name="technicien_id"]`, un `<select>` NATIF, jamais sur
`SelecteurRecherche` : aucune ne cite `listbox`, `data-selecteur` ni une coordonnée de panneau.
Lues (`fiche-technicien-nomme.spec.ts:140-150`) : ces épreuves plantent un rendez-vous au même
technicien, au même jour fixe (« mardi +35 », choisi par commentaire pour NE PAS entrer en
collision avec les scénarios `+21`/`+63` des DEUX AUTRES fichiers) — `--repeat-each=2` rejoue deux
fois le MÊME fichier dans la MÊME session, donc le même scénario entre en collision AVEC
LUI-MÊME au second passage (le créneau est déjà pris par le premier), d'où « Aucun technicien
affecté » / bouton absent / redirection non suivie. Aucune des six ne touche
`components/ui/selecteur-recherche.tsx` ni mon territoire. **Non mesuré sur `origin/main` faute de
budget** (construire un second arbre de travail aurait coûté le temps restant) — mais la lecture du
code montre une cause mécanique à `--repeat-each=2` lui-même, étrangère au portail retiré ou au
positionnement du panneau, donc étrangère à ce lot. **À vérifier si un doute subsiste** : rejouer
ces six seules, une fois chacune (`--repeat-each=1`), ou sur `origin/main`.

Les six épreuves NOMMÉES par la consigne de reprise (`9edz-nouvelle-demande.spec.ts:201`,
`saisie-gardee-tpa4b.spec.ts:204`, `selecteur-client-homonymes-cs40.spec.ts:116`,
`selecteurs-1.spec.ts:172`, `site-client-inactif-masque-a-la-creation.spec.ts:43`,
`sites.spec.ts:184`) sont TOUTES vertes, répétées deux fois. L'épreuve dédiée de 9I7E
(`9i7e-creer-machine-listes-deroulantes.spec.ts`) et ses captures (`captures-9i7e-…spec.ts`) sont
vertes aussi.

Captures régénérées comme effet de bord par d'AUTRES épreuves du rejeu (hors territoire) —
constatées par `git status`, **écartées avant commit** (`git checkout --` sur les fichiers suivis,
`rm` sur les deux nouveaux) : `47-AVERTISSEMENTS-1`, `50-INTERVENTIONS-2`, `55-FORMULAIRES-1`,
`56-FORMULAIRES-2`, `92-CREATION-2`, `9EI-TP-UX5-1-FORMULAIRES`,
`9F5B-CORRECTIFS-AUDIT-FONCTIONNEL`.

### Captures (point 4)

Les captures `apres` de `/parc/nouvelle` existantes (9I7E) ressortent BYTE-IDENTIQUES après le
retrait du portail — mesuré par `git status` après le rejeu : aucun fichier modifié. Logique : le
rendu pixel de `position: fixed` ne dépend pas de l'endroit du DOM où l'élément est monté, seulement
de ses coordonnées calculées. Pas de nouvelle capture `avant`/`apres` nécessaire pour cet écran.

Second écran ajouté, comme demandé : `/interventions/nouvelle`, sélecteur de site — celui que la
note de tête du composant cite pour le cas d'un ancêtre SCROLLABLE (le volet de `/demandes`
n'étant, lui, jamais sur cet écran). `tests/e2e/captures-9i7e-creer-machine-listes-deroulantes.spec.ts`
étendu d'un second test ; captures `apres` à 375 et 1280 px dans
`docs/propositions/9I7E-CREER-MACHINE-LISTES-DEROULANTES/captures/apres/` — le panneau s'affiche
entier, par-dessus le contenu qui suit, sans rognage.

### Vérification de fin de lot

`CI=1 pnpm verify:full` lancé en entier après ce fichier, EN UN SEUL APPEL — voir `verify-final.txt`
pour ce qu'il a couvert avant la coupure éventuelle de budget.

## Ce qui reste ouvert (après la reprise)

1. Les six rouges de `--repeat-each=2` (`select[name="technicien_id"]`, collision de créneau fixe
   avec elle-même) ne sont pas mesurées sur `origin/main` — lecture du code seulement.
2. Hors territoire de ce lot : aucune proposition de correctif pour ce point 1, qui préexiste à
   9I7E et 9I7E1 et touche un mécanisme différent (planification manuelle par `<select>`, pas
   `SelecteurRecherche`).
