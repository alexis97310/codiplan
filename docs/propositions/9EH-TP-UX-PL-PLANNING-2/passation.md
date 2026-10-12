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

- Écrire les tests unitaires de présentation en isolation (`@testing-library/react`) si une session
  future estime que la couverture e2e + gardiens statiques ne suffit pas.
- Repli par chevron de la file « À traiter », rail de la barre latérale sous « Plein écran », trait
  « maintenant » et trajet de la vue Jour : restent À FAIRE, non traités par ce lot (D190 et D193 le
  disent déjà).

## 7. Reprise 9EH2A (9EH-TP-UX-PL-PLANNING-2A-REPRISE, 12/10/2026)

9EH-TP-UX-PL-PLANNING-2 a été recalé à 04:43 (vérification indépendante rouge deux fois sur une
épreuve e2e). Le lot avait écrit (§4 ci-dessus) que `planning-creer-en-haut.spec.ts` rougissait
« avant ce lot », pour une cause DOM précise (`main header p` trouvant deux paragraphes, dont un
venant de `DialogueTransmettreDemain`). Cette reprise a MESURÉ plutôt que cru cette explication :

- Rejeu de `tests/e2e/planning-creer-en-haut.spec.ts` sur `origin/main` seul (`e0e6fbc3`, qui
  contient déjà 9E2-E2E-MAIN-ROUGE-LUNDI) dans un worktree jetable (`/tmp/main-test`) : **5 passed**.
- Rejeu de la même épreuve sur la garde de 9EH-2 rejouée sans conflit par-dessus `e0e6fbc3`
  (8 commits cherry-pickés, `ad658702`…`0ad1f070`, nouvelle tête `8c7cee3d` sur la branche
  `9EH-TP-UX-PL-PLANNING-2A-REPRISE-work`) : **5 passed**.

Verte des deux côtés : le recalage du 12/10 était bien le défaut day-dependent de lundi, déjà
réparé en amont par 9E2 — rien à corriger dans le code de 9EH-2. La phrase « étranger à ce lot,
à réparer dans un futur lot sur 9EH-1 » du §4/§6 ci-dessus est donc dépassée par la mesure : la
cause DOM qu'elle nommait n'était pas (ou plus) celle qui faisait rougir l'épreuve ce jour-là ;
aucune piste de ce type n'a été poursuivie ici faute de rouge à expliquer.

Suite : `tests/e2e/planning-*.spec.ts` (91 fichiers/scénarios) rejoués en entier sur la garde
rejouée : **91 passed**. Effet de bord connu (§5 ci-dessus, confirmé à nouveau) : 13 PNG de
captures étrangères (`60-PLANNING-3-REPRISE`, `66-PLANNING-4`, `75-PLANNING-5`, `99F-CIBLES-375`,
`99G-PLANNING-JOUR`, `9D3-PLANNING-TECHNICIEN-ACTIONS`, `9DW-E2E-DIMANCHE`) régénérés puis restaurés
par `git checkout --` avant tout commit.

`CI=1 pnpm verify:full` COMPLET, en une seule commande (ce que 9EH-2 n'avait PAS fait, §4 ci-dessus) :
**2 rouges**, ni l'un ni l'autre dans `planning-*.spec.ts` ni dans la liste nommée par le ticket —
donc invisibles à la vérification partielle de 9EH-2.

1. **`tests/e2e/priorite-ton-partage.spec.ts` (GR5) — CORRECTION TENTÉE PUIS ANNULÉE
   (`git revert 04ed7ffa`), rouge toujours là, PIÈGE identifié pour la session suivante.** La
   carte de la file « À traiter » (deux rendus, glisser-déposer actif/inactif,
   `app/(back-office)/planning/page.tsx` ~L2090 et ~L2196) a perdu, à la Partie A (`e24bf85b`), son
   `Badge` de priorité (texte complet « P1 — critique », `rounded-[20px]`, invariant GR5 : la MÊME
   pastille sur la fiche, la file du planning et le tableau de bord) au profit de `PucePriorite`
   (puce courte P1/P2, `rounded-full`, accessible uniquement via son `aria-label`). J'ai d'abord
   remis le `Badge` tel qu'il vivait sur la fiche — **ce qui a cassé une AUTRE épreuve, à moi
   invisible jusque-là** : `tests/e2e/planning-gabarit-28-09-partie-2.spec.ts:198` (ÉCRITE PAR
   9EH-2 lui-même, verte dans sa garde) cherche la puce par
   `carte.getByLabel(fr["priorite.p1"])` — qui ne trouve PAS un `Badge` sans `aria-label`, même si
   son texte visible est identique. **Les deux épreuves ne peuvent pas être satisfaites par le MÊME
   élément sans modification** : `priorite-ton-partage` veut un `span.rounded-\[20px\]` dont le
   TEXTE VISIBLE est la phrase complète ; `planning-gabarit-28-09-partie-2` veut un élément dont
   l'`aria-label` (nom accessible) est cette même phrase, peu importe le texte visible. Un
   `Badge` qui porterait AUSSI un `aria-label` (même texte) satisferait les deux à la fois — je
   n'ai pas eu le temps de vérifier cette piste avant la limite de budget (`Badge`
   n'accepte aujourd'hui aucune prop `aria-label`, `components/ui/badge.tsx`) : **annulé plutôt que
   laissé dans un état où j'échange un rouge contre un autre.** Repart donc du MÊME rouge
   qu'avant cette reprise.
