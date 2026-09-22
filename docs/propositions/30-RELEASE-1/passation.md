# RELEASE-1 — passation

## 1. Ce que j'ai changé

- **`vercel.json`** : un `ignoreCommand` neuf, `"bash scripts/portail-publication.sh"`.
  C'était le seul levier de publication vivant dans le dépôt, et il ne
  contenait rien (`$schema` + `regions`, quatre lignes). Il porte désormais le
  refus de construction.
- **`scripts/portail-publication.sh`** (nouveau). Le script littéralement
  déclaré dans `vercel.json`. Installe ses propres dépendances
  (`pnpm install --frozen-lockfile`) avant de déléguer au calcul du verdict —
  voir §2, piège 2 du ticket, sur l'ordre des étapes Vercel.
- **`scripts/portail-publication.mts`** (nouveau). Le point d'entrée CLI :
  gère la porte de secours (`FORCER_PUBLICATION_MALGRE_RETARD=oui`), invoque
  réellement `scripts/migrations-appliquees.mts` en sous-processus (même
  commande que `db-migrate.yml` utilise pour son propre résumé), écrit le
  rapport, sort avec le bon code.
- **`scripts/lib/portail-publication.ts`** (nouveau). L'orchestration
  testable : `CODE_DE_SORTIE` (le sens Vercel, inversé de l'intuition Unix),
  `appliqueesDepuisSortieScript` (traduit la sortie du script réutilisé en
  liste ou `null`), `calculerVerdict`, `rapport`.
- **`lib/db/verdict-publication.ts`** (nouveau). Le verdict, pur : deux listes
  de noms en entrée, `publier` / `bloquer` (avec la première migration
  manquante et leur nombre) / `illisible` (avec un motif) en sortie. Ne se
  connecte à rien.
- **`tests/unit/db/verdict-publication.test.ts`** (nouveau, 8 tests) et
  **`tests/unit/ci/portail-publication.test.ts`** (nouveau, 13 tests) : les
  trois gardiens demandés par le ticket — `vercel.json` déclare le portail,
  le sens des codes de sortie est figé en dur, la traduction ne confond
  jamais « rien appliqué » et « illisible ».
- **`docs/propositions/30-RELEASE-1/`** : une note d'exploitation en français
  pour Alexis (`note-exploitation.md`) et les trois verdicts réellement
  exécutés (`verdict-publier.txt`, `verdict-bloquer.txt`,
  `verdict-illisible.txt` — ce troisième n'était pas demandé mais documente
  un cas réel mesuré, voir §3).
- **Aucune ligne touchée** dans `lib/db/migrations-attendues.ts` ni
  `scripts/migrations-appliquees.mts` : les deux sont invoqués tels quels
  (import pour le premier, sous-processus pour le second).

**Ce que ça change pour l'exploitation.** Avant ce lot, chaque commit poussé
sur `main` partait en production sans qu'aucune vérification n'existe entre
le code et l'état réel de la base — c'est exactement ce qui a cassé
`/imports` le 23/09 au matin. Après ce lot, un commit dont la production n'a
pas encore reçu les migrations nécessaires ne publie plus : Vercel annule la
construction (`CANCELED`), le site reste sur la version précédente, qui
fonctionne, et le journal de construction nomme la migration manquante et le
geste pour la poser. **Ceci n'a pas pu être vérifié sur un déploiement
Vercel réel** — voir §5, premier piège.

## 2. Ce que j'ai mesuré

**Le sens des codes de sortie de l'`ignoreCommand` Vercel (piège 1 du
ticket)**, confirmé par la documentation Vercel elle-même (récupérée via
`WebFetch`, pages `/docs/project-configuration/vercel-json#ignorecommand` et
`/docs/project-configuration/project-settings#ignored-build-step`) :

> « If the command exits with code `1`, the build continues as normal. If
> the command exits with code `0`, the build is immediately aborted, and the
> deployment state is set to `CANCELED`. »

