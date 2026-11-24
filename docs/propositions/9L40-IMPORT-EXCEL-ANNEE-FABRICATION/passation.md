# 9L40-IMPORT-EXCEL-ANNEE-FABRICATION — passation

Ligne de la feuille de route « À écrire après la démo » : « Import Excel : ne plus effacer l'année de fabrication
saisie à la main. » **Aucune migration** (aucune colonne touchée).

## Mesure (point 1) — la cause exacte

Le gabarit « équipements » (`lib/imports/modeles.ts`, `COLONNES_EQUIPEMENTS`) n'expose **aucune** colonne « année de
fabrication » : elle est volontairement écartée dans `CHAMPS_EQUIPEMENTS_ECARTES`, avec son motif (lecture d'un
entier, écriture et annulation restaient un ticket DE CE gabarit — ajoutée le 31/10/2026, 9I8C). Parce qu'une
colonne absente du fichier est une cellule **toujours** vide, `preparerUnEquipement` ne pose jamais la clé
`annee_fabrication` dans la saisie qu'il construit — pour AUCUNE ligne, qu'elle crée ou modifie.

`schemaMachine` (`lib/machines/saisie.ts`) est **le même schéma** pour la création ET la modification — l'équipement
n'a pas de schéma de modification distinct, à la différence des clients et des sites. `annee_fabrication` y porte
`.default(null)` : une clé absente de la saisie devient donc `null` après `schemaMachine.parse(...)`.

`modifierMachineDans` (`lib/machines/depot.ts`) écrit les dix colonnes du modèle **sans condition** dès qu'une ligne
est jugée « modification » — y compris `annee_fabrication: null` — pour N'IMPORTE QUELLE raison de modification (une
simple correction de `localisation`, par exemple). Le verdict « modification » vs « inchangée » (`porteEncore`,
`lib/imports/comparaison.ts`) ne comparait d'ailleurs même pas `annee_fabrication` (absente de
`CHAMPS_EQUIPEMENTS_ECRITS`) : la colonne était donc écrasée à `null` **sans que rien ne le signale**, y compris
quand une ligne autrement « inchangée » était réécrite pour une tout autre raison.

**La même mécanique touchait déjà, et de façon plus visible, quatre autres colonnes** — `facture_origine`,
`date_mise_en_service`, `date_vente`, `garantie_fin` — toutes les quatre également absentes du gabarit
(`CHAMPS_EQUIPEMENTS_ECARTES`), et déjà présentes dans `CHAMPS_EQUIPEMENTS_ECRITS` (donc classées « modification »
dès qu'une AUTRE colonne changeait, et écrasées à l'écriture tout de même — le commentaire du code le documentait en
toutes lettres sans le corriger).

## Règle retenue, et son périmètre

**Une cellule qu'aucune ligne du gabarit ne peut jamais porter ne remplace jamais une valeur existante.** Nouveau
réglage `champsConservesSiAbsents` sur le moteur générique `appliquerLesLignes`
(`lib/imports/application.ts`) : juste après la lecture groupée des fiches « avant » (`lireAvant`), et **avant** la
comparaison `porteEncore` ET avant l'écriture, les colonnes nommées reprennent la valeur déjà en fiche — jamais le
défaut du schéma. La fonction pure qui fait ce remplacement, `conserverLesChampsAbsents`, vit dans
`lib/imports/comparaison.ts`, à côté de `porteEncore` (même raison : une seconde écriture du même geste diverge en
silence).

Pour le gabarit « équipements », `CHAMPS_EQUIPEMENTS_JAMAIS_ECRASES` nomme les cinq colonnes concernées :
`annee_fabrication`, `facture_origine`, `date_mise_en_service`, `date_vente`, `garantie_fin`. Les cinq partagent
exactement le même trait : **aucune ligne de ce gabarit ne les porte jamais**, donc toute absence est, sans
ambiguïté, « rien n'a été dit », jamais « remettre à vide ».

### Le point sur lequel je me suis arrêté (ticket, point 2)

Trois colonnes du gabarit sont, elles, **réellement exposées** : `localisation`, `criticite`, `reference_interne`.
Pour elles, une cellule vide sur UNE ligne précise est ambiguë — « rien à dire sur ce champ, laisser en l'état » ou
« remettre à vide/au défaut » peuvent toutes les deux se défendre, et le code actuel tranche déjà, implicitement et
sans arbitrage documenté, dans le second sens (`lib/imports/modeles.ts`, commentaire au-dessus de `criticite` dans
`preparerUnEquipement` : une cellule absente retombe sur le défaut `normale`). Changer ce comportement n'était pas
nommément demandé par le ticket (qui cite l'année de fabrication et parle de « cellule vide » au sens d'une colonne
que le fichier ne peut jamais porter), et le modifier sans trancher l'ambiguïté aurait pu surprendre un usage déjà
établi. **Je m'arrête ici et le signale** plutôt que de trancher à la place d'Alexis : si l'intention est la même
règle pour ces trois colonnes (cellule vide = pas de changement, jamais une remise à zéro), c'est un point à
confirmer avant un prochain lot sur ce gabarit.

### Pourquoi ceci n'est pas une entrée dans `docs/arbitrages.md`

