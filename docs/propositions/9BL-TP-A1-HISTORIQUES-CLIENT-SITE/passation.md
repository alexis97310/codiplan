# 9BL-TP-A1-HISTORIQUES-CLIENT-SITE — passation

## Ce que j'ai changé, et ce que ça change pour l'exploitation

- **L'ordre de l'historique des fiches site et client est inversé** (décision d'Alexis du 28/09/2026, ~20h10 NC, audit du 28/09 — CS29, CS9) : les interventions **ouvertes sans date** (« à planifier ») passent désormais **en tête**, rangées par urgence (`priorite`, p1 d'abord) puis ancienneté (`cree_le` croissant) ; **ensuite** tout le reste, par `date_planifiee` décroissante. Un directeur d'exploitation ouvrant une fiche voit d'abord ce qui reste à traiter, avant l'historique déjà réalisé.
  - `comparerHistorique` (`lib/interventions/depot.ts`) écrit cette règle **une seule fois** ; `dernieresInterventionsDuSite`/`dernieresInterventionsDuClient` la tiennent en **deux requêtes SQL** (le groupe de tête, puis le reste) plutôt qu'un `ORDER BY` nu, qui remplirait la borne/la page de lignes SANS DATE FERMÉES (annulée, clôturée, terminée) aussi bien que d'ouvertes — PostgreSQL met tout `NULL` en tête.
  - La pagination de la fiche client traverse la frontière tête/reste par un `count` du groupe de tête, sans doublon ni trou.
- **La tuile « Dernière intervention »** (fiches site et client) garde l'**ancien** ordre (la dernière DATÉE) via deux nouvelles fonctions dédiées, `derniereInterventionDuSite`/`derniereInterventionDuClient` — sinon elle aurait montré l'ouverte la plus urgente, pas la dernière intervention réelle.
- **Les tuiles « Équipements » et « Interventions ouvertes »** des fiches site/client deviennent des liens : « Équipements » vers `/parc?site=`/`?client=` (déjà accepté par `/parc`), « Interventions ouvertes » vers l'ancre `#historique-site`/`#historique-client` de la même fiche (page 1 pour le client).
- **`/interventions/nouvelle?client=<id>`** : la recherche de site se borne à ce client (`ChampSiteEtMachines` reçoit un `clientFiltre`, transmis à `/api/recherche/sites?client=`, déjà accepté avant ce lot) ; si ce client n'a qu'un seul site actif, il arrive présélectionné. Le bouton « + Intervention » de la fiche client passe désormais ce paramètre.
- Le texte sous le tableau de la fiche site (`sites.fiche.interventions_borne_suffixe`) dit le nouvel ordre.
- `comparerHistorique` est exempté du gardien R3-12 (`scripts/lib/chemins-de-depot.ts`) : aucun écran ne l'appelle (la règle est tenue en SQL), seuls les tests le confrontent au résultat des requêtes.

## Ce que j'ai mesuré (AVANT/APRÈS)