C'est le sens exact que le ticket annonçait, et `CODE_DE_SORTIE` (`publier:
1, bloquer: 0, illisible: 0`) le respecte, gardé par un test qui recopie les
trois valeurs en dur plutôt que de les relire depuis le module testé.

**L'ordre des étapes Vercel (piège 2), PAS mesuré empiriquement** — je n'ai
aucun accès à un compte ou un déploiement Vercel réel depuis cette session.
La documentation Vercel officielle, y compris la page communautaire dédiée
(`/kb/guide/how-do-i-use-the-ignored-build-step-field-on-vercel`), **ne dit
explicitement ni que l'étape tourne avant l'installation, ni que
`node_modules` est absent à ce stade** — c'est une affirmation du ticket
lui-même (mesure d'une session précédente, non rejouée ici). J'ai conçu
`scripts/portail-publication.sh` en conséquence, par prudence : il installe
lui-même ses dépendances avant d'invoquer `tsx`, ce qui fonctionne que
l'installation officielle ait déjà eu lieu ou non — au prix d'installer deux
fois sur les commits qui passent (non chronométré, coût accepté). **C'est une
hypothèse non vérifiée en conditions réelles**, à confirmer au premier
déploiement réel (voir §5).

**Les trois verdicts, exécutés réellement — pas simulés en mémoire.** Une
base PostgreSQL jetable a été montée localement (`scripts/postgres-jetable.sh`,
port 5440, forcé sur PostgreSQL 18 avec `PGJ_BIN` — PostgreSQL 16 n'est pas
installé sur ce poste, seul PostgreSQL 18 l'est ; usage exceptionnel et
documenté dans le script lui-même) :
1. **AVANT** toute migration → `illisible` (`docs/propositions/30-RELEASE-1/verdict-illisible.txt`).
   *Mesure inattendue* : sur une base vraiment neuve, `_prisma_migrations`
   n'existe pas encore, et `scripts/migrations-appliquees.mts` — que je
   réutilise sans le modifier — écrit alors sur `stderr` exactement comme
   pour une base injoignable (c'est écrit dans son propre docblock : les deux
   cas ne sont délibérément pas distingués). Le portail rend donc
   « illisible » plutôt que « bloquer » à ce stade précis. Les deux
   verdicts bloquent la publication de la même façon (code de sortie 0),
   seul le motif diffère — voir §3.
2. **APRÈS** `prisma migrate deploy` complet (62 migrations posées sans
   erreur sur PostgreSQL 18) → `publier`, code 1
   (`verdict-publier.txt`).
3. Une ligne supprimée à la main dans `_prisma_migrations`
   (`20260923120000_duree_application_import_mesure_1`, la plus récente) →
   `bloquer`, nommant exactement cette migration, code 0
   (`verdict-bloquer.txt`).

**`pnpm verify:full` complet, joué une fois après correction du format**
(`prettier --write` sur les 3 fichiers neufs de code) : `format:check`,
`typecheck`, `lint` (0 avertissement), `test` (2 638 tests unitaires, dont 21
nouveaux pour ce lot, tous verts), `test:isolation`, `build`,
`feries:horizon`, `audit:partitions`, `test:e2e` (157 passés, 3 ignorés —
routes dynamiques déjà exclues avant ce lot). Sortie en 0.

## 3. Ce que j'ai tranché, et pourquoi

1. **`illisible` recouvre aussi une base neuve (fresh, aucune migration
   jamais posée), pas seulement une base injoignable.** C'est un héritage
   direct de `scripts/migrations-appliquees.mts`, que je n'ai pas le droit de
   modifier (lecture seule, territoire du ticket) : son propre code confond
   déjà les deux cas — « une table absente est le cas d'une base NEUVE… et
   elle se distingue d'une base injoignable par le fait que la migration qui
   suit échouera elle aussi ». Réouvrir cette distinction demanderait de
   toucher ce fichier, hors territoire. Le choix reste sûr : les deux
   verdicts bloquent la publication de façon identique (code 0) ; seul le
   texte affiché diffère, et il ne dit jamais « tout va bien ».
2. **Le portail installe lui-même ses dépendances (`pnpm install` dans
   `scripts/portail-publication.sh`) plutôt que de tenter `pnpm exec tsx`
   directement.** Piège 2 du ticket : sans certitude sur la disponibilité de
   `node_modules` à ce stade, la solution qui fonctionne dans les deux cas
   (dépendances déjà installées ou non) a été préférée à une solution plus
   rapide mais fragile.
3. **La porte de secours (`FORCER_PUBLICATION_MALGRE_RETARD=oui`) est
   vérifiée uniquement dans `scripts/portail-publication.mts`, jamais dans
   le `.sh`.** Une seule lecture de ce critère (culture du dépôt, §9 du
   01/09) — au prix d'installer les dépendances même quand on force, ce qui
   est rare et acceptable.
4. **`DATABASE_URL` est réutilisée comme variable de connexion du portail**,
   plutôt que d'en inventer une nouvelle : c'est déjà celle que l'application
   déployée exige pour fonctionner (`prisma/schema.prisma`,
   `env("DATABASE_URL")`). Cela évite d'imposer à Alexis un secret Vercel de
   plus, mais suppose qu'elle soit exposée au moment de la CONSTRUCTION
   (build time), pas seulement à l'exécution — non vérifié, voir §5.
5. **`calculerVerdict` prend un paramètre `invoquerScript` injecté**, plutôt
   que d'appeler `spawnSync` en dur — même patron que `scripts/lib/verdict-deploiement.ts`
   / `scripts/verifier-deploiement.mts` (R3-01), déjà dans le dépôt, pour
   permettre le test sans sous-processus ni base.
6. **Aucun test n'exécute réellement `scripts/portail-publication.sh` ni le
   sous-processus `pnpm exec tsx`** — seule la fonction `calculerVerdict`,
   injectée, est éprouvée en unitaire. Les trois fichiers `verdict-*.txt`
   sont la preuve d'exécution réelle demandée par le ticket, produite à la
   main pendant ce lot (voir §2), pas par une suite automatisée qui la
   rejouerait à chaque `pnpm test`.

## 4. Ce que je n'ai PAS fait

- **Aucune migration, aucune ligne de `prisma/schema.prisma`** — interdit
  explicite du ticket.
- **`.github/workflows/db-migrate.yml`** — intouché, y compris sa BORNE 1.
  Aucune exécution automatique ne vise la production.
- **Aucune dépendance nouvelle** — `spawnSync` est un module natif de
  Node.js, `pnpm install` est déjà la commande d'installation du dépôt.
- **`lib/vgp/**`, `lib/calendar/**`, `lib/tarification/**`, `lib/imports/**`,
  tout écran sous `app/`** — hors territoire, non ouverts.
- **Aucune capture d'écran** — le ticket l'excluait explicitement (aucun
  écran touché).
- **Aucun réglage n'a été posé sur le tableau de bord Vercel** — je n'y ai
  aucun accès depuis cette session. Voir §6.
- **Le portail n'a pas été essayé sur un vrai déploiement Vercel** — voir §5,
  c'est le trou le plus important de ce lot.
- **Aucun gardien n'empêche `scripts/portail-publication.sh` de diverger de
  ce que `scripts/portail-publication.mts` attend** (par exemple si un futur
  lot renomme le fichier `.mts` sans toucher au `.sh`) — seule une exécution
  réelle du script bash le révélerait ; je n'ai pas écrit ce gardien-là par
  manque de temps.

## 5. Les pièges pour la session suivante

- **Le plus important : rien de ce lot n'a été éprouvé sur un vrai
  déploiement Vercel.** Le premier commit qui atteint `main` après ce lot EST
  le test réel. Si `ignoreCommand` échoue d'une façon inattendue (pnpm
  absent, `node_modules` déjà présent et l'installation redondante pose
  problème, `DATABASE_URL` non exposée au build), **la conséquence est que
  PLUS AUCUN commit ne publie** — le portail bloque par prudence sur tout ce
  qu'il ne comprend pas. La porte de secours
  (`FORCER_PUBLICATION_MALGRE_RETARD=oui`, à poser dans les réglages Vercel)
  existe pour ce cas précis. La première session qui suit doit vérifier le
  journal de construction du premier déploiement réel et confirmer que le
  portail s'y comporte comme prévu.
- **`scripts/migrations-appliquees.mts` ne distingue jamais « base neuve »
  de « base injoignable »** (voir §3.1) — si un ticket futur touche ce
  fichier pour lever cette ambiguïté, `appliqueesDepuisSortieScript`
  (`scripts/lib/portail-publication.ts`) devra être relu : elle hérite de
  cette confusion délibérément, pas par oubli.
- **`pnpm install` se joue deux fois sur tout commit qui publie** — une fois
  dans `scripts/portail-publication.sh`, une fois dans l'étape d'installation
  officielle de Vercel juste après. Non chronométré ; si le temps de
  construction devient un problème, c'est le premier endroit à regarder.
- **La variable `DATABASE_URL` du portail est celle de l'application, pas un
  secret dédié** — si un jour la production change de base sans que
  l'application le sache encore (migration de fournisseur en cours), le
  portail et l'application liraient temporairement deux états différents.
  Non rencontré ici, juste écrit pour mémoire.
- **`FORCER_PUBLICATION_MALGRE_RETARD` n'existe encore nulle part sur
  Vercel** — voir §6, c'est un geste d'Alexis, pas un défaut.

## 6. Ce qui reste à faire

- **Sur le tableau de bord Vercel (geste d'Alexis, aucun accès depuis cette
  session) :**
  - Confirmer que `DATABASE_URL`, pour l'environnement Production, est
    exposée au moment de la CONSTRUCTION (« Build time »), pas seulement à
    l'exécution — sans quoi le portail rendra systématiquement « illisible ».
  - Vérifier, après le premier commit poussé après ce lot, que le
    déploiement se comporte comme attendu (journal de construction lisible,
    verdict cohérent avec l'état réel de la base) — voir §5.
  - Ne poser `FORCER_PUBLICATION_MALGRE_RETARD=oui` qu'en cas de blocage
    jugé erroné, et la retirer aussitôt après (voir
    `docs/propositions/30-RELEASE-1/note-exploitation.md`).
- **Aucun gardien statique ne relie `scripts/portail-publication.sh` au nom
  réel de `scripts/portail-publication.mts`** (voir §4) — à écrire si un
  renommage futur doit être protégé.
- **La distinction « base neuve » / « base injoignable » reste hors de
  portée du portail** tant que `scripts/migrations-appliquees.mts` ne la
  fait pas lui-même (voir §3.1, §5) — hors territoire de ce ticket.
