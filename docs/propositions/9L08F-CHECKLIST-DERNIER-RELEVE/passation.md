# 9L08F-CHECKLIST-DERNIER-RELEVE — passation

Décision d'Alexis du 16/11/2026 (réponse « 1 », en écho à sa décision du 11/11/2026 « les 23 mesures
en relevé seul, aucune tolérance ») : sous un point chiffré de la checklist terrain, on ajoute
**seulement** le dernier relevé de la même machine, sous le champ. **Aucune tolérance affichée ni
saisie, aucun verdict automatique.** Écrite en `docs/arbitrages.md` sous **D265**.

## Point 0 — la clé de correspondance, et ses limites

`checklist_point.id` n'est PAS une clé stable d'une intervention à l'autre : une nouvelle version d'un
modèle récrit TOUS ses points avec de nouveaux `id` (D235). `checklist_reponse`, elle, RECOPIE
`libelle`/`section`/`unite` du point au moment de la réponse — c'est la clé la plus stable déjà
disponible, sans rouvrir `ChecklistPoint` d'une autre version. La clé retenue est donc
**`section + libellé`** (`lib/checklists/dernier-releve.ts`, `cleDuPointReleve`).

Deux limites assumées, écrites dans le docblock du module et dans D265 :

- un point **renommé** entre deux versions perd son historique (aucune clé ne correspond plus) ;
- une machine dont le **modèle de matériel** change garde quand même son relevé si le libellé/section
  du point survit au changement — rien ne borne explicitement par modèle, seulement par machine
  (`intervention_machine.machine_id`).

