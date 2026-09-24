# 66-PLANNING-4 — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

Sur la fiche `/interventions/[id]`, les blocs **« Planifier »** (intervention
`a_planifier`) et **« Déplacer »** disent désormais qu'un technicien est
absent à la date choisie **avant l'envoi**, comme « Affecter » le fait déjà.
Ces deux formulaires saisissent la date DANS le même envoi (contrairement à
« Affecter », qui connaît déjà `ligne.date_planifiee` au rendu serveur) :
un nouveau composant client local, `disponibilite-technicien.tsx`, écoute le
changement du champ `date_planifiee` et recalcule le libellé de chaque option
du sélecteur `technicien_id` — `Nom — agenda bloqué le JJ/MM/AAAA` — sur la
MÊME fonction que le dépôt applique déjà (`absenceCouvrant`,
`lib/absences/periode.ts`).

**Pour le planificateur** : choisir une date et un technicien absent sur ces
deux formulaires le dit désormais tout de suite, au lieu d'un refus après
l'envoi (RG-PLA-06, qui reste le seul verrou réel — rien n'est retiré côté
serveur ni côté base).

La mention est bornée à une fenêtre de 90 jours à partir d'aujourd'hui,
calculée dans le fuseau de la société (jamais `CURRENT_DATE`) : au-delà,
aucune mention, et une phrase discrète sous le champ date le dit
(`intervention.disponibilite_technicien.fenetre`). Sans JavaScript, les deux
formulaires se comportent exactement comme avant.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- **AVANT** (lecture du code, `app/(back-office)/interventions/[id]/page.tsx`,
  25/09 04h30) : `optionsDAffectation` était appelée avec `date_planifiee:
  null` pour « Planifier » et avec `[]`/`null` pour « Déplacer » — aucune
  option de ces deux sélecteurs ne portait jamais `data-agenda-bloque`, quelle
  que soit la date choisie ensuite dans le même formulaire.
- **APRÈS**, mesuré par `tests/e2e/planning-4.spec.ts` contre la vraie base :
  scène `PL4-` (un technicien forgé, une absence sur J+10, une intervention
  `a_planifier` et une intervention `planifiee`) :
  - sur « Planifier », choisir J+10 fait porter à l'option de ce technicien
    `data-agenda-bloque=""` et le suffixe `agenda bloqué le` + la date ;
    choisir J+11 fait disparaître les deux ;
  - même mesure sur « Déplacer » (second sélecteur `technicien_id` de la
    fiche, après « Affecter ») ;
  - la note de fenêtre (90 jours) est visible sous le champ date.
- `pnpm typecheck`, `pnpm lint`, `pnpm format:check` : verts.
- `pnpm test` : 257 fichiers, 2771 tests, verts (dictionnaire compris — la
  première version de l'épreuve concaténait un « — » en dur dans une
  assertion de rendu, corrigée en ancrant une regex sur la seule portion
  dictionnaire, comme `blocage-agenda-visible.spec.ts` le fait déjà).
- `pnpm test:isolation` : 122 fichiers, 1226 tests, verts.
- `pnpm build` : compilation de production réussie.
- `pnpm verify:full` : vert de bout en bout — 239 tests e2e passés (237
  avant ce lot + les deux épreuves de `planning-4.spec.ts`), 3 ignorés
  (inchangé, préexistant).

## Ce que j'ai tranché et pourquoi

- **Un composant client qui manipule le DOM, pas un `<select>` réécrit en
  React.** `Saisie` et `Action` restent des fonctions de Server Component
  ordinaires, non exportées, propres à ce fichier. Le ticket interdisait de
  toucher un composant partagé ; réécrire `Saisie` en composant client
  l'aurait rendu client pour TOUTE la fiche. `DisponibiliteTechnicien` se
  pose donc en simple frère du champ date et du sélecteur, à l'intérieur du
  même `<form>`, et les retrouve par leur `name` — c'est ce qui permet à
  « Sans JavaScript, comportement actuel, inchangé » d'être vrai : sans JS,
  ce composant ne s'exécute jamais.
