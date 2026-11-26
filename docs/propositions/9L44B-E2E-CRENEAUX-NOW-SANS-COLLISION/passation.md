# 9L44B-E2E-CRENEAUX-NOW-SANS-COLLISION — passation

## Le constat, mesuré précisément

`intervention_sans_chevauchement_technicien` (9L19, migration
`20261122200000_gardes_chevauchement_segments_9l19`) est la **seule**
contrainte `EXCLUDE USING gist` de tout le schéma (vérifié : `grep -rn
"EXCLUDE USING gist" prisma/migrations/*/migration.sql` ne rend qu'elle).
Elle ne porte que sur `intervention.creneau_debut`/`creneau_fin`, et ignore
toute ligne `annulee`. C'est la clé qui a cadré tout ce lot : une insertion
ne risque le `23P01` reproduit par le pilote QUE si elle écrit ces deux
colonnes sur `intervention` pour un technicien qui porte déjà un créneau
recouvrant — jamais sur `segment_travail` ou `intervention_pause`, quelle
que soit leur propre ancre `now()`.

`garnier@codima.test` (`technicienDucos`) porte, par
`INTERVENTIONS_DEMONSTRATION` (`prisma/seed-data.ts`, posé par `pnpm db:seed`
dans TOUTE base e2e), un créneau FIXE différent chaque jour de la semaine,
reconduit sur plusieurs semaines d'horizon — confirmé par requête directe sur
`codiplan_test` le 26/11/2026 : des lignes occupées jusqu'au 19/01/2027.
Toute scène qui choisit une heure pour ce même technicien **sans relire ce
qu'il tient déjà** retombe dessus selon le jour et l'heure où la suite
tourne.

Reproduit en direct à deux reprises pendant ce lot (15:09 et 15:18 NC le
26/11/2026, dans la fenêtre que le pilote avait déjà mesurée) : l'INSERT
« planifiée, datée d'hier » de `fiche-entete-bandeau-frise.spec.ts`, en
`now() - interval '1 day'` littéral.

## La voie choisie — (b), un utilitaire unique, aucun technicien déplacé

`creneauLibreDepuis(client, societeId, technicienId, debutSouhaite, dureeMin,
pasMin = 30)` (`tests/e2e/setup/creneaux.ts`) relit les créneaux déjà posés
pour ce technicien (même filtre que la contrainte : hors `annulee`, non
nuls) et recule par pas de 30 minutes depuis le départ souhaité jusqu'à
trouver `dureeMin` minutes totalement libres. Elle ne devine rien : elle
VÉRIFIE contre la base au moment de l'exécution, quel que soit le jour.
Appelée juste avant l'INSERT qu'elle sert — jamais en avance sur d'autres
lignes que la MÊME scène s'apprête à poser pour ce même technicien,
puisqu'elle ne voit que ce qui est déjà commit en base.

Voie (a) — déplacer les créneaux fixes du semis vers un autre technicien —
écartée : `tests/e2e/setup/scene.ts` (`redimensionnable`, `obstacle`, les
quatre lignes du `rang`) coordonne déjà, par commentaire, avec les créneaux
FIXES du semis sur CE MÊME technicien ; déplacer le semis aurait demandé de
retracer toutes ces coordinations, pour un gain équivalent à (b) et un
risque de régression bien plus large. `technicienKone` porte sa propre
famille de scènes partagées — l'y déplacer aurait seulement changé le nom du
technicien à surveiller, pas supprimé le besoin de `creneauLibreDepuis`.

## Fichiers touchés, et pourquoi chacun l'est (ou ne l'est pas)

**Risque réel confirmé — corrigés :**

- `fiche-entete-bandeau-frise.spec.ts` — le `now() - interval '1 day'`
  reproduit par le pilote (INTERVENTION_EN_RETARD), **et** les quatre
  `creneauUtc(cleAujourdhui, H)` du même fichier (EN_COURS, SUSPENDUE,
  TERMINEE_REFUSEE, TERMINEE_PRETE) — même famille de risque : une heure UTC
  fixée sur « aujourd'hui » sans relire ce que le semis y pose déjà selon le
  jour de la semaine.
- Neuf fichiers supplémentaires, trouvés par `grep -rl creneauUtc
  tests/e2e/*.spec.ts` puis croisés avec `technicienDucos` : tous les neuf
  combinent les deux et posent `creneau_debut`/`creneau_fin` sur
  `intervention` —
  `9dd-pg-g14c-terrain-transmises.spec.ts`,
  `captures-9dd-pg-g14c-terrain-transmises.spec.ts`,
  `captures-9db-retouches-10.spec.ts`,
  `captures-9ct-retouches-5.spec.ts`,
  `captures-9f4h5b-journee-sans-montant.spec.ts`,
  `captures-9f4h5-terrain-vivant.spec.ts`,
  `9f2-terrain-jours-maquette.spec.ts`,
  `captures-9cp-pg-g14b-transmettre-groupe.spec.ts`,
  `captures-9eq-fiche-onglets.spec.ts`.
  Chacun bascule sur `creneauLibreDepuis`, calculée juste avant chaque
  INSERT concerné (pour voir aussi les lignes que la MÊME scène vient de
  poser dans le même `beforeAll`). Aucune mesure lue par une assertion
  (durée affichée, temps de segment, « en retard ») ne dépend de l'HEURE
  exacte du créneau — seulement de son absence de conflit — vérifié fichier
  par fichier avant de toucher à chacun.

**Risque vérifié absent — non touchés :**

La « douzaine » recensée par la passation de 9L41E (`fiche-cloturer.spec.ts`,
`bon-intervention.spec.ts`, `9l15-temps-valide-technicien.spec.ts`,
`9en-captures.spec.ts`, `captures-9ai-gr14-libelles-saisie.spec.ts`,
`zz-captures-9h1-rapport-valide.spec.ts`, `captures-gr14-duree-unique.spec.ts`,
`captures-9j08a-historique-des-etats.spec.ts`,
`captures-9j08b-portail-temps-par-etat.spec.ts`,
`captures-9l17-bon-valorisation-figee.spec.ts`, `9exb-equipe-techniciens.spec.ts`,
`captures-9k07-suites-a-donner-relances.spec.ts`, entre autres) ancre bien un
`now() - interval 'X minutes'`, mais **jamais sur `intervention.creneau_
debut`/`creneau_fin`** — toujours sur `segment_travail.debut`/`fin`,
`intervention_pause.debut`/`fin`, ou `intervention.date_planifiee`/
`cloturee_le`/`qualifiee_le` (colonnes hors de la contrainte d'exclusion).
Vérifié fichier par fichier (`grep -n "INSERT INTO" <fichier> -A10` croisé
avec les colonnes réellement listées) : aucun ne porte le risque que ce
ticket ferme. Les toucher sans besoin aurait été la ligne changée pour
rien que la constitution interdit (§ organisation du code).

`tests/e2e/setup/scene.ts` (la scène partagée elle-même — `redimensionnable`,
`obstacle`, le `rang` des quatre lignes) n'est pas non plus touché : ses
heures sont déjà choisies à la main pour éviter les collisions connues
(commentaires datés dans plusieurs des fichiers ci-dessus), c'est le fichier
de RÉFÉRENCE que les corrections respectent, pas une source du défaut.

## Épreuve de robustesse (point 4)

- **Playwright n'a aucun mécanisme pour avancer l'horloge SERVEUR** (déjà
  mesuré par 9L41E) — `page.clock` n'avance que le navigateur. L'épreuve
  « dans la fenêtre » s'est faite EN CONDITIONS RÉELLES : les deux lots de
  tests ciblés ont tourné à 15:09, 15:18, 15:48 et 16:48 NC le 26/11/2026,
  c'est-à-dire précisément dans ou à la limite de la fenêtre 13h-16h NC que
  le pilote avait mesurée — tous verts, y compris `fiche-entete-bandeau-
  frise.spec.ts` qui aurait échoué avant ce lot à ces heures-là.
- **Épreuve « hors fenêtre » par appel direct** de `creneauLibreDepuis`
  (script `tsx` jetable, retiré avant de rendre la main) : un appel ancré
  SUR un créneau connu occupé très loin dans le futur (un vendredi
  décembre, hors de toute fenêtre 13h-16h NC) rend un créneau prouvé libre
  par relecture de la base — la fonction ne dépend d'aucune heure
  particulière, seulement de ce qu'elle lit.
- Tous les fichiers touchés, rejoués ENSEMBLE sous `CI=1` (1 worker, comme
  `verify:full` — `playwright.config.ts: workers: process.env.CI ? 1 :
  undefined`) : **69 passed**.
  *Rejoués une première fois en parallèle local (sans `CI=1`) : deux échecs
  sont apparus — une collision PRÉEXISTANTE et indépendante de ce lot entre
  `captures-9f4h5-terrain-vivant.spec.ts` et `captures-9f4h5b-journee-sans-
  montant.spec.ts`, qui choisissaient déjà la MÊME heure UTC 15 pour la
  largeur 1280 (présente avant ce lot, sous l'ancien `creneauUtc`
  déterministe aussi) ; et une violation « strict mode » Playwright entre
  deux scènes 9DD partageant un libellé de site, qui ne se manifeste que
  sous plusieurs workers. Les deux sont hors du périmètre que CI exécute
  réellement (`workers: 1`) et hors de ce que ce ticket devait fermer.*
- `pnpm test` — **540 fichiers, 6095 tests, passed** (rejoué deux fois).
- `pnpm test:isolation` — **267 fichiers, 2578 tests, passed** (rejoué deux
  fois).
- `pnpm verify` (format:check + typecheck + lint + test + test:isolation +
  build) — **vert de bout en bout**, un seul passage complet.
- La suite e2e ENTIÈRE, en un seul passage sous `CI=1` : tentée, **non
  aboutie dans le budget de ce lot** — `pnpm playwright test` seul dépasse
  déjà 30 minutes sous 1 worker avec 1877 tests (mesuré par un lot
  précédent, confirmé ici par un arrêt au bout de 45 minutes sans sortie
  complète). Rejouer l'intégralité de la suite est précisément ce que
  `verify:full` fait chaque nuit en CI (`pnpm verify:full` est explicitement
  laissé à la file par ce ticket) ; dans le temps restant de ce lot, les 69
  tests directement concernés par le correctif, plus `pnpm verify` complet,
  donnent un signal direct et suffisant sur ce que ce lot change — la nuit
  suivante referme la boucle sur le reste de la suite.
  **Point d'hygiène mesuré en cours de route** : cette tentative a modifié
  des centaines de captures suivies dans `docs/propositions/**/captures`
  (chaque spec `captures-*`/`zz-captures-*` écrit si son interrupteur
  d'environnement est absent — faux, sauf que plusieurs écrivent par défaut
  sans interrupteur) avant d'être interrompue ; tout a été annulé
  (`git checkout --` sur les fichiers suivis, suppression des nouveaux
  fichiers non suivis) avant de committer quoi que ce soit de ce lot.

## Aucune règle métier changée, aucune entrée `docs/arbitrages.md`

Le correctif ne touche que des fichiers de test et un utilitaire de scène —
aucune migration, aucun schéma, aucune politique RLS, aucun invariant.
Même conclusion que 9L41E pour la même raison : rien à arbitrer.

## État à l'arrivée

Quatre commits (`creneauLibreDepuis` + `fiche-entete-bandeau-frise`, les neuf
fichiers `creneauUtc`, le format prettier, puis cette passation). Arbre
propre avant chaque commit. Travail mené en `HEAD` détaché (le worktree de
cette session l'était déjà au démarrage) — pas de push, pas de branche
créée.
