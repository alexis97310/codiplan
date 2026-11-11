# 9K23-CHECKLIST-BLOCAGE-TERMINER — passation

CK7 : un point obligatoire de checklist sans réponse bloque « Terminer », NOMMÉ (section —
libellé), avec un lien qui déplie la tuile et y saute — un non conforme ne bloque JAMAIS
(décision « A » d'Alexis du 29/10/2026, D240 ; RG-INT-02 amendée, 3.10 précisée).

## `peutTerminer` reçoit un quatrième paramètre

`lib/interventions/cycle-de-vie.ts` — `obligatoiresManquants: readonly PointObligatoireManquant[]`
(type de `lib/checklists/completude.ts`, qui gagne `section` sur `PointPourCompletude` et
`PointObligatoireManquant` : il fallait pouvoir NOMMER le point, pas seulement le compter).
Non vide, le verdict refuse avec `intervention.refus.checklist_obligatoire_manquante` et porte
la liste ENTIÈRE sur `Refus.pointsManquants` (nouveau champ optionnel du type `Refus`, posé
SEULEMENT par ce refus). Jugé APRÈS le temps mesuré, AVANT la signature — RG-INT-02 groupe
« le temps passé » et « la checklist » dans la même phrase. Aucune checklist résolue
(tableau vide) = condition réputée remplie (3.10, inchangée) : `peutTerminer` ne résout jamais
lui-même un gabarit, l'appelant calcule la liste.

## Les QUATRE appelants, mis à jour d'un coup

Retrouvés par recherche de `peutTerminer(` (les lignes avaient bougé depuis l'étude du 08/11) :

1. **`terminerIntervention`** (`lib/interventions/depot-rapport-terrain.ts`) — l'ARBITRE final.
   Nouvelle fonction `obligatoiresManquantsPourTerminer` (`lib/checklists/depot.ts`) : même
   résolution que `checklistDeLIntervention` (la cascade si `checklist_version_id` est encore
   `null`), mais **sans jamais PINNER** — un « Terminer » refusé ne doit pas figer un gabarit
   que personne n'a répondu. Prend `tx: Prisma.TransactionClient` directement (comme
   `resoudreGabaritPourIntervention`, déjà dans ce fichier) : `avecContexteRls` n'accepte qu'un
   `PrismaClient` de premier niveau, jamais une transaction déjà ouverte — impossible d'appeler
   `checklistDeLIntervention` (elle-même `avecContexteApplicatif`) depuis l'intérieur de la
   transaction de `terminerIntervention`.
2. **`/terrain/[id]`** (page terrain, en ligne) — lit `checklist.completude.obligatoiresManquants`,
   déjà calculé par `checklistDeLIntervention`.
3. **`/api/terrain/instantane`** — même lecture, emportée dans `FicheJSON.verdictTerminer`
   (type `Verdict`, réutilisé tel quel : `pointsManquants` traverse l'instantané SANS aucun
   changement à `lib/terrain/copie-locale.ts`, qui écrit l'objet JSON reçu tel quel).
4. **Le verdict LOCAL hors réseau** (`RapportTerrainAutomatique`, `onClickTerminer`) — nouveau
   prop `checklistPourTerminer` (points + réponses connues du serveur), fusionné avec la file
   (`listerFilePourIntervention`, l'entrée `checklist` si elle existe) via `etatDeCompletude`
   réimportée telle quelle. Un point répondu hors réseau, encore en file, COMPTE comme répondu.

## Le lien qui déplie la tuile et y saute

`EVENEMENT_CHECKLIST_SAUTER_AU_POINT` (`lib/terrain/file-saisies.ts`) — même patron que
`EVENEMENT_CHECKLIST_NON_CONFORME` (9K21) : `RapportTerrainAutomatique` (sous le message de
refus) pose un bouton par point manquant, libellé `<section> — <libellé>` (`libelleDuPoint`,
nouvelle fonction de `lib/checklists/suite-preremplie.ts`, même séparateur que
`ligneNonConforme`, sans son suffixe). `ChecklistTerrain` (composant FRÈRE, jamais parent ni
enfant) écoute l'événement, s'ouvre, et défile jusqu'à `#checklist-point-<id>` (id posé sur
chaque `PointChecklistChamp`).

Le chemin EN LIGNE (réponse JSON de `/api/terrain/[id]/terminer`) et le chemin HORS RÉSEAU
(verdict local, jamais sérialisé) portent tous les deux `pointsManquants` jusqu'à l'écran :
`ResultatTerminer` (refus) et la réponse JSON de la route gagnent le champ, `envoyerJson` le
type, `onClickTerminer` le range dans un état `pointsManquantsTerminer` distinct de
`messageTerminer` (vidé à chaque nouvelle tentative).

## Documentation — RG-INT-02 amendée, 3.10 précisée

`docs/arbitrages.md` — **D240**, qui écrit l'amendement que D235 avait déjà annoncé sans
l'écrire (« son blocage effectif est CK7, ultérieur »). **Piège rencontré** : D240 utilisait
d'abord des sous-titres `###` (convention de D235–D239) — le gardien `cablage-arbitrages`
(`scripts/lib/cablage-arbitrages.ts`) efface `courante` sur TOUT titre, y compris un
sous-titre, et ne le réarme qu'au PROCHAIN `## Dxx` : tout ce qui suit un premier `###` n'est
donc jamais lu, y compris une ligne `**Règles amendées :**` placée plus bas. Réécrit avec des
paragraphes en gras (convention de D32/D33), qui ne déclenchent pas ce titre. `docs/cahier-des-
charges.md` (RG-INT-02) et `docs/arbitrages.md` (3.10, gravité 3) précisés en conséquence ;
`docs/backlog.md` (L2-07, qui cite RG-INT-02) relu, rien n'a cessé d'être vrai, empreinte
remplacée.

## i18n

`intervention.refus.checklist_obligatoire_manquante` — dans l'espace `intervention.refus.*`
(même famille que `signature_manquante`, `temps_manquant`, posées par le MÊME `peutTerminer`),
pas `checklist.terrain.*` : le nom du point lui-même (section, libellé) n'est pas traduit — ce
sont des données, recopiées par `checklist_point`/`checklist_reponse`, jamais un texte
d'interface.

## Épreuves

- **Unitaires** (`tests/unit/checklists/completude.test.ts`, `tests/unit/interventions/cycle-
  de-vie.test.ts`) : `obligatoiresManquants` porte `section` ; `peutTerminer` avec et sans
  points manquants, l'ordre des gardes (checklist entre temps et signature), plusieurs points
  TOUS nommés, un autre refus ne porte jamais `pointsManquants`. `tests/unit/terrain/rapport-
  automatique.test.tsx` : prop `checklistPourTerminer` ajoutée au bâtisseur de scène.
- **Isolation** (`tests/isolation/terminer-intervention.test.ts`) : le serveur refuse, NOMMÉ,
  un point obligatoire sans réponse ; un point obligatoire répondu « non conforme » ne bloque
  PAS. La checklist est PINNÉE DIRECTEMENT sur la ligne jetable (jamais résolue par la cascade)
  pour isoler l'épreuve sans exiger de mode sériel.
- **Bout en bout** (`tests/e2e/9k23-checklist-blocage-terminer.spec.ts`) : deux scènes (en
  ligne, mode avion), même pin direct. Refus nommé, lien qui déplie et saute, réponse, puis
  « Terminer » qui passe (en ligne) ou rejoint la file (mode avion, « en attente d'envoi »).
  Captures 375/1280 dans `captures/`. `tests/e2e/tous-les-ecrans-rendent.spec.ts` : vert (61
  passés, 4 ignorés comme avant ce lot).

## Ce qui reste dû

CK9. Rien n'est dû à `lib/terrain/copie-locale.ts`, `lib/terrain/file-saisies.ts` (hors le
nouvel événement) ni `app/api/terrain/[id]/checklist/route.ts`.

## Vérification

`CI=1 pnpm verify` : format, typecheck, lint, test, test:isolation, build. `pnpm vitest run
tests/e2e/9k23-checklist-blocage-terminer.spec.ts` (hors `verify`, joué manuellement ici via
`playwright test`) : 2 passés. `tests/e2e/tous-les-ecrans-rendent.spec.ts` joué manuellement :
61 passés, 4 ignorés. `verify:full` est laissé à la file de nuit.
