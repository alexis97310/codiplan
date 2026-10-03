# 9DW-E2E-DIMANCHE — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

`tests/e2e/planning-laissees-sous-la-grille.spec.ts` ouvrait `/planning?vue=jour`
**sans** `jour=` : la page montre alors le jour COURANT de la société
(`jourDemande` dans `app/(back-office)/planning/page.tsx`). Le dimanche, aucune
agence n'ouvre (`prisma/seed-data.ts`), la vue jour rend son état vide (un
`<p>`, aucun `<ul>` enfant direct de `[data-maquette-bloc="vue-jour"]`), et
l'assertion sur la légende (`legende.toBeVisible()`) échoue — **la suite e2e
rougit chaque dimanche, heure de Nouméa, et bloque toute publication de la
file ce jour-là**.

Le spec ouvre désormais un jour EXPLICITE : un mardi de la scène
(`jourDeLaScene(reperes, MARDI)`), passé à `prochainJourOuvert` (même oracle
que `tests/e2e/planning-filtres-aujourdhui.spec.ts`) pour sauter un éventuel
jour férié de la scène qui tomberait sur ce mardi-là. Aucune assertion n'a
changé — ni la légende, ni la liste des laissées, ni le lien vers
l'intervention forgée.

Pour l'exploitation : zéro changement de comportement produit. C'est une
correction de test seule.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

