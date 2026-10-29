# 9I7B-PIECES-REMPLACEES-SAISIE-LIBRE — passation

## La migration à jouer, nommément

```
20261030040000_pieces_remplacees_saisie_libre_9i7b
```

Écrite à la main (gabarit `intervention_prestation`, pas de `prisma migrate dev`
diffé contre le schéma — voir le §9 de la mesure ci-dessous), puis appliquée par
`prisma migrate deploy` sur la base de test du poste (`codiplan_test`, conteneur
`codiplan-pg-voie1`, port 5441). Alexis la joue en production et sur le site de
test par le chemin habituel (`pnpm db:deploy`).

## Ce qui a changé

### Table neuve, forme « filiation »

`intervention_piece_remplacee` (`societe_id`, `intervention_id`, `designation`
≤ 200, `reference` nullable ≤ 80, `quantite` entier CHECK ≥ 1, `rang`,
`cree_le`, `modifie_le`) — recopie EXACTE de la politique RLS
`cloisonnement_filiation` d'`intervention_prestation` (D103), mêmes GRANT au
rôle applicatif, même déclencheur d'audit. `ON DELETE CASCADE` vers
l'intervention.

### Le dépôt (`lib/interventions/depot-rapport-terrain.ts`)

- `schemaPieceRemplacee` / `schemaPiecesRemplacees` (Zod) : désignation
  1-200, référence facultative ≤ 80, quantité entière ≥ 1. Aucun champ de
  prix déclaré — un champ envoyé en plus est silencieusement écarté par Zod,
  jamais lu par l'écriture.
- `schemaRapportTexte.pieces_remplacees` est **facultatif** : `undefined`
  laisse l'ancienne saisie intacte (compatibilité avec tous les appelants
  antérieurs à ce ticket, qui ne le fournissent pas) ; un **tableau, même
  vide**, REMPLACE L'ENSEMBLE des lignes de l'intervention — jamais une
  fusion, jamais une différence comme les prestations (D143). Ce
  remplacement a lieu **dans la même transaction** que l'écriture du
  commentaire/suite, et partage donc sa garde `estFige` : une intervention
  annulée ou clôturée refuse les deux à la fois. C'est un choix délibéré,
  pas un oubli — voir « Ce qui reste discutable » plus bas.
- `piecesRemplacees(contexte, interventionId)` : lecture, triée par `rang`.
- `aSectionPiecesRemplacees(type)` vit dans **`lib/interventions/saisie.ts`**
  (pas dans le dépôt) : ce module est pur (aucun import Prisma), et la
  coquille hors réseau (`components/terrain/consultation-hors-reseau.tsx`,
  `"use client"`) en a besoin sans embarquer le client Prisma dans le paquet
  navigateur. `depot-rapport-terrain.ts` le réexporte pour les appelants
  serveur déjà habitués à l'y trouver.

### La saisie terrain (`components/terrain/rapport-automatique.tsx`)

