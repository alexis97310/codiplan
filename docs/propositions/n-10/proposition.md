# N-10 — `/parc` à l'identique de la maquette : un maître-détail, pas un tableau

Branche `claude/busy-brahmagupta-0j0rny`, depuis `main` à `5f7e224`, puis fusionnée
avec `f9e67d2` (#229 — réglage Vercel, sans conflit : #229 ne touche que
`docs/captures/`).

## 0. D125 — la décision écrite avant le code

`docs/arbitrages.md` porte désormais **D125** : `codiplan-maquette-complete.html`
fait foi sur la disposition des quatorze écrans qu'elle dessine — le même
principe que D124 applique déjà aux jetons de couleur. Elle rend caducs, sur ce
point précis, le paragraphe « Parc machines n'est pas converti » de D123 et la
borne de D122 sur la disposition. `CLAUDE.md` a été corrigé au même endroit.
`tests/unit/docs/maquette-unique.test.ts` reste vrai : il garde l'unicité de
`CODIPLAN_Maquette.html`, question que D125 ne touche pas.

## 1. Le tableau de mesure, bloc par bloc

Mesuré dans `docs/maquette/codiplan-maquette-complete.html` (fonctions `parc()`,
`machineRow()`, `machinePreview()`), confronté à l'écran AVANT (production,
mesurée par Alexis sur `codiplan.vercel.app/parc`, confirmée sur ma propre
capture locale) et APRÈS (cette proposition, capturée localement — voir §4).

