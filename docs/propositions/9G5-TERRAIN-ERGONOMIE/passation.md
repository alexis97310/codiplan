# 9G5-TERRAIN-ERGONOMIE — passation

Branche dédiée `9G5-TERRAIN-ERGONOMIE`, partant d'`origin/main` (`f24b8e66a`) :
`main` est extrait ailleurs (`/home/aplou/codiplan`), comme l'exige le
protocole du ticket.

## Les 8 points

### Point 1 — « Démarrer l'intervention » visible sans défiler

**Avant** : `app/(mobile)/terrain/[id]/page.tsx` plaçait la section Compteur
(et son bouton) APRÈS Référence, Panne, Machine et Contact — à 375 px, le
bouton était mesuré à y=740, sous la ligne de flottaison
(`docs/audits/9F6/ecrans/terrain-i-i440/mesures.json`).

**Après** : la section Compteur est déplacée juste après les bandeaux
(réseau, compteur ailleurs, motif), avant Référence — le geste principal
est désormais le premier bloc de contenu de la fiche.

**Preuve** : `tests/unit/terrain/geste-principal-en-tete.test.ts` — gardien
statique (même idiome que `sans-montant.test.ts`) : la section Compteur
précède toujours la section Référence dans le JSX, quelle que soit la fiche.
Capture `fiche-terrain-avant-375.png` / `fiche-terrain-apres-375.png`.

### Point 2 — « Journée » reste actif sur une fiche d'intervention

**Avant** : `components/terrain/barre-basse.tsx` comparait le chemin par
égalité stricte (`chemin === entree.chemin`) ; sur `/terrain/<id>`, ni
« Journée » ni « Profil » ne s'allumait.

**Après** : réutilise `entreeActive` (`lib/navigation/entrees.ts`, déjà la
doctrine de la barre bureau) — « Journée » porte une `section: "/terrain"`,
« Profil » reste à `/terrain/profil`, et le préfixe le plus long gagne.

**Preuve** : `tests/unit/terrain/barre-basse.test.tsx` (3 cas : `/terrain`,
`/terrain/<id>`, `/terrain/profil`).

### Point 3 — les cartes de Ma journée redeviennent neutres

**Avant** : `components/terrain/liste-journee.tsx:247` habillait la carte
ENTIÈRE avec `CLASSES_LIEN` (texte bleu souligné), un rendu que ni la
maquette ni la carte jumelle de la coquille hors réseau
(`consultation-hors-reseau.tsx`) ne portent.

**Après** : classe retirée ; le focus clavier reste visible par la règle
générale `:focus-visible` (`app/globals.css`), indépendante de cette classe.

**Preuve** : `tests/unit/theme/lien-visible.test.ts` — liste CLOSE des
porteurs de `CLASSES_LIEN` : `liste-journee.tsx` en sort, avec sa raison
écrite en place (comportement que ce point change explicitement, cf.
budget de temps du ticket). Capture `journee-avant-375.png` /
`journee-apres-375.png`.

### Point 4 — déjà réparé, aucune action

Les deux « champs sans étiquette » de `components/interventions/
photos-terrain.tsx` (champ fichier, légende) sont déjà corrigés depuis le
commit `9d8103425` (9F5B-CORRECTIFS-AUDIT-FONCTIONNEL, point 4), postérieur
au commit d'audit `9bcb542b` cité par ce ticket. Vérifié en lisant le
fichier avant de toucher : les deux `<label>` existent déjà, `htmlFor`
posé, `sr-only`. Rien à faire — exactement ce que « REMESURE-le avant de
toucher » demande de constater.

### Point 5 — signature à la largeur disponible, cases 44 px

**Avant** : `rapport-automatique.tsx` posait `width={320}` sur le canevas,
au-delà des 311 px utiles à 375 px ; `position()` ne mettait jamais le
point du pointeur à l'échelle d'une résolution différente de la taille
affichée. Les cases « prestations réalisées » étaient de simples
`<input type="checkbox">` nus.

**Après** : le canevas est fluide (`w-full h-[140px]`), sa résolution de
dessin reste `320×140` ; `positionCanevas` (exportée) met le point du
pointeur à l'échelle de cette résolution — testée à l'unité avec des
chiffres simples. Les cases passent par `CaseACocher` (même habillage CG8
que partout ailleurs) : 44 px sous 768 px, inchangé au-dessus.