Ce lot ne tranche aucune règle métier nouvelle : il corrige un défaut qui contredisait déjà l'intention du produit
(une donnée saisie à la main ne doit pas disparaître sans geste), et il renforce I8 (traçabilité) plutôt que de
l'assouplir. Aucun des points d'arrêt du §8 de CLAUDE.md n'est engagé (pas de schéma touchant `societe_id`, les
devises ou les statuts ; pas d'invariant assoupli ; pas de dépendance ajoutée). Le point ambigu ci-dessus n'est pas
non plus tranché ici — justement pour ne pas inventer une règle métier à la place d'Alexis.

## Ce qui a été livré

1. **`lib/imports/comparaison.ts`** — `conserverLesChampsAbsents` (export, testée unitairement).
2. **`lib/imports/application.ts`** — `appliquerLesLignes` reçoit `champsConservesSiAbsents` (optionnel, sans effet
   pour tous les autres gabarits qui ne le renseignent pas) ; `appliquerLeLotDeEquipements` le renseigne avec
   `CHAMPS_EQUIPEMENTS_JAMAIS_ECRASES` et ajoute `annee_fabrication` à la lecture groupée (`lireAvant`).
3. **`lib/imports/modeles.ts`** — commentaires de `CHAMPS_EQUIPEMENTS_ECARTES` mis à jour pour les cinq colonnes
   concernées : ce qui reste un ticket du gabarit (lire la colonne, la comparer à l'annulation) est désormais
   distingué de ce qui est fermé par 9L40 (une modification ne l'efface plus).
4. **Feuille de route** — l'élément passé de « À écrire » à « Livré depuis le 31/10 » (référence 9L40),
   `DATE_ETAT_FEUILLE_DE_ROUTE` avancée au 25/11/2026.

## Ce qui n'a pas été touché, nommément

- Aucun écran, aucun composant, aucune route n'a changé — seule la fusion import/base a changé. **Pas de capture
  AVANT/APRÈS à verser** : il n'existe aucun écran dont le rendu diffère avant/après ce lot (le rapport d'import
  continue d'afficher des décomptes par ligne, jamais un diff champ par champ — vérifié en lisant
  `app/(back-office)/imports/[id]/page.tsx` : aucun endroit n'affiche de cellule individuelle pour une colonne
  absente du gabarit, donc rien n'y dit littéralement « conservée » à corriger).
- Les trois colonnes exposées mais ambiguës (`localisation`, `criticite`, `reference_interne`) — voir ci-dessus.
- Aucune migration : aucune colonne ajoutée ou modifiée.

## Épreuves

- **Unitaire** — `tests/unit/imports/comparaison.test.ts` : `conserverLesChampsAbsents` reprend la valeur d'avant sur
  les champs nommés même si la saisie préparée porte un défaut ; laisse une colonne remplie et différente remplacer
  quand elle n'est pas dans la liste ; rend la saisie telle quelle sans liste ; applique plusieurs champs
  indépendamment.
- **Isolation** — `tests/isolation/application-import-materiel.test.ts`, nouveau describe « 9L40 » : l'année de
  fabrication ET la référence de facture, saisies à la main par SQL (le chemin de l'écran de modification, que ce
  test ne traverse pas), survivent à une MODIFICATION RÉELLE (changement de `localisation`, vérifié en base) ; plus
  un témoin que le cloisonnement société n'a pas bougé (un équipement visant le site d'une autre société reste
  refusé, ni création ni modification).
- **e2e, 1280 px** — `tests/e2e/9l40-import-excel-annee-fabrication.spec.ts`, scène propre `9L40-` : un premier
  import crée la machine ; l'année de fabrication est saisie À LA MAIN sur `/parc/<id>/modifier` (le gabarit ne
  l'expose pas) ; un second import change la localisation de la MÊME machine (compte « 1 modification » affiché à
  l'écran) ; la fiche montre toujours l'année saisie après application, et la base confirme que la localisation,
  elle, a réellement changé.
- `pnpm test` (6080 tests), `pnpm test:isolation` (2573 tests) et `CI=1 pnpm verify` passent intégralement, rejoués
  en avant-plan. Le fichier e2e ciblé a aussi été rejoué seul deux fois (avant et après la correction du gardien
  L0-11 ci-dessous) : vert les deux fois.
- `pnpm test:e2e` en entier n'a pas été rejoué (budget du lot, mémo du poste : plus de 30 minutes à un worker) ; la
  file de nuit joue `verify:full`.

### Un correctif en cours de route

`CI=1 pnpm verify` a d'abord buté sur `tests/unit/i18n/sans-chaine-visible-en-dur.test.ts` (gardien L0-11) : les
littéraux `"1"` et `"2016"` passés à `toContainText`/`getByText` dans le spec e2e sont des chaînes visibles écrites
en dur. Déplacés dans `tests/e2e/setup/scene-9l40.ts` (`SCENE_9L40`), sur le modèle exact de `scene-9l20.ts` — un
fichier qui n'interroge pas l'écran peut porter la chaîne, le spec ne la reprend plus que par référence.

## Captures

Aucune (voir « Ce qui n'a pas été touché » ci-dessus) — ce lot ne change aucun écran. Le script `scripts/captures.mts`
n'a donc pas été relancé : rien dans `docs/captures/` ne peut différer après ce lot.
