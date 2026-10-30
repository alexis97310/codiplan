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
