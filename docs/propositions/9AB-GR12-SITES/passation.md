# 9AB-GR12-SITES — passation

## Ce que j'ai changé

Trois points, trois commits, sur `/sites`, `/sites/[id]` et `/sites/nouveau`.

- **GR12a** — le titre de la carte de `/sites` nommait le CLIENT seul depuis
  85-PARC-SITES (le site restant lisible en sous-titre, avec la commune).
  Il nomme désormais « Client — Site » : deux liens (`/clients/<id>` puis
  `/sites/<id>`), séparés par `ponctuation.separateur`. Le site, qui est
  l'entité même de la carte, garde toujours son lien ; le client, lui, reste
  omis (jamais un lien mort) quand la politique de cloisonnement refuse sa
  lecture. Pour l'exploitation : un directeur qui cherche un site précis n'a
  plus besoin d'ouvrir la fiche client pour confirmer qu'il tient le bon —
  mesuré le 26/09 sur six sites nommés « Nouméa » dans le même filtre.
- **GR12b** — sous les filtres de `/sites`, une phrase dit COMBIEN de sites
  le masquage par défaut (LISTES-1, case « Afficher aussi… ») cache
  actuellement, avec un lien « Afficher » qui lève le masquage sur la MÊME
  recherche (`q`, `client`, `sous_contrat` conservés, jamais une remise à
  zéro du filtre). Le compte est la différence entre deux lectures
  indépendantes de `compterSites` (avec et sans le masquage), jamais un
  second parcours des lignes rendues. Pour l'exploitation : la case existait
  sans jamais dire son effet — un utilisateur ne savait pas s'il manquait un
  site ou si la liste était complète.
- **GR12c** — les trois écrans disaient « lieu », le synonyme choisi avant
  que D5/D47 (§3) n'imposent le vocabulaire. Bouton de création, sous-titre
  de l'écran, case du filtre équipement, lien de retour, confirmation de
  création, et les trois messages d'absence (contacts/équipements/
  interventions vides) disent maintenant « site ». Aucune règle de gestion
  touchée — uniquement du texte affiché.

Aucune migration, aucune ligne de semis, aucun prix.

## Ce que j'ai mesuré

- **Captures AVANT/APRÈS** (`docs/propositions/9AB-GR12-SITES/captures/`),
  à 1280 et 375 px, prises par `tests/e2e/captures-gr12-sites.spec.ts`
  (env `CAPTURES_GR12_SITES`) : une fois avec le code d'AVANT le lot
  (`git show 9359a76:...` remis temporairement sur le disque pour les cinq
  fichiers touchés, jamais commité, puis restauré à l'identique du commit
  livré — vérifié par `git diff --stat`, vide), une fois avec le code livré.
  L'AVANT montre « Atelier Ducos » (titre) / « Atelier principal — Nouméa »
  (sous-titre), aucune phrase de rappel, « Nouveau lieu » et « Afficher aussi
  les lieux sans équipement ». L'APRÈS montre « Atelier Ducos — Atelier
  principal » en titre, « 2 sites sans équipement masqués · Afficher » sous
  les filtres, « Nouveau site » et « Afficher aussi les sites sans
  équipement ». La fiche site APRÈS montre « ← Tous les sites » et « Aucun
  interlocuteur n'est enregistré pour ce site. »
- Le scénario e2e neuf de GR12b (`tests/e2e/gr12-sites.spec.ts`, scène
  `ERGO12`) prouve que la phrase compte exactement le site masqué (1) et que
  le lien « Afficher » le révèle sur la même recherche (`q=` conservé,
  `sans_equipement=1` ajouté) — joué et vert.
- `pnpm format:check`, `pnpm typecheck`, `pnpm lint`, `pnpm test` (272
  fichiers, 2928 tests) verts après chacun des trois commits.
- e2e ciblés verts à chaque étape : `sites.spec.ts`, `listes-1.spec.ts`,
  `parc-sites.spec.ts`, `contacts.spec.ts`, `fiche-360-1.spec.ts`,
  `historique-site.spec.ts`, `habilitations.spec.ts`,
  `site-client-inactif-masque-a-la-creation.spec.ts`,
  `captures-parc-sites.spec.ts`, `selecteurs-1.spec.ts` (la création de site,
  qui déclenche le motif `sites.cree`), `gr12-sites.spec.ts` — 31 + 4
  scénarios passés, tous verts.
- `CI=1 pnpm verify:full` en entier, au premier plan, en un seul appel, à la
  toute fin — voir le message de fin de tour pour le résultat exact.

