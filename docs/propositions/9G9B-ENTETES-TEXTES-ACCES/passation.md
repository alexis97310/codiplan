# 9G9BA-REPRISE-9G9B — passation

## Cause prouvée

`tests/e2e/rapport-import-tpa3.spec.ts:165-167` (sur la branche de garde, avant
correction) visait :

```ts
await expect(
  page.getByRole("link", { name: fr["imports.lot_retour"] }),
).toBeVisible();
```

Ce lien nu (« ← Retour aux imports ») a été retiré par le **point 5** de 9G9B
(« une seule règle de retour, le fil d'Ariane ») sur la branche « lot
introuvable » de `app/(back-office)/imports/[id]/page.tsx:126-147`. Ce n'est
**pas une régression de code** : cette même branche porte déjà un `filAriane`
depuis le commit du point 5 —

```tsx
filAriane={[
  { libelle: t("nav.imports_excel"), href: "/imports" },
  { libelle: t("imports.lot_titre") },
]}
```

— soit un lien visible vers `/imports`, sous le nom « Imports Excel » plutôt
que « ← Retour aux imports ». L'épreuve n'avait simplement pas été mise à
jour après le retrait du lien qu'elle visait.

Mesuré rouge à l'identique :
- sur `9G9B-ENTETES-TEXTES-ACCES-garde` (la branche arrêtée à 180 min) ;
- sur `9G9BA-REPRISE-9G9B` rebasée sur `origin/main` (`5beed3f7`), avant
  correction — même échec, même ligne, confirmant que ce n'est pas un effet
  du rebasage.

## Correction — au bon endroit : l'épreuve, pas la page

Le fil d'Ariane est bien présent sur l'état « lot introuvable » : l'épreuve
vise désormais ce lien, avec la même force d'assertion (un lien visible vers
la liste) :

```ts
await expect(
  page
    .getByLabel(fr["navigation.fil_ariane"])
    .getByRole("link", { name: fr["nav.imports_excel"] }),
).toBeVisible();
```

Le `getByLabel` scope au `<nav aria-label="Fil d'Ariane">` : sans lui,
`getByRole("link", { name: "Imports Excel" })` est ambigu (deux éléments —
le même lien existe aussi dans la barre de navigation latérale). Rien
d'autre n'a été retiré à l'épreuve.

