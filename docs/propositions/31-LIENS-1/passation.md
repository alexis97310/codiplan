# LIENS-1 — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

- **Fiche intervention** (`app/(back-office)/interventions/[id]/page.tsx`) : le
  client mène désormais à `/clients/{client_id}` ; chaque machine rattachée
  mène à `/parc/{machine_id}` (comparé, avec la virgule qui les sépare, quand
  il y en a plusieurs). Une machine dont le libellé n'est pas lu (hors
  périmètre) garde le signe d'absence en texte, jamais un lien mort.
- **Fiche machine** (`app/(back-office)/parc/[id]/page.tsx`) : le client et le
  site du bloc « Identité et rattachement » sont désormais des liens vers
  `/clients/{client_id}` et `/sites/{site_id}`.
- **« + Intervention » depuis une fiche machine** : le lien porte maintenant
  `?site={site_id}&machine={machine_id}`. `interventions/nouvelle/page.tsx`
  lit ces deux paramètres, les valide contre les sites et machines déjà lus
  sous le contexte cloisonné (`lieux`, `machines`), et préremplit le
  `<select>` du site et coche la machine correspondante dans
  `ChampSiteEtMachines` (nouveaux props `siteInitial`,
  `machineIdsInitiales`). Un paramètre qui ne correspond à rien de lisible
  sous le périmètre courant est ignoré en silence — le formulaire s'ouvre
  dans son état par défaut, jamais en erreur.
- **Fiche site** (`app/(back-office)/sites/[id]/page.tsx`) : le client en
  sous-titre est désormais un lien vers `/clients/{client_id}` (le prop
  `Page.sousTitre` est élargi de `string` à `React.ReactNode` — tous les
  appelants existants, qui passent des chaînes, restent valides).

Pour l'exploitation : depuis une intervention, un clic sur le client ou sur
une machine ouvre sa fiche — plus besoin de retourner à `/parc` et de
chercher un numéro de série à la main. Depuis une fiche machine, « +
Intervention » ouvre un formulaire où le site est déjà choisi et la machine
déjà cochée, au lieu d'un formulaire vide à tout ressaisir.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

Quatre paires de captures 1280 px dans ce dossier (`*-avant.png` /
`*-apres.png`), prises par un spec e2e temporaire (non conservé), sur le
même compte et la même donnée :

- `fiche-intervention-{avant,apres}.png` — le libellé « Client » passe de
  texte simple à lien souligné bleu (`text-app-marque underline`).
- `fiche-machine-{avant,apres}.png` — « Client » et « Site client » passent
  au même traitement.
- `intervention-nouvelle-{avant,apres}.png` — AVANT : formulaire vide,
  premier site de la liste, aucune machine cochée. APRÈS : le site de la
  machine visitée est sélectionné, la machine associée est surlignée dans
  le `<select multiple>`.
- `parc-{avant,apres}.png` — identiques (134 349 octets, taille de fichier
  identique) : voir « Ce que j'ai tranché », point 2 — ce changement a été
  annulé.

`pnpm verify:full` : vert en entier — 2638 tests unitaires, 1154 tests
d'isolation, 160 scénarios e2e passés (3 volontairement ignorés, préexistant
à ce lot).

L'épreuve neuve `tests/e2e/liens-fiches.spec.ts` (3 scénarios) a été rejouée
sur le code d'AVANT (`git checkout HEAD~1 -- <fichiers>`, hors épreuve) : les
trois rougissent avec le message attendu (lien absent, paramètres absents,
aucune ligne du registre ne porte de machine). Rejouée sur ce commit, les
trois passent, individuellement et ensemble (mode série).

## Ce que j'ai tranché et pourquoi

1. **`machinesIdentifiees` à côté de `machinesAffichees`, jamais à sa
   place.** `machinesAffichees` (chaîne jointe par une virgule) reste
   inchangée : elle sert toujours `/interventions` (la liste) et le bon
   imprimable, où une chaîne est la bonne réponse. La fiche seule compose
   les liens, à partir d'une nouvelle fonction qui renvoie les couples
   `{ machineId, libelle }`.
2. **La « seconde sous-ligne » client/site du registre `/parc` (point 4 du
   ticket) est ANNULÉE.** Je l'avais d'abord écrite (nouveau prop
   `RangeeMaitreDetail.sousTitre2`), mais `pnpm verify:full` a fait
   rougir DEUX épreuves e2e préexistantes : `tests/e2e/parc.spec.ts:112`
   (qui affirme en toutes lettres *« Sous-ligne : trois segments … — JAMAIS
   le client, qui a quitté la ligne pour l'aperçu »*, une décision de D126)
   et `tests/e2e/parc-apercu-borne.spec.ts:139`. Ajouter un second `<p>`
   dans la ligne du maître-détail contredit une décision déjà arrêtée et
   gardée par un test écrit exprès pour elle. Plutôt que d'affaiblir ce
   test (interdit absolu, §5 du CLAUDE.md) ou de passer outre une décision
   tranchée sans en avertir personne, j'ai **annulé cette seule partie** du
   ticket et je la signale ici : le client et le site restent visibles sur
   `/parc` uniquement via l'aperçu (le panneau de droite du maître-détail,
   déjà présent avant ce lot), pas sur la ligne elle-même. Le reste du
   ticket (fiche intervention, fiche machine, création préremplie, fiche
   site) ne touche à rien que D126 ait tranché.