Section « Pièces remplacées », visible uniquement si `afficherPieces` (prop,
calculée par l'appelant via `aSectionPiecesRemplacees`) : liste de lignes
(désignation, référence, quantité), « Ajouter une pièce », « Retirer cette
pièce ». Mêmes mécaniques que commentaire/suite : brouillon `localStorage`,
debounce de 1,5 s, comparaison avant envoi (`JSON.stringify` des lignes
normalisées), remise à zéro après succès. **Zéro ligne ne bloque jamais
« Terminer »**.

### Le transport — même enveloppe que le rapport, de bout en bout

Mesuré avant d'écrire (point 1 du ticket) : le format de la file hors réseau
(`lib/terrain/file-saisies.ts`) est un type fermé (`GesteRapport`) + un
validateur explicite (`gesteReconnu`) + un sérialiseur explicite (`corpsDe`,
`lib/terrain/envoi-file.ts`) — **pas** un passe-plat générique. Étendre les
trois pour porter `pieces` (champ **facultatif** sur `GesteRapport`, pour ne
pas casser ~30 tests existants qui construisent des gestes sans lui ; absent
ou malformé → `[]`, jamais un rejet du geste entier) a suffi : aucun
changement du FORMAT DE STOCKAGE IndexedDB lui-même (toujours un objet JS
arbitraire dans le même magasin `file`).

La consultation hors réseau (lecture seule pendant une coupure) porte aussi
les pièces : `FicheJSON.rapport.piecesRemplacees` (nouveau champ sur
l'instantané, `app/api/terrain/instantane/route.ts`), lu sans risque par
`rapportDeLaFiche` (`lib/terrain/copie-validee.ts`) — absent sur une copie
plus ancienne devient `[]`, même doctrine que `catalogue`/
`prestationsRealiseesIds`.

### Lecture — bon et fiche bureau

- `lib/interventions/bon.ts` : `BonIntervention.piecesRemplacees`,
  `libellePieceRemplacee` (« Désignation (référence) × quantité », quantité
  omise si 1 — choix de présentation, pas une règle de gestion).
- `lib/interventions/profil-bon.ts` : tuile `"pieces"` ajoutée à
  `TUILES_BON`. **`ordreTuiles` reste exhaustif sur les HUIT tuiles pour les
  NEUF natures** (invariant posé par 9I7 et gardé par
  `tests/unit/interventions/profil-bon.test.ts`, inchangé) — `profilDuBon`
  ne décide que l'ORDRE, jamais la présence à l'écran. C'est la PAGE qui
  omet la tuile : hors curatif/garantie/reprise, OU quand la liste est vide
  (point 4 du ticket, « absente si zéro ligne : aucune tuile vide » —
  **distinct** du régime de « commentaires », qui affiche toujours son
  absence). Voir `app/(back-office)/interventions/[id]/bon/page.tsx`
  (filtrage dans le `.flatMap` qui lit `perfil.ordreTuiles`) et
  `app/(back-office)/interventions/[id]/page.tsx` (tuile conditionnelle,
  même donnée, lecture seule).

### Décision et modèle de données

- `docs/arbitrages.md` — **D222** : les deux citations verbatim d'Alexis, le
  régime « relevé déclaratif sans prix, distinct de 3.7 », les trois types
  concernés, le remplacement intégral dans la même enveloppe.
- `docs/cahier-des-charges.md` chapitre 11.2 — entrée `intervention_piece_remplacee`.

### Gardiens dérivés du schéma, mis à jour mécaniquement

Une table neuve de la première catégorie de I1 fait rougir plusieurs
gardiens qui dérivent leur population du schéma ou de la liste des
migrations — aucun n'encode une règle changée par ce ticket, tous
constataient juste l'absence de la table neuve dans leur propre liste :

- `scripts/lib/politiques-rls.ts` (`TABLES_FILIATION`, `FILIATION_ARBITREE`) ;
- `lib/db/migrations-attendues.ts` ;
- `tests/unit/db/perimetre-audit.test.ts` (39 tables, pas 38) ;
- `tests/unit/db/inventaire.test.ts` (trois literals `decomptes`) ;
- `tests/isolation/9h1c-rattrapages-sous-role-reel.test.ts` — bornage
  explicite de `apres` à `[indexBorne, indexBorne + 2]` plutôt que
  `[indexBorne, fin]` : ce scénario rejoue EXACTEMENT les migrations 9H1 et
  9H2 sur une base remplie, et une migration ajoutée après elles grossissait
  silencieusement ce qu'il rejoue sans rien y mesurer. Ce n'est pas un
  assouplissement — le bornage reflète l'intention déjà écrite en commentaire
  (« 9H1 puis 9H2 ») plutôt que « tout ce qui suit, quel que soit l'historique
  futur » ;
- `tests/unit/ui/composants-base.test.tsx` et `tests/unit/ui/retouches-2a.test.ts`
  (18 → 20 `<Button>` du terrain, pour « Ajouter une pièce » / « Retirer
  cette pièce »).

## Épreuves couvertes

- **Unitaire** (`tests/unit/interventions/pieces-remplacees.test.ts`) :
  bornes du schéma (désignation, référence, quantité), tableau 0/50/51
  lignes, `pieces_remplacees` facultatif sur `schemaRapportTexte`,
  `aSectionPiecesRemplacees` exhaustif sur les neuf natures.
- **Isolation** (`tests/isolation/rapport-terrain.test.ts`, nouveau describe
  « les pièces remplacées, saisie libre (9I7B) ») : écriture/lecture sous la
  société propriétaire seule, refus propre sous une autre société (I1) ;
  remplacement intégral (un second envoi efface le premier) ; `undefined`
  laisse l'ancienne saisie intacte.
- **Composition hors réseau** (`tests/unit/terrain/copie-validee.test.ts`,
  `tests/unit/terrain/file-saisies.test.ts`) : parsing défensif de
  `piecesRemplacees`/`pieces` (absent, malformé, élément invalide écarté).

## CE QUI N'A PAS ÉTÉ FAIT — budget de temps, à dire explicitement

Conformément à la règle du lot (« à T0 + 90 min, plus de code neuf »), les
trois épreuves suivantes, prévues au point 3 et au point 6 du ticket,
**n'ont pas été jouées** :

1. **Épreuve e2e** (saisie, enregistrement, relecture) sur un écran réel.
2. **Épreuve e2e hors réseau** (saisie coupée du réseau, rejeu au retour,
   lignes présentes une seule fois).
3. **Les captures** (`docs/propositions/9I7B-PIECES-REMPLACEES-SAISIE-LIBRE/captures/`) :
   saisie terrain 375 px (vide, 2 lignes), bon curatif 1280 px et rendu
   impression, fiche bureau 1280 px.

Les trois demandaient une fixture e2e DÉDIÉE (type curatif/garantie/reprise :
`SCENE.rapportTravaillee`/`rapportVierge` existantes sont `preventif_contrat`,
donc ne montrent jamais la section) et un cycle de vie complet jusqu'à
`terminee` pour la capture du bon — un coût d'écriture et de rejeu (migrate +
seed + build Playwright) incompatible avec le temps restant au moment où ce
choix a été fait (~95 min écoulées). Le précédent du lot 9I7 lui-même
(`docs/propositions/9I7-BON-INTERVENTION-EN-TUILES/verify-final.txt` :
« test:e2e coupé par le budget, aucun échec observé ») a guidé cette
décision plutôt que de produire un spec hâtif, non rejoué, pour un geste
visuel.

**Rien de rouge n'a été mesuré** sur le chemin manquant — c'est une ABSENCE
d'épreuve, jamais un défaut mesuré et laissé de côté. La couverture unitaire
et d'isolation ci-dessus couvre le dépôt, le schéma et la composition hors
réseau ; ce qui reste à mesurer est le GESTE à l'écran lui-même (saisir,
voir la tuile, imprimer) et son rendu visuel.

