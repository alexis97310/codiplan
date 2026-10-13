# 9EWB-PHOTOS-EN-BASE — passation

**MIGRATION À APPLIQUER EN PRODUCTION PAR ALEXIS** : `20261014030000_photos_en_base`
(`pnpm db:deploy`). Ajoute `document.octets` (`BYTEA`, nullable) et deux contraintes
CHECK (cohérence avec `taille_octets`, plafond 1 Mo). Non destructive, aucune politique
RLS modifiée.

Décision n° 96 d'Alexis (13/10/2026) : en testant l'application technicien en production,
une photo n'a pas été gardée — `lib/documents/stockage.ts` écrit sous `process.cwd()`,
non inscriptible sur l'hébergeur, et l'exception n'était pas rattrapée (page 500 muette).
Décision écrite dans `docs/arbitrages.md`, D200 : la photo est réduite sur le téléphone
(~1600 px, JPEG ~0,8) et gardée EN BASE, comme la signature et le logo.

## Point 1 — migration

`prisma/migrations/20261014030000_photos_en_base/` : colonne `document.octets` +
`document_octets_taille_coherente` + `document_octets_plafond`. `objet_cle` reste NOT
NULL ; pour une photo en base, c'est `'bd:' || empreinte`, jamais une clé de fichier.
`lib/db/migrations-attendues.ts` étendu. Aucune politique RLS neuve : la forme
« héritage » de `document` reste par ligne, indifférente à l'ajout d'une colonne.

## Point 2 — le dépôt

`deposerPhotoIntervention` (`lib/documents/depot.ts`) reçoit désormais les octets BRUTS
(déjà réduits par le téléphone) au lieu d'un `ObjetStocke` : elle calcule elle-même
l'empreinte (SHA-256) et la clé, et écrit `document.octets` dans la MÊME transaction que
la fiche — plus aucun octet ne peut survivre seul à un refus. Même intervention + même
empreinte rend la ligne déjà posée plutôt qu'une seconde (un renvoi après coupure réseau
ne double pas la photo) — lu par un `findFirst` dans la même transaction, avant le
`create` ; pas d'index unique dédié, la fenêtre de course étant jugée négligeable pour un
dépôt de ce volume (contrairement au bac de réception, qui absorbe des téléversements de
plusieurs minutes).

`lireDocument` lit désormais `octets` ; `null` pour les documents déposés avant cette
colonne, qui se replient sur `lireObjet(objet_cle)` comme avant.
`lib/documents/stockage.ts` n'a plus d'appelant pour une photo — le module reste
l'interface prête pour le stockage S3-compatible (condition de réouverture dans D200).

Deux fichiers isolation existants ont dû être adaptés (signature inchangée côté test,
mais `objet: {...}` → `octets: Buffer.from(...)`) : `tests/isolation/
9dc-renfort-saisir-rapport.test.ts` et `tests/isolation/rapport-terrain.test.ts`.

## Point 3 — la route

`app/api/terrain/[id]/photos/route.ts` : le format se juge sur les OCTETS MAGIQUES
(`lib/documents/formats-image.ts`, JPEG `FF D8 FF`, PNG les huit octets standard) —
jamais sur `fichier.type` ni l'extension, tous deux fournis par le client. Plafond
ramené de 15 Mo à 1 Mo (la photo arrive déjà réduite). Deux refus nommés nouveaux :
`terrain.photos.refus_taille` (trop lourd) et `terrain.photos.refus_type` réemployé pour
un format non reconnu. La route répond en JSON (`{ok, motif}`) quand le client envoie
`Accept: application/json` — c'est le composant du point 4 — sinon par la redirection 303
inchangée (formulaire natif sans JavaScript).

`app/api/documents/[id]/octets/route.ts` : lit `document.octets` en priorité, se replie
sur `lireObjet(objet_cle)` sinon. Le `Content-Type` servi est DÉDUIT des octets
(`formatImageReconnu`), avec repli sur `type_mime` stocké pour un document qui n'est pas
une image (notice, certificat) ; `X-Content-Type-Options: nosniff` ajouté.

## Point 4 — l'écran

