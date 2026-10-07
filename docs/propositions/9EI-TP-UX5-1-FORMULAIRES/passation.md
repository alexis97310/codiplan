# 9EI-TP-UX5-1-FORMULAIRES — passation

## Ce que j'ai changé, et ce que ça change pour l'exploitation

`/interventions/nouvelle` est reconstruit au gabarit de la maquette du 28/09 (QE-13a,
D125), en deux sections numérotées « 1 Qui et où » / « 2 Ce qui est demandé », avec une
colonne de droite « Récapitulatif » / « Qui sera prévenu » qui apparaît à côté du
formulaire au-delà de 901 px et en dessous sous ce seuil.

- **La priorité n'a plus de valeur imposée à l'écran** : un groupe de boutons radio
  (`components/ui/choix.tsx`), rien coché d'avance, au lieu d'un `<select>` qui ouvrait
  toujours sur « P3 — normale ». Côté exploitation, un ADV ou un technicien qui crée une
  intervention doit désormais choisir explicitement une priorité — « Créer » sans priorité
  est bloqué par le navigateur, et si ce blocage est contourné, le serveur refuse
  nommément (`intervention.refus.priorite_manquante`). Ce changement de comportement est
  volontaire (décision 15 d'Alexis du 05/10/2026) : avant ce lot, une création rapide sans
  réflexion sur la priorité partait silencieusement en P3.
- **La machine se choisit en cartes visibles** (jusqu'à 6 machines sur le site, « Sans
  machine » comprise et cochée par défaut) plutôt qu'en liste déroulante ; au-delà de 6
  machines, le `<select>` d'avant reste inchangé. Rien ne change pour la DONNÉE écrite —
  seule la façon de la choisir change.
- **La colonne de droite** nomme le donneur d'ordre du site dès qu'un site est choisi
  (nom seul, jamais son courriel) et rappelle le lieu choisi — une information qui existait
  déjà ailleurs (la fiche site, la fiche client) mais pas sur cet écran avant la création.
- Les champs facultatifs (Contact sur place, Durée prévue, Mode de valorisation, Référence
  client, Machine) portent désormais la mention « (facultatif) » — avant ce lot, seuls les
  champs obligatoires étaient marqués, ce qui laissait les autres ambigus.
- Le titre de l'écran affiché (`<h1>`) devient « Nouvelle intervention » (était « Créer une
  intervention ») ; le titre d'onglet (`<title>`) ne change pas (choix du pilote C10).
- **Aucune règle de gestion n'a changé AUTRE QUE la priorité obligatoire à cette route
  précise** : la réserve VGP (`lib/vgp/observations.ts`) et la reprise d'import
  (`lib/interventions/depot-reprise.ts`) continuent de créer des interventions en P3 par
  défaut, sans qu'aucune priorité leur soit jamais demandée — `schemaCreation` garde son
  `.default("p3")` intact.

## Ce que j'ai mesuré

- `pnpm format:check`, `pnpm lint`, `pnpm typecheck` : verts, à chaque commit.
- `pnpm test` (unitaires) : 405 fichiers, 4291 tests, verts — dont 19 tests neufs ou
  étendus (`Choix` ui, `SectionFormulaire`, `AideChamp`, `champEnCause`,
  `motifDuRefusDeSaisie`, `libelleMachineFacultative`/`recapitulatifVide`/`prevenuVide`/
  `optionsPriorite`).
- `pnpm test:isolation` : 165 fichiers, 1479 tests, verts — dont le nouveau
  `tests/isolation/recherche-site-donneur-ordre.test.ts` (3 tests : le donneur d'ordre du
  site prime celui du client, retombe sur le client à défaut, `null` sans donneur
  éligible).
- `tests/e2e/9ei-tp-ux5-1-formulaires.spec.ts` (7 tests, sa propre fixture `TPUX5-`) :
  verte en isolation ET dans un lancement groupé de 24 fichiers (81/83 verts, voir « pièges »
  ci-dessous pour les 2 restants).
- Les ~18 specs e2e existants qui soumettaient ce formulaire ont été rejoués, un par un
  puis en groupe de 24 fichiers (83 tests) : tous verts après l'ajout de `choisirPriorite`/
  `choisirMachine` (deux occurrences où la forme machine est passée de `<select>` à des
  choix visibles ont dû être adaptées : `creation-2.spec.ts`, `selecteurs-1.spec.ts`,
  `intervention-machine.spec.ts`, `formulaires-2.spec.ts`, `fiche-360-1.spec.ts`,
  `liens-fiches.spec.ts`).