## Ce que j'ai tranché et pourquoi

- **Le titre compose deux `<Link>` distincts** plutôt que de réutiliser
  `libelleClientSite` (`app/(back-office)/presentation.ts`) : cette fonction
  rend une CHAÎNE, alors que `tests/e2e/parc-sites.spec.ts` (85-PARC-SITES)
  exige deux liens SÉPARÉS, chacun avec son propre nom accessible exact — un
  seul `<Link>` portant le libellé composé aurait cassé cette épreuve
  existante.
- **`sites.cree` reste une chaîne littérale comparée par égalité**, jamais
  une clé du dictionnaire : c'est le SEUL motif de cet écran dont le libellé
  porte le mot imposé, et il ne peut donc plus s'écrire en clair au
  dictionnaire (§3). Un cas particulier (`motif === "sites.cree"`) compose
  le message avant de retomber sur le rendu générique `estCleTraduction(motif)
  ? t(motif) : null` de tout autre motif — un seul verbe pour tous les
  autres écrans, une exception nommée pour celui-ci.
- **Préfixe/suffixe au dictionnaire**, recomposés par
  `app/(back-office)/sites/presentation.ts` (déjà le module réservé à cet
  usage — voir son en-tête, « pourquoi un module sans JSX ») : même modèle
  que `sites.fiche.interventions_borne_prefixe`/`_suffixe`, déjà en place
  pour une raison identique.
- **Le compte de GR12b est un TROISIÈME appel à `compterSites`**, parallèle
  aux deux existants, jamais un recalcul depuis les lignes déjà lues : la
  liste est PAGINÉE (`limite` = 50), un simple soustrait sur les lignes
  rendues aurait été faux au-delà de la première page.
- **`hrefAfficherSitesMasques` ignore `page`** volontairement — la
  soumission du formulaire de recherche fait déjà de même pour toute autre
  case (GET sans champ caché `page`) ; composer un `page=1` explicite aurait
  introduit une divergence de comportement entre les deux façons de changer
  un filtre.

## Ce que je n'ai PAS fait

- Je n'ai touché ni `lib/sites/depot.ts` (lecture seule de ses fonctions,
  comme demandé), ni `clients.fiche.sites`, ni `depot/`, ni `11-FILE.sh`.
- Je n'ai changé aucune règle de gestion : le masquage par défaut des sites
  sans équipement (LISTES-1) reste identique, seul son EFFET est maintenant
  dit à l'écran.
- Je n'ai pas ajouté d'entrée « Sites » à la barre de navigation — hors
  périmètre de ce ticket, et une décision de maquette (voir l'en-tête de
  `app/(back-office)/sites/page.tsx`).

## Les pièges pour la session suivante

- **Le motif `sites.cree` n'est plus une clé du dictionnaire** — un futur
  ticket qui chercherait `t("sites.cree")` ou `fr["sites.cree"]` ne trouvera
  rien : c'est `libelleSiteCree()` (`app/(back-office)/sites/presentation.ts`)
  qui compose le message, et `motif === "sites.cree"` (littéral, dans
  `[id]/page.tsx`) qui déclenche ce cas particulier.
- **Les captures AVANT ont exigé de swapper temporairement CINQ fichiers**
  (`page.tsx`, `presentation.ts`, `[id]/page.tsx`, `nouveau/page.tsx`,
  `lib/i18n/fr.ts`) avec `git show 9359a76:...`, sans jamais les committer :
  après la capture AVANT, les cinq ont été restaurés à l'identique du commit
  livré (vérifié par `git diff --stat`, vide) avant la capture APRÈS et
  avant `verify:full`.
- Trois commits distincts pour un même fichier (`page.tsx` notamment) — les
  reconstruire dans le bon ordre (a, puis b, puis c) a demandé de retirer
  puis réappliquer des hunks précis ; toute reprise doit lire les trois
  messages de commit (`be1401a`, `086cc03`, `869e321`) plutôt que le seul
  diff final pour comprendre la progression.
- Toute nouvelle chaîne visible sur ces trois écrans doit désormais composer
  via `mot("site")`/`motDansUnePhrase("site")` — le gardien
  `tests/unit/i18n/vocabulaire-impose.test.ts` refuse « site »/« lieu » en
  clair dans `lib/i18n/fr.ts` hors `vocabulaire.*`.

## Ce qui reste à faire

Rien d'identifié dans le périmètre de ce ticket. Le gain GR12 de l'audit du
26/09/2026 (constat G15) est livré.
