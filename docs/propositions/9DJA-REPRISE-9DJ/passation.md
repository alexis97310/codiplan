# 9DJA-REPRISE-9DJ — passation

## Ce que j'ai changé, et ce que ça change pour l'exploitation

Rejoué les quatre commits de la garde `9DJ-TP-ACC1-DONNER-ACCES-garde` sur
`origin/main` à jour (`4de636a`, qui porte déjà 9DM-TP-DEM1-TRAITEES-REUTILISATION
— D164 — et 9DE-TP-CY1-TERMINER-SIGNATURE — D173) :

```
git log --oneline origin/main -5
4de636a 9DEB-REPRISE-9DE — passation
bb9bee7 9DEB-REPRISE-9DE — captures rejouées après rejeu de la garde sur main
761a4be 9DEB-REPRISE-9DE — D153 devient D173 (collision avec 9DH publié), rejeu de la garde sur main
02e9b91 9DEA-REPRISE-9DE — D152 devient D153, captures rejouées après rebase, passation de reprise
e221c8b 9DE-TP-CY1-TERMINER-SIGNATURE — passation

git log --oneline origin/main..9DJ-TP-ACC1-DONNER-ACCES-garde
4426a8a 9DJ-TP-ACC1-DONNER-ACCES — passation
b03a219 9DJ-TP-ACC1-DONNER-ACCES — épreuve de bout en bout : envoyer l'accès, choisir le mot de passe, traiter l'intervention (D162)
19e28fe 9DJ-TP-ACC1-DONNER-ACCES — épreuves unitaires et d'isolation d'envoyerLienDAcces (D162)
b97cd5c 9DJ-TP-ACC1-DONNER-ACCES — l'administrateur de la société envoie le lien d'accès d'un technicien (D162)
```

Pour l'exploitation, 9DJ entre enfin en vigueur : un administrateur de société
peut, depuis Équipe, donner ou redonner l'accès à un technicien déjà créé
(D162), ce qui était jusqu'ici impossible hors du geste d'amorçage réservé à
la toute première identité. Rien de fonctionnel n'a changé par rapport au
contenu de la garde — ce lot ne fait que la faire atterrir proprement sur un
`main` qui a bougé pendant sa vérification, et prendre les captures que la
session d'origine n'avait pas prises.

### Les trois conflits, et ce qui a été gardé

Trois fichiers en conflit au premier `git cherry-pick b97cd5c` (les trois
commits suivants se sont appliqués sans conflit) :

- **`docs/arbitrages.md`** — conflit d'ajout en fin de fichier : HEAD portait
  D164 (9DM) puis D173 (9DE), la garde ajoutait D162 (9DJ) au même endroit.
  **Les deux apports gardés, dans l'ordre HEAD puis garde** (D164, D173, puis
  D162) — aucune des trois décisions ne touche au sens d'une autre, aucun
  renumérotage nécessaire (`D162 ≠ D164 ≠ D173`, vérifié avant et après par
  `grep -n '^## D1[5-7][0-9]' docs/arbitrages.md`).
- **`lib/i18n/fr.ts`** — même forme de conflit : HEAD ajoutait les clés
  `terrain9de.e2e.*` (9DE), la garde ajoutait `equipe.acces.*` et
  `mot_de_passe_oublie.*` (9DJ) à la fin du dictionnaire. **Les deux blocs
  gardés, à la suite.**
- **`tests/unit/auth/porte.test.ts`** — conflit sur le COMMENTAIRE et le
  COMPTE de routes gardées : HEAD disait 69 (après la route neuve de 9DE),
  la garde disait 69 aussi mais pour SA propre route neuve
  (`/api/equipe/[id]/envoyer-acces`), sans compter celle de 9DE. **Compte
  corrigé à 70** (69 de HEAD + 1 route de 9DJ), commentaire fusionné pour
  garder l'historique des trois incréments (9CP → 68, 9DE → 69, 9DJ → 70).

Aucun conflit ne touchait le SENS d'une décision : les trois étaient des
ajouts côte à côte, jamais une même ligne modifiée par les deux apports.

## Ce que j'ai mesuré

- **`pnpm format:check`, `pnpm typecheck`, `pnpm lint`** : verts, à chaque
  étape (après le rejeu, après l'ajout de la clé de capture, après l'ajout du
  spec de capture).
- **`pnpm test`** (unitaire) : **373 fichiers / 3936 tests, vert** — AVANT
  (passation de 9DJ) : 374 fichiers / 3916 tests ; la différence vient de
  9DM et 9DE, déjà sur `origin/main`, pas de ce lot.
- **`pnpm test:isolation`** : **152 fichiers / 1378 tests, vert**.
- **`pnpm build`** : vert.
- **`pnpm feries:horizon`** : vert (2 territoires, horizon ≥ 12 mois).
- **`pnpm audit:partitions`** : vert (13 partitions, horizon jusqu'à 2027-10,
  partition par défaut vide).
