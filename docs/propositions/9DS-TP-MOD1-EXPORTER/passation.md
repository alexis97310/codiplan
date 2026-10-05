# 9DS-TP-MOD1-EXPORTER — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

**Un bouton « Exporter » sur les trois écrans visés par MO-9** —
`/interventions`, `/parc`, `/vgp`. Il reprend les filtres actuellement posés
à l'écran (recherche, agence/type/statut/période/technicien pour les
interventions ; statut/client/site/famille pour le parc ; état/client/site
pour le registre VGP) et télécharge un classeur `.xlsx` nommé
`<écran>-<AAAA-MM-JJ>.xlsx`.

Pour l'exploitation :

- les colonnes du fichier sont EXACTEMENT celles que l'écran montre déjà —
  aucune colonne nouvelle, et surtout **aucune colonne de montant** (choix du
  pilote, aucun des trois écrans n'en affiche) ;
- **toutes les lignes du filtre courant sortent**, pas seulement la page de
  50 affichée à l'écran — mesuré sur 60 fiches/machines dédiées par lot de
  test (voir ci-dessous) ;
- le bouton n'apparaît que pour un rôle qui a `importer_exporter` — exactement
  les rôles qui voient déjà « Imports Excel » au menu (admin_societe,
  direction, responsable_materiel, adv en complet, responsable_sav en
  restreint) ;
- la route elle-même exige en plus la capacité de LECTURE de l'écran
  (`consulter_planning` pour les interventions, `consulter_parc_complet` pour
  le parc et le registre VGP) — aujourd'hui ce deuxième contrôle ne retire
  jamais personne qu'`importer_exporter` seul n'aurait pas déjà fermé (tous
  les rôles qui ont `importer_exporter` ont aussi la capacité de lecture de
  chaque écran), mais il protège le jour où ça cesserait d'être vrai (même
  raisonnement que D150 pour les imports).

Trois nouveaux lecteurs non paginés — `listerInterventionsPourExport`
(`lib/interventions/depot.ts`), `rechercherLeParcPourExport`
(`lib/machines/depot.ts`), `listerLeRegistrePourExport`
(`lib/vgp/registre.ts`) — réutilisent chacun le filtre unique déjà écrit pour
l'écran (`filtreDesInterventions`, `filtreDuParc`), `skip`/`take` retirés.
Aucune règle de gestion nouvelle, aucune politique RLS levée, aucune
dépendance nouvelle (`write-excel-file` est déjà installée).

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- **Isolation (base réelle, trois fichiers neufs)** —
  `tests/isolation/export-{interventions,parc,vgp}.test.ts` : 60 fiches ou
  machines dédiées posées par société, filtrées par un critère propre au
  test (type + date pour les interventions, numéro de série pour le parc et
  le registre VGP). Mesuré : l'export rend les 60, jamais la fiche de la
  société B ; la lecture PAGINÉE du même critère, elle, s'arrête à 50 — la
  preuve directe que l'export retire le plafond de page. Les trois fichiers
  passent (`pnpm test:isolation`, 159 fichiers, 1442 épreuves, tout vert).
- **De bout en bout (navigateur réel, scène dédiée `EXPORT9DS-`)** —
  `tests/e2e/export-registres.spec.ts` : le lien est visible, le clic
  déclenche un téléchargement nommé `<écran>-<date>.xlsx`, le fichier rouvert
  (`lireClasseur`) porte les en-têtes attendus et la ligne de l'épreuve.
- **Captures AVANT/APRÈS** (`captures/`) — `/interventions`, `/parc`, `/vgp`
  à 1280 et 375 px, scène de démonstration (I9, aucune donnée réelle) : AVANT
  = pas de bouton ; APRÈS = « Exporter » visible, aux deux largeurs. Une
  treizième capture (`interventions-fichier-ouvert.png`) montre le contenu
  RÉEL du fichier téléchargé (en-têtes + trois premières lignes), relu par
  `lireClasseur` plutôt que recopié à la main.
- **`CI=1 pnpm verify:full` rejoué EN ENTIER, en un seul appel, au premier
  plan** : format, typecheck, lint, 4048 tests unitaires, 1442 épreuves
  d'isolation, build, `feries:horizon`, `audit:partitions`, et la suite e2e
  complète — **921 épreuves, 914 passées, 7 sautées (préexistant, hors de ce
  lot), ZÉRO échec**, en 36,6 minutes.

## Ce que j'ai tranché et pourquoi

- **D169** (`docs/arbitrages.md`) écrit la décision MO-9 en entier :
  colonnes = celles de l'écran, aucun montant, aucun plafond inventé, deux
  capacités comme D150. Numéro réservé par le pilote (04/10), vérifié absent
  de `main` avant d'écrire — aucun conflit de numérotation.
