# 9I3-CITATIONS-DECISIONS-ET-D127 — passation

Branche dédiée `9i3-citations-decisions-et-d127`, partant d'`origin/main` : `main` était extrait
dans un autre répertoire de travail (`/home/aplou/codiplan`) au moment d'ouvrir ce lot.

## Point 1 — D127 recopiée telle quelle dans le registre

Insérée entre D126 et D128 (`docs/arbitrages.md`), datée du 18/09/2026, avec la citation exacte
d'Alexis et le contenu intégral de `/mnt/c/Users/aplou/OneDrive/Bureau/Développement/CODIPLAN/
pilote/w/D127-texte-projet.md`, sans reformuler la règle. Seule adaptation : les quatre sous-titres
`##` du fichier source sont devenus des `### ... ` en CAPITALES, au format des entrées voisines
(D126, D128) — la numérotation, le tableau des trois rangs, les listes et le texte lui-même n'ont
pas bougé d'un mot.

Les 16 fichiers du dépôt qui citent `D127` résolvent désormais vers ce titre (vérifié par
`grep -rl "\bD127\b" app components lib tests scripts`, et par le gardien du point 4) :

```
app/(back-office)/imports/[id]/page.tsx
app/(back-office)/imports/presentation.ts
app/(back-office)/imports/types.ts
lib/i18n/fr.ts
lib/imports/annulation.ts
lib/imports/application.ts
lib/imports/modeles.ts
lib/imports/parc-machines.ts
lib/imports/rapport-historique.ts
lib/imports/reprise.ts
lib/imports/vgp.ts
lib/interventions/depot-reprise.ts
tests/e2e/imports-historique.spec.ts
tests/isolation/application-import-historique.test.ts
tests/isolation/refus-creation-agence-inactive.test.ts
tests/unit/imports/gabarit-historique.test.ts
```

## Point 2 — six des huit renvois égarés

Les trois gardiens « cahier des charges ↔ arbitrages », « arbitrage ↔ arbitrage » et « backlog ↔
sources » ne lisent que des documents entre eux ; aucun ne regarde le code. D'où C5 : huit citations
`Dxx` résolvent toutes vers une décision RÉELLE du registre, mais vers la MAUVAISE — collision avec
la numérotation informelle d'Alexis, dont le qualifiant « d'Alexis » s'est perdu en recopiant.

