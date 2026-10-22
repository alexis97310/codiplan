# 9G9C-CARTES-FICHES — passation

## Reprise 9G9CA (22/10/2026)

**Point de départ** : le lot 9G9C (cartes des fiches, audit visuel D140) avait une
vérification indépendante VERTE au premier passage, mais sa publication (16:38) a
rencontré un CONFLIT au rebase sur `main`, parce que la voie 1 avait publié entre-temps
`9F5CA-REPRISE-9F5C` (`5beed3f7`), qui touchait le même fichier
`app/(back-office)/interventions/page.tsx` (bouton « Transmettre » de la ligne du
registre). Rien n'a été publié ; le travail est resté sur la branche
`9G9C-CARTES-FICHES-garde`.

**Fichier en conflit** : `app/(back-office)/interventions/page.tsx` — un seul fichier.

**Résolution** : `git checkout -b 9G9CA-REPRISE-9G9C 9G9C-CARTES-FICHES-garde` puis
`git rebase origin/main`. Le rebase s'est appliqué **sans conflit** (les deux
changements portent sur des zones disjointes du fichier : 9F5CA sur la logique du
bouton de ligne, 9G9C sur l'habillage de la table de bureau, remplaçant la `<section>`
par `<CarteConteneur>`). Vérifié explicitement par diff :

- `git diff origin/main -- app/(back-office)/interventions/page.tsx` : seul le
  changement d'apparence 9G9C (import de `Carte as CarteConteneur`, remplacement de la
  `<section>` par `<CarteConteneur>` autour du tableau) apparaît — rien de la logique
  de 9F5CA n'est touché ni annulé.
- Entre `5beed3f7` (état 9F5CA) et `origin/main` courant (`bde30d72b`, après le lot
  9F4H6F), aucun autre commit n'a touché ce fichier : le seul conflit annoncé par le
  pilote est bien le seul à traiter.

**Vérifications** (après rebase) :
- `tests/unit/ui/carte-pas-recopiee.test.ts` : vert (3 tests).
- `pnpm format` (rien à reformater), `pnpm typecheck`, `pnpm lint`, `pnpm test`
  (468 fichiers, 5046 tests) : verts.
- `tests/e2e/registre-1.spec.ts`, `registre-2.spec.ts`, `registre-3.spec.ts`,
  `registre-5.spec.ts`, `registre-filtre-agence-inactive.spec.ts`,
  `registre-ux3-1.spec.ts`, `registre-ux3-2.spec.ts`,
  `tests/e2e/9f5c-date-passee-planning.spec.ts` : 43 tests passés.
- `CI=1 pnpm verify:full` : `verify` (format:check, typecheck, lint, test,
  test:isolation, build), `feries:horizon`, `audit:partitions` tous verts. `test:e2e`
  interrompu par la limite d'1h de l'outil (même motif que les lots précédents,
  tracé dans `verify-final.txt`) — aucun échec constaté dans la trace partielle (aucun
  marqueur d'échec, un seul avertissement déjà connu sur une capture non prise pour
  « En retard »), seulement l'interruption au milieu de la suite.

**Captures** : les captures 375/1280 de 9G9C (`docs/propositions/9G9C-CARTES-FICHES/captures/`)
sont celles produites par le lot d'origine ; non régénérées ici, le composant `Carte`
reproduisant l'habillage visuel de l'ancienne `<section>` (même fond, bordure, coins
arrondis) et le seul changement du fichier `interventions/page.tsx` étant interne à ce
remplacement, sans effet attendu sur le rendu capturé du registre.

**Point ouvert** : `tickets/recales/9G9C-CARTES-FICHES.md`, cité comme contrat par la
mission de reprise, n'existe dans aucune branche ni aucun worktree accessible
(`codiplan`, `codiplan-voie1`, `codiplan-voie2`) — probablement nettoyé après la
clôture du ticket. La reprise s'est appuyée sur le contenu de la branche
`9G9C-CARTES-FICHES-garde` et sur le brief de la mission 9G9CA.

**État final** : branche `9G9CA-REPRISE-9G9C`, rebasée sur `origin/main` (même base),
arbre propre, prête à publier. Rien de neuf : ce lot ne fait que porter 9G9C sur `main`.
