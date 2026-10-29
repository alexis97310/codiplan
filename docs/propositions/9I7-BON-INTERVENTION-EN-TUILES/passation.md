# 9I7-BON-INTERVENTION-EN-TUILES — passation

## 1. Inventaire mesuré (AVANT, commit `5032af9ee` = `origin/main` au début du lot)

| Fichier | Lignes | Rôle |
|---|---|---|
| `app/(back-office)/interventions/[id]/bon/page.tsx` | 556 | L'écran — une seule `<Carte>` portant TOUT le bon : en-tête (logo, raison sociale, « Bon d'intervention », statut), un `<dl>` unique (date, type, client, site, adresse, agence, machine, panne, contact, référence), puis des `<section>` successives (temps passé, valorisation si interne, prestations, commentaire, suite à donner, photos, signature), et enfin les mentions légales **sans retour à la ligne** (pas de `whitespace-pre-wrap` — bug mesuré, corrigé ci-dessous). |
| `lib/interventions/bon.ts` | 362 | `lireBonIntervention` — assemble `BonIntervention` depuis `intervention`, `segment_travail`, `prestationsRealisees`, `photosDeLIntervention`, `derniereSignature`. Non touché par ce lot (mise en forme seulement, territoire). |
| `components/interventions/actions-bon.tsx` | 37 | Le bouton « Imprimer le bon » — pose `print-bon` sur `<body>`, appelle `window.print()`. Inchangé. |
| `app/globals.css` (bloc `print-bon`) | ~35 | `@page { size: A4; margin: 15mm }`, isolation `body.print-bon .zone-impression-bon`, `break-inside: avoid` sur `section, header, dl`. Inchangé — la règle `section` couvre déjà chaque tuile neuve, qui est elle-même une `<section>` (`Carte`). |

**Ce qui sortait déjà à l'impression** (avant ce lot) : tout, via `print:hidden` posé individuellement sur chaque section vide — doctrine « l'absence se nomme, jamais un bloc muet » déjà en place et conservée telle quelle.

**Ordre AVANT** (fixe, quel que soit le type) : en-tête → dl (date/type/client/site/adresse/agence/machine/panne/contact/référence) → temps passé → valorisation (si interne) → prestations → commentaire → suite à donner → photos → signature → mentions légales.

## 2. Ce qui a changé

### Les sept tuiles (demande verbatim du 28/10/2026)

`app/(back-office)/interventions/[id]/bon/page.tsx` : chaque partie dans sa propre `<Carte>` (même gabarit que 9I6 — mêmes clés i18n de titre, `intervention.client`, `intervention.machine`, `intervention.titre`, `intervention.commentaires_photos.titre`, partagées avec la fiche), empilées en **une seule colonne** (`flex flex-col gap-4`, jamais la grille deux colonnes de la fiche — ce bon reste un document A4 portrait). Dans l'ordre de base : **Client** (raison sociale, site, adresse, contact), **Matériel** (titre « Machine », mot imposé — § 8, D172, même écart déjà signalé par 9I6), **Intervention** (date, nature, agence, panne signalée, référence client, **et** le temps passé sur site — tableau des segments — regroupé ici, demande explicite « type, dates, technicien, temps »), **Commentaires et photos** (fusion des deux anciennes sections, même gabarit que 9I6), **Prestations réalisées**, **Suite à donner**, **Signataire**. La **Valorisation** (montants, rôle interne) reste un bloc à part, hors des sept tuiles nommées par Alexis, toujours juste après « Intervention » quelle que soit la nature — jamais réordonnée par `profilDuBon`.

Chaque tuile conserve EXACTEMENT sa règle de visibilité à l'impression d'avant ce lot (`print:hidden` si vide) ; la tuile « Commentaires et photos » fusionnée se masque entièrement à l'impression seulement si LES DEUX (commentaire et photos) sont vides, et masque chaque moitié indépendamment sinon.

