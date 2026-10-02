# Passation — 9CV-RETOUCHES-6

Dépôt `alexis97310/codiplan`, `main` local, à jour sur `e785ae5` au départ. **Migration :
NON.** Aucun push. Territoire : tests et scripts seulement ; aucun fichier de `app/`,
`lib/` ou `components/` touché.

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

**Rien ne change pour l'exploitation** — ce lot ne touche aucun écran ni règle de
gestion. Il resserre cinq gardiens révélés trop larges par les relectures pilote de 9CQ
(02/10 16:07) et 9CR (02/10 17:45), plus un erratum de documentation :

- `tests/unit/ui/priorite-une-correspondance.test.ts` — la garantie 1 ne vérifiait que
  l'APPEL `tonDePriorite(` (ou `<Priorite`), pas l'IMPORT. Une fonction locale homonyme,
  sans rapport avec `lib/theme/priorites.ts`, aurait passé le gardien. Elle exige
  maintenant l'import **depuis `@/lib/theme/priorites`** ET l'appel, ou `<Priorite`. Le
  titre du `describe` (qui disait encore « importe … ou … », faux depuis 9CQ) est corrigé
  en conséquence.
- `tests/unit/theme/focus-barre-sombre.test.ts` — `regleFocusChrome` lisait le PREMIER
  bloc `[data-chrome] :focus-visible` (`exec`, pas de `g`). Un second bloc, plus bas, qui
  reposerait `var(--ring)` gagnerait la cascade sans faire rougir le gardien. Elle lit
  maintenant TOUS les blocs (`matchAll`) et exige qu'ils soient tous conformes.
- `tests/unit/outils/fichiers-source.ts` (`sansCommentaires`) — l'exemption « URL » pour
  un `//` collé à un `:` valait pour N'IMPORTE QUEL `:` collé, y compris un vrai
  commentaire (`a ? b :// note`). Elle exige maintenant un véritable SCHÉMA d'URL
  (lettres/chiffres/`+`/`.`/`-`, commençant par une lettre) immédiatement avant le `:`.
  **Découverte annexe, au même fichier** : en éprouvant le cas JSX du ticket
  (`<a>https://x</a>; // vrai`), un second défaut, indépendant du point ci-dessus, est
  apparu — un `/` immédiatement précédé de `<` (la balise fermante `</a>`) était pris pour
  l'ouverture d'un littéral regex, qui avalait la première moitié d'un vrai `//` plus loin
  sur la même ligne et empêchait ce commentaire d'être jamais reconnu. Corrigé en traitant
  `<` comme `)`/`]` (un `/` qui suit est une division, jamais un regex) — voir « Ce que j'ai
  tranché » pour la mesure de risque.
- `tests/unit/outils/fichiers-source.test.ts` — cas ajoutés pour les deux défauts
  ci-dessus ; les huit cas existants restent verts, assertions inchangées.
- `scripts/lib/delai-connexion.ts` (`avecDelaiDeConnexion`) — passait par
  `URL`/`URLSearchParams`, qui RÉ-ENCODENT toute la requête au passage
  (`options=-c%20x` devenait `options=-c+x`). Sans effet sur les URL Neon d'aujourd'hui,
  mais un piège pour le jour où un `options=` y apparaîtrait. Réécrite en concaténation
  sur la chaîne d'origine (`?`/`&`, en respectant un `#` de fragment s'il y en a un) :
  aucun paramètre existant n'est plus jamais ré-encodé.
