# 9EF-TP-UX4-2-FICHES-2 — passation

Dépôt alexis97310/codiplan, main mesuré à `13cce6b3` au départ (origin/main n'a pas bougé pendant le
lot — `git fetch origin` confirmé avant d'écrire cette passation). Sept commits locaux, sur `HEAD`
détaché (état déjà ainsi au démarrage de la session), aucun push :

```
000acc9b en-tête de la fiche machine au gabarit de fiche (QE-9)
49cf5b23 fiches contact au gabarit de fiche (QE-9, QE-13a)
7faf8251 depuis= ramène le fil de la fiche machine à son origine (reliquat 9DR)
1c948401 D192 : décision du lot, et Kv à une colonne sous 901px
2da80eff captures APRÈS de l'en-tête fiche machine et des fiches contact
c18cf801 corrige le nom fixe de la scène des captures (L0-11)
492d8c17 adapte deux épreuves étrangères rougies par ce lot
```

## 1. Ce que j'ai changé, et ce que ça change pour l'exploitation

**L'en-tête de la fiche machine** (`/parc/[id]`, QE-9, D192) remplace la bannière `.machine-banner` par
l'en-tête partagé de `Page`/`EnTeteFiche` (9EE) : surtitre « Machine · <référence interne> », titre
« <famille> · <marque> <référence du modèle> » (une seule fonction, `titreMachine`, partagée par le
`<h1>`, le fil d'Ariane et le titre d'onglet), une pastille de statut, et cinq faits à icônes — Client,
Site, N° de série, Année de vente, VGP (état + échéance, sans le lien « Enregistrer », qui reste dans la
carte Identité). « Corriger la fiche » et « + Intervention » passent en tête d'écran, « + Intervention »
collée au bas de l'écran sous 901 px (décision 69). **L'alerte passe au rouge pour une machine EN PANNE**
(décision 54 d'Alexis du 09/10, qui amende D125 sur ce seul point) ; les autres statuts non en service
gardent l'orange. Pour l'exploitation : une machine en panne se signale désormais au même rouge que les
autres signaux d'alerte du produit, et le nom de la machine/sa référence est lisible d'un coup d'œil sans
dérouler vers une bannière séparée.

**Les fiches contact** (`BlocContacts`, partagé par les fiches client et site) composent leur titre et
leur compte une seule fois — « Interlocuteurs (n) » — et rendent téléphone, mobile et courriel en liens
`tel:`/`mailto:` **visibles sans ouvrir la fiche** (ils vivaient jusqu'ici dans un `<details>` fermé, sans
lien). Un avatar par interlocuteur, une pastille bleue pour le rôle « Donneur d'ordre ». Sous un donneur
d'ordre actif : « Reçoit les courriels de planification. » s'il est celui que `destinataireClient`
(CS45, D165) a retenu, ou « Ne recevra rien tant qu'il n'a pas de courriel. » sinon (voir §4 — ce second
cas est aujourd'hui irréalisable en pratique). Le crayon qui ouvre les deux formulaires existants
(modifier, activité) est son propre bouton ; « + Interlocuteur » ouvre le formulaire de création existant
derrière un bouton secondaire, dernier élément du bloc, ouvert d'office quand une saisie refusée est
gardée (9DO). Pour l'exploitation : un ADV voit en un coup d'œil qui appeler/qui écrire sans ouvrir
chaque fiche, et sait immédiatement si le donneur d'ordre recevra les courriels de planification.

**Le fil d'Ariane de la fiche machine suit son origine** (`?depuis=client|site|vgp`, reliquat n°2 de
9DR-TP-NAV2-RETOURS-FIL) : les liens vers `/parc/[id]` des fiches client, site et du registre VGP posent
ce paramètre, et le premier maillon du fil ramène directement à l'origine plutôt que toujours au parc.

## 2. Ce que j'ai mesuré

- Unitaires (`pnpm exec vitest run --project unit`) : **4605/4605 verts** avant comme après (les 7
  commits n'en cassent aucun ; quelques-uns ont été ADAPTÉS au plus juste, voir §3).
- `pnpm verify` (format:check + typecheck + lint + test + test:isolation + build) : **vert, code de
  sortie 0**, confirmé en fin de lot (test:isolation : 1524/1524 ; build : réussi).
- `CI=1 pnpm verify:full` (ajoute `feries:horizon`, `audit:partitions`, `test:e2e`) : joué **deux fois en
  entier**.
  - Premier passage : deux rouges, tous deux causés par ce lot et compris immédiatement —
    `captures-9br-tpa4b-messages.spec.ts` (le formulaire de création d'interlocuteur vit maintenant
    derrière « + Interlocuteur », fermé par défaut) et `historique-client-machine.spec.ts` (le lien vers
    la fiche machine porte désormais `?depuis=client`, cassant une égalité stricte de `href`). Les deux
    ont été adaptés AU PLUS JUSTE (un clic d'ouverture, un préfixe au lieu d'une égalité), sans toucher
    une seule assertion de fond (commit `492d8c17`).
  - Second passage : **un seul rouge, sans rapport avec ce lot** —
    `pg-g16-statut-ressource.spec.ts:104` (« créer un technicien PATENTÉ… sur le planning »), qui
    attend une ligne visible sur `/planning?vue=jour`. Le calendrier a changé de jour PENDANT ce passage
    (47 minutes) : le 11/10/2026 tombe un DIMANCHE (`python3 -c "import datetime;
    print(datetime.date(2026,10,11).strftime('%A'))"` → `Sunday`), et aucune agence de démonstration n'a
    de créneau ce jour-là — la vue « jour » ne rend donc aucune ligne technicien, pour N'IMPORTE QUEL
    technicien, pas seulement celui créé par ce test. Rejoué SEUL, le même rouge persiste (reproductible,
    daté). Aucun fichier de ce lot ne touche `/planning`, `/parametres/equipe` ni la création de
    technicien — cette épreuve est étrangère au territoire, datée, et n'a pas été modifiée : la
    réparer exigerait de fixer une date de test (hors du territoire déclaré, et une vraie décision sur la
    façon de figer le temps dans ce fichier précis).
- Épreuves ciblées rejouées individuellement, toutes vertes : `fiche-machine.spec.ts` (3/3),
  `contacts.spec.ts` (2/2), `saisie-gardee-tpa4b.spec.ts` (4/4, isolé — un rouge de comptage société
  observé en parallèle avec d'autres specs, confirmé non reproductible seul), `liens-fiches.spec.ts`
  (2/2), `9dr-fil-d-ariane.spec.ts` (7/7, dont le nouveau scénario `?depuis=client`),
  `tous-les-ecrans-rendent.spec.ts` + `9ef-tp-ux4-2-fiches-1.spec.ts` + `zz-captures-9do.spec.ts` (67/67),
  `historique-client.spec.ts` + `historique-site.spec.ts` + `creation-depuis-client-tpa1.spec.ts` +
  `fiche-360-1.spec.ts` (13/13), `captures-9ef-fiches-2.spec.ts` (3/3, avec et sans `CAPTURES_9EF2`).
- Icône `hash` confrontée au contour de la maquette (`tests/unit/ui/icone.test.tsx`, 56/56).
- `tests/unit/docs` (dont `amendements-arbitrages.test.ts`, la décision D192) : 109/109.

## 3. Ce que j'ai tranché, et pourquoi

- **`machine-banner` sort de `BLOCS_ATTENDUS`** (`tests/unit/machines/composition-fiche.test.ts`) plutôt
  que d'inventer un `data-bloc` sur l'en-tête partagé de `Page` : `Page` sert toutes les fiches, et lui
  poser un marqueur propre à `/parc/[id]` aurait été une fausse preuve. L'écart est nommé dans
  `lib/machines/ecarts-maquette.ts` (`ECARTS_MAQUETTE_CONTENU_FICHE`, entrée « Bannière »).
- **Le dernier maillon du fil porte l'objet** (`titreMachine`), jamais le n° de série que la maquette du
  28/09 y dessine : le fil garde le même libellé que le titre de la fiche, jamais un troisième nom pour
  la même machine. Nommé dans D192.
- **Le formulaire de création d'interlocuteur reste le DERNIER `<form>` du bloc** (contrainte explicite
  du ticket, `contacts.spec.ts:190/238`) plutôt que déplacé « en tête » comme le lisait une première
  lecture du ticket : les deux tensions ont été résolues en faveur de la contrainte de test explicite.
- **« Ne recevra rien tant qu'il n'a pas de courriel »** (branche `contact.email === null` dans
  `LigneContact`) est du code DÉFENSIF, pas un chemin atteignable aujourd'hui : la contrainte SQL
  `contact_courriel_si_canal_email` (migration `20260907140000_contact_l1_03`) exige un courriel dès que
  `canaux` porte `email`, et `email` est le SEUL canal connu (`CANAUX_CONNUS`). Un contact sans courriel
  ne peut donc pas exister aujourd'hui — le code reste correct pour le jour où `canaux` pourrait être
  vide (une passerelle SMS future, par exemple), mais aucune capture ni aucun test ne peut l'exercer
  honnêtement. Mesuré en écrivant la fixture des captures : la tentative de créer un contact sans
  courriel a été refusée par PostgreSQL, deux fois (`contact_canaux_non_vides` d'abord, puis
  `contact_courriel_si_canal_email`).
- **L'alerte rouge se limite au statut `en_panne`** : la maquette du 28/09 ne dessine une alerte que pour
  une machine en panne ; les autres statuts non en service (`arretee`) gardent l'orange de D125, faute de
  décision nommée pour eux.
- **`Kv` passe à une colonne sous 901 px** (`components/ui/maitre-detail.tsx`) — son second appelant
  (`/parc`, l'aperçu du maître-détail) en hérite aussi ; mesuré avant d'écrire, le test
  `tests/unit/ui/composants-maquette.test.ts:638` ne demande qu'un `toContain("grid-cols-2")`, qui reste
  vrai.
- **Reliquat `?depuis=`** (addendum du 06/10) traité dans ce même lot plutôt que laissé de côté : les
  cinq liens cités par l'addendum (clients ×2, sites ×2, vgp ×1) ont reçu leur paramètre, et deux épreuves
  existantes (`historique-client-machine.spec.ts`, la ligne 182) ont dû être adaptées en conséquence
  (voir §2).

## 4. Ce que je n'ai PAS fait

- **La carte « VGP » séparée**, l'emplacement des gestes sur la machine (« Changer l'état »,
  « Transférer », « Remplacer », « Sortir du parc ») et l'historique des états et des emplacements de la
  maquette : aucun n'existe dans ce dépôt (QT-12, migration) — nommé en question ouverte dans D192, pas
  construit.
- **Le bornage de l'historique des interventions de la fiche machine** (décision 26 du 05/10, « 4 lignes
  puis Tout voir ») : NON appliqué — aucune destination « Tout voir » n'existe pour un historique filtré
  par machine (le registre des interventions n'a pas de filtre « machine »).
- **La décision 55 d'Alexis** (ordre de l'identité selon la maquette) : NON appliquée — D126 continue de
  gouverner le contenu du `dl.kv` d'identité, hors territoire de ce lot.
- **Le tri des interlocuteurs de la fiche SITE** reste alphabétique, sans le donneur d'ordre en tête (à
  la différence de la fiche CLIENT et de la maquette) — règle de tri inchangée, hors territoire.
- **Le débordement en largeur des fiches client et site** (mesuré par 9EF-TP-UX4-2-FICHES-1 sur ses
  propres captures, 1330 px à 1280 et 742/380 px à 375) n'est PAS corrigé : aucune des deux fiches n'est
  dans le territoire de ce ticket, hors l'ajout de `?depuis=` aux liens listés en §1. Signalé au pilote,
  nommé dans D192.
- **La bascule en cartes de l'historique et des documents de la fiche machine sous 900 px** (Y12 du
  ticket) : non construite — seules la barre d'action collée, le repli à une colonne de `Kv` et le
  partage « Corriger la fiche »/« Corriger » entre en-tête et carte Identité ont été faits. Les tableaux
  de l'historique et des documents restent dans leur `CadreDefilant` existant (défilement horizontal),
  comportement inchangé.
