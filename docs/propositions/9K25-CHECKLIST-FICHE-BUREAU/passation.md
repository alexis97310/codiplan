# 9K25-CHECKLIST-FICHE-BUREAU — passation

CK9 : une tuile « Checklist » EN LECTURE sur la fiche intervention du bureau, et une
mention non bloquante des points non conformes dans « Avant de clôturer ». **Dernier lot
du moteur des checklists** — CK1 à CK9 sont désormais tous livrés ; seul le CONTENU des
points attend l'atelier d'Alexis (date à donner, cf. décision du 10/11/2026).

## Ce qui a changé

1. **`lib/checklists/depot.ts`** — `checklistDeLaFiche(tx, interventionId,
   checklistVersionId)`, nouvelle : même garde que `checklistDuBon` (CK8, 9K24) — `null`
   tant qu'aucune version n'est FIGÉE, `intervention_id` SEUL comme filtre, jamais de JOIN
   implicite vers `checklist_point`. Deux informations que `checklistDuBon` ne porte
   JAMAIS, parce qu'elle vise un document remis au CLIENT : la PROVENANCE (le libellé du
   modèle résolu, via une lecture séparée de `checklist_version` → `checklist_modele`,
   safe ici car la fonction n'est jamais appelée sous un contexte portail) et QUI a
   répondu CHAQUE point, et QUAND (`auteur_id`/`repondu_le` de `checklist_reponse`,
   résolus par `annuaireDesPersonnes`, jamais l'UUID brut affiché — I10). D'où une
   fonction SÉPARÉE plutôt qu'un paramètre optionnel sur `checklistDuBon`, dont la forme
   reste celle du bon.
2. **`lib/interventions/depot.ts`** — `lireFicheIntervention` gagne `checklist:
   ChecklistFiche | null`, lu dans la MÊME transaction que le reste de la fiche, à
   `checklist_version_id` (sélectionné et stripé, même patron que `composerBon`).
3. **`components/interventions/bon-tuiles.tsx`** — `libelleRenduChecklist` et
   `resumeChecklistBon` exportées (étaient privées) : la NOUVELLE tuile de la fiche
   réutilise le rendu d'une réponse et la composition du résumé, les SEULES parties
   communes avec `TuileChecklist` (CK8) — sa forme entière ne pouvait pas rester celle du
   bon (provenance, auteur, heure : trois choses qu'un document client ne montre jamais).
4. **`app/(back-office)/interventions/[id]/page.tsx`** :
   - `TuileChecklistFiche`, nouvelle — provenance (« Checklist : <modèle> »), résumé,
     points groupés par section, un non conforme en évidence (`text-app-oxyde`, même
     teinte que CK8), auteur et heure de CHAQUE réponse (`dateHeureLocale`, fuseau de
     l'agence). Posée dans l'onglet Résumé, après « Pièces remplacées » et avant « Suite à
     donner » — même position relative que `TuileChecklist` sur le bon (« après
     prestations »). `null` = aucune tuile (pas de tuile vide).
   - `AvantDeCloturer` gagne `nonConformesChecklist: number` — **pas une quatrième ligne**
     de la liste jugée par `peutCloturer` (toujours trois, inchangées), mais une mention
     posée À CÔTÉ, avec un lien `#checklist-fiche` vers la tuile : un non conforme ne
     bloque JAMAIS la clôture (D240, 3.10). `0` = aucune mention (aucune checklist, ou
     aucun non conforme).
   - `<Carte bloc="avant-cloture">` — marqueur `data-bloc` posé pour la première fois sur
     cette tuile (test uniquement, aucun rendu visuel), même convention que
     `bloc="bon-checklist"`/`bloc="fiche-checklist"`.
5. **`lib/i18n/fr.ts`** — un seul nouveau libellé, `checklist.fiche.lien_voir` (« Voir la
   checklist »). Tout le reste est RÉUTILISÉ tel quel : `checklist.bon.titre` (le titre de
   la tuile — « Checklist », identique des deux côtés), `checklist.bon.resume_*`,
   `checklist.terrain.provenance_prefixe`, `checklist.terrain.points`,
   `checklist.terrain.option_conforme`/`non_conforme`/`option_sans_objet`,
   `checklist.parametrage.type_reponse.case_faite` — aucune clé posée en fin de fichier.

## Pourquoi une tuile séparée, et non `TuileChecklist` (CK8) réutilisée telle quelle

Sa forme ne convient pas : `TuileChecklist` est conçue pour un document remis au CLIENT
(le bon), qui ne porte ni provenance ni auteur ni heure — les montrer là suggérerait une
information que le bon n'a pas à donner. Le bureau, lui, les demande explicitement (point
1 du ticket). Réutiliser le composant aurait exigé soit un mode conditionnel dans
`TuileChecklist` (une tuile qui change de forme selon l'appelant est plus fragile qu'une
seconde tuile, courte, qui réutilise les DEUX fonctions qui comptent — le rendu d'une
réponse et le résumé), soit de les lui ajouter inconditionnellement (les montrer alors
aussi sur le bon, ce que CK8 refuse explicitement). D'où `TuileChecklistFiche`, nouvelle,
et `checklistDeLaFiche`, nouvelle — mais aucune troisième écriture de la logique de
composition (groupement par section, comptage du résumé) : copiée-adaptée depuis
`checklistDuBon` pour y ajouter l'auteur et la provenance, jamais réinventée.

## Épreuves

- **Isolation** (`tests/isolation/9k25-checklist-fiche-bureau.test.ts`) : aucune réponse →
  `fiche.checklist` est `null` ; composition (provenance = libellé du modèle, résumé,
  sections, QUI a répondu CHAQUE point — résolu, jamais `—` ni l'UUID brut — et QUAND) ;
  une autre société ne lit rien.
- **Bout en bout** (`tests/e2e/9k25-checklist-fiche-bureau.spec.ts`) : bureau 1280px (tuile
  complète — provenance, résumé, points, auteur, heure — et la mention « N points non
  conformes » avec son lien `href="#checklist-fiche"`), bureau 375px (même tuile, mobile),
  et une intervention SANS checklist figée (aucune tuile, aucune mention). Scène jetable
  (deux interventions « terminee », jamais clôturées — la tuile de la fiche ne l'exige
  pas, à la différence de CK8 qui doit passer par `peutGenererLeBon`), nettoyée en
  `afterAll`. `tests/e2e/tous-les-ecrans-rendent.spec.ts` : 61 passés, 4 ignorés, inchangé
  (aucune route neuve).
- **Captures** (`docs/propositions/9K25-CHECKLIST-FICHE-BUREAU/captures/`) — APRÈS
  SEULEMENT, même réserve que CK8 (un AVANT fidèle exigerait un serveur reconstruit sur le
  commit précédent, hors budget de ce lot) : `fiche-bureau-checklist-apres-1280.png`,
  `fiche-bureau-checklist-apres-375.png`.

## Vérification

`CI=1 pnpm verify` : format, typecheck, lint, 5716 tests unitaires, 2147 tests
d'isolation, build — vert. `pnpm exec playwright test tests/e2e/9k25-checklist-fiche-
bureau.spec.ts` (3 passés) et `tests/e2e/tous-les-ecrans-rendent.spec.ts` (61 passés, 4
ignorés) joués manuellement, hors `verify` — `verify:full` est laissé à la file de nuit.

## Le moteur des checklists, au complet (CK1 à CK9)

| Lot | CK | Ce qu'il porte |
|---|---|---|
| 9K08-CHECKLIST-SCHEMA | CK1 | Le socle : schéma, `creerModele`, `publierVersion`, `dernierVersionPubliee`. |
| 9K18-CHECKLIST-DOMAINE | CK2 | Le moteur : cascade de résolution du gabarit, complétude, validation des cinq types de réponse, `checklistDeLIntervention`, `enregistrerReponses`. |
| 9K19-CHECKLIST-PARAMETRAGE | CK3 | L'écran de paramétrage bureau — créer/publier un modèle et ses points. |
| 9K20-CHECKLIST-DUPLIQUER-DEPART | CK4 | Dupliquer un modèle existant ; gabarits de départ fournis (pont 2 colonnes). |
| 9K21-CHECKLIST-TERRAIN-SAISIE | CK5 | La tuile de saisie EN LIGNE sur la fiche terrain, et la ligne préremplie dans « Suite à donner » sur un non conforme. |
| 9K22-CHECKLIST-HORS-RESEAU | CK6 | La saisie HORS RÉSEAU — gabarit et réponses voyagent dans l'instantané, geste dans la file d'envoi. Lève la garde de mise en production posée par CK5. |
| 9K23-CHECKLIST-BLOCAGE-TERMINER | CK7 | Un point obligatoire sans réponse bloque « Terminer », nommé, avec un lien qui déplie et saute au point. Un non conforme ne bloque JAMAIS (D240). |
| 9K24-CHECKLIST-BONS | CK8 | La tuile « Checklist » sur le bon d'intervention, bureau ET portail, via `composerBon` partagé. |
| 9K25-CHECKLIST-FICHE-BUREAU | CK9 | La tuile « Checklist » EN LECTURE sur la fiche bureau (provenance, auteur, heure), et la mention non bloquante dans « Avant de clôturer ». |

**Ce qui reste dû, et ce n'est PAS un ticket de code** : le CONTENU des checklists
(sections et points réels, au-delà des gabarits de démonstration et de départ) attend
l'atelier d'Alexis — date non encore donnée au 11/11/2026. Le PDF figé du bon (backlog B8)
reste également hors de ce périmètre, inchangé depuis la passation de CK8.
