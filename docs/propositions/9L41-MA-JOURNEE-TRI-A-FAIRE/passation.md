# 9L41-MA-JOURNEE-TRI-A-FAIRE — passation

Ligne M8 de la feuille de route (audit du 10/11/2026) : « Ma journée : tri par priorité puis par date, carte
« À faire maintenant » ». **Aucune migration.**

## Mesure (point 1)

`app/(mobile)/terrain/page.tsx` appelle `repartirJourneeTechnicien` (`lib/interventions/journee-technicien.ts`),
qui répartissait « aujourd'hui », « demain » et « sans date » **dans l'ordre reçu de `listerPlanning`** —
`date_planifiee asc, creneau_debut asc, priorite asc, cree_le asc, id asc` : le créneau décidait avant la
priorité, jamais l'inverse. Aucune carte « à faire maintenant » n'existait, ni en ligne ni dans la coquille hors
réseau (`components/terrain/consultation-hors-reseau.tsx`, qui lit le même `repartirJourneeTechnicien` via
`app/api/terrain/instantane/route.ts`).

## Ce qui a été livré

1. **Le tri** — `lib/terrain/tri-journee.ts` (nouveau), fonction pure `trierParPrioriteEtDate` : une ligne
   EN_COURS ou SUSPENDUE passe toujours en tête, puis priorité croissante (p1 avant p4), puis créneau croissant
   (sans créneau en dernier) ; stable à égalité totale. Branchée dans `repartirJourneeTechnicien` sur les
   sections « aujourd'hui », « demain » et « sans date ». **« En retard » garde son tri par date seule** (D210,
   9F2-TERRAIN-JOURS-MAQUETTE) : ces lignes sont filtrées `affectee` uniquement par l'appelant (jamais
   en_cours/suspendue), donc la tête de tri par statut n'y change jamais rien — intentionnellement non touché.
