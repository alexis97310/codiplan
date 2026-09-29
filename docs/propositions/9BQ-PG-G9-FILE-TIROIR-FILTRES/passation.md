# Passation — 9BQ-PG-G9-FILE-TIROIR-FILTRES

Trois parties, dans l'ordre du ticket, plus le préalable de date. `CI=1 pnpm verify:full` a été
rejoué EN ENTIER, deux fois, au premier plan, sans interruption — vert les deux fois (624 tests e2e
passés, 3 sautés sans rapport avec ce lot ; build, typecheck, lint, tests unitaires et d'isolation
verts). Chaque partie a fini par son ou ses commits ; aucune image de capture d'un ticket antérieur
n'a été committée (les PNG regénérés par la suite e2e complète, propres à d'autres tickets, ont été
rendus à leur état d'origine après chaque exécution).

## 1. Ce que j'ai changé (et ce que ça change pour l'exploitation)

**Préalable** — `tests/e2e/planning-fenetre-pose.spec.ts` posait ses deux scénarios sur le
MARDI/MERCREDI de la semaine courante ; le 29/09 après ~15h, la fenêtre de pose n'offre plus de
créneau de 2h ce jour-là (PG-B1), et le scénario rougissait. Décalé à +77/+84 jours (semaines
entières, jour de semaine inchangé), et la navigation vers la bonne semaine corrigée au passage
(mesurée en échec par une vraie exécution, pas supposée).

**PG-C2-FILE-ONGLETS** — la colonne « À planifier » ne montrait que la file sans date. Elle
s'appelle maintenant « À traiter » et porte QUATRE onglets à compteurs : À planifier, En retard,
Sans durée, Suspendues — chacun sa population, lue par une requête dédiée
(`lib/interventions/depot.ts` : `interventionsEnRetard`, `interventionsSuspendues`,
`interventionsSansDuree`), jamais en élargissant `listerPlanning`. Un exploitant voit désormais,
sans quitter le planning, les retards et les dossiers à compléter qui restaient invisibles.
Ajout MO-18 : un filtre « Zone » sur les quatre onglets, et une recherche texte (client,
référence) — les deux dans l'URL, combinables avec l'onglet.

**PG-C5-TIROIR** — cliquer une carte du planning menait à la fiche complète, quittant l'écran.
Un tiroir de 440 px (plein écran sous 900 px) s'ouvre désormais à la place, sur TOUTE carte du
planning (les quatre onglets de la colonne, la grille Semaine — case et liste téléphone —, la
grille Jour — axe et ligne « sans heure »). Il montre le résumé de l'intervention et propose
« Ouvrir la fiche », « Déplacer… » (réutilise la fenêtre de pose PG-B2), « Remettre dans la
file » et « Annuler » (motif obligatoire). Un exploitant peut désormais réaffecter ou consulter
une intervention sans perdre sa position dans le planning.

**PG-C6-FILTRES-AUJOURDHUI** — le planning n'avait aucun filtre, et « Aujourd'hui » n'existait
qu'en vue Semaine, masqué sur la semaine courante. Une barre de filtres (Technicien, Nature,
Priorité, Client, Statut, et Agence si plusieurs sont actives) filtre désormais les cartes SANS
retirer aucune ligne de technicien. « Aujourd'hui » est permanent dans les deux vues ; en vue
Jour, s'il tombe un jour fermé pour toutes les agences, il ouvre le premier jour suivant où au
moins une est ouverte.

## 2. Ce que j'ai mesuré (comptes AVANT/APRÈS)

- Captures AVANT/APRÈS prises par des specs e2e dédiées (recette du dépôt : `git worktree` sur le
  commit parent, même spec rejouée deux fois), à 1280 et 375 px, pour les trois parties :
  `docs/propositions/PG-C2-FILE-ONGLETS/captures/`, `docs/propositions/PG-C5-TIROIR/captures/`,
  `docs/propositions/PG-C6-FILTRES-AUJOURDHUI/captures/` — chacune avec son README nommant les
  deux commits photographiés.
- `pnpm test` (unitaire) : 311 fichiers, 3225 tests, tous verts, y compris les gardiens existants
  (maquette D125/D128, D-12 « chaque route est gardée », i18n L0-11, partition
  `planning-un-seul-jeu.test.ts`) — aucun assoupli.
