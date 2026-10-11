# Passation — 9EFB-CORRECTIFS-FICHES-9EFA

## 1. Ce que j'ai changé (et ce que ça change pour l'exploitation)

- **A — Gardien du rouge (décision 54).** Nouvelle épreuve e2e
  `tests/e2e/9efb-correctifs-gardien-rouge.spec.ts` : une machine `en_panne`
  doit porter `bg-app-rouge-fond text-app-rouge-encre` sur l'alerte de
  `parc/[id]/page.tsx`, et un autre statut hors service (`arretee`) ne doit
  jamais les porter. Sans ce gardien, un retour silencieux à l'orange
  passait inaperçu (aucun gardien unitaire ne rend cette page, JSX en ligne
  d'une page serveur).
- **B — Preuve Y19 rendue déterministe.** `tests/e2e/9efa-reprise-y19-debordement.spec.ts`
  ne lit plus la scène de démonstration au hasard (`groupBy`/`findFirstOrThrow`
  sans `orderBy`) : elle forge sa propre scène préfixée `9EFBY19-` (client,
  site, deux machines, deux interventions) pour garantir que les tableaux
  larges (`BlocMachines` 720 px, `BlocInterventions` 640 px, onglets
  « Sites » 520 px et « Interventions » 1000 px) sont bien rendus, puis
  vérifie `scrollWidth <= clientWidth` à 1280 et 375 px sur les deux fiches.
  Captures APRÈS régénérées dans `docs/propositions/9EFB-CORRECTIFS-FICHES-9EFA/captures/`
  (celles de 9EF-TP-UX4-2-FICHES-1 ne sont pas touchées).
- **C — Y12, historique de la fiche machine au téléphone.** Sous 900 px, le
  tableau de l'historique (`data-bloc="historique-table"`) se masque et une
  `ListeCartes`/`Carte` le remplace, vers le même lien que la ligne masquée
  (`/interventions/${id}?depuis=machine&depuis_id=...`). Les documents
  restent dans leur tableau à défilement : leurs lignes ne portent aucun
  lien (Z12), rien à y basculer. Nouvelle épreuve
  `tests/e2e/9efb-y12-fiche-machine-telephone.spec.ts`.
- **D — Y13, interlocuteurs au téléphone.** Les liens `tel:`/`mailto:` de
  `app/(back-office)/contacts/presentation.tsx` portent désormais
  `${CLASSES_LIEN} inline-flex min-h-[32px] items-center` (ajout, pas de
  remplacement — gardien lien-visible). Nouvelle épreuve
  `tests/e2e/9efb-y13-contacts-telephone.spec.ts`.
- **E — Textes faux depuis le correctif Y19.** D192 et la passation de 9EFA
  disaient encore « n'est pas corrigé ici » pour le débordement des fiches
  client/site, faux depuis `aa430a57` : une ligne datée complète chaque
  mention (le texte d'origine n'est pas effacé). « Corriger la fiche » de
  l'en-tête de la fiche machine porte désormais la clé propre
  `machine.fiche.corriger` (même libellé que `machine.modifier.titre`, qui
  reste intacte pour `/parc/[id]/modifier`) et une icône crayon.

Pour l'exploitation : les fiches client, site et machine ne débordent plus
horizontalement à 375 px (plus de défilement latéral involontaire sur le
terrain), l'historique machine redevient lisible en colonne au téléphone, et
les liens de contact sont tactiles (32 px) sur les fiches client/site.

## 2. Ce que j'ai mesuré (comptes AVANT/APRÈS)

- **Rapide (format/types/lint/unitaires) :** la garde récupérée
  (`9EFB-CORRECTIFS-FICHES-9EFA-garde`, 5 commits A→E) était déjà **verte**
  une fois rejouée sur `origin/main` à jour : `pnpm format:check`,
  `pnpm typecheck`, `pnpm lint`, `pnpm test` (428 fichiers, 4609 tests) sont
  tous passés du premier coup, sans aucune correction nécessaire. Je n'ai
  donc identifié aucun rouge rapide à corriger dans cette reprise — voir §3.
- **Y19 (point B) :** rouge montré en retirant `min-w-0` (1330 px mesuré à
  1280, comme le pilote) puis remis à l'identique ; vert ensuite à 1280 et
  375 px sur `/sites/<id>` et `/clients/<id>` (Aperçu + onglets sites et
  interventions).
- **Captures régénérées**, largeurs IHDR mesurées et consignées dans
  `captures/README.md` : `fiche-site-lecture-1280.png` 1280×1202,
  `fiche-site-lecture-375.png` 375×2285, `fiche-client-apercu-375.png`
  375×2438, `fiche-machine-telephone-en-service-375.png` 375×2532,
  `fiche-machine-telephone-en-panne-375.png` 375×2663, et les variantes
  1280 et interlocuteurs (375) — toutes à la largeur attendue, aucun
  débordement.
- **Barre d'action collée (point C) :** hauteur réelle mesurée ~35 px
  (`py-2` de l'apparence partagée des boutons, hors territoire de ce lot),
  pas les 44 px visés par un addendum jamais exécuté — nommé ici plutôt que
  deviné ou corrigé hors territoire.
- **`voie1-reste-1011-1341` (le reste non commité du 11/10 13:41) :** diffé
  fichier par fichier contre la garde pour chaque fichier du territoire
  (`parc/[id]/page.tsx`, `contacts/presentation.tsx`, `lib/i18n/fr.ts`,
  `docs/arbitrages.md`, la passation de 9EFA,
  `9efa-reprise-y19-debordement.spec.ts`) : sur chacun, ce reste est **plus
  pauvre** que la garde (il date d'avant l'organisation du travail en
  commits A→E et ne contient aucune des épreuves neuves C/D/A). Rien à en
  reprendre pour ce lot.

## 3. Ce que j'ai tranché et pourquoi

- **Cause du rouge signalé par le pilote (deux échecs en 5 puis 3 min,
  étape rapide) : non reproduite.** La garde, une fois rejouée sur
  `origin/main` à jour (après fusion de 9E1-E2E-FENETRE-POSE-SITE), passe
  `format:check` + `typecheck` + `lint` + `test` du premier coup. Le rouge
  d'origine était donc soit un état transitoire de la session coupée
  (fichiers non commités interférant avec les commits en cours), soit lié à
  un état de branche depuis résolu par l'organisation en 5 commits propres ;
  je ne l'ai pas reconstitué et je ne spécule pas davantage.
- J'ai choisi de **rejouer les 5 commits de la garde tels quels**
  (cherry-pick, sans aucune modification) plutôt que de les refaire : leur
  contenu correspond exactement aux points A-E du ticket d'origine (vérifié
  diff par diff), avec les mêmes réserves honnêtes déjà écrites dans leurs
  messages de commit (hauteur de barre, documents sans lien, etc.).
- Je n'ai **rien repris** de `voie1-reste-1011-1341` : ce commit est un
  instantané antérieur à l'organisation finale du travail, strictement
  moins avancé que la garde sur chaque fichier du territoire (voir §2).

## 4. Ce que je n'ai PAS fait

- Rien d'A à E : les cinq points étaient déjà faits et committés sur la
  garde ; je les ai rejoués et vérifiés, sans retravailler leur contenu.
- Pas de correction du rouge rapide : aucun rouge rapide ne s'est manifesté
  sur `origin/main` + la garde (voir §2 et §3).
- Pas de reprise de `voie1-reste-1011-1341` : rien dans le territoire de ce
  lot n'y était plus avancé que sur la garde.
- Hors territoire, non traité (comme listé par le ticket) : carte « VGP »
  séparée, gestes, historique des états (QT-12), bornage de l'historique
  machine (décision 26), décision 55 (ordre de l'identité), tri des
  interlocuteurs du site, position du crayon et de « + Interlocuteur »,
  nettoyage des clés orphelines `clients.fiche.contacts*`, bascule en cartes
  sur les fiches client et site.
- La hauteur de 44 px de la barre d'action collée (addendum jamais exécuté,
  `py-2` hors territoire) n'a pas été portée à 44 px — nommée, pas corrigée.

## 5. Tableau A-E

| Point | Contenu | Statut |
|---|---|---|
| A — Gardien du rouge (décision 54) | `tests/e2e/9efb-correctifs-gardien-rouge.spec.ts` | Fait, commit `60efe31f` (rejoué) |
| B — Preuve déterministe Y19 | `9efa-reprise-y19-debordement.spec.ts` + captures | Fait, commit `b1b8368a` (rejoué) |
| C — Y12 fiche machine au téléphone | `parc/[id]/page.tsx` (`ListeCartes`/`Carte`) + épreuve + captures | Fait, commit `0c67a912` (rejoué) |
| D — Y13 contacts au téléphone | `contacts/presentation.tsx` (`min-h-[32px] items-center`) + épreuve + captures | Fait, commit `e72e71b7` (rejoué) |
| E — Textes justes + clé/icône | D192, passation 9EFA, `machine.fiche.corriger` | Fait, commit `5b34bfd5` (rejoué) |

## 6. Pièges pour la session suivante

- `voie1-reste-1011-1341` et `9EFB-CORRECTIFS-FICHES-9EFA-garde` partagent
  la même base (`6a9f48ae`) mais **ne se comparent pas naïvement avec
  `git diff --stat` seul** : le reste contient aussi des captures d'un
  *autre* lot (`bandeau-transmis-*`, `fiche-reprise-*`, `fiche-bureau-*`,
  `fiche-terrain-*`) qui n'ont rien à voir avec 9EFB — ne pas les confondre
  avec le territoire de ce ticket si une session future rouvre ce reste
  pour un autre lot.
- La garde a été rejouée par cherry-pick sur une **nouvelle branche locale**
  `9EFC-REPRISE-9EFB` (partant d'`origin/main` à jour), pas sur une branche
  `main` locale : celle-ci est verrouillée par un autre worktree
  (`/home/aplou/codiplan`) et n'est pas accessible depuis ce worktree.
- Le gardien `tests/unit/docs` (amendements-arbitrages.test.ts etc.) ne
  contraint pas la forme des lignes ajoutées à D192 : toute future mention
  de ce débordement doit quand même rester cohérente avec la ligne datée
  ajoutée ici plutôt que de la dupliquer.

## 7. Ce qui reste à faire

- Porter la barre d'action collée à 44 px si Alexis confirme que l'addendum
  (jamais exécuté) reste visé — actuellement ~35 px (`py-2` partagé, hors
  territoire de ce lot et du précédent).
- Tout ce qui est explicitement hors territoire listé au §4 et dans le
  ticket d'origine (NE FAIS PAS).
- Aucune autre reprise de `voie1-reste-1011-1341` nécessaire pour ce lot :
  à vérifier, si une session future le rouvre pour un autre ticket, que les
  captures `bandeau-transmis-*`/`fiche-reprise-*`/`fiche-bureau-*`/
  `fiche-terrain-*` qu'il contient appartiennent bien à ce ticket avant de
  les reprendre.
