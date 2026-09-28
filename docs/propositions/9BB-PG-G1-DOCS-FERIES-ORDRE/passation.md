# Passation — 9BB-PG-G1-DOCS-FERIES-ORDRE

Ticket regroupé, trois parties, faites dans l'ordre : PG-0-DOCS, PG-A1-FERIES-GRILLE,
PG-A2-ORDRE-TECHNICIENS. Six commits sur `main` local, aucun push.

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

**PG-0-DOCS.** Copie à l'identique de quatre documents externes au dépôt
(`audit-ergonomie-2026-09-27.md`, `specification.md`, `lots.md`,
`maquette-planning-gmao.html`) sous `docs/` et `docs/propositions/planning-gmao/`, et création de
`decisions-2026-09-27.md` qui fixe par écrit les réponses d'Alexis du 27/09 (QG-1 à QG-12,
PG-B5, PG-E1, l'ordre des lots à venir). Aucun code, aucune migration. Pour l'exploitation : les
décisions du 27/09 ne vivent plus seulement dans la conversation, elles sont dans le dépôt et
opposables aux tickets futurs du planning GMAO.

**PG-A1-FERIES-GRILLE.** La grille Semaine et la vue Jour du planning (`/planning`) décidaient
« ouvert / fermé » sur le seul jour de semaine (`joursOuverts`, `plages` hebdomadaires) — jamais
sur les fériés, les ponts ou les exceptions d'agence. En production, le jeudi 24/09/2026 (« Fête
de la citoyenneté », férié chômé du territoire NC) se lisait comme un jour OUVERT sur les deux
vues : la grille ne tramait pas sa colonne, la vue Jour annonçait « 4 techniciens · 64 créneaux
libres ». Un planificateur pouvait donc poser une intervention un jour férié sans le voir venir
(la pose, elle, refusait déjà — `estJourOuvre`/`chargerCalendrierAgence`, `pose.ts` — mais
seulement APRÈS coup).

Réparé en faisant lire à la grille et à la vue Jour le calendrier COMPLET de chaque agence
(`estJourOuvre` / `plagesDuJour`, `lib/calendar/ouverture.ts`, importés, jamais recopiés) au lieu
des seules plages hebdomadaires. `AgenceDeGrille` et `AgenceDeJournee` portent désormais un
`calendrier: Calendrier | null` plutôt que `joursOuverts`/`plages`+`calendrierConnu`. L'en-tête de
la grille Semaine annonce en plus « férié » (nouvelle clé `planning.jour_ferie`) sur un jour fermé
par un férié ou un pont alors que son jour de semaine est ordinairement travaillé, avec le libellé
du férié en `title` quand le calendrier le porte.

**PG-A2-ORDRE-TECHNICIENS.** La grille Semaine triait les colonnes par LIBELLÉ
(`comparerLignes`), la vue Jour par `technicienId` — un UUID (`comparerColonnes`). En production,
les quatre techniciens du semis n'apparaissaient pas dans le même ordre d'une vue à l'autre.
Réparé en import ant `comparerLignes` (désormais exportée par `grille.ts`) depuis `journee.ts`,
et en donnant à `construireJournee` un paramètre `libelleDe` additif (défaut `() => null`, donc
non-régressif pour un appelant qui ne le fournit pas). Pour l'exploitation : un planificateur qui
bascule Semaine ↔ Jour retrouve la même équipe dans le même ordre.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

Toutes les mesures ci-dessous sont des captures d'écran, prises sur le jeu de démonstration réel
(`pnpm db:seed`), jamais sur une scène forgée — le semis porte déjà les deux défauts.

- **PG-A1, vue Semaine du 21/09/2026, AVANT** (`docs/propositions/PG-A1-FERIES-GRILLE/captures/semaine-21-09-2026-avant-1280.png`) :
  la colonne « JEU 24 » n'est ni tramée ni annotée.
- **PG-A1, vue Semaine, APRÈS** (`...-apres-1280.png`) : la colonne « JEU 24 férié » est tramée
  comme les autres jours fermés.
- **PG-A1, vue Jour du 24/09/2026, AVANT** (`.../jour-24-09-2026-avant-1280.png`) : en-tête
  « 4 techniciens · 64 créneaux libres ».
- **PG-A1, vue Jour, APRÈS** (`.../jour-24-09-2026-apres-1280.png`) : « Aucune intervention posée
  ce jour-là », axe vide.
