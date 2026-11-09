# 9K07-SUITES-A-DONNER-RELANCES — passation

## Ce qui était mesuré au départ

- `lib/suite-a-donner/depot.ts` : `devisEnRetard` (FLX-2) et `accordAttenduEnRetard`
  (FLX-3), posées par 9J19-SUITE-A-DONNER-NOTIFICATIONS, n'avaient AUCUN appelant de
  production — `scripts/lib/chemins-de-depot.ts` les exemptait nommément, motif « aucun
  écran ne l'appelle encore ». Les deux sont des LECTURES calculées (même patron que
  `enRetard`, `lib/interventions/retard.ts`), qui posent par effet de bord UNE
  notification au plus par dossier et par événement (`poserNotificationSiAbsente`,
  ~l.322) — le mécanisme d'idempotence existait déjà, rien à y changer.
- `marquerPieceRecue` (9K05) posait déjà sa notification `piece_recue` dans la MÊME
  transaction que le passage à `a_replanifier` — producteur déjà branché, rien à faire
  de ce côté.
- `app/(back-office)/notifications/presentation.ts` : `LIBELLES_EVENEMENT` ne portait
  qu'une entrée (`signature_absente_ou_refusee`). Les trois valeurs posées par 9J19/9K05
  (`devis_en_retard`, `accord_attendu_en_retard`, `piece_recue`) rendaient leur nom
  technique brut sur `/notifications`.
- `tests/isolation/suite-a-donner-notifications.test.ts` (9J19) couvrait déjà
  l'idempotence et le réglage `delai_relance_suite_jours` NUL — mais aucun scénario ne
  montrait qu'une société ne relance jamais le dossier en retard d'une autre (I1).
- Aucune capacité neuve nécessaire : `poserNotification` ne garde pas l'appelant, la
  capacité qu'il enregistre (`consulter_parc_complet`, `CAPACITE_RELANCE`) ne sert qu'au
  FILTRE de lecture de `/notifications`.

## Ce qui a été fait

1. **`app/(back-office)/interventions/suites-a-donner/page.tsx`** : appel de
   `devisEnRetard(contexte)` et `accordAttenduEnRetard(contexte)` à l'ouverture de la
   page, en parallèle, avant la lecture du registre — même patron que `enRetard`, côté
   serveur. Idempotent par construction (`poserNotificationSiAbsente`) : ouvrir dix fois
   l'écran ne pose qu'une notification par dossier en retard.
2. **`scripts/lib/chemins-de-depot.ts`** : les deux exemptions se retirent — le gardien
   R3-12 (`pnpm chemins`) refuse qu'une exemption survive à son objet.
3. **Libellés** : `lib/i18n/fr.ts` (bloc `notifications.*`, jamais en fin de fichier) —
   « Devis sans réponse », « Accord en attente de réponse » (jamais « refusé », docblock
   du schéma sur `accord_attendu_en_retard`), « Pièce reçue ». Mappées dans
   `LIBELLES_EVENEMENT` de `presentation.ts`.
4. **`tests/isolation/suite-a-donner-notifications.test.ts`** : nouveau bloc « I1 — une
   société ne relance jamais les dossiers d'une autre » — deux scénarios
   (`devisEnRetard`/`accordAttenduEnRetard` appelées sous le contexte de la société B),
   chacun réglant AUSSI le délai de la société B pour écarter l'explication « délai
   nul » et isoler la vraie cause (le cloisonnement, forme « filiation », D103).
   `surUneInterventionJetable` généralisée pour accepter une origine quelconque (inutile
   ici : le dossier en retard reste de la société A, seule la session qui appelle change).
5. **`tests/e2e/captures-9k07-suites-a-donner-relances.spec.ts`** (neuf, APRÈS SEULEMENT —
   addition de libellés, pas de différence visuelle à comparer) : scène jetable à trois
   dossiers (A `qualifiee` reculée, B `accord_attendu` reculée, C mené jusqu'à
   `marquerPieceRecue`) ; un test ouvre le registre (déclenche les deux relances), un
   second (paramétré 1280/375) vérifie les trois libellés sur `/notifications` et prend
   la capture, un troisième rejoue l'ouverture du registre et vérifie qu'aucune
   notification n'est dupliquée. 4/4 verts.
6. **Captures** : `docs/propositions/9K07-SUITES-A-DONNER-RELANCES/captures/`,
   `notifications-1280.png` et `notifications-375.png`, les trois libellés visibles.

## Ce qui n'a PAS été fait (hors territoire, conforme aux interdits du ticket)

- Aucune migration, aucune politique RLS, aucune tâche planifiée, aucune capacité
  neuve, aucun délai inventé — le délai relancé reste celui que règle la société
  (`Societe.delai_relance_suite_jours`).
- `depot/` et `11-FILE.sh` non touchés.

## Épreuves rejouées avant chaque commit

`pnpm format`, `pnpm typecheck`, `pnpm lint` : propres. `pnpm test` : 5559/5559.
`pnpm test:isolation` : 1973/1973 (deux nouveaux). `pnpm test:e2e
tests/e2e/captures-9k07-suites-a-donner-relances.spec.ts` : 4/4.

## État au moment de rendre la main

- Branche dédiée `9K07-suites-a-donner-relances`, partant d'`origin/main` (HEAD était
  détaché sur `origin/main` au démarrage — pas de `main` extraite ailleurs dans ce
  worktree, mais pas davantage de branche nommée).
- Cinq commits, un par point livré (brancher, libellés, épreuves, captures, cette
  passation), tous verts.
- Reste à faire avant de rendre la main : `git fetch origin` + `git rebase origin/main`,
  `CI=1 pnpm verify`, vérifier l'arbre propre. `verify:full` est laissé à la file (non
  joué ici, conformément à la consigne).
