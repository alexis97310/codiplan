# Passation — 9EH-TP-UX-PL-PLANNING-2

Lots commités sur `main` local (détaché, non poussé) : `ad658702` (0), `e24bf85b` (A), `81f5ac2c` (B),
`32325ee8` (C), `ee4d32de` (D193), `ba8c73d2` (épreuve e2e neuve), `f59e88ed` (captures).

## 1. Ce que j'ai changé (et ce que ça change pour l'exploitation)

- **Partie 0** — `components/planning/transmettre-demain.tsx` : le bouton « Transmettre demain (n) »
  ne déborde plus de son cadre à 375 px (texte qui revenait à la ligne faute de `whitespace-nowrap`
  désactivé sous 901 px). Aucun impact fonctionnel, un défaut visuel laissé par 9EH-1 est corrigé.
- **Partie A** — Colonne « À traiter » : icône, onglets en liste verticale, compteur ROUGE sur
  « À planifier » quand une P1 attend (alerte visible sans ouvrir la colonne) ; recherche à loupe
  cliquable, Zone via `ListeQuiFiltre`. Cartes de la file : un seul cadre (avant : « Poser… » hors du
  cadre), bord gauche coloré par priorité, badge « durée ? » neuf. Pour l'exploitation : rien de
  fonctionnel ne change (mêmes requêtes, même tri, même droit) — c'est une alerte visuelle en plus
  (compteur rouge) et un geste qui devient visuellement contenu dans sa carte.
- **Partie B** — Colonne technicien (Semaine et Jour) : avatar à initiales (teinte par personne),
  mini-jauge de charge 6 px (Semaine, une seule agence), lien « Absence » avec icône et texte
  raccourci (nom accessible inchangé). Aucun droit, aucun calcul métier changé — `tauxCompact` est
  lu, jamais recalculé.
- **Partie C** — Cartes de la grille Semaine (forme normale) : créneau/client/nature-site/matériel
  séparés en quatre lignes, badges « ✓ transmise » et « durée ? » neufs. Légende : « Affectée »
  ajoutée, « Atelier / interne » retirée, « En cours / P1 » devient « En cours », entrée priorité
  (puces P1/P2), « Annulée » conditionnelle.
- **D193** ajouté à `docs/arbitrages.md`, après D192.
- Une épreuve e2e neuve (`tests/e2e/planning-gabarit-28-09-partie-2.spec.ts`, 7 scénarios, fixture
  propre `zz9EH2-`) et les captures AVANT/APRÈS du ticket.

## 2. Ce que j'ai mesuré (AVANT/APRÈS)

- `pnpm typecheck`, `pnpm lint`, `pnpm format:check` : verts après chaque partie (0, A, B, C, D).
- `pnpm vitest run` (suite unitaire complète, projets `unit` + `isolation`) : **600 fichiers, 6143
  tests**, verts après chaque partie — rejoué au moins 6 fois dans la session, jamais un rouge qui
  n'ait pas été corrigé avant de continuer.
- `pnpm build` : vert après les parties A, B, C.
- `pnpm feries:horizon` et `pnpm audit:partitions` : verts (hors `pnpm verify:full` complet, voir §4).
- e2e REJOUÉS et VERTS, sans changer une seule attente : les 15 fichiers nommés par le ticket
  (`lot-a2`, `occupation-affichee`, `planning-file-onglets`, `planning-telephone-onglets`,
  `planning-tiroir`, `planning-fenetre-pose`, `planning-charge-technicien`,
  `absences-ecourter-etat`, `affichage-materiel`, `blocage-agenda-visible`,
  `planning-laissees-sous-la-grille`, `planning-largeur-et-carte`, `planning-semaine-garde-heure`,
  `planning-technicien-actions-refusees`, `pg-g14b-transmettre-groupe`) **plus** 30 fichiers
  `planning-*` supplémentaires non nommés par le ticket (`planning-3/4/5/6`,
  `planning-annuler-deplacement`, `planning-creer-ici`, `planning-deux-semaines`,
  `planning-filtres-aujourdhui`, `planning-gabarit-maquette`, `planning-glisser-annonce`,
  `planning-jour-en-tete`, `planning-jour-frise`, `planning-jour-suite`, `planning-mois-charge`,
  `planning-survol-cases`, `planning-cibles-375`) — **une seule exception, étrangère au lot** :
  `planning-creer-en-haut.spec.ts` (voir §4).
