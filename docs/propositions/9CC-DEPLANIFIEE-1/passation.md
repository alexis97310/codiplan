# 9CC-DEPLANIFIEE-1 — passation

## OBLIGATOIRE AVANT TOUT LE RESTE — LES DEUX GESTES D'ALEXIS

Ce ticket porte une migration. Rien n'a été appliqué sur une base réelle —
uniquement sur les bases jetables des tests (`tests/isolation/setup/global.ts`,
`tests/e2e/setup/base.ts`, toutes deux `prisma migrate deploy`). Dans cet
ordre, et seulement après avoir lu cette passation :

1. **GitHub → Actions → « DB migrate & seed » → Run workflow** : `cible` =
   **production**, case « Purger les données de démonstration AVANT le seed »
   **DÉCOCHÉE**. Attendre le vert.
2. **Vercel → dernier déploiement de `main` → Redeploy.**

Tant que ces deux gestes n'ont pas eu lieu, `vercel.json` →
`scripts/portail-publication.sh` (verdict « bloquer ») **saute tous les
déploiements suivants de `main`**, tickets sans migration compris — le push
n'a migré que la base de démonstration (`.github/workflows/db-migrate.yml`,
borne 1).

La migration : `prisma/migrations/20260930120000_deplanifiee_1/`. Cinq
colonnes `NULLABLE`, sans contrainte, sans clé étrangère, sur `intervention` :
`deplanifiee_date`, `deplanifiee_creneau_debut`, `deplanifiee_creneau_fin`,
`deplanifiee_absent_id`, `deplanifiee_le`.

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

Constat 38 de l'audit d'ergonomie du 25/09/2026 : une intervention rendue à
la file « À planifier » par la pose d'une absence (RG-PLA-06) ne disait plus
rien de sa provenance — le planificateur ne pouvait pas distinguer une
intervention « jamais planifiée » d'une intervention « délogée par une
absence », ni retrouver son ancien jour et son ancien créneau sans aller
consulter le journal d'audit.

**Pour l'exploitation** : la carte de la file « À planifier » et la fiche de
l'intervention portent désormais, quand c'est le cas, la mention
« Déplanifiée — absence de *X* le *JJ/MM* » suivie de « Ancien créneau : *jeu.
25/09 · 08:00–09:00 (1 h)* ». Cette trace :

- est écrite par `declarerAbsence` (`lib/absences/depot.ts`), dans la MÊME
  transaction que la déplanification elle-même — jamais une seconde écriture ;
- **survit à la levée du blocage** (`leverLeBlocage` ne la touche pas) : le
  texte de `/absences` a été réécrit en conséquence, il disait « elles ne
  savent plus où elles étaient », il dit maintenant « elles gardent la
  mention de leur ancien créneau » ;
- **s'efface dès qu'une nouvelle date est reposée** (`deplacerIntervention`) :
  une carte replanifiée ne porte plus la mention, en base comme à l'écran.

Aucune règle de gestion n'est modifiée : le critère de déplanification
(`interventionsADeplanifier`), le verdict de pose (`jugerPose`) et la levée
sont inchangés — un fait déjà présent dans la transaction est simplement
recopié avant d'être effacé.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

Captures dans `docs/propositions/9CC-DEPLANIFIEE-1/captures/` (README à
côté, avec la recette pour les rejouer) :

- **AVANT** (`798a86c`, via `git worktree`) : la carte de la file ne porte
  ni puce ni ancien créneau ; la fiche affiche « À planifier », sans plus ;
  `/absences` affiche « elles ne savent plus où elles étaient ».
- **APRÈS** (`ef8b409`) : la carte porte « Déplanifiée — absence de
  *Technicien DEPL1-CAPTURE (9CC-DEPLANIFIEE-1)* le *08/12* » et « Ancien
  créneau : … » ; la fiche porte la même mention sous « Date planifiée » ;
  `/absences` affiche « elles gardent la mention de leur ancien créneau ».

Tests, dans l'ordre où ils ont été écrits AVANT le code (ils rougissaient
sur `main`) :

- `tests/unit/absences/periode.test.ts` (cas ajoutés) — `traceDeDeplanification` :
  les cinq valeurs recopiées, creneaux `null` quand la ligne n'en avait pas.
- `tests/isolation/absence.test.ts` (cas ajoutés) — pose : les cinq colonnes
  valent les valeurs d'avant, `technicien_id` gardé ; hors période : colonnes
  `NULL` ; levée : les colonnes **survivent**, `date_planifiee` reste `NULL` ;
  `deplacerIntervention` avec une date : les cinq colonnes repassent à
  `NULL` ; sans aucune date soumise : la trace reste intacte ; refus par
  `absence_declaree_pour_soi` (un technicien qui bloque l'agenda d'autrui) :
  **toute la transaction repart**, trace comprise — `date_planifiee` gardée,
  colonnes `NULL`.
- `tests/isolation/deplanifiee-cloisonnement.test.ts` (nouveau) : deux
  interventions du MÊME `technicien_id`, une par société — la pose sous
  SOCIETE_A ne touche que sa ligne ; témoin, la même pose sous SOCIETE_B
  touche la sienne.
