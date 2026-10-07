# 9EL-SOLDE-REGISTRE-TESTS — passation

`CI=1 pnpm verify:full` entier vert : **08/10/2026, 05h23 Nouméa (07/10/2026, 18h23 UTC)**.

## Tableau A..I

| Point | État | Détail |
|---|---|---|
| A | fait | `registre-ux3-1.spec.ts` — « Suivi sans durée » : exactement P1+P2, AUJOURD'HUI (durée 60) absent, commentaire corrigé. |
| B | fait | `registre-ux3-1.spec.ts` — nouveau `describe` : `admin_societe` ne voit ni l'onglet ni le lien « À facturer » (7 liens de nav), l'ADV témoin en voit 8. |
| C | fait | `registre-1.spec.ts` — par onglet : nombre exact de liens vers la fiche (2 sur `a_controler`, 1 ailleurs), colonne « Statut » exacte (`th`, jamais le `<label>` du filtre), une cellule d'état propre à chaque onglet. |
| D | fait | `registre-ux3-1.spec.ts` et `registre-ux3-2.spec.ts` — les derniers `toBeGreaterThanOrEqual(1)` remplacés par `toHaveCount(vue === "a_controler" ? 2 : 1)`, et `toHaveCount(1)` exact pour le Suivi garantie. |
| E | fait | `export-registres.spec.ts` — le client scope sur `tbody` avec `exact:true`, `tbody tr` à 1. |
| F | fait | `messages-tpa4a.spec.ts` — « Tout effacer » cherché dans le `role=status` du bandeau de refus, jamais `.first()`. |
| G | fait | `registre-2.spec.ts`/`registre-3.spec.ts` — le décompte (`LigneResume` + `Pagination`) à `toHaveCount(2)`, y compris à 0 ; l'onglet actif à `toHaveCount(1)`. |
| H | fait | `tests/isolation/ecran-intervention.test.ts` — nouveau scénario : `compterParVue(...)[vue] === compterInterventions({...criteres, vue})`, pour les huit vues et « toutes », sans filtre puis avec `statut: "planifiee"` (3/10 fiches) puis avec des bornes `du`/`au` (2/10 fiches). |
| I | fait | I-a (cartes 375 px scopées, sans input/bouton/case) ; I-b (`ligne-cliquable.test.tsx` neuf + vérif URL inchangée après `.check()`) ; I-c (`export-interventions.test.ts` : critère `id` exact + cloisonné, et un `id` non-UUID fait échouer tout le schéma) ; I-d (`VALEURS_SUIVI` exact, `retours_30_jours` nommément absent, select e2e à 3 options). |

## Ce que j'ai changé, et ce que ça change pour l'exploitation

Rien n'est fonctionnel : aucun écran, aucune route, aucune règle métier touchés. Neuf commits, chacun une lettre, qui remplacent des épreuves larges (`.first()`, `>= 1`, bornes non prouvées) par des épreuves exactes, et ajoutent quatre preuves qui manquaient entièrement (B, H, I-b, I-c, I-d). Pour l'exploitation : aucun changement visible — ce lot renforce la détection de régressions futures sur le registre, sans toucher au produit livré.

## Ce que j'ai mesuré (AVANT/APRÈS)

- Chaque point A à I a été rejoué seul (`playwright test <fichier> -g <titre>` ou `vitest run --project <projet> <fichier>`) immédiatement après l'écriture, et est passé du premier coup — aucune épreuve renforcée n'a échoué deux fois, donc aucun défaut de code n'a été mis au jour par ce lot.
- `pnpm lint`, `pnpm test` (unitaires, 409 fichiers / 4338 tests), `pnpm typecheck` et `pnpm test:isolation` (167 fichiers / 1491 tests) ont été rejoués après chaque point ou groupe de points touchant leur périmètre, tous verts.
- `CI=1 pnpm verify:full` entier (format:check, typecheck, lint, test, test:isolation, build, feries:horizon, audit:partitions, test:e2e) a tourné UNE FOIS, au premier plan, sans interruption (≈ 1h) : 1031 e2e passés, 48 sautés (captures hors scope de ce lot, aucun lien avec les fichiers touchés), zéro échec.
- Un premier passage du point I a été recalé par le gardien `sans-chaine-visible-en-dur` (`pnpm test`) : un `aria-label` littéral dans `ligne-cliquable.test.tsx` est un ATTRIBUT VISIBLE comme un autre pour ce gardien — corrigé en repérant les éléments par `data-testid` plutôt que par rôle+nom, puis rejoué vert.

