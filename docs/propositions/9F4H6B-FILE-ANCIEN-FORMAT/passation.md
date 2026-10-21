# 9F4H6B-FILE-ANCIEN-FORMAT — passation

`git log --oneline -7` au moment de cette passation : 7 commits, un par point
(point 5 en deux commits : captures, puis précision D216).

## Point 1 — l'ancien format de prestations n'est plus gelé, une forme inconnue garde un motif

**Avant** : `lib/terrain/file-saisies.ts:174-183` (avant ce lot),
`toutesLesEntrees` castait `requete.result as EntreeFile[]` sans validation.
9F4H6A avait changé `GestePrestations` de `{prestationIds}` (ensemble,
publiée jusqu'à `9fcaf346`) à `{ajouterIds, retirerIds}` (différence) sans
jamais lire l'ancienne forme. Une entrée écrite par une version antérieure à
9F4H6A faisait lever `corpsDe` (`lib/terrain/envoi-file.ts:64-74`) sur
`undefined.length` DANS le `try` d'`envoyerUneEntree` — rattrapé comme un
simple échec réseau, `{ok:false, motif:null}`, puis `marquerRefusee` +
`break` : l'entrée restait en file POUR TOUJOURS et gelait l'envoi des
photos, de la signature et de « Terminer » de la MÊME intervention, sans
motif affiché.

**Après** : `gesteReconnu` (nouvelle fonction pure, `file-saisies.ts`)
valide chaque geste lu par `toutesLesEntrees` — l'ancienne forme
`{prestationIds}` devient `{ajouterIds: prestationIds, retirerIds: []}` (un
AJOUT, jamais l'ensemble) ; une forme qu'aucune des deux ne reconnaît reste
en file avec le motif NEUF `terrain.file.format_inconnu`
(`lib/i18n/fr.ts`), affiché par le mécanisme déjà existant de
`BoutonEnvoyer` (`components/terrain/bouton-envoyer.tsx:121-129`, inchangé).
`envoyerFile` (`lib/terrain/envoi-file.ts`) ne tente plus jamais d'envoyer
une telle entrée (`continue`, jamais `break`) : les saisies suivantes de la
même intervention ne gèlent plus avec elle. `corpsDe` est aussi durci
(`?? []` sur `ajouterIds`/`retirerIds`) en filet, jamais la garde.

Unitaire : `tests/unit/terrain/file-saisies.test.ts` (nouveau describe
`gesteReconnu à la lecture` — ancienne forme → ajouts seuls ; forme
courante inchangée ; forme de prestations ni ancienne ni courante → motif ;
type de geste entièrement inconnu → motif) ; nouveau
`tests/unit/terrain/envoi-file.test.ts` (`envoyerFile` avec une entrée à
l'ancien format → envoyée, retirée, « terminer » derrière elle passe ; une
forme inconnue → jamais tentée, « terminer » derrière elle passe quand
même).

## Point 2 — la copie est validée en entier, jamais un plantage partiel

**Avant** : `lib/terrain/copie-validee.ts` (avant ce lot) ne validait que
`copie.catalogue` et `fiche.prestationsRealiseesIds`, chacun par
`Array.isArray` sur le TABLEAU ENTIER. `components/terrain/
consultation-hors-reseau.tsx` plantait encore sur : un élément `null` du
catalogue (`catalogue.map((p) => ({id: p.id, ...}))`, `p.id` sur `null`) ;
`copie.journee`/`copie.fiches` absents (`copie.journee.fuseau`,
`copie.fiches[id]`) ; `fiche.photos.length` et
`fiche.rapport.commentaireTechnicien` sur une fiche malformée.

**Après** : `copieUtilisable(copie)` (nouvelle fonction) traite une copie
sans `journee` ni `fiches` — CŒUR de la forme, présent depuis la toute
première version (9F4H1), jamais ajouté après coup comme `catalogue` —
EXACTEMENT comme son absence totale (même message « aucune copie »,
`consultation-hors-reseau.tsx`). `catalogueDeLaCopie` et
`prestationsRealiseesDeLaFiche` filtrent désormais chaque ÉLÉMENT invalide
du tableau plutôt que de rejeter le tableau entier sur un seul élément
abîmé. Deux nouvelles fonctions, `photosDeLaFiche` et `rapportDeLaFiche`,
rendent des valeurs sûres (`[]`, `{commentaireTechnicien: null,
suiteADonner: null}`) pour une forme invalide. `consultation-hors-reseau.
tsx` utilise ces quatre accesseurs partout où il lisait les champs bruts.

Unitaire : `tests/unit/terrain/copie-validee.test.ts` — `copieUtilisable`
(complète, `journee` absente, `fiches` absentes, `journee` d'un mauvais
type, un tableau attendu absent dans `journee`) ; `catalogueDeLaCopie`
(élément `null`, `id` sans `libelle`, `libelle` sans `id`) ; `photosDeLaFiche`
et `rapportDeLaFiche` (absent, mauvais type, élément invalide).

## Point 3 — cocher puis décocher hors réseau ne rejoue plus la case

**Avant** : `components/terrain/rapport-automatique.tsx` (`envoyerPrestations`,
avant ce lot) rendait `{etat: "accepte"}` dès que `memeEnsemble` constatait
un retour à la dernière base connue, SANS jamais retirer une entrée déjà en
file pour ce même retour en arrière. Cocher C puis le décocher, hors
réseau, laissait `{ajouterIds:[C], retirerIds:[]}` en file : au rejeu, C
était ajoutée alors que le technicien l'avait décochée avant de repartir.

**Après** : la même branche appelle désormais `retirerSaisieCoalescable`
(type `"prestations"`) avant de rendre `accepte` — sans conséquence si
rien n'y est.

Unitaire : `tests/unit/terrain/rapport-automatique.test.tsx` (nouveau
describe — cocher puis décocher retire l'entrée déjà en file). e2e : voir
point 5.

## Point 4 — un `ajouter_id` d'une autre société est refusé proprement

**Avant** : `lib/interventions/depot-rapport-terrain.ts`
(`definirPrestationsRealiseesDepuisFile`, avant ce lot) insérait `ajouterIds`
sans vérifier qu'ils appartiennent à la société active. Un identifiant
d'une AUTRE société heurtait la FK composite `(societe_id, prestation_id)`
→ `prestation(societe_id, id)` et levait une erreur Prisma JAMAIS rattrapée
jusqu'à la route — page d'erreur brute au lieu d'un motif, la saisie
restant en file, gelée, sans qu'aucun message n'explique pourquoi. Ni la
route ni `corpsDe` n'étaient exercées de bout en bout par une épreuve avant
ce lot (seule la fonction de dépôt l'était, sous `tests/isolation/`).

**Après** : les `ajouterIds` sont vérifiés contre le catalogue de la
société active (`tx.prestation.findMany`) AVANT toute écriture ; un lot qui
en contient un seul d'une autre société est refusé EN BLOC (même refus
nommé que « intervention non visible »), rien n'est écrit.

Isolation (base réelle) : `tests/isolation/rapport-terrain.test.ts` (deux
nouveaux cas — un `ajouter_id` d'une autre société seul, refusé proprement,
rien écrit ; un lot mêlé valide+étranger, refusé EN BLOC, la valide n'est
pas écrite seule). e2e : voir point 5, point 4.

## Point 5 — épreuves de bout en bout et captures

`tests/e2e/offline/9f4h6b-file-ancien-format.spec.ts` (nouveau, sa propre
scène, préfixée `9F4H6B-`) — 4 scénarios :
- point 3 — cocher puis décocher hors réseau ne laisse plus l'ajout en
  file (mesuré directement dans IndexedDB, aucun bouton « Envoyer » tant
  que la file est vide) ;
- point 4 — un collègue ajoute une prestation EN LIGNE pendant la coupure,
  la coquille rejoue sa propre différence au retour du réseau : les deux
  prestations restent présentes (2 lignes en base) ; un rejeu forcé de la
  même requête (`page.request.post` avec `depuis_file=1`) ne double rien ;
- capture — le motif `terrain.file.format_inconnu`, en clair, sur une
  entrée de forme inconnue posée directement en IndexedDB ;
- capture — la coquille `/terrain-hors-reseau` rendue normalement malgré
  un élément `null` du catalogue et des champs `photos`/`rapport` d'une
  forme invalide sur une fiche (`journee`/`fiches` intacts — un cas
  DISTINCT de la copie entièrement ancienne de 9F4H6A).

4 fichiers dans
`docs/propositions/9F4H6B-FILE-ANCIEN-FORMAT/captures/` (375 et 1280 px,
viewport) :
```
motif-forme-inconnue-375.png / -1280.png
fiche-copie-partiellement-invalide-375.png / -1280.png
```

`docs/arbitrages.md`, D216 — nouvelle précision (21/10/2026) nommant les
quatre défauts résiduels ci-dessus.

## Vérification

Rejoués SÉPARÉMENT, tous verts avant la tentative `verify:full` :
- `tests/e2e/offline/*` sous `CI=1` (1 worker, comme en CI) : **21/21
  passés**, `9f4h6b-file-ancien-format.spec.ts` compris (4/4) ;
- `tests/unit/terrain/*` : **155/155 passés** ;
- `pnpm test:isolation` : **1644/1644 passés** (dont les deux nouveaux cas
  du point 4) ;
- `pnpm test` (suite complète) : **5000/5000 passés**.

`CI=1 pnpm verify:full` rejoué en UN appel, au premier plan, sortie
entière dans `verify-final.txt` : `format:check`, `typecheck`, `lint`,
`test` (5000 passés), `test:isolation` (1644 passés), `build` (compilé),
`feries:horizon`, `audit:partitions` tous VERTS. `test:e2e` (la suite
Playwright COMPLÈTE, 1486 tests, pas seulement `tests/e2e/offline/`) a
démarré sa propre migration/seed puis progressé sans aucun échec visible
dans la sortie capturée, mais n'a PAS terminé avant la limite d'une heure
du même appel — même limite déjà posée en passation par plusieurs lots
précédents (9F4H6-FINITIONS-HORS-RESEAU, 9F4H6A-COQUILLE-ANCIENNE-COPIE,
9F4H6AA-REPRISE-9F4H6A), pas une régression de ce lot. `tests/e2e/offline/*`
et `tests/unit/terrain/*` mesurés séparément ci-dessus couvrent le
territoire réel de ce lot.

## Publication

`git fetch origin` puis `git rebase origin/main` : branche déjà à jour
(aucun commit nouveau sur `origin/main` depuis le départ de cette session),
rebase sans effet. Branche dédiée `9F4H6B-FILE-ANCIEN-FORMAT` (main était
extrait dans un autre worktree au démarrage de cette session). Jamais de
push.