Deux captures (375/1280) de cet écran, APRES seulement (aucun changement de
rendu depuis le point 5 — seule l'épreuve a changé) :
`docs/propositions/9G9B-ENTETES-TEXTES-ACCES/captures/apres-lot-introuvable-{375,1280}.png`.

### Écrans d'erreur/introuvable vérifiés (règle du fil d'Ariane, point 5)

Les cinq écrans touchés par le point 5 sont : création d'intervention,
lot d'import introuvable, création d'agence, création et modification de
machine. Seul le second est un état d'erreur — les quatre autres sont des
formulaires de création/modification sans branche « introuvable » propre.
- `parc/[id]/modifier/page.tsx:45,49` utilise `notFound()` (page générique
  Next, `app/not-found.tsx`, qui porte son propre lien vers `/` — hors
  périmètre du point 5, jamais touchée par lui).
- `parametres/agences/nouvelle/page.tsx:85` a sa branche de refus de rôle
  sur `<RefusAcces />`, qui porte son propre lien vers `/terrain` — seule
  route de retour dans sa coque, comme noté par le commit du point 6 pour
  les deux autres usages de ce composant.
Aucun autre écran de ce lot ne manquait d'un chemin de retour visible.

## État des 7 points du contrat

**Le texte du contrat (`tickets/recales/9G9B-ENTETES-TEXTES-ACCES.md`) est
INTROUVABLE** — ni dans cette branche, ni dans `9G9B-ENTETES-TEXTES-ACCES`,
ni dans `9G9B-ENTETES-TEXTES-ACCES-garde`, ni dans `voie2-reste-1022-1339`
(le reste non commité rescapé de la session arrêtée), ni dans
`docs/backlog.md`, ni dans l'historique d'aucune branche locale. Le dossier
`tickets/` n'existe dans ce dépôt sous AUCUNE référence. L'état ci-dessous
est reconstruit depuis les messages (sujet + corps) des 7 commits de la
garde, jamais depuis le contrat lui-même — **signalé, pas deviné**.

| # | Intitulé (reconstruit) | État | Commit(s) |
|---|---|---|---|
| 1 | Actions d'en-tête en haut à droite, boutons jamais liens nus | **FAIT** | `2b004192` |
| 2 | *(texte introuvable)* | **INCONNU** — voir ci-dessous | — |
| 3 | Écrans d'accès blancs et lisibles | **FAIT** | `8e1cb35b` |
| 4 | Champ fichier en français | **PARTIEL** — écart nommé | `37bd377c` |
| 5 | Une seule règle de retour, le fil d'Ariane | **FAIT** (+ correctif épreuve ce lot) | `dba2cc04` |
| 6 | Coque terrain (titre, retour redondant, largeur) | **PARTIEL** — deux écarts nommés | `51158522` |
| 7 | Captures avant/après 375/1280 | **FAIT** (+ complément lot introuvable ce lot) | `eaefc169` |
| — | Correctifs des épreuves cassées par la restructuration | **FAIT** | `8967ca98` |

### Point 2 — inconnu, non traité

Aucun commit de la garde ne porte « point 2 » dans son message, et le texte
du contrat est perdu (probablement : fichier généré hors dépôt par la file
au moment du dispatch, jamais commité, et non récupérable depuis la session
arrêtée — elle n'a laissé aucune trace dans `traces/9G9B-ENTETES-TEXTES-ACCES.txt`,
vide, ni dans son reste non commité, qui ne contient qu'un `verify-final.txt`
partiel et des captures d'EFFET DE BORD d'autres tickets, restaurées/écartées
dans ce lot sans être commitées).

**Je n'ai pas inventé ce que le point 2 demande** — ce serait une règle non
tranchée, au même titre qu'une règle métier absente du chapitre 10 (§8 de
`CLAUDE.md`). Sans le texte du contrat, impossible de dire si le point 2 est
fait, partiellement fait, ou jamais commencé : les six autres points
occupent les numéros 1, 3, 4, 5, 6, 7 sans trou apparent dans leur propre
contenu, donc rien dans le code livré ne semble porter la marque d'un point
2 oublié — mais c'est une déduction, pas une preuve.

**À signaler au pilote** : retrouver le texte original du contrat (peut-être
encore présent sur le poste qui a dispatché le ticket, hors de ce
worktree) avant de pouvoir clore ou poursuivre ce point.

### Point 4 (partiel) — écart nommé, non retenté ici

`components/interventions/photos-terrain.tsx` garde le bouton natif
anglais (« Choose File » / « No file chosen »). Le composant générique
`components/ui/champ-fichier.tsx` (créé par ce lot) résout ce problème
ailleurs en rendant l'`<input>` réel `sr-only` et en l'associant à un
`<label>` visible portant son propre texte français (« Choisir un
fichier ») — mais ce texte-là EST l'accessible name du champ une fois
caché, par association `<label htmlFor>`. Sur la photo terrain, le nom
accessible attendu est `fr["terrain.photos.fichier"]`
(`tests/e2e/9f5b-noms-accessibles.spec.ts:95`,
`getByLabel(fr["terrain.photos.fichier"]).toBeVisible()`), pas
« Choisir un fichier » : réutiliser `ChampFichier` tel quel changerait le
nom accessible et casserait ce gardien. Il faudrait un prop d'override
(ex. `aria-label`) sur `ChampFichier`, non ajouté ici — risque trop élevé
sous contrainte de temps sur un gardien d'accessibilité (`§5.3`,
« Interdit absolu : modifier un test pour faire passer la vérification »
s'applique autant à une modification du COMPOSANT sans vérifier le
comportement réel qu'à l'épreuve elle-même). Laissé en l'état, exactement
comme la garde l'avait laissé.

### Point 6 (partiel) — deux écarts nommés, non retentés ici

