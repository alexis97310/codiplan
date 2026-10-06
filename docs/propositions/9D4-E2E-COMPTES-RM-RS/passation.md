# 9D4-E2E-COMPTES-RM-RS — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

Cette session a REPRIS le travail d'une première session interrompue par un plantage du
poste (départ ~10:50, plantage ~11:30-11:55). Le travail de cette première session était
rangé sur `voie1-reste-1006-1407` ; je l'ai récupéré par `git cherry-pick` (deux commits,
`ecfdde65` et `dee196c1`), sans conflit, sans reprendre le commit « reste non commité »
`5149abad` (il ne contenait que des PNG de captures d'AUTRES tickets, étrangers à ce lot).

Rien n'a donc été réécrit par cette session : le travail ci-dessous est celui de la
première session, relu, mesuré, puis vérifié de bout en bout (`CI=1 pnpm verify:full`
intégralement vert, voir plus bas) avant d'être laissé sur `main` local.

Pour l'exploitation : la base d'épreuve e2e (locale, recréée à chaque exécution) ouvre
désormais deux identités supplémentaires, `rm@codima.test` et `rs@codima.test`, rôles
`responsable_materiel` et `responsable_sav`, société CODIMA-NC — **aucune des deux
n'existe au semis de démonstration ni de production** (`prisma/seed-data.ts` et
`prisma/seed.ts` n'ont pas été touchés). Un nouveau spec `tests/e2e/droits-rm-rs.spec.ts`
prouve, par l'écran et par le serveur, ce que ces deux rôles voient et ce qu'ils ne
peuvent pas faire — preuve qui n'existait pas avant ce ticket (constats des relectures de
9DG R1 et de 9DH).

Un commit séparé (addendum) corrige sept constats de la relecture de 9DI publiée en
`a058705c` : trois assertions e2e trop larges resserrées (T1, T2), une épreuve de bandeau
de succès ajoutée (T3), un commentaire faux corrigé (T4), une clé i18n morte retirée (T5),
et un vrai bug de présentation corrigé (T7) : le bandeau « compteur en cours » affichait
l'heure dans le fuseau de la fiche CONSULTÉE plutôt que celui de l'agence de
l'intervention où le compteur tourne réellement — un écart de fuseau entre deux agences
(D5, surchargeable) aurait affiché une heure fausse à l'écran. Ce dernier point touche du
code de production (`lib/interventions/depot-compteur.ts`,
`app/(mobile)/terrain/[id]/page.tsx`, `components/terrain/bandeau-compteur.tsx`), pas
seulement des tests.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

AVANT ce ticket : trois comptes connectables dans la scène e2e — `adv@codima.test`
(`tests/e2e/setup/scene.ts:59`), `garnier@codima.test` (technicien, `:75`),
`admin.societe@codima.test` (`:90`). Aucun compte `responsable_materiel` ni
`responsable_sav`.

APRÈS : cinq comptes. Les deux nouveaux (`COMPTE_RM_EPREUVE` = `rm@codima.test`,
`COMPTE_RS_EPREUVE` = `rs@codima.test`) sont ouverts par `ecrireLesComptesRmEtRs` dans
`tests/e2e/setup/scene.ts`, appelée depuis `tests/e2e/setup/global.ts` AVANT
`ouvrirLeCompteDeLEpreuve` — même mot de passe d'épreuve que les trois autres, même
chemin de premier accès, aucun second facteur (ni l'un ni l'autre n'est dans
`ROLES_SECOND_FACTEUR_OBLIGATOIRE`, `lib/auth/roles.ts`).

Mesuré par l'exécution complète de la suite e2e sous `CI=1 pnpm verify:full` :
**979 tests passés, 7 ignorés (skip), 0 échec**, 38,6 minutes, 1 worker. Ceci confirme
qu'AUCUN autre spec (notamment les écrans équipe/accès qui comptent les utilisateurs) n'a
été perturbé par les deux comptes ajoutés — la crainte nommée dans le ticket
(« Nettoyage : aucun autre test ne doit voir ses comptes changer ») est levée par cette
mesure, pas par une relecture à l'œil.

`pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test` (4103 tests unitaires) ont
aussi été rejoués isolément avant le `verify:full` complet : tous verts.

## Ce que j'ai tranché et pourquoi

- **Ne pas reprendre le commit `5149abad`** (« reste non commité de la voie 1 ») : il ne
  contenait que 45 fichiers PNG, tous des captures d'AUTRES tickets (badges, bandeaux de
  transmission, absences, bons...), aucun fichier du lot 9D4. Le conserver aurait mélangé
  deux lots dans un même historique sans raison. Il reste accessible sur
  `voie1-reste-1006-1407` pour la session qui en aura besoin.
- **Le timeout observé une fois sous charge parallèle n'est pas un défaut à corriger** :
  lors d'une exécution combinée de plusieurs fichiers e2e sous 6 workers (hors
  `verify:full`, une vérification manuelle que j'ai faite avant le `verify:full` complet),
  `tests/e2e/9di-tp-ter1-journee-fiche.spec.ts:322` a dépassé son délai de 30 s en
  attendant le bouton « Démarrer l'intervention ». Rejoué isolément (1 worker), les 4
  tests du fichier passent en 1,1 min. Rejoué dans `CI=1 pnpm verify:full` (1 worker,
  comme en CI), toute la suite passe sans ce symptôme. Cette session n'a pas modifié ce
  fichier : le symptôme est une contention de ressources sous forte parallélisation
  locale, pas une régression — je le nomme ici sans y toucher, conformément à la règle
  « ne corrige jamais l'assertion, nomme-la ». Comme `verify:full` (la vérité de CI,
  1 worker) est intégralement vert, je ne considère pas ceci comme un rouge au sens de
  la règle « deux rouges et tu t'arrêtes » (l'épreuve n'a pas rougi deux fois dans les
  MÊMES conditions).

## Ce que je n'ai PAS fait

- Aucune migration, aucune ligne de semis (`prisma/seed.ts`, `prisma/seed-data.ts`)
  touchée — conforme à l'interdit du ticket et à la décision d'Alexis du 05/10 (n°8).
- Je n'ai pas rouvert ni retranché aucun des sept points T1-T7 de l'addendum au-delà de ce
  que la première session avait déjà écrit : je les ai relus et mesurés (tous verts dans
  `verify:full`), sans les récrire.
- Je n'ai pas cherché à investiguer plus loin le flake de timeout sous parallélisme — il
  ne touche aucun fichier de ce lot et `verify:full` (la référence) est vert.

## Les pièges pour la session suivante

- Les branches `voie1-reste-1006-0735`, `voie1-reste-1006-0458`, `voie1-reste-1006-0213`
  et les autres plus anciennes sont des instantanés successifs d'AUTRES sessions/lots : ne
  pas les confondre avec `voie1-reste-1006-1407`, la seule qui portait ce ticket. Je n'ai
  supprimé aucune branche `voie*-reste-*`.
- `tests/e2e/9di-tp-ter1-journee-fiche.spec.ts` est en `mode: "serial"` avec sa propre
  fixture (créée/détruite par `beforeAll`/`afterAll`) : si une future session y ajoute un
  test, l'ordre dans le fichier compte (chaque test suppose l'état laissé par le
  précédent) — bien lire les commentaires `// ──` qui marquent les étapes avant d'insérer
  un nouveau test au milieu.
- Le fichier `tests/e2e/setup/scene.ts` a maintenant deux chemins d'ouverture de compte :
  `ouvrirUneIdentiteDeLEpreuve` (nouveau, générique, pour RM/RS) et le reste de la scène
  (les trois comptes historiques). Si un sixième compte de rôle doit s'ajouter un jour,
  réutiliser `ouvrirUneIdentiteDeLEpreuve` plutôt que dupliquer son corps.

## Ce qui reste à faire

Rien côté ce ticket : les cinq étapes demandées (mesure, deux comptes, spec de droits,
captures, `verify:full`) sont faites et vertes. Le fichier a été rebasé sur
`origin/main` juste avant de rendre la main (voir ci-dessous) ; aucun conflit.
