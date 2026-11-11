# 9K26-TERRAIN-ALERTE-FIN-DESTINATAIRES — passation

Budget 120 min. T0 = 22:21 (Pacific/Noumea, 11/11/2026). Travaillé dans le worktree
`/home/aplou/codiplan-voie1`, `main` extrait ailleurs. Branche dédiée
`9K26-TERRAIN-ALERTE-FIN-DESTINATAIRES`, partant d'`origin/main` (`4eb9f0bea`, HEAD
détaché au démarrage). Jamais poussé.

## Ce qui a été fait

Suit l'audit (décision d'Alexis du 10/11 ~23:58, « Suivre l'audit ») : B1 (aucune alerte
ne part quand la société n'a plus de `responsable_sav` actif) et M1 (réussite et échec
de l'alerte dans le même bandeau rouge) sont corrigés en amendant D173 par **D241**
(`docs/arbitrages.md`).

1. `lib/avertissements/signature-terrain.ts` — `planerAlerteResponsables` tente
   d'abord chaque `responsable_sav` actif (inchangé), puis **replie sur chaque compte
   actif du bureau** (`ROLES_BUREAU`, nouveau dans `lib/auth/roles.ts` = `ROLES_INTERNES`
   moins `technicien`) si aucun SAV n'est actif. La notification interne porte
   `capaciteNotification`, qui vaut désormais `"valider_rapport"` pour le SAV (inchangé)
   ou `"consulter_clients_sites"` pour le repli — la SEULE capacité de la matrice
   (`lib/auth/habilitations.ts`) dont l'ensemble `complet` est exactement `ROLES_BUREAU`
   ; sans elle, un `adv` recevrait le courriel de repli sans jamais voir la notification
   (`valider_rapport` ne lui est pas ouverte). `type: "sans_destinataire"` ne voyage
   plus que si AUCUN compte de bureau n'est actif.
2. `app/api/terrain/[id]/terminer/route.ts` — deux clés indépendantes désormais :
   `motif` porte TOUJOURS `terrain.terminer.reussite` (vert) sur un « Terminer » réussi
   (silence absolu avant cette décision) ; `alerte` porte `terrain.terminer.alerte_non_partie`
   (ambre) SEULEMENT si l'alerte n'a atteint personne. La clé retirée,
   `terrain.terminer.alerte_sans_destinataire` (« … signalez-le vous-même »), n'existe
   plus. `versLaFiche`/`reponse` portent les deux paramètres par deux query params
   distincts (`?motif=…&alerte=…`), jamais un seul.
3. `app/(mobile)/terrain/[id]/page.tsx` — lit les deux paramètres et rend deux bandeaux
   indépendants : `BandeauMotif` (vert, inchangé) pour `motif`, et un `<Message
   ton="avertissement">` neuf pour `alerte`. `components/ui/bandeau-motif.tsx` gagne
   `terrain.terminer.reussite` dans sa liste fermée `CLES_REUSSITE` (15 désormais).
4. `app/(back-office)/tableau-de-bord/page.tsx` + `lib/tableau-de-bord/lectures.ts`
   (`aucunResponsableSavActif`) — un bandeau ambre (`Message`, même composant) sur le
   tableau de bord de l'administrateur de société ET de la direction (D91/D199 : la
   direction reçoit les mêmes blocs d'administration — pas nommé par l'audit, mais suit
   la doctrine déjà écrite plutôt que de la rouvrir) tant qu'aucun `responsable_sav`
   actif n'existe, avec un lien vers Équipe. **Le lien n'utilise délibérément PAS
   `CLASSES_LIEN`** : ce tableau de bord en est sorti (D185/D140, un gardien unitaire le
   tient) — même habillage que l'action de `Carte`, écrit en clair avec le commentaire
   qui l'explique.
