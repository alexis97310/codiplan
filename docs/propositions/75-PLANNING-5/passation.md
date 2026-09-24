# 75-PLANNING-5 — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

La vue jour du planning (`/planning?vue=jour&jour=...`) ne dit plus « libre »
à qui porte une visite datée sans heure. `lib/interventions/journee.ts` gagne
un type `ACaler` (`{ nombre, minutesConnues, sansDuree }`), calculé depuis
`sansHeure` — jamais depuis `creneauxLibres`, qui reste inchangé à dessein :
on n'invente toujours pas où caser une visite sans heure, on mesure
seulement ce qu'elle pèse, À CÔTÉ. `ColonneDeJournee.aCaler` porte ce compte
par personne, `Journee.aCaler` en porte la somme sur la journée.

Côté écran, deux endroits le disent, tous les deux SEULEMENT sur la vue
jour :

- le résumé en tête de grille, qui passait de « 16 créneaux libres · pas de
  30 min » à « 16 créneaux libres · pas de 30 min · 2 visites à caler
  (3 h 30) » (singulier accordé par `decompte()`, comme les clés voisines
  du dictionnaire) ; si une partie des visites n'a pas de durée saisie, le
  parenthésage l'ajoute : « … (3 h 30 + 1 sans durée) » ;
- une pastille orange « N à caler » dans l'en-tête de chaque colonne
  concernée, à côté de la pastille violette « Agenda bloqué » — orange et
  non violet à dessein : un agenda bloqué REFUSE le dépôt, une visite à
  caler l'attend seulement, et les confondre aurait fait perdre la
  distinction que `classeDeCellule` tient déjà entre les deux.

Pour le chef d'atelier : une journée qui porte déjà 3 h de travail non calé
ne se lit plus comme une journée vide.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- **AVANT** (lecture du code, `lib/interventions/journee.ts:296` et
  `app/(back-office)/planning/page.tsx:1114`, mesuré sur `main` 87d49b1 le
  25/09/2026 à 07h40, cité dans le ticket) : `creneauxLibres` comptait les
  cellules `libre` de l'axe SEULEMENT ; les visites de `sansHeure` n'en
  retiraient aucune, et le résumé de la journée ne les mentionnait nulle
  part.
- **APRÈS**, mesuré par deux preuves :
  - `tests/unit/interventions/journee-a-caler.test.ts` (3 cas, sur les
    horaires RÉELS de Ducos — Nouméa 07:30–11:30 / 13:00–17:00, 30 min de
    pas) : 0 visite sans heure → `aCaler = {0,0,0}` ; 2 visites (120 min +
    90 min) → `{2, 210, 0}` ; 1 visite sans durée → `{1, 0, 1}`,
    `minutesConnues` à 0 dans ce dernier cas. `creneauxLibres` vaut 16 dans
    les trois scénarios — inchangé par `aCaler`, comme prévu.
  - `tests/e2e/planning-5.spec.ts` (scène `PLA5-` forgée, une intervention
    `planifiee`, datée, sans créneau, 180 min) contre la vraie base : le
    résumé de la vue jour affiche « 1 visite à caler (3 h 00) », et
    l'en-tête de la colonne du technicien porte la pastille « 1 à caler ».
    Capture jointe (`docs/propositions/75-PLANNING-5/captures/`).

## Ce que j'ai tranché et pourquoi

- **`creneauxLibres` reste inchangé.** Le ticket le dit explicitement (« on
  n'invente pas où placer la visite ») ; `aCaler` est une mesure séparée,
  jamais une correction du compte de trous.
- **La couleur orange pour la pastille « à caler ».** La palette de jetons
  disponible (`app/globals.css`) n'a que bleu (occupé), gris (hors
  ouverture), violet (agenda bloqué) et orange. Le violet était exclu — il
  dit « le dépôt sera refusé », ce qui n'est pas le cas ici. L'orange reste
  le seul jeton d'alerte disponible sans en inventer un nouveau (§2 : ajouter
  une dépendance ou une valeur est une décision, pas un réflexe) ; il porte
  déjà « suspendue » sur les blocs de STATUT, mais la pastille de colonne
  n'est jamais lue comme un statut d'intervention — même logique que la
  pastille « Agenda bloqué », qui réemploie le violet de `/absences`. Ce
  choix n'a pas été demandé au ticket ; à signaler si la maquette (D124/D125)
  venait à en décider autrement.
- **« sans durée » et « à caler » restent invariants au pluriel** (pas de clé
  `_un`/`s` séparée) : ces deux locutions ne s'accordent pas en nombre en
  français, à la différence de « visite(s) à caler ».
- **Le jour de la scène e2e est choisi à J+140**, ajusté au besoin pour ne
  jamais tomber un dimanche (Ducos ferme le dimanche) — loin des décalages
  déjà pris par les autres fichiers e2e du dépôt (5, 10, 11, 21, 35, 49, 63,
  91), pour éviter toute collision sous `fullyParallel`.

## Ce que je n'ai PAS fait

- Aucune migration, aucune ligne de semis — interdit par le ticket, et
  inutile : tout se calcule depuis les colonnes déjà lues.
- Je n'ai pas touché la vue semaine, ni `statistiques.tsx` (la charge), ni le
  glisser-déposer, ni `app/api/`, ni `prisma/` — hors territoire.
- Je n'ai pas ajouté de jeton de couleur nouveau au thème — voir « Ce que j'ai
  tranché » ci-dessus sur le choix de l'orange existant.
- Je n'ai pas vérifié le rendu de la pastille et du résumé sur un cas à
  PLUSIEURS techniciens « à caler » en même temps sur la même journée (au-delà
  du calcul unitaire déjà prouvé par le test unitaire des 2 visites) : aucune
  preuve e2e ne porte sur deux colonnes « à caler » côte à côte. Non vérifié,
  donc écrit comme tel.

## Les pièges pour la session suivante

- `ACaler` est exporté depuis `lib/interventions/journee.ts` ; tout futur
  écran qui voudrait le même résumé (ex. un futur tableau de bord) doit
  réutiliser `resumeACaler`/`PastilleACaler` de `page.tsx` plutôt que
  recopier le calcul — même règle que pour `decompte()`, une seconde
  implémentation d'un même critère diverge en silence.
- Le format de la parenthèse (`resumeACaler`, `page.tsx`) gère trois cas :
  durée connue seule, durée connue + sans durée, sans durée seule (durée
  connue à 0). Le troisième cas n'est PAS couvert par une preuve — seul le
  test unitaire de `journee.ts` prouve que `minutesConnues` reste à 0 quand
  `sansDuree` porte tout ; le rendu textuel exact de ce cas-là (« (1 sans
  durée) » sans nombre d'heures devant) n'a été relu qu'à la lecture du code,
  jamais capturé.

## Ce qui reste à faire

- Rien d'identifié dans le périmètre du ticket. Le cas à deux colonnes « à
  caler » simultanées (voir ci-dessus) et le cas « sans durée seule » restent
  des angles morts de preuve, pas des défauts connus.
