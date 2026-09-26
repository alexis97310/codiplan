# 99M-REPRISE-99G — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

Rien de neuf en logique : ce lot **reprend** le travail de 99G-PLANNING-JOUR, fini le
25/09 à 09h03 (`verify:full` vert : 296 passées, 3 sautées, 0 échec) mais jamais
committé. Les 6 fichiers du territoire, sauvés par la file sur la branche locale
`99G-PLANNING-JOUR-inacheve` (636fbf9, partie de main bcf8bb5), ont été réappliqués
sur `main` à jour puis committés (`ddc3786`).

Pour l'exploitation, c'est exactement ce que décrit la passation d'origine
(`docs/propositions/99G-PLANNING-JOUR/passation.md`, reprise telle quelle) : sur
`/planning?vue=jour`, l'en-tête dit désormais « N technicien(s) », puis, s'il y en a,
« · K agenda(s) bloqué(s) (Prénom, Prénom) », **avant** le compte de créneaux libres
qui n'a pas changé d'un caractère. La légende (quatre entrées) est remontée
au-dessus de la grille, visible sans défiler à 1280 px — voir capture.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- `git diff --stat $(git merge-base main 99G-PLANNING-JOUR-inacheve)
  99G-PLANNING-JOUR-inacheve` a rendu 68 fichiers au total : les 6 du territoire
  (`app/(back-office)/planning/carte.ts`, `app/(back-office)/planning/page.tsx`,
  `lib/i18n/fr.ts`, `tests/unit/planning/carte.test.ts`,
  `tests/e2e/planning-jour-en-tete.spec.ts`,
  `docs/propositions/99G-PLANNING-JOUR/passation.md`), une capture neuve
  (`docs/propositions/99G-PLANNING-JOUR/captures/en-tete-et-legende-1280.png`,
  produite par le spec e2e lui-même) et **61 PNG/PDF étrangers** au lot — des
  captures d'autres propositions déjà présentes comme modifiées dans l'arbre de
  travail avant que je ne commence (`git status --porcelain` en ouvrant la
  session listait déjà ces 67 fichiers). Ils n'ont pas été touchés ni committés.
- Seuls les 6 fichiers du territoire ont été appliqués via
  `git diff ... -- <fichiers> | git apply --3way` : `carte.ts` et `page.tsx`
  appliqués sans conflit malgré les commits intermédiaires (99H, 99I, 99J) — 99J
  touche le sous-titre de la vue Semaine (ligne ~418 de `page.tsx`), 99G touche
  `VueJour` (ligne ~1176) et `resumeDesTrous` (ligne ~1895+) : zones disjointes.
