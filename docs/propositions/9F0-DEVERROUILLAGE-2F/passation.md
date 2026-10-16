# 9F0-DEVERROUILLAGE-2F — passation

**MIGRATION À APPLIQUER EN PRODUCTION PAR ALEXIS (flux DB migrate & seed) — nom du dossier de migration : `20261015070000_second_facteur_deverrouillage_exclusif`.**

## Ce qui est livré (quatre commits, tous verts individuellement)

1. **Points 1 et 2** — épreuve rouge puis politique restrictive. Reproduit la panne mesurée par le pilote : un auteur `admin_societe` ou `direction` doté de sa propre ligne `second_facteur` (le cas normal en production, MFA obligatoire sur ces deux rôles) ne pouvait **jamais** déverrouiller qui que ce soit — `deverrouillerSecondFacteur` levait systématiquement `RefusDeverrouillage` (« 2 lignes au lieu d'une seule »). Cause : `second_facteur_modification` (politique PERMISSIVE d'`UPDATE`, L1-02d) se combine par OR à `second_facteur_deverrouillage` (D66) ; sa branche `utilisateur_id = app.utilisateur_id` matche la propre ligne de l'auteur sous **tout** contexte RLS, déverrouillage compris. Correctif : une politique **RESTRICTIVE** séparée, `second_facteur_deverrouillage_exclusif` (migration `20261015070000`), qui borne toute permissive à la seule ligne du sujet désigné sous un contexte de déverrouillage, et ne change rien hors de ce contexte. Décision **D208** dans `docs/arbitrages.md`.
2. **Point 3** — épreuves de garde : auteur `direction` doté de son propre second facteur (sujet dédié) ; témoin direct `ecrire()` ; JUMEAU (politique retirée dans une transaction annulée → 2 lignes ; rétablie → 1) ; non-régression (`plancher-second-facteur.test.ts` vert sans retouche, il ne touche jamais à la politique nouvelle) ; fixture `AUTRUI` de `categorie-authentification.test.ts` nettoyée (ne laisse plus traîner de ligne `second_facteur` au-delà de son fichier).
3. **Point 4** — reliquats de la revue 9EV (solde 195-198) : messages et commentaires « admin_societe seul (D37) » mis à jour en « admin_societe ou direction (D199) » dans `lib/auth/lien-d-acces.ts`, `lib/techniciens/depot.ts`, `lib/auth/lecture-identite.ts`, les deux routes `envoyer-acces`, `habilitations/page.tsx` et `portes-parametrage.ts` ; témoins de refus pour un rôle TOUJOURS exclu (ADV) réintroduits pour `envoyerLienDAcces`, `envoyerLienDAccesBureau` et `deverrouillerSecondFacteur` (9EV les avait retirés en inversant Direction sans les remplacer) ; témoin de non-vacuité de `habilitations.test.ts` (D199) corrigé — il comptait les capacités d'`admin_societe`, jamais ce que `direction` avait gagné, et aurait passé même si D199 n'avait rien changé.
4. Ce commit de documentation (D208 + cette passation).

## Angle mort laissé ouvert, volontairement

La fixture `UTILISATEUR_PAR_ROLE[Role.adv]` (ADV_A) garde désormais un cycle propre, mais aucune règle structurelle n'empêche une AUTRE fixture future de laisser traîner une ligne `second_facteur` sur un compte utilisé ailleurs comme auteur. Le filet qui compte reste la politique elle-même (point 3, JUMEAU) et le garde-fou `count > 1` du code — la fixture n'est qu'une commodité.

## État de la vérification

- `pnpm format`, `pnpm typecheck`, `pnpm lint`, `pnpm test` (unit, 4789 épreuves), `pnpm test:isolation` (180 fichiers, 1597 épreuves) : **verts** après chaque commit.
- Épreuve rouge constatée avant le correctif (point 1), exactement comme prédit par le pilote :
  ```
  × l'administrateur réussit le geste SANS que sa propre ligne ne bouge
  × D199 — la direction, dotée de son propre second facteur, réussit aussi
  × le témoin direct — `ecrire()` avec l'auteur désigné et sa propre ligne — compte UN
  × JUMEAU — la politique restrictive retirée, la ligne de l'auteur redevient atteignable
  Error: Le déverrouillage a atteint 2 lignes au lieu d'une seule : la politique de
  déverrouillage ne borne plus ce qu'elle devrait, et l'écriture est annulée.
  Test Files  1 failed (1)
       Tests  4 failed | 16 passed (20)
  ```
- Même fichier après la migration (point 2) :
  ```
  Test Files  1 passed (1)
       Tests  20 passed (20)
  ```

### FIN — rejoué en entier

- Épreuves voisines (`tests/isolation/plancher-second-facteur.test.ts`, `tests/isolation/categorie-authentification.test.ts`, `tests/isolation/politiques-rls.test.ts`, `tests/isolation/force-rls.test.ts`, `tests/isolation/acces-technicien.test.ts`, `tests/isolation/acces-bureau.test.ts`, `tests/unit/auth/habilitations.test.ts`, `tests/unit/auth/porte.test.ts`, `tests/unit/docs/forme-arbitrage.test.ts`, `tests/unit/docs/cablage-arbitrages.test.ts`, `tests/unit/docs/amendements-arbitrages.test.ts`, `tests/unit/docs/coherence-backlog.test.ts`) : **toutes vertes**.
- Épreuves voisines e2e jouées en priorité (`acces-technicien.spec.ts`, `equipe.spec.ts`, `habilitations.spec.ts`, `droits-rm-rs.spec.ts`, `9ev-direction-tous-droits.spec.ts`) : **33/33 vertes**.
- `CI=1 pnpm verify:full` rejoué EN ENTIER, en un seul appel, en tâche de fond (la première tentative au premier plan a dépassé 55 min et a été interrompue par le plafond de l'outil, sans aucun échec visible dans sa sortie jusque-là) : **VERT**, `1379 passed, 48 skipped (53.8m)` pour la seule partie `test:e2e` ; aucune ligne `FAIL`/`✗`/`ELIFECYCLE` dans tout le journal. Captures régénérées comme effet de bord des deux tentatives : restaurées (`git checkout -- docs/propositions/` + `git clean -fd docs/propositions/`), aucune committée.

## Commit de tête

`git rev-parse --short HEAD` → `a11e494a` avant ce commit de documentation (cinq commits locaux sur `9F0-DEVERROUILLAGE-2F`, aucun push).
