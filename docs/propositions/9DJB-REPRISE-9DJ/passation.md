# 9DJB-REPRISE-9DJ — passation

## Ce que j'ai changé, et ce que ça change pour l'exploitation

Rejoué les cinq commits de la garde `9DJA-REPRISE-9DJ-garde` sur `origin/main`
à jour (`d701380`, qui porte déjà 9D0-E2E-PGA6-DIMANCHE — la correction de la
cause probable identifiée par l'addendum du pilote) :

```
git log --oneline origin/main -5
d701380 9D0-E2E-PGA6-DIMANCHE — le spec vise la semaine Nouméa, pas la date UTC
4de636a 9DEB-REPRISE-9DE — passation
bb9bee7 9DEB-REPRISE-9DE — captures rejouées après rejeu de la garde sur main
761a4be 9DEB-REPRISE-9DE — D153 devient D173 (collision avec 9DH publié), rejeu de la garde sur main
02e9b91 9DEA-REPRISE-9DE — D152 devient D153, captures rejouées après rebase, passation de reprise

git log --oneline origin/main..9DJA-REPRISE-9DJ-garde
4d5377e 9DJA-REPRISE-9DJ — captures AVANT/APRÈS de 9DJ, jamais prises par la session d'origine
b5ffcc3 9DJ-TP-ACC1-DONNER-ACCES — passation
71a44db 9DJ-TP-ACC1-DONNER-ACCES — épreuve de bout en bout : envoyer l'accès, choisir le mot de passe, traiter l'intervention (D162)
d2e8a27 9DJ-TP-ACC1-DONNER-ACCES — épreuves unitaires et d'isolation d'envoyerLienDAcces (D162)
6951284 9DJ-TP-ACC1-DONNER-ACCES — l'administrateur de la société envoie le lien d'accès d'un technicien (D162)
```

Pour l'exploitation, rien de nouveau par rapport à ce que 9DJ et 9DJA avaient
déjà fait atterrir : un administrateur de société peut, depuis Équipe,
donner ou redonner l'accès à un technicien déjà créé (D162). Ce lot-ci ne
fait que rejouer ce contenu, inchangé, sur un `origin/main` qui a reçu la
correction de date (9D0) depuis la dernière vérification, et établir — par
la mesure plutôt que par l'hypothèse — si les deux rouges rencontrés par
9DJA étaient bien dus à la charge de la machine.

**Les cinq cherry-pick se sont appliqués SANS AUCUN CONFLIT**, à la
différence du rejeu précédent (9DJA avait dû fusionner trois fichiers :
`docs/arbitrages.md`, `lib/i18n/fr.ts`, `tests/unit/auth/porte.test.ts`).
Vérifié après coup : le compte de routes dans `porte.test.ts` est bien resté
à **70** (confirmé par `pnpm exec vitest run tests/unit/auth/porte.test.ts`,
19/19 verts), et `grep` ne trouve aucun marqueur de conflit résiduel
(`<<<<<<<`, `=======`, `>>>>>>>`) dans tout le dépôt.

## Ce que j'ai mesuré

- **`pnpm format:check`** : vert.
- **`pnpm typecheck`** : vert, zéro erreur.
- **`pnpm lint`** : vert, zéro avertissement.
- **`pnpm test`** (unitaire) : **373 fichiers / 3936 tests, vert** — identique
  au compte AVANT de la passation 9DJA (aucune régression de compte).
- **`pnpm test:isolation`** : **152 fichiers / 1378 tests, vert**.
- **`pnpm build`** : vert.
- **`pnpm feries:horizon`** : vert (2 territoires, horizon jusqu'à
  2028-12-25 pour FR et NC).
- **`pnpm audit:partitions`** : vert (13 partitions couvertes jusqu'à
  2027-10, partition par défaut présente et vide).
- **`CI=1 pnpm test:e2e`, le complet, mesuré UNE fois** : **824 passés, 7
  ignorés, ZÉRO échec** (33,7 minutes). Aucun rouge à diagnostiquer, aucun
  test à rejouer seul, aucune classification VRAI DÉFAUT / SENSIBLE À LA
  CHARGE à produire — la liste est vide parce qu'il n'y a rien dedans.
  **Contexte de charge pendant cette mesure, vérifié par `ps aux` et non
  supposé** : un `pnpm test:e2e` du worktree `codiplan-voie1` était actif
  sur la même machine à partir d'environ 20:25 (heure locale), soit pendant
  une partie de mon propre run (20:14–20:48 local). La mesure n'est donc pas
  totalement exempte de contention — mais elle est verte quand même. Ça ne
  prouve pas que la charge n'a jamais causé de rouge ailleurs ; ça montre
  que, cette fois-ci, avec 9D0 déjà sur `origin/main`, la suite complète
  passe de bout en bout sans qu'une seconde tentative, un rejeu isolé ou une
  correction de code aient été nécessaires.
- `tests/e2e/acces-technicien.spec.ts` et
  `tests/e2e/captures-9dja-acces-technicien.spec.ts` (le territoire propre à
  9DJ/9DJA) figurent tous deux dans les 824 verts de cette mesure complète.
- Captures AVANT/APRÈS : aucune régénération nécessaire — aucune ligne de
  code de 9DJ n'a changé dans ce lot, et les 12 PNG de
  `docs/propositions/9DJ-TP-ACC1-DONNER-ACCES/captures/` pris par 9DJA
  restent ceux rejoués par le cherry-pick, sans écart.

## Ce que j'ai tranché, et pourquoi

- **`main` local reste verrouillé par un AUTRE worktree**
  (`/home/aplou/codiplan`, à `ca348d2`, derrière `origin/main`) — même
  constat que 9DJA et 9DHA avant lui : `git checkout main` est refusé par
  git (« used by worktree »). Forcer la référence par `git branch -f` ou
  `git update-ref` aurait désynchronisé le `HEAD`/index de ce worktree pour
  une session qui le reprendrait, un risque hors du périmètre de ce ticket.
  **J'ai donc travaillé sur une branche locale nommée `9DJB-REPRISE-9DJ`**,
  créée depuis `origin/main` à jour (`d701380`). Mes commits sont des
  commits LOCAUX, jamais poussés, jamais sur la branche `main` locale — la
  file, qui lit le dépôt partagé entre les worktrees, les retrouvera par ce
  nom.
- **Pas de cinquième rejeu de `test:e2e` pour « confirmer » le vert** :
  l'instruction du ticket demande UNE mesure et, pour chaque rouge, un
  diagnostic — il n'y a eu aucun rouge à ce tour-ci. Relancer la suite
  complète une deuxième fois (≈34 minutes) n'aurait rien appris de plus
  qu'un deuxième point de donnée, au prix d'une bonne partie du budget de
  210 minutes de ce lot ; le temps restant est mieux employé à boucler la
  passation et le commit, conformément à la règle « commite d'abord ».
- **Aucune ligne de code de 9DJ retouchée** : la vérification est verte sur
  le contenu exact de la garde, cherry-pické sans conflit. Modifier quoi que
  ce soit sans un rouge à corriger aurait été un geste hors mandat.
- **Au rebase final sur `origin/main`** (fait avancer entre temps par
  `9DFA-REPRISE-9DF`, qui a ajouté D160), un conflit D'AJOUT dans
  `docs/arbitrages.md` : HEAD portait D160 (9DF), le rejeu portait D162
  (9DJ), les deux au même endroit, en fin de fichier. **Les deux gardés,
  dans l'ordre HEAD puis rejeu** (D160, puis D162) — le fichier n'est pas
  trié par numéro de décision (D153 puis D164 puis D173 s'y suivent déjà
  dans cet ordre non numérique), c'est un journal d'ajouts chronologiques ;
  aucune des deux décisions ne touche au sens de l'autre (l'une porte sur le
  cycle de vie d'une intervention, l'autre sur l'émission d'un lien
  d'accès), et `D162 ≠ D160` ne crée aucune collision. `lib/i18n/fr.ts` et
  `tests/unit/auth/porte.test.ts` se sont fusionnés sans conflit cette fois
  (9DF n'a touché ni les mêmes clés i18n, ni le compte de routes gardées,
  resté à 70, vérifié après coup par
  `pnpm exec vitest run tests/unit/auth/porte.test.ts`, 21/21 verts — les
  deux tests de plus viennent de 9DF, pas de ce lot). `pnpm verify` rejoué
  intégralement après ce rebase : vert. Les deux specs e2e du lot
  (`acces-technicien.spec.ts`, `captures-9dja-acces-technicien.spec.ts`)
  rejoués seuls après le rebase : 2/2 verts.

## Ce que je n'ai PAS fait

- **Je n'ai pas prouvé que la charge est LA cause exclusive des deux rouges
  de 9DJA** (11:22 et 11:59) — je n'ai mesuré qu'un run propre après coup,
  sur un `main` qui porte désormais 9D0. Les deux hypothèses restent
  cohérentes avec cette seule mesure (9D0 a corrigé un vrai rouge
  déterministe ; la charge aggravait un système déjà fragile le dimanche) et
  je n'ai pas isolé laquelle pèse le plus, puisqu'aucune seconde mesure sous
  charge contrôlée n'a été prise.
- **Je n'ai pas rejoué `test:e2e` une deuxième fois** pour corroborer le
  résultat (voir « Ce que j'ai tranché »).
- **Je n'ai pas tenté de déplacer la référence `main`** du worktree qui la
  détient — hors périmètre, comme pour 9DJA.
- **Je n'ai pas fait valider D162 par Alexis** — toujours « à valider »,
  comme avant ce lot.
- **Je n'ai pas touché au geste d'amorçage ni à sa migration** (D65 point 4,
  explicitement hors de ce lot).

## Les pièges pour la session suivante

- **`main` local reste verrouillé par `/home/aplou/codiplan`** au moment où
  je rends la main. Si une session y a accès et veut faire avancer la
  branche `main` LOCALE jusqu'à `9DJB-REPRISE-9DJ`, un
  `git merge --ff-only 9DJB-REPRISE-9DJ` depuis ce worktree suffit (aucun
  retravail de contenu) — seulement si ce worktree n'a pas de travail en
  cours qui en dépendrait.
- **`git status --porcelain` listait, en tout début de session, des
  dizaines de PNG de captures d'anciens tickets (47 à 9DW) modifiés par un
  simple `pnpm test` unitaire antérieur à ma session** (déjà noté par
  9DJA), puis **à nouveau après MON PROPRE `test:e2e`**, plus quatre PNG
  neufs et non suivis dans `47-AVERTISSEMENTS-1` et
  `9BV-TP-A5b-DATES-REPRISE`. Aucun de ces fichiers n'appartient au
  territoire de 9DJ : les modifiés ont été restaurés (`git checkout --`),
  les quatre neufs supprimés, avant tout commit. Un spec `captures-*.spec.ts`
  plus ancien régénère ses PNG à chaque run complet, sans garde
  `DOSSIER === "" → ne rien écrire` — à corriger un jour, mais hors mandat
  de ce ticket.
- **La machine est partagée en continu** : au moment où j'écris cette
  passation, `codiplan-voie1` fait encore tourner son propre `test:e2e`.
  Toute vérification solo sur cette machine reste à la merci d'un voisin
  qui démarre une suite lourde à un instant donné — vert aujourd'hui ne
  garantit pas vert dans l'absolu, seulement vert pour CETTE mesure.

## Ce qui reste à faire

- Si un futur rouge réapparaît sur ce territoire (Équipe, connexion, mot de
  passe oublié, premier accès), rejouer le test seul avant de conclure à
  une régression — la charge partagée de la machine reste une cause
  possible, documentée ci-dessus mais pas définitivement écartée.
- Faire valider D162 par Alexis.
- Le retrait du geste d'amorçage (D65 point 4) — lot suivant, avec sa
  migration.
- Si une politique RLS ou une autre source honnête permet un jour de savoir
  qu'une identité est habilitée dans une autre société sans violer D34,
  implémenter le quatrième refus nommé par le ticket d'origine (condition
  de réouverture de D162).
- Faire avancer la branche `main` locale jusqu'à `9DJB-REPRISE-9DJ` dès que
  le worktree qui la détient est libre (voir « pièges » ci-dessus).
