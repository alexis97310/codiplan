# 9AH-GR14-PRESTATIONS-SITES — passation

## Ce que j'ai changé

Deux écrans du catalogue back-office écrivaient une durée avec une unité en dur, hors
dictionnaire — audit GR du 26/09/2026, constat G17, ticket 4/5 de GR14 :

- **GR14-T4a** — `/parametres/prestations` (`app/(back-office)/parametres/prestations/page.tsx`)
  : `dureeAffichee` rendait `` `${duree_standard_min}${" min"}` `` (« 90 min »). Elle compose
  désormais `enDuree(duree_standard_min)` (`lib/calendar/duree.ts`), même écriture que le
  planning (9AE), la charge par technicien (9AF) et les trajets par zone (9AG) — « 1 h 30 ». La
  constante `MINUTES` est supprimée ; le cas « non estimée » (`null`) est inchangé.
- **GR14-T4b** — `/sites` (`app/(back-office)/sites/presentation.ts`) : `trajetAffiche` rendait
  `String(trajet.minutes)` sous un libellé portant l'unité entre parenthèses (« Trajet (min) »,
  « Trajet estimé (min) »). La valeur passe par `enDuree`, et l'unité quitte les deux libellés du
  dictionnaire (`lib/i18n/fr.ts`) puisqu'elle est désormais dans la valeur — « 3 h 00 »,
  « 25 min », « 2 h 30 Trajet estimé ».

Pour l'exploitation : les deux derniers écrans de l'audit GR14 (sur cinq) lisent maintenant la
même écriture de durée — plus aucun tableau ni carte du back-office ne montre une durée en
minutes brutes avec son unité en dur.

## Ce que j'ai mesuré

- **Test e2e neuf** (`tests/e2e/ergo14-prestations.spec.ts`) : une prestation `ERGO14-` créée par
  le client d'administration (aucune fonction d'application n'existe pour la suppression du
  catalogue — `lib/prestations/depot.ts` le documente explicitement — donc la création comme la
  suppression passent directement par Prisma, jamais par l'écran), durée 90 minutes ; sa ligne
  affiche `enDuree(90)` (« 1 h 30 »). Supprimée sans incident en `afterAll` (aucune référence ne
  la retient).
- **Test unitaire neuf** (`tests/unit/sites/trajet-affiche.test.ts`) : `trajetAffiche` sur les
  trois cas — mesuré (`origine: "site"`), estimé (`origine: "defaut"`), absent (`minutes: null`)
  — vérifie la valeur, le libellé et le ton.