| Fichier:ligne | Avant | Après | Pourquoi |
|---|---|---|---|
| `tableau-de-bord/presentation.ts:235-237` | `D45`, `D48`, `D53` nus | `D45 d'Alexis`, `D48 d'Alexis`, `D53 d'Alexis` | Les trois résolvent vers des décisions du registre sans aucun rapport (arrondi au quart d'heure, férié, périmètre d'audit) ; aucune « décision N d'Alexis » correspondante n'a été retrouvée sous ces numéros — qualifiant posé pour lever l'ambiguïté avec le registre, sans en inventer une |
| `tableau-de-bord/presentation.ts:281` | `DEPUIS D91` nu | `DEPUIS D91 d'Alexis` | Même numéro déjà qualifié ailleurs dans le même fichier (`décision 91 d'Alexis du 13/10/2026, D91`, ligne 222-223), mais dans un AUTRE paragraphe — la qualification ne voyage pas d'un bloc à l'autre (c'est exactement C5) |
| `tableau-de-bord/presentation.ts:320` | `(D91, 13/10/2026)` | `(D91 d'Alexis, 13/10/2026)` | Même raison — troisième paragraphe, troisième perte du qualifiant |
| `docs/audits/9F8-navigateur/rapport.md:17,132(×2),134,135,136,143` | `D130` nu, 7 occurrences | `D130 d'Alexis` | Le titre réel de D130 (registre) est « créer ou modifier un client ou un site » — sans rapport. Le texte du rapport lui-même dit, deux lignes sous le titre, qu'il s'agit « des trois constats terrain d'Alexis » : qualifiant posé partout où le numéro est repris nu |
| `docs/propositions/9F5BA-REPRISE-9F5B/passation.md:32,51,115` | `D123` nu, 3 occurrences | `D123 d'Alexis` | Le titre réel de D123 (registre) est « les référentiels se montrent en cartes » — sans rapport. La VRAIE décision sur la confirmation d'une date passée est D217, qui cite elle-même « D123 d'Alexis » — forme déjà utilisée correctement dans une dizaine d'autres fichiers du dépôt (`lib/interventions/pose.ts`, `components/planning/pose.tsx`, etc.) |

**D144 (`terrain.md`) et D93 (`metier.md`), non traités — et pourquoi.** Ces deux citations vivent
dans `docs/audits/equipe-2026-10-28/`, qui n'existe que dans un AUTRE répertoire de travail
(`/home/aplou/codiplan-equipe`), et y est **non committé** (`git status --porcelain` le confirme :
`?? docs/audits/equipe-2026-10-28/`, et `git log --oneline --all` sur ce chemin est vide). Cette
branche part d'`origin/main` ; ce dossier n'existe nulle part dans CE dépôt. Le mandat du lot le dit
lui-même : « seuls comptent les emplacements DU DÉPÔT (les rapports d'audit eux-mêmes, non
committés, sont hors sujet) ». Rien à corriger ici — ce n'est pas un oubli, c'est hors territoire.

## Point 3 — D80 corrigée vers D204, et pas simplement qualifiée

`D80` était citée 4 fois (point 1, 9EXA-EQUIPE-TECHNICIENS-MAQUETTE) pour « lien_expire » du
technicien, alors que `docs/arbitrages.md` déclare D80 inexistant deux fois (lignes 2611 et 2842).

**Mesuré avant de toucher, comme demandé.** Une « décision 80 d'Alexis » existe RÉELLEMENT dans le
registre (`D196:6881`, `D198:6941`, `D198:7125` ; et une 4ᵉ occurrence dans le code lui-même,
`parametres/equipe/page.tsx:1265`) — mais son sujet est « Dernière connexion reste OMISE », sans
aucun rapport avec « lien_expire ». Ajouter simplement le qualifiant « d'Alexis » aurait donc pointé
vers une décision bien réelle mais FAUSSE — exactement le défaut que ce lot corrige, pas une
réparation. Le seul texte du registre qui documente « lien_expire pour un technicien » est **D204**
(`:7106`), qui cite nommément ce même ticket (« 9EXA-EQUIPE-TECHNICIENS-MAQUETTE, lot 2/3 ») et
reprend le mécanisme « lot 1/3, repris ici pour mémoire » (`:7114`). Les quatre citations ont donc
été corrigées vers `D204`, jamais qualifiées :

| Fichier:ligne | Avant | Après |
|---|---|---|
| `lib/auth/acces-technicien.ts:216` | `D80` | `D204` |
| `tableau-de-bord/presentation.ts:817` | `D80` | `D204` |
| `tableau-de-bord/presentation.ts:841` | `D80` | `D204` |
| `tests/isolation/acces-technicien.test.ts:304` | `D80` | `D204` |

*Note de commit* : la correction de `lib/auth/acces-technicien.ts` et de
`tests/isolation/acces-technicien.test.ts` est entrée dans le commit du point 2 (un `git add` trop
large avant la séparation par `git add -p`) ; celle de `tableau-de-bord/presentation.ts` est dans le
commit du point 3. Les quatre sont corrigées ; seule leur répartition entre deux commits diffère de
l'intention initiale — aucune perte, aucun oubli.

## Point 4 — le gardien

Nouveau module `scripts/lib/citations-decisions-code.ts` (`analyserCitationsCode`) et son gardien
`tests/unit/docs/citations-decisions-code.test.ts`, plutôt qu'une extension d'un des trois gardiens
existants : leurs populations et leurs invariants (règles ↔ décisions, décision ↔ décision, ticket ↔
sources) sont chacun bâtis pour un croisement DOCUMENT ↔ DOCUMENT précis, et y greffer une
population CODE aurait mélangé deux formes de preuve différentes dans un seul test. Le nouveau
module réutilise `lireDecisions` de `cablage-arbitrages.ts` — une seule lecture du registre,
jamais une deuxième façon de le parser.

**Ce qu'il fait.** Lit `app/`, `components/`, `lib/`, `tests/`, `scripts/` (population dérivée de
`git ls-files`, jamais une liste à tenir à jour), repère toute citation nue `Dxx` en PROSE (un
commentaire `//`/`/* */`, une ligne de continuation JSDoc `*`, un commentaire SQL `--`, ou n'importe
quelle ligne d'un fichier `.md`), et exige qu'elle résolve vers un titre réel de `docs/arbitrages.md`
— sauf si elle porte, dans le MÊME paragraphe (un bloc de lignes non vides, borné par une ligne
blanche), la forme qualifiée « `Dxx d'Alexis` » ou « décision N d'Alexis » suivie du même numéro nu.
La portée « par paragraphe », et pas « par fichier », est volontaire : c'est exactement la perte du
qualifiant d'un bloc à l'autre qui a produit C5 (D91 qualifié dans un JSDoc, puis nu, sans
qualifiant à proximité, dans l'objet littéral qui suit).

**Deux faux positifs mesurés et exclus, sans liste d'exemption.** `tests/isolation/machine.test.ts`
("SN-D07", un numéro de série de machine fabriqué pour l'épreuve) et
`tests/unit/excel/fixture-dates.test.ts` ("D533", une référence de cellule d'un classeur Excel) :
deux VALEURS DE DONNÉES qui ressemblent à une citation, mais n'en sont pas. Plutôt que de les nommer
une par une (une liste d'exemptions se démode), le gardien n'examine QUE la prose : une chaîne de
caractères entre guillemets, hors commentaire, n'est jamais lue. Les trois autres gardiens de
`tests/unit/docs/` fabriquent eux-mêmes des citations `D999` dans leurs propres jumeaux
(`amendements-arbitrages.test.ts`, `cablage-arbitrages.test.ts`, `coherence-backlog.test.ts`) — ces
`D999` vivent dans des chaînes de code (arguments de `.replace()`, messages attendus), jamais dans un
commentaire, donc le même filtre les écarte pour la même raison, sans qu'il ait fallu les nommer.

**Montré rougissant avant d'être déclaré bon** (describe « jumeaux »), sur des fichiers FABRIQUÉS
pour l'épreuve, jamais sur le dépôt : une citation nue qui ne résout pas (rouge), la même qualifiée
« d'Alexis » (vert), la forme « décision N d'Alexis » écrite en toutes lettres puis reprise en `DN`
dans le MÊME paragraphe (vert), la même reprise dans un paragraphe SUIVANT — le qualifiant ne voyage
pas (rouge, c'est C5 rejoué), une valeur de donnée entre guillemets (vert, filtrée), la prose entière
d'un fichier `.md` sans aucune syntaxe de commentaire (rouge). Puis, sur le dépôt réel, après les
points 1 à 3 : **zéro écart**, 1777 fichiers lus, ~5000 citations en prose recensées, 212 titres de
décision connus.

**Ce qu'il NE vérifie PAS, et pourquoi ce n'est pas inventé ici.** Une citation qui RÉSOUT vers une
décision réelle mais dont le SUJET diffère (la moitié « collision » de C5, avant correction — par
exemple un futur `D130` nu qui citerait, par erreur, le VRAI D130 du registre en croyant parler des
constats terrain). L'audit équipe lui-même écrit que cette concordance de sujet n'a été vérifiée que
sur un échantillon, jamais de façon exhaustive, et qu'un contrôle mécanique de similarité de texte
serait fragile — un faux négatif (deux sujets proches mais réellement liés) coûterait plus cher qu'il
ne rapporte, et ferait baisser la garde sur les vraies alertes. **Point ouvert, pas un contrôle
manqué.**

## Captures

Aucune. Aucun écran n'est touché par ce lot (texte, registre et gardien seulement) — rien à
régénérer, rien à committer sous `docs/propositions/**/captures/`.

## `CI=1 pnpm verify:full` EN ENTIER, EN UN APPEL

Voir `verify-final.txt` dans ce dossier.
