# 9K10-REPRISE-COMPLETE — passation

## 1. Mesure

- `creerReprise` — `lib/suite-a-donner/reprise.ts:63-216`. La sélection de
  `intervention_origine` (`:79-90`) ne porte que `client_id`, `site_id`,
  `agence_id`, `priorite`, `duree_estimee_min`, `forfait_deplacement_id`,
  `suite_a_donner` : ni machine, ni `contact_id`, ni `reference_client`.
  L'écriture de la ligne (`tx.intervention.create`, `:160-187`) ne pose donc
  ni l'un ni l'autre.
- Colonnes de `intervention` (`prisma/schema.prisma`) :
  - `contact_id String? @db.Uuid` (`:1761`) ;
  - `reference_client String?` (`:1765`).
- `intervention_machine` (`prisma/schema.prisma:2270-2299`) : relation
  `Intervention.machines InterventionMachine[]` (`:1678`).
  `@@unique([intervention_id])` (`:2296`) — une intervention porte une
  machine au plus (PARCOURS-1).
- Le chemin qui la pose à la création ordinaire : `creerIntervention`
  (`lib/interventions/depot.ts:642-651`) —
  `tx.interventionMachine.createMany({ data: saisie.machine_ids.map(machineId => ({ id: uuidv7(), societe_id: contexte.societeId ?? "", intervention_id: ligne.id, machine_id: machineId })) })`,
  dans la MÊME transaction que l'intervention. C'est ce chemin que `creerReprise`
  réutilise (même forme d'écriture), jamais dupliqué ailleurs.
- « Machine non active » : `STATUTS_HORS_PARC_ACTIF` —
  `lib/machines/depot.ts:132-136` — `Set<StatutMachine>(["remplacee", "ferraillee", "fusionnee"])`,
  **seule source** (le docblock l'interdit de redéclarer). `en_service`,
  `en_panne`, `arretee` restent dans le parc actif et sont donc reprises.

## 2. Reprise complète

`creerReprise` sélectionne désormais, sur `intervention_origine` :
`contact_id`, `reference_client`, et `machines: { select: { machine: { select: { id, statut } } } }`
(au plus une ligne, contrainte `@@unique([intervention_id])`).

- `contact_id` et `reference_client` sont recopiés tels quels dans
  `tx.intervention.create` (mêmes colonnes que l'origine, jamais inventés).
- Si l'origine porte une machine ET que son statut n'est PAS dans
  `STATUTS_HORS_PARC_ACTIF`, un `tx.interventionMachine.createMany` (même
  forme que `creerIntervention`) rattache CETTE machine à la reprise, dans
  la MÊME transaction.
- Si l'origine n'a pas de machine, ou que la sienne est hors parc actif, la
  reprise est créée SANS machine — aucun refus, la passation le dit (ticket).

## 3. Épreuves

- `tests/isolation/suite-a-donner-reprise.test.ts` : nouveaux scénarios —
  machine active recopiée, machine hors parc actif NON recopiée (reprise
  créée sans refus), contact et référence client recopiés, rien d'une
  autre société ne fuite (la machine ne peut être QUE celle de l'origine,
  par construction du jugement partagé — pas de test cloisonnement
  supplémentaire nécessaire ici au-delà de l'existant, la machine étant
  choisie par le serveur et non par la saisie).
- e2e : la fiche de la reprise affiche la machine de l'origine (I5,
  9K09-FICHE-CLOTURE-SUITE-ORIGINE).

## 4. État à la fin de la session

Voir le bas de ce fichier, mis à jour avant de rendre la main.
