# 9L45-EPREUVES-CAPTURES-9I8C-9I8F1 — passation

Démarré le 26/11/2026 à 18:30 (Nouméa), budget 120 min. Terminé à 19:05 (35 min utilisées).

## Point 1 — ce qui manquait, mesuré

### 9I8F1-REPRISE-9I8F (passation, « Ce que je n'ai PAS fait »)

- **Aucune épreuve e2e** pour « machine sortie du parc choisie dans le volet nouvelle
  demande → aucun champ, état en lecture ». La fixture `9I8F-` de
  `tests/e2e/9i8f-statut-machine-modifiable.spec.ts` existait déjà, réutilisable, mais
  aucun cas ne la mettait en statut `remplacee`.
- **Aucune capture** du point 4/5 — ni pour ce lot ni pour aucun autre : mesuré,
  `tests/e2e/captures-9i8f-statut-machine-modifiable.spec.ts` existe et couvre déjà le
  champ « État de la machine » (une machine active), donc **rien à refaire côté
  captures pour 9I8F1** — seul le scénario « machine sortie » en manquait, et il ne
  porte pas de champ à capturer (c'est précisément ce qu'il prouve : aucun `<select>`).
- **Aucune épreuve `deposerDemande`/`creerIntervention` de bout en bout** sur une
  machine sortie du parc : seule `resoudreEtatMachineDuFormulaire`, appelée
  directement, était éprouvée contre la vraie base
  (`tests/isolation/9i8f1-reprise-9i8f-garde-creation.test.ts`). Le risque résiduel
  nommé dans la passation — le CÂBLAGE, pas la décision — n'avait jamais été confronté
  à une vraie écriture de demande ou d'intervention.

### 9I8C-INFOS-MACHINE-FICHE-ET-BON (passation, « Ce qui N'EST PAS livré »)

