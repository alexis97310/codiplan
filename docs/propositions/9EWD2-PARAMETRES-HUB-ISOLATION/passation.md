# 9EWD2-PARAMETRES-HUB-ISOLATION — passation

## Ce qui a été fait

1. **Isolation** — `tests/isolation/decomptes-parametrage-isolation.test.ts` (nouveau) pose,
   pour SOCIETE_A seulement, une agence, une habilitation expirée et un forfait de
   déplacement « sans condition » (`zone_geo = NULL`, couvre les six zones à la fois), et
   mesure `compterAgences`, `compterHabilitationsExpirees`,
   `compterZonesSansForfaitDeDeplacement` et `decomptesParametrage` avant/après, pour A ET
   pour B. B retombe exactement sur sa valeur d'avant dans les quatre scénarios : aucune
   fuite mesurée.

   En creusant les trois lectures nommées par la revue, les requêtes reposaient bien sur la
   RLS SEULE (`tx.agence.count()`, `tx.forfait.findMany`, et `tx.societe.findFirst` dans
   `decompteTauxHoraire`) — conforme à I1, mais sans le filtre explicite qu'exige CLAUDE.md
   §5.6. Les trois portent maintenant un `where societe_id` explicite
   (`lib/agences/depot.ts`, `lib/tarification/depot-forfaits.ts`,
   `lib/navigation/decomptes-parametrage.ts`), sans changer leur résultat (vérifié par
   l'épreuve ci-dessus, qui compare avant/après).

2. **Texte « Trajets »** — la description disait « l'établissement » au lieu de « l'agence »
   (M:4384). Le mot imposé ne pouvant pas s'écrire en dur dans `lib/i18n/fr.ts` (gardien
   D5/D47), `PorteParametrage` porte désormais un `resumeCompose` (même mécanique que
   `titreCompose` pour « Agences »), qui compose la phrase avec `motDansUnePhrase("agence")`.
   Les deux clés de repli jamais affichées (« Horaires d'ouverture », « …l'établissement… »)
   sont retirées : les champs `titre`/`resume` qui ne servent jamais réutilisent la clé déjà
   affichée par la MÊME porte plutôt que d'en porter une dédiée qui resterait du texte mort.
   `tests/unit/navigation/portes-textes-maquette.test.ts` (nouveau) fige chaque titre et
   description du hub contre la maquette, y compris le rendu composé — sauf « Tarifs » (taux
   horaire/forfaits), où la maquette dessine une seule carte fusionnée (PA-08) alors que le
   hub livré en garde deux : écart assumé, hors territoire de ce lot (9EWE).

3. **E2E** — `tests/e2e/9ewd-parametres-hub-maquette.spec.ts` :
   - la pastille grise de « Prestations » est désormais vérifiée comme EXISTANTE (un
     `<span class="bg-app-gris-fond">`), pas seulement comme « non-lien » ;
   - une épreuve dédiée mesure `scrollWidth ≤ 375` pour l'administrateur ET pour RM (RM
     n'était pas mesuré jusqu'ici).
   - le cas « À jour » (porte Données à compléter, zéro point) n'a PAS été ajouté — voir
     « Points ouverts ».

4. **Captures** — `capturer` ne prend plus la capture en `fullPage: true` (viewport seul).
   Les quatre captures (`hub-admin-{375,1280}`, `hub-rm-{375,1280}`) sont régénérées dans
   `docs/propositions/9EWD2-PARAMETRES-HUB-ISOLATION/captures/` ; celles du dossier 9EWD
   d'origine n'ont pas été touchées.

## Points ouverts

- **Le cas « À jour » reste non couvert en e2e.** Les quatre compteurs de
  `pointsDonneesACompleter` portent sur TOUTE la société, sans filtre « cette épreuve
  seulement », et la scène e2e est partagée entre fichiers joués en parallèle
  (`fullyParallel: true`, `playwright.config.ts`). `tests/e2e/indicateurs-donnees.spec.ts`
  documente déjà cette contrainte dans son en-tête et s'y plie en n'affirmant jamais de total
  absolu, seulement qu'une ligne posée par l'épreuve apparaît dans la liste. Forcer un zéro
  global pour la porte « Données à compléter » romprait cette même discipline (et resterait
  fragile sous parallélisme). Une épreuve fiable demanderait soit une société e2e dédiée et
  propre de toute donnée à compléter (hors territoire : la scène `tests/e2e/setup/scene.ts`
  n'est pas dans ce lot), soit de jouer ce scénario précis en série contre une base jetable
  (mécanique absente aujourd'hui de la suite e2e). Le cas est déjà couvert — avec un espion —
  par `tests/unit/navigation/decomptes-parametrage.test.ts`.

## Vérification finale

Consignée dans le commit de reprise qui suit celui-ci (15 dernières lignes de
`CI=1 pnpm verify:full`, `git rev-parse --short HEAD`).
