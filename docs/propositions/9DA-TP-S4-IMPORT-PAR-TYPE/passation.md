# 9DA-TP-S4-IMPORT-PAR-TYPE — passation

## Ce que j'ai changé

QT-3 de l'audit du 28/09/2026 (D150, `docs/arbitrages.md`) : l'import suit désormais les droits de l'écran de son type, en plus d'« Importer / exporter en masse ».

- `lib/imports/droits.ts` (neuf) : `CAPACITE_DU_TYPE` (clients, sites → `gerer_client_site`, D130 ; familles, modèles, prestations → `parametrer_societe`, le droit de l'écran Paramètres ; les cinq autres types → `null`, QT-3 ne les nomme pas) et `peutImporterLeType(role, type)`, la fonction pure que routes et écrans appellent.
- Les trois routes qui écrivent (`app/api/imports/controler`, `[id]/appliquer`, `[id]/annuler`) refusent AVANT toute écriture, avec le motif `imports.refus.type_reserve` (« Votre rôle ne permet pas d'importer ce type de données. »). `rejets`, en lecture seule, est inchangée.
- Les deux écrans n'offrent que ce que la route accepte : `/imports` affiche « Réservé à d'autres rôles » sous chaque type que le rôle courant ne peut pas importer (`imports.disponibles_reserve`) ; `/imports/[id]` affiche le motif à la place du bouton « Appliquer » ou « Annuler » (`imports.type_reserve`).

**Conséquence pour l'exploitation** : un responsable matériel ou SAV qui tenterait d'importer en masse des clients ou des sites est désormais refusé, exactement comme à l'unité (D130) — avant ce lot, l'import contournait cette règle. Même chose pour un responsable ou l'ADV sur les familles, modèles et prestations — refusés à l'import comme ils le sont déjà sur l'écran Paramètres. Aucun compte de ces rôles n'existait en exploitation au moment de l'audit (le défaut était latent) ; ce lot ferme le trou avant qu'il ne serve.

## Ce que j'ai mesuré

- `pnpm test` (3872 tests) et `pnpm test:isolation` (1329 tests) : verts, aucune régression.
- `pnpm typecheck`, `pnpm lint`, `pnpm format:check` : verts.
- La matrice complète (10 rôles × 10 types, 100 cas) est écrite en clair et vérifiée par `tests/unit/imports/droits-import.test.ts`, qui confronte aussi `CAPACITE_DU_TYPE` à `APPLICATIONS ∪ SANS_APPLICATION` (`lib/imports/types-dimport.ts`) et à `TYPES_DIMPORT` (l'écran), dans les deux sens.
- `tests/isolation/droits-import-par-type.test.ts` traverse les VRAIES routes (pas de mock de `lib/db` ni de dépôt) avec une porte fabriquée (`exigerCapacite` mocké pour un rôle donné, même patron que `motifs-in22.test.ts`) :
  - RM sur un classeur de clients réel (`tests/fixtures/clients-fabrique.xlsx`) → `imports.refus.type_reserve`, **0 lot créé** (compté en base) ; ADMS sur le même fichier → lot créé normalement (le jumeau).
  - ADV sur l'application d'un lot de familles → `imports.refus.type_reserve`, lot resté `controle`, **aucune `famille_materiel` créée** ; ADMS applique le même lot ensuite → famille créée ; ADV refusé à l'annulation (famille intacte) ; ADMS annule → famille défaite. Quatre faits mesurés dans un seul test, sur le même lot.
- Captures e2e (`tests/e2e/captures-9da-tp-s4-import-par-type.spec.ts`), AVANT et APRÈS, 1280 et 375 px : administrateur de société sur `/imports` (inchangé des deux côtés, aucune ligne « Réservé ») ; ADV sur `/imports` (AVANT : les neuf types « Contrôle et application », rien de plus ; APRÈS : « Réservé à d'autres rôles » apparaît sous Modèles, Prestations et Familles, rien sous Clients et Sites) ; ADV sur la fiche d'un lot de familles au statut « contrôlé » (AVANT : bouton « Appliquer l'import » actif — c'est EXACTEMENT le défaut que ce lot ferme, un ADV pouvait créer une famille en cliquant ; APRÈS : le motif à la place du bouton). AVANT capturé depuis un `git worktree` sur `2e07e45` (le commit précédent, 9CZ-RETOUCHES-9), APRÈS depuis le commit de ce lot (`4b1fec0`). Vérifié visuellement — voir `docs/propositions/9DA-TP-S4-IMPORT-PAR-TYPE/captures/`.

## Ce que j'ai tranché et pourquoi

- **Le `○` de la direction sur `parametrer_societe` n'est pas tranché.** La porte (`exigerCapacite`) laisse déjà passer `peut()`, restreint compris, sur l'écran Paramètres aujourd'hui — `peutImporterLeType` suit exactement la même règle pour l'import, sans en juger. PA-02 reste ouverte.
- **Les cinq types sans capacité de plus** (`equipements`, `historique`, `vgp`, `vgp_observations`, `contacts`) n'ont reçu AUCUNE règle inventée : QT-3 ne les nomme pas, et leur écran d'origine n'a pas de capacité d'écriture unique et transposable (une machine se crée depuis plusieurs écrans, sous `gerer_machine`, qui ne recouvre pas `importer_exporter`). `CAPACITE_DU_TYPE` les porte à `null`, avec le motif écrit en commentaire.
- **`peutImporterLeType` recombine `importer_exporter` ET la capacité du type**, plutôt que de supposer que la route a déjà vérifié la première : la fonction est testée seule (matrice) comme appelée (routes), et les deux doivent s'accorder sans dépendre de l'ordre des appels.
- **Les tests de route touchent une vraie base.** J'ai dû poser `process.env.DATABASE_URL` (dérivé de `TEST_DATABASE_URL`, rôle `codiplan_app`) dans `tests/isolation/droits-import-par-type.test.ts` via `vi.hoisted`, AVANT l'import des routes : les trois routes appellent `avecContexteApplicatif` sans client de substitution, donc par le singleton de `lib/db/client.ts`, qui lit `DATABASE_URL` au premier import. Aucun autre test d'isolation existant ne driving une vraie ROUTE HTTP de bout en bout (les autres mockent `obtenirSession` pour ne tester que la branche 401, ou appellent directement les fonctions de dépôt avec `clientApp()` injecté) — c'est un patron nouveau dans ce fichier, documenté en tête.
- **Pas de README séparé dans `docs/propositions/9DA-…/`** : la convention de ce dépôt (vérifiée sur DROITS-1/D131 et plusieurs tickets 9C*) n'en écrit pas un — seuls `passation.md` et `captures/` existent. « rejets, inchangée » est documentée ici plutôt que dans un fichier séparé.

## Ce que je n'ai PAS fait

- **Aucun compte `responsable_materiel` ni `responsable_sav` dans la scène e2e** (`tests/e2e/setup/scene.ts`) : le cas « RM refusé sur clients/sites » (D130) n'a donc pas de capture — seulement l'ADV, refusé sur familles/modèles/prestations. Le cas RM est mesuré par l'isolation (`droits-import-par-type.test.ts`, RM refusé sur un vrai classeur de clients, 0 lot créé) et la matrice unitaire, pas par une capture.
- Rien sur `creer_demande` (IN-41, TP-S5), aucune politique RLS, aucun changement de `MATRICE`, aucune décision sur PA-02, CS6 ou PA-25 — hors territoire de ce lot, comme demandé.

## Pièges pour la session suivante

- Les trois routes d'import appellent `avecContexteApplicatif` SANS client de substitution : toute isolation test qui les exerce directement (plutôt que les fonctions de `lib/imports/`) doit poser `DATABASE_URL` elle-même — voir le `vi.hoisted` en tête de `tests/isolation/droits-import-par-type.test.ts`, à copier plutôt qu'à redécouvrir.
- `tests/fixtures/clients-fabrique.xlsx` est un fichier FABRIQUÉ (`scripts/fabriquer-classeur-epreuve.mts`), gardé octet pour octet par `tests/unit/imports/classeur-fabrique.test.ts` : l'utiliser tel quel dans un test de route, jamais le modifier.
- Le lot de familles des captures e2e est posé DIRECTEMENT en base par le spec (pas un vrai classeur déposé) — démonstration seulement (I9), nettoyé en `afterAll`. Ne pas le confondre avec une preuve de comportement : c'est l'isolation qui prouve, la capture montre.

## Ce qui reste à faire

- PA-02 (le `○` de `parametrer_societe`) reste à trancher par Alexis ; le jour où elle l'est, `peutImporterLeType` suit automatiquement `peut()` sans qu'il faille toucher ce fichier.
- Si l'exploitation ouvre un compte `responsable_materiel` ou `responsable_sav`, envisager de l'ajouter à `tests/e2e/setup/scene.ts` pour que D130 ait, elle aussi, sa capture côté clients/sites.