**Preuve** : `tests/unit/terrain/rapport-automatique.test.tsx` (2 cas de
`positionCanevas`). Capture `fiche-signature-avant-375.png` (canevas
coupé par endroits, non testable ici) / `fiche-signature-apres-375.png`
(canevas à la largeur de la carte).

### Point 6 — un lien de retour même sans aucune copie

**Avant** : `consultation-hors-reseau.tsx:64` rendait un texte seul, pour
toujours, quand aucune copie locale n'existait (appareil jamais
synchronisé) — `LienRetourSelonReseau` n'était posé que dans la branche AVEC
copie.

**Après** : le même lien rejoint cette branche ; il reste masqué hors ligne
(même logique `navigator.onLine`/`online`/`offline`), et apparaît dès que
le réseau revient.

**Preuve** : `tests/unit/terrain/fiche-hors-reseau-travail.test.tsx` —
nouveau cas « aucune copie du tout ». Capture
`coquille-aucune-copie-avant-375.png` / `-apres-375.png`.

### Point 7 — quatre textes justes

- `terrain.signature.vide` parlait d'un bouton « Enregistrer » qui n'existe
  plus depuis l'enregistrement automatique (D212, 9F4-TERRAIN-ENREGISTREMENT-
  AUTO) ; l'indication sous le canevas vide utilise désormais
  `terrain.signature.a_tracer` (clé neuve). L'ancienne clé reste le motif de
  refus SERVEUR (`app/api/terrain/[id]/signature/route.ts`, hors territoire,
  lecture seule) — inchangée à raison.
- `terrain.compteur.ferme` (« Temps mesuré, hors compteur en cours. »)
  devient obscur quand RIEN ne tourne nulle part pour la personne (ni ici,
  ni ailleurs) : `terrain.compteur.ferme_rien_en_cours` (clé neuve,
  « Temps mesuré. ») la remplace dans ce seul cas ; l'ancienne reste quand
  `ailleurs !== null` justifie vraiment l'exclusion.
- La date de Ma journée (`DD/MM/YYYY`) ne portait pas le jour de la semaine
  que la maquette écrit (« Lundi 28 septembre ») ;
  `libelleJourLongEnTeteDePhrase` (`components/terrain/presentation.ts`),
  même forme que `libelleJourLong` (déjà utilisée pour « Demain »), mais
  capitalisée en tête de phrase.
- Le bandeau « compteur en cours » (Ma journée, fiche d'une autre
  intervention) ne comptait que le segment OUVERT depuis `depuis` — la MÊME
  intervention affichait une durée plus courte sur ce bandeau que sur sa
  propre fiche (qui ajoute les segments déjà fermés). `minutesFermees`
  (nouveau prop optionnel de `BandeauCompteurEnCours`, défaut 0) l'aligne ;
  les deux pages appelantes lisent `mesureDeLIntervention` (déjà exportée
  par `lib/interventions/depot-compteur.ts`, aucune modification de ce
  fichier — hors territoire, seulement importé).

**Preuve** : `tests/unit/terrain/presentation.test.ts` (nouveau describe),
`tests/unit/terrain/bandeau-compteur-minutes-fermees.test.tsx` (nouveau
fichier), `tests/unit/terrain/rapport-automatique.test.tsx` (nouveau cas).
Capture `journee-avant-375.png`/`-apres-375.png` (date),
`fiche-terrain-avant-375.png`/`-apres-375.png` (texte du compteur).

### Point 8 — une réponse non JSON du compteur n'est jamais une coupure

**Avant** : `compteur-terrain.tsx` appelait `reponseServeur.json()` dans le
MÊME `try` que `fetch()` — une page d'erreur (500) fait lever `.json()`,
et l'unique `catch` traitait ça EXACTEMENT comme une coupure réseau : le
geste partait en file, sans message.

**Après** : `.json()` est isolé dans son propre `try/catch` ; son échec
affiche un refus (`terrain.compteur.reponse_invalide`, clé neuve) et ne met
jamais rien en file. Le `catch` externe (échec de `fetch()` lui-même) garde
son comportement d'avant.