- `pnpm test:isolation` : 135 fichiers, 1290 tests, verts.
- `CI=1 pnpm verify:full` (deux exécutions complètes) : vert les deux fois, 624 tests e2e passés
  (3 sautés, sans rapport avec ce lot).
- Le tiroir, mesuré par une exécution réelle (`tests/e2e/planning-tiroir.spec.ts`) : ouverture au
  clic, contenu chargé par `/api/interventions/[id]/resume`, Échap ferme et rend le focus, aucune
  navigation de page complète (témoin posé sur `window` avant le clic, encore présent après).
- « Aujourd'hui » en vue Jour, mesuré contre un ORACLE (la même fonction pure `prochainJourOuvert`
  jouée sur les calendriers réellement chargés en base par le test), jamais un jour de semaine
  figé.

## 3. Ce que j'ai tranché et pourquoi

- **Les filtres de PG-C6 s'appliquent à `affichees` LUI-MÊME**, pas à une seconde variable posée à
  côté : `tests/unit/interventions/planning-un-seul-jeu.test.ts` exige que les trois consommateurs
  (`construireGrille`, `construireJournee`, `occupationsDuPlanning`) reçoivent le même identifiant
  `affichees`. Conséquence assumée : le panneau de charge (« Charge par technicien ») reflète
  désormais, lui aussi, les filtres actifs — ce n'était pas explicitement demandé, mais diviser à
  nouveau le jeu aurait recréé exactement le défaut que ce gardien existe pour fermer (§9, 01/09).
- **« Sans durée » (PG-C2) ignore la borne « à venir »** du registre et de la tuile du tableau de
  bord : dates passées comprises, volontairement, puisque c'est ici qu'on vient compléter une
  durée manquante sur un dossier déjà daté. Le critère « non terminale + sans durée »
  (`critereSansDuree`) reste néanmoins PARTAGÉ avec `criteresSansDureeAVenir`, pour ne jamais
  diverger sur ce que « sans durée » veut dire.
