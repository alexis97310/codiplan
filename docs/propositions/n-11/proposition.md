# N-11 — La fiche machine à l'identique de la maquette (D125, D126)

Branche `claude/gallant-euler-o3qnge`, depuis `origin/main` à `eec0430` (qui vient
de recevoir N-10, #230).

## 0. Les deux décisions écrites avant le code

**D125** (déjà en place depuis N-10) fait foi sur la disposition, la
composition des blocs et leur ordre pour les quatorze écrans que
`codiplan-maquette-complete.html` dessine — `/parc/[id]` en fait partie.

**D126**, rendue par Alexis pendant ce ticket, est ajoutée à la suite de D125
dans `docs/arbitrages.md`, et une règle **RG-PAR-07** est ajoutée au chapitre
10 (`docs/cahier-des-charges.md`) — câblée dans les deux sens, gardée par
`tests/unit/docs/cablage-arbitrages.test.ts`. Elle dit : le bloc d'identité
d'une fiche machine s'ouvre sur **famille, marque, référence (modèle), numéro
de série, année de vente**, dans cet ordre, avant les six champs que la
maquette dessine (Client, Site client, Agence CODIMA, Mise en service,
Contrat, Prochaine VGP). D125 gouverne la forme (le `dl.kv` à deux colonnes),
D126 gouverne le contenu — les deux ne se contredisent pas.

## 1. Le tableau de mesure, bloc par bloc

Mesuré dans `machinePage()` de `docs/maquette/codiplan-maquette-complete.html`,
confronté à l'écran AVANT (capturé localement, voir §4) et APRÈS (cette
proposition).

| Bloc de la maquette | AVANT | APRÈS |
|---|---|---|
| En-tête : eyebrow, h1 « Fiche machine », sous-titre `<client> · <site>` | h1 = la **référence** (`Local-000002`), pas de sous-titre client/site | conforme — `t("machine.fiche.titre")`, `sousTitreFiche()` |
| 2 boutons d'en-tête (← Retour au parc, Modifier) | 1 lien « ‹ Retour au parc » seul | « ‹ Retour au parc » conforme ; « Modifier » — **écart nommé** (§3) |
| `.machine-page` (deux colonnes) | absent — une seule colonne, aucune carte QR | présent, repli à une colonne sous 1180 px (mesuré dans la maquette, pas supposé) |
| `.machine-banner` (symbole, référence, désignation, 2 pastilles) | absent | présent — désignation = `<marque> <référence modèle>` (D126), pastilles statut + famille |
| `.alert-strip` (si statut ≠ en service) | absent — le statut brut vivait dans le `dl.kv` (`en_panne`) | présent, conditionnel ; contexte composé de faits réels, jamais de phrase inventée |
| Carte « Identité et rattachement » (`dl.kv`, D126 : 11 faits) | 4 faits (N° de série, Client/lieu, Mise en service, Statut) | 11 faits, dans l'ordre D126 |
| Carte « Historique des interventions » (5 colonnes + bouton) | absente | présente — `historiqueDeLaMachine`, technicien résolu par `annuaireDesPersonnes`, bouton « + Intervention » vers `/interventions/nouvelle` (route réelle) |
| Carte QR (collante, SVG, 2 boutons) | absente | présente — voir §6 pour la bibliothèque |
| Carte « Documents » (L8-02) | présente | conservée — **écart nommé dans l'autre sens** (§3) |

## 2. Le gardien de composition — le compte avant/après

`tests/unit/machines/composition-fiche.test.ts`, sur le modèle exact de
`composition-parc.test.ts` (N-10), confronte onze marqueurs `data-bloc="…"` du
code source à onze preuves textuelles de `machinePage()`.

- **Avant la correction : 0/11 blocs rendus.** Le fichier a été écrit et
  exécuté contre le code AVANT toute correction, pour montrer ce rouge.
- **Après la correction : 11/11 blocs rendus.**

Deux des onze blocs (`carte-identite`, `carte-historique`, `identite-kv`)
partagent un composant commun (`CarteEnTete`, `Kv`) avec un `bloc` prop résolu
à l'exécution (`data-bloc={bloc}`) plutôt qu'un attribut JSX littéral : le
gardien a été adapté pour reconnaître les deux formes (`data-bloc="X"` ou
`bloc="X"` dans le texte source), documenté en tête du fichier de test.

## 3. Les écarts — liste close, chacun avec son motif

Portés par `lib/machines/ecarts-maquette.ts` (nouvelles sections, sans toucher
celles de `/parc`).

**Absents de l'écran, présents dans la maquette :**