- `connecterAvecReessai` déplacée de `scripts/controle-cloisonnement.mts` vers
  `scripts/lib/delai-connexion.ts`, avec ses dépendances injectées (`connecter`,
  `attendre`, `ecrire`) : la boucle réelle (un essai, attente 10 s, un second essai, puis
  l'erreur) n'était testée que via un gardien STATIQUE sur le source et la fonction pure
  `doitReessayer` — jamais la boucle elle-même. `controle-cloisonnement.mts` l'appelle
  maintenant avec `prisma.$connect`, un vrai `setTimeout`, et `process.stdout.write` —
  comportement observable identique.
- `docs/propositions/9CQ-RETOUCHES-4/passation.md` — erratum : `components/ui/priorite.tsx`
  IMPORTE `tonDePriorite` (`lib/theme/priorites.ts:20`), il ne le définit pas.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

**Méthode** : les six fichiers du lot remis à l'état `e785ae5` par `git stash` (fichiers de
test ET d'implémentation, puisque les deux cohabitent dans certains fichiers), les cinq
suites rejouées, puis `git stash pop` pour revenir à l'état corrigé — mesuré, pas supposé.

**Avant correction** (`pnpm vitest run` sur les 5 fichiers) : 5 fichiers / 50 tests verts —
vert en apparence, parce que les épreuves neuves n'existaient pas encore. Preuve du ROUGE
par rejeu direct de chaque fonction D'ORIGINE contre l'épreuve NEUVE (scripts Node jetables,
`--experimental-strip-types`, rien commité) :

- **Point 1.** `appelleTonDePriorite` ancienne (`/\btonDePriorite\s*\(/.test(contenu) ||
  /<Priorite\b/.test(contenu)`) sur une fonction locale fabriquée
  (`function tonDePriorite(p) {…}; tonDePriorite("p1")`, sans aucun import) : rend `true`.
  L'épreuve neuve attend `false`. ROUGE confirmé.
- **Point 2.** `regleFocusChrome` ancienne (`exec` sans `g`) sur un CSS fabriqué à deux
  blocs `[data-chrome] :focus-visible`, le premier conforme, le second reposant
  `var(--ring)` : rend le contenu du PREMIER bloc (non `null`). L'épreuve neuve attend
  `null`. ROUGE confirmé.
- **Point 3.** `sansCommentaires` ancienne sur `"a ? b :// note"` : rend la chaîne
  INCHANGÉE (le commentaire reste, puisque l'ancienne exemption traitait tout `:// ` comme
  une URL). L'épreuve neuve attend `"a ? b :"`. ROUGE confirmé. Sur
  `"<a>https://x</a>; // vrai"` (ancienne ET nouvelle exemption `:`, AVANT le correctif
  `<`) : rend la chaîne INCHANGÉE — `vrai` jamais retiré, pour la raison annexe décrite
  plus haut. ROUGE confirmé indépendamment du point 3 nommé par le constat.
- **Point 4.** `avecDelaiDeConnexion` ancienne sur
  `"postgresql://u:p@h:5432/b?options=-c%20x"` avec `secondes=30` : rend
  `"postgresql://u:p@h:5432/b?options=-c+x&connect_timeout=30"` — `%20` devenu `+`.
  L'épreuve neuve attend l'octet `%20` intact. ROUGE confirmé.
- **Point 5.** `connecterAvecReessai` : absente de `scripts/lib/delai-connexion.ts` avant
  ce lot (vivait, non exportée, dans `controle-cloisonnement.mts`) — l'import de
  l'épreuve neuve échoue. ROUGE par construction.

**Après correction** : 5 fichiers / **60** tests verts (dix épreuves neuves : 2 pour le
point 1, 2 pour le point 2, 4 pour le point 3 — dont les deux cas du constat et le cas
annexe `<`/JSX —, 2 pour le point 4 ; le point 5 ajoute 4 tests sur
`connecterAvecReessai` dans le même fichier que le point 4, dans le compte global de 60).
Détail par fichier :

| Fichier | `it(` avant | `it(` après |
|---|---|---|
| `fichiers-source.test.ts` | 10 | 12 |
| `priorite-une-correspondance.test.ts` | 10 | 11 |
| `focus-barre-sombre.test.ts` | 10 | 11 |
| `delai-connexion.test.ts` (ci) | 10 | 16 |

**Portée de la vérification de non-régression** — tous les gardiens qui importent
`sansCommentaires` (24 fichiers de test, trouvés par `grep -rl sansCommentaires
tests/`), rejoués après le correctif du point 3 (y compris le correctif annexe `<`) :
**tous verts** — `auth/{chrome,echange,porte,pose-de-designation,refus-de-droit}`,
`calendar/{sans-date-courante-implicite,sans-date-feriee-en-dur,sans-fuseau-en-dur,
territoire-independant-du-fuseau}`, `dates/comparaison-civile`,
`db/{contrat-isolation,horloge-hors-cloisonnement,perimetre-audit,
security-definer-sous-arbitrage}`, `e2e-donnees-partagees`, `e2e-mise-en-scene`,
`techniciens/garanties-structurelles`,
`theme/{echelle-typographique,lien-visible,sans-couleur-en-dur}`,
`ui/{lot-a2,plancher-12-pages,plancher-typographique,retouches-2a}` — 24 fichiers, 427
tests, aucun écart. Aucun n'a rougi : le resserrement de l'exemption URL et le correctif
`<`/JSX n'ont changé le verdict d'AUCUN fichier réel du dépôt.

**`pnpm test` (suite complète)** : 363 fichiers / 3735 tests verts après ce lot.

**`pnpm format:check`** et **`pnpm typecheck`** et **`pnpm lint`** : verts, zéro
avertissement, avant le commit.

## Ce que j'ai tranché et pourquoi

- **Le correctif `<` sur `sansCommentaires`, non nommé par le constat, mais nécessaire
  pour que le cas `<a>https://x</a>; // vrai` du ticket (point 3) passe réellement au
  vert.** Sans lui, ce cas précis reste rouge indéfiniment — pas à cause de l'exemption
  `:`, mais d'une ambiguïté regex/division préexistante (`<` remettait
  `diviseurAttendu` à `false`, comme n'importe quelle ponctuation, ouvrant un faux
  littéral regex sur le `/` de `</a>`). J'ai mesuré que ce changement est sans risque sur
  ce dépôt : `grep` de tout `app/`, `lib/`, `components/`, `tests/` pour un `<` suivi
  directement d'un `/` qui ne serait PAS une balise fermante JSX ne trouve AUCUNE
  occurrence — le seul usage réel de ce motif dans le dépôt est `</Composant>`. Je le
  signale ici en détail plutôt que de le glisser en silence, conformément à la consigne
  « si un gardien rougit, c'est un vrai trou, dis-le en passation, n'affaiblis rien » —
  ici ce n'est pas un gardien RÉEL qui a rougi, mais ma PROPRE épreuve neuve, pour une
  raison distincte du point nommé ; je corrige donc, plutôt que de l'affaiblir ou de la
  retirer, et je le documente intégralement.
