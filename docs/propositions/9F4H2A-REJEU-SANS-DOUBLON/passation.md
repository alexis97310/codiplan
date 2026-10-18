# 9F4H2A-REJEU-SANS-DOUBLON — passation

Revue de 9F4H2 (publié 68d1abd5, relu sur ce commit par le pilote) : trois défauts MOYENS et deux
manques d'épreuves. Les sept points du ticket, dans l'ordre.

## Point 1 — Terminer différé : refus nommé

`terminerIntervention` (`lib/interventions/depot-rapport-terrain.ts`) fermait le segment ouvert
avec `fin: effectif` sans jamais contrôler `fin > debut` — la même borne que `peutArreter`
(`compteur.ts`) sur le geste voisin, mais jamais lue ici. Une heure d'appareil en retard (dérive
d'horloge réaliste, segment démarré en ligne puis terminé hors réseau) faisait jeter la contrainte
CHECK de la base, rattrapée par la route en `intervention.refus.erreur_serveur` générique.

Correctif : avant toute écriture, si un segment ouvert de la personne existe et que
`effectif <= debut`, refus nommé `compteur.refus.fin_avant_debut` (clé déjà existante, même sens
exact), rien d'écrit. Épreuve d'intégration : `tests/isolation/terminer-intervention.test.ts`.

## Point 2 — Terminer concurrent : un seul gagnant

La transition de statut (`intervention.update` direct) et la fermeture du segment
(`segmentTravail.update` par `id` seul) n'étaient conditionnées par RIEN d'autre que la lecture
préalable de `verdict` : deux envois concurrents (deux onglets, un double clic, un rejeu réseau)
passaient tous deux le contrôle avant que l'un n'écrive, et la route envoyait deux courriels SAV
pour un seul fait.

Correctif : les deux écritures deviennent des `updateMany` conditionnés —
`WHERE id = ... AND fin = null` pour le segment, `WHERE id = ... AND statut = 'en_cours'` pour
l'intervention —, avec contrôle du nombre de lignes affectées. Sous READ COMMITTED, Postgres relit
la ligne (donc le `WHERE`) après avoir attendu le verrou posé par le premier `UPDATE` : le perdant
ne touche aucune ligne. Il reconnaît alors le rejeu par `operation_id` (même `rejoue: true` que le
rejeu séquentiel) ou reçoit `intervention.refus.pas_en_cours` — exactement ce que `peutTerminer`
rendrait sur l'état réel. Épreuve : `tests/isolation/terminer-intervention.test.ts`, deux appels en
`Promise.all`, rejouée 3 fois sans flake observé.

## Point 3 — Photo : rejeu sans doublon

**Aucune migration nécessaire** — `Document.id` n'a jamais eu de défaut (`uuidv7()` posé par
l'appelant, I10), donc `operationId` (facultatif) peut en devenir l'`id`, même patron que le
segment de travail et la signature (`lib/interventions/saisie-differee.ts`).

`deposerPhotoIntervention` (`lib/documents/depot.ts`) lit d'abord une ligne `id = operationId` sous
CETTE intervention (rejeu reconnu, rien écrit) ; sinon la dédoublonne par empreinte (déjà existant,
inchangé) ; sinon crée avec `id: operationId ?? uuidv7()`. Une collision sur une AUTRE
intervention — jamais vue par la première lecture, scopée — échoue sur l'unicité de `id` (P2002),
rattrapée en `null` (même refus générique que le périmètre). La route (`app/api/terrain/[id]/
photos/route.ts`) lit `operation_id` SEUL (sans `instant_appareil` — une photo n'est pas datée) et
le traite comme absent s'il est absent ou mal formé. Le client de la file
(`lib/terrain/envoi-file.ts`) envoie désormais `operation_id` avec la photo, comme il le fait déjà
pour compteur/signature/terminer. Épreuve : `tests/isolation/photo-rejeu-sans-doublon.test.ts`
(même intervention rejouée deux fois → une ligne ; même id sur une autre intervention → refus,
rien écrit sur aucune des deux).

## Point 4 — Épreuves manquantes

Faites :
- **Terminer rejoué PAR LA ROUTE → un seul courriel** —
  `tests/unit/interventions/terrain-routes-json.test.ts` : `terminerIntervention` mocké à rendre
  `rejoue: true`, `alerterResponsablesSAV` n'est jamais appelé (et l'est bien, une fois, sur un
  geste normal avec `issueSignature !== "signee"`).
- **Compteur avec `operation_id` seul, sans `instant_appareil` → `saisie_differee_invalide`** —
  nouveau fichier `tests/unit/interventions/compteur-route-saisie-differee.test.ts` (démarrer ET
  arrêter), rien n'est écrit (ni `demarrerLeCompteur` ni `fuseauDuTechnicien` appelés).
- **Rapport et prestations rejoués deux fois → même état, rien de doublé** —
  `tests/isolation/rapport-terrain.test.ts`, deux nouveaux scénarios. Les deux dépôts sont des
  REMPLACEMENTS (set pour les prestations, update scalaire pour le rapport, D215 : « dernière
  valeur gagne ») : la non-duplication est structurelle, l'épreuve la confirme plutôt que la
  construire.

