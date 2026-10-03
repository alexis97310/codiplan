# 9DM-TP-DEM1-TRAITEES-REUTILISATION — passation

## Ce que j'ai changé

**A. Onglets « À traiter » / « Traitées » sur `/demandes` (IN-40).** L'écran portait un seul tableau,
lu par `demandesOuvertes` (`nouvelle`/`qualifiee` seulement) : une demande transformée ou close sans
suite ne s'atteignait plus que par un lien direct. Deux onglets maintenant, un seul rendu à la fois
(l'état vit dans `?onglet=`/`?page=`) : « À traiter » reste EXACTEMENT `demandesOuvertes` (même lecture
que la tuile du tableau de bord, donc les deux comptes ne peuvent jamais diverger) ; « Traitées » est
neuve (`demandesTraitees`/`compterDemandesTraitees`, `lib/demandes/depot.ts`), paginée à 50
(`LIMITE_RECHERCHE_PAR_DEFAUT`), la plus récente d'abord, avec une colonne « Suite » (lien vers
l'intervention issue, ou le motif de clôture) à la place de « Statut ». Composé avec `Onglets`
(`components/ui/onglets.tsx`) et `EtatVide` (`components/ui/etat-vide.tsx`) — deux composants déjà
écrits et jusqu'ici sans aucun appelant dans `app/` (orphelins au sens de `pnpm chemins`) ; ce lot leur
donne leur premier usage réel plutôt que d'en réécrire deux de plus.
**Conséquence pour l'exploitation :** l'ADV peut enfin retrouver une demande traitée (quel client, quelle
suite) sans en connaître l'identifiant à l'avance.

**B. IN-42 — une demande non qualifiée ou déjà traitée ne devient plus une intervention.**
`creerIntervention` (`lib/interventions/depot.ts`) ne comparait que le SITE d'une demande d'origine,
jamais son STATUT : un `demande_id` posté directement, ou `/interventions/nouvelle?demande=` visité sur
une demande `nouvelle`/`transformee`/`close_sans_suite`, engendrait quand même une intervention (ou
préremplissait l'écran en silence). Le dépôt refuse désormais avec un motif NOMMÉ selon le cas
(`intervention.refus.demande_non_qualifiee` / `intervention.refus.demande_deja_traitee`), distinct du
refus de périmètre existant (`demande_invalide`). L'écran de création affiche ce refus à la place du
silence. **Conséquence pour l'exploitation :** une demande ne peut plus donner naissance à une
intervention « orpheline » avant d'avoir été qualifiée côté bureau, et on ne peut plus repartir d'une
demande déjà close/transformée en croyant repartir à zéro.

**C. IN-43 — deux textes du dictionnaire disaient ce que l'écran NE fait pas.** Le refus de
transformation prétendait que « Qualifier » décide de la nature, de la durée et de l'affectation — cette
action ne porte aucun champ, elle pose seulement le statut. La note de « Marquer comme transformée »
disait qu'on pouvait créer l'intervention « avant ou après » — faux, le bouton de création partage le
verdict de `peutTransformer` et disparaît avec lui une fois la demande transformée. Les deux textes
disent maintenant ce qui se passe réellement.

**D. IN-44 — le motif de clôture n'a plus de valeur choisie d'avance.** Le `<select>` n'avait pas
d'option vide : le premier motif de la liste close était toujours présélectionné, et le refus serveur
`demande.cloture.motif_requis` ne pouvait jamais s'afficher par le formulaire. Une option vide et
désactivée force désormais un choix explicite.

**E (hors territoire déclaré, nécessaire pour `verify:full` vert).**
`tests/e2e/nature-obligatoire.spec.ts` posait sa demande de capture au statut `nouvelle` par défaut, et
son troisième scénario vérifiait que `/interventions/nouvelle?demande=` préremplit le site. Avec B, une
demande `nouvelle` ne préremplit plus rien : la MISE EN SCÈNE a été corrigée (`statut: "qualifiee"` à la
création), **aucune assertion n'a été modifiée** — voir « Le conflit non résolu » plus bas pour le détail
de la méthode suivie.

## Ce que j'ai mesuré

- `pnpm test` (unitaires) : 372 fichiers, 3911 tests passés (0 échec).
- `pnpm test:isolation` : 150 fichiers, 1360 tests passés (0 échec) — dont les 2 fichiers neufs de ce
  lot (`demandes-traitees.test.ts`, 2 tests ; `demandes-2.test.ts` complété, 7 tests).
- `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build` : verts.
- `CI=1 pnpm verify:full` joué EN ENTIER, deux fois : la première a révélé la régression E ci-dessus
  (818 → corrigée, 817 passed + 1 failed avant le correctif, **818 passed, 7 skipped, 0 failed après**,
  33 minutes). Les 7 « skipped » sont préexistants à ce lot (non liés à `demandes`).
- Captures AVANT/APRÈS prises par rejeu du même fichier (`tests/e2e/captures-9dm-tp-dem1.spec.ts`) sur
  `d358ba6` (avant) puis sur le code livré (après), aux deux largeurs (1280/375) :
  `docs/propositions/9DM-TP-DEM1-TRAITEES-REUTILISATION/captures/{avant,apres}/`. Visuellement vérifiées
  (lues) : l'onglet « Traitées » avec sa colonne « Suite », le refus IN-42 sur
  `/interventions/nouvelle?demande=`, le refus `motif_requis` et l'option vide du motif sur la fiche.

## Ce que j'ai tranché, et pourquoi

- **La colonne « Suite » lie la PREMIÈRE intervention créée** (`cree_le` croissant) quand plusieurs
  existent pour une même demande transformée — même choix que le bouton de création de la fiche
  (`[id]/page.tsx`), pour ne pas inventer un second critère de tri sur le même fait.
- **Le pied « N demandes · <ordre> » apparaît sur LES DEUX onglets**, pas seulement « Traitées » : la
  maquette du 28/09 (`:3147`) le pose pour les deux vues (`foot:` du `table()`), et je l'ai suivie plutôt
  que d'improviser une asymétrie. Réutilise `Pagination` (`libelleResultats`) même pour « À traiter », qui
  n'a pas de seconde page (`totalPages=1`, aucun lien de pagination ne s'affiche).