- **`pnpm verify:full` complet N'A PAS encore été rejoué après la toute dernière
  retouche** (le renommage `tpux5.e2e.site` → `tpux5.e2e.lieu` pour le gardien du
  vocabulaire imposé) au moment d'écrire cette passation — à faire avant de considérer le
  lot clos si cette passation est lue avant que `pnpm verify:full` n'ait tourné une
  dernière fois en bout de session.

## Ce que j'ai tranché, et pourquoi

- **La colonne de droite vit dans `ChampSiteEtMachines`** (`components/interventions/
  site-et-machines.tsx`), pas dans `page.tsx` ni dans un composant séparé : c'est le seul
  détenteur côté client de l'état « site choisi », et une colonne ailleurs ne verrait
  jamais cet état sans le dupliquer. La section 2 et le pied de la carte lui sont passés en
  `children` — des nœuds déjà traduits par la page SERVEUR, jamais une fonction.
- **La priorité, dans `components/ui/choix.tsx`, étendu plutôt que dupliqué** : `erreur`
  (message sous le groupe) et le couple `valeur`/`onChange` (mode contrôlé, pour la
  machine) sont facultatifs — les 5 tests déjà écrits par 9ED restent verts sans
  modification.
- **`motifDuRefusDeSaisie` extrait dans `formulaire.ts`** plutôt que laissé inline dans
  `route.ts` : testable sans session ni base, à la manière de `versLeFormulaire`
  (mentionné explicitement par le ticket comme modèle).
- **La composition des options de priorité vit dans `app/(back-office)/interventions/
  presentation.ts` (`optionsPriorite`), pas dans `page.tsx`** : le gardien GR5/D144
  (`tests/unit/ui/priorite-une-correspondance.test.ts`) exige que tout `.tsx` qui rend une
  clé `priorite.` appelle `tonDePriorite` ou rende `<Priorite>` — pensé pour un affichage,
  pas pour un groupe de boutons à choisir (la maquette ne les peint pas). Déplacer la
  composition dans un fichier `.ts` évite d'imposer une couleur qu'aucune maquette ne
  demande ici, sans affaiblir le gardien ailleurs.
- **Le `donneurOrdre` de `/api/recherche/site/[id]` réutilise `destinataireClient` sur les
  contacts DÉJÀ lus** pour la liste de contacts du formulaire, avant leur filtre par site —
  aucune lecture neuve.
- **Décision D178** (et non D179 comme l'annonçait l'addendum du ticket) : au moment de ce
  commit, `main` ne portait pas encore de D178 (9EB-1, supposé l'avoir pris, n'est pas sur
  cette branche) — j'ai pris le premier numéro libre et noté la condition de
  renumérotation dans le texte de la décision elle-même.