| Bloc | Motif |
|---|---|
| Bouton « Modifier » | aucune route d'édition d'une machine n'existe ; `lib/machines/depot.ts` ne porte que la création (`creerMachineDans`, `creerMachinesEnLot`) |
| « Identifiant » dans le `dl.kv` | D126 — la référence interne reste affichée, mais dans la bannière (mono, grise), pas dans le `dl.kv`, où elle ferait doublon avec les cinq faits que D126 met en tête |

**Présents à l'écran, absents de la maquette :**

| Bloc | Motif |
|---|---|
| Carte « Documents » | porte L8-02, déjà livré ; `machinePage()` ne la dessine pas, et la retirer ferait disparaître le seul écran qui l'expose |

**Champ structurellement présent, valeur absente (pas un écart, un fait
mesuré) :** le champ « Contrat » du `dl.kv` reste, avec le signe d'absence
(`—`) — aucune table de contrat n'existe (lot 4), même motif que `/parc`.

## 4. Les trois défauts mesurés sur le site, réparés

1. **Numéro de série illisible affiché comme un vrai numéro** (`SN-INCONNU-
   PONT-2`) — `numeroDeSerieAffiche` applique la même règle que `/parc`
   (`machine.complet` → signe d'absence + pastille « À compléter »).
2. **Statut énuméré brut** (`en_service`, `en_panne`) — passe désormais par le
   dictionnaire (`statut_machine.*`) et une pastille, comme `/parc`.
3. **Commune répétant le libellé du site** (« Ducos, Ducos ») —
   `lieuAffiche` applique la même déduplication que `/parc`. **Non
   redémontré sur les données de démonstration** : aucun site du semis local
   ne porte une commune égale à son libellé (mesuré, `select … where commune
   = libelle` rend zéro ligne) — la fonction est l'exacte copie de celle déjà
   éprouvée sur `/parc`, pas une réécriture.

Les trois règles sont **recopiées** depuis `app/(back-office)/parc/page.tsx`,
jamais importées — `/parc` n'est pas retouché par ce ticket.

## 5. AVERTISSEMENT MESURÉ — `date_vente` est VIDE sur tout le jeu de données

Alexis avait raison de le redouter. Sur les seize lignes de machines du semis
local (`pnpm db:seed`, deux sociétés) :

```
date_vente | date_mise_en_service
-----------+----------------------
 (vide)    | 2021-03-18
 (vide)    | 2024-03-18
 (vide)    | 2026-01-18
 ...
 (vide)    | (vide, la fiche SN-INCONNU)
```

**`date_vente` est nulle sur les seize lignes, sans exception.** La fiche
machine s'en tient à la règle demandée : elle affiche le signe d'absence
(`—`) pour « Année de vente », **jamais** la date de mise en service à sa
place, jamais une année inventée — voir les captures `fiche-en-service-
apres.png` et `fiche-en-panne-apres.png`, colonne de gauche, deuxième ligne
du bloc d'identité.

**Le défaut n'est pas dans le code.** `lib/imports/modeles.ts` (ligne 1117)
lit déjà `date_vente` à l'import, et D56 la fait voyager avec
`facture_origine` et `garantie_fin`. Si la colonne est vide en production
comme dans ce semis, c'est que **le fichier source ne la porte pas** — une
information qu'Alexis devra faire remonter du fichier d'import, pas une
correction de ce ticket.

## 6. Le QR — la bibliothèque retenue, et pourquoi

Trois candidates mesurées (`npm view <paquet> dependencies version`) :

| Paquet | Dépendances transitives | Dernière publication | Types TypeScript |
|---|---|---|---|
| `qrcode` | 3 (`dijkstrajs`, `pngjs`, `yargs`) | — | via `@types` |
| `qrcode-svg` | 0 | 2022-06-25 (3 ans) | via `@types/qrcode-svg`, communautaire |
| **`qrcode-generator`** (retenue) | **0** | **2025-08-07** | **livrés par le paquet** |

`qrcode` est écartée d'emblée (la contrainte du ticket est explicite : sans
dépendance transitive). Entre les deux paquets à zéro dépendance,
`qrcode-generator` est retenue : maintenue activement, et ses propres `.d.ts`
plutôt qu'un paquet `@types` tiers.

Le rendu (`components/ui/qr-code.tsx`) n'utilise **pas** `createSvgTag()` (la
méthode de commodité de la bibliothèque, qui renvoie une chaîne à injecter par
`dangerouslySetInnerHTML`) : il lit `getModuleCount()`/`isDark()` et compose
un `<svg>` en JSX ordinaire, sans chaîne de confiance nécessaire. Les deux
couleurs (`#07111f` sur blanc, mesurées sur `drawQr()` de la maquette) vivent
dans `lib/theme/qr.ts` — la même raison que `lib/theme/statuts.ts` s'accorde
déjà un littéral : un contraste de lecteur de code-barres n'est pas un choix
d'apparence, encore moins une charte de société. `qr_token` entre dans
`CHAMPS_FICHE`, jamais dans `CHAMPS_PARC` (D71) — vérifié par lecture directe
de `lib/machines/depot.ts`, pas par un gardien dédié (les deux constantes sont
à quelques lignes l'une de l'autre dans le même fichier).