5. `docs/arbitrages.md` — **D241**, amende D173 (points 4 et 5), avec le câblage
   bidirectionnel que les gardiens exigent (`**Amendé par D241.**` sur D173,
   `**Décisions amendées :** D173` sur D241, et la paire dans la liste fermée de
   `tests/unit/docs/amendements-arbitrages.test.ts`). **Chapitre 10 : mesuré, aucune
   règle n'y décrit les destinataires de cette alerte** (seules les lignes « pilote
   l'atelier » / « valide les rapports » du §253 du cahier des charges nomment le rôle,
   jamais ses destinataires de courriel) — aucun amendement du chapitre 10.

## Épreuves

- **Unitaires** (`pnpm test`, premier plan) : 519 fichiers / 5722 tests, y compris
  `tests/unit/ui/bandeau-motif.test.ts` (15 clés de succès) et
  `tests/unit/interventions/terrain-routes-json.test.ts` (trois cas `terminer` : succès
  seul, succès + alerte envoyée sans message ambre, succès + alerte non partie — bien
  DEUX champs JSON, `motif` et `alerte`, jamais un seul).
- **Isolation** (`pnpm test:isolation`, premier plan, REJOUÉ SEUL en dernier — voir
  « Base de test » ci-dessous) : 240 fichiers / 2152 tests, dont le nouveau
  `tests/isolation/signature-terrain-repli-bureau.test.ts` (5 cas) : repli sur le bureau
  quand le SAV est inactif (nombre exact : les DEUX comptes fixtures `adv` de la société
  A comptent, `UTILISATEUR_PAR_ROLE` et `UTILISATEUR_INTERNE_A`, mesuré plutôt que
  supposé) ; aucun destinataire quand bureau ET SAV sont inactifs, rien n'est posé ;
  cloisonnement société B ; `aucunResponsableSavActif` vrai/faux. Les comptes fixtures
  désactivés sont TOUJOURS restaurés en `finally`.
- **Bout en bout** (`pnpm exec playwright test`, premier plan) :
  `tests/e2e/9k26-alerte-fin-destinataires.spec.ts` (3 cas, sa propre scène `9K26-`,
  jamais touché aux comptes partagés) et `tests/e2e/tous-les-ecrans-rendent.spec.ts`
  (61 passés, 4 ignorés comme avant) rejoué entier pour `/terrain/[id]` et
  `/tableau-de-bord`.
- `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build` (`CI=1`) : tous verts,
  joués séparément au premier plan.

### Pourquoi le bandeau « aucun SAV actif » du tableau de bord n'est pas éprouvé en direct par l'écran (e2e)

Pour afficher ce bandeau il faut qu'AUCUN `responsable_sav` ne soit actif. Désactiver le
`responsable_sav` de la scène e2e (`COMPTE_RS_EPREUVE`) romprait d'autres scénarios
tournant en parallèle (`fullyParallel: true`) qui s'attendent à pouvoir s'y connecter —
même risque que pour les comptes de bureau du repli. L'état est donc prouvé par
`aucunResponsableSavActif` en isolation (silencieux, série, restauré), pas par une
capture d'écran du bandeau « présent ». La capture prise montre l'état par défaut
(bandeau absent).

### Base de test — un ordre qui compte (mesuré, pas une panne du code)

`TEST_DATABASE_URL` et `E2E_DATABASE_URL` visent la MÊME base locale (port 5441,
`.env`). Jouer un spec Playwright (sa préparation globale refait `migrate` + `db:seed`)
puis lancer `pnpm test:isolation` tout de suite après a fait échouer 3 tests du fichier
neuf avec des décomptes impossibles (un compte venant d'être désactivé se relisait
actif). `pnpm test:isolation` rejoué SEUL, sans rien d'autre entre les deux, est repassé
vert à l'identique (240/240, deux fois de suite). Le code n'est pas en cause — l'ordre
d'exécution des deux harnais sur la même base l'est. Mémoire mise à jour
(`poste-alexis-bases-de-test`) : ne jamais enchaîner Playwright puis `test:isolation`
sans laisser chacun rejouer SA PROPRE préparation globale juste avant de lire son
résultat.