- `pnpm format:check` : vert avant le commit.
- `pnpm test` : **268 fichiers, 2886 tests, tous passés**, avant le commit.
- `CI=1 pnpm verify:full`, un seul appel au premier plan : sortie verte,
  **298 épreuves e2e passées, 3 ignorées, zéro échec** (1 worker).
  `format:check`, `typecheck`, `lint`, `test`, `test:isolation`, `build`,
  `feries:horizon` et `audit:partitions` ont tous réussi avant `test:e2e`.
  `tests/e2e/glisser-deposer.spec.ts` (l'épreuve instable connue) ne s'est pas
  déclenchée cette fois-ci.
- Captures ajoutées (voir plus bas) : `vue-jour-en-tete-apres-1280.png` montre
  « 4 techniciens · 1 agenda bloqué (D. Guérin) · 48 créneaux libres · pas de
  30 min » avec la légende visible sans défiler ; `vue-jour-en-tete-apres-375.png`
  montre le même en-tête à 375 px — vérifié visuellement sur les deux images.

## Ce que j'ai tranché et pourquoi

- **Application du diff fichier par fichier avec `git apply --3way`**, jamais
  `git checkout 99G-PLANNING-JOUR-inacheve -- <fichier>` : `page.tsx` et `fr.ts`
  ont reçu des écritures de 99J depuis la branche de sauvegarde, et un
  `checkout` les aurait effacées.
- **La capture `docs/propositions/99G-PLANNING-JOUR/captures/en-tete-et-legende-1280.png`
  a été régénérée en relançant le seul spec `planning-jour-en-tete.spec.ts`**
  (déjà produite une première fois pendant `verify:full`, puis écrasée par ce
  rejeu ciblé) plutôt que reprise telle quelle de la branche de sauvegarde : le
  fichier binaire de la branche datait du 25/09 et ne correspondait plus
  forcément au rendu couplé aux commits 99H/99I/99J entre-temps. Elle est
  committée avec ce lot car elle appartient au territoire de 99G
  (`docs/propositions/99G-PLANNING-JOUR/`) et est le produit direct de son
  propre spec e2e, pas une donnée inventée.
- **Les deux captures de ce lot ont été produites en insérant temporairement
  deux appels `page.screenshot()`** dans `tests/e2e/planning-jour-en-tete.spec.ts`,
  juste après le premier test (qui pose déjà la scène — un blocage réel sur
  D. Guérin, agence Ducos), en réutilisant sa scène et sa session. Le spec a
  ensuite été **rendu à son état commité** (`git checkout --`) : seules les
  images produites ont été gardées, `git diff --stat -- tests/e2e/planning-jour-en-tete.spec.ts`
  est vide après coup. Même patron que 99K-REPRISE-99I et 99L-REPRISE-99J.
- **Aucune nouvelle scène e2e forgée** pour les captures : réutilisation de la
  scène déjà montée par le spec d'origine (une absence, prefixée par un UUID,
  supprimée en fin de fichier par son propre `afterAll`).

## Ce que je n'ai PAS fait

- Aucune migration, aucune ligne de semis, aucun prix.
- Aucune logique changée par rapport à ce que 99G-PLANNING-JOUR avait écrit le
  25/09 — ce lot ne fait que committer un travail déjà fini.
- Je n'ai pas supprimé la branche `99G-PLANNING-JOUR-inacheve`.
- Je n'ai pas touché `depot/` ni `11-FILE.sh`.
- Les 61 PNG et le PDF déjà modifiés dans l'arbre de travail au démarrage de la
  session (captures d'autres propositions, effet de bord documenté par les
  passations précédentes de 99K et 99L) ont été laissés inchangés, jamais
  committés — ce lot n'en touche aucun.

## Les pièges pour la session suivante

- Même piège que 99K-REPRISE-99I et 99L-REPRISE-99J : `pnpm verify:full`
  recapture au passage une soixantaine de PNG sans rapport avec le ticket en
  cours — toujours vérifier `git status --porcelain` après coup et ne
  committer que le territoire du lot.
- Le diff complet de la branche de sauvegarde (`git diff --stat $BASE
  <branche>`) inclut souvent, en plus des fichiers de code du territoire, une
  capture déjà produite par le spec e2e du lot lui-même
  (`docs/propositions/<TICKET>/captures/*.png`) : elle appartient au
  territoire mais ne s'applique pas par patch binaire fiable — plus sûr de la
  régénérer en relançant le spec ciblé après le commit du code.
- Pour produire une capture d'un écran dont le spec e2e a déjà sa propre
  scène, réutiliser cette scène en ajoutant temporairement des appels
  `page.screenshot()` juste après les assertions, puis `git checkout --` sur
  le spec pour ne garder que les images.

## Ce qui reste à faire

Rien côté 99G-PLANNING-JOUR : le lot est fini, committé, vérifié vert dans son
entier et documenté. La file peut publier `ddc3786`. Les 61 fichiers étrangers
qui trainent dans l'arbre de travail restent à traiter par la session à qui ils
appartiennent (aucun n'a de trace dans les commits 99G/99H/99I/99J/99K/99L).
