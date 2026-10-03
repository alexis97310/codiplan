# 9DD-PG-G14C-TERRAIN-TRANSMISES — passation

## Ce que j'ai changé, et ce que ça change pour l'exploitation

**14C (D141) : le terrain ne montre plus que le TRANSMIS.** « Ma journée » (`/terrain`) n'affiche plus une intervention `PLANIFIEE` — elle est encore préparée par le bureau, et n'apparaît que lorsqu'un planificateur clique « Transmettre au technicien » (ou « Transmettre toutes les planifiées prêtes »), qui la fait passer en `AFFECTEE`. La fiche `/terrain/<id>` d'une `PLANIFIEE` rend « Page introuvable » — le même rendu qu'une intervention hors périmètre (D35, D50) — et ne la marque jamais « vue ». Pour l'exploitation : un technicien ne voit plus de travail qui n'a pas encore été officiellement transmis ; avant ce ticket, il pouvait voir et ouvrir une intervention encore en préparation, ce qui contredisait l'intention de D141 (14A/14B avaient sciemment laissé cet état intermédiaire).

**TR-20 : « Ma journée » masque aussi les `ANNULEE`** — regroupé avec 14C (décision du 03/10/2026, point 8) car c'était un constat voisin du même écran (TR-20, audit du 28/09/2026) sans décision propre : `/planning` appliquait déjà cette règle (PG-A8-ANNULEES-MASQUEES), `/terrain` en manquait. Une annulée reste lisible par lien direct (sa fiche n'est pas touchée).

**Mécanisme :** `listerPlanning` (`lib/interventions/depot.ts`) gagne une option `inclurePlanifiees` (`true` par défaut, même discipline que `inclureAnnulees`/PG-A8) : `/planning` et `/tableau-de-bord` continuent de voir exactement ce qu'ils voyaient. Seul `/terrain` passe `{ inclurePlanifiees: false, inclureAnnulees: false }`.

**D141 complété** (`docs/arbitrages.md`) : paragraphe « 14C — le terrain ne voit plus les Planifiées », et correction d'une phrase contradictoire de la section « 14B NE TOUCHE PAS » qui disait l'inverse de ce que D141 annonçait depuis le début.

## Ce que j'ai mesuré

- `pnpm verify:full` complet, deux fois, EN ENTIER, au premier plan : la première fois a révélé deux défauts réels (voir plus bas), la seconde est passée intégralement — format, typecheck, lint, 3893 tests unitaires, tests d'isolation, build, horizon des fériés, audit des partitions, et **793 tests e2e (0 échec, 7 ignorés comme d'habitude, ~32 minutes)**.
- Captures AVANT (git worktree sur le commit `2c95eb1`, précédent ce ticket) / APRÈS (ce code), 375 et 1280 px : « Ma journée » et la fiche d'une Planifiée — voir `captures/`. AVANT : Planifiée et Annulée visibles sur la journée, fiche normale. APRÈS : seule l'Affectée reste, fiche « Page introuvable ».
- Un cas d'isolation neuf (`tests/isolation/terrain-planifiees-masquees.test.ts`, dernier test) pose les DEUX options ensemble — c'est lui qui a débusqué le bug de fusion des filtres (voir plus bas), un seul filtre à la fois ne pouvant jamais le voir.

## Ce que j'ai tranché, et pourquoi