## Captures

`docs/propositions/9K26-TERRAIN-ALERTE-FIN-DESTINATAIRES/captures/` — prises par
`tests/e2e/9k26-alerte-fin-destinataires.spec.ts` :
`terrain-reussite-seule-375.png`, `terrain-reussite-et-alerte-{375,1280}.png`,
`tableau-de-bord-admin-sans-bandeau-{375,1280}.png`.

**Ce qui n'a PAS été fait, et pourquoi** :

- **Pas de paire AVANT/APRÈS par `git worktree` sur `origin/main`** (la recette décrite
  dans la passation de 9K25A) pour l'ancien bandeau rouge « … signalez-le vous-même » :
  chiffré à 15-20 min (nouveau worktree, build complet, resemis) dans un budget déjà
  serré par cinq points de ticket ; les captures APRÈS ci-dessus suffisent à montrer le
  résultat, et le texte retiré est cité mot pour mot dans D241 et dans ce document.
- **`scripts/captures.mts` (la prise de vue OFFICIELLE de `docs/captures/`) n'a PAS été
  rejoué.** La procédure (`docs/captures/README.md`) exige un amorçage interactif —
  suivre un lien de premier accès pour choisir un mot de passe qui n'existe dans aucun
  fichier — incompatible avec une session non interactive sous budget serré. **À faire
  par Alexis ou dans une session dédiée** : rejouer la procédure complète et committer
  les captures à jour de `docs/captures/` avec le commit et la date lus à la machine
  (`ad4feee` y est daté du 27/09, largement périmé par d'autres lots déjà livrés —
  périmé avant ce ticket, pas par lui).

## Ce qui reste au geste d'Alexis

- **Créer un compte `responsable_sav` actif**, si une société en veut un désigné
  nommément — cette décision (D241) ne pose aucun réglage de destinataire choisi par
  société, elle déduit seulement des rôles actifs. La condition de réouverture de D241
  le dit explicitement.
- **Rejouer `scripts/captures.mts`** (voir ci-dessus).

## État final

```
git log --oneline -6
24051dc40 9K26-TERRAIN-ALERTE-FIN-DESTINATAIRES — captures AVANT/APRÈS de l'épreuve
8b1cc57f8 9K26-TERRAIN-ALERTE-FIN-DESTINATAIRES — point 5 : épreuve de bout en bout et captures
1693da260 9K26-TERRAIN-ALERTE-FIN-DESTINATAIRES — point 4-5 : D241, épreuves d'isolation
80e146bef 9K26-TERRAIN-ALERTE-FIN-DESTINATAIRES — point 1-3 : repli bureau, bandeaux distincts, bandeau admin
4eb9f0bea 9K25A-FEUILLE-DE-ROUTE-AUDIT-TECHNICIEN — point 4 : passation
```

Arbre propre, `git status --porcelain` vide. Jamais poussé.

## Reprise 9K26A — l'épreuve d'isolation rendue indépendante (12/11/2026)

Budget 60 min. T0 = 05:46 (Pacific/Noumea). Worktree `/home/aplou/codiplan-voie1`, `main`
extrait ailleurs. Branche `9K26A-REPRISE-ALERTE-FIN-EPREUVE-ISOLEE`, partant
d'`origin/main` ; les cinq commits de `9K26-TERRAIN-ALERTE-FIN-DESTINATAIRES-garde`
reportés par `cherry-pick`, sans conflit, sans les modifier. Jamais poussé.

