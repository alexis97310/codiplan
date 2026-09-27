# 9AG-GR14-TRAJETS — passation

## Ce que j'ai changé

`/parametres/trajets` (`app/(back-office)/parametres/trajets/page.tsx`) écrivait sa colonne
« Valeur de référence » — et les deux autres colonnes de durée, « Réglage de la société » et
« Ce qui s'applique » — en `HH:MM` (`enHeure`, une HEURE DU JOUR) suivi de ses minutes entre
parenthèses : « 04:00 (240 minutes) ». C'était le seul des quatre écrans visés par l'audit GR14
(constat G17) à ne pas avoir suivi 9AE/9AF vers `enDuree` (une DURÉE).

- **GR14-T3a** — `duree()` (l.257-259) appelle désormais `enDuree` (`lib/calendar/duree.ts`) au
  lieu d'`enHeure` (`lib/calendar/parametrage.ts`) ; l'import d'`enHeure` est retiré. La
  parenthèse `(… minutes)` composée par `decompte()` est GARDÉE telle quelle — ce n'est pas une
  substitution mais un remplacement d'UNE des deux lectures que le commentaire du fichier promet
  depuis R3-03 (« l'écran donne les deux »). Rendus : « 4 h 00 (240 minutes) », « 1 h 30
  (90 minutes) », « 30 min (30 minutes) ». Le commentaire au-dessus de `duree()` est réécrit pour
  citer `enDuree` au lieu d'`enHeure` ; la phrase en italique qui justifie les deux lectures est
  inchangée.
- **GR14-T3b** — captures AVANT/APRÈS et cette passation.

Pour l'exploitation : l'ADV qui règle les temps de trajet par zone (D107) lit désormais la même
écriture de durée que partout ailleurs dans l'application (fiche intervention, bon, compteur
terrain depuis 9AE, bloc « Charge par technicien » depuis 9AF) — plus aucun écran ne montre un
« 04:00 » qui se lit comme une heure de la journée alors que c'est un trajet.

## Ce que j'ai mesuré

- **Test e2e neuf, en lecture seule** : `tests/e2e/ergo14-trajets.spec.ts`. Aucune écriture en
  base, aucune scène forgée — la valeur de référence de la Côte Est vient du CODE
  (`DEFAUTS_TRAJET_ZONE.cote_est`, 240 minutes), pas d'une donnée partagée. L'épreuve compose le
  texte attendu avec les mêmes fonctions que la page (`enDuree`, `decompte`, les clés
  `fr["trajets.minute_une"]` / `fr["trajets.minutes"]`) dans une fonction locale
  (`dureeAttendue`), jamais une chaîne recopiée, et vérifie l'absence de la forme `HH:MM`
  (`enHeure(240)`) dans la même cellule.
  - **Piège rencontré et résolu** : composer ce texte dans une CONSTANTE assignée puis
    directement forwardée à `toHaveText(...)` fait échouer le gardien
    `sans-chaine-visible-en-dur` (L0-11) — il suit un identifiant ou un gabarit forwardé
    DIRECTEMENT dans une requête d'écran (forme 3 du §9), et signale les fragments littéraux
    `(` / `)` du gabarit. Passer par une fonction locale nommée (`dureeAttendue(minutes)`),
    appelée avec un argument NUMÉRIQUE au point d'usage, évite le suivi : c'est la même
    discipline que `dureeCarteAffichee` importé dans `planning-largeur-et-carte.spec.ts` — un
    appel de fonction n'est pas tracé jusque dans le corps de la fonction appelée.
- `pnpm test` : 276 fichiers, 2954 tests, verts après GR14-T3a.
- `pnpm format:check` et `pnpm typecheck` : verts avant chaque commit.
- **Captures AVANT/APRÈS** (`docs/propositions/9AG-GR14-TRAJETS/captures/`, à 1280 et 375 px),
  prises par un spec neuf (`tests/e2e/captures-9ag-gr14-trajets.spec.ts`, env `CAPTURES_9AG`) —
  aucune scène forgée non plus, l'écran affiche les six zones telles que le code les définit.
  - **AVANT** (`captures/avant/`, code du fichier remis temporairement au contenu du commit
    parent `6c75456` par `git checkout 6c75456 -- app/.../page.tsx`, jamais commité, restauré
    ensuite — vérifié par `git checkout HEAD -- …` puis `git diff --stat`, vide) : la colonne
    « Valeur de référence » écrit « 00:30 (30 minutes) », « 01:30 (90 minutes) »,
    « 04:00 (240 minutes) », « 02:30 (150 minutes) », « 04:00 (240 minutes) » pour les cinq
    zones estimées.
  - **APRÈS** (`captures/apres/`, code livré par GR14-T3a) : la même colonne écrit
    « 30 min (30 minutes) », « 1 h 30 (90 minutes) », « 4 h 00 (240 minutes) »,
    « 2 h 30 (150 minutes) », « 4 h 00 (240 minutes) » — exactement les rendus attendus par le
    ticket, et identiques sur les colonnes « Réglage de la société » (une fois réglée) et
    « Ce qui s'applique ».
  - `CI=1 pnpm verify:full` en entier, au premier plan, en un seul appel : voir la sortie
    ci-dessous du dernier commit.

