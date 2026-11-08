# 9K02-PORTAIL-MENU-ACCUEIL — passation

## Mesure (fichier:ligne, avant toute écriture)

- `lib/navigation/entrees.ts:434-436` — `ENTREES_PORTAIL` ne portait qu'une entrée
  (`nav.portail_parc` → `/portail`), alors que quatre écrans existaient déjà :
  `app/(portail)/portail/interventions/page.tsx` (9J07), `.../demandes/page.tsx`
  (9J04), `.../contacts/page.tsx` (9J03), `.../tarifs/page.tsx` (9J20). Chacun
  passait déjà `entrees={ENTREES_PORTAIL}` et `chemin="/portail/…"` — la seule
  chose à faire était d'AJOUTER les quatre entrées, aucune route ni aucun écran
  neuf.
- `app/(portail)/layout.tsx` et `components/navigation/barre.tsx` (burger à
  375 px, `#colonne-navigation`, `nav.ouvrir_le_menu`) ne distinguent pas le
  nombre d'entrées : les cinq entrent dans le MÊME composant que l'unique
  entrée d'avant, desktop et burger compris — aucune modification de mise en
  page n'était due.
- `app/(portail)/portail/page.tsx:62-340` (avant) : trois textes faux —
  sous-titre « Cette page est en consultation seule » (`fr.ts:144-145`,
  `portail.sous_titre_apres`) devenu contestable depuis que 9J04 a ouvert un
  vrai dépôt ; carte « Vos interventions » avec `portail.interventions.a_venir_*`
  (`fr.ts:224-226`, « l'historique […] n'est pas encore lisible ici ») fausse
  depuis 9J07 ; carte « Demander une intervention » avec `portail.demande.a_venir_*`
  (`fr.ts:268-271`, « ce formulaire n'est pas ouvert ») fausse depuis 9J04.
- `app/(portail)/portail/page.tsx:304-337` (avant) : `placeDesDocuments()` et
  `placeDuVgp()` rendues DANS la boucle `parc.machines.map`, donc répétées à
  l'identique pour chacune des 6 machines du semis — mesuré à la capture AVANT,
  ~2 800 px de haut à 375 px.
- Comptes réutilisables, sans nouvelle politique RLS : `interventionsDuParc`
  (`app/(portail)/portail/interventions/depot.ts`) lit déjà `statut` sous la
  forme « parc » ; `estFige` (`lib/interventions/cycle-de-vie.ts:48-50`) donne
  « en cours » = non figée. `demandesOuvertes` (`lib/demandes/depot.ts:453-467`)
  lit déjà la file de qualification (`nouvelle`, `qualifiee`) sous la même
  forme — exactement ce que `/portail/demandes` affiche déjà comme « ouvertes ».

## Ce qui a été fait

1. **Menu à cinq entrées** (`lib/navigation/entrees.ts`) : `nav.portail_interventions`,
   `nav.portail_demandes`, `nav.portail_contacts`, `nav.portail_tarifs` ajoutées
   à la suite de `nav.portail_parc`, avec une icône chacune
   (`components/navigation/barre.tsx`, `ICONE_PAR_CHEMIN`) pour rester cohérent
   avec le reste de la barre — aucune des deux barres (back-office/portail) ne
   partage de clé (gardien `tests/unit/navigation/barre-du-portail.test.tsx`).
2. **Accueil** : bouton « Signaler une panne » (lien vers `/portail/demandes`,
   `min-h-11`) en premier, puis les deux tuiles comptées (« Interventions en
   cours (n) », « Demandes en attente (n) »), chacune un lien. Les trois textes
   faux retirés de `fr.ts` ; les deux notices « Documents »/« VGP » affichées
   UNE fois sous « Vos machines » plutôt que répétées par ligne.
3. **Épreuves** : unitaire pour `titreTuileAvecCompte` ; isolation dédiée
   (`tests/isolation/9k02-portail-accueil-compteurs.test.ts`, 4 scénarios) pour
   la COMPOSITION des deux comptes (le filtre lui-même est déjà éprouvé par
   9J04/9J07) ; e2e fonctionnel (`tests/e2e/9k02-portail-menu-accueil.spec.ts`,
   16 scénarios) — chaque entrée et chaque tuile, à 1280 et 375 px.
4. **Captures AVANT/APRÈS** (`captures-9k02-portail-menu-accueil.spec.ts`,
   rejoué deux fois par `git worktree` sur le commit `38f405eb8`, précédant ce
   lot, puis sur le code livré) : `docs/propositions/9K02-PORTAIL-MENU-ACCUEIL/captures/`.

## Ce que j'ai tranché, et pourquoi

- **Icônes sur les quatre entrées neuves** : non demandées explicitement par le
  ticket, ajoutées pour que les cinq entrées restent visuellement cohérentes
  (une seule entrée sans icône aurait détonné) — aucun gardien ne les exige
  (`icones-du-menu.test.tsx` ne porte que sur le back-office et sur
  `nav.portail_parc`), elles ne font donc rougir rien en les retirant si Alexis
  préfère sans.
- **« Interventions en cours » = non figée (`estFige`)** plutôt qu'une liste de
  statuts recopiée ici : réutilise le même partage que le back-office pour
  refuser une action sur une intervention `cloturee`/`annulee` (D160) — jamais
  une seconde lecture du critère.
- **« Demandes en attente » = `demandesOuvertes`** (statuts `nouvelle`,
  `qualifiee`) : même lecture que l'onglet actif de `/portail/demandes`, pas une
  troisième définition de « en attente ».
- **Le titre de tuile compose `libellé (n)` dans `presentation.ts`**, hors JSX
  (L0-11) — comme `TIRET`/`DEUX_POINTS` déjà dans ce fichier, la parenthèse
  reste un caractère de liaison local, jamais une clé de dictionnaire séparée.
- **« Signaler une panne » mène à `/portail/demandes`**, pas à une ancre sur le
  `<details>` du formulaire : le formulaire est derrière un disclosure sur
  cette même page (`portail.demandes.action.deposer`), ouvrir l'écran suffit à
  tenir la promesse du bouton sans ajouter de comportement d'ouverture
  automatique non demandé.
- **Sous-titre de l'accueil** : seule la clé `portail.sous_titre_apres` est
  modifiée (retire « Cette page est en consultation seule »). Les clés
  `portail.machine.sous_titre` et `portail.interventions.fiche.sous_titre`
  restent inchangées : ces deux écrans-là sont encore de pure lecture.

## Ce que je n'ai PAS fait

- **Aucune route, aucune migration, aucune politique RLS** — les quatre écrans
  ajoutés au menu existaient déjà.
- **Le nommage des machines et la case « machine à l'arrêt »** — explicitement
  pour le lot suivant (voir l'en-tête du ticket).
- **`lib/auth/**`, la carte « Accès portail », `app/api/portail/tarifs/**`** —
  territoire de l'autre voie (9K01/invitation-révocation), non touchés.
- **Aucune capture de `/portail/interventions`, `/portail/demandes`,
  `/portail/contacts`, `/portail/tarifs` eux-mêmes** : ils ne changent pas
  d'apparence, seule leur ATTEIGNABILITÉ change (menu). Les captures portent
  sur l'accueil et le menu, les deux seuls écrans dont l'apparence bouge.

## Ce que j'ai mesuré

- `pnpm format` / `pnpm typecheck` / `pnpm lint` : verts après chaque commit.
- `pnpm test` : 504 fichiers / 5544 tests, vert.
- `pnpm test:isolation` : 228 fichiers / 1955 tests, vert (dont les 4 scénarios
  neufs de 9K02).
- `tests/e2e/tous-les-ecrans-rendent.spec.ts` : 59 passés, 3 ignorés
  (préexistants, étrangers à ce lot), vert.
- `tests/e2e/9k02-portail-menu-accueil.spec.ts` : 16 passés, vert.
- `tests/e2e/captures-9k02-portail-menu-accueil.spec.ts` : 3 passés par passe,
  deux passes (avant/après), 6 images dans `captures/`.

## Pour la session suivante

- `pnpm verify:full` reste à la file (non joué ici, par consigne).
- Si une cinquième capture (p. ex. `/portail/tarifs` depuis le nouveau lien de
  menu) est demandée, elle se reprend en rejouant
  `captures-9k02-portail-menu-accueil.spec.ts` seul — aucune fixture de parc
  n'est posée par ce fichier, le semis de démonstration suffit déjà.