**La cause mesurée au premier passage de `verify:full`** (pilote, 11/11 ~23:30) :
`tests/isolation/signature-terrain-repli-bureau.test.ts` comptait un nombre FIXE de
destinataires actifs dans `SOCIETE_A` — « les DEUX comptes fixtures `adv`... » (passation
ci-dessus, § Épreuves) — en ne (dés)activant que les comptes fixtures qu'IL connaissait
(`UTILISATEUR_PAR_ROLE`, `UTILISATEUR_INTERNE_A`). `SOCIETE_A` est PARTAGÉE par toute la
suite d'isolation (`fileParallelism: false`, un seul fichier à la fois, mais sans garantie
d'ordre entre fichiers) : dans la suite complète, deux comptes `responsable_sav` actifs
que ce fichier n'avait pas créés s'y trouvaient déjà, posés par un autre fichier. Seul, le
fichier passait (rien d'autre n'avait encore écrit dans `SOCIETE_A`) ; dans la suite,
`alerterResponsablesSAV` trouvait ces deux comptes SAV actifs AVANT de replier sur le
bureau, et les trois assertions qui comptaient sur le repli échouaient (`nombre: 2` au
lieu de `5`, `envoyee` au lieu de `sans_destinataire`, `aucunResponsableSavActif` resté
faux).

**Le correctif — aucune ligne de `lib/` touchée** (mesure : les deux fonctions éprouvées,
`alerterResponsablesSAV` et `aucunResponsableSavActif`, ne lisent que la société de leur
propre contexte, jamais `SOCIETE_A` par son nom ; rien n'indiquait un défaut de
cloisonnement, donc pas de point d'arrêt). Le fichier pose désormais, dans un `beforeAll`,
sa PROPRE société (`9K26A-REPLI`), son calendrier, son agence, son client, son site, et six
comptes neufs — les cinq rôles `ROLES_BUREAU` (`admin_societe`, `direction`,
`responsable_materiel`, `responsable_sav`, `adv`) plus un `technicien` pour le FK
`intervention.technicien_id` et pour le cas « le technicien ne voit pas la notification de
repli » — tous nettoyés en `afterAll` (ordre inverse des clés étrangères). Plus aucun
compte d'un autre fichier ne peut y entrer : la société n'existe que pour celui-ci.
Les nombres attendus changent en conséquence (4, pas 5 — cette société n'a qu'UN compte
`adv`, pas deux) mais restent un calcul déduit de la population que le fichier pose
lui-même, jamais de la base entière. Mêmes assertions, même structure de test, même
commentaire doctrinal (D241) conservé en tête.

**Écueil rencontré et corrigé** : le premier essai de création omettait
`utilisateur.modifie_le` (colonne `NOT NULL` sans défaut en base — `@updatedAt` n'est posé
par Prisma qu'au travers du client ORM, jamais par un `INSERT` SQL brut) ; `now()` ajouté à
l'`INSERT`.

### Épreuves (toutes au premier plan, comme demandé)

- `pnpm vitest run --project isolation tests/isolation/signature-terrain-repli-bureau.test.ts`
  seul : 5/5 verts, avant de rejouer la suite complète.
- `pnpm test:isolation` complet, **TROIS fois de suite** : 240 fichiers / 2152 tests,
  verts les trois fois, sans aucune modification entre les passages.
- `CI=1 pnpm exec playwright test tests/e2e/9k26-alerte-fin-destinataires.spec.ts --workers=1` :
  3/3 verts (captures non reprises — ticket 9K26 déjà porté, rien à refaire).
- `CI=1 pnpm exec playwright test tests/e2e/tous-les-ecrans-rendent.spec.ts --workers=1` :
  61 passés, 4 ignorés comme avant, aucun échec.
- `CI=1 pnpm verify` : vert (format, typecheck, lint, test, test:isolation, build).
- `pnpm verify:full` **non rejoué** — la file le joue après cette reprise, comme demandé.

### État final

```
git log --oneline -3
584cab911 9K26A-REPRISE-ALERTE-FIN-EPREUVE-ISOLEE — point 1 : épreuve indépendante de la population d'autres fichiers
d60f2b03a 9K26-TERRAIN-ALERTE-FIN-DESTINATAIRES — passation
e0896072b 9K26-TERRAIN-ALERTE-FIN-DESTINATAIRES — captures AVANT/APRÈS de l'épreuve
```

Arbre propre, `git status --porcelain` vide. Jamais poussé.
