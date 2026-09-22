# PLANNING-1 — deux refus qui arrivaient trop tard

Travail commité **sur `main` en local**, sans proposition ni branche distante
(processus du 22/09/2026) : `9f2b6c7` (défaut A) puis `340772e` (défaut B).

Captures prises **sur `3c7f98d`** — empreinte lue par `git rev-parse HEAD` au
moment de la prise, jamais de mémoire ; le code applicatif y est celui de
`340772e`, seule la fixture du scénario e2e a bougé depuis (voir « Ce que le
premier `verify:full` a rougi ») — le **2026-09-22 à 00:11 UTC** (11:11 à
Nouméa), lu à l'horloge, contre le serveur de production compilé
(`next start`) sur la base d'épreuve locale de `pnpm test:e2e` : migrations,
semis de `prisma/seed.ts`, scène de `tests/e2e/setup/scene.ts`, et le blocage
d'agenda que `tests/e2e/blocage-agenda-visible.spec.ts` écrit — T. Wamytan,
jeudi 31/12/2026, quatorze semaines devant. Aucune donnée de la base
hébergée (I9). Largeur 1280 px, fenêtre 900 px de haut.

`mesure.json` est la sortie brute du script de prise de vue : empreinte,
horodatage, et le texte des options telles que la page les a rendues.

## Ce que j'ai lu avant de coder

**RG-PLA-06** (`docs/cahier-des-charges.md`, chapitre 10) : *« Une absence
validée bloque le créneau ; les interventions posées repassent en file à
planifier avec alerte. […] L'effectif se compte PAR AGENCE (D106) […] »*

**RG-PLA-08** (idem, introduite par D129) : *« Une intervention dont le client
est inactif ne s'affiche plus, par défaut, ni dans le planning ni dans le
registre `/interventions`. Le registre porte une case « Inclure les clients
inactifs » qui revient sur ce choix ; le planning ne l'offre pas. Ce que la
règle NE cache PAS : la fiche du client continue de montrer l'intégralité de
son historique […], et le statut du site n'est pas concerné. »*

## Défaut A — le site d'un client inactif à la création

### Ce qui était déjà sur `main`, mesuré

La mesure du 21/09 citée par le ticket est **antérieure à SEMIS-2** (#269,
21/09 12:40) : depuis ce commit, `/interventions/nouvelle` filtre ses lieux
sur `client.actif` et `tests/e2e/site-client-inactif-masque-a-la-creation.spec.ts`
le garde. La capture `creation-selecteur-site--1280.png` le montre : trois
lieux, « Ancien client — Ancien chantier » absent.

**Ce qui manquait** : une liste d'écran n'est pas une règle. `creerIntervention`
(`lib/interventions/depot.ts`) acceptait toujours un `site_id` posté
directement sur `/api/interventions/creer`, et l'intervention naissait
invisible — mesuré par `tests/isolation/creation-client-inactif.test.ts`,
**2 échecs et 1 témoin vert** sans la correction (`expected 1 to be +0` : une
intervention chez le client inactif existait en base), **3/3** avec.

### L'issue retenue, et le motif

**Le filtre**, pas la mention. Deux raisons :

1. D129 ne donne au planning **aucune case** pour lever le masque. Une ligne
   « proposable mais signalée » ferait naître une intervention que le
   planificateur ne retrouverait ensuite que dans le registre, case
   « Inclure les clients inactifs » cochée — c'est-à-dire exactement le défaut
   mesuré, avec un avertissement en plus.
2. *En cas de doute entre montrer et cacher, on cache* (doctrine §2), et le
   semis lui-même écrit ce qu'« inactif » veut dire : *« on ne travaille plus
   pour lui »*.

Le refus **nomme le client inactif** et ce que cela implique
(`intervention.refus.client_inactif` : *« Ce client est inactif : une
intervention créée chez lui n'apparaîtrait ni sur le planning ni dans le
registre. La création est refusée. »*) — jamais « lieu inconnu », qui
accuserait le périmètre alors que le lieu existe et se voit sur la fiche du
client. Capture : `creation-refus-client-inactif--1280.png`, le bandeau tel
que `/planning?motif=` le rend quand le dépôt refuse.

**Le statut du SITE n'est pas jugé** : RG-PLA-08 ne porte que sur
`client.actif`, et la question du site reste ouverte (D129).

**Aucune règle du chapitre 10 n'est amendée** — refuser la création est une
conséquence de RG-PLA-08, pas une règle nouvelle — et aucun arbitrage n'est
écrit. *Condition de réouverture* : le jour où l'exploitation veut pouvoir
créer une intervention chez un client inactif (une clôture de dossier, un
dernier passage), le filtre ET ce refus se rouvrent ensemble, avec la question
de comment le planning la montrerait.

