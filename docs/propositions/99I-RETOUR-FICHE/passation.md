# 99I-RETOUR-FICHE — ouverte depuis une demande ou les absences, la fiche y ramène

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

`retourFiche` (`app/(back-office)/interventions/presentation.ts`) ne connaissait que
cinq origines (`planning`, `interventions`, `client`, `site`, `machine`) : tout `depuis`
absent ou inconnu retombait sur « ← Retour au planning ». L'audit d'ergonomie du 25/09
(constat 21, 2e moitié) mesurait que deux écrans qui ouvrent la fiche n'en posaient
AUCUN : `/demandes/{id}` (le lien de chaque intervention issue) et `/absences` (le lien
de chaque référence rendue à la file). Le retour y affichait donc « Retour au planning »,
faux dans les deux cas.

Deux origines neuves, dans la même liste fermée :

- **`demande` + `depuis_id`** : le lien porte `?depuis=demande&depuis_id=<id de la
  demande>`. `retourFiche` accepte cet identifiant SEULEMENT s'il désigne la demande
  RÉELLEMENT rattachée à cette intervention (`ligne.demande_id`) — même garde que
  `case "machine"` déjà en place, jamais l'identifiant recopié tel quel. Rattachée →
  `/demandes/{id}`, libellé « ← Retour à la demande ». Non rattachée ou absente →
  planning, inchangé.
- **`absences`** : le lien porte `?depuis=absences`, aucun second paramètre (une seule
  destination possible). Retour vers `/absences`, libellé composé depuis
  `t("absences.titre")` (« Blocages d'agenda »), décapitalisé au milieu de la phrase
  (même geste que `motDansUnePhrase`, mais pour un titre d'écran plutôt qu'un mot
  imposé) : « ← Retour aux blocages d'agenda ».

**Pour l'exploitation** : depuis la fiche d'une demande, cliquer une intervention issue
puis « ← Retour à la demande » ramène exactement à cette demande. Depuis le bandeau
« rendues à la file » des absences, cliquer une référence puis « ← Retour aux blocages
d'agenda » ramène à `/absences`. Les liens du planning n'ont reçu aucun `depuis` — c'est
voulu, le retour planning par défaut n'a pas changé.

## Ce que j'ai tranché et pourquoi

- **`demande_id` ajouté à `CHAMPS_LIGNE`** (`lib/interventions/depot.ts`), pas une
  lecture séparée pour la fiche seule. `Intervention.demande_id` existe déjà au schéma
  (chapitre 11) et n'était lu par aucune requête de ce dépôt. `CHAMPS_LIGNE` est la
  SEULE écriture de « ce qu'est une ligne d'intervention » (§9, 01/09) — une seconde
  lecture ad hoc dans `lireFicheIntervention` aurait divergé au premier renommage.
  Aucune migration : la colonne existe, seul le `select` change.
- **Le libellé « absences » se compose depuis la clé du titre de la page, jamais une
  chaîne écrite en double.** Si `absences.titre` change de mot un jour, le lien de retour
  suit sans y retoucher — exactement la même discipline que `site_prefixe` +
  `motDansUnePhrase("site")` pour le cas `site`.
- **Comparaison stricte d'identifiants pour `demande`, comme pour `machine`.** Une
  intervention porte au plus une demande d'origine (`demande_id` est une colonne
  scalaire, pas une relation plurielle) : `depuisId === ligne.demande_id` suffit, pas de
  recherche dans un tableau.

## Ce que j'ai testé

Fonction pure, aucune donnée forgée en base — `tests/unit/interventions/retour-demande-absences.test.ts` (nouveau) :

- demande rattachée (`depuisId` égale `ligne.demande_id`) → `/demandes/{id}`, bon
  libellé ;
- demande NON rattachée (`depuisId` diffère) → planning, inchangé ;
- demande sans `depuisId` → planning, inchangé ;
- absences → `/absences`, libellé recomposé depuis `t("absences.titre")` décapitalisé
  (jamais un littéral en dur dans le test, pour ne pas dupliquer le risque de
  divergence) ;
- `depuis` absent, et `depuis` hors liste fermée → planning, comportement inchangé
  (non-régression explicite des cinq origines déjà en place).

`tests/unit/interventions/retour-registre.test.ts` (préexistant) : la fixture
`LIGNE_SANS_MACHINE` a reçu `demande_id: null`, seul changement nécessaire pour que le
type élargi de `retourFiche` continue de compiler — aucune assertion modifiée.

Deux épreuves e2e préexistantes assertaient l'URL exacte, sans `depuis`, des liens que ce
ticket modifie — cassées par construction, corrigées pour refléter le nouveau
comportement voulu par le ticket (pas un contournement d'échec, la valeur attendue elle-même
a changé) :

- `tests/e2e/absences-3.spec.ts` — le bandeau « rendues à la file » : les deux `href`
  portent désormais `?depuis=absences`, et l'URL après clic aussi (deux assertions dans
  la même épreuve).
- `tests/e2e/demandes-2.spec.ts` — le lien d'une intervention issue depuis la fiche de la
  demande : l'URL après clic porte désormais `?depuis=demande&depuis_id=<demande>`.

## Ce que je n'ai PAS fait

- Aucune migration, aucune ligne de semis, aucun prix.
- Aucune logique changée pour les cinq origines déjà en place (`planning`,
  `interventions`, `client`, `site`, `machine`) — mêmes tests préexistants, verts sans
  modification autre que la fixture citée ci-dessus.
- Aucun `skip`/`fixme`, aucun `retries`, aucun `workers: 1`.
- Je n'ai touché ni `depot/` ni `11-FILE.sh`.
- Aucun test écrivant dans une fixture `SCENE.*` partagée.

## `pnpm test` puis `CI=1 pnpm verify:full`

- `pnpm test` : **268 fichiers, 2878 tests, tous passés**, zéro échec.
- `CI=1 pnpm verify:full`, en un seul appel, au premier plan — chaîne complète liée par
  `&&` : `format:check`, `typecheck`, `lint`, `test`, `test:isolation` et `build` tous
  sortis en succès avant que `feries:horizon` ne démarre. Premier passage rouge sur
  `format:check` (le fichier de test neuf n'était pas passé par Prettier) et sur les deux
  épreuves e2e citées plus haut — corrigés, puis chaîne complète rejouée intégralement :
  - `feries:horizon` — vert.
  - `audit:partitions` — préventif et détectif verts.
  - `test:e2e` : **294 épreuves passées, 3 ignorées, zéro échec** (1 worker).

## Les pièges pour la session suivante

- Comme documenté par plusieurs passations précédentes, `pnpm verify:full` réécrit au
  passage une soixantaine de captures PNG sous `docs/propositions/*/captures/`
  (recapture des scènes AVANT/APRÈS d'autres tickets, sans rapport avec celui-ci) — je
  les ai laissées telles quelles dans l'arbre (`git checkout --` dessus) plutôt que de
  les commiter, ce lot n'en touchant aucune.
- `CHAMPS_LIGNE` est lu par une quinzaine de requêtes dans `lib/interventions/depot.ts` :
  ajouter `demande_id` y rend ce champ disponible partout, pas seulement pour la fiche.
  Aucun autre appelant ne le consommait avant ce lot ; si un futur ticket veut s'appuyer
  sur `demande_id` ailleurs (registre, bon d'intervention...), le champ est déjà lu, rien
  à ajouter au `select`.

## Ce qui reste à faire

Rien d'identifié dans le périmètre de ce ticket. Le reste du constat 21 de l'audit du
25/09 (1re moitié, `retourVersRegistre`) était déjà fait par 78-LIENS-2, avant ce lot.