- **Point 6 — captures : rien n'existait.** Aucun fichier `docs/propositions/
  9I8C-INFOS-MACHINE-FICHE-ET-BON/captures/`, aucun spec e2e dédié. Mesuré par
  recherche dans `tests/` et `docs/propositions/` : aucun autre lot livré depuis (9L39,
  9L40…) n'a comblé ce trou — 9L40-IMPORT-EXCEL-ANNEE-FABRICATION touche la même colonne
  mais pour l'import Excel, jamais pour ces captures.
- Les épreuves unitaires et isolation des points 1 à 5 de 9I8C, elles, étaient déjà
  complètes (`tests/unit/machines/saisie.test.ts`, `tests/unit/machines/
  presentation.test.ts`, `bon-3.test.ts`) — rien à y ajouter.

## Point 2 — 9I8F1 : le cas e2e et l'épreuve de bout en bout

- **`tests/e2e/9i8f-statut-machine-modifiable.spec.ts`** — nouveau cas : la machine de
  la fixture `9I8F-` est posée `remplacee` par une écriture directe, puis le volet
  « nouvelle demande » est ouvert et la machine choisie ; le test affirme l'absence du
  `<select name="etat_machine">` et la présence de son état en lecture
  (`statut_machine.remplacee`). Joué seul : vert.
- **`tests/isolation/9l45-deposer-demande-creer-intervention-machine-sortie.test.ts`**
  (nouveau) — `deposerDemande` ET `creerIntervention`, appelés TELS QUELS (jamais une
  variante), avec une machine JETABLE posée `remplacee` à la création (sur
  SITE_A1_S1/CLIENT_A1, jamais `MACHINE_A1` partagée) et un `etat_machine: "en_service"`
  forgé dans la saisie. Les deux preuves : la demande/l'intervention est créée
  (`accepte: true` — la garde ne doit refuser que la capacité/le périmètre, jamais toute
  la création pour ce cas), et la machine reste `remplacee` en base — aucune
  réactivation silencieuse. Joué seul : vert (2 tests).

Ferme le risque résiduel nommé dans la passation de 9I8F1 : le câblage de
`lib/demandes/depot.ts` et `lib/interventions/depot.ts` est maintenant confronté à une
vraie écriture, pas seulement relu à la main.

## Point 3 — 9I8C : les captures manquantes

**`tests/e2e/captures-9i8c-infos-machine-fiche-et-bon.spec.ts`** (nouveau) — sa propre
scène (préfixe `918cfeed-`, jamais une fixture partagée), deux machines pour les deux
états de garantie (décision d'Alexis du 31/10, reprise dans la passation 9I8C) :

- une machine **hors garantie** (année de fabrication 1998, date de vente et de mise en
  service renseignées, garantie expirée en 2015) — rattachée à une intervention qui
  traverse la chaîne `planifiee → affectee → en_cours → terminee → cloturee` (D8) AVANT
  d'être close, pour que l'attache à `intervention_machine` ait lieu avant le gel de
  9L14-FIGE-A-LA-CLOTURE (une intervention déjà `cloturee` refuse tout `INSERT` sur
  `intervention_machine` — buté une première fois, corrigé en posant la machine pendant
  que l'intervention est encore vivante) ;
- une machine **sous garantie** (année 2024, garantie 2099), pour sa seule fiche.

Onze captures, 11/11 vertes, versées dans `docs/propositions/
9L45-EPREUVES-CAPTURES-9I8C-9I8F1/captures/` :

| Écran | Rôle | Largeurs |
|---|---|---|
| Fiche machine (bureau), hors garantie | `adv` | 1280, 375 |
| Fiche machine (bureau), sous garantie | `adv` | 1280, 375 |
| Fiche intervention (bureau), tuile Machine détaillée | `adv` | 1280, 375 |
| Bon d'intervention, version **interne** | `adv` | 1280, 375 |
| Bon d'intervention, version **client** (portail) | compte portail invité | 1280, 375 |
| Fiche terrain, année de fabrication + garantie, lecture seule | technicien | 375 |

**Aucun AVANT** : le code de 9I8C n'a pas changé depuis sa livraison (31/10/2026) — ce
lot prend les captures qui manquaient, jamais une comparaison avant/après.

**Un gardien a mordu, corrigé** : `tests/unit/i18n/sans-chaine-visible-en-dur.test.ts`
refusait les deux numéros de série écrits en dur dans deux `getByText(...)` du nouveau
spec — un texte interrogé à l'écran compte comme une chaîne visible (§5 point 5, même
discipline que `9i8f.e2e.numero_serie`). Deux clés ajoutées à `lib/i18n/fr.ts` :
`9i8c.e2e.numero_serie_hors_garantie`, `9i8c.e2e.numero_serie_sous_garantie`.

## Point 4 — aucun code produit modifié

Confirmé par `git status` : les seuls fichiers touchés hors `tests/` et `docs/` sont
`lib/i18n/fr.ts` (deux clés de dictionnaire pour des données d'épreuve, pas une règle
métier) et `lib/feuille-de-route/contenu.ts` (contenu de la page, pas du code produit,
explicitement hors dictionnaire par sa propre note de tête). Aucun défaut réel n'a été
découvert pendant ce lot — rien à marquer `test.fixme`.

## Point 5 — feuille de route

`lib/feuille-de-route/contenu.ts` : la ligne « Épreuves et captures manquantes sur 9I8C
et 9I8F1 » (section « Réserves des revues, à regrouper ») retirée de là et reposée,
`statut: "livre"`, en tête de la section « Livré depuis le 31/10 », avec la référence
9L45.

## Registre

**Aucune entrée `docs/arbitrages.md`** : aucune règle métier n'a changé — ce lot ajoute
des épreuves et des captures sur un comportement déjà tranché et déjà livré (D227,
9I8C). Rien à arbitrer, rien à réouvrir.

## Épreuves jouées (premier plan)

- `pnpm test` — 540 fichiers, 6096 tests, vert.
- `pnpm test:isolation` — 268 fichiers, 2580 tests, vert.
- `CI=1 pnpm verify` — format, typecheck, lint, test, test:isolation, build : vert
  (un écart de formatage sur le nouveau spec de capture, corrigé par `prettier --write`
  avant la seconde passe).
- `tests/e2e/9i8f-statut-machine-modifiable.spec.ts` seul : 2/2 vert.
- `tests/e2e/captures-9i8c-infos-machine-fiche-et-bon.spec.ts` seul : 11/11 vert.

`verify:full` est laissé à la file, comme demandé.

## Pour la suite

- Rien d'identifié : les deux trous mesurés au point 1 sont fermés.
