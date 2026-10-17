# 9F4H2-HORS-RESEAU-HEURE-ET-REJEU — passation

**MIGRATION : clic DB migrate & seed par Alexis après publication**

Décisions n° 107 et 108 d'Alexis (14/10/2026). Côté SERVEUR des lots 2/3 annoncés
par 9F4H1 (D213) : les routes acceptent désormais une saisie faite hors réseau,
sans rien perdre ni doubler. Le bouton « Envoyer » et la file sur le téléphone
restent 9F4H3.

## Ce qui a été livré, point par point

1. **Migration** `20261018060000_segment_hors_reseau_et_rejeu_terminer` — deux
   colonnes, aucune politique RLS touchée, aucune fonction `SECURITY DEFINER` :
   - `segment_travail.saisi_hors_reseau boolean NOT NULL DEFAULT false` ;
   - `intervention.terminer_operation_id uuid` (nullable, sans clé étrangère —
     même famille que `hors_ouverture_confirmee_par`, D93).
2. **Le compteur en différé** (`app/api/terrain/[id]/compteur/route.ts`,
   `lib/interventions/depot-compteur.ts`) — `instant_appareil` et
   `operation_id`, facultatifs et TOUJOURS PAR PAIRE (un seul des deux présent,
   ou mal formé, refuse `compteur.refus.saisie_differee_invalide`, rien n'est
   écrit). Bornes choisies : plus de 5 min dans le futur
   (`compteur.refus.instant_futur`) ou plus de 7 jours dans le passé
   (`compteur.refus.instant_trop_ancien`). Au démarrage, `operation_id` DEVIENT
   l'`id` du segment (I10) : un rejeu (même personne, même intervention) est
   reconnu sans colonne dédiée. Un `operation_id` d'une autre personne ou d'une
   autre société est refusé par la MÊME clé générique
   (`compteur.refus.operation_invalide`), qu'il soit invisible sous RLS (I1) ou
   qu'il heurte l'unicité de l'`id` à la création (capturé, `P2002`) — jamais de
   distinction qui nommerait ce qui a été heurté.
3. **L'arrêt se rejoue SANS `operation_id`** — choix du pilote laissé ouvert par
   le ticket : l'arrêt ne crée pas de ligne (il en ferme une), donc rien à
   reconnaître par un identifiant. La forme retenue : si AUCUN compteur ne
   tourne mais qu'un segment de CETTE personne est déjà fermé à cet INSTANT
   APPAREIL EXACT, c'est que ce même arrêt a déjà réussi — accepté, rien de
   plus écrit. La route reçoit tout de même `operation_id` par souci de
   symétrie avec le démarrage, mais ne le lit à aucun moment pour l'arrêt.
4. **Terminer en différé** (`lib/interventions/depot-rapport-terrain.ts`,
   `terminerIntervention`) — ferme le segment ouvert à l'heure de l'appareil
   (marqué `saisi_hors_reseau`), et pose `terminer_operation_id` dans la MÊME
   transaction que `statut = 'terminee'`. Un renvoi du même `operation_id` sur
   une intervention déjà terminée PAR CETTE opération répond accepté
   (`rejoue: true`) sans rien réécrire ; la route saute alors
   `alerterResponsablesSAV` — un seul courriel par terminaison réelle, jamais
   un second sur un rejeu. Une intervention terminée PAR UNE AUTRE VOIE (ou un
   `operation_id` différent) garde le refus normal du cycle de vie
   (`intervention.refus.pas_en_cours`).
5. **La signature accepte un `id` fabriqué par l'appareil**
   (`enregistrerSignature`, 5ᵉ paramètre facultatif) — un renvoi du même `id`
   rend la ligne existante ; un `id` d'une autre intervention est refusé (même
   mécanisme `P2002` que le compteur). La règle 9F4 « saisie identique à la
   dernière = pas de nouvelle ligne » reste intacte, inchangée, et s'applique
   AVANT la vérification de rejeu par `id`.