- `tests/unit/interventions/deplanifiee-hors-champs-ligne-et-portail.test.ts`
  (nouveau, gardien statique) : aucune clé `deplanifiee_` dans `CHAMPS_LIGNE` ;
  aucun fichier de `app/(portail)/` ni `lib/portail/` ne nomme `deplanifiee_`.
- `tests/unit/interventions/mention-deplanifiee.test.ts` (nouveau) :
  `mentionDeplanifiee` — `null` sans trace ou hors `a_planifier`, le titre
  nomme l'absent et le JJ/MM, l'ancien créneau vient de `resumeDuCreneau`
  avec la durée gardée, et se réduit à « heure non fixée » sans créneau.
- `tests/e2e/deplanifiee-1.spec.ts` (nouveau, 5 scénarios en série, scène
  `DEPL1-` forgée et effacée) — pose via `/absences` ; la carte et la fiche
  portent la mention ; la levée (avec confirmation) la laisse en place ;
  la replanification (`POST .../deplacer`) l'efface en base et à l'écran.
- `tests/e2e/captures-9cc-deplanifiee.spec.ts` (nouveau) : capture seule,
  compile sur l'ancien code comme sur le nouveau (lit le dictionnaire par
  nom pour la clé neuve).

Vérification complète, dans cet ordre, EN UN appel chacune :

- `CI=1 pnpm verify` (format, typecheck, lint, `pnpm test` — 344 fichiers,
  3500 tests —, `pnpm test:isolation` — 137 fichiers, 1296 tests —, build de
  production) : **vert**.
- `CI=1 pnpm test:e2e` (toute la suite, un seul worker comme en CI) :
  **694 tests, 687 passés, 7 ignorés (inchangé), 0 échec** — ~27 minutes.

`pnpm feries:horizon` et `pnpm audit:partitions` n'ont **pas** été rejoués :
ils portent sur le calendrier des fériés et les partitions du journal
d'audit, hors du territoire de ce ticket, et exigent une base hébergée dont
je n'ai pas les accès dans cet environnement. Aucun fichier qu'ils lisent
n'a été touché.

## Ce que j'ai tranché et pourquoi

- **Cinq colonnes nullables sans clé étrangère, plutôt qu'une clé vers
  `absence` ou une relecture du journal d'audit.** Voir
  `docs/decisions/2026-09-30-deplanifiee-1.md` : la levée SUPPRIME la ligne
  `absence`, une clé `Restrict` interdirait la levée et une clé `SetNull`
  effacerait la trace au moment précis où le constat 38 la réclame.
- **Une écriture PAR LIGNE dans `declarerAbsence`, plutôt que l'`updateMany`
  d'origine.** `updateMany` ne peut poser qu'un seul `data` pour toutes les
  lignes visées ; il ne peut donc pas recopier, pour CHACUNE, SA PROPRE
  ancienne date et SON PROPRE ancien créneau. `Promise.all` sur une carte
  `id → trace`, dans la même transaction.
- **La condition d'effacement dans `deplacerIntervention` porte sur
  `saisie.date_planifiee !== null`, jamais sur l'ancienne date de la ligne.**
  C'est REPOSER une date qui efface la trace, pas la date qu'on quitte —
  cohérent avec la forme déjà en place pour `vue_technicien_le`
  (comparaison sur `undefined`/`null` selon ce qui est SOUMIS, jamais ce qui
  était AVANT).
- **`SELECTION_LIGNE_FILE_A_TRAITER` et le `select` propre de
  `lireFicheIntervention` portent les cinq colonnes — JAMAIS `CHAMPS_LIGNE`**,
  partagé par le bon imprimable et l'historique machine, qui n'ont rien à en
  faire. Tenu par un gardien statique plutôt que par une relecture.
- **`mentionDeplanifiee` est une fonction PURE** (`app/(back-office)/
  interventions/presentation.ts`), appelée à l'identique par la carte du
  planning et par la fiche — jamais deux compositions du même texte. Elle
  partage `jourMois` (extrait de `jourEtDateAbregee`) et appelle
  `resumeDuCreneau` pour l'ancien créneau : aucun second formateur.
