# 9L52-TERRAIN-SIGNATURE-ZONE-NOM — passation

Branche `9L52-TERRAIN-SIGNATURE-ZONE-NOM`, partant d'`origin/main` (`d05f0df36`). Jamais poussée.
`main` est extrait ailleurs (`/home/aplou/codiplan`) — travail sur cette branche dédiée, comme demandé.
Arbre propre, 5 commits.

## Ce qui a été demandé

Audit du 10/11 (B11), point m10a : « Signature : zone agrandie, nom prérempli avec le contact sur
place, toujours modifiable ».

## Mesure — ce qui existait déjà, ce qui manquait

Avant d'écrire une ligne, mesuré plutôt que deviné :

- **Le nom prérempli avec le contact sur place, et sa modifiabilité** : déjà livré par
  `9L04H-TERRAIN-RECAPITULATIF-SIGNATURE` (`fcaec575f`, 13/11/2026) — `recapitulatif.contactSurPlaceNom`
  initialise `nomSignataire` (`components/terrain/rapport-automatique.tsx:1031-1032`), câblé aussi bien
  en ligne (`app/(mobile)/terrain/[id]/page.tsx:870`) que hors réseau
  (`components/terrain/consultation-hors-reseau.tsx:685`). Le champ est un `<input>` ordinaire, jamais
  `readOnly` ni `disabled` hors `nonDemarree` (le même état qui désactive TOUTE la rubrique Signature
  tant que l'intervention n'est pas démarrée, D262/9L08B — pas une restriction propre au nom). La
  feuille de route (`lib/feuille-de-route/contenu.ts:290`) listait déjà ce point comme « Livré » en
  citant `9L04C à 9L04M`.
- **Le « contact sur place »** est `Intervention.contact` (`contact_id`), un contact du CLIENT avec
  rattachement de site FACULTATIF (`prisma/schema.prisma:1625` et suivants) — jamais un champ texte
  libre de l'intervention. `contactAffiche` (`components/terrain/presentation.ts:107`) en tire le nom et
  les numéros.
- **La largeur** était déjà pleine (`w-full`, point 5, 9G5-TERRAIN-ERGONOMIE).
- **La hauteur**, en revanche, restait à **190 px** (posée par 9L04H dans le cadre du style « épuré » —
  avant lui, 140 px) : sous le seuil « au moins ~200 px » que l'audit juge confortable pour un tracé au
  doigt. C'est le seul écart mesuré contre le texte de m10a.
- **Épreuves existantes** : préremplissage + signature tracée et envoyée (9L04H, le nom prérempli
  envoyé TEL QUEL) ; client absent avec motif, par le formulaire (9K27, 9L04G, zz-captures-9G1) — déjà
  couvertes. **Manquante** : aucune épreuve ne modifiait le nom prérempli avant l'envoi, ni ne mesurait
  le préremplissage HORS RÉSEAU.

## Ce qui a été fait

1. **Hauteur du canevas : 190 → 220 px** (`components/terrain/rapport-automatique.tsx`, le `<canvas>`
   et ses deux classes `h-[…px]`, commentaire mis à jour). Changement unique, partagé par la fiche en
   ligne et la coquille hors réseau (même composant `RapportTerrainAutomatique`). Captures AVANT/APRÈS
   à 375 px dans `docs/propositions/9L52-TERRAIN-SIGNATURE-ZONE-NOM/captures/` (épreuve dédiée
   `tests/e2e/zz-captures-9l52-signature-zone.spec.ts`, rejouée une fois avant le changement de hauteur
   et une fois après — le code a été reverti puis réappliqué par patch pour produire les deux, jamais
   dans le même run).
2. **Épreuve e2e neuve** (`tests/e2e/9l04h-terrain-recapitulatif-signature.spec.ts`) : le nom prérempli
   est MODIFIÉ avant l'envoi, et c'est le nom modifié — pas celui du contact — qui est lu en base
   ensuite. Seule la modification distingue cette épreuve de celle déjà en place.
3. **Épreuve unitaire neuve** (`tests/unit/terrain/fiche-hors-reseau-travail.test.tsx`) : la coquille
   hors réseau prérempli le nom depuis `fiche.contact` exactement comme en ligne. La fixture par défaut
   du fichier est `affectee` (boutons d'issue désactivés, `nonDemarree`) — fixture dédiée à `en_cours`.
4. **Feuille de route** (`lib/feuille-de-route/contenu.ts:290`) : référence `9L52` ajoutée, hauteur
   chiffrée (220 px).

## Ce que ça ne touche pas

Aucune migration, aucune colonne manquante. D173/D212 (les trois issues de signature, le motif
obligatoire, l'enregistrement automatique) ne changent pas — seule la taille du cadre de dessin.
Aucune règle du chapitre 10 : rien à écrire dans `docs/arbitrages.md`, c'est un ajustement ergonomique
d'un point déjà tranché (le préremplissage, décidé par Alexis le 13/11/2026, D212/9L04H), pas une
nouvelle décision.

## Épreuves

`pnpm test` (6109 passés), `pnpm test:isolation` (2587 passés), épreuves e2e ciblées
(`9k27-terrain-terminer-ce-qui-manque`, `9l04g-terrain-barre-fixe-terminer`, `9de-terminer-signature`,
`bon-4`, `9l04h-terrain-recapitulatif-signature` — 10 au total) et `CI=1 pnpm verify` (format, typecheck,
lint, test, isolation, build) — tous verts.

**Captures d'autres lots régénérées puis restaurées** : rejouer les épreuves e2e ciblées ci-dessus a
réécrit une trentaine de PNG sous `docs/propositions/{76-BON-4,9DE-…,9K27-…,9L04G-…,9L04H-…}/captures/`
(effet de bord normal de ces specs, qui recapturent à chaque exécution). Restaurés à l'état du commit
(`git checkout --`) : ces galeries documentent l'état de LEUR ticket, pas l'état courant — même lecture
que `docs/captures/README.md` pour la galerie repo-wide, qui n'est elle-même pas rafraîchie à chaque
lot. Seules les captures neuves de CE lot (`9L52-TERRAIN-SIGNATURE-ZONE-NOM/captures/`) sont commitées.

**`docs/captures/` (galerie repo-wide) n'a volontairement pas été rafraîchie** — même lecture que
9L04H et 9L50 : `scripts/captures.mts` exige une base jetable neuve, un build de production, et
l'amorçage de plusieurs comptes par lien de premier accès (procédure de `docs/captures/README.md`),
hors du budget de ce lot. Le canevas plus haut change la silhouette de l'écran `terrain-intervention`
(photographié dans cette galerie) ; une régénération dédiée (sur le modèle de
`9L04L-CAPTURES-REGENEREES`) reste à faire si cet écart devient gênant.
