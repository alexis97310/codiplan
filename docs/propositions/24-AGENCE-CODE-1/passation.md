# AGENCE-CODE-1 — passation

Travail commité **sur `main` en local** (branche `agence-code-1`, non poussée) :
`7737b6a` (le code d'agence se montre là où l'on choisit un établissement) puis
`516ecab` (formatage prettier). Captures prises le 2026-09-23, empreintes lues
par `git rev-parse HEAD` au moment de chaque prise (`4285f55` pour l'AVANT —
le point de départ du lot — et `516ecab` pour l'APRÈS), contre le serveur de
production compilé (`next start`) sur la base d'épreuve locale de
`pnpm test:e2e` : migrations, semis de `prisma/seed.ts`, plus une seconde
agence « Ducos » (code `DUCOS2`) créée par le formulaire
`/parametres/agences/nouvelle` — le jeu d'essai que le lot exige. Aucune
donnée de la base hébergée (I9).

## Ce que j'ai changé

`code` — la clé unique par société (`@@unique([societe_id, code])`) — se
montre désormais partout où l'on **choisit** une agence, aux côtés du
libellé, qui lui n'est jamais unique :

- **La liste des établissements** (`/parametres/agences`) : chaque ligne
  porte « Libellé — CODE » au lieu du seul libellé.
- **Le rattachement d'un technicien** (`/parametres/equipe`, création et
  modification) : le menu déroulant affiche « Libellé — CODE ».
- **Le filtre du registre des interventions** (`/interventions`) : même
  composition dans le menu « Agence ».
- **Le rattachement d'un site**, à la création (`/sites/nouveau`) et à la
  modification (`/sites/[id]`) : même composition.

Pour l'exploitation : Alexis peut désormais distinguer ses deux agences
« DUCOS » (l'une active, l'autre inactive, constatées le 22/09/2026 sur sa
base de production) sur les cinq écrans où un rattachement se choisit ou se
filtre, et peut enfin répondre à la question posée par son fichier d'import
(`donnees/10_`, code d'agence « 1 ») : quelle DUCOS porte ce code. Aucune
donnée n'a été renommée, fusionnée ni désactivée — c'est délibéré, voir « ce
que je n'ai pas fait ».

Composition centralisée à deux endroits, jamais recopiée :
- `lib/agences/presentation.ts` — `libelleAgenceAvecCode(libelle, code)`,
  qui compose avec `ponctuation.separateur` (la clé « — » déjà partagée par
  `sites/presentation.ts` pour le même genre de couple étiquette/valeur,
  jamais un caractère écrit en dur).
- `components/agences/options.tsx` — `OptionsAgence`, les `<option>` d'un
  menu de rattachement, importé tel quel par les quatre écrans de menu.

`LigneAgence` (la ligne de la liste des établissements) est extraite de
`app/(back-office)/parametres/agences/page.tsx` vers un fichier voisin,
`composants.tsx` — même raison que `estExpiree` dans
`parametres/equipe/presentation.ts` (D-13) : un `page.tsx` de l'App Router
n'exporte que ce que Next.js reconnaît, et ce composant devait rester
importable par un test de rendu sans base ni navigateur.

## Ce que j'ai mesuré

**AVANT tout code (le constat du ticket, refait sur le dépôt)** :
`app/(back-office)/parametres/agences/page.tsx` sélectionnait
`{ id, libelle, calendrier_id, actif }` — `code` n'était pas lu — et les
quatre menus de rattachement (`equipe`, `interventions`, `sites/nouveau`,
`sites/[id]`) composaient chacun `{agence.libelle}` seul. Confirmé par
`grep -n "code" app/(back-office)/parametres/agences/page.tsx` (aucune
ligne) avant le premier commit.

**Comptes AVANT/APRÈS, capturés en image sur les cinq écrans** (jeu d'essai :
deux agences « Ducos », codes `DUCOS` et `DUCOS2`) :

| Écran | AVANT (`4285f55`) | APRÈS (`516ecab`) |
|---|---|---|
| `/parametres/agences` | deux lignes « Ducos » identiques | « Ducos — DUCOS » et « Ducos — DUCOS2 » |
| `/parametres/equipe` (menu de création) | option « Ducos » | option « Ducos — DUCOS2 » |
| `/interventions` (filtre) | select affiche « Ducos » | select affiche « Ducos — DUCOS2 » |
| `/sites/nouveau` (menu) | option « Ducos » | option « Ducos — DUCOS2 » |
| `/sites/[id]` (menu) | option « Ducos » | option « Ducos — DUCOS2 » |

Fichiers : `*--avant--1280.png` / `*--apres--1280.png` dans ce dossier —
dix captures, 1280×900.

**Épreuves écrites, et vérifiées rouges pour la raison nommée avant d'écrire
le correctif** — `libelleAgenceAvecCode` et `OptionsAgence` n'existaient pas
avant ce lot : un test qui les importe échoue à l'import sur le code d'avant,
et les trois fichiers neufs (`tests/unit/agences/presentation.test.ts`,
`tests/unit/agences/options.test.tsx`, `tests/unit/app/agences-ligne-code.test.tsx`)
assertent explicitement que deux agences de même libellé et de codes
différents rendent un texte DISTINCT — la même mesure que les captures,
côté épreuve automatisée. 4 tests neufs, dans 3 fichiers neufs.

**`pnpm verify` complet (après le second commit)** : format, typecheck,
lint, **2587 tests unitaires** (237 fichiers), **1138 tests d'isolation**
(110 fichiers), build — tout vert.

**`pnpm verify:full` complet** : les deux précédents, plus fériés,
partitions, et **e2e 155 verts, 3 sautés** (nommés,
`/demandes/[id]`, `/imports/[id]`, `/parametres/forfaits/[id]` —
pré-existants, sans rapport avec ce lot : des routes dynamiques que
`tous-les-ecrans-rendent.spec.ts` saute faute de ligne fixe à viser).

## Ce que j'ai tranché, et pourquoi

- **Le séparateur est `ponctuation.separateur` (« — »), jamais un caractère
  écrit dans un écran.** C'est la clé que `sites/presentation.ts` emploie
  déjà pour le même genre de couple étiquette/valeur (« Agence — Koné ») —
  la réutiliser plutôt que d'en écrire une nouvelle évite une seconde clé qui
  dirait la même chose (L0-11, et la leçon nommée en tête de la clé
  elle-même : « une clé nommée d'après son premier appelant devient fausse
  au second »).
- **Un seul composant (`OptionsAgence`) pour les quatre menus, jamais quatre
  compositions locales.** Les quatre écrans avaient chacun leur propre
  `{agences.map(...)}` avant ce lot ; un cinquième écrit demain sans lui
  resterait sur le libellé seul. Éprouver ce composant une fois éprouve les
  quatre écrans qui l'importent — une divergence future se verrait à cet
  endroit, pas quatre fois.
- **La liste des établissements montre le code EN PLUS du badge actif/inactif
  (AGENCE-2), jamais à sa place.** Les deux informations distinguaient les
  deux DUCOS de production (l'une active, l'autre non) ; le ticket demandait
  explicitement de vérifier que l'état restait lisible à côté du code — il
  l'est, dans la même cellule.
- **Aucune contrainte d'unicité sur `libelle`, aucun renommage, aucune
  fusion, aucune désactivation** — l'arbitrage du ticket l'interdisait
  explicitement, et le menage des deux DUCOS reste un geste d'Alexis, qui a
  maintenant de quoi le faire.
- **La ligne technicien de `/parametres/equipe` (colonne « Agence de
  rattachement » du tableau, pas le menu) garde le libellé seul.** C'est une
  colonne d'information dans une liste de lecture, exactement le cas que le
  ticket exempte au point 3 : « une liste de lecture où l'agence n'est qu'une
  colonne d'information n'a pas besoin d'être alourdie ». Même chose pour la
  carte d'un site sur `/sites` (`agenceDuSite`, non touché) : elle ne sert
  pas à CHOISIR une agence, seulement à dire à laquelle un site est
  rattaché.

## Ce que je n'ai pas fait

- **Rien dans `prisma/schema.prisma` ni dans une migration** — la clé
  existait déjà (`@@unique([societe_id, code])`), et le territoire
  l'interdisait de toute façon.
- **Aucune écriture de donnée applicative** — la seconde agence « Ducos »
  n'existe que dans la base jetable de `pnpm test:e2e`, créée par le
  formulaire de création pour la durée de la capture ; rien n'a été écrit
  contre une base hébergée (I9).
- **Ni renommage, ni fusion, ni désactivation** des deux DUCOS de production
  — l'arbitrage du ticket l'interdit, voir ci-dessus.
- **`lib/imports/**`, `lib/vgp/**`, `lib/tarification/**`, `lib/calendar/**`
  n'ont pas été ouverts** — hors territoire, et le défaut ne s'y trouvait
  pas.
- **La colonne « Agence de rattachement » de la LISTE de `/parametres/equipe`
  n'affiche pas le code** — décision assumée ci-dessus (« ce que j'ai
  tranché »), pas un oubli.