**Preuve** : `tests/unit/terrain/compteur-terrain.test.tsx` — nouveau cas
mockant une réponse dont `.json()` rejette.

## Captures

```
$ ls -la docs/propositions/9G5-TERRAIN-ERGONOMIE/captures/
coquille-aucune-copie-apres-1280.png   12086
coquille-aucune-copie-apres-375.png    10232
coquille-aucune-copie-avant-1280.png    9938
coquille-aucune-copie-avant-375.png     8100
fiche-signature-apres-1280.png         48390
fiche-signature-apres-375.png          34582
fiche-signature-avant-1280.png         42932
fiche-signature-avant-375.png          35117
fiche-terrain-apres-1280.png           60064
fiche-terrain-apres-375.png            47611
fiche-terrain-avant-1280.png           60907
fiche-terrain-avant-375.png            47515
journee-apres-1280.png                 59064
journee-apres-375.png                  51728
journee-avant-1280.png                 58462
journee-avant-375.png                  51151
```

AVANT = `origin/main` (`f24b8e66a`), rejoué dans un worktree jetable
(`/tmp/9g5-avant`, supprimé après usage — voir « points ouverts », le
détour par là a coûté la moitié du budget de ce lot). APRÈS = ce lot.
Spec unique : `tests/e2e/zz-captures-9g5-terrain-ergonomie.spec.ts`.

Trois écrans, pas quatre : les points 4 (déjà réparé) et 8 (aucun rendu
visuel au repos — le refus n'apparaît qu'après une réponse non JSON,
scénario qu'une capture de bout en bout n'a pas de raison de provoquer)
n'ont rien à capturer.

## Fin de lot

- `pnpm format`, `pnpm typecheck`, `pnpm lint` verts après CHAQUE commit.
- `pnpm vitest run` (suite complète unitaire + isolation) : **6819 tests
  passés**, relancé plusieurs fois au fil des 8 points, toujours vert.
- `CI=1 pnpm verify:full`, lancé EN ENTIER en un seul appel comme demandé :
  a atteint un timeout de 55 min après avoir lancé les **1668 épreuves e2e**
  (`test:e2e` en fait partie) sans atteindre le résumé final — le budget de
  temps du LOT (150 min) ne permettait pas d'attendre la suite e2e complète
  jusqu'au bout. Repli immédiat : `CI=1 pnpm verify` (format:check,
  typecheck, lint, test — 474 fichiers —, test:isolation — 192 fichiers —,
  build) rejoué SEUL juste après, **EXIT=0, sans erreur ni avertissement**.
  Les deux sorties sont dans `verify-final.txt`, à la suite l'une de
  l'autre, avec un séparateur qui nomme ce qui s'est passé.
- `git fetch origin` puis `git rebase origin/main` : aucun commit nouveau
  sur `origin/main` depuis le départ de la branche (`f24b8e66a` inchangé),
  rebase sans effet.
