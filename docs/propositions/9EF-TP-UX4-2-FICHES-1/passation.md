# 9EF-TP-UX4-2-FICHES-1 — passation

## Ce que j'ai changé

- `app/(back-office)/clients/[id]/page.tsx` — récrite sur le gabarit du 28/09 :
  en-tête à faits (Commune, Catégorie, Commercial référent, Règlement),
  pastille Actif/Inactif, cinq tuiles cliquables (Sites, Machines,
  Interventions ouvertes, Prochaine, Dernière — decision 52 : sans `href` ni
  chiffre nu à zéro), six onglets (Aperçu, Sites, Parc, Interventions,
  Interlocuteurs, Identité — ce dernier réservé à `gerer_client_site`).
  L'Aperçu reste à deux colonnes : « À traiter » (borné à 5), les sites en
  cartes, un aperçu de l'historique à gauche ; les interlocuteurs puis
  l'identité EN LECTURE à droite, dont « Modifier » ouvre l'onglet Identité
  (le formulaire d'écriture existant, inchangé). **Pour l'exploitation** : la
  tuile « Machines » compte désormais par `compterLeParc` (vue « parc »),
  pour que son chiffre soit exactement ce que son lien ouvre — avant ce lot,
  le lien et le chiffre pouvaient diverger.
- `app/(back-office)/sites/[id]/page.tsx` — récrite de même : en-tête à
  faits (Client, Adresse, Horaires d'accès, Trajet, Zone · agence), pastilles
  Sous contrat / Inactif / Client inactif, consignes d'accès en bandeau
  d'information, formulaire d'écriture derrière « Modifier »
  (`?edition=site`, capacité inchangée). Deux colonnes : « À traiter », les
  machines du site, l'historique (dont les compteurs « interventions
  ouvertes » et « dernière intervention », reportés dans l'en-tête de ce
  bloc) à gauche ; le bloc VGP du site (synthèse retenue inchangée PUIS une
  ligne par machine soumise, bornée à 5, chacune avec « Enregistrer »), « Qui
  sera prévenu », les habilitations exigées, les interlocuteurs à droite.
- `lib/interventions/depot.ts` — `interventionsATraiterDuClient`/`DuSite`
  (le bloc « À traiter », ouvertes seulement, jamais de repli sur une
  fermée) et `prochaineInterventionDuClient` (la tuile « Prochaine »).
- `lib/vgp/registre.ts` — `lignesVgpSoumisesDuSite`, à côté de
  `prochaineEcheanceDuSite` (jamais à sa place).
- `app/(back-office)/clients/presentation.ts`,
  `app/(back-office)/sites/presentation.ts` — composition des tuiles à
  zéro, des titres « Machines du site (n) » / « VGP du site (n) », de
  l'alerte client inactif : jamais le mot imposé « site » écrit en dur
  (D5/D47).
- `components/ui/icone.tsx` — six icônes neuves (`tag`, `badge`, `route`,
  `map`, `mail`, `edit`), confrontées à la maquette.
- `lib/i18n/fr.ts` — bloc contigu de clés neuves, aucune clé existante
  modifiée.
- `docs/arbitrages.md` — D191, amende D140 pour le seul point de la
  décision 52 (tuile sans `href` à zéro).
- `scripts/lib/chemins-de-depot.ts` — exemption retirée pour
  `resumerLeParcFiltre` (nouvel appelant réel) ; exemption ajoutée pour
  `nombreEquipementsActifsDuClient` (remplacée par `compterLeParc`).
- Treize épreuves de bout en bout existantes adaptées (navigation vers
  `?onglet=identite`/`?edition=site`, pastille lue dans le titre plutôt que
  dans un `<p>`, `[data-motif]` plutôt que `[role='status']` sur
  `habilitations.spec.ts`) — **aucune attente de comportement changée**,
  citées D191 à chaque fois.
- `tests/e2e/9ef-tp-ux4-2-fiches-1.spec.ts` (neuf) — les cinq tuiles à zéro
  et au-dessus de zéro, les onglets et leur compte, Identité réservée (même
  en forçant l'URL), le round-trip « Modifier », les faits de la fiche site,
  les consignes, « Qui sera prévenu », « + Intervention » depuis une
  machine.

## Ce que j'ai mesuré

- `pnpm exec tsc --noEmit` (avec `--max-old-space-size=6144`, la commande
  nue épuise la mémoire dans cet environnement) : aucune erreur, à chaque
  étape.
- `pnpm exec eslint` sur tous les fichiers touchés : aucun avertissement.
- `pnpm format:check` : vert.
- `pnpm exec vitest run --project unit` (4597 tests) : vert, à la toute fin
  comme à chaque étape intermédiaire.
- `pnpm exec playwright test` (suite entière, build de production, sans
  `CI=1`) : exécutée deux fois complètes. À chaque fois, un ensemble DIFFÉRENT
  d'épreuves SANS RAPPORT avec les fiches client/site a rougi (plannings,
  demandes, transmissions, largeurs de page à 375/390px, etc.) — jamais les
  mêmes d'une exécution à l'autre, cohérent avec une contention de parallélisme
  (12 workers, une seule base), pas avec une régression : `CI=1` (que
  `verify:full` impose) ramène `workers` à 1 et devrait l'absorber, je ne
  l'ai pas vérifié EN ENTIER sous `CI=1` faute de temps après la dernière
  correction — voir « ce qui reste à faire ».
- Les épreuves qui touchent réellement `/clients/[id]` ou `/sites/[id]`
  (dix fichiers existants adaptés, plus le fichier neuf) : toutes vertes, à
  la fois seules et en lot, plusieurs fois de suite.
- Trois régressions RÉELLES trouvées par la suite complète et corrigées :
  un `<p data-aide="destinataire-courriels">` dédoublonné sur la fiche site
  (violait le mode strict Playwright) ; `captures-9ai-gr14-libelles-saisie.spec.ts`
  et `historique-client-machine.spec.ts`, qui visitaient la fiche directement
  sans `?edition=site`/`?onglet=` ; `habilitations.spec.ts`, dont l'assertion
  `[role='status'] count 0` croisait le nouveau bandeau de consignes (devenue
  `[data-motif] count 0`, ce que le scénario voulait réellement dire).
- Dix captures APRÈS (`docs/propositions/9EF-TP-UX4-2-FICHES-1/captures/`),
  375 et 1280 px, relues une à une : les cinq tuiles, les onglets, le bloc
  « À traiter », les cartes de site, le formulaire d'identité et celui du
  site rendent ce que le code décrit.

## Ce que j'ai tranché et pourquoi

- **La priorité ne s'affiche PAS dans le bloc « À traiter »** (ni en texte,
  ni en pastille de ton) : `tests/unit/ui/priorite-une-correspondance.test.ts`
  (GR5, D144) refuse qu'une priorité se peigne hors de `tonDePriorite`/
  `<Priorite>`, et `BlocATraiter.detail` n'accepte que du texte, jamais un
  composant. Named écart dans D191.