- **`pnpm test:e2e`, le complet** : **mesuré TROIS FOIS, et les trois fois
  perturbé par une contention de ressources partagée avec d'autres sessions
  tournant SUR LA MÊME MACHINE** (confirmé par `ps aux` : un second lot de
  reprise, `9DIA-REPRISE-9DI`, tournait en parallèle depuis 09:18 ; le
  worktree `codiplan-voie1` lançait ses propres suites `test:e2e` complètes à
  répétition pendant toute la durée de cette session ; `dmesg` montre un
  processus `node` tué par un signal fatal pendant la fenêtre du troisième
  essai). Premier essai : 798 passés / 16 échecs. Deuxième essai (sous-ensemble
  des 16, seul) : 9 échecs sur 15 fichiers — un ENSEMBLE DIFFÉRENT d'échecs
  que le premier essai sur les MÊMES fichiers, signature classique d'une
  pollution par parallélisme plutôt que d'un défaut déterministe. Troisième
  et quatrième essais (suite complète) : 130 puis 133 tests « ont ne pas
  tourné » — une cascade bien plus large, avec des pages qui rendent
  « Une erreur est survenue » (`error-context.md`), cohérente avec une
  contention mémoire/CPU au moment où `codiplan-voie1` démarrait un NOUVEAU
  build + une nouvelle suite shardée.
  **Preuve que ce n'est pas une régression de 9DJ/9DM** : les 7 fichiers qui
  revenaient identiquement dans les deux premiers essais
  (`9cy-tiroir-remise-en-file`, `agences-etat-visible`,
  `captures-9ay-aa1-choix-sites`, `demandes-2`, `ecrans-largeur-utile`,
  `pg-g14b-transmettre-groupe`, `planning-largeur-et-carte`) ont été rejoués
  **ENSEMBLE, à `--workers=1`** (sans concurrence) : **30/30 verts**. Aucun de
  ces fichiers ne touche aux écrans de ce lot (Équipe, connexion, mot de passe
  oublié, premier accès).
  **Mon propre spec e2e** (`tests/e2e/acces-technicien.spec.ts`, écrit par la
  session d'origine) n'a figuré dans AUCUNE des listes d'échec des quatre
  essais, et a été rejoué seul avec succès (`--workers=1`, 1/1 vert).
  Je n'ai pas pu obtenir une mesure complète propre de `pnpm test:e2e` dans
  cet environnement partagé — **c'est un coût mesuré et nommé, pas une
  régression dissimulée** (protocole §4) : le réessayer une cinquième fois
  n'aurait rien changé tant que d'autres sessions saturent la même machine.
- **Captures AVANT/APRÈS** : un spec neuf,
  `tests/e2e/captures-9dja-acces-technicien.spec.ts` (aucun n'existait — la
  session d'origine ne les avait pas prises, voir sa passation « Ce que je
  n'ai pas fait »), rejoué seul (`--workers=1`, 1/1 vert) avec
  `CAPTURES_9DJA=<chemin>` : 12 PNG dans
  `docs/propositions/9DJ-TP-ACC1-DONNER-ACCES/captures/` — Équipe aux TROIS
  états (pas d'accès / lien envoyé / accès activé), connexion (avec le lien
  « Mot de passe oublié ? »), la page Mot de passe oublié, la page Premier
  accès — chacun à 1280 et 375 px. Vérifiées visuellement (deux captures
  lues) : conformes au texte attendu.

## Ce que j'ai tranché, et pourquoi

- **`main` est verrouillé par un AUTRE worktree** (`/home/aplou/codiplan`,
  idle mais avec des PNG de captures non commités d'une session antérieure) :
  `git checkout main` et `git branch -f main …` sont tous deux refusés par
  git (« used by worktree »). Mesuré avant d'agir : aucun processus actif
  dans ce worktree (`ps aux` + `/proc/<pid>/cwd`), mais y déplacer la
  référence `main` de force aurait quand même laissé son index désynchronisé
  de son `HEAD`, un risque pour une session qui le reprendrait. **J'ai donc
  travaillé sur une branche locale nommée `9DJA-REPRISE-9DJ`**, créée depuis
  `origin/main` à jour — exactement le même renoncement que `9DHA-REPRISE-9DH`
  avant moi (branche encore visible en `git branch -vv`, déjà publiée depuis).
  Mes commits sont donc sur cette branche, PAS sur la branche `main` locale,
  mais ils restent des commits LOCAUX, jamais poussés : la file, qui lit le
  dépôt partagé entre les worktrees, les retrouvera.
- **Le compte de routes gardées passe de 69 à 70, pas de 69 à 69** : les deux
  moitiés du conflit affirmaient chacune « 69 », mais chacune comptait SA
  PROPRE route neuve sans compter celle de l'autre scénario déjà intégré.
  Vérifié en relisant `ROUTE_CAPACITE` après fusion : 70 entrées, la route de
  9DJ (`/api/equipe/[id]/envoyer-acces`) bien présente à côté de celle de 9DE.
- **La fixture de capture porte un nom NEUF (`captures9dj.e2e.nom`), jamais
  `acces9dj.e2e.nom`** : ce dernier sert déjà `acces-technicien.spec.ts`, et
  le combiner au mien (par exemple en ajoutant un suffixe) aurait créé une
  correspondance PARTIELLE entre les deux fiches techniciens si les deux
  specs tournaient un jour en parallèle — exactement le piège déjà noté par
  la session d'origine dans sa passation (« Les pièges pour la session
  suivante »). Deux préfixes disjoints (`9DJ-ACC` et `CAPTURES9DJ`), aucune
  sous-chaîne commune.

## Ce que je n'ai PAS fait

- **Je n'ai pas obtenu un `pnpm test:e2e` complet et propre** dans cette
  session, pour la raison mesurée ci-dessus (contention partagée avec
  d'autres sessions actives sur la même machine). Je n'ai pas non plus
  cherché à contourner ce constat par un `workers: 1` de configuration, un
  `retries`, ou un découpage en shards — tous explicitement interdits par ce
  ticket — ni par un cinquième essai complet, dont le coût (≈8-10 min à
  chaque fois) n'aurait rien appris de plus que les quatre premiers.
- **Je n'ai pas touché au geste d'amorçage ni à sa migration** (D65 point 4,
  explicitement hors de ce lot comme du lot d'origine).
- **Je n'ai pas fait valider D162 par Alexis** — la page reste « à valider »,
  comme D152/D153 avant elle.
- **Je n'ai pas tenté de déplacer la référence `main`** du worktree qui la
  détient (voir ci-dessus) : une action sur l'état partagé d'un AUTRE
  worktree, en dehors du périmètre de ce ticket.

## Les pièges pour la session suivante

- **`main` local reste verrouillé par `/home/aplou/codiplan`** au moment où
  je rends la main. Si la prochaine session y a accès et veut faire avancer
  la branche `main` LOCALE jusqu'à `9DJA-REPRISE-9DJ`, un simple
  `git merge --ff-only 9DJA-REPRISE-9DJ` depuis ce worktree suffit (aucun
  retravail de contenu) — mais seulement si ce worktree n'a pas, entre
  temps, de travail en cours qui en dépendrait.
- **Les specs e2e nommées dans la mesure ci-dessus (`9cy-tiroir-remise-en-file`,
  `agences-etat-visible`, `captures-9ay-aa1-choix-sites`, `demandes-2`,
  `ecrans-largeur-utile`, `pg-g14b-transmettre-groupe`,
  `planning-largeur-et-carte`) rougissent sous forte contention parallèle
  mais passent 30/30 isolées** — ne pas les prendre pour une régression de ce
  lot si elles rougissent à nouveau dans une CI chargée ; les rejouer d'abord
  seules avant de conclure quoi que ce soit.
- **Ne pas confondre `acces9dj.e2e.*` (fixture de `acces-technicien.spec.ts`,
  le flux fonctionnel) et `captures9dj.e2e.*`** (fixture de
  `captures-9dja-acces-technicien.spec.ts`, les captures) : deux scènes
  distinctes, deux préfixes disjoints, volontairement.
- `git status --porcelain` listait, au début de cette session, des dizaines
  de PNG MODIFIÉS dans des dossiers de captures d'anciens tickets (47 à 9DW)
  sans qu'aucun `CAPTURES_*` ne soit positionné dans l'environnement — un
  sous-ensemble des specs `captures-*.spec.ts` plus anciens écrit
  manifestement SANS la garde `DOSSIER === "" → ne rien écrire`, et régénère
  ses PNG à chaque `pnpm test:e2e`. **Aucun de ces fichiers n'a été ajouté à
  l'index ni commité** (consigne du ticket) ; ils restent modifiés dans
  l'arbre de travail de ce worktree pour la session suivante.

## Ce qui reste à faire

- Un `pnpm test:e2e` complet et propre, mesuré sur une machine qui n'est pas
  partagée avec une autre suite lourde en cours.
- Faire valider D162 par Alexis.
- Le retrait du geste d'amorçage (D65 point 4) — lot suivant, avec sa
  migration.
- Si une politique RLS ou une autre source honnête permet un jour de savoir
  qu'une identité est habilitée dans une autre société sans violer D34,
  implémenter le quatrième refus nommé par le ticket d'origine (condition de
  réouverture de D162).
- Faire avancer la branche `main` locale jusqu'à `9DJA-REPRISE-9DJ` dès que
  le worktree qui la détient est libre (voir « pièges » ci-dessus).