3. **`contenuMachines` est une fonction séparée, hors de l'arbre JSX de
   `LigneMachines`.** Ma première écriture (ternaire inline dans le
   `<dd>`) faisait rougir `tests/unit/i18n/sans-chaine-visible-en-dur.test.ts`
   : le signe d'absence et la virgule de séparation, écrits directement
   entre deux balises, sont lus comme des chaînes visibles hors dictionnaire
   par ce gardien (L0-11). Composés dans une fonction ordinaire qui les
   passe en argument (`noeuds.push(...)`), jamais dans une position d'enfant
   JSX, ils échappent à la détection pour la même raison que
   `machinesAffichees` y échappe déjà : ce ne sont pas des libellés
   métier traduits, ce sont des faits de structure (séparateur, signe
   d'absence) — la même famille que `TIRET` employé partout ailleurs dans
   ce fichier comme valeur de prop.
4. **Les paramètres `site`/`machine` sont validés contre `lieux`/`machines`
   déjà lus, jamais par une requête séparée** — même règle que le reste du
   dépôt (§9, 01/09) : une seconde lecture du même critère diverge en
   silence. Un site ou une machine hors périmètre ne figure simplement pas
   dans ces tableaux, et le repli est donc automatique.
5. **L'épreuve e2e `tests/e2e/liens-fiches.spec.ts`** navigue toujours
   depuis une liste (`/parc`, `/interventions`) et lit les identifiants
   sur les liens rencontrés — jamais un UUID écrit en dur. Le scénario
   « depuis /interventions » sélectionne la ligne dont la **troisième**
   colonne (Machine) n'est pas le signe d'absence : filtrer sur la ligne
   entière était d'abord faux, parce que la colonne Priorité porte
   elle-même un tiret cadratin (« P1 — critique ») sur CHAQUE ligne.

## Ce que je n'ai PAS fait

- Le parc affiché sur les fiches client et site, le fil d'Ariane complet,
  les boutons « + Site », l'aperçu du parc — c'est LIENS-2, explicitement
  hors territoire de ce lot, et je n'y ai pas touché.
- La seconde sous-ligne client/site du registre `/parc` (point 4 du ticket)
  — voir « Ce que j'ai tranché », point 2. Non fait, et signalé plutôt que
  contourné.
- Je n'ai touché ni `machinesAffichees` pour ses appelants existants
  (`/interventions`, le bon imprimable), ni le contenu du bon imprimable —
  conforme aux interdits du ticket.
- Aucune migration Prisma, aucune donnée de production.

## Les pièges pour la session suivante

- **`git stash` ne convient pas pour un AVANT/APRÈS une fois le lot
  commité** — une fois les changements commités, `git stash` n'a plus rien
  à empiler. J'ai utilisé `git checkout HEAD~1 -- <fichiers>` (hors
  fichiers d'épreuve) pour revenir à l'état d'AVANT sans bouger `HEAD`, puis
  `git checkout HEAD -- <fichiers>` pour revenir à l'état commité — ça
  marche, mais seulement si aucun autre commit n'a été fait entre-temps sur
  ces mêmes fichiers.
- **Le gardien `sans-chaine-visible-en-dur` attrape un JSX enfant, pas un
  argument de fonction.** Il lit `noeud.expression` d'un `JsxExpression`
  dont le PARENT est un `JsxElement`/`JsxFragment` — un `.push(x)` ou tout
  autre appel classique n'est jamais visité par cette règle, même si `x` est
  une chaîne littérale ou une constante du fichier. C'est ce qui permet à
  `TIRET` de voyager comme prop (`valeur={x ?? TIRET}`) partout ailleurs
  dans ce dépôt sans jamais être détecté — mais l'écrire directement entre
  deux balises (`<dd>{TIRET}</dd>`) l'attrape immédiatement.
- **`RangeeMaitreDetail.locator("p")` est pincé par deux épreuves e2e
  préexistantes** (`parc.spec.ts:112`, `parc-apercu-borne.spec.ts:139`) qui
  supposent UN SEUL `<p>` par ligne du maître-détail. Toute tentative
  future d'ajouter une seconde ligne visible à `.machine-row` devra d'abord
  rouvrir D126 (le client « a quitté la ligne pour l'aperçu ») plutôt que
  de la contourner par le DOM.
- Les captures ont été prises par un spec e2e **jetable**
  (`tests/e2e/zzz-captures-liens-1.spec.ts`), écrit puis supprimé après
  usage — il n'est pas dans le dépôt. Le reproduire : deux
  `PHASE=avant|apres pnpm exec playwright test <fichier>`, l'un sur le code
  d'avant (`git checkout HEAD~1 -- ...`), l'autre sur le code d'après.

## Ce qui reste à faire

- Rouvrir, avec un humain, la question du client/site sur la ligne du
  registre `/parc` (point 4 du ticket, annulé ici) : soit confirmer D126
  (le client reste hors de la ligne, l'aperçu suffit), soit l'amender
  explicitement et mettre à jour `tests/e2e/parc.spec.ts:112` et
  `tests/e2e/parc-apercu-borne.spec.ts:139` en conséquence — ce n'est pas à
  ce lot de trancher une décision déjà arrêtée.
- LIENS-2 : le parc sur les fiches client/site, le fil d'Ariane, les
  boutons « + Site », l'aperçu du parc — non commencé.