## Défaut B — le blocage d'agenda se voit avant le geste

### Ce qui a été mesuré

`tests/unit/interventions/blocage-agenda-visible.test.ts` — **13 échecs** sans
la correction, dont la mesure du défaut lui-même : `expected 16 to be 0`, la
colonne d'un technicien absent comptait seize créneaux LIBRES parmi les trous.
Puis **4 échecs** sur le sélecteur (`optionsDAffectation is not a function`).
**17/17** avec.

`tests/e2e/blocage-agenda-visible.spec.ts` — **4/4**, cinq exécutions seul,
puis **12/12** joué avec `ecrans-largeur-utile.spec.ts` après le déplacement
de sa fixture (ci-dessous).

### Ce qui a changé, sans changer la règle

Le dépôt refuse toujours (RG-PLA-06). Le critère est celui du refus,
`absenceCouvrant` (`lib/absences/periode.ts`), et lui seul (§9, 01/09).

- **Vue semaine** (`planning-semaine-agenda-bloque--1280.png`) : la case du
  jeudi de T. Wamytan porte la pastille « Agenda bloqué » — celle de
  `/absences`, même mot, même violet (D124, D128) — sur un aplat violet ; la
  légende dit *« Agenda bloqué — le dépôt sera refusé »*. La case reste une
  cible de dépôt : c'est le dépôt qui tranche.
- **Vue jour** (`planning-jour-agenda-bloque--1280.png`) : la pastille en tête
  de colonne, toutes les cellules non occupées en violet, et **« 64 créneaux
  libres »** — quatre colonnes libres de 16 créneaux, la colonne bloquée n'en
  compte aucun. Quatrième état de cellule, `bloque`, qui prime sur libre et
  sur hors ouverture.
- **Fiche, « Affecter »** (`fiche-selecteur-affecter--1280.png`) : *« T. Wamytan
  — agenda bloqué le 31/12/2026 »*. L'option reste proposée. « Déplacer » garde
  la liste nue : sa date se saisit dans le même formulaire.

### Trouvé en chemin, même famille

`affecterTechnicien` — la **troisième** voie qui écrit `technicien_id` sur une
ligne datée, après la pose et le déplacement — ne portait pas le contrôle
RG-PLA-06 : le déclencheur `intervention_pas_sur_blocage_agenda` refusait par
une exception `23514`, jamais par un motif nommé. Mesuré par
`tests/isolation/affectation-agenda-bloque.test.ts` — **2 échecs
(`PrismaClientUnknownRequestError … 23514`) et 2 témoins verts** sans la
correction, **4/4** avec. Il rend désormais `intervention.refus.absence`,
comme les deux autres voies.

## Ce que le premier `verify:full` a rougi, et la réparation

Premier passage (`2026-09-22 00:03 → 00:08 UTC`) : format, typecheck, lint,
2432 unitaires, 1061 d'isolation, build, fériés, partitions verts ; **e2e 116
verts, 2 sautés nommés, 1 rouge** —
`ecrans-largeur-utile.spec.ts › la colonne latérale descend jusqu'en bas de
la fenêtre, même sur un écran COURT` : *« /absences n'est plus un écran
court », 918 px pour 900 attendus.* Cause : ma fixture posait le blocage dans
la **semaine courante**, et `/absences` (fenêtre −30 / +90 jours) gagnait une
ligne et une pastille — une fixture qui déborde sur un écran qu'elle
n'éprouve pas. Réparation : le blocage est posé **quatorze semaines devant**,
hors de cette fenêtre ; le planning s'y rend par `?semaine=` explicite. Le
scénario existant n'a pas été touché.

## Ce que je n'ai pas fait

- **Le sélecteur technicien de `/interventions/nouvelle` et celui de
  « Déplacer » ne disent rien du blocage** : leur date se saisit dans le même
  formulaire, et un rendu serveur ne la connaît pas. Le dire avant le choix
  demanderait un composant client qui relit le champ date — jugé hors du
  geste minimal ; le planning et « Affecter » couvrent le geste principal.
- **Aucune migration, aucun fichier hors territoire** (`lib/absences/`,
  `components/`, `lib/theme/`) : l'entrée de légende du blocage vit dans
  `app/(back-office)/planning/page.tsx`, pas dans `LEGENDE_PLANNING`, qui
  recopie les six familles de la maquette dans son ordre.
- **Pas de registre dans `docs/registres/`** : hors territoire ; ce README
  tient lieu de registre pour ce ticket.
