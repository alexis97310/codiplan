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

## Reprise 9EBA (9EBA-REPRISE-9EB-1, 08/10/2026)

**Pourquoi cette reprise.** La session 9EB-1 (07/10, 20:02–22:28) a terminé en disant
`pnpm verify:full` entièrement vert, mais sa VÉRIFICATION INDÉPENDANTE — `CI=1 pnpm
verify:full` rejoué par la file dans un worktree séparé — est tombée rouge deux fois de
suite, en ~1 minute à chaque passage (22:29, 22:30) : trop vite pour les tests longs,
donc une étape précoce. La garde `9EB-TP-UX3-2-LISTES-1-garde` a conservé les 9 commits
de la session.

**La cause trouvée, en une phrase.** `pnpm test` (unitaire) échouait dès le gardien
`sans-chaine-visible-en-dur.test.ts` (L0-11) : trois chaînes visibles écrites en dur
dans `tests/e2e/clients-sites-vues.spec.ts` — `"1"` (compte de puce) et « Donneur
d'ordre » répétée deux fois dans une requête d'écran (`getByText`). `CI=1` n'a rien à
voir avec l'écart : le gardien tourne identiquement en local, et rien n'indique que la
session 9EB-1 l'ait jamais exécuté avant son dernier commit.

**Ce qui a été fait :**

1. Les 9 commits de la garde rejoués (`git cherry-pick`) sur `origin/main` à jour
   (`73e7cf90`, qui porte déjà 9EI-TP-UX5-1-FORMULAIRES). Un seul conflit, dans
   `docs/arbitrages.md` : les deux sessions avaient écrit, en parallèle, une décision
   D178 chacune. 9EI a été publiée en premier (elle reste D178, texte intact) ; la
   décision de ce lot (« LISTES CLIENTS ET SITES… ») est renumérotée **D179** — texte
   inchangé, seuls le titre et les six renvois dans le code/la passation sont corrigés
   (`app/(back-office)/clients/page.tsx`, `clients/carte-client.tsx`,
   `app/(back-office)/sites/page.tsx`, `sites/presentation.ts`, `lib/i18n/fr.ts`,
   `tests/e2e/clients-sites-vues.spec.ts`, ce fichier). **Un renvoi à D178 appartenant
   réellement à 9EI** (`lib/i18n/fr.ts:1746`, sur `/interventions/nouvelle`) a été
   touché par erreur par un remplacement global puis restauré : vérifier, après tout
   remplacement en masse d'un numéro de décision, qu'aucune occurrence légitime d'un
   AUTRE ticket ne partage la même chaîne.
2. Le gardien L0-11 corrigé : `"1"` devient `String(1)` (forme déjà admise ailleurs,
   `planning-mois-charge.spec.ts`, `imports-historique.spec.ts` — un argument NUMÉRIQUE
   dans un appel non reconnu du dictionnaire échappe à l'analyse littérale). « Donneur
   d'ordre » devient `fr["listes1.e2e.donneur_ordre"]` (nouvelle entrée, même famille que
   `equipe.e2e.*`/`qt16.e2e.nom_interlocuteur`) : la carte est déjà retrouvée par son
   titre (préfixé, scène propre) avant cette assertion, qui n'a donc besoin de vérifier
   que ce seul mot — le préfixe de scène reste devant ce mot dans le nom posé en base
   (`NOM_DONNEUR_ORDRE`), mais est inutile, et donc absent, de l'assertion elle-même.
3. `CI=1 pnpm verify:full` rejoué EN ENTIER, un seul appel, achevé à **02h48 (Nouméa) /
   15h48 UTC le 08/10/2026**, démarré à 02h04 : **TOUT VERT** —
   `format:check`/`typecheck`/`lint` verts ; `pnpm test` 408 fichiers/4334 tests ;
   `pnpm test:isolation` 167 fichiers/1487 tests ; `pnpm build` vert ; `feries:horizon`
   vert ; `audit:partitions` préventif ET détectif verts ; `pnpm test:e2e` **1029
   passed, 48 skipped, 0 failed (41,0 min)**.
4. La suite e2e complète a regénéré, sans rapport avec ce lot, 153 captures PNG
   modifiées et 12 captures neuves d'AUTRES tickets (le piège documenté par 9EB-1
   elle-même, ci-dessus) : restaurées (`git checkout --`) ou supprimées (nouvelles,
   `rm`) avant de committer ; `git status --porcelain` vide, `format:check` revérifié
   vert après restauration.