- **« Annuler » dans le tiroir reste un formulaire HTML ordinaire**, jamais un `fetch` JSON : la
  route `/api/interventions/[id]/annuler` ne répond qu'en redirection (`versLaFiche`), à la
  différence de `/deplacer` qui négocie déjà JSON/HTML. La modifier sortait du territoire de ce
  lot (aucune route n'y est nommée) ; le clic sur « Annuler » navigue donc vers la fiche annulée,
  ce qui reste une conclusion raisonnable d'un geste définitif.
- **« Remettre dans la file » réutilise `/deplacer` avec un formulaire VIDE** (aucun champ, pas
  seulement des champs à blanc) : `champ()` (`app/api/interventions/actions.ts`) traite déjà
  l'absence comme `null`, et `schemaDeplacement` accepte `date_planifiee`/`technicien_id` nuls
  ensemble — aucune route neuve, aucune règle neuve.
- **Le tiroir s'ouvre par délégation d'évènement sur `document`, jamais par `next/navigation`** :
  `router.push`/`replace` re-render le composant SERVEUR de `/planning` à chaque changement de
  `?intervention=`, ce qui aurait rechargé tout le planning pour ouvrir un tiroir. Le choix retenu
  (`history.pushState` direct) est le compromis déjà documenté dans le composant : l'URL reste
  partageable, sans jamais retoucher le reste de l'écran.
- **`prochainJourOuvert` est une fonction PURE, extraite dans `lib/calendar/ouverture.ts`**
  (jamais lue à l'horloge en interne, D85) plutôt qu'un calcul inline dans `page.tsx` : c'est ce
  qui a permis de l'éprouver par un test unitaire déterministe (les calendriers de démonstration,
  DUCOS ouvre le samedi, KONE ferme le week-end) plutôt que de dépendre d'un jour de semaine
  particulier ou d'une horloge truquée — qui n'existe nulle part dans ce dépôt (D85 l'interdit
  justement pour cette raison).
- **`?onglet=`, `?zone=`, `?q=` (PG-C2) et le résultat des filtres (PG-C6) se composent tous dans
  `hrefFile`**, une seule fonction, jamais une seconde composition d'URL : chaque nouveau lien du
  planning (onglets, tiroir, tabs) préserve tous les autres critères déjà posés.

## 4. Ce que je n'ai PAS fait

- **Aucun repli (« replier »/« déplier ») dédié pour la colonne « À traiter »**, distinct du
  « Plein écran » déjà existant : ce dernier remplit déjà le même besoin (rendre sa largeur à la
  grille), et une largeur à 255 px (au lieu des 290 px déjà en place, choisis et documentés par un
  ticket antérieur) n'a été changée nulle part — l'écart avec la maquette est connu et non
  corrigé faute d'un arbitrage explicite dans ce lot.
- **`SansHeureVide` et `HorsGrille`** (les deux replis de la vue Jour sans axe connu — agence sans
  calendrier) gardent la navigation ORDINAIRE vers la fiche, jamais le tiroir : un cas dégradé
  rare, jugé hors du territoire déclaré de PG-C5 (« branchement » de `page.tsx`, pas une réécriture
  de chaque recoin de l'écran).
- **Aucun focus-trap n'a été éprouvé par un scénario dédié** au-delà de ce que
  `planning-tiroir.spec.ts` couvre (ouverture, fermeture, retour du focus) : le piège Tab/Maj+Tab
  est implémenté (voir `components/planning/tiroir.tsx`) mais pas mesuré par une épreuve qui
  presserait Tab répétée.
- **Le filtre « Agence » (PG-C6)** n'a pas été éprouvé par un scénario e2e dédié (seul Technicien,
  Nature, Priorité, Client, Statut le sont directement) : la scène de démonstration ne porte
  qu'une société à plusieurs agences actives, et l'ajouter aurait demandé une scène propre
  supplémentaire — laissé pour une reprise si jugé nécessaire.

## 5. Les pièges pour la session suivante

- **Tout changement du `href` d'une carte du planning a des ondes de choc.** PG-C5-TIROIR a changé
  la cible de CHAQUE lien de carte vers `?intervention=<id>` : cinq scénarios e2e ANTÉRIEURS à ce
  ticket cherchaient encore `a[href="/interventions/<id>"]` et ont rougi — trouvés uniquement par
  `CI=1 pnpm verify:full` EN ENTIER, jamais par des exécutions ciblées. `data-tiroir-declencheur`
  est désormais le marqueur stable à utiliser pour désigner une carte par son identifiant, quelle
  que soit l'évolution future de son `href`.
- **`getByRole(..., { name: fr["planning.aujourdhui"] })` sans `exact: true` collisionne** avec
  « Créée aujourd'hui » (l'ancienneté d'une carte, PG-C2) : `tests/e2e/planning-6.spec.ts` en
  portait la trace, corrigée dans ce lot.
- **Le libellé « Filtrer » est partagé par DEUX formulaires distincts** sur `/planning` (la
  colonne « À traiter », PG-C2 ; la barre de filtres, PG-C6) : un scénario qui cherche ce bouton
  doit scoper son `locator` au bon `<form>`.
- **Ne jamais relancer `CI=1 pnpm verify:full` sans revoir `git status` ensuite** : la suite e2e
  complète rejoue aussi les specs `captures-*.spec.ts` d'anciens tickets, qui écrivent
  inconditionnellement leurs PNG à des chemins fixes — `git status` en ressort avec des dizaines
  de fichiers image « modifiés » (rendu, pas contenu) qu'il ne faut jamais committer.
- **`chargerCalendrierAgence` accepte un `PrismaClient` ordinaire** là où sa signature demande un
  `Prisma.TransactionClient` — c'est ce qui permet à `tests/e2e/planning-filtres-aujourdhui.spec.ts`
  de s'en servir comme ORACLE hors de toute transaction serveur ; si cette fonction change un jour
  de signature, ce scénario (et lui seul) le sentira.

## 6. Ce qui reste à faire

- Décider si la colonne « À traiter » doit un jour porter son propre bouton de repli à 255 px
  (point 4 de non-fait ci-dessus), ou si le « Plein écran » existant suffit — point d'arrêt
  probable au sens du §8 (largeur déjà arbitrée par un ticket antérieur).
- Éprouver le filtre « Agence » par un scénario e2e dédié, sur une scène à deux agences actives.
- Éprouver le piège du focus (Tab/Maj+Tab) du tiroir par un scénario dédié, au-delà de l'ouverture/
  fermeture déjà couverte.
- `SansHeureVide`/`HorsGrille` : décider si ces deux replis rares doivent un jour ouvrir le tiroir
  eux aussi, ou rester une exception documentée.