1. **Les deux filtres de statut se combinent par un tableau `AND`, jamais par deux `...spread` sur le même objet.** Mesuré sur le premier `verify:full` : `{ ...filtreStatutAnnulee(false), ...filtreStatutPlanifiee(false) }` fait que le second spread écrase le premier (même clé `statut`) — seule la Planifiée disparaissait, l'Annulée restait. Corrigé en `AND: [filtreStatutAnnulee(...), filtreStatutPlanifiee(...)]`, qui combine réellement les deux `Prisma.InterventionWhereInput`.
2. **Quatre fixtures e2e partagées ou voisines sont passées de `planifiee` à `affectee`** (`tests/e2e/setup/scene.ts` : `compteurA`, `compteurB`, `rapportTravaillee`, `rapportVierge` ; `tests/e2e/avertissements-1.spec.ts` ; `tests/e2e/bon-4.spec.ts`) : ces scènes représentent des interventions déjà vues par le technicien du terrain (compteur, rapport, signature, badge « Nouveau ») — correct avant 14C puisque le terrain montrait encore les Planifiées, devenu un faux négatif (fiche « introuvable ») une fois la visibilité retirée. C'est une correction de MISE EN SCÈNE, aucune assertion n'a changé (règle du ticket pour les épreuves étrangères qui partagent une scène). Les fixtures du PLANNING (`deplacable`, `versSamedi`, `obstacle`, `chevauchante`, `redimensionnable`, `glissable`) restent `planifiee`, non concernées.
3. **L'Annulée de ma propre scène e2e naît `vue_technicien_le` déjà posé** plutôt que `null` : sa première ouverture via `/terrain/[id]` appelait `marquerVuParTechnicien`, qui tente un `UPDATE` que le déclencheur d'immutabilité des annulées (I5) refuse (23514). Défaut réel et préexistant (indépendant de ce ticket — n'importe quelle annulée jamais ouverte avant son annulation l'aurait déjà heurté), mais `marquerVuParTechnicien` n'est pas dans le territoire de ce ticket (seul `listerPlanning` l'était côté `depot.ts`) : contourné côté scène plutôt que « réparé » hors mandat. Voir « ce qui reste à faire ».
4. **Trois commits séparés pour les parties A/B/C** du ticket (14C, TR-20, D141), comme demandé, plus des commits de correction distincts au fil des vérifications (jamais d'amend) : l'historique montre l'état réel de chaque étape, y compris les deux bugs trouvés en vérifiant.

## Ce que je n'ai PAS fait

- Rien sur le compteur ni les routes `app/api/terrain/*` (hors territoire, 9DC/TP-CY).
- Rien sur la matrice D8, aucune migration, aucune ligne de semis, aucun prix.
- Je n'ai pas touché `restrictionParPersonne` ni `lireFicheIntervention` : le filtre de statut d'une Planifiée est posé dans la PAGE (`app/(mobile)/terrain/[id]/page.tsx`), pas dans le dépôt, conformément au territoire qui ne nommait que `listerPlanning`.
- Je n'ai pas corrigé le défaut de `marquerVuParTechnicien` sur une annulée jamais vue (hors territoire) — voir ci-dessous.

## Les pièges pour la session suivante

- **La fusion de deux filtres `Prisma.InterventionWhereInput` sur la MÊME clé par `...spread` s'écrase en silence.** Si un futur filtre de `listerPlanning` touche encore `statut` (ou toute autre clé déjà filtrée), vérifier qu'il passe par le même tableau `AND`, pas par un spread de plus à côté des deux existants.
- **Défaut trouvé, hors territoire, non corrigé : `marquerVuParTechnicien` (`lib/interventions/depot.ts`) peut lever une erreur serveur non rattrapée (23514) sur une intervention `ANNULEE` jamais ouverte avant son annulation**, parce qu'un déclencheur refuse toute écriture sur une ligne annulée (I5) et que cette fonction ne le sait pas (contrairement à la garde déjà posée pour la durée manquante, juste au-dessus dans le même fichier, commentaire « LA GARDE QUI PRÉCÈDE LE 23514 DE PRODUCTION »). À corriger par un ticket dédié : soit un `try/catch` qui avale l'échec (le « vu » n'est qu'un repère d'affichage, jamais une action demandée — même raisonnement que la garde voisine), soit une garde explicite `statut !== "annulee"` avant l'écriture.
- Les quatre fixtures de scène passées à `affectee` (`scene.ts`) sont lues par au moins `terrain.spec.ts`, `rapport-terrain.spec.ts` et, par la génération du compte fermé de 120 min, potentiellement par `montants-par-role.spec.ts`/`ecrans-largeur-utile.spec.ts` (aucune référence directe trouvée, mais le commentaire d'origine les nomme) — si un futur ticket touche encore leur statut, vérifier ces deux derniers fichiers en plus des deux évidents.
- Les captures AVANT ont été prises depuis un `git worktree` jetable (déjà supprimé) — la recette (copier `node_modules` en lien symbolique, `.env`, lire les clés du dictionnaire absentes côté AVANT via des libellés en dur plutôt que `fr["clé"]`) est documentée dans la mémoire de session `captures-avant-apres-e2e`.

## Ce qui reste à faire

- Le défaut `marquerVuParTechnicien` / annulée jamais vue, nommé ci-dessus — pas du périmètre de ce ticket, mérite son propre ticket avant qu'un technicien ne tombe dessus en production (une annulée affectée à quelqu'un, jamais ouverte, annulée avant la première visite).
- Rien d'autre n'est identifié comme manquant pour 14C : le découpage PG-G14 (14A/14B/14C) est maintenant complet.
