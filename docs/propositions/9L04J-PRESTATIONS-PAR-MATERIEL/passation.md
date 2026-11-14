# 9L04J-PRESTATIONS-PAR-MATERIEL — passation

Décision d'Alexis du 13/11/2026 : « Filtrer par matériel ». Constat mesuré en production
(INT-2026-1853, un compresseur) : « Prestations réalisées » proposait « Remplacement écrous
porteurs » — seule prestation du catalogue, proposée PARTOUT. 9K29 (D243) filtre déjà par TYPE
d'intervention ; ce lot ajoute le filtre par FAMILLE DE MATÉRIEL, et les deux se composent.

## MIGRATION À JOUER PAR ALEXIS

`20261115030000_prestations_par_famille_materiel_9l04j` — une seule, neuve, appliquée par
`pnpm db:deploy` (staging, puis la cible visée). Elle :

1. crée `prestation_famille_materiel` (table de liaison, même patron que
   `prestation_type_intervention`, 9K29) ;
2. reprend les lignes non nulles de l'ancien scalaire `prestation.famille_id` (L1-12) dans la
   nouvelle table ;
3. répare ADDITIONNELLEMENT, par le LIBELLÉ (jamais un identifiant en dur, I9), le constat exact
   de l'incident : la prestation « Remplacement écrous porteurs » est rattachée à la famille de
   code `PONT-ELEV` de la MÊME société, pour chaque société où les deux existent ;
4. supprime la colonne `prestation.famille_id` et son index.

**Sur la base de démonstration (semis `prisma/seed-data.ts`), la reprise pose 0 ligne** : aucune
prestation n'y est semée (le catalogue y naît vide, à charge de l'exploitation — P6). Sur une
base réelle où « Remplacement écrous porteurs » et `PONT-ELEV` existent déjà tous les deux (le
cas mesuré en production), l'étape 3 pose exactement UNE ligne par société concernée.

## Ce qui a été fait

1. **Migration et schéma.** `PrestationFamilleMateriel` (table de liaison, forme « filiation »
   D103) remplace `Prestation.famille_id` (scalaire, L1-12). `FamilleMateriel.prestations` pointe
   désormais vers la liaison plutôt que vers `Prestation[]` directement. Amende D235 dans le même
   sens que D243 (9K29) et D246 (9K30A) : zéro, une ou plusieurs familles à la fois, vide =
   générale.
2. **`lib/prestations/saisie.ts` et `depot.ts`.** `SaisiePrestation.familles: string[]` remplace
   `famille_id: string | null`. `ecrireLesFamilles` (jumelle d'`ecrireLesTypes`, 9K29) remplace
   l'ensemble à chaque écriture. `LignePrestation`, `PrestationCatalogueTerrain` portent
   `familles` — y COMPRIS dans le catalogue hors réseau, à la différence de `duree_standard_min`
   (jamais emporté) : un identifiant de famille est nécessaire au filtre, jamais une valorisation.
3. **`lib/prestations/regle-famille.ts` (créé).** `prestationsPourFamille` — même discipline que
   `regle-type.ts` (pur, sans Prisma, pour la coquille hors réseau). Se COMPOSE avec
   `prestationsProposees`, jamais à sa place.
4. **Le chemin de la famille de la machine.** `lib/machines/depot.ts`
   (`DonneesMateriel.familleId`, ajouté à côté de `familleLibelle`) ; `app/(mobile)/terrain/[id]/
   page.tsx` calcule `familleMachineId` depuis la machine unique de l'intervention (D56/
   PARCOURS-1 : au plus une) ; `app/api/terrain/instantane/route.ts` l'embarque dans
   `FicheJSON.familleMachineId` pour la coquille hors réseau.
5. **L'écran du catalogue** (`app/(back-office)/parametres/prestations/page.tsx`, 9K29) — le
   `<select>` mono-valeur devient un `<fieldset>` de cases à cocher, à côté des types ; la liste
   affiche les familles de chaque prestation, « Toutes » quand il n'y en a aucune
   (`prestations.familles_toutes`, même patron que `prestations.types_tous`).
