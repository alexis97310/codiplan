# Passation — 9EB-TP-UX3-2-LISTES-1

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

**`/clients`** (QE-10 (a), QE-13c) : le `<select>` d'état et le grand bandeau « N Sans Code Winpro » disparaissent, remplacés par quatre puces à compteur — **Actifs** (vue par défaut quand l'adresse ne porte ni `etat` ni `sans_code_externe`), **Inactifs**, **Sans Code Winpro** (reprend `titreSansCode`, D29), **Tous**. Un menu **« Trier par »** (Raison sociale/Nombre de machines/Dernière intervention), appliqué sur TOUTE la population filtrée avant la pagination. Un résumé (« N clients », avec « pour « x », sans tenir compte des accents » si une recherche est posée) remplace le total qui vivait sous la grille. La carte : titre en 16 px/800, toute la carte ouvre la fiche (un seul `<a>`, étendu par un `::after`), donneur d'ordre affiché (orange « Aucun donneur d'ordre » sinon), bande de quatre chiffres alignée à gauche — sites, machines EN PARC, à planifier (orange si > 0), dernière intervention (jj/mm dans l'année en cours, jj/mm/aaaa sinon). Le masquage LISTES-1 garde son critère ; sa case devient la phrase « N clients sans machine masqués · Afficher ».

**`/sites`** : quatre puces — **Sites des clients actifs** (défaut), **Trajet inconnu**, **Sans zone**, **Clients inactifs** —, plus **Sous contrat** en 5ᵉ puce à bascule (CONTRAT-SITE-1 inchangé). Deux menus `<select>` natifs, « Zone » et « Agence » (ce dernier seulement si plus d'une agence active), soumis par « Rechercher ». Avec `client=` dans l'adresse (liens des fiches) et sans `vue=` explicite, **aucune vue n'est imposée** — un client inactif garde ses sites visibles depuis sa propre fiche — et une puce « Client : X » retirable le rappelle. Carte : « Client — Site » (sans répétition si identiques) en titre cliquable sur toute la carte, ligne zone/agence (« Sans zone » en orange), ligne « N habilitation(s) exigée(s) » si au moins une (remplace la pastille verte, sans le CODE de l'habilitation — écart nommé), badge bleu « Sous contrat » (indépendant des deux lignes muettes « Inactif » de CS27), bande de chiffres — machines en parc, ouvertes, trajet (orange si inconnu), VGP dépassée (rouge, seulement si > 0).

**`components/ui/carte-entite.tsx`** gagne deux options sans rien changer d'autre : `href` (carte entière cliquable) et `chiffres` (bande alignée à gauche, distincte de `compteurs`). **`components/ui/puces-filtre.tsx`** (neuf) : `PuceVue`, `PuceMenu`, `ResumeListe`.

**Quatre fonctions de dépôt groupées** (lib/clients/depot.ts : `resumeDesCartesClients`, `comptesVueClients` ; lib/sites/depot.ts : `resumeDesCartesSites` ; lib/vgp/registre.ts : `machinesVgpDepasseeParSite`) remplissent la condition de réouverture de D123. `equipementsParClient` et `compterSansCodeExterne` perdent leur seul appelant (remplacés par les lectures groupées) : exemptées dans `scripts/lib/chemins-de-depot.ts`, avec leur motif.

Pour l'exploitation : rien ne change dans les règles de gestion, les montants, les droits (le bouton de création suit toujours `gerer_client_site`) ni le cloisonnement. Ce qui change, c'est uniquement la **lecture** des deux écrans — un ADV ou un administrateur retrouve plus vite un client ou un site par sa vue, et voit d'un coup d'œil le donneur d'ordre, le trajet et l'échéance VGP sans ouvrir la fiche.

## Ce que j'ai mesuré

- `pnpm test` (unitaire) : **405 fichiers, 4311 tests, tous verts** — dont les 4 fichiers neufs/modifiés de ce lot (`tests/unit/ui/carte-entite.test.ts` étendu, `tests/unit/clients/chiffres-carte.test.ts`, `tests/unit/sites/chiffres-carte.test.ts`, `tests/unit/ui/puces-filtre.test.ts`).
- `pnpm test:isolation` : **166 fichiers, 1484 tests, tous verts** — dont les 2 fichiers neufs (`resume-cartes-clients.test.ts`, `resume-cartes-sites.test.ts`) qui confrontent les lectures groupées à leurs équivalents unitaires (`nombreEquipementsActifsDuClient`, `derniereInterventionDuClient`, `interventionsOuvertesDuSite`, `machinesVgpDepasseeParSite`), sur une scène dédiée et préfixée.
- `pnpm build` : **vert**, deux fois (ce dépôt, puis le worktree temporaire du commit `96046111` pour les captures AVANT).
- `pnpm lint`, `pnpm format:check`, `tsc --noEmit` : **verts** à chaque commit.
- `CI=1 npx playwright test` (la suite ENTIÈRE, 265 fichiers) : **1069 tests, 1021 passés, 48 ignorés (captures gated par une variable d'environnement absente), ZÉRO échec**, en 40,7 minutes. C'est la preuve la plus large que ce lot ne casse rien ailleurs dans le produit.
- Un balayage ciblé, avant la suite entière, des fichiers e2e qui naviguent vers `/clients` ou `/sites` (31 fichiers identifiés par recherche) a trouvé et corrigé trois adaptations nécessaires (voir « Ce que j'ai tranché »), et confirmé qu'une quatrième échec (`captures-9ay-aa1-choix-sites.spec.ts`) est un flake de parallélisme sans rapport avec ce lot (passe seul, échoue en lot avec d'autres fichiers — conflit d'ordre de suppression `site`/`client` d'un AUTRE fichier).
- Captures AVANT/APRÈS : 12+12 PNG (1280/375 px), comparées visuellement — voir `docs/propositions/9EB-TP-UX3-2-LISTES-1/captures/README.md`.

## Ce que j'ai tranché et pourquoi

- **La vue par défaut** (« Actifs » pour les clients, « Sites des clients actifs » pour les sites) est appliquée par la PAGE, jamais par le défaut du SCHÉMA Zod (qui reste `tous`/`null`) — d'autres appelants (le sélecteur de `sites/nouveau`, `parc/nouvelle`) dépendent du défaut non filtrant.
- **Le tri des clients** porte sur TOUTE la population filtrée avant la pagination (`ordonnerClients`, `lib/clients/depot.ts`) — un second type de lecture (`groupBy`/`findMany`) au lieu d'un `ORDER BY` SQL, pour la même raison que l'ordre alphabétique existant (la collation de la base hébergée n'est pas garantie).
- **Les quatre comptes des puces clients** viennent d'UNE seule lecture des candidats (`comptesVueClients`) ; les quatre comptes des puces sites viennent de QUATRE lectures indépendantes (`compterSites` répété), parce que les vues de site se RECOUVRENT (trajet inconnu ⊇ sans zone) — un simple compte par bucket aurait été faux.
- **L'habilitation exigée perd son code** sur la carte site (« N habilitation(s) exigée(s) » plutôt que « · habilitation CACES exigée ») — `SiteHabilitationRequise` ne porte que des identifiants, et joindre le code aurait étendu la fonction groupée au-delà de ce que ce lot mesure. Écart nommé dans D179.
- **`equipementsParClient` et `compterSansCodeExterne`** perdent leur seul appelant réel (vérifié par grep avant d'exempter, pas supposé) : exemptées dans `scripts/lib/chemins-de-depot.ts`, avec leur motif et leur condition de retrait.
- **P1–P9 du pilote (07/10)** suivis à la lettre : `LigneResume` n'est pas touché (un composant neuf, `ResumeListe`, le fait) ; le total reste aussi en bas de la pagination ; aucun export n'est ajouté ; la carte 16 px/800/padding 16 ne s'applique QUE quand `href` est fourni ; le titre garde `CLASSES_LIEN` ; les badges de site restent indépendants ET gagnent « Sous contrat » ; les menus sont des `<select>` natifs, jamais un composant client.

## Ce que je n'ai PAS fait

- Le parc et les imports (9EB-TP-UX3-2-LISTES-2, qui suit ce ticket).
- Les fiches client et site (TP-UX4-2).
- « Exporter » sur `/clients` ou `/sites` (non décidé, D169/D179 l'excluent explicitement).
- Le CODE de l'habilitation exigée sur la carte site (écart nommé, voir ci-dessus).
- Toute migration, toute ligne de semis, tout prix, toute règle de gestion changée.
- Un gardien automatique de la fuite de captures non gatées (voir le piège ci-dessous) — signalé, pas corrigé : hors du territoire de ce ticket.

## Les pièges pour la session suivante

- **`CI=1 npx playwright test` (la suite entière) régénère sans le vouloir des dizaines de captures PNG d'AUTRES tickets**, parce que la plupart des fichiers `captures-*.spec.ts` écrivent leurs PNG SANS garde par variable d'environnement (contrairement à la convention `zz-captures-*`/`CAPTURES_<TICKET>` plus récente). Après une suite complète, `git status` peut montrer des dizaines de fichiers `.png` modifiés ou nouveaux qui n'ont RIEN à voir avec le lot en cours — à vérifier et à annuler (`git checkout --`/`git clean`) avant de committer quoi que ce soit, sans quoi le diff se noie.
- **La recette AVANT/APRÈS** (mémoire de session, confirmée ici) : `git worktree add --detach <commit-parent>`, un lien symbolique vers `node_modules` (aucune dépendance changée → inutile de réinstaller), copier le `.env` et le fichier de capture, lancer avec un `PORT` différent (3101) pour ne pas entrer en conflit avec le port 3100 du dépôt principal. Le fichier de capture doit passer SANS MODIFICATION sur le code d'avant : assertions minimales (`page.locator("main")` visible), scène forgée par Prisma direct (jamais par les fonctions de dépôt neuves).
- **`contact_courriel_si_canal_email`** : tout contact créé par SQL brut ou par Prisma direct dans une épreuve doit porter un `email` dès que `canaux` garde son défaut (`{email}`) — sinon la contrainte refuse l'insertion, même pour un contact dont la fonction testée n'exige PAS de courriel (c'est le cas de `resumeDesCartesClients`, qui affiche un nom sans jamais écrire).
- **`roles: { has: "donneur_ordre" }`** (filtre Prisma sur une colonne `String[]`) n'avait aucun précédent dans ce dépôt avant ce lot — à chercher directement si un futur ticket en a besoin.
- Les trois vues de site se recouvrent : un site sans zone compte AUSSI dans « Trajet inconnu ». Une épreuve qui suppose ces ensembles disjoints se trompera.

## Ce qui reste à faire

- `9EB-TP-UX3-2-LISTES-2` : le parc et les imports au même gabarit.
- Lever l'écart nommé du code d'habilitation exigée, le jour où une lecture groupée des codes (`Habilitation.code`) est justifiée par un autre ticket.
- Revoir, un jour, la convention de capture ungated (hors territoire ici, juste signalée) : un `CAPTURES_<TICKET>` systématique éviterait l'effet de bord mesuré ci-dessus.
