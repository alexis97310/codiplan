# Passation — 9CN-RETOUCHES-3

Dépôt `alexis97310/codiplan`, `main` local. Trois commits :
`9815a3d` (sansCommentaires), `fc0b5a4` (dd de Fiche, agence du planning),
`55860bb` (captures). Aucun push, aucune migration.

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

**Rien ne change pour l'exploitation** — ce lot ne touche aucun écran de
production ni règle de gestion. Il resserre trois preuves de tests et déplace
une fonction, à l'identique :

- `tests/unit/outils/fichiers-source.ts` — `sansCommentaires` n'est plus une
  paire de regex mais un balayeur caractère par caractère, qui épargne
  `'…'`, `"…"`, les gabarits `` `…` `` (avec leurs `${…}` imbriqués) et les
  littéraux regex, et remplace un commentaire retiré par AUTANT de `\n`
  qu'il en contenait. Avant ce lot, `accept="image/*"` (dans
  `app/(mobile)/terrain/[id]/page.tsx`) ouvrait un faux commentaire bloc qui
  avalait 28 lignes de code (le `<Button>` d'ajout de photo compris) dans
  la sortie lue par **tous** les gardiens qui appellent cette fonction —
  sans qu'aucun ne rougisse, puisqu'ils lisent tous la même sortie tronquée.
- `components/ui/fiche.tsx` — **inchangé** : la preuve qui le couvrait était
  vacante pour le `dd`, pas le composant lui-même, qui portait déjà
  `font-bold`.
- `app/(back-office)/planning/page.tsx` → `presentation.ts` — `ouTravaille`
  déplacée telle quelle (corps et docblock identiques) et exportée ; `page.tsx`
  l'importe désormais. Les captures AVANT/APRÈS sont identiques au bit près.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

### Partie 1 — `sansCommentaires`

Comparaison programmatique (ancienne vs nouvelle fonction) sur tout le dépôt
(1232 fichiers `.ts`/`.tsx`/`.mts`/`.css`, hors `node_modules` et assimilés) :

- **1226/1232** fichiers changent de NOMBRE DE LIGNES dans la sortie — attendu
  et voulu : l'ancienne version remplaçait tout commentaire bloc par exactement
  UN `\n`, qu'il tienne sur une ligne ou sur dix ; la nouvelle en remet
  AUTANT qu'il y en avait, donc les numéros de ligne ne bougent plus en aval
  d'un commentaire dont la forme (mono/multi-ligne) ne correspondait pas à un
  seul saut de ligne.
- **18/1232** fichiers changent de CONTENU VISIBLE (lignes non vides,
  comparées après `trim`) — tous par correction d'un même bug : un `/*`, un
  `//` ou un `**/` vivant dans une chaîne, un gabarit ou un commentaire triple
  `///` (Prisma) rouvrait ou fermait un faux commentaire dans l'ancienne
  version :
  - `app/(mobile)/terrain/[id]/page.tsx` (`accept="image/*"`, nommé au
    ticket, le témoin)
  - `app/(back-office)/interventions/[id]/bon/page.tsx`,
    `app/(back-office)/interventions/[id]/page.tsx`,
    `app/(back-office)/parametres/materiel/page.tsx`,
    `components/forfaits/formulaire.tsx` — tous les quatre par un
    `{/* eslint-disable-next-line … */}` SUR UNE SEULE LIGNE : l'ancienne
    version le remplaçait par un `\n`, scindant `{}` en deux lignes et
    décalant tout le reste du fichier d'une ligne. **Non mesuré par le pilote
    du ticket** (qui n'annonçait qu'un seul fichier changé) — cette
    conséquence du "autant de `\n` qu'il en contenait" n'était pas visée mais
    en découle directement, et `pnpm test` reste vert sur les cinq.
  - 13 fichiers de tests/specs qui fabriquent ou lisent des chemins avec
    `**/`, du XPath avec `//`, des commentaires `///` Prisma, etc., tous DANS
    des chaînes ou des gabarits — `tests/e2e/captures-pgd4-telephone-onglets.spec.ts`,
    `tests/e2e/glisser-deposer.spec.ts`, `tests/unit/auth/utilisateur-sans-donnee-metier.test.ts`,
    `tests/unit/calendar/sans-fuseau-en-dur.test.ts`, `tests/unit/db/contexte-harnais.test.ts`,
    `tests/unit/db/observation-proprietaire.test.ts`, `tests/unit/docs/origines-vgp-ratifiees.test.ts`,
    `tests/unit/i18n/sans-chaine-visible-en-dur.test.ts`, `tests/unit/purge-demonstration.test.ts`,
    `tests/unit/theme/sans-couleur-en-dur.test.ts`, `tests/unit/ui/retouches-2a.test.ts`,
    `vitest.config.mts`, et mon propre `tests/unit/outils/fichiers-source.test.ts` (fixtures
    qui reproduisent exprès le bug du ticket).

`pnpm test` : **357 fichiers, 3648 tests, tous verts** avec la nouvelle fonction
(355/3643 avant ce lot — +2 fichiers, +5 tests, le garde-fou et `ou-travaille.test.ts`).
`grep -rl sansCommentaires tests/unit` rend 29 fichiers ; 26 l'importent
réellement comme gardien (hors `fichiers-source.ts` qui la définit,
`fichiers-source.test.ts` qui est mon garde-fou, et `migrations-sql.ts` qui
définit sa propre fonction SQL homonyme, `sansCommentairesSql`, sans rapport).
Ces 26 — dont `lot-a2.test.ts`, qui l'importe depuis ce lot — ont tous été
rejoués par ce seul `pnpm test` ; aucun n'a changé de verdict.

Garde-fou (`tests/unit/outils/fichiers-source.test.ts`, 8 cas) : **4 constatés
ROUGES avec l'ancienne fonction** (restaurée temporairement par `git stash`,
rejouée, repop) — `accept="image/*"`, `"**/api/*/x"`, `"a]//b"`, et le TÉMOIN
sur `terrain/[id]/page.tsx` ; 4 passaient déjà (URL dans une chaîne — protégée
par l'ancien exemple accidentel du `:`, vrai commentaire retiré, littéral
regex qui n'apparaissait simplement jamais comme un faux déclencheur avant,
bloc de 3 lignes dont le DÉCALAGE n'était pas détecté par un simple
`toContain`). Tous les 8 verts avec la nouvelle fonction.