2. **La carte « à faire maintenant »** — `prochaineAFaire` (même fichier) : la première ligne du tri parmi
   enRetard + aujourd'hui + sans date (jamais demain ni les jours suivants, qui ne sont pas « maintenant ») qui
   n'est pas déjà `terminee`/`cloturee`. Rendue en haut de `ListeJournee`
   (`components/terrain/liste-journee.tsx`) et de la coquille hors réseau, avec le même lien que la carte
   normale (« son action principale existante », aucune action nouvelle).

   **Décision prise sans arrêt** (maquette « 01-journee » absente du dépôt, confirmé par l'audit 9K25A) :
   - Le périmètre retenu pour « maintenant » est *en retard + aujourd'hui + sans date*. « Demain » et « les jours
     suivants » en sont exclus : ce ne sont pas des tâches pour MAINTENANT.
   - **La carte reste un APERÇU délibérément plus pauvre** que la carte complète (`CarteApercu` : priorité,
     créneau, client, statut — ni site, ni machines, ni panne), et **la ligne choisie reste affichée UNE SECONDE
     FOIS**, à sa place normale, plus bas. Mesuré en cours de route : reprendre la carte `Carte` TELLE QUELLE
     (site compris) aurait donné à son texte de site une **seconde occurrence** sur l'écran — piège pour
     `tests/e2e/9f2-terrain-jours-maquette.spec.ts`, qui localise une carte par le nom de site unique de SA scène
     et mesure sa position verticale à l'intérieur de sa section. L'aperçu exclut donc exactement ce que ces
     épreuves cherchent (voir point 3).
   - Si Alexis veut la carte complète (site compris) ou veut RETIRER la ligne de sa section normale une fois
     épinglée, ce sont deux changements séparés, à rouvrir avec lui — non tranchés ici par prudence (surface de
     régression plus large, voir point 3).

## Épreuves (point 2 et 3)

- `tests/unit/terrain/tri-journee.test.ts` (nouveau) — `trierParPrioriteEtDate` et `prochaineAFaire`, toutes les
  règles isolées de la base.
- `tests/unit/interventions/journee-technicien.test.ts` — deux scénarios ajoutés : priorité avant créneau,
  EN_COURS/SUSPENDUE en tête, dans la répartition réelle.
- `tests/e2e/9l41-ma-journee-tri-a-faire.spec.ts` (nouveau) — **technicien dédié, sans la moindre ligne
  partagée** (même recette que la scène « vide » de 9F2 : `prochaineAFaire` choisit un gagnant parmi TOUT ce
  qu'un technicien voit, et sur le compte partagé ce gagnant dépendrait de ce que d'autres fichiers posent en
  même temps). Trois interventions du jour ; preuve géométrique (position verticale des cartes) que : la priorité
  l'emporte sur le créneau, une suspendue de priorité basse passe malgré tout en tête, et la carte « à faire
  maintenant » montre la gagnante — sans jamais répéter son nom de site.
- **Deux épreuves existantes rendues précises** (ni affaiblies, ni leur preuve changée) :
  `tests/e2e/offline/9f4h1-consultation.spec.ts` et `tests/e2e/offline/9f4h4-ouverture-a-froid.spec.ts`
  cherchaient un lien par **substring de `href`**, sans `.first()` — depuis que la fiche choisie dynamiquement
  par ces scénarios (sur le technicien PARTAGÉ) peut aussi être la gagnante de « à faire maintenant », ce
  substring matche parfois deux éléments (violation de mode strict Playwright). Les deux mènent à la même fiche ;
  `.first()` lève la violation sans affaiblir ce que l'épreuve prouve.
- `tests/e2e/9f2-terrain-jours-maquette.spec.ts`, `9f4h5b-ma-journee-375.spec.ts`,
  `9f4h5-nouvelle-intervention.spec.ts`, `9dd-pg-g14c-terrain-transmises.spec.ts`,
  `9di-tp-ter1-journee-fiche.spec.ts`, `captures-9f4h5b-journee-sans-montant.spec.ts` rejoués, verts — confirment
  que l'aperçu plus pauvre (point 1) ne casse aucune mesure existante de « Ma journée ».
  `9f4h5-nouvelle-intervention.spec.ts` a échoué UNE FOIS en l'exécutant à plusieurs fichiers à la fois (conflit
  de créneau avec un autre fichier sur le technicien partagé, `23P01`) — rejoué seul, vert : collision de
  harnais préexistante entre fichiers qui partagent la convention « 20:00–21:00 » (voir le docblock de
  `tests/e2e/setup/creneaux.ts`), **non causée par ce lot**.
- `pnpm test`, `pnpm test:isolation` passent (voir aussi la porte de sortie ci-dessous).

## `docs/captures/` — non rejoué

Même limite que les lots précédents : `docs/captures/README.md` exige un geste humain irréductible (choisir un
mot de passe via un lien de premier accès). `pnpm captures:etat` rapporte un dépôt déjà en avance sur la dernière
prise (plusieurs lots avant celui-ci), donc une dérive préexistante, élargie par celui-ci (`lib/i18n/fr.ts`,
`components/terrain/liste-journee.tsx`, `components/terrain/consultation-hors-reseau.tsx` s'ajoutent à la liste).

## Captures de ce lot

`docs/propositions/9L41-MA-JOURNEE-TRI-A-FAIRE/captures/` — AVANT (code d'avant ce lot, obtenu par un `git
checkout` temporaire du commit précédent, jamais un stash puisque ce lot commite au fil de l'eau) et APRÈS, à
375 px :
- `ma-journee-{AVANT,}-375.png` — la carte « À faire maintenant » apparaît en tête, montrant une suspendue déjà
  visible plus bas sous « Aujourd'hui » (même ligne, deux endroits).

## Feuille de route

M8 passé à « livré » dans `lib/feuille-de-route/contenu.ts`, section « Livré depuis le 31/10 » ; retiré de
« Application technicien — audit du 10/11/2026 » (deux éléments y restent : P6, m8/m10b/m13).
`tests/unit/feuille-de-route/contenu.test.ts` mis à jour en conséquence.

## Porte de sortie

`pnpm test`, `pnpm test:isolation`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check` passent tous, rejoués en
avant-plan. `CI=1 pnpm verify` à rejouer avant de rendre la main (voir la suite de la session).