6. **`lib/interventions/saisie-differee.ts`** — module NEUF, séparé de
   `depot-compteur.ts` à dessein : `depot-compteur.ts` importe
   `fuseauDeLAgence` (donc `lib/calendar/*`) pour d'autres fonctions, et le
   faire porter aussi le type/schéma partagé par la route `terminer` aurait
   entraîné ce graphe dans un test qui ne le mocke pas
   (`tests/unit/interventions/terrain-routes-json.test.ts`, mesuré en cours de
   lot : la première version importait `schemaSaisieDifferee` depuis
   `depot-compteur.ts`, et ce test a rougi sur `MINUTES_PAR_JOUR` absent d'un
   mock de `@/lib/calendar/fuseau`).
7. **La mention ADV** — `SegmentAffiche.saisiHorsReseau`
   (`lib/interventions/depot.ts`), affichée sur la ligne de segment concernée
   de l'onglet « Temps » (`intervention.realisation.saisi_hors_reseau`), et en
   avertissement dans `DialogueCloturer`
   (`intervention.cloture.avertissement_hors_reseau`) dès qu'au moins un
   segment de l'intervention est marqué. **Jamais sur le bon d'intervention** :
   `SegmentBonAffiche` (`lib/interventions/bon.ts`) ne porte pas ce champ, non
   touché par ce lot.
8. **Épreuves** : unitaires (`tests/unit/interventions/compteur.test.ts`,
   bornes de `verifierInstantAppareil`) ; isolation NEUVE
   (`tests/isolation/9f4h2-hors-reseau-heure-et-rejeu.test.ts`, 9 scénarios —
   démarrer/arrêter hors réseau de bout en bout avec rejeu ×2, les deux bornes,
   `operation_id` d'une autre personne et d'une autre société, terminer rejoué
   avec et sans `operation_id` correspondant, signature rejouée et signature
   avec `id` d'une autre intervention) ; e2e NEUVE
   (`tests/e2e/9f4h2-mention-hors-reseau.spec.ts`, captures 375/1280 en
   viewport dans `captures/`).
9. **D214** (`docs/arbitrages.md`) — la décision complète, condition de
   réouverture : le jour où 9F4H3 (la file sur le téléphone, le bouton
   « Envoyer ») livre.

## Captures — ce qu'elles montrent

- `onglet-temps-{375,1280}.png` — la ligne de segment porte
  « — saisi hors réseau (heure du téléphone) » après le nom du technicien, la
  période et la durée.
- `dialogue-cloturer-hors-reseau-{375,1280}.png` — le dialogue « Clôturer »
  affiche « Au moins un segment de temps a été saisi hors réseau, à l'heure du
  téléphone. » sous l'aide habituelle, le champ « Temps validé » restant saisi
  normalement par l'ADV.

## Points ouverts, pour 9F4H3

- Le CHEMIN CLIENT (téléphone → ces routes, avec `instant_appareil` et
  `operation_id` fabriqués sur l'appareil, file et bouton « Envoyer ») n'existe
  pas encore : ce lot rend le serveur CAPABLE de recevoir cette saisie, rien de
  plus.
- Les bornes (5 min futur, 7 jours passé) sont un choix du pilote, pas une
  règle du cahier des charges — à confirmer ou ajuster si l'usage réel du
  terrain les heurte.

## Fin de lot

Épreuves voisines rejouées : `pnpm test:isolation` entier (183 fichiers, 1625
tests, vert) ; e2e `fiche-cloturer`, `fiche-cloturer-replie`,
`fiche-onglets-sur-place`, `fiche-intervention`, `terrain`, `rapport-terrain`,
`9de-terminer-signature`, `bon-4`, `bon-5`, `9f4-terrain-enregistrement-auto`,
`offline/9f4h1-consultation` — tous verts (un échec isolé de
`rapport-terrain.spec.ts` sous 12 workers parallèles, non reproduit en
`--workers=1` : flake de contention déjà connu du harnais, étranger à ce lot,
jamais mesuré rouge sur ce ticket).

`CI=1 pnpm verify:full` : voir `verify-final.txt`.