### `lib/interventions/profil-bon.ts` (neuf, point 2 bis — demande du 29/10/2026 ~20:50)

`profilDuBon(type: TypeIntervention)` — fonction pure, aucune base, aucun montant :
- **`titreDocument`** : `« Bon d'intervention — <nature> »`, composé des DEUX clés déjà existantes (`intervention.bon.titre`, `type_intervention.*`), jamais un libellé inventé. Remplace l'ancien titre générique en en-tête ET dans l'onglet (`generateMetadata`).
- **`ordreTuiles`** : pour `preventif_contrat`, `preventif_hors_contrat`, `controle_reglementaire` — **Prestations** avancée juste après **Matériel**. Pour les six autres natures (`curatif`, `installation`, `garantie`, `expertise`, `reprise`, `recensement`) — l'ordre de base, **Commentaires et photos** juste après **Intervention**.
- Exhaustivité : un `Record<TypeIntervention, ...>` — une nature de `TYPES_INTERVENTION` ajoutée sans entrée dans ce `Record` fait échouer `pnpm typecheck`, jamais en silence. `tests/unit/interventions/profil-bon.test.ts` reparcourt en plus, au RUNTIME, les neuf valeurs actuelles.
- **Emplacements réservés** (checklist préventive, pièces remplacées curatif) : les données **n'existent pas encore** en base (chapitre 10 et 11 muets) — `EMPLACEMENT_CHECKLIST_PREVENTIVE` et `EMPLACEMENT_PIECES_REMPLACEES_CURATIF`, deux constantes documentaires dans `profil-bon.ts`, nomment où elles s'inséreront (ticket 9J16 pour la checklist ; « à venir » pour les pièces) — **aucune tuile, vide ou non, n'est rendue** pour l'une ou l'autre.

### Logo et mentions légales (point 2 bis)

- **Logo** : déjà affiché (9EZ-LOGO-SOCIETE-1), conservé en en-tête, hauteur écran inchangée (`max-h-12`, 48 px) ; AJOUTÉ : `print:max-h-[15mm] print:w-auto` — plafonné à l'impression, mesuré sur les captures. Sans logo : toujours aucun cadre vide (inchangé).
- **Mentions légales** : déjà affichées en pied (9EZ-LOGO-SOCIETE-4), déplacées en pied du **document entier** (hors des tuiles, sous toutes) ; **correctif** : `whitespace-pre-wrap` AJOUTÉ — absent avant ce lot, les retours à la ligne saisis par l'administrateur société s'écrasaient en un seul paragraphe (visible sur la capture AVANT). **Un seul écart assumé, nommé ici** : aucun mécanisme CSS fiable (Chromium, impression sans JS) ne répète un pied sur CHAQUE page — les mentions légales n'apparaissent qu'en bas du document, pas de chaque page physique si le bon déborde sur plusieurs feuilles. Signalé plutôt que contourné par un hack non éprouvé.

### FACTURE-1 (audit, point 3)

Hors territoire : l'identifiant technique « FACTURE-1 » cité dans l'audit vit dans `app/(back-office)/interventions/a-facturer/page.tsx` et `components/interventions/onglets-registre.tsx` — deux écrans BACK-OFFICE (rôles qui facturent), jamais le bon remis au client. Ni l'un ni l'autre n'est dans le territoire de ce ticket (`app/(back-office)/interventions/[id]/bon/**`) : non touché, signalé ici plutôt que silencieusement ignoré.

## 3. Épreuves