- **Aucune capture AVANT** : comme 9EF-TP-UX4-2-FICHES-1 avant ce lot, aucune image AVANT n'existait sur
  `main` — les captures de ce lot sont APRÈS seulement (voir leur README).

## 5. Pièges pour la session suivante

- **Un `pnpm test:e2e` orphelin tournait déjà dans ce worktree au démarrage de cette session** (PID
  parent `/init`, 55 minutes d'âge, ~15 connexions `codiplan_test` idle) — vraisemblablement un reliquat
  d'un tour précédent de CETTE conversation, backgroundé contrairement à la règle. Il a bloqué
  `recreerLaBase` (« database is being accessed by other users ») au premier essai. Je l'ai arrêté
  (`kill -TERM` puis `-KILL` sur les deux groupes de process) avant de continuer — si ça se reproduit,
  vérifier `ps aux | grep codiplan_test` avant de lancer quoi que ce soit.
- **`pnpm test:e2e` régénère les captures d'AUTRES tickets** si leurs variables d'environnement
  `CAPTURES_*` sont actives par défaut en CI (`CI=1`) — `git status` après `verify:full` a montré ~175
  PNG modifiés et 12-13 nouveaux à chaque passage, tous étrangers à ce lot. Tous `git checkout --`/
  supprimés avant de committer, comme l'annonce Y18 de l'addendum. **PIÈGE RÉEL RENCONTRÉ** : le script
  de nettoyage automatique a supprimé par erreur `docs/propositions/9EF-TP-UX4-2-FICHES-2/passation.md`
  lui-même à la première tentative (il matchait le motif générique « fichier non suivi sous
  `docs/propositions` ») — il a fallu le réécrire. Exclure explicitement le dossier du PROPRE ticket de
  tout nettoyage générique par motif.
- **`pg-g16-statut-ressource.spec.ts` rougit un dimanche** (voir §2) — daté, reproductible, étranger à ce
  lot. Ne pas le prendre pour un rouge causé par ce commit si `verify:full` est rejoué un autre
  dimanche/jour sans créneau.
- **`BlocContacts` n'a plus de prop `titre`/`texteVide`** : si un futur appelant tente de les repasser,
  TypeScript le refusera (bon signe) — le titre et le texte vide sont désormais composés À L'INTÉRIEUR du
  composant (`contacts.bloc.titre`, `contacts.vide`).
- **`LienPrimaire` accepte désormais une prop `bloc`** (posée comme `data-bloc`, même convention que
  `CarteEnTete`/`Kv`) — pas `dataBloc` (nom retenu après coup pour que le gardien de composition la
  reconnaisse, qui ne lit que `data-bloc="X"` littéral ou `bloc="X"` dynamique).
- **Les clés `clients.fiche.contacts` (« Contacts »), `clients.fiche.contacts_vide` et
  `sites.fiche.contacts_vide_prefixe`** sont désormais ORPHELINES (plus aucun appelant) — gardées
  volontairement, sur instruction explicite du ticket (« ne sont NI modifiées NI supprimées ») ; un futur
  lot de nettoyage peut les retirer si aucun gardien ne s'y oppose.
- **`videContactsSite()`** (`app/(back-office)/sites/presentation.ts`) est, pour la même raison,
  désormais sans appelant dans le code applicatif (seul son export reste).

## 6. Ce qui reste à faire

- Construire la carte « VGP » séparée, l'emplacement des gestes sur la machine et l'historique des états
  et des emplacements — TP-PARC, migration requise (QT-12).
- Trancher le bornage de l'historique des interventions de la fiche machine, avec une destination
  « Tout voir » (un filtre « machine » du registre des interventions n'existe pas encore).
- Appliquer la décision 55 d'Alexis (ordre de l'identité selon la maquette) à la fiche machine — lot
  dédié, D126 à amender explicitement.
- Corriger le débordement en largeur des fiches client et site (1330 px à 1280, 742/380 px à 375) —
  mesuré par 9EF-TP-UX4-2-FICHES-1, hors territoire des deux tickets FICHES.
- Construire la bascule en cartes de l'historique et des documents de la fiche machine sous 900 px
  (décision 69), si Alexis la confirme nécessaire au-delà de la barre d'action collée déjà posée.
- Aligner le tri des interlocuteurs de la fiche site sur celui du client (donneur d'ordre en tête), si
  Alexis le demande.

## 7. Reprise 9EFA-REPRISE-9EF-2 (11/10)

Dépôt mesuré à `origin/main` = `39ac9887` (9E0-E2E-DIMANCHE-PG-G16 y est déjà, confirmé avant de
commencer). Les 8 commits de la garde `9EF-TP-UX4-2-FICHES-2-garde` ont été rejoués par `git
cherry-pick` SANS AUCUN CONFLIT (une première tentative avec une plage mal bornée, `A..B` au lieu de
`A^..B`, a exclu le premier commit — repérée avant de committer quoi que ce soit, reprise propre). Le
reliquat non commité nommé par le lot (`voie1-reste-1011-0215`) ne porte que des captures PNG d'un
AUTRE ticket (« bandeau-transmis », « fiche-reprise », « fiche-bureau-* ») : hors territoire, non repris.

**`CI=1 pnpm verify` et `CI=1 pnpm verify:full` sont passés VERTS au premier essai**, sans aucune
correction : 4605/4605 unitaires, 1524/1524 isolation, build réussi, 1201/1201 e2e passés (48 ignorés,
aucun échec). Le rouge daté du dimanche que la session précédente avait signalé (`pg-g16-statut-
ressource.spec.ts`) a disparu, puisque 9E0-E2E-DIMANCHE-PG-G16 corrige précisément ce point et est
déjà sur `main`.

**Y19 traité** (seul point resté ouvert d'Y0-Y20 qui tenait dans le budget du lot) : le débordement en
largeur des fiches client et site, mesuré par 9EF-TP-UX4-2-FICHES-1 (1330 px à 1280, 742/380 px à 375),
avait DEUX causes distinctes, toutes deux dans l'onglet « Aperçu » :
- **Fiche site** : la colonne de gauche de la grille `grid items-start gap-4 lg:grid-cols-[1fr_300px]`
  n'avait pas `min-w-0` — un `Tableau` y pose un `minWidth` (720 px pour les machines, 640 px pour
  l'historique), et sans `min-w-0` le track de la grille ne peut pas rétrécir sous cette largeur
  (comportement par défaut de `minmax(auto, 1fr)`), ce qui pousse toute la page hors de l'écran au lieu
  de laisser le `CadreDefilant` interne défiler seul.
- **Fiche client** : la grille des cartes de sites posait `style={{ gridTemplateColumns: "repeat(2,
  1fr)" }}` EN LIGNE, qui prime TOUJOURS sur la classe Tailwind `max-[900px]:grid-cols-1` censée la
  remplacer sous 900 px — la responsivité n'a donc jamais joué. Remplacé par la seule classe Tailwind
  `grid-cols-2` (qui pose `minmax(0,1fr)`, pas `1fr` nu : la grille peut aussi rétrécir en dessous du
  contenu de chaque carte).

Correctif : `min-w-0` ajouté à la colonne de gauche dans `sites/[id]/page.tsx` et `clients/[id]/page.tsx`
(même grille dans les deux fichiers) ; le `style` en ligne de la grille des sites retiré au profit de
`grid-cols-2` dans `clients/[id]/page.tsx`. Aucune donnée, colonne ni comportement de défilement interne
retiré.

Épreuve neuve : `tests/e2e/9efa-reprise-y19-debordement.spec.ts`, lecture seule sur la scène de
démonstration (I9, pas de fixture forgée) — un client CODIMA-NC avec au moins deux sites, un site
CODIMA-NC avec au moins une machine et une intervention (les deux conditions qui mettent `Tableau` et
la grille des cartes sous tension), `document.documentElement.scrollWidth <=
document.documentElement.clientWidth` à 1280 et à 375 px, sur `/clients/<id>` et `/sites/<id>`.
**Rouge confirmé avant correctif** (`git stash` temporaire des deux fichiers, assertions jouées :
742, 1330 et 477 — les mêmes ordres de grandeur que les captures du pilote), **vert après** (4/4) ;
`pnpm typecheck`, `pnpm lint` et `pnpm format:check` passés séparément (pas de second `verify:full`
complet, pour tenir le budget du lot).

Ce qui reste d'Y0-Y20 : rien d'autre n'était listé comme non fait dans la passation d'origine (§4, §6)
— VGP séparée/gestes/historique des états (TP-PARC, migration), bornage « Tout voir » de l'historique
machine, décision 55 (ordre de l'identité), tri des interlocuteurs du site, bascule en cartes sous
900 px pour l'historique/documents de la fiche machine : tous explicitement hors territoire ou en
question ouverte dans D192, non repris ici.

Fin de session : rebase sur `origin/main` effectué (voir le dernier commit de ce lot), `CI=1 pnpm
verify` rejoué après rebase, `git status --porcelain` vide avant de rendre la main.
