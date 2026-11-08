# 9K05-SUITES-A-DONNER-DEBLOQUEES — passation

## Ce qui était mesuré au départ

- `lib/suite-a-donner/depot.ts` portait quatre fonctions (9J17) plus deux relances (9J19) :
  `qualifierSuite` (seule à avoir un appelant de production, la route
  `app/api/interventions/suites-a-donner/qualifier/route.ts`), `enregistrerAccord`,
  `marquerPieceRecue`, `cloturer` (appelée uniquement par `cloturerSuiteSiReprise`,
  elle-même depuis `app/api/interventions/[id]/cloturer/route.ts`), `devisEnRetard`,
  `accordAttenduEnRetard`.
- `enregistrerAccord` et `marquerPieceRecue` n'avaient AUCUN appelant de production
  (`scripts/lib/chemins-de-depot.ts` les exemptait nommément) : aucune des deux
  transitions n'était atteignable depuis un écran.
- La transition `qualifiee` → `accord_attendu` (devis envoyé) n'avait ELLE-MÊME aucune
  fonction : le docblock de `depot.ts` la disait « hors territoire » depuis 9J17.
- L'écran `app/(back-office)/interventions/suites-a-donner/page.tsx` ne proposait que
  « Qualifier » (statut `a_qualifier` virtuel) et « Déplacer… » (statut `a_replanifier`) :
  un dossier `qualifiee` restait bloqué pour toujours, sans bouton suivant.
- Capacité gardant « Qualifier »/« Déplacer… » : `modifier_planning`, complet
  `[ADMS, DIR, RM, RS, ADV]` (`lib/auth/habilitations.ts:139`) — l'ADV l'a déjà,
  donc aucune capacité neuve n'était nécessaire (conforme à la décision d'Alexis).

## Ce qui a été fait (D234, `docs/arbitrages.md`)

1. **`lib/suite-a-donner/depot.ts`** : nouvelle fonction `marquerDevisEnvoye`
   (`qualifiee` → `accord_attendu`). `enregistrerAccord` et `marquerPieceRecue`
   refusent désormais tout statut de départ qui n'est pas le leur (ÉPREUVE) — les
   trois rendent `ResultatTransitionSuite` (`{accepte:true}` ou `{accepte:false,cle}`),
   jamais `void`. **Décision d'Alexis appliquée** : `enregistrerAccord` avec
   `reponse:"accord_recu"` et AUCUNE `pieceAttendueRef` saute directement à
   `a_replanifier` (jamais `accord_recu`) — donc jamais de notification
   `piece_recue` trompeuse sur ce chemin.
2. **Trois routes neuves**, toutes gardées par `modifier_planning` (porte complète,
   aucun ○ technicien) :
   - `app/api/interventions/suites-a-donner/[id]/devis-envoye/route.ts`
   - `app/api/interventions/suites-a-donner/[id]/accord/route.ts` (une seule route
     pour `accord_recu` et `sans_suite`, discriminée par le champ cédé `reponse` —
     même union que `ReponseAccord`)
   - `app/api/interventions/suites-a-donner/[id]/piece-recue/route.ts`
3. **Écran** : `app/(back-office)/interventions/suites-a-donner/[id]/accord/page.tsx`
   (deux formulaires : « Accord reçu », avec pièce optionnelle, et « Sans suite », motif
   obligatoire) ; `suites-a-donner/page.tsx` gagne `ActionSuite`, qui choisit le bouton/
   lien selon le statut de la ligne (`qualifiee` → bouton « Devis envoyé » ;
   `accord_attendu` → lien « Accord… » ; `accord_recu` → bouton « Pièce reçue » ;
   `a_replanifier` sans reprise → lien « Déplacer… » inchangé).
4. **Gardiens** : `tests/unit/auth/porte.test.ts` (3 routes neuves dans
   `ROUTE_CAPACITE` ET `PORTE_COMPLETE`, compte `102`, était `99`) ;
   `scripts/lib/chemins-de-depot.ts` (exemptions retirées pour `enregistrerAccord`/
   `marquerPieceRecue`, conservées pour `devisEnRetard`/`accordAttenduEnRetard` —
   interdiction explicite du ticket de les brancher).