- **Deux capacités, composées en deux temps plutôt qu'une seule porte neuve**
  — `exigerCapacite("importer_exporter")` puis `peut(contexte.role, "...")`
  juste après, dans chaque route. Choisi pour rester lisible par
  `tests/unit/auth/porte.test.ts` (qui ne voit que le PREMIER
  `exigerCapacite` d'une route) sans qu'il faille lui apprendre une nouvelle
  forme de porte à deux capacités.
- **La filtration du registre VGP (état/client/site/texte) n'a PAS été
  extraite en une fonction partagée dans `lib/vgp/registre.ts`.** Premier
  essai : `filtrerRegistre()`, appelée à la fois par `/vgp` (page.tsx) et par
  la route d'export. Ça cassait `tests/unit/gardiens/chemins-de-depot.test.ts`
  (R3-12) : ce gardien ne reconnaît un « chemin » que si un fichier atteint
  depuis `app/` appelle la fonction PAR SON NOM, littéralement — un appel
  fait seulement depuis une AUTRE fonction du même module `lib/` ne compte
  pas, même si cette fonction-là est bien atteinte. `estSansInformation` et
  `rechercheCorrespond` n'auraient alors plus eu AUCUN appelant direct depuis
  `app/` (seulement via `filtrerRegistre`, interne au module), et seraient
  devenues orphelines pour ce gardien. **Revenu en arrière** : `/vgp/page.tsx`
  garde sa chaîne de `.filter()` d'origine, inchangée ; la route d'export
  compose SA PROPRE chaîne, avec les MÊMES quatre prédicats déjà exportés et
  partagés (`echeanceDepassee`, `echeanceEstAVenir`, `estSansInformation`,
  `rechercheCorrespond`) — une petite duplication de glue (quatre lignes
  d'enchaînement de `.filter()`), jamais des RÈGLES, qui restent à un seul
  endroit chacune.
- **Le refus se dit différemment selon l'écran** : `/interventions` a déjà un
  mécanisme de bandeau `?motif=` (`estCleTraduction`), réutilisé par la route
  d'export (redirection 303). `/parc` et `/vgp` n'en ont aucun aujourd'hui —
  plutôt que d'en ajouter un (hors du territoire « bouton seulement » de ce
  ticket), leurs deux routes rendent un JSON `{ motif }` avec un statut 403
  simple.

## Ce que je n'ai PAS fait

- Pas de plafond sur l'export — tranché par le pilote (D169), mesuré par les
  60 lignes des trois fichiers d'isolation.
- Aucune colonne de montant, aucune colonne nouvelle hors de ce que l'écran
  montre déjà.
- Pas de CSV, pas de ligne-marqueur rechargeable (un export ne se réimporte
  jamais — `classeurDUneFeuille` n'écrit QUE en-têtes + lignes, à la
  différence de `classeurDesRejets`).
- Je n'ai pas ajouté de garde de capacité sur `/parc` ni `/vgp` eux-mêmes —
  ces deux écrans restent ouverts à toute personne ayant une société active
  (périmètre par personne, QT-2/D152), exactement comme avant ce lot ; seule
  l'EXPORT porte la capacité `importer_exporter` en plus.
- Je n'ai pas touché au mécanisme de refus de `/parc`/`/vgp` au-delà de la
  route d'export (pas de nouveau bandeau `?motif=` sur ces deux pages).

## Les pièges pour la session suivante

- **Le gardien R3-12 (`chemins-de-depot.test.ts`) ne suit PAS les appels
  internes à un module `lib/`.** Si une fonction de dépôt n'est appelée QUE
  par une autre fonction du MÊME fichier, et que cette dernière est la seule
  à être appelée depuis `app/`, la première devient « orpheline » pour ce
  gardien — même si elle est, en pratique, bien atteinte. Avant d'extraire
  une fonction de composition partagée dans un module `lib/`, vérifier que
  CHAQUE prédicat qu'elle appelle garde au moins un appelant direct, nommé,
  depuis un fichier d'`app/`.
- **Lancer la suite e2e complète (`pnpm test:e2e`, ou `verify:full`) régénère
  et modifie, EN PLACE, des dizaines de captures PNG/PDF d'anciens tickets
  dans `docs/propositions/*/captures/`** — constaté ici : 112 fichiers
  modifiés et 18 fichiers neufs sont apparus après un seul run complet,
  aucun lié à ce lot. Ce n'est pas un défaut de ce lot : plusieurs scénarios
  e2e écrivent leurs captures directement dans le dépôt à chaque exécution.
  **Avant de committer quoi que ce soit après un `verify:full`, vérifier
  `git status` et ne jamais ajouter en bloc** (`git add -A`/`.`) — ici,
  `git checkout --` sur les fichiers modifiés et une suppression ciblée des
  fichiers neufs ont suffi à ne garder que le territoire de ce lot.
- **Captures AVANT/APRÈS prises APRÈS coup**, via un worktree jetable
  (`git worktree add /tmp/codiplan-avant 62cd5d90`) pointé sur LA MÊME base
  `E2E_DATABASE_URL` déjà migrée/seedée (ce lot ne pose aucune migration,
  donc aucun nouveau seed n'était nécessaire) — serveur `next dev` sur un
  port dédié (3101 puis 3102), jamais le 3100 par défaut de Playwright, pour
  ne jamais entrer en conflit avec un `pnpm test:e2e` qui tournerait par
  ailleurs. Le worktree et les deux serveurs ont été proprement arrêtés et
  retirés (`git worktree remove --force`) avant de continuer.
- **Le compte `adv@codima.test` / `epreuve-de-bout-en-bout-codiplan`** (le
  compte de l'épreuve e2e standard, `tests/e2e/setup/scene.ts`) porte
  `importer_exporter` ET les trois capacités de lecture — suffisant pour
  capturer les trois écrans sans second facteur.

## Ce qui reste à faire

- **D169 reste à valider par Alexis** (précisions du pilote, comme les
  décisions D150 et suivantes) — en particulier le choix de fermer l'export
  derrière la capacité de LECTURE de l'écran plutôt que la seule
  `importer_exporter`, et l'absence de tout plafond.
- Aucune autre route de refus nommé n'a été ajoutée sur `/parc` ni `/vgp` —
  si un futur lot pose un mécanisme de bandeau `?motif=` sur ces deux écrans,
  les routes d'export de ce lot pourraient alors basculer du JSON 403 vers
  la même redirection 303 que `/interventions`, pour rester cohérentes.
- Les clients, les sites, les absences et « À facturer » restent hors
  export — MO-9 ne nommait que ces trois écrans ; une extension future se
  pose ailleurs, pas ici.
