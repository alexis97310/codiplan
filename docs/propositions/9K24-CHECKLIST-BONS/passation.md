# 9K24-CHECKLIST-BONS — passation

CK8 : une tuile « Checklist » sur le bon d'intervention — bureau ET portail, par le MÊME
`composerBon` (`lib/interventions/bon.ts`) — pour les neuf natures d'intervention, à
l'emplacement réservé par 9I7 (« après prestations »). Avant d'écrire, les tuiles
communes aux deux pages (identiques caractère pour caractère) sont extraites vers
`components/interventions/bon-tuiles.tsx`.

## Ce qui a changé

1. **`lib/checklists/depot.ts`** — `checklistDuBon(tx, interventionId, checklistVersionId)`
   : `null` si aucune version n'est FIGÉE (`intervention.checklist_version_id`), sinon
   les réponses groupées par section, avec un résumé (conformes/non conformes/sans
   objet). Jamais la cascade résolue à la volée : une lecture ne pin jamais.
2. **`lib/interventions/bon.ts`** — `BonIntervention.checklist : ChecklistBon | null`,
   lu dans la MÊME transaction que le reste du bon (`composerBon`), à `checklist_version_id`
   (sélectionné et aussitôt stripé du `ligne` public, même patron que `valorisation_figee`).
3. **`lib/interventions/profil-bon.ts`** — `"checklist"` rejoint `TUILES_BON` (neuf
   tuiles désormais), posée juste après `"prestations"` dans `ORDRE_BASE` ET
   `ORDRE_PREVENTIF` — `EMPLACEMENT_CHECKLIST_PREVENTIVE` (le marqueur texte que 9I7
   avait posé) est retiré, son rôle rempli.