- **Le sous-titre de la page change selon l'onglet actif** (`demandes.sous_titre` vs
  `demandes.traitees.sous_titre`) : le texte d'origine (« Les demandes ouvertes, de la plus ancienne à la
  plus récente ») devenait FAUX sur l'onglet Traitées (ni ouvertes, ni cet ordre) — pas demandé
  explicitement par le ticket, mais laisser une phrase fausse à l'écran aurait été une régression que le
  ticket ne nommait pas.
- **IN-42 distingue deux refus plutôt qu'un seul** (« pas encore qualifiée » / « déjà traitée ») — le
  ticket nommait les deux phrases distinctement, et les confondre aurait perdu l'information qui dit à
  l'ADV QUOI faire ensuite (qualifier, ou repartir d'une nouvelle demande).
- **Numéro de décision D164** utilisé tel que réservé par le pilote (vérifié absent de `docs/arbitrages.md`
  sur `main` avant d'écrire — toujours absent).

## Ce que je n'ai PAS fait

- **Aucune migration, aucune ligne de semis** — conforme à l'interdit du ticket.
- **« Créer une demande » depuis l'intervention** — hors territoire, lot suivant (QT-14 a).
- **`tests/e2e/captures-9br-tpa4b-messages.spec.ts`** crée aussi une demande `nouvelle` et navigue vers
  `/interventions/nouvelle?demande=` (ligne 288) : avec B, le champ « panne » ne se préremplit plus
  depuis cette demande non qualifiée. **Ce fichier n'a AUCUNE assertion sur ce préremplissage** (seulement
  un commentaire) et reste vert — je ne l'ai donc PAS touché, mais sa capture (si rejouée avec
  `CAPTURES_TPA4B` fixé) montrera désormais un formulaire vide à cet endroit plutôt que prérempli. Non
  corrigé faute de territoire et d'assertion cassée ; à signaler si quelqu'un rejoue ses captures.
- **Pas de vérification humaine du rendu dans un vrai navigateur interactif** au-delà des captures
  Playwright (environnement non interactif) — les captures lues (voir « ce que j'ai mesuré ») en tiennent
  lieu, mais ce n'est pas la même chose qu'un geste de souris.

## Le conflit non résolu

Pas de « deux rouges » au sens de la règle — un seul rouge rencontré (`nature-obligatoire.spec.ts`),
diagnostiqué et corrigé du premier coup (mise en scène, pas assertion), puis reconfirmé vert par un
second `verify:full` complet. Aucun blocage restant.

## Les pièges pour la session suivante

- **`demandesTraitees`/`compterDemandesTraitees` partagent `STATUTS_TRAITES`** (`lib/demandes/depot.ts`,
  privé au module) — si un cinquième statut de demande apparaît un jour, cette liste ET
  `STATUTS_DEMANDE` (`lib/demandes/saisie.ts`) doivent être revues ensemble, sans quoi une ligne
  n'apparaîtrait ni dans « À traiter » ni dans « Traitées ».
- **`DEMANDE_A1` (fixture d'isolation, `tests/isolation/setup/fixtures.ts`) finit `qualifiee`** après le
  premier test de `demandes-2.test.ts` (IN-42 l'exige pour son scénario d'acceptation) — elle commençait
  `nouvelle`. Aucun autre test d'isolation n'en dépendait au moment de ce lot (vérifié par grep), mais si
  un futur test suppose `DEMANDE_A1.statut === "nouvelle"`, c'est ce commit qui l'a changé.
- **`tests/e2e/captures-9br-tpa4b-messages.spec.ts`** (voir « ce que je n'ai pas fait ») — sa capture
  `intervention-refus-saisie-gardee` montrera un champ panne vide si quelqu'un la rejoue avec
  `CAPTURES_TPA4B` fixé ; ce n'est pas un bug de ce lot, mais une conséquence d'IN-42 sur une scène
  étrangère non corrigée.
- **Le full `pnpm test:e2e` (`CI=1`) régénère des dizaines de captures PNG d'anciens tickets** sans
  rapport avec ce lot, même sans aucune variable `CAPTURES_*` positionnée — repéré et annulé deux fois
  (`git checkout --` sur les fichiers listés par `git diff --name-only -- docs/propositions`) avant de
  committer. À surveiller : ne JAMAIS faire un `git add -A`/`git add docs/` après un `verify:full` complet
  sans vérifier `git status` d'abord.

## Ce qui reste à faire

- **Validation d'Alexis sur D164** (choix du pilote du 03/10, comme annoncé dans la décision elle-même).
- **Lot suivant (avec migration)** : « Créer une demande » depuis la suite à donner d'une intervention
  (QT-14 a), explicitement laissé de côté par ce ticket.
- **Nettoyage optionnel** de `tests/e2e/captures-9br-tpa4b-messages.spec.ts` pour qualifier sa demande,
  si quelqu'un veut que ses captures restent fidèles au flux « préremplissage depuis une demande ».