| Bloc de la maquette | AVANT | APRÈS |
|---|---|---|
| Eyebrow « Clients & parc » | présent | présent (inchangé, `Page`) |
| H1 « Parc machines » | **« Parc machines clients »** — écart | **« Parc machines »** — conforme |
| Sous-titre (recherche sur l'identifiant…) | texte différent, mentionnait « site » | texte de la maquette, mot pour mot |
| 2 boutons d'en-tête (Scanner QR, + Machine) | absents ; un décompte texte à la place | absents — **écarts nommés**, R2-13 (voir §5) |
| Barre d'outils sur une ligne | champ + bouton « Rechercher » seuls | champ + `<select>` statut (neuf) + « Rechercher » + « Réinitialiser » (neuf) |
| 3 KPI, libellés de la maquette | « Machines actives » / « Garantie expirant < 90 j » / « En panne / arrêtées » | « Machines affichées » / « Garanties < 90 jours » / « En panne ou arrêtées » — conformes |
| KPI 1, détail « sur N machines au total » | absent (le total était dans l'en-tête) | présent, complété par les fiches à compléter |
| Maître-détail (liste + aperçu) | **absent — un `<table>` à 6 colonnes** | présent : `CarteListe` + `DetailHero`/`DetailBody` |
| Ligne de la liste : désignation, référence · client, badge statut | ligne de tableau (6 `<td>`) | `RangeeMaitreDetail`, liseré + fond au survol/à la sélection |
| Aperçu : hero (symbole, référence, désignation, badge, « Fiche complète ») | absent | présent |
| Aperçu : `dl.kv` (Client, Site, N° de série, Famille, Agence CODIMA, Contrat) | absent (les 4 premiers étaient des colonnes de tableau) | présent, 6 entrées — Agence CODIMA lue depuis `site.agence` (fait réel, D56) |
| Aperçu : « Derniers événements » (frise) | absent | présent, `historiqueDeLaMachine`, 3 dernières interventions, état vide si aucune |
| État vide (`.card.empty`) | une ligne de texte dans le tableau | carte dédiée, titre + détail + bouton « Réinitialiser » |
| Repli à une colonne sous 900px | non applicable (tableau) | appliqué, `min-[901px]:grid-cols-…`, éprouvé par `tests/e2e/parc.spec.ts` |
| Pagination | présente (AT-07) | présente — **écart nommé dans l'autre sens** |
| Lien vers le registre des VGP | présent (AT-04) | présent — **écart nommé dans l'autre sens** |

## 2. Le gardien de composition — le compte avant/après

`tests/unit/machines/composition-parc.test.ts` confronte treize marqueurs
`data-bloc="…"` du code source aux treize preuves textuelles correspondantes
dans `parc()`/`machinePreview()` de la maquette.

- **Avant la correction : 0/13 blocs rendus.** Aucun marqueur n'existait — le
  fichier `page.tsx` d'alors ne portait ni `toolbar`, ni `master-detail`, ni
  `detail-hero`, etc. (le gardien a été volontairement écrit et exécuté sur le
  code d'avant, pour montrer ce rouge, avant d'écrire une seule ligne de
  correction).
- **Après la correction : 13/13 blocs rendus.**

## 3. Les écarts — liste close, chacun avec son motif

Portés par `lib/machines/ecarts-maquette.ts`, confrontés par
`tests/unit/machines/ecarts-maquette.test.ts` (les deux sens gardés).

**Absents de l'écran, présents dans la maquette :**

| Bloc | Motif |
|---|---|
| Bouton « Scanner un QR code » | aucun écran de lecture de QR n'existe (N-11) ; `lib/machines/qr.ts` ne fabrique que le jeton, aucun encodeur d'image QR n'est dans le dépôt |
| Bouton « + Machine » | aucun `app/(back-office)/parc/nouvelle` n'existe, là où `clients/nouveau` et `sites/nouveau` existent |
| Champ « Contrat » du `dl.kv` | lot 4 — aucune table de contrat de maintenance n'existe ; l'entrée **reste** dans le `dl.kv`, avec le signe d'absence (`—`) |

**Présents à l'écran, absents de la maquette :**

| Bloc | Motif |
|---|---|
| Pagination | la maquette montre 4 machines sans pagination ; le parc réel en compte plusieurs centaines (AT-07) |
| Lien « Registre des vérifications périodiques » | seul appelant de `/vgp` depuis cet écran (AT-04) |

**Un point tranché, pas un écart** : le bandeau « aucune fiche n'a encore de
numéro serveur » qui vivait dans l'ancien écran (16/09) n'a pas de bloc
correspondant dans `parc()` et n'est pas dans la liste des écarts autorisés du
ticket (§4) — il est retiré plutôt que reconduit sans base. La clé de
dictionnaire `parc.aucune_synchronisee` correspondante a été supprimée avec.

## 4. Les captures

Dans ce dossier, 1280 px et 390 px, trois états :

- `avant-{1280,390}-liste.png` — l'écran avant correction (tableau).
- `apres-{1280,390}-liste.png` — la liste remplie.
- `apres-{1280,390}-selection.png` — une ligne sélectionnée (GA-11, en panne),
  liseré bleu visible, panneau de droite à jour.
- `apres-{1280,390}-vide.png` — une recherche sans résultat.

**Prises localement**, pas sur un déploiement de prévisualisation : la
proposition #229, fusionnée pendant cette session, a désactivé tout
déploiement Vercel hors de `main` — il n'existe donc plus de preview à ouvrir
avant fusion. Le harnais utilisé est un PostgreSQL 16 local, migré et semé par
`pnpm db:seed` (I9 : aucune donnée réelle), servi par `pnpm dev` sous le rôle
applicatif `codiplan_app` — jamais le propriétaire, pour que le cloisonnement
soit réellement exercé pendant la capture. Un compte de démonstration
(`adv@codima.test`, rôle ADV, société CODIMA-NC) a été ouvert par le chemin de
premier accès réel (`lib/auth/amorcage.ts`, `lib/auth/premier-acces.ts`),
jamais par un cookie fabriqué.

À 390 px, la colonne latérale de navigation ne se replie pas (le ☰) : c'est un
chantier hors de ce ticket (§6), et il pèse identiquement sur l'avant et
l'après — les deux captures 390 px le montrent.

## 5. Ce qui a été construit

- `components/ui/maitre-detail.tsx` — `MaitreDetail`, `CarteListe`,
  `RangeeMaitreDetail`, `DetailHero`, `DetailBody`, `Kv`/`KvLigne`,
  `Timeline`/`TimelineItem`, `CarteVide` : le vocabulaire du maître-détail,
  mesuré sur `codiplan-maquette-complete.html`. Les deux seules couleurs non
  tokenisées de la maquette (fond de ligne sélectionnée `#f2f8fd`, liseré
  `var(--blue)`) reprennent des jetons déjà posés (`--app-bleu-fond`,
  `--app-marque`) plutôt que d'en ajouter un neuvième — D124 ne bouge pas.
- `app/(back-office)/parc/page.tsx` — réécrit. La sélection vit dans l'URL
  (`?machine=<id>`), rendue côté serveur, sans `"use client"`. Le premier KPI
  compte le périmètre filtré (le même nombre que la pagination), jamais la
  seule page — la divergence que le directeur d'exploitation avait nommée le
  16/09 pour un autre chiffre.
- `lib/machines/saisie.ts`, `lib/machines/depot.ts` — un filtre de statut
  (`<select>`, 4 options, celles de la maquette) et `site.agence.libelle`
  ajouté au select existant (un fait réel, D56 — pas un écart).
- `lib/machines/ecarts-maquette.ts` et son test — réécrits pour le
  maître-détail (voir §3), l'ancienne liste de colonnes de tableau retirée.
- `tests/unit/machines/composition-parc.test.ts` — le gardien de composition
  (§2).
- `tests/unit/ui/composants-maquette.test.ts` — étendu : proportions du
  maître-détail, hauteur de défilement de la liste, liseré de la ligne
  sélectionnée, mesures du hero/kv/timeline/état vide, toutes lues dans
  `codiplan-maquette-complete.html` au moment du test.
- `tests/e2e/parc.spec.ts` — trois scénarios : repli à une colonne sous
  900 px, sélection qui change le panneau ET l'URL (et survit au
  rechargement), recherche sans résultat + réinitialisation.
- `tests/e2e/ecrans-largeur-utile.spec.ts` — le scénario « le parc machines
  rend des lignes » réorienté vers `.machine-row` (il rougissait sur
  `<table>`/`<tr>`, qui n'existent plus).

## 6. `pnpm verify` — le compte

| Étape | Résultat |
|---|---|
| `format:check` | vert (6 fichiers reformatés par Prettier avant la mesure finale) |
| `typecheck` | vert |
| `lint` | vert, zéro avertissement |
| `test` (unitaire) | **2158/2158** verts |
| `test:isolation` | **1030/1030** verts |
| `build` | vert, `/parc` compile |
| `test:e2e` | **45/45** verts (suite complète, y compris les 3 scénarios de `parc.spec.ts` et le scénario réorienté de `ecrans-largeur-utile.spec.ts`) |
| `feries:horizon` | vert — NC et FR, horizon ≥ 12 mois |
| `audit:partitions` | vert — préventif et détectif |

`pnpm verify:full` n'a pas été joué comme une seule commande (la base de
`test:isolation` et celle de `test:e2e` sont deux clusters jetables
distincts dans cet environnement) ; chaque étape qu'il enchaîne a été jouée
séparément, dans le même ordre, sur les bases jetables qu'elle exige.

## 7. Ce qui reste ouvert

- **`/parc/[id]`** (N-11) n'est pas touché — une proposition à la fois, comme
  demandé (§6 du ticket).
- Le repli responsive global (☰) n'est pas construit ici (§6 du ticket).
- Une fois cette proposition fusionnée dans `main`, un déploiement Vercel
  redeviendra possible et permettra une vérification en ligne — ce que #229 a
  rendu impossible avant fusion pour toute branche non-`main`.
