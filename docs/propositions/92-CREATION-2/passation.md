# 92-CREATION-2 — passation

## Ce que j'ai changé

- `app/api/recherche/sites/route.ts` compose désormais le libellé du sélecteur avec
  `libelleClientSite` (85-PARC-SITES) plutôt qu'une concaténation locale
  `` `${client} — ${site.libelle}` ``. **Pour l'exploitation** : un lieu qui porte le nom de
  son client (mesuré en production : « AUTOPOINT DUCOS — AUTOPOINT DUCOS ») ne s'affiche plus
  deux fois de suite dans la suggestion du sélecteur.
- `app/(back-office)/interventions/nouvelle/page.tsx` compose de la même façon la VALEUR
  RETENUE quand le lieu arrive prérempli (`?site=`, `?demande=`, ou le retour après un refus de
  saisie) — même correction, sur le second chemin que le constat 7 nommait.
- Site, Nature (Type) et la panne signalée portent désormais une mention « (obligatoire) » dans
  leur libellé ; Nature et la panne signalée portent aussi `aria-required="true"`. **Pour
  l'exploitation** : aucune règle de validation n'a changé — Nature a toujours une valeur par
  défaut (le premier choix de la liste), la panne était déjà `required`. Seule la LECTURE de
  l'écran change.
- Machine et Contact (`components/interventions/site-et-machines.tsx`) sont désormais
  `disabled` tant qu'aucun lieu n'est choisi, avec la mention « Choisissez d'abord un site » à
  la place de « Aucune machine » / « Aucun contact ». **Pour l'exploitation** : ces deux
  libellés ne changent qu'AVANT le choix du lieu ; une fois un lieu choisi, le comportement et
  les libellés sont identiques à avant ce lot.
- La note sous le champ Site est reformulée — « Le site choisi détermine l'agence — cela ne se
  saisit pas. » au lieu de « Déduit du lieu d'intervention — cela ne se saisit pas. » — et
  déplacée juste sous ce champ (elle suivait avant tout `ChampSiteEtMachines`, donc en pratique
  sous Contact). La clé partagée `intervention.deduit_du_lieu` n'a PAS été touchée : elle sert
  encore `interventions/[id]/page.tsx` et `demandes/[id]/page.tsx`, hors du périmètre de ce
  ticket (« Écran : `/interventions/nouvelle` et lui seul »).
- Le champ Site porte une aide sous le champ de recherche : « Tapez un client, un site ou une
  commune ».
- Sept clés `intervention.creation.*` ajoutées à `lib/i18n/fr.ts`, chacune un FRAGMENT autour du
  mot imposé « site »/« agence » (jamais le mot lui-même, D5/D47/L0-11) ; quatre fonctions de
  composition ajoutées à `app/(back-office)/interventions/presentation.ts`
  (`libelleChampObligatoire`, `libelleChoisirLeLieuDabord`, `aideRechercheSite`,
  `agenceDeduiteDuSite`), même discipline que `segmentsSurSiteTitre` déjà présente dans ce
  fichier.
- Épreuve neuve `tests/e2e/creation-2.spec.ts`, scène propre préfixée `CREA2-` (un client et un
  lieu au même libellé, une machine attachée), deux scénarios.

## Ce que j'ai mesuré

- **AVANT (lecture du code, pas d'exécution — le défaut n'a jamais été corrigé par un commit
  intermédiaire de cette session)** : `app/api/recherche/sites/route.ts:56` composait
  `` `${clients.get(site.client_id) ?? ""} — ${site.libelle}` `` sans dédoublonnage ;
  `interventions/nouvelle/page.tsx:160` faisait de même pour la valeur retenue ; aucun des trois
  champs obligatoires n'était marqué ; Machine/Contact affichaient « Aucune machine »/« Aucun
  contact » avant tout choix de lieu, sans le dire.
