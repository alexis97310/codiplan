# PORTABILITE-1 — le dépôt survit à un checkout Windows

Travail commité **sur `main` en local**, sans proposition ni branche distante
(processus du 22/09/2026) : `d6318fe` (le `.gitattributes`) puis `2526bf7`
(les six gardiens). Rien n'est poussé : c'est le script qui a lancé la session
qui rejoue `pnpm verify:full` et publie, s'il est vert.

**Aucune capture** : le ticket ne touche aucun écran — un `.gitattributes`,
un module de `scripts/lib/`, un outil de test et six gardiens. Il n'y a rien à
photographier ; ce qui se mesure ici se mesure en commandes, et elles sont
ci-dessous.

## 1. Le `.gitattributes` — mesuré, pas lu

Le dépôt n'en avait aucun. Celui de `d6318fe` fixe `* text=auto eol=lf` et
déclare binaires images, classeurs, PDF et polices.

| Mesure (`git ls-files --eol`) | Avant | Après |
|---|---|---|
| fichiers portant un attribut de fin de ligne | **0** | **940** `attr/text=auto eol=lf` |
| fichiers déclarés binaires (`attr/-text`) | 0 | **232** |
| fichiers texte en LF dans l'index | 939 | 940 (+ le `.gitattributes`) |
| `git add --renormalize .` | — | **aucun fichier modifié** |

Et la mesure qui compte, **le clone tel qu'un poste Windows le ferait** —
`git clone --config core.autocrlf=true` joué ici même, sous Linux :

| Arbre de travail après clone, `core.autocrlf=true` | Avant | Après |
|---|---|---|
| `w/crlf` | **939** | **0** |
| `w/lf` | 0 | **940** |
| `w/-text` | 232 | 232 |

Le ticket mesurait 724 fichiers en CRLF sous Windows natif ; ici 939 — Git
for Windows et ce Git-ci ne détectent pas le texte de la même façon, et le
chiffre exact importe moins que le zéro d'après.

## 2. Les six gardiens — la cause, et ce qui rougit

| Gardien | Cause mesurée sous Windows | Ce qui change | Mis en échec exprès, vu rougir |
|---|---|---|---|
| `ci/url-hors-journal` | `spawnSync sed ENOENT` | un prononceur JavaScript de `sed -E s///`, qui REFUSE en levant tout ce qu'il ne traduit pas à l'identique ; confronté au vrai `sed` là où il existe (CI) | expression du flux rétrécie à `https?://` → « laisse passer l'hébergeur » ; expression qui laisse le jeton → « n'expurge rien » |
| `excel/fixture-dates` | `python3` absent ; chemin `C:\…` recopié dans un script | `lireArchiveStricte` (`scripts/lib/archive-zip.ts`) à la place de `zipfile` ; `JSON.stringify(FIXTURE)` | classeur fabriqué à la place du classeur Excel → 8 rouges, dont `inline: 15` chaînes comptées |
| `gardiens/chemins-de-depot` | `'lib\sites\zones.ts'` ≠ `'lib/sites/zones.ts'` | `scripts/lib/chemins-de-depot.ts` : `relative()` normalisé en `/` à la sortie (`relatifPosix`) | exemption `supprimerSite` retirée → « aucun chemin depuis app/ » |
| `i18n/sans-chaine-visible-en-dur` | `normalize("lib/i18n")` rend `lib\i18n` sous Windows : le dictionnaire n'est plus reconnu, chaque `t("…")` devient une chaîne en dur | `tests/unit/outils/rendu-visible.ts` : `posix.normalize` / `posix.dirname` | `<span>Planning</span>` greffé dans `bandeau-societe.tsx` → 2 rouges |
| `db/contexte-harnais` | `replace(cwd + "/")` ne retire rien sous Windows : l'exemption ne s'adosse plus | `relative()` + `split(sep).join("/")` | `"app.fantome"` greffée dans `setup/db.ts` → « harnais qui ment » |
| `courriel/envoi` | `split("/").pop()` rend le chemin entier | `basename()` | `api.resend.com` écrit dans `index.ts` → `['index.ts', 'resend.ts']` |

Chaque rouge a été obtenu **après** la correction, puis la faute retirée et le
vert remesuré. Aucun gardien désactivé, aucun affaibli.

**Compte des gardiens** dans les six fichiers : **67 tests avant, 71 après** —
les quatre de plus sont les épreuves du prononceur (sorties écrites à la main,
refus, le cas qui doit rougir pour sa propre raison, la confrontation à `sed`).
Suite unitaire entière : voir la porte ci-dessous.

## 3. Ce qui est prouvé, et ce qui ne l'est pas

**Prouvé ici :**

- les six ne nomment plus ni `sed` ni `python3` comme dépendance — le seul
  `spawnSync("sed")` restant est un TÉMOIN qui se saute quand `sed` est
  absent, jamais une exigence ;
- sous **`path.win32` joué sur ce poste**, les nouvelles écritures rendent
  `lib/sites/zones.ts` et `resend.ts` là où les anciennes rendaient
  `lib\sites\zones.ts` et le chemin entier ; `JSON.stringify` d'un chemin
  `C:\…` se réévalue à l'identique ;
- un clone avec `core.autocrlf=true` sort en LF.

**Non prouvé, et dit :** que les six passent **sous Windows**. Ce poste tourne
sous Linux (WSL2). Windows n'est pas réparé tant qu'un clone Windows ne l'a pas
mesuré ; ce qui est réparé est ce qui le faisait rougir.

## 4. La porte jouée

`pnpm verify:full`, **en entier**, sur `2526bf7`, joué de **2026-09-22T00:27:33Z**
à **2026-09-22T00:31:55Z** (heures lues à l'horloge) — **EXIT=0** :

| Étape | Résultat |
|---|---|
| `format:check`, `typecheck`, `lint` | sans erreur ni avertissement |
| `test` (unitaires) | **226 fichiers, 2 436 tests passés** |
| `test:isolation` | **99 fichiers, 1 061 tests passés** |
| `build` | compilé |
| `feries:horizon`, `audit:partitions` | passés |
| `test:e2e` | **117 passés, 2 sautés** — les deux `test.skip` nommés, préexistants, de `tous-les-ecrans-rendent.spec.ts` (`/imports/[id]`, `/parametres/forfaits/[id]`) |

Le ticket comptait 2 375 tests unitaires le jour de la mesure Windows ; `main`
en porte 2 436 aujourd'hui, dont les 4 ajoutés ici.

## 5. Ce que je n'ai pas fait

- **Aucun gardien sur le `.gitattributes` lui-même** : le fichier peut être
  supprimé sans qu'un test rougisse. Le territoire ne comprenait pas de nouveau
  fichier de test ; c'est un choix à faire, pas à prendre en silence.
- **Le README ne dit rien de Windows** : hors territoire, et aucun module,
  table ni commande n'est ajouté.
- **Les autres usages de binaires Unix hors des six** : `tests/isolation/setup/global.ts`
  appelle `pnpm exec prisma migrate deploy` (portable) ; rien d'autre n'a été
  trouvé par `grep` sur `python3`, `"sed"`, `spawnSync`, `execSync` dans
  `tests/`, `scripts/`, `lib/`. « Je n'en ai pas trouvé », pas « il n'y en a pas ».
- **Rien n'est poussé.**
