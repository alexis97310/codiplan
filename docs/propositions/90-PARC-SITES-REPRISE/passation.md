# 90-PARC-SITES-REPRISE — passation

## Ce que j'ai changé

- `lib/i18n/fr.ts` — trois nouvelles clés `parcsites.e2e.client_a`, `parcsites.e2e.client_b`,
  `parcsites.e2e.site` (même discipline que `registre3.e2e.*`, `annuler1.e2e.*`, etc.) : les
  textes de la scène de l'épreuve `parc-sites.spec.ts` vivent désormais dans le dictionnaire,
  jamais composés en dur dans le fichier de test.
- `tests/e2e/parc-sites.spec.ts` — `CLIENT_A`, `CLIENT_B`, `SITE_LIBELLE`, qui étaient composés
  par un gabarit (`` `${PREFIXE}A` `` etc.), deviennent `SCENE_PSI.clientA`, `SCENE_PSI.clientB`,
  `SCENE_PSI.site`, lus directement depuis `fr["parcsites.e2e.…"]`. `PREFIXE` reste utilisé pour
  le libellé de la famille de matériel (`PSIFAM…`), qui n'est ni rendu ni interrogé par
  l'épreuve et n'entrait donc pas dans le périmètre du gardien.

**Pour l'exploitation** : aucun changement de comportement de `/parc` ni de `/sites` — ce lot ne
touche que la forme du test qui les prouve, pas le code d'écran livré par 85-PARC-SITES.

## Ce que j'ai mesuré

- **AVANT (mesuré, `git show 85-PARC-SITES-garde:…` fusionné sur `main` à jour, avant
  correction)** : `npx vitest run tests/unit/i18n/sans-chaine-visible-en-dur.test.ts` rouge sur
  UN test, `aucun emplacement visible ne porte de chaîne écrite en dur`, avec exactement les huit
  fautes annoncées par le ticket : `tests/e2e/parc-sites.spec.ts:186/189/204/207/212/215`,
  chaînes `« A »`, `« B »`, `« Noumea »`. Cause identifiée en lisant
  `tests/unit/outils/rendu-visible.ts` : un gabarit (`` `${PREFIXE}A` ``) porte un fragment
  littéral (`"A"`) même quand `PREFIXE` lui-même est une constante — l'enveloppe (forme 2 du §9)
  ni le deux-temps (forme 3) ne protègent, par construction du gardien.
- **APRÈS (mesuré, ce commit)** : le même test unitaire — 10/10 tests verts, y compris le
  test dédié « aucun emplacement visible ne porte de chaîne écrite en dur ».
  `pnpm format:check` : vert (un passage de Prettier a été nécessaire sur
  `tests/e2e/parc-sites.spec.ts` après l'édition manuelle). `pnpm test` (CI=1) : 264 fichiers,
  2841 tests, tous verts. `pnpm verify:full` (CI=1, un seul appel au premier plan, ~11 min) :
  chaîne complète — `format:check`, `typecheck`, `lint`, `test`, `test:isolation`, `build`,
  `feries:horizon`, `audit:partitions`, `test:e2e` — verte de bout en bout, `test:e2e` : 270
  passés, 3 ignorés (pré-existants), 0 échec.

## Ce que j'ai tranché et pourquoi

- **`SCENE_PSI` en objet plutôt que trois constantes séparées** : suit littéralement l'exemple
  donné par le ticket (`SCENE_PSI.clientA`) plutôt que de renommer `CLIENT_A`/`CLIENT_B` en
  `CLIENT_A_LIBELLE` etc. Vérifié que le gardien traite un accès `SCENE_PSI.clientA` exactement
  comme un accès direct `fr["…"]` sur ce point : `constantesLitterales` (dans
  `rendu-visible.ts`) calcule les littéraux d'une propriété d'objet avec un contexte VIDE (sans
  connaissance du dictionnaire) — une propriété initialisée par `fr["…"]` (un `ElementAccess`)
  n'y est reconnue par AUCUNE branche de `litterauxVisibles` et retourne `[]`, donc n'entre
  jamais dans la table des constantes littérales : `SCENE_PSI.clientA` utilisé plus loin ne
  retrouve donc aucune faute enregistrée. Comportement confirmé par l'exécution du gardien, pas
  seulement déduit de la lecture.
- **`PREFIXE` conservé** pour le seul libellé de la famille de matériel
  (`` `${PREFIXE}Famille` ``, ligne d'écriture Prisma) : ce champ n'est ni rendu en JSX, ni une
  métadonnée, ni interrogé par une requête d'écran dans ce fichier — il ne porte aucune des
  trois marques que le gardien reconnaît, donc hors de son périmètre. Le déplacer dans
  `fr.ts` aurait été un changement non demandé par le ticket, pour un endroit que le gardien ne
  regarde pas.
- **Pas de nouvelle exception, pas de modification du gardien** — conforme à l'interdit du
  ticket. La correction porte entièrement sur la source des chaînes, jamais sur ce qui les
  vérifie.

## Ce que je n'ai PAS fait

- Aucune migration, aucune ligne de semis, aucun prix — respecté (aucun fichier de
  `prisma/migrations/` ni `prisma/seed*.ts` touché).
- Aucune assertion métier changée : les trois épreuves de `parc-sites.spec.ts` vérifient
  exactement les mêmes faits qu'avant (options du filtre, valeur envoyée, titres des cartes) —
  seule la SOURCE des chaînes attendues a changé.
- Pas de nouvelle capture d'écran : ce lot ne touche aucun écran, seulement un fichier de test et
  le dictionnaire ; les captures de 85-PARC-SITES (`docs/propositions/85-PARC-SITES/captures/`)
  restent valables et n'ont pas été retouchées.
- `depot/` et `11-FILE.sh` non touchés — respecté.

## Les pièges pour la session suivante

- **Un gabarit littéral (`` `${CONST}texte` ``) reste une chaîne en dur aux yeux du gardien même
  quand `CONST` est elle-même une variable** — la seule façon reconnue de faire passer un texte
  affiché ou interrogé par une épreuve e2e est une référence directe au dictionnaire
  (`fr["clé"]`, un accès en `[]` ou `.` dont la racine est un objet exporté par `lib/i18n`), pas
  une construction locale, même partielle. Une prochaine épreuve qui a besoin d'un nom composé
  (préfixe + variante) doit écrire CHAQUE variante comme sa propre clé `*.e2e.*` dans `fr.ts`,
  jamais un préfixe partagé concaténé dans le fichier de test.
- Le nom de clé choisi est `parcsites` (un seul mot, comme `fiche360`, `formulaires2`) — pas
  `parc-sites` ni `parc_sites` — pour rester cohérent avec la convention déjà en place ; un
  gardien pourrait exister ailleurs sur la forme des clés, vérifier avant d'en introduire une
  nouvelle famille de casse.

## Ce qui reste à faire

Rien d'identifié pour ce ticket : le seul point bloquant (le gardien L0-11 sur
`tests/e2e/parc-sites.spec.ts`) est résolu et `pnpm verify:full` est vert de bout en bout.