Les deux gestes du navigateur (copier l'ID, imprimer) vivent dans **un seul
petit composant client** (`components/machines/actions-qr.tsx`), jamais un
`"use client"` sur la page.

## 7. Note honnête — la vue d'impression

`app/globals.css` porte une règle `@media print` qui isole la carte QR (même
effet que le bouton `print-qr` de la maquette, sans son mécanisme de classe
JS globale). **Mesuré en cours de route : la première forme
(`body:has(.zone-impression-qr) *`) laissait un bouton profondément imbriqué
(celui de la carte « Historique ») visible malgré une règle qui le déclarait
`hidden`** — un recalcul de style propre à `:has()` combiné à un second
sélecteur relationnel de la page (`Button` porte déjà `has-[>svg]:`). La règle
a été durcie (`!important` sur la seule déclaration qui masque, exclusion
explicite de la carte QR). **Cette correction n'a pas été re-capturée après
coup** — le budget de session a été redirigé vers le commit/push et cette
proposition sur consigne explicite du pilote. À vérifier visuellement avant
fusion (`Ctrl+P` sur `/parc/[id]` doit ne montrer que la carte QR).

## 8. Les captures

Dans ce dossier, 1280 px :

- `fiche-en-service-avant.png` / `fiche-en-service-apres.png` — machine
  `SN-INCONNU-PONT-2` (bug n°1 démontré avant/après).
- `fiche-en-panne-avant.png` / `fiche-en-panne-apres.png` — machine en panne,
  bandeau d'alerte (bug n°2 démontré ; aucune intervention rattachée dans le
  semis, donc bandeau sans bouton — comportement voulu, §0 de N-11).
- `carte-qr-seule.png` — la carte QR isolée.

**Prises localement** : aucun déploiement de prévisualisation n'existe depuis
#229 (Vercel ne construit que `main`). Harnais : PostgreSQL 16 local, migré et
semé par le chemin de production (`prisma migrate deploy` + `pnpm db:seed`),
servi sous le rôle applicatif `codiplan_app` — jamais le propriétaire. Compte
de démonstration ouvert par le chemin réel de premier accès
(`tests/e2e/setup/scene.ts`, `adv@codima.test`).

**Non capturée : une machine en panne AVEC une intervention ouverte
rattachée** (bouton « Voir l'intervention » du bandeau). Mesuré : aucune ligne
du semis ne lie une machine hors service à une intervention
(`intervention_machine`) — c'est un manque du jeu de démonstration, pas du
code. La branche est couverte par lecture du code (`estFige`, déjà éprouvée
ailleurs) mais pas par une capture ni un scénario de bout en bout dédié.

## 9. `pnpm verify:full` — le compte

| Étape | Résultat |
|---|---|
| `format:check` | vert (2 fichiers reformatés par Prettier avant la mesure finale) |
| `typecheck` | vert |
| `lint` | vert, zéro avertissement |
| `test` (unitaire) | **2172/2172** verts |
| `test:isolation` | **1030/1030** verts |
| `build` | vert |
| `test:e2e` | **48/48** verts (suite complète, dont les 3 scénarios de `tests/e2e/fiche-machine.spec.ts`) |
| `feries:horizon` | vert — NC et FR, horizon ≥ 12 mois |
| `audit:partitions` | vert — préventif et détectif |

Chaque étape a été jouée séparément (comme N-10 le documente déjà) : la base
de `test:isolation`, celle de `test:e2e` et celle des scripts d'exploitation
(`feries:horizon`, `audit:partitions`, qui exigent le rôle PROPRIÉTAIRE,
jamais `codiplan_app`) sont trois cibles locales jetables distinctes dans cet
environnement. **La vérification du §7 (impression) n'est pas comprise dans
ce compte.**

## 10. Ce qui reste ouvert

- La vue d'impression (§7) mérite une vérification visuelle avant fusion.
- Le bouton « Voir l'intervention » du bandeau d'alerte n'a pas de capture ni
  de scénario de bout en bout dédié, faute de donnée de démonstration qui
  lie une machine hors service à une intervention ouverte (§8).
- `date_vente` est vide dans tout le jeu de données mesuré (§5) — à faire
  remonter côté import, pas côté code.
- `/parc` n'est pas retouché (une proposition à la fois, comme demandé).
- Aucun menu mobile, aucun ☰, aucun tiroir — hors périmètre de ce ticket.