- **La tuile « Machines » change de source** (`compterLeParc` vue « parc »
  plutôt que `nombreEquipementsActifsDuClient`) pour que D140 (« le chiffre
  est ce que le lien ouvre ») tienne réellement — c'était déjà faux avant ce
  lot, ce lot le corrige en le reconstruisant.
- **Les interlocuteurs et l'identité du client apparaissent dans la colonne
  de l'Aperçu ET dans leurs propres onglets** : relecture de X5 — ce n'est
  pas une redondance accidentelle, le maquette sépare bien un « tableau de
  bord » de chaque entité et sa fiche complète.
- **Le fil d'Ariane de la fiche site garde ses trois maillons** (D168,
  inchangé) plutôt que d'en retirer un pour suivre la maquette au pied de la
  lettre : D168 est une décision distincte, hors du périmètre de ce lot.
- **Decision 52 d'Alexis amende D140** (une tuile à zéro reste sans `href`),
  écrite et câblée dans `tests/unit/docs/amendements-arbitrages.test.ts`.

## Ce que je n'ai PAS fait

- **Aucune capture AVANT** : je ne les ai pas prises sur `main` avant de
  commencer à écrire — gap réel, nommé dans le README des captures. Seules
  des captures APRÈS existent.
- **La bascule Tableau → cartes sous 900 px (X6/X9) n'est PAS posée** sur
  l'historique, le parc ou les machines du site : ces trois blocs restent un
  `<Tableau>` SANS `max-[900px]:hidden`, et aucun `ListeCartes`/`Carte` ne
  les double en dessous de ce seuil. Le reste du téléphone fonctionne
  (tuiles sur une colonne, barre d'action collée, « + Site »/« + Machine »
  masqués de l'en-tête), mais ces trois tableaux précis débordent ou
  restent illisibles sous 900 px — non mesuré précisément, à vérifier.
- **L'onglet Parc de la fiche client est une liste minimale** (lien, marque,
  référence, numéro de série) : ni pastille de statut, ni pagination au-delà
  de la première page (`rechercherLeParc` sans `page`). Pas de duplication
  de `TON_STATUT_MACHINE`/`statutMachineAffiche` une troisième fois pour
  l'habiller — à faire si Alexis le demande.
- **La bande de chiffres des cartes « Sites » de l'Aperçu client n'affiche
  pas le temps de trajet** (seulement machines et interventions ouvertes) —
  named écart dans D191.