- **« le JJ/MM » lit `deplanifiee_date` (le jour de l'absence), jamais
  `deplanifiee_le` (l'instant de la pose).** Ni la décision ni l'audit ne
  précisent lequel des deux afficher ; `deplanifiee_date` est TOUJOURS un
  jour de l'absence (`interventionsADeplanifier`) et c'est la lecture la
  plus naturelle du texte « absence de X le JJ/MM ». `deplanifiee_le` est
  écrit mais non affiché à ce jour — changer l'affichage ne demanderait
  aucune migration.
- **Les dates de `tests/e2e/deplanifiee-1.spec.ts` sont RELATIVES à
  aujourd'hui (`dansNJours`-like), pas un `2030-…` fixe.** Écrit d'abord
  avec une date fixe de 2030 (suivant le modèle d'`absences-3.spec.ts`),
  mesuré en échec : `/absences` ne LISTE (le tableau qui porte « Lever ») que
  ce qui tombe dans une fenêtre de −30/+90 jours (`fenetreAffichee`,
  `app/(back-office)/absences/page.tsx`) — une absence posée en 2030 rend
  bien la file et la fiche, mais aucune ligne « Lever » n'apparaît jamais.
  Voir l'en-tête du spec pour le détail de la mesure.
- **Commit 5 (« reposer au même jour et au même technicien ») NON FAIT.**
  Voir plus bas.

## Ce que je n'ai PAS fait

- **Le commit conditionnel 5** (`BoutonPoser` pré-rempli avec
  `deplanifiee_date`/`technicien_id` à la pose). Le ticket l'autorisait à
  être sauté si un point exigeait une règle, une route ou une prop nouvelles
  au-delà de deux props facultatives sur `BoutonPoser` — ce n'est PAS le cas
  ici (`jourInitial`/`technicienIdInitial` existent déjà sur
  `DemandeDOuverture`). Je l'ai sauté par PRUDENCE plutôt que par nécessité :
  le point ouvert IN-30 (planifier dans le passé accepté sans un mot) exige
  que le pré-remplissage compare `deplanifiee_date` au jour COURANT de
  l'AGENCE (I7, calendrier par établissement) avant de la proposer comme
  jour initial — une comparaison de fuseau que je n'ai pas eu le temps de
  faire éprouver correctement avant la fin de ce lot, et une erreur ici
  rendrait IN-30 plus facile à commettre plutôt que moins. **À reprendre** :
  la même mesure que `jourInitialCreneau` de la fiche (:404-407) suffirait
  probablement, appliquée au bouton du planning.
- **L'onglet « Déplanifiées »** que prévoit
  `docs/propositions/planning-gmao/specification.md:86`. Explicitement HORS
  de ce ticket (le point 3 de la décision d'Alexis ne le tranche pas).
- **`pnpm feries:horizon` et `pnpm audit:partitions`** — voir la section
  mesure ci-dessus.
- **Toute confirmation d'Alexis sur les points listés plus bas** — ce sont
  des hypothèses de rédaction, pas des mesures.

## Les pièges pour la session suivante

- **`node_modules` symlinké dans un `git worktree` porte un SEUL
  `@prisma/client` généré**, quel que soit le worktree actif — celui du
  dernier `prisma generate` exécuté. Pour photographier un ANCIEN commit
  déjà publié (captures oubliées), régénérer le client APRÈS avoir basculé
  de worktree, DANS LES DEUX SENS, sinon `P2022 column … does not exist`
  (le client, neuf, référence des colonnes que la base migrée par l'ancien
  code n'a pas). Voir `docs/propositions/9CC-DEPLANIFIEE-1/captures/README.md`
  pour la recette complète, éprouvée deux fois.
- **`/absences` ne liste que −30/+90 jours** (`fenetreAffichee`). Tout
  scénario e2e qui a besoin du bouton « Lever » (pas seulement de la pose)
  doit dater son blocage par rapport à AUJOURD'HUI, jamais par une date fixe
  lointaine — contrairement au planning et à la fiche, qui n'ont aucune
  borne de ce genre.
- **`test:isolation` et `test:e2e` visent la même base `codiplan_test`**
  (mémoire du poste) : ne pas lancer `test:isolation` pendant qu'un serveur
  e2e tourne encore, et ne pas s'étonner qu'un run isole efface la scène e2e.
- **Une intervention déplanifiée AVANT ce ticket n'a aucune trace** : le
  journal d'audit porte l'ancienne date (`valeurs_avant`), mais rien ne le
  relit pour cette mention — ces lignes redeviennent des cartes « à
  planifier » ordinaires, sans mention, et c'est un état permanent (pas un
  défaut à corriger, une conséquence assumée de la migration).

## Ce qui reste à faire

**À confirmer par Alexis** — hypothèses de rédaction posées faute de
décision explicite, aucune ne bloque ni le schéma ni la migration (changer
l'affichage ne coûte aucune migration) :

1. « le JJ/MM » = jour de l'absence (`deplanifiee_date`, ma lecture) ou jour
   où le blocage a été posé (`deplanifiee_le`, déjà écrit, non affiché) ?
2. Les trois libellés neufs (`intervention.deplanifiee.avant` = « Déplanifiée
   — absence de », `.le` = « le », `.ancien_creneau` = « Ancien créneau : »)
   et la réécriture de `absences.levee_explication`.
3. Le commit 5 (pré-remplissage du jour/technicien à la pose) : le faire, une
   fois la comparaison au jour courant de l'agence (IN-30) éprouvée.
4. L'onglet « Déplanifiées » (`specification.md:86`) : à décider séparément.
5. Le portail : les cinq colonnes suivent la RLS de ligne (forme « parc »),
   inchangée par cette migration ; aucun écran de portail ne lit
   `intervention` aujourd'hui. Le jour où il le ferait, ces colonnes
   resteraient hors de sa sélection tant que personne ne les y ajoute
   explicitement (D94) — noté, non tranché ici.
