# 9AF-GR14-CHARGE-PLANNING — passation

## Ce que j'ai changé

Le bloc « Charge par technicien » de `/planning` (`app/(back-office)/planning/statistiques.tsx`)
écrit désormais ses DURÉES en heures et minutes (« 11 h 30 »), jamais en heure du jour
(« 11:30 ») — GR14, ticket 2/5, constat G17 de l'audit du 26/09/2026.

- **GR14-T2a** — les cinq usages d'`enHeure` (`lib/calendar/parametrage.ts`, qui lit une HEURE
  DU JOUR) sont remplacés par `enDuree` (`lib/calendar/duree.ts`, posée par le ticket 1/5, 9AE) :
  l'infobulle d'un segment de la barre (l.120), les heures engagées (l.124), les heures
  ouvrables (l.128), le trajet (l.139), et « au moins … engagées » quand la charge est
  incomplète (l.187). L'import de `enHeure` est retiré ; rien d'autre dans le fichier n'a
  changé.
- **GR14-T2b** — captures AVANT/APRÈS et cette passation.

Pour l'exploitation : le planificateur qui lit le bloc « Charge par technicien » voit
maintenant la même écriture que partout ailleurs dans l'application (fiche intervention, bon,
compteur terrain, depuis 9AE) — plus aucun écran ne montre un « 11:30 » qui se lit comme une
heure de la journée alors que c'est une durée engagée.

## Ce que j'ai mesuré

- **Test unitaire neuf** : `tests/unit/planning/statistiques-durees.test.ts` (lecture du fichier,
  même famille que `occupation-affichee.test.ts`) : `statistiques.tsx` n'importe plus `enHeure`,
  appelle `enDuree` au moins cinq fois, avec sa mise en échec (un texte qui réimporterait
  `enHeure` est détecté).
- `pnpm test` : 276 fichiers, 2954 tests, verts après T2a. `occupation-affichee.test.ts` reste
  vert SANS modification, comme exigé par le territoire.
- `pnpm format:check` : vert avant chaque commit.
- **Captures AVANT/APRÈS** (`docs/propositions/9AF-GR14-CHARGE-PLANNING/captures/`), à 1280 et
  375 px, prises par un spec neuf (`tests/e2e/captures-9af-gr14-charge-planning.spec.ts`, env
  `CAPTURES_9AF`), sur SA PROPRE scène (deux techniciens forgés, préfixés `GR14PLA-`/`GR14PLB-`,
  jamais `SCENE.*`) : le technicien A porte UNE intervention avec 690 minutes validées et un site
  à 45 minutes de trajet (l'aller-retour du jour) ; le technicien B porte deux interventions, l'une
  à 95 minutes validées, l'autre SANS DURÉE (ni temps validé ni estimation), pour rendre
  « au moins … engagées ». Les deux dates sont posées au LUNDI de la semaine affichée par défaut
  (`lundiDeLaSemaine`) — piège découvert en écrivant la scène, voir plus bas.
  - **AVANT** (`captures/avant/`, code remis temporairement au contenu du commit `46b6936`,
    jamais commité, restauré ensuite — vérifié par `git diff --stat`, vide) : la ligne A écrit
    « 11:30 engagées · 01:30 de trajet · 36:00 ouvrables », la ligne B écrit « au moins 01:35
    engagées · 00:00 de trajet · 36:00 ouvrables ».
  - **APRÈS** (`captures/apres/`, code livré par T2a) : la ligne A écrit « 11 h 30 engagées ·
    1 h 30 de trajet · 36 h 00 ouvrables », la ligne B écrit « au moins 1 h 35 engagées ·
    0 min de trajet · 36 h 00 ouvrables » — exactement les rendus attendus par le ticket.
- `CI=1 pnpm verify:full` en entier, au premier plan, en un seul appel, à la toute fin (sortie
  ci-dessous du dernier commit) : format, typecheck, lint, test, test:isolation, build, et l'e2e
  complet, vert.

## Ce que j'ai tranché et pourquoi

- **Les deux interventions de la scène de capture sont datées au LUNDI de la semaine affichée**,
  jamais « aujourd'hui » : la première tentative posait `date_planifiee` au jour courant, et
  aujourd'hui tombe un dimanche — hors des colonnes LUN-SAM affichées par défaut, et la ligne du
  technicien disparaissait ENTIÈREMENT du bloc « Charge par technicien » (pas seulement de la
  grille). Le lundi de la semaine ISO courante (`lundiDeLaSemaine`, `lib/calendar/semaine.ts`)
  est toujours un jour ouvert des trois agences (Dolbeau, Ducos, Koné travaillent toutes le
  lundi) et toujours dans la fenêtre affichée par défaut.
- **Deux techniciens forgés (`GR14PLA-`, `GR14PLB-`) plutôt que les techniciens de démonstration**
  (`guerin@`, `poigoune@`) : le bloc compte TOUTE la charge d'un technicien sur la période
  affichée, et ajouter une intervention à un technicien existant aurait changé le compte lu par
  une autre épreuve tournant en parallèle (`fullyParallel`) sur la même semaine — le piège nommé
  par le ticket.
- **Statut `terminee`, jamais `cloturee`**, pour les trois interventions de la scène : une ligne
  clôturée ne se modifie plus (I5) et n'a pas besoin de l'être ici — contrairement à 9AE, aucun
  écran de capture ne visite `/terrain/<id>`.
- **Le commentaire historique de `tests/unit/interventions/statistiques.test.ts:204-205`** (qui
  cite « 01:35 engagées · 548:00 ouvrables ») est laissé tel quel : c'est un historique d'un
  défaut déjà corrigé ailleurs (53-PLANNING-3), pas une exigence sur ce fichier.

## Ce que je n'ai PAS fait

- Aucune migration, aucune ligne de semis, aucun prix.
- Aucune règle de gestion touchée : le calcul du taux, ses termes et sa formule sont strictement
  identiques avant/après — seule l'écriture des durées change.
- Je n'ai pas touché `lib/calendar/parametrage.ts` (`enHeure`, toujours utilisée ailleurs pour
  une heure du jour — `planning/page.tsx:1323`, `parametres/agences/**`), ni
  `tests/unit/interventions/occupation-affichee.test.ts`, ni `lib/interventions/statistiques.ts`,
  ni la mise en forme du taux (gras/rouge au-delà de 100 %, GR17, autre ticket), ni aucune clé
  `fr.ts`.
- Je n'ai pas corrigé le fait que les deux techniciens forgés s'affichent « Technicien (nom non
  communiqué) » sur les captures — l'annuaire ne résout pas leur nom pour une raison que je n'ai
  pas creusée, hors périmètre de ce ticket (le texte des DURÉES, seul objet mesuré, est net et
  lisible sur les deux captures).

## Les pièges pour la session suivante

- **Une scène de capture datée sur « aujourd'hui » est fragile un jour de fin de semaine** : si
  le jour courant tombe hors des colonnes affichées par défaut (LUN-SAM, jamais DIM), la ligne du
  technicien concerné disparaît du tout, pas seulement de la grille — parce que le calcul de
  charge (`occupationsDuPlanning`) ne porte que sur les interventions retenues pour la fenêtre
  affichée. Poser la date sur `lundiDeLaSemaine(aujourdhui)` plutôt que sur `aujourdhui` évite le
  piège pour toute future scène de capture sur `/planning`.
- Les tickets 9AG (trajets), 9AH (prestations/sites) et 9AI (libellés de saisie) du même audit
  GR14 restent à traiter séparément.

## Ce qui reste à faire

Rien d'identifié dans le périmètre de ce ticket.