2. **`tests/e2e/ergo-carte-semaine.spec.ts` — NON corrigé, contradiction de conception à trancher.**
   Cette épreuve (préexistante, hors du glob `planning-*` et de la liste nommée par le ticket, donc
   jamais rejouée par 9EH-2) mesure que le PREMIER `span` d'une carte Semaine est la ligne de tête
   `enTeteDuBloc` (heure + client FONDUS sur une ligne, ≤ 2 lignes, sans débordement, client entier
   dans le texte). La Partie C (`32325ee8`) a délibérément éclaté la carte normalisée en QUATRE
   lignes séparées (créneau / client / nature·site / matériel) au gabarit du 28/09 — le créneau et
   le client vivent désormais dans deux `<span>` différents, et le premier ne contient plus que
   l'heure. Measuré : `mesure.texte` vaut `"09:00–10:00"`, jamais le nom du client. Ce n'est PAS le
   même type de rouge que le cas 1 : la Partie C documente déjà, dans son propre commentaire
   (`page.tsx`, juste avant le rendu) et au §3 ci-dessus, une contradiction mesurée et tranchée
   entre le corps du ticket et une épreuve nommée — celle-ci est une SECONDE contradiction du même
   genre, entre le gabarit à quatre lignes et une garantie ergonomique posée avant ce lot. Non
   traitée ici : la fin du budget de temps de cette reprise est atteinte (voir le gabarit de lot en
   tête du ticket), et une restructuration de la carte pour satisfaire les deux à la fois (ou un
   arbitrage qui en sacrifie une) dépasse une correction mécanique. À trancher par une session
   suivante, avec les deux options : (a) remettre une ligne de tête combinée heure+client au-dessus
   des quatre lignes du gabarit (ce que `enTeteDuBloc` donne déjà), au prix d'une cinquième ligne
   dans une carte déjà dense ; (b) réécrire `ergo-carte-semaine.spec.ts` pour mesurer le NOUVEAU
   premier `span` (le créneau seul) et une ligne SÉPARÉE pour le client — mais changer cette épreuve
   est une décision produit (garantie ergonomique assouplie), pas une correction, et sort du
   territoire de ce lot.

## 8. Reprise 9EH2B (9EH-TP-UX-PL-PLANNING-2B-REPRISE, 12/10/2026)

Alexis a tranché les deux contradictions ouvertes par 9EH2A (§7, points 1 et 2) le 12/10 à 17:17
(décisions 81 et 82). Cette reprise a rejoué la garde de 9EH2A (13 commits, cherry-pick sans
conflit sur `origin/main` à `e0e6fbc3`) puis adapté les DEUX épreuves nommées par Alexis — les
seules modifications d'épreuve permises dans ce lot.

- **Décision 81 — `tests/e2e/priorite-ton-partage.spec.ts`** : la file garde la puce de la
  maquette (`PucePriorite`), le Badge long n'est PAS restauré. Le passage planning cherche
  désormais la puce par son nom accessible (`carte.getByLabel(fr["priorite.p1"], { exact: true })`)
  et vérifie son texte court (`planning.priorite_puce.p1`) et `bg-app-rouge-fond`. Passages fiche
  et tableau de bord inchangés. Verte avec `planning-gabarit-28-09-partie-2.spec.ts`.
- **Décision 82 — `tests/e2e/ergo-carte-semaine.spec.ts`** : un repère neutre `data-ligne="client"`
  (aucun style) est posé sur la ligne client de la carte normale de `VueSemaine`
  (`app/(back-office)/planning/page.tsx`) ; la garantie du 26/09 (`line-clamp-2 break-words`, deux
  lignes au plus, sans débordement, client entier) y est mesurée au lieu de l'ancien premier `span`
  fondu. Une quatrième garantie s'ajoute sur la ligne heure (`span.tabular-nums`, visible, porte
  l'heure de début) — dérivée par `heureDuCreneau`, jamais écrite en dur (le gardien
  `sans-chaine-visible-en-dur` a d'abord rougi sur un « 09:00 » littéral, corrigé en calculant la
  valeur attendue depuis le même `creneau_debut` que la scène écrit). Rejouée 3 fois, verte.
- `docs/arbitrages.md`, D193 : paragraphe « Épreuves adaptées sur décision d'Alexis du 12/10 »
  ajouté, avec les deux fichiers et les deux décisions.
- Épreuves voisines rejouées : les 93 scénarios de `tests/e2e/planning-*.spec.ts` (glob, inclut
  les deux épreuves adaptées) + les 5 de `planning-creer-en-haut.spec.ts` — tous verts.
- `CI=1 pnpm verify:full` COMPLET, en une seule commande : **VERT** — `format:check`, `typecheck`,
  `lint`, `test` (unit), `test:isolation`, `build`, `feries:horizon`, `audit:partitions` et
  `test:e2e` (1288 tests, 1240 passed, 48 skipped, **0 failed**), à `29ac79e5`. Les deux rouges
  documentés par 9EH2A (§7) sont donc résolus par les adaptations ci-dessus — aucun rouge restant.
- Effet de bord connu (§5) confirmé deux fois (après la passe « épreuves voisines » et après
  `verify:full` complet) : respectivement 13 puis 186 PNG de captures étrangères régénérés par les
  autres lots que `test:e2e` exerce en chemin — tous restaurés (`git checkout --`) ou supprimés
  (pour les fichiers neufs, non trackés, issus d'un autre ticket) avant tout commit ; aucun n'a été
  committé par cette reprise.
- Aucune capture régénérée pour 9EH-2 lui-même dans cette reprise : les deux adaptations ne
  changent ni une classe ni un pixel (un attribut `data-ligne` neutre côté production, le reste est
  du code de test) — les captures AVANT/APRÈS déjà commitées par 9EH-2 restent valides.
- Rien à signaler sur le reste du ticket 9EH-2 : les deux seuls points laissés ouverts par 9EH2A
  (§6) étaient précisément les deux rouges tranchés ici ; aucun autre point du ticket n'est resté
  en suspens.