- `git status --porcelain` : arbre propre après restauration des captures
  d'AUTRES lots que `pnpm verify:full`/`pnpm verify` a régénérées par effet
  de bord (`git checkout --` sur les PNG modifiés, suppression des PNG
  neufs non sollicités — aucun n'appartient à ce ticket).
- 15 dernières lignes de `git log --oneline` et `git rev-parse --short
  HEAD` : voir ci-dessous, à la toute fin de ce document (après le rebase,
  pour qu'elles reflètent l'état RENDU, pas un état intermédiaire).

## Points ouverts

1. **`pnpm verify:full` n'a jamais atteint son résumé final** dans ce lot —
   le timeout de 55 min a coupé la suite e2e en cours (1668 tests, dont
   quelques `×`/`°` visibles dans le flux, sans détail de cause puisque
   Playwright n'a pas eu l'occasion d'imprimer son rapport). Rien dans ces
   marques ne distingue une régression de ce lot d'une flakiness déjà
   connue de la suite — le fichier `verify-final.txt` porte le flux brut
   tel quel. **Un prochain budget doit rejouer `CI=1 pnpm verify:full` en
   entier**, avec une marge de temps plus large (le run observé a dépassé
   55 min sans finir ; prévoir 75–90 min au minimum pour la seule suite
   e2e sur cette machine).
2. **Le détour par un worktree AVANT a failli faire échouer le lot** :
   `/tmp` est un tmpfs machine-wide de ~5,9 Go, et deux tentatives de
   capture AVANT (un worktree complet, 461 Mo, dont 441 Mo de
   `docs/propositions/` — jamais nécessaires pour `next build`/`next
   start`) ont d'abord épuisé l'espace partagé par TOUTES les sessions de
   la machine (y compris le Bash d'une autre session, vérifié), bloquant
   tout `Bash` (même `echo`) pendant plusieurs minutes. Récupéré en
   supprimant le premier worktree (`git worktree remove --force`), puis en
   excluant `docs/` du second avant de lancer `next build`. **Si un futur
   lot répète cette recette** (`captures-avant-apres-e2e`, mémoire
   partagée) : `rm -rf docs/` dans le worktree jetable DÈS sa création,
   avant tout `pnpm`, pour ne jamais retomber dans cet écueil — le mettre à
   jour dans la mémoire serait utile mais sort du territoire de ce ticket
   (pas un fichier du dépôt).
3. **4 directories `/tmp/codiplan-staging-*` (≈4,16 Go au total)**,
   appartenant visiblement à d'AUTRES sessions actives sur la même machine
   (jamais créées par celle-ci), occupent la majeure partie du tmpfs
   partagé. Non touchées — ni le territoire de ce ticket, ni à moi de
   décider si elles sont encore utiles à qui les a posées. Signalé pour
   information : si l'espace `/tmp` redevient un problème pour un lot
   futur, c'est le premier endroit à regarder.

## Dernières lignes du journal, et le commit rendu

```
05f34a23a 9G5-TERRAIN-ERGONOMIE — passation : les 8 points, verify-final.txt, points ouverts
b6447ff42 9G5-TERRAIN-ERGONOMIE — captures AVANT/APRÈS des écrans touchés (375 et 1280 px)
877c15d3f 9G5-TERRAIN-ERGONOMIE — point 7 : quatre textes justes (signature, compteur, date de Ma journée, bandeau)
0e9e18fa7 9G5-TERRAIN-ERGONOMIE — point 6 : un lien de retour quand le réseau revient, même sans aucune copie
a406adc98 9G5-TERRAIN-ERGONOMIE — point 5 : signature à la largeur disponible, tracé à l'échelle ; prestations en cases de 44 px
408450e08 9G5-TERRAIN-ERGONOMIE — point 3 : les cartes de Ma journée redeviennent neutres, jamais un lien bleu souligné
0af244bf7 9G5-TERRAIN-ERGONOMIE — point 1 : « Démarrer l'intervention » visible sans défiler
6b67f389e 9G5-TERRAIN-ERGONOMIE — point 8 : une réponse non JSON du compteur n'est jamais traitée comme une coupure
cec9d94fa 9G5-TERRAIN-ERGONOMIE — point 2 : « Journée » reste actif sur une fiche d'intervention
f24b8e66a 9G4-PLANNING-JOUR-ET-MOIS — passation : les 8 points, verify-final.txt, points ouverts
e6524701b 9G4-PLANNING-JOUR-ET-MOIS — captures AVANT/APRÈS des écrans touchés (375 et 1280 px)
4a29d064f 9G4-PLANNING-JOUR-ET-MOIS — glisser.ts : mesurer la position verticale APRÈS l'élargissement, pas avant
c0e32134e 9G4-PLANNING-JOUR-ET-MOIS — point 8 : aucun onglet téléphone ne s'allume à tort en Mois ou « 2 semaines »
6ea07eb85 9G4-PLANNING-JOUR-ET-MOIS — point 7 : l'indice de défilement dit « les deux semaines », pas « la semaine », en vue 2 semaines
d523cd851 9G4-PLANNING-JOUR-ET-MOIS — point 6 : « Transmettre toutes les planifiées prêtes (N) » passe à la ligne à 375 px

HEAD : 05f34a23a (sur la branche 9G5-TERRAIN-ERGONOMIE,
partie d'origin/main — main étant extrait ailleurs, aucun push)
```