- `tests/e2e/sites.spec.ts` (getByText sur `fr["sites.colonne_trajet"]`, désormais « Trajet » sans
  parenthèse) et `tests/e2e/listes-1.spec.ts` (qui ne lit que l'attribut `data-compteur`) rejoués
  entiers : 10/10 verts, sans modification — un seul badge de trajet existe par carte, la
  substitution de chaîne reste unique dans la carte visée.
- **Captures AVANT/APRÈS** (`docs/propositions/9AH-GR14-PRESTATIONS-SITES/captures/`, à 1280 et
  375 px), prises par un spec neuf (`tests/e2e/captures-9ah-gr14-prestations-sites.spec.ts`, env
  `CAPTURES_9AH`) — sa propre scène préfixée `ERGO14C-` (un client, deux sites, une prestation),
  créée en `beforeAll` et supprimée en `afterAll`, aucune ligne de semis touchée.
  - **AVANT** (code des trois fichiers remis temporairement au contenu du commit parent `2ca4b2d`
    par `git checkout 2ca4b2d -- <3 fichiers>`, jamais commité, restauré ensuite — vérifié par
    `git diff --stat`, vide) : le catalogue écrit « 90 min », les cartes de `/sites` écrivent
    « 25 Trajet (min) », « 150 Trajet estimé (min) », « 180 Trajet (min) ».
  - **APRÈS** (code livré) : le catalogue écrit « 1 h 30 », les cartes écrivent « 25 min Trajet »,
    « 2 h 30 Trajet estimé », « 3 h 00 Trajet » — les rendus attendus par le ticket. Les cartes
    mesurées/estimées visibles sur la capture viennent des SITES DE DÉMONSTRATION du semis
    (Atelier Ducos, Dépôt de brousse, Garage de Koné), pas des sites `ERGO14C-` forgés — ceux-ci
    n'ont pas d'équipement et restent masqués derrière « Afficher », ce qui a suffi à couvrir les
    deux origines demandées sans qu'il soit nécessaire de lever le masquage.
- `pnpm format:check`, `pnpm typecheck` (`tsc --noEmit`), `CI=1 pnpm test` (277 fichiers, 2959
  tests) : verts avant chaque commit.
- `CI=1 pnpm exec playwright test tests/e2e/sites.spec.ts tests/e2e/listes-1.spec.ts
  tests/e2e/ergo14-prestations.spec.ts tests/e2e/ergo14-trajets.spec.ts` : 12/12 verts.

## Ce que j'ai tranché et pourquoi

- **Aucune modification de `tests/e2e/sites.spec.ts`** : le ticket demandait de vérifier que
  `getByText(fr["sites.colonne_trajet"])` reste vert et unique dans la carte visée, et de passer
  `{ exact: true }` seulement si ce n'était pas le cas. Rejoué tel quel, le test reste vert — une
  seule pastille de trajet existe par carte, donc « Trajet » comme sous-chaîne de « Trajet estimé »
  ne peut jamais créer d'ambiguïté à l'intérieur d'une même carte.
- **Création/suppression de la prestation de test par le client d'administration**, jamais par
  l'écran : `lib/prestations/depot.ts` documente qu'aucune fonction de suppression n'existe pour
  ce catalogue (la bascule d'activité est le seul retrait prévu, D109/D113). Passer par Prisma
  directement pour une ligne de test créée et supprimée dans la même session est la même discipline
  que `tests/e2e/fiche-cloturer.spec.ts`.
- **Un spec de capture dédié plutôt que réutiliser `ergo14-prestations.spec.ts`** : ce dernier
  n'écrit aucune capture (lecture seule après assertion), et le spec de capture a besoin d'une
  scène plus large (sites en plus de la prestation) — même séparation que 9AG
  (`ergo14-trajets.spec.ts` vs `captures-9ag-gr14-trajets.spec.ts`).

## Ce que je n'ai PAS fait

- Aucune migration, aucune ligne de semis, aucun prix — hors territoire du ticket.
- Aucun renommage « lieu » → « site » (GR12, autre ticket) ; aucune touche à `sites/[id]`,
  `sites/nouveau`, ni aux libellés de SAISIE (`prestations.duree_minutes`,
  `site.temps_trajet_min` — 9AI) ni aux habilitations (des mois, pas des minutes, hors GR14).
- Je n'ai PAS vérifié qu'une prestation se supprime par le client d'ADMINISTRATION lui-même
  (déclencheurs, références) — le ticket le nommait « NON MESURÉ » ; ma suppression de test passe
  directement par Prisma sur une ligne fraîche et sans référence, ce qui ne prouve rien sur une
  ligne référencée.

## Les pièges pour la session suivante

- Le tableau de `/parametres/prestations` masque les colonnes « Durée standard » et « Activité »
  sous 1280 px (comportement du composant `Tableau`, pas de ce lot) — visible sur
  `captures/apres/prestations-375.png`. Non touché ici, mais à garder en tête si un futur ticket
  reprend l'ergonomie mobile de cet écran.
- Les sites `ERGO14C-*` forgés pour les captures n'ont pas été nécessaires pour démontrer les deux
  origines (mesuré/estimé) : le semis de démonstration les porte déjà (Atelier Ducos = mesuré,
  Dépôt de brousse = estimé). Un futur spec de capture sur `/sites` peut donc s'appuyer sur ces
  trois cartes existantes sans forger de site dédié.

## Ce qui reste à faire

GR14 comptait cinq tickets (audit du 26/09/2026, constat G17) ; celui-ci est le quatrième (9AH).
Le cinquième (9AI, hors territoire ici) couvre les libellés de SAISIE — `prestations.duree_minutes`
et `site.temps_trajet_min` — qui restent en minutes, saisie oblige, et n'ont pas été touchés.