- **APRÈS (mesuré, ce commit)** :
  - `CI=1 pnpm test` : 264 fichiers, 2842 tests, tous verts (dont les gardiens
    `vocabulaire-impose`, `sans-chaine-visible-en-dur`, `constitution-indexee`).
  - `pnpm typecheck` : vert. `pnpm lint` : vert (zéro avertissement).
  - `CI=1 pnpm verify:full` (un seul appel au premier plan, ~13 min) : `format:check`,
    `typecheck`, `lint`, `test`, `test:isolation`, `build`, `feries:horizon`,
    `audit:partitions`, `test:e2e` — chaîne complète verte. `test:e2e` : 272 passés, 3 ignorés
    (préexistants, hors périmètre), 0 échec — dont les deux scénarios de
    `tests/e2e/creation-2.spec.ts`, qui prouvent concrètement (pas seulement en lecture) qu'un
    lieu nommé comme son client n'apparaît plus doublé, ni dans la suggestion du sélecteur ni
    dans la valeur retenue par `?site=`, et que Machine/Contact passent bien de désactivés
    (avec la mention) à peuplés une fois le lieu choisi.
  - Deux captures prises par l'épreuve, à 1280 px : `docs/propositions/92-CREATION-2/captures/
    avant-choix-du-lieu-1280.png` et `apres-choix-du-lieu-1280.png`.

## Ce que j'ai tranché et pourquoi

- **`app/api/recherche/sites/route.ts` et `app/(back-office)/interventions/presentation.ts`
  sont hors de la liste de territoire du ticket, et je les ai modifiés quand même** — le
  ticket demande explicitement que le dédoublonnage s'applique « dans la suggestion ET dans la
  valeur retenue » (point 1). La suggestion est composée par cette route, pas par les trois
  fichiers du territoire déclaré ; sans y toucher, la moitié du constat 7 restait en place.
  `interventions/presentation.ts` est le fichier-maison déjà établi par `segmentsSurSiteTitre`
  et consorts pour composer un texte autour du mot imposé « site » sans l'écrire dans le
  dictionnaire — l'endroit exact où ces quatre fonctions devaient vivre pour respecter D5/D47.
- **Aucun texte composé n'est un template littéral écrit directement dans un fichier JSX** —
  vérifié précisément contre `tests/unit/outils/rendu-visible.ts` : un fragment littéral dans un
  gabarit reste visible au gardien même quand les parties interpolées viennent du dictionnaire
  (leçon de 90-PARC-SITES-REPRISE). Toute composition qui mélange un mot imposé et de la
  ponctuation vit donc dans `interventions/presentation.ts` (aucun JSX, donc hors du périmètre
  du gardien), jamais dans `page.tsx` ni dans `site-et-machines.tsx`.
- **`components/ui/selecteur-recherche.tsx` n'a PAS été touché** — c'est le sélecteur partagé
  par `/sites/nouveau`, `/parc/nouvelle` et `formulaire-machine.tsx`, hors du périmètre de ce
  ticket (« Écran : `/interventions/nouvelle` et lui seul »). Le champ Site reste donc marqué
  obligatoire par le `required` HTML déjà posé (`obligatoire` prop, inchangée), qui reflète
  `aria-required` de façon IMPLICITE (mapping HTML-ARIA standard) plutôt qu'explicite. Nature et
  la panne signalée, qui vivent dans `page.tsx` (dans le territoire), portent l'attribut
  `aria-required` en toutes lettres.
- **`Choix` (le `<select>` générique de `page.tsx`) reçoit un nouveau prop `obligatoire`,
  appliqué seulement à Nature** — Priorité et Mode de valorisation ont chacun un défaut
  (`p3`, `temps_passe`) déjà présent avant ce lot ; le ticket ne demande la mention que sur
  Site, Type et panne signalée, et je ne l'ai pas étendue au-delà.
- **`intervention.deduit_du_lieu` reste inchangée** (voir ci-dessus) — une seule clé, deux
  usages hors périmètre, une nouvelle clé pour le seul usage dans le périmètre.

## Ce que je n'ai PAS fait

- Aucune migration, aucune ligne de semis (`prisma/seed*.ts`), aucun prix — vérifié
  (`git show --stat` de chaque commit : ni `prisma/migrations/`, ni `prisma/seed*.ts`).
- Aucune règle de validation Zod ni route API changée — `app/api/interventions/creer/route.ts`
  n'a pas été touché.
- Aucun changement sur `interventions/[id]/page.tsx` ni `demandes/[id]/page.tsx`, qui utilisent
  encore l'ancienne clé `intervention.deduit_du_lieu` — hors périmètre de ce ticket.
- Pas de nouvelle dépendance à `aria-required` explicite sur le champ Site (voir « ce que j'ai
  tranché »).
- Je n'ai pas retesté manuellement dans un navigateur réel au-delà de ce que Playwright exécute
  et capture (pas de session de développement `pnpm dev` ouverte à la main) — les deux captures
  d'écran de l'épreuve sont la preuve visuelle disponible.

## Les pièges pour la session suivante

- **`page.locator("form")` sur cet écran remonte DEUX formulaires** — celui de déconnexion du
  bandeau (`app/api/session/deconnexion`) et celui de création. Scoper par
  `form[action="/api/interventions/creer"]` (ou `data-selecteur`/`select[name=...]` pour un
  champ précis) plutôt que par la balise `form` nue.
- **Une session `pnpm verify:full` régénère les captures PNG d'AUTRES tickets** — chaque
  épreuve e2e qui prend des captures les réécrit à chaque exécution complète de `test:e2e`,
  produisant des diffs binaires bénins (mêmes pixels, ré-encodage différent) sur des dizaines de
  fichiers hors du périmètre du ticket en cours. `git checkout --` ces fichiers avant de
  committer, sinon le commit du ticket porte du bruit binaire sans rapport.
- **Un template littéral reste visible au gardien même construit à partir de `t()`/`mot()`** —
  toute composition mêlant un mot imposé et de la ponctuation doit vivre dans un fichier SANS
  JSX (`*/presentation.ts`), jamais assemblée dans `page.tsx` ou un composant, même via une
  variable intermédiaire.

## Ce qui reste à faire

- Rien d'identifié dans le périmètre de ce ticket. Un futur lot pourrait envisager d'étendre
  `aria-required` explicite au champ Site lui-même, ce qui suppose de toucher
  `components/ui/selecteur-recherche.tsx` et donc les trois autres écrans qui le partagent — hors
  périmètre ici, à trancher dans un ticket dédié si jugé utile.