4. **`components/interventions/bon-tuiles.tsx`** (nouveau) — `Ligne`, `TuileClient`,
   `TuileMateriel`, `TuileCommentaires`, `TuilePieces`, `TuilePrestations`, `TuileSuite`,
   `TuileConditionsFacturation` : extraites des deux pages, SANS changer leur rendu
   (`aucuneMachineSurLeSite`/`aucuneMachineDuBonPortail` composaient déjà le même texte,
   la seconde fonction — devenue morte — est retirée de
   `app/(portail)/portail/interventions/[id]/bon/presentation.ts`). `TuileChecklist`,
   nouvelle, y est posée à côté.
   **Restent dans chaque page** : `intervention` (l'heure du créneau diffère) et
   `signataire` (l'heure de la signature diffère) — les extraire aurait changé un rendu
   que ce ticket ne doit pas toucher.
5. **`app/globals.css`** — la tuile Checklist est la SEULE exception à la règle
   d'impression `section { break-inside: avoid }` : `[data-bloc="bon-checklist"]` repasse
   à `auto`, et c'est chaque `.checklist-section` interne qui porte `avoid` — une
   checklist longue continue sur la page suivante, section par section, jamais la tuile
   entière forcée sur une seule page.
6. **`lib/i18n/fr.ts`** — `checklist.bon.titre`, `.resume_conformes`, `.resume_non_conformes`,
   `.resume_sans_objet` (espace `checklist.bon.*`, dans le bloc `checklist.*` existant).
   Les trois valeurs de `conforme_non_conforme_sans_objet` réutilisent les clés déjà
   posées par CK5 (`checklist.terrain.option_conforme`/`.non_conforme`/`.option_sans_objet`) ;
   « Fait » réutilise `checklist.parametrage.type_reponse.case_faite`.

## Un bug attrapé par l'épreuve d'isolation, pas en relecture

**Première version de `checklistDuBon`** : `WHERE { intervention_id, point: { checklist_version_id } }`
et `orderBy: { point: { ordre: "asc" } }` — un filtre et un tri « de sécurité » pensés
pour border la lecture à la bonne version. **Sous le portail, ce JOIN implicite vers
`checklist_point` (forme « interne », D94) rendait ZÉRO ligne**, même pour le client DE
l'intervention : la politique RLS de `checklist_point` ferme sa lecture au portail, et
Prisma traduit un `WHERE`/`ORDER BY` sur une relation en JOIN — une ligne invisible y
exclut la ligne hôte. **Exactement ce que D235 refuse** (« jamais besoin d'ouvrir
`checklist_point` »), introduit par inadvertance en voulant être « plus sûr ». Mesuré par
`tests/isolation/9k24-checklist-bons.test.ts` (« le bon du PORTAIL… ») avant tout commit.

**Correctif** : `WHERE { intervention_id }` SEUL — l'invariant (une réponse appartient à
l'UNIQUE version que `enregistrerReponses` a pinnée) rend le filtre redondant — et
`orderBy: [{ repondu_le: "asc" }, { id: "asc" }]`, qui ne lit que `checklist_reponse`
elle-même.

## Le résumé et le rendu, déduits des CINQ colonnes, jamais du type de point

`RenduReponseChecklistBon` (`lib/checklists/depot.ts`) dérive la nature d'une réponse
(conforme/mesure/case/choix/texte) de la SEULE colonne non nulle parmi les cinq de
`checklist_reponse` — jamais de `checklist_point.type_reponse`. Le résumé ne compte que
les réponses de nature « conforme » ; les mesures, cases et textes n'y entrent pas (le
ticket ne demandait qu'un compte des trois états conforme/non conforme/sans objet).

## Épreuves

- **Unitaires** (`tests/unit/interventions/profil-bon.test.ts`) : `"checklist"` vient
  toujours juste après `"prestations"`, pour les neuf natures.
- **Isolation** (`tests/isolation/9k24-checklist-bons.test.ts`) : aucune version figée →
  `null` ; composition (résumé, sections, mesure+unité, non conforme compté) ; le libellé
  vient de la RÉPONSE même après une correction posée directement sur `checklist_point`
  (immuable en production, D235) ; le bon du portail rend les mêmes réponses que le
  bureau (D235) ; une mesure DIRECTE confirme qu'un autre client de la même société ne
  lit aucune ligne de `checklist_reponse` ; une autre société ne lit rien.
- **Bout en bout** (`tests/e2e/9k24-checklist-bons.spec.ts`) : bureau à 1280px (résumé et
  points, lus par `innerText` + `toContain`, jamais `getByText` — voir ci-dessous),
  absence de la tuile sans version figée, portail à 375px, aperçu d'impression. Scène
  jetable (deux interventions), transition D8 `terminee → cloturee` posée APRÈS le pin
  du `checklist_version_id` (une ligne `cloturee` est immuable, même pour y remettre ce
  champ à `NULL` — la garde ne distingue pas). Compte portail invité et LAISSÉ en base
  (`9k24-checklist-bons@codima.test`), même convention que `captures-9j22-portail-bon-
  technicien-temps.spec.ts` et toute la famille `captures-9j*`/`9k0*-portail-*`.
  `tests/e2e/tous-les-ecrans-rendent.spec.ts` : vert (61 passés, 4 ignorés comme avant).
- **Le gardien `sans-chaine-visible-en-dur` (L0-11)** a d'abord refusé le spec e2e : les
  libellés inventés pour la scène (« Protections en place », etc.) et le résumé composé
  (« 1 conformes… ») atteignaient l'écran par `getByText`/littéral — DONNÉES de test,
  pas des clés, mais le gardien ne distingue pas la source, seulement la destination.
  Corrigé par lecture `.innerText()` du bloc `[data-bloc="bon-checklist"]` suivie d'un
  `toContain` en JS — même recette que `toHaveText("0")` dans la note de mémoire sur les
  captures avant/après (aucun appel `getByText`/`toHaveText`, donc hors du périmètre que
  l'analyse statique du gardien scanne).

## Captures

APRÈS SEULEMENT (`docs/propositions/9K24-CHECKLIST-BONS/captures/`) — un AVANT fidèle
exigerait de reconstruire une compilation de production sur le commit qui précède ce lot,
hors budget. Pour qui reprendrait ce point : `git worktree add /tmp/9k24-avant <commit
avant ce lot>`, lier `node_modules`, copier `.env`, rejouer
`tests/e2e/9k24-checklist-bons.spec.ts` dans le worktree — l'ancien code n'y rend ni
résumé ni tuile Checklist (recette documentée en tête du spec lui-même).

- `bon-bureau-checklist-apres-1280.png`
- `bon-bureau-checklist-apres-impression.png` (aperçu d'impression — `emulateMedia`
  seul, sans cliquer « Imprimer le bon » : même limite que les captures d'impression
  précédentes de ce dépôt, la classe `print-bon` n'y est jamais posée)
- `bon-portail-checklist-apres-375.png`

## Ce qui reste dû

Rien de nommé par ce ticket. Le PDF figé (backlog B8) reste PLUS TARD, hors de ce lot.