Non faites, volontairement, faute de temps dans le budget du lot :
- **Signature avec l'`operation_id` d'une signature d'une AUTRE société.** Le code passe par EXACTEMENT
  le même chemin que « une AUTRE intervention » déjà éprouvé
  (`tests/isolation/9f4h2-hors-reseau-heure-et-rejeu.test.ts:424`) : la pré-lecture est scopée à
  `interventionId`, et une collision d'`id` échoue sur l'unicité quelle que soit la société de la
  ligne heurtée — il n'y a pas de branche de code séparée pour « autre société » qu'« autre
  intervention » viendrait manquer. Un scénario dédié resterait une mesure utile de la RLS plutôt
  que de ce lot ; à ouvrir si un doute se présente.
- **Le bon remis au client ne contient jamais « saisi hors réseau ».** Vérifié par lecture :
  `lib/interventions/bon.ts` ne référence `saisi_hors_reseau` nulle part (grep), cohérent avec D214
  (« jamais sur le bon d'intervention remis au client »). Aucune épreuve de régression dédiée
  ajoutée — à poser si ce fichier est retouché un jour sans qu'on y pense.

## Point 5 — Heure avec décalage

`schemaSaisieDifferee.instant_appareil` n'acceptait que `z.coerce.date()`, qui lit une chaîne SANS
décalage (`"2026-09-14T08:00:00"`) à l'heure LOCALE DU SERVEUR — jamais celle de l'appareil.
Désormais : `z.string().regex(/(?:Z|[+-]\d{2}:\d{2})$/).pipe(z.coerce.date())`. Mesuré avant
d'écrire : le client (`lib/terrain/file-saisies.ts:160`) envoie `new Date().toISOString()`, qui
porte toujours `Z` — l'épreuve mode avion de 9F4H3 reste verte (mesuré, voir plus bas). Épreuve
unitaire : `tests/unit/interventions/saisie-differee.test.ts` (Z accepté, `+11:00` accepté, sans
décalage refusé, date seule refusée).

## Point 6 — D214 exacte

« TOUJOURS PAR PAIRE » ne disait pas ce qu'un champ seul ou mal formé déclenche. Mesuré en relisant
le code (pas supposé) : `compteur` refuse nommément (`compteur.refus.saisie_differee_invalide`,
AVANT toute lecture du fuseau) ; `terminer` et `enregistrerSignature` traitent le même cas comme
ABSENT — le geste part en ligne, sans protection de rejeu cette fois. Une ligne « Précision
(9F4H2A...) » posée sous D214 (`docs/arbitrages.md`) le dit, avec le comportement de la photo
(`operation_id` seul, sans pairing). Aucune décision Dxxx neuve. Gardiens `tests/unit/docs/*`
vérifiés verts après l'édition.

## Point 7 — Captures

`tests/e2e/captures-9f4h2a-fin-avant-debut.spec.ts` : démarrer hors réseau, signer, terminer hors
réseau (accepté localement, D215), puis l'entrée « terminer » de la file est reposée une minute
AVANT l'entrée « démarrer » (simule une dérive d'horloge), « Envoyer ». Le bandeau de
`BoutonEnvoyer` affiche « L'heure d'arrêt précède l'heure de départ. Vérifiez l'heure de
l'appareil. » — le refus nommé du point 1, en clair, à l'écran. Captures à 375 et 1280 px dans
`docs/propositions/9F4H2A-REJEU-SANS-DOUBLON/captures/` : les deux montrent le bandeau rouge en
tête de fiche, l'intervention restée « En cours », le compteur toujours affiché comme tournant —
cohérent avec « rien n'est écrit » (vérifié aussi côté base dans l'épreuve).

## Points ouverts

- **Chevauchement possible d'un démarrage différé avec un segment déjà fermé.** Risque ACCEPTÉ,
  non traité dans ce lot (hors territoire du ticket — aucune mention dans les 7 points).
- **L'échec isolé de `rapport-terrain.spec.ts` cité par 9F4H2** — remesuré ici : sous 8 workers
  parallèles, `rapport-terrain.spec.ts:104` (« une prestation absente du catalogue se nomme »)
  échoue une fois (timeout sur un texte visible) ; rejoué seul avec `--workers=1`, les 6 tests du
  fichier passent. Même signature que le flake déjà documenté par 9F4H2 (contention sous parallélisme,
  non reproduit à worker unique) — étranger à ce lot, qui ne touche ni les prestations ni leur
  catalogue. Non comparé bit à bit à `origin/main` faute de temps dans le budget, mais le
  changement de code de ce lot (terminer, photos, saisie-differee) ne peut pas expliquer un timeout
  sur l'affichage du catalogue de prestations.

## Fin de lot

Épreuves voisines rejouées : `pnpm test:isolation` entier (184 fichiers, 1631 tests, vert) ;
`pnpm test` entier (454 fichiers, 4861 tests, vert) ; e2e `tests/e2e/offline/*` (dont
`9f4h3-mode-avion`), `9f4h2-mention-hors-reseau`, `9f4-terrain-enregistrement-auto`,
`rapport-terrain`, `9de-terminer-signature`, `bon-4` — tous verts (voir « Points ouverts » pour le
seul accroc, déjà connu).

`CI=1 pnpm verify:full` : voir `verify-final.txt`.