Nouveau composant client `components/interventions/photos-terrain.tsx` : à la sélection
du fichier (`onChange`), réduction immédiate (`createImageBitmap` → `<canvas>` ≤ 1600 px
de plus grand côté → `toBlob("image/jpeg", 0.8)`), avec aperçu. La soumission attend
cette réduction (même si le clic arrive avant qu'elle finisse), puis envoie en `fetch`
avec `Accept: application/json` ; états « Envoi… / Photo enregistrée / Échec ». Sans
JavaScript, le formulaire natif reste posé (mêmes `action`/`method`/`encType`) — la route
refuse simplement au-delà de 1 Mo, avec un message lisible.

`app/(mobile)/terrain/[id]/page.tsx` : seul le `<form>` du bloc photo est remplacé par
`<PhotosTerrain action=... libelleAjouter={t("terrain.photos.ajouter")} />` — le libellé
du bouton reste traduit DANS `page.tsx` et passé en prop, pour que le témoin de
`tests/unit/outils/fichiers-source.test.ts` (qui lit la ligne littérale
`{t("terrain.photos.ajouter")}` dans ce fichier) continue de la trouver sans être touché.

Deux gardiens de typographie/taille du terrain (`tests/unit/ui/retouches-2a.test.ts`,
`tests/unit/ui/composants-base.test.tsx`) comptaient les `<Button>` d'une liste FERMÉE de
fichiers : `components/interventions/photos-terrain.tsx` y est ajouté, population
inchangée (le total de boutons ne bouge pas, seul le fichier qui en porte un se
déplace).

## Point 5 — épreuves

- `tests/isolation/photo-orpheline-r7.test.ts` réécrit SANS disque : même garantie
  (aucun document créé quand le périmètre refuse le renfort), sans plus mocker
  `lib/documents/stockage.ts`, qui n'est plus appelé pour une photo.
- `tests/isolation/photo-octets-societe.test.ts` (neuf) : une photo déposée sous la
  société A rend 404 sous le contexte de la société B, en traversant la VRAIE route des
  octets.
- `tests/isolation/photo-format-et-taille.test.ts` (neuf) : un SVG, des octets non
  reconnus malgré une extension `.jpg`, et plus d'1 Mo — tous refusés, nommés, sans
  document créé.
- `tests/unit/documents/formats-image.test.ts` (neuf) : `formatImageReconnu` sur JPEG,
  PNG, texte, octets quelconques, tableau trop court.
- `tests/e2e/rapport-terrain.spec.ts` : le test existant « une photo se dépose et
  s'affiche » n'a pas eu besoin d'être modifié (le composant conserve le nom de fichier
  d'origine lors de la réduction, donc l'alt de l'`<img>` affiché reste
  `photo-epreuve.png`). Un test neuf joint directement la route (`page.request`, cookies
  de la session réelle) avec un SVG — nécessaire car le composant rastérise désormais
  toute image sélectionnée en JPEG avant l'envoi, donc un dépôt passant par l'écran ne
  mesurerait plus ce refus.
- `tests/e2e/captures-9ewb-photos-en-base.spec.ts` (neuf, sa propre intervention
  jetable, préfixée `9EWB-`) : captures 375/1280 du bloc photo (avant envoi, envoyée,
  échec de réduction sur un fichier corrompu) et du bon avec la photo —
  `docs/propositions/9EWB-PHOTOS-EN-BASE/captures/`.

## Point 6 — doc

`docs/arbitrages.md`, D200. Cette passation.

## Vérification finale

Épreuves voisines rejouées individuellement, toutes vertes : `tests/e2e/
rapport-terrain.spec.ts` (7), `tests/e2e/bon-4.spec.ts` + `tests/e2e/terrain.spec.ts` (4).

`CI=1 pnpm verify:full` rejoué EN ENTIER, en un seul appel, au premier plan (~63 min) —
**vert de bout en bout** : format:check, typecheck, lint, 4682 tests unitaires, 1546
tests d'isolation, build de production, fériés (horizon tenu), partitions (13 couvertes,
jusqu'à 2027-10, rien dans la partition par défaut), et 1293 tests e2e passés (48 skipped,
0 échec). HEAD au moment du rendu : `6be610e5`.

15 dernières lignes du journal e2e :

```
·MESURE glisser-en-cours@1280 — textes<12px: 0, cibles<32px: 0, débordement: 0
MESURE bandeau-deplacement-differe@1280 — textes<12px: 0, cibles<32px: 0, débordement: 0
·····················
························°°······················································
·································[WARN Better Auth: Base URL is not set — sans incidence, voir note ci-dessous]
···············································
································································································
················································································
················································································
················································································
··································°·°··············°····························
································°°°°°°°°°°°°°°°°°°°°°°°°°°°°°
  48 skipped
  1293 passed (50.2m)
```

Le `WARN [Better Auth]: Base URL is not set` répété dans tout le journal est antérieur à ce
lot (aucune variable `BETTER_AUTH_URL` posée dans cet environnement de test) — sans lien
avec 9EWB, observé aussi sur les épreuves voisines rejouées isolément avant ce lancement
complet.