- `tests/unit/interventions/profil-bon.test.ts` — les neuf natures portent un profil avec les sept tuiles, jamais une en double ; le titre compose exactement les deux clés ; les trois préventifs avancent Prestations, les six autres gardent Commentaires juste après Intervention.
- `tests/e2e/9i7-bon-en-tuiles.spec.ts` — un bon curatif ET un bon préventif, posés sur le site déjà semé par `bon-intervention.spec.ts` (jamais sa propre ligne) : l'ordre RENDU (titres de `<h2>` dans `.zone-impression-bon`) correspond au verdict de `profilDuBon` ; le titre du document porte la nature ; une épreuve pose `body.print-bon` directement (sans ouvrir la boîte de dialogue native de `window.print()`) et lit, sous `@media print` réel, `getComputedStyle(section).breakInside === "avoid"` sur CHAQUE tuile et l'absence de débordement horizontal (`scrollWidth <= clientWidth`).
- `tests/e2e/captures-9i7-bon-en-tuiles.spec.ts` — capture only, pose un logo et des mentions légales (jamais dans le semis), les retire en `afterAll`.
- **Épreuves existantes rejouées sans modification** : `tests/e2e/bon-intervention.spec.ts`, `bon-3.spec.ts`, `bon-4.spec.ts`, `bon-5.spec.ts` — 12/12 vertes (voir `verify-final.txt`), preuve que la restructuration en tuiles ne casse aucun comportement déjà prouvé (versions client/interne, segments, signature, impression des sections vides).

## 4. Captures (`docs/propositions/9I7-BON-INTERVENTION-EN-TUILES/captures/`)

AVANT capturé sur `5032af9ee` (`origin/main` au début du lot), via un *worktree* jetable (`/tmp/9i7-avant`, retiré) et une épreuve non commitée — même recette que les lots précédents (mémoire de session).

| Fichier | Taille | Contenu |
|---|---:|---|
| `bon-curatif-avant-375-viewport.png` | 61 Ko | AVANT, 375 px, fenêtre |
| `bon-curatif-avant-375-plein.png` | 68 Ko | AVANT, 375 px, page entière |
| `bon-curatif-avant-1280-viewport.png` | 106 Ko | AVANT, 1280 px, fenêtre |
| `bon-curatif-avant-1280-plein.png` | 106 Ko | AVANT, 1280 px, page entière |
| `bon-curatif-avant-impression.png` | 44 Ko | AVANT, rendu impression isolé |
| `bon-curatif-apres-375-viewport.png` | 48 Ko | APRÈS, 375 px, fenêtre |
| `bon-curatif-apres-375-plein.png` | 81 Ko | APRÈS, 375 px, page entière |
| `bon-curatif-apres-1280-viewport.png` | 103 Ko | APRÈS, 1280 px, fenêtre |
| `bon-curatif-apres-1280-plein.png` | 121 Ko | APRÈS, 1280 px, page entière |
| `bon-curatif-apres-impression.png` | 55 Ko | APRÈS, rendu impression isolé |
| `bon-curatif-apres-impression.pdf` | 105 Ko | APRÈS, PDF A4 réel |
| `bon-preventif-apres-1280-viewport.png` | 105 Ko | APRÈS préventif, 1280 px, fenêtre — Prestations avancée |
| `bon-preventif-apres-1280-plein.png` | 122 Ko | APRÈS préventif, 1280 px, page entière |
| `bon-preventif-apres-impression.png` | 56 Ko | APRÈS préventif, rendu impression isolé |
| `bon-preventif-apres-impression.pdf` | 105 Ko | APRÈS préventif, PDF A4 réel |

Pas de « avant préventif » : l'ancien code rend la MÊME disposition quelle que soit la nature (aucune notion de profil) — un second « avant » n'aurait rien montré de plus que `bon-curatif-avant-*`.

## 5. Points ouverts / écarts assumés

1. **Mentions légales non répétées à chaque page imprimée** — voir § 2 ci-dessus. Pas de mécanisme CSS fiable sans JS ; accepté, nommé.
2. **Checklist préventive et pièces remplacées curatif** — hors de ce lot (données absentes), emplacements réservés nommés dans `profil-bon.ts` (tickets 9J16 et à venir).
3. **FACTURE-1** — hors territoire, voir § 2.

## 6. Vérification

`CI=1 pnpm verify:full` lancé en entier, trace dans `verify-final.txt`.