### Partie 2 — preuves resserrées

- `components/ui/fiche.tsx` : `dd` sans `font-bold` → `tests/unit/ui/composants-maquette.test.ts:299`
  reste VERT (confirmé — la preuve était bien vacante) ; le nouveau
  `tests/unit/ui/fiche-rendu.test.tsx` passe ROUGE dans ce cas
  (`expected '' to contain 'font-bold'`), VERT une fois la classe restaurée.
- `app/(back-office)/planning/presentation.ts`, `ouTravaille` : rendue à
  retourner `""` sans condition → `tests/unit/planning/ou-travaille.test.ts`
  ROUGE sur 2 des 3 cas (`une agence`, `deux agences`), VERT restauré.
- `tests/unit/ui/lot-a2.test.ts`, la nouvelle preuve agence (ligne ~160) :
  remplacée par une chaîne absente → ROUGE (1/5 tests), VERT restauré. Le
  décompte (`LE DÉCOMPTE`) lit désormais `sansCommentaires(SOURCES)` au lieu
  du texte brut ; toujours 11/11 blocs rendus.

## Ce que j'ai tranché et pourquoi

- **`ouTravaille` déplacée à l'identique**, corps et docblock compris : le
  ticket l'exigeait (« telle quelle ») et rien dans sa logique ne dépendait de
  `page.tsx`.
- **Pas de nouveau marqueur `data-maquette-bloc`** pour la seconde preuve
  d'agence du planning : l'ajouter comme un douzième `BLOCS_PLANNING` aurait
  changé le sens du « 11/11 blocs rendus » du décompte (qui compte des blocs
  de la maquette, pas des assertions) ; je l'ai posée comme un `it(...)`
  séparé, witness pur sur `FONCTION_PLANNING`.