- **Mesuré et écrit dans le README des captures PG-A1** : à 375 px, `semaine-21-09-2026-avant-375.png`
  et `semaine-21-09-2026-apres-375.png` sont des fichiers IDENTIQUES (`md5sum` à l'appui). Sous
  `lg`, `ListeSemaine` ne montre aucune ligne pour un jour vide, fermé compris — le férié du
  24/09 ne porte aucune intervention active dans le semis, donc rien ne distingue les deux états
  à cette largeur pour la vue Semaine. Le défaut et sa correction ne sont observables qu'à 1280 px
  sur cette vue (la vue Jour, elle, diffère aux deux largeurs).
- **PG-A2, vue Jour du 21/09/2026 (jour ouvert), AVANT** (`docs/propositions/PG-A2-ORDRE-TECHNICIENS/captures/jour-21-09-2026-ordre-avant-1280.png`) :
  colonnes dans l'ordre D. Guérin, T. Wamytan, M. Poigoune, J. Lefèvre (ordre UUID).
- **PG-A2, vue Jour, APRÈS** (`...-apres-1280.png`) : colonnes dans l'ordre D. Guérin, J. Lefèvre,
  M. Poigoune, T. Wamytan — l'ordre alphabétique, identique à celui de la grille Semaine.

Contrôle de fin de session (une seule fois, après les trois parties) :
1. `CI=1 pnpm verify` → vert : format, typecheck, lint, 3081 tests unitaires (296 fichiers),
   1258 tests d'isolation (130 fichiers), build.
2. `pnpm feries:horizon && pnpm audit:partitions` → vert : horizon des fériés ≥ 12 mois sur les
   deux territoires (XA, ZZ) ; partitions du journal d'audit couvertes jusqu'à 2027-09, partition
   par défaut vide.
3. `CI=1 pnpm exec playwright test <specs neuves/modifiées + specs planning existantes + les
   trois specs toujours jouées>` → 83 passés, 3 ignorés (`skipped`, comportement inchangé par
   rapport à une exécution de référence sur `main` avant ce lot).

## Ce que j'ai tranché et pourquoi

- **`AgenceDeGrille`/`AgenceDeJournee` portent désormais un `Calendrier` complet plutôt que des
  plages hebdomadaires aplaties.** C'est un changement de forme, pas seulement de valeur : le
  ticket demande explicitement `estJourOuvre(calendrier de l'agence, jour)` « importé, jamais
  recopié » (CA-1) — recopier la logique de fériés/ponts à côté aurait été la même faute que
  celle qui a produit le défaut. Conséquence assumée : tous les tests unitaires existants qui
  construisaient un `AgenceDeGrille`/`AgenceDeJournee` littéral ont dû être réécrits pour
  construire un `Calendrier` de test — fait, aucun test n'a été affaibli ni désactivé.
- **`comparerLignes` généralisée à `{technicienId: string | null}`** plutôt que rester spécifique
  à `LigneDeGrille<T>` : c'est exactement ce qui permet à `journee.ts` de l'importer sans
  dépendre du type de la grille — les deux types (`LigneDeGrille`, `ColonneDeJournee`) partagent
  ce seul champ pertinent pour le tri.
- **`libelleDe` est un paramètre ADDITIF de `construireJournee`** (7ᵉ position, défaut
  `() => null`) plutôt qu'un remplacement du tri existant : un appelant qui ne le fournit pas
  retrouve le tri par identifiant d'avant (couvert par un test dédié). Seul `page.tsx` le fournit
  désormais, avec `(id) => nomSeul(id, annuaire)` — la même fonction que la grille Semaine.
- **La mention « férié » dans l'en-tête (PG-A1, point 4) se calcule dans `page.tsx`** (fonction
  privée `etatFerieDuJour`) plutôt que dans `grille.ts` : elle a besoin de connaître TOUTES les
  agences (pas seulement celles d'une ligne) pour décider si un jour est fermé PARTOUT alors
  qu'il est ordinairement travaillé — une notion propre à l'écran, pas au rangement.
- **Chaque commit de code est suivi d'un commit de captures séparé**, comme le fait déjà le dépôt
  (`AA-5-BANNIERE-PLANNING`) — pour que `git show --stat` sur le commit de code reste lisible
  (aucun binaire mêlé au diff qui compte).

## Ce que je n'ai PAS fait

- Je n'ai pas touché `pose.ts`, `occupation.ts`, ni `ouverture.ts` — le ticket l'interdisait
  explicitement, et ils avaient déjà raison.
- Je n'ai pas ajouté la mention « férié » à la vue Jour ni à la liste mobile de la vue Semaine
  (`ListeSemaine`) : le ticket ne le demandait que pour l'EN-TÊTE de la grille Semaine (point 4).
  La vue Jour dit déjà la même chose autrement (« Aucune intervention posée ce jour-là » sur un
  axe vide).
- Je n'ai pas retenté de rendre la mention « férié » visible à 375 px sur la vue Semaine : ce
  n'est pas un défaut de mon code, c'est une conséquence de la règle déjà en place dans
  `ListeSemaine` (« un jour vide n'a pas de ligne, le jour fermé compris ») appliquée à un jour
  qui, dans CE semis précis, ne porte aucune intervention active. Signalé, non corrigé — hors
  périmètre du ticket, qui ne demandait pas de revoir cette règle.
- Je n'ai pas lancé `pnpm verify:full` en tant que tel : la décision d'Alexis du 28/09 (en tête du
  ticket) remplace ce geste par le contrôle en trois étapes exécuté ci-dessus.
- Aucune migration, aucune ligne de semis, aucun prix — conforme aux interdits du ticket.

## Les pièges pour la session suivante

- **`AgenceDeGrille`/`AgenceDeJournee` ont changé de forme.** Si un futur lot construit ces types
  à la main (tests ou écran), il doit fournir un `calendrier: Calendrier | null` — plus de
  `joursOuverts`/`plages`/`calendrierConnu`. Une recherche de ces trois noms dans le dépôt les
  retrouvera tous s'il en reste.
- **La fenêtre de jours (`fenetreEnJours`) se calcule maintenant À L'INTÉRIEUR de la transaction**
  de `page.tsx`, avant le chargement des agences — parce que `chargerCalendrierAgence` a besoin
  de cette fenêtre pour charger les jours particuliers. Un futur lot qui déplacerait ce calcul
  hors de la transaction referait la même inversion de dépendance que celle réparée ici.
- **`comparerLignes` vit dans `grille.ts` et `journee.ts` l'importe** (`import { comparerLignes }
  from "./grille"`) : c'est un sens de dépendance choisi (la vue Jour dépend de la grille pour son
  tri, jamais l'inverse). Un futur changement qui ferait dépendre `grille.ts` de `journee.ts`
  créerait un cycle.
- **Le témoin `md5sum` des captures PG-A1 à 375 px** (fichiers avant/après identiques) n'est PAS
  une erreur de capture : c'est un fait du semis à cette date précise. Si le semis change et
  qu'une intervention finit par tomber le 24/09 dans une fenêtre future, ce témoin cessera d'être
  vrai — ne pas s'en étonner, ne pas le « corriger » en modifiant les captures.
- **Aucun test e2e existant ne fige l'ordre des techniciens par UUID** — vérifié en lisant les
  specs planning avant de committer ; si l'un d'eux avait fixé cet ordre, il aurait eu tort et
  aurait dû être corrigé pour cette seule raison (le ticket l'autorisait explicitement). Ce n'est
  pas arrivé : rien n'a eu besoin d'être touché hors du territoire déclaré.

## Ce qui reste à faire

- Le ticket regroupé s'arrête ici (trois parties, toutes livrées, dans l'ordre demandé). La suite
  du plan (PG-B, PG-C, DEPLANIFIEE-1, PG-D, PG-E…) est décrite dans
  `docs/propositions/planning-gmao/lots.md` et `decisions-2026-09-27.md`, tous deux livrés par
  PG-0-DOCS de ce même ticket.
- `docs/propositions/planning-gmao/specification.md` CA-3 à CA-12 restent à couvrir par les lots
  suivants (glisser-déposer, tiroir de détail, onglets à 375 px, etc.) — hors périmètre de
  9BB-PG-G1-DOCS-FERIES-ORDRE.
- La mention « férié » n'existe qu'à la grille Semaine ; si un futur ticket juge nécessaire de la
  porter aussi à la vue Jour ou à `ListeSemaine`, c'est une décision à prendre alors, pas une
  omission de ce lot-ci.