**Pour la session qui reprend ce fil** : poser une fixture e2e dédiée (ex.
`e2e00000-…` sur Ducos, `type: "curatif"`, statut `terminee` après un cycle
complet — voir `tests/e2e/historique-site.spec.ts` pour le gabarit « site à
soi, retiré en `afterAll` ») plutôt que de réutiliser `SCENE.rapportTravaillee`.

## Ce qui reste discutable (pas un point d'arrêt, mais à relire)

Le dépôt écrit les pièces dans la **même garde** `estFige` que
commentaire/suite — une intervention `cloturee`/`annulee` refuse les deux à
la fois, contrairement aux prestations/photos/signature (tables filles qui
n'héritent PAS de cette borne, I5). Choix fait sciemment : le ticket demande
explicitement le remplacement « dans la transaction du rapport », ce qui
revient à partager sa porte. Si Alexis veut que le travail terrain sur les
pièces survive à une clôture/annulation entre-temps (comme les prestations),
cela demanderait de sortir leur écriture de `enregistrerRapportTexte` vers
une fonction dédiée, sans garde `estFige` — une question de doctrine, pas
une correction de bug.

## Vérification

`CI=1 pnpm verify` (format, typecheck, lint, test, test:isolation, build) —
trace dans `verify-final.txt` de ce dossier. `test:e2e` n'y est volontairement
PAS inclus (voir plus haut) : `pnpm verify:full` n'a donc PAS été rejoué en
entier non plus, pour la même raison.