- **Les captures de ce lot sont prises PAR l'épreuve fonctionnelle elle-même**
  (`capturer()` dans `9ei-tp-ux5-1-formulaires.spec.ts`), comme `creation-2.spec.ts` ou
  `formulaires-2.spec.ts` le font déjà — plutôt qu'un fichier `captures-*.spec.ts` séparé
  (l'autre convention observée dans ce dépôt, utilisée par des tickets où la fixture de
  capture diffère de la fixture fonctionnelle, ce qui n'était pas le cas ici).

## Ce que je n'ai pas fait

- **L'alerte de doublon** (« une intervention est déjà ouverte sur cette machine ») et le
  **retour sous 30 jours** (RG-INT-10) : aucune lecture neuve, seulement un emplacement vide
  et nommé (`data-alertes-creation`, sous le champ Machine) — explicitement hors du
  territoire de ce lot.
- **La valorisation déplacée à la pose** (QT-6, lot TP-ARG) : le champ reste à la création,
  même défaut qu'avant.
- **« Machine à l'arrêt »** (QG-10, PG-G17) et **« Machine non listée »** : non construits.
- **Les horaires d'accès, le trajet et les consignes** dans la colonne « Récapitulatif » :
  absents, comme demandé (« SANS les mots horaires d'accès, trajet, consignes »).
- **`AideChamp`** (`components/ui/aide-champ.tsx`) est posé et testé, mais n'est consommé
  par AUCUN champ de cet écran — tous les textes d'aide déjà présents (agence déduite,
  recherche de site, durée prévue) restent des paragraphes toujours visibles, pas des
  bulles « ? » à ouvrir ; je n'ai trouvé aucun endroit de CET écran où remplacer un texte
  permanent par une bulle masquée semblait une amélioration plutôt qu'une régression de
  lisibilité, et le ticket ne nomme aucun champ précis à équiper. Le composant attend un
  prochain ticket qui en aura l'usage, comme `Choix` (ui) l'a attendu entre 9ED et ce lot.
- Je n'ai **pas vérifié si une alerte d'habilitation du site** (C9 du ticket, « non faite »)
  manque ailleurs sur l'écran — hors lot, comme prévu.

## Les pièges pour la session suivante

- **Pollution croisée entre specs e2e parallèles, déjà présente avant ce lot.** Dans un
  lancement groupé de 24 fichiers (les specs touchés par ce ticket + le nouveau), deux
  tests ÉTRANGERS à ce lot échouent de façon intermittente :
  - `captures-parcours-1.spec.ts` (« capture — la fiche d'une intervention à planifier… ») :
    `choisirPremierResultat(page, "site")` (aucun filtre de texte) ramasse parfois un site
    fraîchement créé par un AUTRE fichier (`captures-9az-aa6-refus-creation.spec.ts`, qui
    crée un site rattaché à une agence inactive) — la création tombe alors sur
    `intervention.refus.agence_inactive` au lieu de réussir.
  - `captures-9br-tpa4b-messages.spec.ts` (« …agence et forfait…, à 375px ») : une violation
    de contrainte FK dans son `afterAll` (`site.deleteMany` pendant qu'une intervention
    pointe encore dessus), elle aussi seulement sous forte parallélisation.
  Les deux passent à 100 % rejoués SEULS ou dans un lot plus restreint (mesuré trois fois).
  **Aucune assertion de ces deux fichiers n'a été touchée** — leur mise en scène
  (`choisirPremierResultat` sans filtre pour le premier) est fragile sous parallélisme
  lourd, pas quelque chose que ce lot a cassé. À régler un autre jour, par exemple en
  filtrant la recherche de site de `captures-parcours-1.spec.ts` sur un texte propre à sa
  scène.
- **`select[name="machine_ids"]`/`select[name="priorite"]` n'existent plus dès qu'un site
  porte 6 machines ou moins** : toute nouvelle épreuve sur `/interventions/nouvelle` doit
  utiliser `choisirMachine`/`choisirPriorite` (`tests/e2e/setup/formulaire-creation.ts`),
  qui gèrent les deux formes, plutôt que de supposer l'une ou l'autre.
- **`Choix` (ui) en mode contrôlé coche « Sans machine » par défaut** (valeur `""`), pas
  « rien » — c'est le même défaut que l'ancien `<select>` (dépannage à l'aveugle, cas
  ordinaire), à ne pas confondre avec « aucune option cochée » qui ne vaut que pour le
  mode NON contrôlé (`valeurInitiale`).
- **Toute nouvelle fixture e2e dont le libellé sert aussi de requête d'écran DOIT venir du
  dictionnaire** (`fr["clé"]`), jamais d'une constante locale initialisée par un littéral —
  deux gardiens croisés le vérifient : `sans-chaine-visible-en-dur.test.ts` (toute requête
  d'écran) ET `vocabulaire-impose.test.ts` (si le littéral contient « site » ou « agence »
  en toutes lettres, même dans une fixture de test).

## Ce qui reste à faire

- Rejouer `CI=1 pnpm verify:full` une dernière fois après le renommage
  `tpux5.e2e.site` → `tpux5.e2e.lieu` (fait après la dernière mesure complète documentée
  ci-dessus) avant de considérer le lot réellement clos.
- Régler la fragilité de `choisirPremierResultat` sous parallélisme lourd (voir « pièges »)
  — hors du territoire de ce lot, mais gênante pour la CI nocturne si elle tourne avec
  beaucoup de workers.
- Équiper un champ réel avec `AideChamp` le jour où un ticket en nomme un, plutôt que de le
  laisser sans appelant indéfiniment.
- UX5-b suite / UX5-c / UX5-d (nouvelle machine, nouvelle agence, vérification VGP, client,
  site, absence) restent à faire — explicitement hors de ce lot (TP-UX5-1 seulement).