**Le ticket original, introuvable dans ce worktree.** `tickets/recales/9EB-TP-UX3-2-
LISTES-1.md` n'existe pas ici (recherché dans tout le dépôt et dans les worktrees
voisins) : aucun ADDENDUM RECALAGE, aucun texte des choix P1–P9 du pilote autre que ce
que la passation de 9EB-1 en dit déjà elle-même. Le tableau ci-dessous s'appuie donc
sur cette passation et sur la décision D179, confrontées au code réel (fichiers,
fonctions, tests listés tous retrouvés par `git ls-files`/`grep`) — **ce n'est pas une
relecture du ticket lui-même**, qui reste à faire si le texte original est retrouvé.

| Partie / choix | Déclaré par la passation 9EB-1 | Vérifié dans le dépôt |
|---|---|---|
| Parties A–C (`/clients` : puces, tri, résumé, carte) | Fait | `app/(back-office)/clients/page.tsx`, `carte-client.tsx`, `comptesVueClients`/`resumeDesCartesClients` (`lib/clients/depot.ts:718,882`) — présents |
| Parties A–C (`/sites` : puces, menus, carte) | Fait | `app/(back-office)/sites/page.tsx`, `resumeDesCartesSites` (`lib/sites/depot.ts:727`), `machinesVgpDepasseeParSite` (`lib/vgp/registre.ts:420`) — présents |
| `CarteEntite` (`href`, `chiffres`) | Fait | `components/ui/carte-entite.tsx` — `href` facultatif, titre 16 px/extrabold et `CLASSES_LIEN` seulement si fourni ; `data-chiffre` posé |
| `components/ui/puces-filtre.tsx` (`PuceVue`/`PuceMenu`/`ResumeListe`) | Fait | présent ; `PuceMenu` confirmé `<select>` natif |
| 4 fonctions de dépôt groupées + exemptions `chemins-de-depot.ts` | Fait | `equipementsParClient`/`compterSansCodeExterne` exemptées, motif présent (`scripts/lib/chemins-de-depot.ts:634,640`) |
| Partie D — décision D178/D179 | Fait, **renumérotée D179 par cette reprise** | `docs/arbitrages.md` — D179 présente, texte inchangé |
| Épreuves d'isolation (fonctions groupées) | Fait | `tests/isolation/resume-cartes-clients.test.ts`, `resume-cartes-sites.test.ts` |
| Épreuves unitaires (CarteEntite/PuceVue/PuceMenu/ResumeListe/chiffres) | Fait | `tests/unit/ui/carte-entite.test.ts`, `puces-filtre.test.ts`, `tests/unit/clients/chiffres-carte.test.ts`, `tests/unit/sites/chiffres-carte.test.ts` |
| Adaptation des épreuves existantes (7 fichiers nommés) | Fait | `listes-1`, `gr12-sites`, `sites`, `client-desactivation-refusee-qt16`, `indicateurs-donnees`, `habilitations`, `imports` — tous présents |
| Épreuve e2e dédiée `clients-sites-vues.spec.ts` | Fait, **corrigée par cette reprise** (gardien L0-11) | présente, verte dans `verify:full` |
| Adapte `parc-sites.spec.ts` (lien client retiré) | Fait | présent |
| Captures AVANT/APRÈS (12+12 PNG) | Fait, conservées telles quelles | aucun écran changé par cette reprise — pas de régénération |
| P1–P9 du pilote (07/10) | Déclarés « suivis à la lettre » par 9EB-1, non détaillés un à un par la passation | Échantillon vérifié : pas de bouton Exporter ajouté, carte 16 px/padding/`CLASSES_LIEN` conditionnés à `href`, menus en `<select>` natifs — cohérent avec la déclaration |
| « Ce que je n'ai pas fait » (LISTES-2, fiches, export, code d'habilitation) | Déclaré non fait | Confirmé non fait — hors territoire de cette reprise, non repris |

**Ce que je n'ai PAS fait.** Aucune fonctionnalité nouvelle, aucune migration, aucune
ligne de semis, aucun prix : cette reprise ne touche que la cause du rouge (gardien
L0-11) et la collision de numérotation D178/D179. Le territoire de LISTES-2 (parc,
imports) n'est pas entamé. Le texte du ticket original n'a pas pu être relu : si
`tickets/recales/9EB-TP-UX3-2-LISTES-1.md` réapparaît, le tableau ci-dessus mérite
d'être refait contre son texte exact, en particulier le détail des neuf choix P1–P9.

**Les pièges pour la session suivante.** Un remplacement global d'un numéro de décision
(`D178` → `D179`) peut toucher une occurrence légitime d'un AUTRE ticket partageant le
même numéro de départ — vérifier `git log --oneline -- <fichier>` avant de supposer
qu'un fichier n'appartient qu'au lot en cours. Le piège des captures ungated régénérées
par la suite e2e complète (documenté par 9EB-1 elle-même) s'est reproduit à l'identique
: 165 fichiers à trier avant de committer.