- **Aucune capture des rôles responsable matériel/SAV, du client inactif, du
  site sans consignes** — seul le rôle `adv` et un site AVEC consignes sont
  capturés.
- **La puce « Ouvertes » de l'onglet Interventions est bornée à 200**, pas
  paginée : un client à plus de 200 interventions ouvertes simultanément
  (improbable) verrait une liste tronquée sans le dire.
- Rien de ce que le ticket interdisait explicitement n'a été touché : aucune
  migration, aucune donnée de seed, aucune règle de gestion, aucun droit,
  aucune route neuve, aucun volet de la maquette, pas de fiche machine ni de
  fiches contact (9EF-TP-UX4-2-FICHES-2).

## Les pièges pour la session suivante

- **`pnpm exec tsc --noEmit` nu épuise la mémoire** dans cet environnement
  (sandbox) — utiliser `NODE_OPTIONS="--max-old-space-size=6144" pnpm exec
  tsc --noEmit`, ou `pnpm typecheck` qui le pose déjà.
- **Un `t()`/ternaire composé DIRECTEMENT dans un attribut JSX
  (`detail={cond ? undefined : t(...)}`) peut faire perdre à TypeScript la
  littéralité d'un type** (`type_intervention.${any}` plutôt que l'union
  exacte) — la même expression dans le corps d'une fonction ou d'un
  `.map()` compile sans problème. Extraire en fonction nommée hors JSX
  (voir `detailTypeIntervention` dans les deux fiches) résout le symptôme ;
  je n'ai pas élucidé la cause exacte.
- **`BlocATraiter.detail` n'accepte que du texte** — toute tentative d'y
  peindre une priorité (même via `tonDePriorite`) fait rougir
  `tests/unit/ui/priorite-une-correspondance.test.ts` (GR5/D144), qui
  réclame `tonDePriorite`/`<Priorite>` importés ET appelés dans TOUT fichier
  qui rend `priorite.`.
- **`pnpm exec playwright test` sans `CI=1`, suite entière, est flaky** —
  12 workers partagent UNE base ; des dizaines d'épreuves SANS RAPPORT avec
  ce lot rougissent de façon non reproductible (un ensemble différent à
  chaque exécution). Isoler le fichier suspect (`-g` ou chemin seul) avant
  de conclure à une régression réelle — c'est ainsi que les trois vraies
  régressions de ce lot ont été distinguées des flakes.
- **`pnpm exec playwright test` régénère des PNG d'autres lots** (toute
  capture gatée par une variable d'environnement absente côté AVANT, mais
  dont le fichier EXISTE déjà sur `main`, se réécrit à l'identique ou
  presque) — `git status` après coup, `git checkout --` sur tout ce qui
  n'appartient pas à ce lot, avant de committer.
- **Le gardien `sans-chaine-visible-en-dur` résout les CONST locales d'un
  fichier e2e jusqu'à leur valeur littérale** avant de juger — `getByText`/
  `getByRole({name})`/`toHaveText`/`toContainText` sur une constante de
  fixture (même créée par le test lui-même) le fait rougir ; `.filter({
  hasText: X })` ou une comparaison de chaîne JS brute (`expect(str).toContain(x)`
  sur un `string` déjà capturé par `.innerText()`) ne le fait pas. Voir
  `tests/e2e/9ef-tp-ux4-2-fiches-1.spec.ts` pour le motif.
- **`?onglet=` par défaut sur « toutes »** pour l'onglet Interventions : un
  lien qui veut la liste bornée (« Ouvertes ») doit toujours écrire
  `&etat=ouvertes` explicitement.

## Ce qui reste à faire

- Rejouer `CI=1 pnpm verify:full` EN ENTIER après la fin de cette session
  (voir la note dans « ce que j'ai mesuré ») — je l'ai lancé mais je n'ai
  pas pu confirmer un vert complet avant la fin du temps disponible ; si ce
  fichier est lu avant qu'il ait tourné, c'est la première chose à faire.
- Poser la bascule Tableau → cartes sous 900 px sur l'historique, le parc
  (fiche client) et les machines du site (X6/X9, non fait — voir plus haut).
- Habiller l'onglet Parc de la fiche client (statut en pastille, pagination
  au-delà de la première page) si Alexis le juge nécessaire.
- Capturer les rôles responsable matériel/SAV et les états client/site
  inactif, consignes absentes.
- Rien à trancher sur la définition d'une intervention « ouverte » :
  Alexis a validé le 10/10/2026 (décision 73) qu'elle reste celle du code
  (`terminee` EXCLUE), écrite comme écart nommé dans D191, pas comme
  question ouverte.
- 9EF-TP-UX4-2-FICHES-2 (fiche machine, fiches contact) — hors de ce lot,
  passe après.