Le filtrage N'EST PAS restreint par auteur : tout technicien amené à intervenir sur une machine voit
le même rappel, quel que soit qui a posé le relevé antérieur (décision explicite, pas un oubli — voir
D265, « ce que cette décision n'est pas »).

## Ce qui a été livré

1. **`lib/checklists/dernier-releve.ts`** (nouveau) — fonction PURE, séparée de l'accès base : `cleDuPointReleve`
   et `dernierReleveParCle` (garde la première occurrence d'une liste déjà triée par date décroissante).
2. **`lib/checklists/depot.ts`** — `relevesHistoriquesDeLaMachine` : DEUX requêtes par fiche (jamais une
   par point) — la liste des interventions `terminee`/`cloturee` de la machine (bornée à 200, même
   ordre que `lib/machines/historique.ts`), puis leurs réponses chiffrées en une fois. `PointDeChecklist`
   porte un nouveau champ `dernierReleve`, calculé dans `checklistDeLIntervention` (seule fonction qui
   consomme cette lecture — `manquesChecklistPourTerminer` n'y touche pas).
   **Pourquoi deux requêtes et pas une jointure** : `ChecklistReponse.intervention` n'est PAS une
   relation filtrable côté Prisma — `Intervention.checklist_reponses` porte `@ignore` (D246, forme
   « filiation », jamais navigué depuis `Intervention`), et ignorer un côté d'une relation retire cette
   relation des DEUX `WhereInput` générés. Mesuré en l'écrivant (`tsc` a refusé `checklistReponse.findMany({where: {intervention: {...}}})` —
   « `intervention` n'existe pas sur `ChecklistReponseWhereInput` »), pas un choix de style.
3. **`lib/calendar/fuseau.ts`** — `dateCivileLocale(instant, fuseau)`, le pendant de `dateCivile` pour
   un INSTANT (`Timestamptz`) plutôt qu'une colonne `DATE` civile. `components/terrain/presentation.ts`
   (`libelleCopieDu`) composait déjà cette même paire jour/mois/année en ligne — REFACTORISÉE pour
   appeler cette fonction plutôt que de la recomposer une troisième fois (§9, 01/09).
4. **`components/terrain/checklist-terrain.tsx`** — `PointChecklistEcran.dernierReleve` (déjà
   client-safe : nombre, pas `Decimal` ; chaîne `JJ/MM/AAAA`, pas `Date`) ; `libelleDernierReleve`
   (composition du texte, RELEVÉ SEUL) ; `PointLigne` l'affiche en 13 px gris
   (`text-app-terrain-encre-secondaire`, `#5B6472`, confirmé dans `app/globals.css`), sous le libellé,
   avant la consigne.
5. **`app/(mobile)/terrain/[id]/page.tsx`** — la fiche en ligne compose `dernierReleve` (date formatée
   dans le fuseau DE LA FICHE, jamais celui de l'appareil, L0-08).
6. **`app/api/terrain/instantane/route.ts`** — `FicheJSON.checklist.dernierReleves`, un dictionnaire
   PAR POINT ET PAR FICHE (jamais sur `ChecklistModeleJSON`, qui est le gabarit PARTAGÉ entre
   plusieurs fiches de la même version : la machine, elle, varie par fiche, même quand deux
   interventions du jour résolvent la même version). Formaté ICI, même discipline que `reponses`.
7. **`components/terrain/consultation-hors-reseau.tsx`** — `pointsChecklistDeLaFiche` lit
   `checklist.dernierReleves[point.id]`, exactement comme elle lit déjà `checklist.reponses[point.id]`.
8. **`lib/terrain/copie-validee.ts`** — `checklistDeLaFiche` valide `dernierReleves` comme un champ
   AJOUTÉ APRÈS COUP (même doctrine que `catalogue`/`prestationsRealiseesIds`) : absent ou mal formé
   devient `{}`, jamais un plantage sur une copie posée par une version antérieure de l'application.
9. **`lib/i18n/fr.ts`** — deux nouvelles clés, `checklist.terrain.dernier_releve_prefixe` (« Dernier
   relevé ») et `checklist.terrain.dernier_releve_le` (« le »).
10. **`docs/arbitrages.md`** — D265 écrite, numéro suivant libre vérifié contre `origin/main` au
    moment du rebase.

## Épreuves

- **`tests/unit/checklists/dernier-releve.test.ts`** (nouveau) — la clé de correspondance (distingue
  section et libellé), l'absence (liste vide, clé absente), plusieurs interventions antérieures → la
  plus récente gagne (fonction pure, sans base).
- **`tests/unit/terrain/checklist-terrain.test.tsx`** — fixture `point()` complétée avec
  `dernierReleve: null` par défaut (champ désormais requis par le type).
- **`tests/unit/terrain/copie-validee.test.ts`** — trois cas ajoutés/complétés : absence (copie
  ancienne) devient `{}` ; un relevé valide traverse, un relevé de forme invalide est écarté.
- **`tests/isolation/9l08f-checklist-dernier-releve.test.ts`** (nouveau, chemin de production réel
  `checklistDeLIntervention`) :
  - `terminee` et `cloturee` comptent, `en_cours` jamais — même quand `en_cours` est
    CHRONOLOGIQUEMENT plus récente que les deux autres (la plus récente des relevés RETENUS gagne,
    pas la plus récente tout court) ;
  - le cloisonnement société : sous le contexte de la société B, l'intervention elle-même disparaît
    (RLS sur `intervention`) — la lecture du dernier relevé n'a donc même pas l'occasion de s'exécuter
    hors de la bonne société.
- **`tests/e2e/9l08f-checklist-dernier-releve.spec.ts`** (nouveau, 375 px) — deux points chiffrés sur
  la même rubrique (l'un avec antécédent, l'autre sans) : en ligne, le rappel s'affiche SEULEMENT sous
  celui qui a un antécédent ; hors réseau (mode avion après un premier chargement en ligne), le même
  texte survit dans la copie locale. Captures AVANT/APRÈS prises par bascule temporaire du rendu
  (`(false as boolean) && ...`) autour du même scénario, jamais par un second commit/worktree — le
  budget de 90 minutes ne couvrait pas la reconstruction d'un commit précédent complet (même
  contrainte que 9L08E, voir sa passation).

`pnpm typecheck`, `pnpm lint`, `pnpm test` (5950 tests), `pnpm test:isolation` (2278 tests) et
`CI=1 pnpm verify` passent tous, rejoués en avant-plan pendant ce lot. `pnpm test:e2e` n'a PAS été
rejoué en entier (budget de 90 minutes) — seul le spec `9l08f-checklist-dernier-releve.spec.ts` a été
rejoué (2 scénarios, verts) ; la file de nuit joue `verify:full` (qui inclut `test:e2e` en entier)
après ce lot.

## Ce qui N'A PAS été fait, et pourquoi — à reprendre

**Régénération de `docs/captures/` par `scripts/captures.mts`.** Comme pour 9L08E : aucun des deux
écrans touchés (fiche terrain en ligne, coquille hors réseau) ne figurait déjà dans le catalogue
`docs/captures/README.md` — ce n'est donc pas une image existante devenue fausse, seulement une
nouvelle capture absente de ce catalogue global. Les captures AVANT/APRÈS spécifiques à ce ticket
existent, dans `docs/propositions/9L08F-CHECKLIST-DERNIER-RELEVE/captures/`.

**La question laissée ouverte par 9L08B sur les photos** (si une checklist jamais répondue par manque
de temps devrait, elle aussi, voir son historique) n'a pas été reposée ici — hors périmètre de ce
ticket, qui porte uniquement sur les points chiffrés.

**Aucune migration** — conforme à l'interdit du lot ; les colonnes `tolerance_min`/`tolerance_max`
existent déjà depuis 9K08, posées vides, et le restent.
