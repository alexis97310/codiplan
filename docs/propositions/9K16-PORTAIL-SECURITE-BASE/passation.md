# 9K16-PORTAIL-SECURITE-BASE — passation

Migration : `prisma/migrations/20261110120000_portail_securite_base_9k16/`.
Arbitrage : D237 (`docs/arbitrages.md`).

**MIGRATION À JOUER par Alexis : staging puis `pnpm db:migrate` & `pnpm db:seed` (ou `pnpm db:deploy` en
production), puis Vercel.**

## 1. Ce que cette migration ferme, table par table

### Verrou TOTAL (I4 b + I3 combinés) — lecture ET écriture fermées pour un compte client

`FOR ALL RESTRICTIVE`, politique `verrou_portail` :

- `technicien`, `habilitation`, `technicien_habilitation`, `temps_trajet_zone`, `vgp_campagne` — les cinq
  confirmées par l'étude du 08/11 (§4 I4 b), aucun chemin du portail ne les lit.
- `utilisateur_societe` — constat de 9K15 au-delà de l'étude : sa forme « appartenance » ne filtrait jamais
  `app.client_id`, et aucun chemin du portail ne la lit.
- `intervention_pause` — candidate de 9K15 reconfirmée : aucun chemin applicatif ni aucun scénario
  d'isolation ne pose de contexte portail sur cette table.

### Verrou ÉCRITURE (I3 seul) — la table reste lisible, elle devient non écrivable

Trois politiques restrictives (`FOR INSERT`/`FOR UPDATE`/`FOR DELETE`, jamais `FOR ALL`) sur **30 tables** :
`client`, `site`, `machine`, `intervention`, `document`, `modele_materiel`, `famille_materiel`,
`document_recu`, `absence`, `import_lot`, `import_lot_ligne`, `notification`, `checklist_modele`,
`segment_travail`, `intervention_machine`, `intervention_prestation`, `intervention_signature`,
`intervention_piece_remplacee`, `intervention_statut_historique`, `checklist_version`, `checklist_point`,
`notification_lecture`, `checklist_reponse`, `site_habilitation_requise`, `suite_a_donner`,
`vgp_verification`, `vgp_observation`, `agence`, `calendrier`, `calendrier_plage`, `calendrier_ferie`,
`forfait`, `prestation`, `taux_horaire`, `technicien_calendrier`.

### Verrou IDENTITÉ (I2) — même forme, échappatoire d'administration

`utilisateur_client`, `utilisateur_client_site` : écriture refusée sauf `app_peut_administrer_identites()`
(D199), qu'un compte portail ne détient jamais.

### M3 — segments du technicien

`ALTER POLICY "cloisonnement_filiation_lecture_portail" ON "segment_travail"` ajoute
`"i"."cloturee_le" IS NOT NULL` à l'`EXISTS` : le client ne suit plus le technicien minute par minute pendant
l'intervention, seulement une fois le bon disponible (cohérent avec ce que le code affichait déjà).

## 2. Ce qui reste OUVERT, et pourquoi (à ne pas refermer sans relire ce qui suit)

- **`demande`, `contact`, `compteur_numerotation`** — le portail les écrit réellement (chapitre 9, P5).
- **`demande_statut_historique`** — PAS par symétrie avec `demande` : le déclencheur
  `demande_statut_historique_tracer` (jamais `SECURITY DEFINER`) y insère sous le rôle et le contexte de
  l'appelant à chaque dépôt de demande. Un verrou d'écriture ici aurait cassé le premier geste que ce ticket
  protège.
- **`societe`, `journal_audit`** — déjà fermés par leur propre forme (adhésion, journal) ; un verrou de plus
  n'y ajoute rien, et y toucher risquerait l'audit lui-même (I8).
- **`intervention_prestation`, `intervention_signature`, `intervention_piece_remplacee`** — lues par le bon
  du portail via le code PARTAGÉ avec le bureau et le terrain (`lib/interventions/bon.ts` →
  `lib/interventions/depot-rapport-terrain.ts`, `composerBon`). Le grep de 9K15 ne couvrait que
  `lib/portail/**` et les ratait ; les fermer aurait cassé le bon téléchargeable du client. Elles reçoivent le
  verrou ÉCRITURE seul.
- **`site_habilitation_requise`, `suite_a_donner`, `vgp_verification`, `vgp_observation`** — chacune porte un
  scénario d'isolation DÉDIÉ et déjà commité qui pose un contexte portail et vérifie la lecture filtrée par
  périmètre (`tests/isolation/habilitations.test.ts`, `suite-a-donner.test.ts`, `vgp-verification.test.ts`).
  **La première rédaction de cette migration les fermait** (sur la foi du seul grep applicatif, comme 9K15) ;
  `pnpm test:isolation` a immédiatement démenti, en faisant rougir ces quatre scénarios — c'est la COUCHE DE
  DONNÉES, déjà construite et éprouvée, qui attendait un écran (D231 pour `suite_a_donner`), pas un oubli à
  corriger. Elles reçoivent le verrou ÉCRITURE seul.