6. **La rubrique disparaît ENTIÈREMENT** (`components/terrain/rapport-automatique.tsx`) quand le
   catalogue n'est pas vide mais que rien ne correspond au type ET à la famille — jamais un
   message à sa place (c'était le comportement de 9K29, remplacé ici). La clé devenue inutile
   `terrain.prestations.aucune_pour_ce_type` est retirée. **Exception : une coupure réseau
   (`catalogueIndisponibleHorsReseau`) garde la priorité** — elle se nomme toujours, jamais
   effacée.
7. **Historique gardé, sans code ajouté pour cela (point 5 du ticket).** Mesuré : les bons
   (`TuilePrestations`, `components/interventions/bon-tuiles.tsx`) et la fiche bureau lisent
   `prestationsRealisees()` — un chemin séparé du catalogue proposé, jamais soumis aux règles de
   proposition. Une prestation déjà cochée reste visible et décochable tant que l'intervention
   n'est pas terminée, par le paramètre `idsDejaRealises` déjà partagé par les deux règles pures.
8. **Le gabarit d'import** (`lib/imports/modeles.ts`, `application.ts`, `annulation.ts`) garde SA
   colonne Excel unique « Famille (code) » (une cellule, une famille) ; `preparerUnePrestation`
   produit désormais `familles: [] | [id]` plutôt que `famille_id: id | null`.
   `CHAMPS_PRESTATIONS_ECARTES.famille_id` devient `familles`. `annulerLeLotDePrestations` ne lit
   plus `famille_id` (jamais comparé par `porteEncore` de toute façon). `familleEstReferencee`
   compte désormais `prestationFamilleMateriel`, pas `prestation.famille_id` (disparu).

## Mémoire du build (9K28B, 9L04A — plafond 6144 Mo)

Aucune relation Prisma inverse nouvelle n'est lue nulle part : `Societe.
prestationFamillesMateriel` porte `@ignore`, comme `prestationTypesIntervention` (9K29) à côté.
**Pic mesuré de `pnpm build` après ce lot : 6 274 036 Ko (~6,13 Go)**, sous le plafond de 6 144 Mo
(6 291 456 Ko) — marge restante environ 17 Mo, aussi mince qu'avant. Je n'ai pas de mesure
« avant » isolée (l'aurait exigé un deuxième build sur le commit de départ, hors budget de ce
lot) : le chiffre ci-dessus est le seul point de repère que je peux garantir observé plutôt que
supposé.

## Captures

`docs/propositions/9L04J-PRESTATIONS-PAR-MATERIEL/captures/avant/` et `.../apres/` (375 px sauf
le réglage, aussi capturé à 1280 px) : rapport terrain sur un pont élévateur, rapport terrain sur
un compresseur (AVANT : la prestation du pont y apparaît à tort — le constat exact de l'incident ;
APRÈS : la rubrique entière a disparu), réglage du catalogue des prestations. Prises par
`tests/e2e/captures-9l04j-prestations-par-materiel.spec.ts` (guardé par `CAPTURES_9L04J`, jamais
écrit par `pnpm test:e2e` ordinaire), rejouée une fois sur le commit `49b9f8294` (avant ce lot),
une fois sur le code livré.

**`docs/captures/` (la galerie repo-wide) n'a PAS été rafraîchie** — même motif que les
passations de 9K27, 9L04D, 9L04G et 9L04I : la procédure de `docs/captures/README.md` (base
jetable sur un second port, build de production, amorçage d'un compte neuf par lien de premier
accès, identités portail/multi-société) exige des secrets choisis en direct que cette session ne
détient pas, et n'entre pas dans le budget de ce lot.

## Épreuves

`tests/unit/prestations/par-famille-materiel.test.ts` (créé) — `schemaPrestation` (vide, liste,
doublon refusé, UUID invalide), `prestationsPourFamille` (générale, filtre, aucune machine connue,
réalisation gardée), sa composition avec `prestationsProposees` (type × famille), et
`preparerUnePrestation` pour la colonne Excel. `tests/isolation/prestations.test.ts` — bloc
« 9L04J » jumeau du bloc « 9K29 » (filiation, société étrangère refusée, doublon refusé par la
saisie). `tests/isolation/prestation.test.ts` — la contrainte RAW sur la table de liaison
(`prestation_famille_materiel_societe_id_famille_id_fkey`), remplaçant l'ancienne
`prestation_famille_fkey`. `tests/isolation/application-import-types.test.ts` et
`ecriture-import-transactionnelle.test.ts` — adaptés à la disparition du scalaire.
`tests/unit/terrain/rapport-automatique.test.tsx` — la rubrique s'efface entièrement (pas
seulement un message différent), la coupure réseau garde la priorité. `tests/e2e/
9l04j-prestations-par-materiel.spec.ts` (créé) — 375 px (pont proposé et cochable, compresseur
rubrique absente, bon d'une intervention clôturée garde sa prestation) et 1280 px (réglage des
familles, affichage de la famille plutôt que « Toutes »).

`pnpm test` (5840 passés), `pnpm test:isolation` (2230 passés),
`tests/e2e/tous-les-ecrans-rendent.spec.ts` (61 passés, 4 ignorés — sans rapport avec ce lot),
`tests/e2e/9l04j-prestations-par-materiel.spec.ts` et `captures-9l04j-prestations-par-materiel.
spec.ts` (tous verts). `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build` : verts.
`CI=1 pnpm verify` dans son ensemble n'a pas été rejoué après le DERNIER commit (le correctif
Prettier) — chacune de ses étapes l'a été séparément et est verte ; la file le rejouera en entier.

## Ce qui n'est pas touché

Le rattachement à un SOUS-TYPE structuré (9K17A) n'est pas ajouté : aucun besoin mesuré au-delà
de la famille pour ce ticket (voir D259, condition de réouverture). Aucune prestation créée,
modifiée ni désactivée en production. Le catalogue à compléter par l'exploitation (P6) reste
entier — ce lot donne seulement la colonne « famille » à l'écran existant.

## Branche

Ce worktree était détaché sur `origin/main` au début de la session (`HEAD detached from
origin/main`) — `main` lui-même est extrait ailleurs (`/home/aplou/codiplan`). J'ai créé la
branche `9L04J-PRESTATIONS-PAR-MATERIEL` à partir de ce point et j'y ai posé les commits de ce
lot (aucun `push`).