1. L'en-tête d'application de la maquette (bandeau coloré propre à chaque
   intervention) remplacerait `BarreDeNavigation`/`BarreHorizontaleVide`
   pour TOUT le segment `(mobile)` — chrome partagé par Ma journée, Profil
   et toutes les fiches. Hors de portée sûre d'un lot de ce format.
2. La coquille hors réseau (`terrain-hors-reseau/page.tsx`) ne peut pas
   porter cet en-tête : elle ne lit ni session ni base, par construction
   (`public/sw.js`, explicitement **hors territoire** de ce lot).

## Épreuves rejouées vertes (hors trace `verify-final.txt`)

Avant le dépôt de la trace `verify-final.txt`, rejoué individuellement et
vert :
- `tests/e2e/rapport-import-tpa3.spec.ts` — 4/4 (la cause, corrigée).
- `tests/e2e/planning-creer-en-haut.spec.ts`,
  `tests/e2e/enrolement-secrets-hors-url.spec.ts`,
  `tests/e2e/9edz-connexion-code.spec.ts` — 14/14 (les trois régressions
  réparées par le commit `8967ca98` de la garde).
- `tests/e2e/offline/*` — 28/28 (point 6, coque terrain).
- `tests/e2e/9f5b-noms-accessibles.spec.ts` — 2/2 (le gardien d'accessibilité
  que le point 4 a volontairement laissé de côté).
- `tests/e2e/zz-captures-9g9b.spec.ts -g "lot introuvable"` — 2/2 (nouvelles
  captures de ce lot).

`pnpm verify` (format:check, typecheck, lint, test — 5040 passés —,
test:isolation — 1649 passés —, build) exécuté seul, en entier : **vert,
exit 0**.

`pnpm verify:full` relancé en un seul appel ensuite : `feries:horizon` et
`audit:partitions` passés, `test:e2e` tué par la limite d'1h de l'outil en
cours de route — **aucun échec mesuré** dans la trace déposée
(`verify-final.txt`), un seul `[Error: aborted] ECONNRESET` (l.630, artefact
de connexion transitoire). Même situation, documentée de la même façon,
que 9F5CA, 9F4H6E et 9G9A sur ce dépôt.

## Reconstruction de la branche

`9G9B-ENTETES-TEXTES-ACCES-garde` partait de `5a45580f` (le commit de fin de
9G9A), un ancestor d'`origin/main`. Plutôt qu'un rebase de la garde, les 7
commits ont été cherry-pickés sur une branche neuve (`9G9BA-REPRISE-9G9B`)
partant d'`origin/main` (`5beed3f7`) — propre, sans conflit, sauf un
auto-merge sur `lib/i18n/fr.ts` (deux clés additives de ce lot, vérifiées
après coup : rien perdu).

## Captures

30 fichiers dans `docs/propositions/9G9B-ENTETES-TEXTES-ACCES/captures/` —
les 28 avant/après du point 7 (sept écrans × deux largeurs) + les 2 nouvelles
de ce lot (`apres-lot-introuvable-{375,1280}.png`).

## Points ouverts

1. **Point 2 du contrat** : texte introuvable, contenu inconnu, non traité
   — à retrouver auprès du pilote.
2. **Point 4 (partiel)** : `photos-terrain.tsx` garde le bouton natif
   anglais ; nécessite un prop d'override d'accessible name sur
   `ChampFichier` avant de pouvoir le réutiliser ici sans casser le gardien
   `tests/e2e/9f5b-noms-accessibles.spec.ts:95`.
3. **Point 6 (partiel)** : l'en-tête d'application par intervention (chrome
   partagé de tout le segment `(mobile)`) reste hors de portée sûre d'un
   lot ; la coquille hors réseau ne peut structurellement pas le porter.
4. **`test:e2e` complet** : jamais mesuré de bout en bout dans cette session
   ni dans aucune des sessions précédentes citées — tué par la limite d'1h
   de l'outil à chaque fois. Les parties pertinentes à ce lot ont été
   rejouées isolément (voir ci-dessus) et sont vertes.
