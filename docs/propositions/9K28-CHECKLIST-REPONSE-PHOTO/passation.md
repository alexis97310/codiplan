# 9K28-CHECKLIST-REPONSE-PHOTO — passation

Décision verbatim d'Alexis du 11/11/2026 ~08h05, atelier des check-lists : « Oui, dès
maintenant » — revient sur le report du 29/10 inscrit au commentaire de `TypeReponseChecklist`
par 9K18-CHECKLIST-DOMAINE. Écrite en entier : `docs/arbitrages.md` D244.

## MIGRATION À JOUER par Alexis : staging puis DB migrate & seed, puis Vercel

**`20261111090000_checklist_reponse_photo_9k28`** — une seule migration neuve. Elle AJOUTE : la
valeur `photo` à l'énumération `TypeReponseChecklist`, la colonne `checklist_reponse.valeur_photo`
(booléen, exclusivité reposée sur SIX colonnes), la table `checklist_reponse_photo` (RLS, verrou
portail écriture, déclencheur d'audit). Elle ne modifie aucune migration déjà appliquée.

## Ce que ce ticket fait

1. **Le domaine** — `lib/checklists/depot.ts` gagne `enregistrerReponsePhoto(tx, params)`,
   appelée DANS la transaction de `deposerPhotoIntervention` (`lib/documents/depot.ts`) quand la
   route reçoit un `checklist_point_id`. **Tout ou rien (I6)** : un refus de la liaison lève
   (`RefusLienChecklistPhoto`, rattrapée) plutôt que de `return null` depuis une transaction
   Prisma interactive — un simple `return` la validerait quand même et laisserait le document
   orphelin. La classe de la photo est FORCÉE à `"client"` quand `checklist_point_id` est fourni
   (D235 : le client voit tous les points de sa checklist remplie).

   `enregistrerReponsePhoto` vérifie aussi que le document appartient à CETTE intervention
   (`document.intervention_id === interventionId`) — en plus de la clé étrangère composite qui
   ferme déjà l'autre société. Son seul appelant actuel (`deposerPhotoIntervention`) ne peut pas
   violer cette règle structurellement, mais la fonction est appelable directement (même patron
   que `checklistDuBon`) : le refus se tient ici, pas seulement chez cet appelant.

   La résolution/pin du gabarit (`resoudreOuPinnerVersionChecklist`) est EXTRAITE de
   `enregistrerReponses` et PARTAGÉE : une photo de point `photo` peut être la toute première
   réponse d'une intervention, et doit pinner exactement comme n'importe quelle autre réponse.

2. **Aucune seconde chaîne de dépôt** — `POST /api/terrain/[id]/photos` et
   `components/interventions/photos-terrain.tsx` gagnent un champ facultatif
   `checklist_point_id` (hidden input compris, pour le formulaire natif sans JavaScript), porté
   aussi par le geste hors réseau `GestePhoto` (`lib/terrain/file-saisies.ts`,
   `lib/terrain/envoi-file.ts`) — la photo et sa liaison au point partent par LA MÊME requête,
   dans l'ordre.

3. **Terrain** — `components/terrain/checklist-terrain.tsx`, cas `"photo"` de `champDuType` :
   une `PhotosTerrain` intégrée (`checklistPointId={point.id}`), `sansSession` enfin threadée
   (nouveau prop sur `ChecklistTerrain`, nécessaire parce que c'est la PREMIÈRE fois que cette
   tuile embarque un composant qui appelle `fetch` lui-même — avant 9K28 elle n'écrivait que par
   la file). Le nombre de photos déjà liées (`ReponseDeChecklist.nombrePhotos`,
   `valeurChecklistAffichee`) s'affiche en texte, sans galerie dédiée : la section « Photos »
   générale de la fiche terrain (déjà existante) montre les photos elles-mêmes — même Document,
   même route, elle les voit déjà sans aucun changement.

4. **Bons et fiche bureau** — `RenduReponseChecklistBon` gagne la nature `"photo"`
   (`documentIds`), rendue en vignette sous le point (`<img src="/api/documents/{id}/octets">`,
   déjà cloisonné par la politique « héritage » de `document`) dans `components/interventions/
   bon-tuiles.tsx` ET `app/(back-office)/interventions/[id]/page.tsx` (fiche bureau, 9K25) — deux
   call-sites, parce que la fiche bureau n'importe pas `TuileChecklist` du bon.

5. **Gardiens fermés mis à jour** — `tests/unit/db/inventaire.test.ts`,
   `tests/unit/db/perimetre-audit.test.ts` (49 tables désormais), `tests/isolation/portail-
   matrice.test.ts` (classification « client », chaînée), `scripts/lib/politiques-rls.ts`
   (`TABLES_FILIATION`/`FILIATION_ARBITREE`, et les trois politiques `verrou_ecriture_portail_*`
   écrites DANS la migration neuve — `checklist_reponse_photo` n'existait pas à 9K16, même patron
   que `sous_type_materiel` à 9K17A), `lib/db/migrations-attendues.ts`.

## UN FLAKE OUVERT, NON RÉSOLU — à lire avant de croire `pnpm test:isolation` rouge

**`tests/isolation/9k28-checklist-reponse-photo.test.ts`, le premier scénario (« accepte, lie la
photo au point… »), échoue par intermittence sous `pnpm test:isolation` COMPLET** (observé ~4 à 6
fois sur une dizaine d'exécutions complètes du run de ~240 fichiers) :

```
PostgresError: new row for relation "checklist_reponse" violates check constraint
"checklist_reponse_valeur_unique"
```

**Ce qui a été mesuré, et ce qui l'exclut :**
- Le scénario passe TOUJOURS seul, et TOUJOURS dans un sous-ensemble restreint (essayé : seul ;
  avec `9k24-checklist-bons.test.ts` + `9k25-checklist-fiche-bureau.test.ts`, 10 exécutions
  consécutives, jamais reproduit).
- Un diagnostic posé juste avant l'écriture (retiré du code final) a confirmé, à chaque
  occurrence de l'échec : `versionId`, `point` (type `photo`, bon `id`) et `params` sont corrects,
  et `checklist_reponse` ne porte AUCUNE ligne pour cette intervention au moment de l'appel.
  L'INSERT lui-même, dont le payload ne porte QUE `valeur_photo: true` parmi les six colonnes,
  est donc refusé par une contrainte qui ne devrait voir qu'une seule colonne non nulle.
- Remplacé l'`upsert` par un `findFirst` puis `create`/`update` explicites (donc sans `INSERT …
  ON CONFLICT`) : MÊME échec, à l'identique, sur le `create()` nu. Ce n'est donc pas un artefact
  de la forme SQL générée par `upsert`.
- Le code final a été REMIS à la forme `upsert` (plus idiomate, même patron qu'`enregistrerReponses`) :
  les deux formes échouent au même taux, aucune n'est donc préférable sur ce seul critère.

**Hypothèse, non vérifiée davantage faute de visibilité sur les requêtes réellement envoyées à
Postgres pendant l'échec** : un problème côté moteur de requêtes Prisma / pool de connexions sous
le débit très élevé d'une exécution complète (~2150 tests, ~120 s) — PAS un défaut de la donnée
métier, que le diagnostic a prouvée correcte à chaque occurrence.

**Ce qui n'a pas été fait, par discipline (§5, interdit absolu)** : ni retry, ni `skip`, ni
assouplissement de l'assertion. Le scénario reste tel qu'écrit.

**À faire par qui reprend** : rejouer `pnpm test:isolation` (plusieurs fois si besoin — le run
isolé passe toujours) ; si ça persiste, inspecter `pg_stat_activity`/les logs Postgres au moment
précis de l'échec, ou isoler avec `log_statement = 'all'` pendant un run complet pour voir la
requête SQL réellement reçue par le serveur sur ce `INSERT`.

## Points immuables (D235) inchangés

Aucun gabarit semé par ce lot — les points `photo` seront désignés à la saisie des gabarits
(CK10, décision du 11/11/2026, hors territoire ici).

## NON FAIT — budget de temps épuisé avant ces points

- **Épreuves de bout en bout** (375 px terrain, 1280 px bon/fiche bureau) : non écrites. Le
  chemin complet (migration, domaine, route, offline, bons, fiche bureau) est couvert par les
  épreuves unitaires et d'isolation ci-dessus, mais AUCUNE épreuve Playwright n'exerce l'écran
  réellement pour ce ticket.
- **Captures AVANT/APRÈS** (375 et 1280 px) : non prises. `docs/propositions/9K28-CHECKLIST-
  REPONSE-PHOTO/captures/` reste vide. `scripts/captures.mts` n'a pas été rejoué.
- **Relecture du gardien `getByText`/`getByRole` non exacts sur « Photo »/« Ajouter »** dans
  `tests/e2e/**` : non faite.

Ces trois points restent DUS. Le prochain lot sur ce territoire — ou une session dédiée avant de
livrer CK10 — doit les traiter avant de considérer 9K28 réellement terminé au sens de la
définition du §5.

## Portée (fichiers touchés)

Voir `docs/arbitrages.md` D244, section « Portée ».
