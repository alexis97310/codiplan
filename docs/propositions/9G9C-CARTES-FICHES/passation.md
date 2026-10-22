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

## Reprise 9G9CB (23/10/2026)

**Point de départ** : la 2e vérification de 9G9CA était VERTE
(`1fd7abbd8`), mais pendant ce temps la voie 1 a publié
`9G1-CORRECTIFS-AUDIT-URGENTS` (`f66cce0ec`, 21:35) — 2e CONFLIT annoncé au rebase.
`main` est extrait ailleurs (`/home/aplou/codiplan`, branche `main`) : par consigne de
la mission, le travail s'est fait sur une branche dédiée, `9G9CB-REPRISE-9G9CA`, créée
depuis la branche de garde `9G9CA-REPRISE-9G9C-garde` puis rebasée sur `origin/main`.

**Fichiers annoncés en conflit par le pilote** (hors docs/tests, entre `bde30d72` et
`f66cce0e`) : `clients/[id]/page.tsx`, `imports/[id]/page.tsx`,
`imports/presentation.ts`, `planning/page.tsx`, `sites/nouveau/page.tsx`,
`sites/page.tsx`, `tableau-de-bord/page.tsx`, `vgp/a-determiner/page.tsx`,
`components/tableau-de-bord/select-priorites.tsx`,
`components/terrain/rapport-automatique.tsx`, `lib/i18n/fr.ts`. Fiches communes avec
9G9C : `clients/[id]`, `imports/[id]`, `sites`, `vgp/a-determiner`.

**Résolution** : `git rebase origin/main` sur `9G9CB-REPRISE-9G9CA` s'est appliqué
**sans conflit textuel** — les 11 commits de la garde se sont rejoués proprement, git
ayant pu fusionner automatiquement parce que, dans chaque fichier commun, les deux
lots touchent des zones disjointes (9G1 des libellés/filtres/comportements, 9G9C
l'habillage `<section>` → `<Carte>`). Vérifié explicitement par diff, fichier par
fichier, entre `origin/main` (`f66cce0ec`) et la branche rebasée :

- `clients/[id]/page.tsx` : seuls les encadrés passent par `Carte` (dont
  `data-bloc="historique-client-apercu"` repris via la prop `bloc`) ; les deux
  correctifs 9G1 (`t("interventions.titre")` au lieu de `t("intervention.titre")`,
  et `t("clients.fiche.synthese.sites_actifs")` au lieu de `mot("site", true)` pour
  le KPI) sont intacts.
- `imports/[id]/page.tsx` : seuls les encadrés passent par `Carte` ; la logique 9G1
  du point 4 (`aucuneLigneAAppliquer` / état « aucune ligne à appliquer », import de
  `../presentation.ts`) est intacte, de même que le commentaire « LES DEUX GESTES » et
  le lien de téléchargement des rejets.
- `imports/presentation.ts` : aucun diff contre `origin/main` — 9G9C ne touche pas ce
  fichier, `aucuneLigneAAppliquer` (9G1) y est seul.
- `sites/page.tsx` : seul le formulaire de recherche passe par `Carte` ; les filtres
  9G1/antérieurs (`zone_geo`, `agence_id`, le champ caché `sans_equipement`) voyagent
  tels quels dans le formulaire.
- `sites/nouveau/page.tsx` : seuls les deux encadrés latéraux (sites existants, aide
  d'usage) passent par `Carte` ; le refus d'emblée sur client inactif (9G1 point 8,
  `data-motif="site.refus.client_inactif"`, `RefusAcces`) est hors de la zone touchée,
  intact.
- `vgp/a-determiner/page.tsx` : seule la `<section>` du tableau passe par `Carte` ; le
  lien « Décider » (colonne `decider`) est hors de la zone touchée, intact.
- `planning/page.tsx`, `tableau-de-bord/page.tsx`,
  `components/tableau-de-bord/select-priorites.tsx`,
  `components/terrain/rapport-automatique.tsx`, `lib/i18n/fr.ts` : **aucun diff**
  contre `origin/main` — 9G9C ne les touche pas, le contenu 9G1 y est seul et intact.
  Aucun doublon de clé i18n possible : 9G9C n'ajoute aucune clé.

**Vérifications** (après rebase) :
- `tests/unit/ui/carte-pas-recopiee.test.ts` : vert.
- `tests/e2e/registre-1.spec.ts`, `registre-2.spec.ts`, `registre-3.spec.ts`,
  `registre-5.spec.ts`, `registre-filtre-agence-inactive.spec.ts`,
  `registre-ux3-1.spec.ts`, `registre-ux3-2.spec.ts`,
  `9f5c-date-passee-planning.spec.ts`, `zz-captures-9g1-correctifs.spec.ts`,
  `sites-nouveau-client-inactif.spec.ts`, `vgp-a-determiner-lien.spec.ts`,
  `imports.spec.ts`, `imports-detail-rejet.spec.ts`, `clients-sites-vues.spec.ts`,
  `sites.spec.ts`, `zz-captures-9g9c.spec.ts` : **94 tests passés**, 0 échec.
- `CI=1 pnpm verify:full` (trace complète dans `verify-final.txt`) : `format:check`,
  `typecheck`, `lint`, `test` (468 fichiers, 5055 tests), `test:isolation` (186
  fichiers, 1649 tests), `build`, `feries:horizon`, `audit:partitions` tous verts.
  `test:e2e` : 1404 tests passés, 18 ignorés (`°`, déjà connus), **0 échec constaté**
  dans la trace avant l'interruption par la limite d'1h de l'outil (même motif que les
  lots précédents — pas un échec mesuré).

**Captures** : celles de 9G9C (`docs/propositions/9G9C-CARTES-FICHES/captures/`) sont
présentes (34 fichiers, 375/1280 px) ; non régénérées — aucun des fichiers touchés par
9G1 n'a d'effet sur le rendu capturé du registre `/interventions` (fichier non modifié
par ce lot), et les quatre fiches communes ne gagnent que l'habillage `Carte` déjà
capturé par le lot d'origine.

**Point ouvert, inchangé depuis 9G9CA** : `tickets/recales/9G9C-CARTES-FICHES.md`,
cité comme contrat, n'existe dans aucune branche ni aucun worktree accessible
(`codiplan`, `codiplan-voie1`, `codiplan-voie2`) ni ailleurs sur le système de
fichiers — recherché explicitement cette fois (`find / -iname tickets`, aucun
résultat). La reprise s'est appuyée sur le contenu de la branche de garde et sur le
brief détaillé de la mission 9G9CB.

**État final** : branche `9G9CB-REPRISE-9G9CA`, rebasée sur `origin/main`
(`f66cce0ec`), arbre propre, prête à publier. `main` étant extrait dans un autre
worktree (`/home/aplou/codiplan`), ce travail n'a pas été fait sur une branche nommée
`main` localement — la file publiera ce HEAD. Rien de neuf : ce lot ne fait que porter
9G9C sur `main`, aucun comportement de 9G1 ni de 9F5CA ne change.
