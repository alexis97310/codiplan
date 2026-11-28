# 9L64-GARDIEN-AUCUN-MONTANT-TERRAIN — passation

## Ce qui a été fait

La règle (« le technicien ne voit aucun montant ») était déjà tenue, écran
par écran, par une dizaine de tickets antérieurs (9F4H5B, 9F4H1, 9I8B,
9K22…) — chacun avec son propre commentaire disant ce qu'il exclut. Aucune
fuite n'a été trouvée en relisant la surface servie au terrain (`app/
(mobile)`, `app/(sans-session)/terrain-hors-reseau`, `app/api/terrain`,
`components/terrain`, `lib/terrain`) : les projections existantes
(`projeterLigneJournee`, `FicheJSON`/`LigneJSON` de `/api/terrain/
instantane`) sont déjà des listes FERMÉES de champs, et aucune des neuf
routes d'action du terrain ne rend davantage que `{ok, motif, alerte}`. Ce
lot ajoute trois gardiens qui tiennent la règle EN GÉNÉRAL, pour qu'une
régression future rougisse sans qu'il faille se souvenir d'où chercher.

**Aucun écran n'a été touché ni créé** — ce lot n'ajoute que des épreuves et
deux clés de dictionnaire pour leurs fixtures. Pas de capture, donc (la
consigne du 13/11 porte sur un écran touché ou créé).

### Point 1 — gardien statique

`tests/unit/gardiens/aucun-montant-terrain.test.ts` : balaie la surface
terrain, commentaires retirés (`sansCommentaires`, L0-08), et rougit si l'un
des champs monétaires mesurés sur `prisma/schema.prisma` et sur la forme
JSON de `valorisation_figee` (`montant_ht`, `montant_mineur`/`montantMineur`,
`valorisation_figee`/`valorisationFigee`,
`majoration_hors_ouverture_pct`/`majorationHorsOuverturePct`, `tauxHoraire`,
`mainDoeuvre`, `forfaitDeplacement`, `totalHT`) s'écrit en CODE sur cette
surface. Un témoin prouve que chaque nom vit réellement dans le dépôt (pas
inventé) ; deux épreuves sur fixture prouvent que le détecteur rougit sur un
usage réel et reste vert sur une mention en commentaire.

Ce que ce gardien NE prouve PAS, et c'est écrit dans son docblock : qu'un
champ sélectionné par `lireFicheIntervention` (partagé avec le back-office)
n'atteint jamais cette surface par un autre chemin que son propre nom — les
points 2 et 3 couvrent cette moitié-là pour les deux routes les plus
exposées.

### Point 2 — isolation, `/api/terrain/instantane`

`tests/isolation/terrain-instantane-route.test.ts` : une fonction neuve,
`creerClotureeAvecMontant`, pose un segment fermé puis suit les TROIS
transitions que la matrice D8 exige (`affectee` → `en_cours` → `terminee` →
`cloturee`) jusqu'à écrire `montant_ht`, `devise_code` et
`valorisation_figee` en SQL brut — jamais via le dépôt applicatif, pour
qu'un défaut du dépôt fasse rougir ce test plutôt que de le rendre muet
(même doctrine que `FORFAITS_SCENE`). La route est rejouée pour de vrai
(`GET` importé directement) et sa réponse JSON parcourue récursivement par
`cleInterdite` : aucune des clés monétaires n'y apparaît, sur une ligne dont
le montant réel vaut 14 000 XPF.

### Point 3 — e2e, de bout en bout

`tests/e2e/9l64-gardien-aucun-montant-terrain.spec.ts`, 375 px : Ma
journée → la fiche → signature → Terminer → Profil, texte rendu de chaque
écran cherché pour `XPF|F CFP|€`. La scène pose un segment déjà FERMÉ de deux
heures sur une intervention `en_cours` du technicien de l'épreuve — le taux
horaire de 7 000 XPF semé par `tests/e2e/setup/scene.ts` pour toute
l'exécution compose alors une valorisation RÉELLE et non nulle
(14 000 XPF) dès que `temps_valide_min > 0`, sans qu'aucune clôture ne soit
nécessaire : l'absence de montant à l'écran ne tient donc pas d'un zéro qui
n'aurait rien prouvé. Deux clés neuves dans `lib/i18n/fr.ts`
(`9l64.e2e.client`, `9l64.e2e.site`, `9l64.e2e.contact_nom`) — **retouche
pendant l'écriture** : la première valeur de `9l64.e2e.site` contenait le
mot « site » en toutes lettres, et le gardien du vocabulaire imposé (D5/D47)
a rougi dessus, hors de tout sens métier ; corrigé en « Atelier » (même
évitement que `9l04h.e2e.site`, « Atelier Nord »).

## Épreuves jouées

`pnpm test` (6153 tests), `pnpm test:isolation` (2613 tests), l'e2e neuf
seul, puis `CI=1 pnpm verify` au complet (format, typecheck, lint, test,
isolation, build) — tous verts. `verify:full` (avec `test:e2e` complet) est
laissé à la file de nuit, conformément à la consigne de ce lot.

## Ce qui reste ouvert

- Les routes d'action du terrain (`rapport`, `prestations`, `signature`,
  `terminer`, `checklist`, `photos*`, `suspendre`, `compteur`) sont déjà
  prouvées narrow par `tests/unit/interventions/terrain-routes-json.test.ts`
  (`toStrictEqual`) — ce lot n'y a rien ajouté, une régression y romprait déjà
  l'égalité stricte.
- Le gardien statique ne trace pas le FLOT de données depuis
  `lireFicheIntervention` : s'il devait un jour couvrir une troisième route
  aussi richement projetée que `/api/terrain/instantane`, une isolation
  dédiée (sur le patron du point 2) resterait la bonne réponse, pas une
  extension du détecteur statique.