5. **i18n** : clés ajoutées dans le bloc `suites_a_donner.*` existant de `lib/i18n/fr.ts`
   (jamais en fin de fichier). Piège mesuré : « dossier » est un synonyme fermé (§8,
   D172, → « Intervention ») — trois libellés initiaux l'employaient hors de ce sens et
   ont dû être reformulés (`tests/unit/i18n/vocabulaire-impose.test.ts`).

## Épreuves

- **Unitaires/isolation** (`tests/isolation/suite-a-donner*.test.ts`) : garde de chaque
  transition contre un statut de départ illégal ; le nouveau cas « accord sans pièce
  saute à `a_replanifier` » ; mise à jour des trois fichiers qui enchaînaient
  `qualifierSuite` → `enregistrerAccord` sans l'étape `marquerDevisEnvoye` désormais
  obligatoire (ils réussissaient silencieusement AVANT ce ticket parce que l'ancienne
  fonction ne vérifiait rien — un piège qu'un lecteur futur pourrait reproduire).
- **`tests/e2e/tous-les-ecrans-rendent.spec.ts`** : la nouvelle page `/accord` ajoutée
  au résolveur ; `assurerUneSuiteAReplanifier` ne passe plus par `marquerPieceRecue`
  (chemin fermé par la décision) ; nouvel `assurerUneSuiteAccordAttendu`. 60 passent,
  3 skip attendus (fixtures absentes du semis, inchangé).
- **`tests/e2e/registre-ux3-1.spec.ts`** : 11/11, aucune régression (cet écran ne touche
  pas `/suites-a-donner`).
- **`tests/e2e/captures-9j18-suite-a-donner.spec.ts`** : CASSÉ par la garde neuve
  d'`enregistrerAccord` (appelait l'ancienne fonction juste après `qualifierSuite`,
  sans passer par `accord_attendu`) — corrigé : `marquerDevisEnvoye` inséré,
  `marquerPieceRecue` retiré (le chemin « accord sans pièce » de cette scène saute
  maintenant directement à `a_replanifier`). 3/3 verts après correction.
- **`tests/e2e/captures-9k05-suites-a-donner-debloquees.spec.ts`** (neuf) : trois
  scénarios joués CLIC PAR CLIC (pas par appel direct aux fonctions de dépôt, à la
  différence des fixtures ci-dessus) — A, accord sans pièce → « À déplacer » ;
  B, accord avec pièce → « Pièce reçue » → « À déplacer » ; C, sans suite avec motif.
  6/6 verts. Captures 375/1280 dans `docs/propositions/9K05-SUITES-A-DONNER-DEBLOQUEES/captures/`.
- `pnpm test` : 5558/5558. `pnpm test:isolation` : 1971/1971. `pnpm typecheck`,
  `pnpm lint` : propres.

## Ce qui n'a PAS été fait (hors territoire, conforme aux interdits du ticket)

- Aucune migration, aucune politique RLS, aucune capacité neuve.
- Les relances automatiques (`devisEnRetard`, `accordAttenduEnRetard`, FLX-2/FLX-3)
  restent sans appelant de production — exemptées nommément dans
  `scripts/lib/chemins-de-depot.ts`, condition de réouverture posée dans D234.
- `/notifications` et `depot/` non touchés.

## État au moment de rendre la main

- Branche dédiée `9K05-SUITES-A-DONNER-DEBLOQUEES`, partant d'`origin/main`
  (`main` est extrait ailleurs, `/home/aplou/codiplan`).
- Cinq commits, un par point livré, tous verts (`pnpm format`/`typecheck`/`lint`/`test`/
  `test:isolation` rejoués avant chacun).
- Reste à faire avant de rendre la main : `git fetch origin` + `git rebase origin/main`,
  `CI=1 pnpm verify`, vérifier l'arbre propre. `verify:full` est laissé à la file (non joué
  ici, conformément à la consigne).