- **La fenêtre de disponibilité (90 jours) est un module-scope constant
  séparé de `JOURS_A_VENIR` d'`/absences`**, même valeur, nom différent : les
  deux bornent des choses différentes (une LISTE affichée contre une
  AFFIRMATION avant envoi), et les faire dépendre l'une de l'autre aurait
  changé le sens de l'une en modifiant l'autre pour une raison distincte.
- **Le suffixe réutilise la clé existante `intervention.technicien_agenda_bloque_le`**,
  jamais une seconde clé de même sens : c'est la même mention qu'« Affecter »,
  seulement posée plus tôt.
- **La lecture des absences de la fenêtre est gated par `peutModifierLePlanning
  && !figee`** — les deux seules conditions sous lesquelles un sélecteur
  technicien avec date saisissable peut apparaître sur cette fiche (« Planifier »
  exige `peutModifierLePlanning` pour ne pas être refusé ; le sélecteur de
  « Déplacer » l'exige aussi) : un rôle sans ce droit, ou une fiche figée, ne
  déclenche aucune lecture supplémentaire en base.
- **La capture sélectionne le technicien bloqué avant le `screenshot`.** Un
  `<select>` fermé sur son option vide n'affiche que « Aucun technicien
  affecté » : sans ce choix, la capture aurait montré un champ vide plutôt que
  la mention.

## Ce que je n'ai PAS fait

- Je n'ai touché ni `lib/absences/`, ni `lib/interventions/personnes.ts`
  (lecture seule, comme l'exigeait le ticket) : `absenceCouvrant` et
  `absencesDeLaPeriode` sont importées telles quelles.
- Je n'ai pas retiré ni modifié le refus serveur RG-PLA-06 : le dépôt et le
  déclencheur `intervention_pas_sur_blocage_agenda` restent le seul verrou.
- Je n'ai pas éprouvé le cas « date hors de la fenêtre de 90 jours retire une
  mention déjà affichée » — seulement l'absence de mention pour une date sans
  blocage (J+11) et la présence de la note de portée. Le comportement au-delà
  de 90 jours est lu dans le code (`disponibilite-technicien.tsx`,
  `dansLaFenetre`) mais n'a pas de scénario e2e dédié : la fenêtre de 90 jours
  aurait demandé un second technicien ou une seconde absence loin dans le
  temps pour l'éprouver sans dépasser le format resserré de ce lot.
- Je n'ai pas touché la note « Le blocage d'agenda n'est signalé ici que… »
  pour un rôle qui voit « Déplacer » sans le sélecteur technicien (rôle sans
  `modifier_planning`) : la note ne s'affiche alors pas non plus, gated par la
  même condition que le sélecteur — vérifié par lecture du code, pas par une
  épreuve e2e séparée (le comportement préexistant de ce champ conditionnel
  n'était pas dans le périmètre de ce ticket).

## Les pièges pour la session suivante

- **`disponibiliteTechnicien` peut valoir `null`** dans `page.tsx` : toujours
  vérifier avant de rendre `<DisponibiliteTechnicien>` ou la note de fenêtre,
  sous peine de rendre le composant/la note même quand le sélecteur technicien
  n'existe pas (rôle sans `modifier_planning`).
- **Les deux sélecteurs `technicien_id` de la fiche ne sont pas
  interchangeables selon le statut** : sur une fiche `a_planifier`, il n'y en
  a qu'UN (« Planifier ») ; sur toute autre fiche non figée, il y en a DEUX
  (« Affecter » en premier, « Déplacer » en second, `.nth(1)`) — c'est la même
  convention que `blocage-agenda-visible.spec.ts` déjà en place.
- **Le gardien L0-11** (`tests/unit/i18n/sans-chaine-visible-en-dur.test.ts`)
  refuse un séparateur de ponctuation (« — ») concaténé en dur dans une
  assertion de rendu e2e, même à côté d'une valeur du dictionnaire : ancrer
  une `RegExp` sur la seule portion dictionnaire (comme fait ici et dans
  `blocage-agenda-visible.spec.ts`) plutôt que reconstruire la chaîne
  complète.

## Ce qui reste à faire

- Rien d'identifié dans le périmètre de ce ticket. Une épreuve dédiée à la
  borne des 90 jours (« une absence réelle mais hors fenêtre ne porte aucune
  mention ») serait un complément possible, pas un manque de ce lot.