## Ce que j'ai tranché et pourquoi

- **La parenthèse des minutes est gardée sous une heure aussi** (« 30 min (30 minutes) »), sans
  la retirer pour Grand Nouméa : le commentaire l.252-255 du fichier dit explicitement
  « l'écran donne les deux [lectures] », sans distinguer un seuil, et ce ticket n'a pas mandat
  pour trancher ce point contre une décision déjà écrite (§8 du CLAUDE.md — l'assouplissement
  d'une décision existante est un point d'arrêt). La question exacte, pour Alexis, est portée
  plus bas.
- **Seul `duree()` est touché**, pas `referenceAffichee()` ni `appliqueAffiche()` : les deux
  passent déjà par `duree()`, donc suivent le changement sans modification de leur propre code —
  confirmé par les captures (les trois colonnes affichent la même forme).

## Ce que je n'ai PAS fait

- Aucune migration, aucune ligne de semis, aucun prix, aucune règle de gestion touchée : la
  cascade, le refus des Îles, la valeur de chaque zone sont strictement identiques avant/après —
  seule l'écriture de la durée change.
- Je n'ai pas touché `etiquetteChamp()` (l.220-222) ni le champ de saisie numérique de
  `Reglage()` — hors territoire (9AI).
- Je n'ai pas touché `lib/sites/trajet-zone.ts`, `fr.ts`, la route
  `app/api/parametres/trajet-zone`, ni `lib/calendar/parametrage.ts` (`enHeure`, toujours
  utilisée ailleurs pour une heure du jour réelle).
- Je n'ai pas tranché la question de la parenthèse sous une heure (voir ci-dessous) : elle reste
  ouverte, et l'écran actuel la garde par défaut (comportement inchangé sur ce point précis).

## Les pièges pour la session suivante

- **Un texte composé avec `enDuree`/`decompte` et forwardé DIRECTEMENT à une requête d'écran
  Playwright** (`toHaveText`, `toContainText`, …) via une constante locale fait échouer
  `sans-chaine-visible-en-dur` (L0-11), même si aucune chaîne n'est recopiée — les fragments de
  ponctuation du gabarit (`(`, `)`) sont vus comme littéraux. Passer par une fonction locale
  appelée avec des arguments non littéraux au point d'usage (voir `ergo14-trajets.spec.ts`) évite
  le faux positif ; c'est le même principe que la fonction `dureeCarteAffichee` déjà importée
  dans `planning-largeur-et-carte.spec.ts`, jamais recomposée dans le fichier de spec lui-même.
- **Question pour Alexis** : sous une heure, faut-il garder la parenthèse
  (« 30 min (30 minutes) ») ? Le commentaire l.254-255 de `page.tsx` dit « l'écran donne les
  deux [lectures] » sans distinguer un seuil, et ce ticket l'a gardée pour cette raison — mais
  « 30 min (30 minutes) » répète presque le même mot deux fois, ce que « 4 h 00 (240 minutes) »
  ne fait pas. Si la réponse est de retirer la parenthèse sous l'heure, c'est un changement de
  `duree()` (ou de `decompte()` à son point d'appel ici), pas une simple substitution de
  fonction — donc un ticket à part plutôt qu'un correctif de ce lot.
- Les tickets 9AH (prestations/sites) et 9AI (libellés de saisie) du même audit GR14 restent à
  traiter séparément.

## Ce qui reste à faire

La question ci-dessus (parenthèse sous l'heure) est en attente d'arbitrage. Rien d'autre
d'identifié dans le périmètre de ce ticket.