## Les pièges pour la session suivante

- **`agencesDisponibles` (`lib/techniciens/depot.ts`) ne lit que les agences
  ACTIVES** (`where: { actif: true }`). Une agence désactivée n'apparaît donc
  dans AUCUN des quatre menus de rattachement — y compris le sien propre,
  déjà. Si un ticket futur veut distinguer deux agences dont l'une est
  inactive DANS un menu (plutôt que dans la liste des établissements, seule
  à le faire aujourd'hui), il faudra d'abord décider si les menus doivent
  proposer les inactives — hors du périmètre de ce lot.
- **Les captures AVANT/APRÈS reposent sur un scénario Playwright temporaire,
  supprimé après usage** (`tests/e2e/_captures-agence-code-1.spec.ts`,
  jamais commité) — même geste que le lot AGENCE-2. Pour les refaire ou les
  étendre : voir la recette dans la mémoire de session
  (`captures-avant-apres-e2e`) — build type-vérifie le spec sur l'ancien
  code au moment de l'AVANT, donc le spec ne doit importer AUCUN module créé
  par ce lot (`lib/agences/presentation.ts`, `components/agences/options.tsx`,
  `composants.tsx`), seulement des locators génériques.
- **`OptionsAgence` compose le texte visible ; il ne touche jamais à
  `value`** — la valeur soumise reste l'`id` de l'agence, jamais son code.
  Un futur écran qui aurait besoin d'afficher le code SANS le libellé (par
  exemple un badge compact) devra écrire sa propre composition : ce
  composant n'est bon que pour le couple complet.

## Ce qui reste à faire

- **Rien d'ouvert par ce lot** : les cinq écrans identifiés par le ticket
  (liste des établissements, rattachement technicien, filtre interventions,
  création et modification de site) sont tous corrigés, testés et capturés.
- Si un audit futur trouve un SIXIÈME écran qui choisit une agence sans
  passer par `OptionsAgence` (un `{agence.map(...)}` local oublié), c'est un
  écart au même défaut, à corriger de la même façon — `grep -rn
  "agence.libelle" app` en serait le point de départ.