- **`avecDelaiDeConnexion` : concaténation sur la chaîne d'origine, pas de nouvelle classe
  `URL`.** C'est le seul moyen de ne RIEN ré-encoder. Le fragment `#`, s'il existe, est
  préservé après le nouveau paramètre — mesure faite sur un cas sans fragment (aucune URL
  Postgres n'en porte), non testée séparément faute de cas réel à nommer.
- **`connecterAvecReessai` : dépendances injectées comme des paramètres positionnels, pas
  un objet de configuration** — cohérent avec le style déjà en place dans ce module
  (`doitReessayer`, `codePrisma`, fonctions pures à arguments positionnels).
- **Le gardien statique `controle-attend-le-reveil.test.ts` n'a pas été modifié** : il ne
  vérifie que la présence de `avecDelaiDeConnexion(` et l'absence de `console.log`, les
  deux encore vraies après le déplacement.

## Ce que je n'ai PAS fait

- Je n'ai touché à aucun fichier hors du territoire du ticket — aucune ligne dans `app/`,
  `lib/`, `components/`, `prisma/`, `.github/`.
- Je n'ai pas élargi `MOTIF_OBJET`/`MOTIF_PROXIMITE` de `priorite-une-correspondance` ni
  touché aux cas qui doivent rester verts (rang, filtre) — hors périmètre de ce lot.
- Je n'ai pas touché à la mesure de contraste WCAG de `focus-barre-sombre.test.ts`, déjà
  verte, hors périmètre.
- Je n'ai pas cherché d'autres angles morts de `sansCommentaires` au-delà de ce que les
  cas du ticket ont révélé — le correctif `<` est strictement celui qui fait passer le cas
  nommé, pas une revue exhaustive du lexeur.
- Aucune migration, aucune ligne de semis, aucun prix, aucun écran touché ou créé.

## Les pièges pour la session suivante

- **`sansCommentaires` reste un lexeur heuristique, pas un vrai analyseur JSX/TS** :
  d'autres ambiguïtés regex-vs-division du même genre peuvent exister (n'importe quelle
  ponctuation suivie d'un `/` est une source potentielle). Le correctif de ce lot ne
  couvre que `<` — le seul cas réellement rencontré, mesuré par `grep` sur ce dépôt à ce
  commit. Si un futur cas fabriqué échoue pour une raison similaire, chercher d'abord
  quel caractère précède le `/` fautif et si `diviseurAttendu` est en cause avant de
  toucher à l'exemption `:`, qui n'est responsable que du point 3 nommé.
- **Les comptes AVANT ont été mesurés par `git stash` ciblé** (les six fichiers du lot
  seulement, jamais `git stash -u` ni global) — si une session future répète cette
  méthode, vérifier `git status --porcelain` juste après le `pop` pour confirmer qu'aucun
  fichier étranger n'a été embarqué ou oublié dans la pile.
- La liste des 24 gardiens qui importent `sansCommentaires` est dérivée par `grep` à ce
  commit — un futur gardien qui l'importerait devra être rejoué de la même façon si
  `sansCommentaires` est retouchée encore.

## Ce qui reste à faire

Rien d'identifié dans le périmètre de ce ticket. Le correctif `<` de `sansCommentaires`
mériterait, si un futur lot retouche encore ce fichier, une revue plus large des autres
ponctuations pouvant ouvrir la même ambiguïté — non fait ici, faute de cas réel observé
pour les justifier.