- **`checklist_reponse`** — D235 (09/11/2026) a choisi sa forme « filiation » PAR ANTICIPATION pour un écran
  futur (CK8). Fermer sa lecture aurait rouvert D235 sans le dire. Verrou ÉCRITURE seul (personne ne l'écrit
  hors du terrain, qui ne l'écrit pas encore non plus).

## 3. Les deux corrections au grep de 9K15, à retenir pour la suite

1. Le grep de 9K15 ne couvrait que `app/(portail)/**`, `app/api/portail/**`, `lib/portail/**` : il manque
   tout le code PARTAGÉ avec le bureau et le terrain. Un chemin de lecture peut vivre dans
   `lib/interventions/bon.ts`, invisible à ce grep.
2. Une table sans chemin APPLICATIF connu peut porter un scénario d'ISOLATION dédié qui prouve une lecture
   portail INTENTIONNELLE, en attente d'écran. `pnpm test:isolation` est la seule vérité qui voit les deux à
   la fois.

## 4. Les gardiens, mis à jour à leur source

`scripts/lib/politiques-rls.ts` gagne :

- `TABLES_VERROU_PORTAIL_TOTAL` (7 tables, liste close) ;
- `TABLES_SANS_VERROU_PORTAIL` (6 exceptions, liste close) ;
- `tablesVerrouEcriturePortail(colonnes)` — **calculée**, jamais recopiée à la main : toute table de la
  première catégorie de I1 qui n'est NI dans le verrou total, NI dans les exceptions, NI dans
  `RATTACHEES_HORS_FILIATION` (verrou identité) reçoit le verrou écriture PAR DÉFAUT. Une table métier créée
  demain est donc fermée à l'écriture tant que personne ne l'arbitre explicitement comme exception.
- `ecartsVerrouPortailTotal`, `ecartsVerrouEcriturePortail`, `ecartsVerrouIdentitePortail` — vérifient dans
  `pg_policies` (jamais dans le texte des migrations) que chaque table porte la bonne restrictive, avec le
  bon discriminant.

Ces trois contrôles sont câblés dans `ecartsPolitiques` (appelé par `tests/isolation/politiques-rls.test.ts`
contre la VRAIE base à chaque run) : c'est le gardien EXHAUSTIF sur les 50 tables de la première catégorie de
I1, pas un échantillon. Le refus générique « aucune restrictive n'est tolérée » (ligne ~1695) exempte
désormais les sept noms du verrou portail, et plus aucun autre.

## 5. Tests touchés, et pourquoi

- `tests/isolation/portail-matrice.test.ts` — classification de lecture mise à jour (7 tables `fermee`),
  matrice d'écriture étendue : `intervention`/`utilisateur_client`/`utilisateur_client_site` passent
  d'« ouverte à tort » à « fermée », plus les scénarios « société active posée » demandés par le ticket
  (changer son `client_id`, supprimer son périmètre de sites → refusés).
- `tests/isolation/9j22-portail-bon-technicien-temps.test.ts` — M3 : intervention en cours → segment
  invisible ; témoin clôturée → visible ; clause réelle vérifiée.
- `tests/isolation/document.test.ts`, `tests/isolation/machine.test.ts` — deux scénarios PRÉ-EXISTANTS
  testaient qu'un compte portail pouvait écrire `document`/`machine` DANS son périmètre (et était refusé
  seulement HORS périmètre). C'était exactement la défense en profondeur absente que I3 ferme : mis à jour
  pour asserter le refus total (silencieux, 0 ligne affectée, plus de WITH CHECK bruyant puisque la ligne est
  désormais invisible avant même d'y arriver).
- `tests/unit/db/formes-du-lot-8.test.ts` — deux fixtures synthétiques (`document`, `document_recu`,
  `modele_materiel`) complétées avec les trois politiques du verrou écriture, sans quoi le gardien réclamait
  à raison ce qu'elles ne portaient plus.
- `lib/db/migrations-attendues.ts` — migration ajoutée à la liste attendue par le code déployé.

## 6. Épreuves jouées

- `CI=1 pnpm verify` (format:check, typecheck, lint, test — 5592 tests —, test:isolation — 2088 tests —,
  build) : vert.
- E2E (`CI=1 --workers=1`) : les specs dont le nom contient `portail`, `bon`, `demande` ou `contact` (39
  fichiers) + `tous-les-ecrans-rendent.spec.ts` — 234 tests, 231 passés, 3 ignorés (conditionnels), 0 échec.
- Les fichiers de capture régénérés par les specs `captures-*` pendant cette session (purement visuels, sans
  rapport avec cette migration) ont été restaurés (`git restore docs/propositions`) avant commit.

## 7. Ce que cette migration N'est pas

Aucun écran changé. `garantie_fin` non touché (Q4 non tranchée). `app/api/portail/tarifs/contexte.ts` non
touché (D232). Aucune forme existante assouplie : le verrou s'ajoute par ET, il ne remplace rien — tout rôle
interne (bureau, technicien, tâche planifiée) garde exactement les droits qu'il avait, puisque
`app.client_id` n'y est jamais posé (D10).