- **Captures** (`docs/propositions/9BL-TP-A1-HISTORIQUES-CLIENT-SITE/captures/`) : scène à 4 interventions (2 ouvertes p1/p4 sans date, 2 datées 2026/2020). AVANT (commit `cb9daf8`) : ordre `2026 → 2020 → p4 → p1` (date décroissante, file d'attente en bas, `id` décroissant au sein de la file). APRÈS : `p1 → p4 → 2026 → 2020` — confirmé visuellement sur les trois écrans, à 1280 et 375 px.
- **Tests** :
  - Unitaire (`pnpm test`) : 3146 tests, 302 fichiers — tous verts, dont le nouveau `tests/unit/interventions/comparer-historique.test.ts` (8 scénarios sur le comparateur seul) et le gardien R3-12 (`chemins-de-depot.test.ts`), réconcilié par l'exemption ajoutée.
  - Isolation (`pnpm test:isolation`) : 1281 tests, 134 fichiers — tous verts, dont les deux fichiers inversés (`historique-site-borne.test.ts`, `historique-client-pagination.test.ts`) et le nouveau `historique-priorite-tpa1.test.ts` (scène TPA1- à soi : deux priorités différentes, une fermée sans date qui n'entre jamais en tête).
  - e2e ciblé (les 6 specs les plus proches du territoire, dont le nouveau `creation-depuis-client-tpa1.spec.ts`) : 6/6 verts.
  - e2e complet (`pnpm test:e2e`, 161 fichiers) : **559 passés, 3 ignorés, 6 échoués**. Voir « Le conflit non résolu » ci-dessous — aucun des 6 échecs ne touche le territoire de ce lot.
  - `pnpm feries:horizon` et `pnpm audit:partitions` : verts.
  - `pnpm verify` (format:check, typecheck, lint, test, test:isolation, build) : **vert de bout en bout**, y compris le build de production (70 pages générées).

## Ce que j'ai tranché, et pourquoi

- **Deux requêtes SQL plutôt qu'un tri en mémoire** : Prisma ne sait pas exprimer « ouvertes sans date d'abord » comme un `ORDER BY` à expression conditionnelle sans SQL brut (interdit hors migrations, §2). La forme retenue — une requête pour le groupe de tête, une pour le reste, concaténées — tient la borne et la pagination CÔTÉ BASE, comme avant ce lot, sans jamais lire plus de lignes qu'affiché.
- **`comparerHistorique` exporté mais jamais appelé en production** : plutôt que de dupliquer la règle en SQL ET en JS (deux écritures qui divergeraient), le comparateur sert de RÉFÉRENCE UNIQUE que les tests confrontent au résultat SQL — voir son docblock. Exempté du gardien des chemins avec un motif écrit (même famille que `motifDeLErreur`, `lib/agences/depot.ts`).
- **La tuile « Dernière intervention » garde l'ancien ordre** : c'est ce que le ticket demande explicitement, et c'est cohérent avec son rôle (« qu'a-t-on fait/prévu en dernier », pas « que reste-t-il à faire »).
- **`/parc` et `/api/recherche/sites` non modifiés** : les deux acceptaient déjà `client`/`site` en paramètre (SELECTEURS-1, AT-07) ; seul le lien/l'appel manquait côté appelant.

## Ce que je n'ai PAS fait

- Je n'ai pas touché `lib/machines/historique.ts` au-delà du commentaire demandé (« ordre conservé en attente de la confirmation d'Alexis (PV-15, audit du 28/09) », au-dessus de l'`orderBy` de `lireLHistorique`) : la règle de tri de `teteDeLHistorique`/`historiqueDeLaMachine` n'a pas bougé, comme demandé.
- Je n'ai pas corrigé les 6 échecs `test:e2e` étrangers au lot (voir ci-dessous) : ils ne touchent aucun fichier de mon territoire, et leur corriger la mise en scène est hors périmètre écrit de ce ticket.
- Je n'ai pas fait valider le libellé exact de `sites.fiche.interventions_borne_suffixe` par Alexis (le ticket l'autorisait à défaut) — j'ai écrit « celles qui restent à planifier en tête ; la plus récente ensuite », symétrique de l'ancien texte.

## Le conflit non résolu — 6 échecs `test:e2e`, ÉTRANGERS à ce lot

`pnpm test:e2e` complet (161 fichiers) : 6 échecs, TOUS reproduits sans aucun fichier de ce lot dans la sélection (vérifié en rejouant `agences-choix-sites.spec.ts` + `agences-etat-visible.spec.ts` + `ecrans-largeur-utile.spec.ts` seuls : 2 des 6 rougissent déjà, à l'identique). Chaîne de causalité mesurée :

1. `agences-choix-sites.spec.ts` et `captures-9ay-aa1-choix-sites.spec.ts` posent chacun une agence sous un id **littéral partagé** (`AGENCE_INACTIVE_ID`/`AGENCE_ID`) ; sous `fullyParallel`, l'un peut tenter de la supprimer pendant que l'autre vient d'y rattacher un site — `Foreign key constraint violated on site_agence_fkey`.
2. Cette agence non supprimée reste en base et fausse tout comptage LARGE des agences de la société : `agences-etat-visible.spec.ts` (attend 3 lignes, en reçoit 4) et `ecrans-largeur-utile.spec.ts` (attend 3, en reçoit 4 ou 5 selon la course).
3. `demandes-2.spec.ts` et `demandes-marquer-transformee.spec.ts` échouent en aval, sur un refus « agence_inactive » ou une FK violée à la suppression — cohérent avec une agence basculée active/inactive par une course sur le même id pendant qu'un autre scénario s'appuyait sur elle.

Aucun de ces 6 fichiers n'apparaît dans le territoire du ticket, aucun n'importe `lib/interventions/depot.ts`, `ChampSiteEtMachines` ni les pages site/client/nouvelle-intervention. Par la règle du piège connu (« si une épreuve étrangère rougit, la nommer sans toucher son assertion ») : nommé ici, rien modifié dans ces 6 fichiers.

## Ce qui reste à faire

1. **Stabiliser la collision `AGENCE_INACTIVE_ID`/`AGENCE_ID`** entre `agences-choix-sites.spec.ts` et `captures-9ay-aa1-choix-sites.spec.ts` (id littéral partagé sous `fullyParallel`) — hors territoire de ce lot, mais bloque un `test:e2e` complet propre.
2. Faire valider par Alexis le libellé définitif de `sites.fiche.interventions_borne_suffixe` si la formulation actuelle ne convient pas.