## Ce que j'ai tranché, et pourquoi

- **Point C, le motif de « Suspendues » (bloquées)** : plutôt que de recopier le texte forgé par la scène dans une constante locale (ce que le gardien `sans-chaine-visible-en-dur` aurait quand même détecté, puisqu'il résout un identifiant jusqu'à sa constante littérale), l'épreuve relit le `motif_suspension` EN BASE au moment de l'assertion et compare le rendu à cette valeur lue — plus exact qu'une recopie, et hors d'atteinte du gardien puisqu'aucune chaîne littérale n'y figure.
- **Point H, le filtre « qui retient une partie des fiches »** : choisi `statut: "planifiee"` (3 des 10 fiches de la scène) plutôt que `technicien`/`priorite` (qui n'auraient rien changé, tous NULL/par défaut sur cette scène) — un filtre qui ne change rien à aucun onglet n'aurait rien prouvé, comme le ticket le signale.
- **Point I-d, « retours_30_jours » refuse-t-il vraiment ?** : le ticket supposait un refus (`safeParse` en échec). Lecture du schéma (`lib/interventions/saisie.ts:563-570`) : `suivi` retombe à `null` pour toute valeur hors `VALEURS_SUIVI`, JAMAIS une erreur (même défense que `vue`). L'épreuve écrite reflète donc le comportement RÉEL du code (`success: true`, `suivi: null`), pas l'hypothèse du ticket — vérifié avant d'écrire, comme l'exige le §9.
- **Point B/I-b, bascule de session dans un fichier dont le `beforeEach` ouvre déjà l'ADV** : repris le patron déjà établi par `ecrans-largeur-utile.spec.ts` (`page.context().clearCookies()` avant `ouvrirLaSessionSensible`), jamais inventé.

## Ce que je n'ai PAS fait

- Aucune correction de code applicatif : zéro défaut de code n'a été trouvé (toutes les épreuves renforcées sont passées du premier coup).
- Aucune capture n'a été prise ni commitée (aucun écran touché, comme demandé).
- Je n'ai pas touché `en_retard` dans la boucle de `registre-1.spec.ts` (hors de `ONGLETS`, qui ne le liste pas — pas dans le territoire de ce point).
- Je n'ai pas étendu le point H à une quatrième combinaison de filtres au-delà des trois demandées (sans filtre, `statut`, `du`/`au`) — le ticket en nommait trois, les trois sont couvertes.

## Les pièges pour la session suivante

- **Un `aria-label` littéral dans un fichier de test est une chaîne visible comme une autre** pour `sans-chaine-visible-en-dur` (L0-11) — y compris dans un fichier qui ne rend rien de « réel », juste un montage RTL. Utiliser `data-testid` pour nommer des éléments de scène qui ne portent pas de texte du produit.
- **`toContainText`/`toHaveText`/`getByText` (et les autres requêtes listées dans `tests/unit/outils/rendu-visible.ts`) résolvent un IDENTIFIANT jusqu'à sa constante littérale du même fichier** — passer une variable à la place d'un littéral ne suffit PAS à échapper au gardien si cette variable est elle-même assignée depuis un littéral dans le même fichier ; il faut que la valeur vienne d'ailleurs (une lecture en base, par exemple) pour ne pas être résolue.
- **`page.context().clearCookies()` est nécessaire avant toute bascule de session dans un fichier dont le `beforeEach` de fichier a DÉJÀ ouvert une autre identité** — sinon `/connexion` redirige tout droit sans jamais présenter le formulaire (`app/(sans-session)/connexion/page.tsx:31-37`).
- **`pnpm verify:full` régénère des dizaines de captures PNG suivies, sans rapport avec le lot en cours** (tous les specs `capturer(...)` du dépôt tournent) — toujours vérifier `git status --porcelain` après, et `git checkout -- docs/propositions/` pour les restaurer avant de commiter quoi que ce soit.

## Ce qui reste à faire

Rien côté territoire de ce ticket : les neuf points A à I sont faits, vérifiés individuellement puis par la chaîne complète. Aucun défaut de code n'a été découvert qui justifierait un ticket séparé.