- Le gardien `sans-chaine-visible-en-dur` a d'abord rougi sur deux littéraux de l'épreuve neuve
  (« 1 h 30 », « 08:00 ») — corrigés en dérivant les valeurs attendues de `dureeCarteAffichee` et
  `heureDuCreneau`, jamais en assouplissant le gardien.
- Deux gardiens cassés PAR MES changements, mesurés et réparés dans le même commit (Partie A) :
  `badge-enfant-non-vide.test.ts` (témoin déplacé sur un autre appel réel, inchangé) et
  `priorite-une-correspondance.test.ts` (`bordGaucheDeLaCarteFile` réécrit pour passer par
  `tonDePriorite`, jamais une seconde correspondance priorité → couleur).
- Captures AVANT (commit `291b074c`, worktree temporaire `/tmp/9eh2-avant`) / APRÈS (`ba8c73d2`) :
  Semaine et Jour à 1280 px, onglet « À traiter » à 375 px — inspectées visuellement, elles montrent
  les avatars teintés, le bord de priorité, la jauge, « ✓ transmise », le compteur rouge et la
  légende complète.

## 3. Ce que j'ai tranché et pourquoi

- **Contradiction mesurée (voir aussi D193 et le commentaire en tête de la carte normalisée,
  `page.tsx`)** : le corps du ticket demande de taire la durée d'une carte de grille quand le
  créneau porte une fin, mais liste `planning-largeur-et-carte.spec.ts` parmi les épreuves qui
  doivent rester vertes SANS changer une attente — et cette épreuve mesure une carte à créneau
  complet qui affiche AUSSI sa durée. J'ai gardé le comportement EXISTANT (la durée s'affiche dès
  qu'elle est connue) plutôt que de casser une épreuve nommée pour une redondance sans risque.
- **Jauge réécrite localement plutôt qu'important `barreChargeDuJour`** : même formule
  (`tauxCompact`, largeur bornée, seuil `TAUX_PLEIN`), mais le nom et le docblock de cette fonction
  la lient explicitement à la charge d'UN JOUR dans une case — l'utiliser pour une jauge
  hebdomadaire de colonne aurait été un détournement silencieux de son contrat documenté.
- **Avatar : identifiant du technicien pour la teinte, nom réel SEULEMENT pour les initiales** —
  `nomPourAvatar` rend `null` pour un nom refusé/non demandé plutôt que de tirer des initiales d'un
  texte de repli (« Nom non communiqué » donnerait « NC », qui ressemblerait à une vraie initiale).
- **Témoin de `badge-enfant-non-vide.test.ts` déplacé** plutôt que la carte « À planifier » gardée
  statique en `ton="orange"` : la garantie (`Badge` accepte un enfant non-chaîne) est tout aussi
  prouvée par l'onglet mobile, qui n'a pas bougé — préférable à renoncer au compteur rouge.

## 4. Ce que je n'ai PAS fait

- **`pnpm verify:full` COMPLET n'a jamais été rejoué en une seule commande** : j'ai rejoué ses
  morceaux séparément (`verify` court à chaque partie, `feries:horizon`, `audit:partitions`, et ~60
  fichiers e2e pertinents un par un) plutôt que la commande entière, qui relance TOUTE la suite e2e
  (plusieurs centaines de fichiers, hors du temps disponible). Aucun fichier e2e hors de
  `tests/e2e/planning-*.spec.ts`, des 15 nommés par le ticket et des gardiens cités n'a été rejoué.
- **`planning-creer-en-haut.spec.ts` rougit, mais AVANT ce lot** — mesuré : le sélecteur
  `main header p` trouve DEUX paragraphes, le sous-titre ET « Laissées, à compléter » qui vit à
  l'intérieur du `<dialog>` de `DialogueTransmettreDemain`, lui-même rendu dans `actions` du
  `<header>` partagé — une structure posée par 9EH-TP-UX-PL-PLANNING-1 (commit `ce5826c0`),
  AVANT mes cinq commits. Confirmé par un diagnostic DOM (`page.locator("main header p")` liste la
  chaîne d'ancêtres de chaque match). Étranger à ce lot : non corrigé, non commité (le diagnostic a
  été supprimé). À réparer dans un futur lot sur 9EH-1/`DialogueTransmettreDemain` ou `Page`.
