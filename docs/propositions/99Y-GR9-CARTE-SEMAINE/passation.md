# 99Y-GR9-CARTE-SEMAINE — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

Sur `/planning`, vue Semaine, la première ligne des cartes de la grille (heure + client,
composée par `enTeteDuBloc`) passe de `truncate` (une seule ligne, coupée avec `…`) à
`line-clamp-2 break-words` (deux lignes au plus, coupée mot par mot seulement si nécessaire).
`title` reste posé sur l'élément, comme avant. Les autres lignes du bloc (nature, puis
`DetailsDeLaCarte` — site, durée, matériel) restent tronquées sur une seule ligne, avec leur
`title`.

Décision d'Alexis du 26/09/2026 (audit GR9, constat G1) : « OUI, deux lignes », même si la
case admet de grandir — un écart nommé à la règle « jamais une case qui grandit » écrite en
commentaire au-dessus de `CasePosable`. Rien à faire pour l'admettre techniquement : la case
est un `<td>` HTML (`components/planning/pose.tsx`, `CasePosable`) et `height: "78px"` s'y
comporte déjà comme un plancher, jamais une coupe — un `<td>` grandit avec son contenu, il ne
le découpe pas. Aucune valeur CSS n'a donc été changée sur la case elle-même.

Pour l'exploitation : à 1280 px (colonnes jour ~80 px, mesuré par l'audit GR), une carte
montre désormais l'heure ET au moins le début du nom du client sur deux lignes, là où elle ne
montrait avant qu'une heure tronquée sans jamais atteindre le client. Deux cartes du même
technicien pour deux clients différents restent distinguables sans survol — c'était
exactement le manque du constat G1.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

Captures dans `docs/propositions/99Y-GR9-CARTE-SEMAINE/captures/`, prises par un spec e2e
temporaire non conservé (recette de la mémoire `captures-avant-apres-e2e`) : AVANT sur le
code du commit `ce66bc2` (avant ce lot, `page.tsx` remis en place puis restauré à HEAD par
`git checkout`), APRÈS sur le commit de ce lot — à 1280 px et 1440 px, sur une scène propre
(client au nom long, préfixe `CAP99Y`, technicien de Ducos, jeudi de la semaine courante à
09:00).

- **AVANT (1280 px et 1440 px)** : la carte du jeudi porte une seule ligne « 09:00 … » —
  le client (« CAP99Y Établissements Wetr du Grand Sud Calédonien ») n'apparaît nulle part
  à l'écran, seul `title` le porte au survol.
- **APRÈS (1280 px et 1440 px)** : la même carte porte deux lignes — « 09:00 » puis
  « CAP99… » (1280 px) / « CAP99Y-… » (1440 px, plus de caractères tiennent) — le début du
  nom du client est désormais visible sans survol.
- L'épreuve automatisée (`tests/e2e/ergo-carte-semaine.spec.ts`) mesure, sur sa propre carte
  (client au nom encore plus long, 80 caractères sans espace) : `scrollWidth <= clientWidth`
  (aucun débordement horizontal), hauteur `<= 2 × line-height` (le clamp tient), et le
  `textContent` complet du client est présent dans le DOM (le `line-clamp` masque
  visuellement au-delà de deux lignes, il ne retire rien du texte rendu).

## Ce que j'ai tranché et pourquoi

1. **`line-clamp-2` seul, sans `block`.** Une première version portait
   `"line-clamp-2 block font-bold break-words"` : l'épreuve e2e a mesuré une hauteur de
   257 px au lieu des ~30 px attendus — `block` (`display: block`) écrasait le
   `display: -webkit-box` que pose `line-clamp-2`, selon l'ordre d'enregistrement des
   utilitaires Tailwind, et le clamp ne s'appliquait plus du tout (texte étalé sur
   toute sa hauteur naturelle). `line-clamp-2` pose lui-même le `display` nécessaire ;
   retirer `block` a suffi.
2. **Aucune modification de `style={{ height: "78px" }}`** sur `CasePosable` : la case est un
   `<td>`, et `height` s'y comporte comme un minimum en disposition de table normale — pas de
   `table-layout: fixed` ni d'`overflow: hidden` qui l'empêcherait de grandir. La décision
   « même si la case admet de grandir » se vérifie donc sans toucher cette valeur.
3. **Scène e2e propre (`ERGO9S`), jamais `SCENE.*`** : même raison que 99XA-STAB-GLISSER
   (`tests/e2e/setup/scene-glisser.ts`) — un `beforeAll` qui écrirait sur une fixture
   partagée romprait sous `fullyParallel` ou une reprise. Client, site et intervention posés
   par le fichier lui-même, supprimés en `afterAll`, technicien lu (jamais écrit) depuis
   `reperesDeLaScene()`. Jour choisi : jeudi (rang 3), hors des deux jours (mardi, mercredi)
   que `scene.ts` se réserve.
4. **`test.describe.configure({ mode: "serial" })`** posé sur l'épreuve neuve : son
   `beforeAll` écrit en base, et le gardien `tests/unit/e2e-mise-en-scene.test.ts` l'exige
   pour tout fichier dans ce cas (mesuré : `pnpm test` a d'abord rougi dessus, faute de
   l'avoir posé).

## Ce que je n'ai PAS fait

- **`ListeSemaine`** (vue téléphone, `< lg`) n'est pas touchée — le ticket l'exclut
  explicitement (elle a déjà la largeur de l'écran, pas une colonne de ~80 px).
- **Aucune logique métier, aucune migration, aucun prix.**
- **Les autres lignes du bloc** (nature, `DetailsDeLaCarte`) gardent `truncate` + `title` —
  seule la ligne heure + client change, comme demandé.

## Les pièges pour la session suivante

- **`line-clamp-N` ne se combine pas avec `block`** (ni avec un autre utilitaire qui fixe
  `display`) sous cette version de Tailwind — l'ordre d'enregistrement des classes dans la
  feuille générée, pas l'ordre dans `className`, décide laquelle gagne. Mesurer la hauteur
  réelle avant de conclure qu'un `line-clamp` fonctionne.
- **`height` sur un `<td>` est un plancher, pas un plafond** — utile à savoir avant de
  supposer qu'il faut le changer en `minHeight` pour qu'une case grandisse.
- L'instabilité connue `glisser-deposer.spec.ts:219/139` n'a PAS été observée pendant ce
  lot — `CI=1 pnpm verify:full` est passé vert du premier coup après le correctif du
  `line-clamp` (312 passées, 3 sautées, 0 échec).

## Ce qui reste à faire

Rien d'identifié dans le territoire de ce ticket. `ListeSemaine` (téléphone) reste hors
scope, comme prescrit.