- **Le décompte lit `sansCommentaires(SOURCES)` pour TOUS les blocs**, pas
  seulement celui de l'agence : cohérent avec le ticket (« le décompte lit
  sansCommentaires(SOURCES) »), et sans risque puisque `sansCommentaires` est
  maintenant fiable (partie 1) — aucun des 11 marqueurs ne vit dans un
  commentaire, le décompte reste 11/11.
- **La preuve de rendu du `dd` va dans un nouveau fichier `.tsx`** plutôt que
  dans `composants-maquette.test.ts` (`.ts`) : le ticket l'imposait si le
  fichier cible n'est pas un `.tsx` ; `:299` reste intact, aucune attente
  retirée.
- **Les 4 fichiers supplémentaires touchés par le fix `\n`** (bon/page.tsx,
  interventions/[id]/page.tsx, materiel/page.tsx, forfaits/formulaire.tsx) :
  gardés tels quels, non "corrigés" davantage — la correction est dans
  `sansCommentaires`, pas dans ces fichiers applicatifs, qui n'ont pas changé.

## Ce que je n'ai PAS fait

- **Pas touché les trois copies locales de `sansCommentaires`** dans
  `tests/unit/auth/refus-de-droit.test.ts` (:24-27), `tests/unit/auth/porte.test.ts`
  (:225-228) et `tests/unit/auth/chrome.test.ts` (:111-114 et :172-175) — hors
  territoire, nommées ci-dessous.
- **Pas touché les ~37 lignes de graisse faible sans jeton de taille**, les
  e2e qui posent sur la semaine courante, `parc-tri.spec.ts:249`, ni
  `NODE_OPTIONS` du typecheck — hors territoire, nommés par le ticket lui-même.
- **Pas nettoyé les 35 specs de captures sans garde d'environnement** —
  préexistant, hors territoire.
- **Pas touché `app/(mobile)/terrain/**`** au-delà de la lecture : le fichier
  qui a révélé le bug n'a reçu aucune modification, conformément au territoire
  « lecture seule ».

## Les pièges pour la session suivante

- **Les trois copies locales de `sansCommentaires` (auth/) portent le même bug** —
  `refus-de-droit.test.ts` et `porte.test.ts` protègent seulement les `//`
  précédés de `:`, moins encore que l'ancienne version partagée (pas de `"'`\`
  en plus). `chrome.test.ts` n'exempte RIEN — ses deux copies retirent tout
  `//`, y compris dans une chaîne. **Proposition, non faite** : les remplacer
  par un import de `sansCommentaires` (`../outils/fichiers-source`) — aucune
  n'a de raison documentée de diverger de la version partagée.
- **`sansCommentaires` reste volontairement grossière** sur l'ambiguïté
  division/regex après une accolade fermante `}` : elle suppose "regex
  attendu", comme la plupart des lexeurs simples, sans distinguer un objet
  littéral d'un bloc de code. Aucun cas réel rencontré dans ce dépôt, mais à
  garder en tête si un futur fichier source écrit une division juste après un
  `}`.
- **`pnpm test` fait foi pour cette fonction** : toute modification future de
  `sansCommentaires` doit rejouer les 28 gardiens qui l'importent, pas
  seulement son propre garde-fou.

## Ce qui reste à faire

- Les trois copies locales de `auth/` (proposition ci-dessus, non tranchée —
  point d'arrêt mineur, à valider avant d'y toucher puisque ce n'était pas
  dans le territoire de ce lot).
- Tout le reste nommé « HORS de ce ticket » dans le ticket lui-même, inchangé.

## `CI=1 pnpm verify:full`, en entier

Un seul passage, vert de bout en bout : `format:check`, `typecheck`, `lint`,
`test` (357 fichiers, 3648 tests), `test:isolation`, `build`, `feries:horizon`,
`audit:partitions`, `test:e2e` (746 passés, 7 skip préexistants, aucun échec).
Aucune reprise nécessaire.