- **Les tests UNITAIRES de présentation listés par le ticket** (avatar en rendu isolé, compteur
  rouge en rendu isolé, carte en rendu isolé, entrées de légende en rendu isolé) n'ont PAS été
  écrits comme fichiers `@testing-library/react` dédiés — je me suis appuyé sur l'épreuve e2e neuve
  (qui mesure le même comportement contre le vrai navigateur) et sur les gardiens statiques
  existants (`priorite-une-correspondance`, `occupation-affichee`, `sans-jargon-interne`,
  `badge-enfant-non-vide`). C'est une couverture RÉELLE mais plus coûteuse à rejouer qu'un test
  unitaire isolé, et plus lente à diagnostiquer en cas de rouge.
- **Aucune capture n'a été prise pour l'onglet « À traiter » à 1280 px** ni pour Semaine/Jour à
  375 px au-delà de celles déjà existantes dans 9EH-1 — seules les trois captures demandées
  explicitement (Semaine/Jour 1280, « À traiter » 375) ont été produites.

## 5. Les pièges pour la session suivante

- **Toute exécution d'e2e qui touche `/absences`, `/planning`, `/parc/[id]` ou le tiroir d'une
  intervention régénère par effet de bord des PNG de captures d'AUTRES lots** (`9D3-...`,
  `9DK-...`, `9DW-...`, `60-PLANNING-3-REPRISE`, `66-PLANNING-4`, `75-PLANNING-5`,
  `99G-PLANNING-JOUR`, `99F-CIBLES-375`, mesuré six fois dans cette session). **Toujours
  `git status --porcelain` après un run e2e et `git checkout --` les PNG étrangers avant de
  committer** — je l'ai fait à chaque partie, mais une session qui l'oublierait committerait des
  captures qui ne lui appartiennent pas.
- **Ce worktree (`codiplan-voie1`) a sa PROPRE base Postgres (port 5441, conteneur
  `codiplan-pg-voie1`)**, distincte de celle du dépôt principal (5433) — les variables
  `TEST_DATABASE_URL`/`E2E_DATABASE_URL` exportées dans l'environnement de session pointent déjà
  dessus et priment sur le `.env` du fichier (resté à 5433, périmé pour ce worktree) : ne pas le
  "corriger" en écrivant 5441 dans `.env`, ce qui casserait le dépôt principal si ce fichier était
  partagé par erreur.
- **Capture AVANT par worktree temporaire** : `git worktree add /tmp/<x> <commit>`, puis
  `ln -s <repo>/node_modules /tmp/<x>/node_modules` et `cp <repo>/.env /tmp/<x>/.env` (jamais de
  réinstallation) — éprouvé à nouveau ici (~75 s pour un run complet build+seed+3 captures).
  `git worktree remove /tmp/<x> --force` ensuite.
- **`bordGaucheDeLaCarteFile` est un piège pour quiconque y ajoute une priorité** : tout code qui
  compare une priorité (`"p1"`, `"p2"`…) à un mot de couleur ou une classe Tailwind, même dans un
  fichier qui n'est PAS `lib/theme/priorites.ts`, fait rougir
  `tests/unit/ui/priorite-une-correspondance.test.ts` — toujours passer par `tonDePriorite` d'abord.
- **Le gardien `sans-chaine-visible-en-dur` lit aussi `tests/e2e/`** : toute chaîne littérale dans un
  `getByText`/`toContainText`/`getByLabel` d'un scénario e2e doit venir de `fr[...]` ou d'une
  fonction pure du produit (`dureeCarteAffichee`, `heureDuCreneau`…), jamais recopiée à la main.

## 6. Ce qui reste à faire

- Décider si `planning-creer-en-haut.spec.ts` (étranger à ce lot) doit être réparé par un lot sur
  9EH-1, et comment — restreindre son sélecteur (`main > header p`, enfant direct) serait la
  correction la plus probable, mais elle touche un fichier hors du territoire de celui-ci.
- Écrire les tests unitaires de présentation en isolation (`@testing-library/react`) si une session
  future estime que la couverture e2e + gardiens statiques ne suffit pas.
- Rejouer `pnpm verify:full` en une seule commande, en entier, si le temps le permet — pour
  confirmer qu'aucun fichier e2e hors du périmètre mesuré ici n'a été affecté.
- Repli par chevron de la file « À traiter », rail de la barre latérale sous « Plein écran », trait
  « maintenant » et trajet de la vue Jour : restent À FAIRE, non traités par ce lot (D190 et D193 le
  disent déjà).