**AVANT** — mesure DIRECTE, pas une hypothèse : la session tourne un dimanche
réel (`2026-10-04`, confirmé par `date -d 2026-10-04 +%A` → `Sunday`, et par
l'horloge système du poste, `02:xx` UTC+11 au moment de la mesure). Un spec
temporaire jetable (`tests/e2e/zz-temp-9dw-avant.spec.ts`, jamais committé,
supprimé après usage) a rejoué exactement le geste fautif —
`page.goto("/planning?vue=jour")` sans `jour=` — et capturé
`docs/propositions/9DW-E2E-DIMANCHE/captures/vue-jour-dimanche-avant.png` :
« dimanche 4/10/2026 », « Aucune intervention posée ce jour-là », aucune
légende visible. C'est l'état qui, dans le spec réel (avant correction), ferait
échouer `await expect(legende).toBeVisible()`.

**APRÈS** — `tests/e2e/planning-laissees-sous-la-grille.spec.ts` corrigé,
rejoué LE MÊME DIMANCHE : 1 passed. Capture
`docs/propositions/9DW-E2E-DIMANCHE/captures/vue-jour-legende-et-laissees.png` —
« mardi 29/09/2026 », légende visible au-dessus de la grille. `jourDeLaScene`
retombe sur un mardi déjà passé par rapport à « aujourd'hui » (dimanche) parce
que `lundi` vient de `lundiDeLaSemaine(aujourdhui)` — la semaine ISO courante,
dont le mardi est antérieur à un dimanche de la même semaine ; sans incidence,
`chargerCalendrierAgence`/`prochainJourOuvert` n'exigent pas un jour futur.

**La ligne forgée reste à J-5 du jour RÉEL, vérifié** — lu le code de
`lib/interventions/depot.ts` (`listerPlanifieesATransmettre`) et de
`app/(back-office)/planning/page.tsx` (lignes ~654-721) : les laissées
(`laisseesToutes`) se calculent depuis `debutDuJourSociete`, dérivé de
`maintenant(cadre.fuseau)` — l'horloge réelle —, jamais de `jourAffiche`
(`?jour=`). La capture APRÈS le confirme : le lien vers l'intervention forgée
(datée dimanche-5) est bien visible sous la grille d'un mardi affiché.

`planning-jour-en-tete.spec.ts` rejoué en même temps que le spec corrigé :
3 passed (ses deux tests + celui de ce fichier) — aucune régression croisée.

`CI=1 pnpm verify:full` rejoué en entier, LE MÊME DIMANCHE (début ~02:16
UTC+11) : `format:check`, `typecheck`, `lint`, `test` (3905 tests),
`test:isolation`, `build`, `feries:horizon`, `audit:partitions` et `test:e2e`
(805 passed, 7 skipped, 0 failed, 32.5 min) tous verts. C'est la preuve
DIRECTE demandée par le ticket : pas besoin de forcer un `jour=` sur un
dimanche artificiel, le dimanche était réel.

## Ce que j'ai tranché et pourquoi

- **Un mardi de la scène, pas « le prochain jour ouvert depuis aujourd'hui »
  tout court** : suivre exactement le motif déjà établi par
  `planning-jour-en-tete.spec.ts` plutôt qu'inventer un troisième motif.
  `prochainJourOuvert` protège contre le seul risque résiduel — un jour férié
  de la scène qui tomberait sur ce mardi précis.
- **Pas de décalage de semaines** (contrairement à `planning-jour-en-tete.spec.ts`
  qui décale de 16 semaines) : ce spec ne pose pas de fixture sur le jour
  affiché — sa seule fixture (l'intervention « date passée ») vit à J-5 de
  l'horloge réelle, indépendamment du jour affiché — donc aucun risque de
  collision avec les fixtures de `SCENE.*` posées sur le MARDI de base.
- **Dossier de captures changé** : `docs/propositions/9CTA-REPRISE-9CT/captures/`
  → `docs/propositions/9DW-E2E-DIMANCHE/captures/`, pour ne pas écraser la
  capture historique du lot d'origine (demande explicite du ticket). Le spec
  garde le même nom de fichier (`vue-jour-legende-et-laissees.png`), seul le
  dossier change.
- **Capture AVANT produite par un spec jetable, non committé** : la seule
  façon d'obtenir un screenshot de l'état bogué sans modifier (même
  temporairement) les assertions du spec réel — une assertion qui échoue
  interrompt le test avant d'atteindre l'appel à `capturer()`.

## Ce que je n'ai PAS fait

- Aucune migration, aucune ligne de semis, aucun prix, aucune logique produit
  changée — conforme aux interdits du ticket.
- Je n'ai pas élargi la garde à un décalage de semaines (`SEMAINES_DE_DECALAGE`)
  comme dans `planning-jour-en-tete.spec.ts` : inutile ici, voir ci-dessus.
- Je n'ai pas ajouté de nouveau fichier de capture permanent au dépôt au-delà
  des deux PNG de ce lot (AVANT/APRÈS) : le spec temporaire de capture AVANT a
  été supprimé après usage, comme demandé par les interdits du lot (aucun code
  produit modifié, aucun fichier de test parasite laissé).

## Les pièges pour la session suivante

- **`CI=1 pnpm verify:full` écrit des captures PARTOUT** : l'exécution complète
  de `test:e2e` régénère les PNG de dizaines de specs `captures-*.spec.ts`
  étrangers au lot (constaté : ~90 fichiers modifiés, 2 fichiers étrangers
  nouveaux dans `docs/propositions/9BV-TP-A5b-DATES-REPRISE/captures/` et
  `47-AVERTISSEMENTS-1/captures/`). **Toujours `git status --porcelain` après
  un `verify:full` et restaurer (`git checkout --`) tout fichier étranger au
  lot avant de committer** — j'ai dû le faire ici, et j'ai par erreur
  supprimé au passage tout un dossier TRACKÉ (`9BV-TP-A5b-DATES-REPRISE/`) en
  croyant qu'il était entièrement untracked (en réalité seuls deux fichiers à
  l'intérieur, au nom légèrement différent des fichiers commités, l'étaient) —
  `git checkout -- <dossier>` l'a restauré. **Lire `git status --porcelain`
  ligne par ligne, jamais un dossier entier sur la foi d'une seule ligne `??`
  côtoyant d'autres lignes du même dossier.**
- Le dimanche réel du poste a servi de preuve directe pour ce lot — une
  session qui reprendrait ce ticket un autre jour de la semaine devra forcer
  `jour=` sur un dimanche calculé (`jourSuivant` jusqu'au prochain dimanche)
  pour revérifier, ou se fier à cette passation.
- Tous les AUTRES `page.goto("/planning")` du dépôt (listés par le grep du
  ticket) atterrissent sur la vue PAR DÉFAUT, « semaine »
  (`vueDepuisParametre` dans `lib/interventions/affichage.ts:68-74` retombe
  sur `"semaine"` hors `jour`/`deux_semaines`/`mois`) — la grille semaine part
  toujours du lundi ISO et affiche 7 colonnes fixes, jamais un état « vide »
  dépendant du jour réel. **Aucun autre spec e2e n'a ce défaut** : seule la vue
  JOUR sans `jour=` y est exposée, et ce fichier était le seul à la viser sans
  date explicite.

## Ce qui reste à faire

Rien d'identifié pour ce ticket : le seul spec fautif est corrigé, vérifié
directement un dimanche réel, et aucun autre spec e2e du dépôt n'ouvre la vue
jour sans date explicite.
