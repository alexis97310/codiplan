# 9K15-PORTAIL-MATRICE-LECTURE-ECRITURE — passation

Gardien : `tests/isolation/portail-matrice.test.ts` (matrice de lecture et d'écriture),
`tests/unit/portail/demande-colonnes-fermees.test.ts` (liste de colonnes propre au
portail), `lib/portail/demandes.ts` (le correctif du point 3).

Première moitié de « Sécurité du portail (base) » (décision d'Alexis du 10/11/2026,
~06:45), sans migration. **9K16 fermera ce que ce document désigne « à fermer » ; ce
tableau est son contrat d'entrée.**

## 1. Ce que ce ticket a mesuré, et ce qu'il n'a pas mesuré

- **Lecture** : pour les 59 tables du schéma, un décompte sous un contexte portail réel
  (`avecPortail`), confronté à ce que porte le propriétaire. Pour `client` et `site`
  (les deux tables où le harnais sème déjà une ligne pour CLIENT_A2, le voisin dans la
  même société), la preuve est **forte** — elle montrerait la fuite si elle existait.
  Pour les tables filles sans donnée différenciée entre deux clients d'une même société
  (la majorité), la mesure est une **borne** (jamais plus que la société entière),
  jamais une preuve d'étanchéité entre deux clients — dit dans le fichier de test à
  chaque fois qu'il s'applique.
- **Écriture** : six tables mesurées par tentative réelle d'INSERT/UPDATE (annulée) —
  les trois que le code écrit (`demande`, `contact`, `compteur_numerotation`), les deux
  que l'étude désigne comme ouvertes à tort (`utilisateur_client`,
  `utilisateur_client_site`), `intervention` (étude I3), et un témoin fermé
  (`document_recu`). **Les 52 tables restantes n'ont pas été éprouvées en écriture par
  ce ticket** — la colonne « Écriture » le dit explicitement pour chacune. 9K16 devra
  les mesurer avant de poser une politique restrictive, pas après.

## 2. Le tableau — contrat d'entrée de 9K16

| Table | Lecture (mesurée) | Écriture | 9K16 : à fermer ? |
|---|---|---|---|
| societe | societe | non mesurée | non — societe est son identité même |
| client | client (preuve forte) | non mesurée | non — lu par le code (parcDuClient) |
| site | client (preuve forte) | non mesurée | non — lu par le code (parcDuClient) |
| machine | client (borne) | non mesurée | non — lu par le code (parcDuClient) |
| contact | client (borne) | **OUVERTE, mesurée** — le code l'exerce (dépôt/modification d'un contact) | non |
| intervention | client (borne) | **OUVERTE, mesurée — À TORT (étude I3)** : aucun chemin du portail n'écrit sur `intervention` | **oui** |
| demande | client (borne) | **OUVERTE, mesurée** — le code l'exerce (chapitre 9, parcours P5) | non |
| journal_audit | fermee | non mesurée | non — I8, lecture déjà fermée au rôle client |
| utilisateur | fermee | non mesurée | non — table de désignation, pré-tenant |
| session | fermee | non mesurée | non — idem |
| compte | fermee | non mesurée | non — idem |
| verification | fermee | non mesurée | non — idem |
| second_facteur | fermee | non mesurée | non — idem |
| journal_acces | fermee | non mesurée | non — amputée de toute clause de société (D34) |
| utilisateur_client | client (via rattachement, D92) | **OUVERTE, mesurée — À TORT (étude I2)** : la clause ne contraint que « utilisateur_id = moi », jamais le client visé — un compte peut se rattacher à N'IMPORTE QUEL client de sa société | **oui** |
| utilisateur_client_site | client (via habilitation) | **OUVERTE, mesurée — À TORT (étude I2)** | **oui** |
| utilisateur_societe | societe — **constat au-delà de l'étude** : aucun filtre client, un compte portail lit tout le personnel habilité de sa société | non mesurée | à évaluer par 9K16 (non désigné par l'étude, découvert par ce ticket) |
| document | client | non mesurée | non — lu par le code (classe « client » du bon, des fiches machine) |
| modele_materiel | client (ascendance, bornée au parc du client) | non mesurée | non — lu indirectement (fiche machine) |
| famille_materiel | client (ascendance) | non mesurée | non — idem |
| document_recu | fermee | **FERMÉE, mesurée (témoin)** | non |
| absence | fermee | non mesurée | non — aucun chemin portail |
| import_lot | fermee | non mesurée | non — aucun chemin portail |
| import_lot_ligne | fermee | non mesurée | non — aucun chemin portail |
| notification | fermee | non mesurée | non — aucun chemin portail |
| checklist_modele | fermee | non mesurée | non — aucun chemin portail |
| segment_travail | client (brèche de filiation nommée, 9J22A) | non mesurée | non — lu par le code (bon du portail) |
| site_habilitation_requise | client (filiation : site) | non mesurée | **oui, candidate — aucun chemin portail connu ne la lit** (à confirmer par 9K16) |
| intervention_machine | client (filiation : intervention) | non mesurée | non — lu indirectement (bon, parc des interventions) |
| intervention_prestation | client (filiation : intervention) | non mesurée | **oui, candidate** (à confirmer) |
| intervention_signature | client (filiation : intervention) | non mesurée | **oui, candidate** (à confirmer) |
| intervention_pause | client (filiation : intervention) | non mesurée | **oui, candidate** (à confirmer) |
| intervention_piece_remplacee | client (filiation : intervention) | non mesurée | **oui, candidate** (à confirmer) |
| intervention_statut_historique | client (filiation : intervention) | non mesurée | non — lu par le code (historique des états) |
| demande_statut_historique | client (filiation : demande) | non mesurée | non — lu par le code (historique des états) |
| suite_a_donner | client (filiation : intervention) | non mesurée | **oui, candidate** (à confirmer) |
| vgp_verification | client (filiation : machine) | non mesurée | **oui, candidate** (à confirmer) |
| vgp_observation | client (filiation : vgp_verification) | non mesurée | **oui, candidate** (à confirmer) |
| checklist_reponse | client (filiation : intervention) | non mesurée | **oui, candidate** (à confirmer — checklist encore récent, 9K08) |
| checklist_version | **fermee — chaînage** (son parent `checklist_modele` est « interne », l'EXISTS qui l'ouvrirait rend toujours zéro) | non mesurée | non — déjà fermée par chaînage |
| checklist_point | **fermee — chaînage** (même raison) | non mesurée | non — déjà fermée |
| notification_lecture | **fermee — chaînage** (parent `notification`, « interne » sans brèche) | non mesurée | non — déjà fermée |
| devise | societe (en réalité ouverte à TOUTES les sociétés, D4) | non mesurée | non — référentiel public, hors périmètre de confidentialité |
| parite | societe (idem) | non mesurée | non |
| jour_ferie | societe (idem) | non mesurée | non |
| agence | societe | non mesurée | non — lu par le code (bon, tarifs, calendriers) |
| calendrier | societe | non mesurée | non — idem |
| calendrier_plage | societe | non mesurée | non — idem |
| calendrier_ferie | societe | non mesurée | non — idem |
| compteur_numerotation | societe | **OUVERTE, mesurée** — le code l'exerce (incrément à chaque dépôt) | non |
| forfait | societe | non mesurée | non — lu par le code (tarifs) |
| prestation | societe | non mesurée | non — lu par le code (bon) |
| taux_horaire | societe | non mesurée | non — lu par le code (bon, tarifs) |
| technicien_calendrier | societe | non mesurée | non évalué par l'étude (hors I4b) |
| technicien | societe | non mesurée | **oui — étude §4 I4b, confirmé** : aucun chemin de `app/(portail)/**`, `app/api/portail/**` ni `lib/portail/**` ne le lit (grep, 10/11/2026) |
| habilitation | societe | non mesurée | **oui — étude §4 I4b, confirmé** |
| technicien_habilitation | societe | non mesurée | **oui — étude §4 I4b, confirmé** |
| temps_trajet_zone | societe | non mesurée | **oui — étude §4 I4b, confirmé** |
| vgp_campagne | societe | non mesurée | **oui — étude §4 I4b, confirmé** |

## 3. Les cinq tables de l'étude (§4 I4b) — confirmées, pas supposées

`technicien`, `habilitation`, `technicien_habilitation`, `temps_trajet_zone`,
`vgp_campagne` : recherche menée le 10/11/2026 par
`grep -rln "technicienHabilitation\|technicien_habilitation\|\.habilitation\.\|tempsTrajetZone\|temps_trajet_zone\|vgpCampagne\|vgp_campagne\|prisma\.technicien\b" app/(portail)/ app/api/portail/ lib/portail/` — **zéro résultat**. Aucune des cinq
n'est lue par un chemin du portail aujourd'hui ; la marque « à fermer » est donc
fondée, pas recopiée de l'étude sans vérification.

## 4. Les candidates AU-DELÀ de l'étude — découvertes par cette matrice, à trancher par 9K16

L'étude du 08/11 ne nommait que cinq tables (I4b). En appliquant la même question à
TOUTES les tables de filiation (visibles aujourd'hui dès que leur intervention/demande
l'est, par construction de la forme « filiation »), sept autres n'ont **aucun chemin de
lecture connu côté portail** : `site_habilitation_requise`, `intervention_prestation`,
`intervention_signature`, `intervention_pause`, `intervention_piece_remplacee`,
`suite_a_donner`, `vgp_verification`, `vgp_observation`, `checklist_reponse`. Elles sont
marquées « candidate » plutôt que « confirmée » dans le tableau : ce ticket n'a pas
grepé chacune aussi systématiquement que les cinq de l'étude (budget de 120 minutes),
et une lecture existante, oubliée par ce grep rapide, ferait de la fermeture une
régression. **9K16 doit refaire la vérification nommément, table par table**, avant de
fermer quoi que ce soit — exactement la même discipline que ce ticket a appliquée aux
cinq de l'étude.

Un second constat, hors de toute liste de l'étude : `utilisateur_societe` (forme
« appartenance ») n'a AUCUN filtre client — un compte portail actif sur une société lit
le nom et le rôle de tout le personnel interne habilité sur cette société. Ni l'étude ni
ce ticket ne le referment ; c'est un fait mesuré (§2 du tableau), à verser au dossier de
9K16 pour décision.

## 5. Le point 3 — ce qui a été corrigé, ce qui était déjà fermé

- **`lib/portail/demandes.ts` (nouveau)** — `demandesOuvertesDuPortail` /
  `demandesTraiteesDuPortail`, avec leur propre `SELECTION_DEMANDE_PORTAIL`, au lieu de
  `CHAMPS_DEMANDE` (`lib/demandes/depot.ts`, qui sert aussi la file ADV, R2-21). Même
  discipline que `lib/portail/historique-etats.ts` (9J08B) et
  `lib/portail/interventions.ts` (9J05) : un champ ajouté à `CHAMPS_DEMANDE` pour le
  bureau n'atteint plus le portail par réutilisation. `app/(portail)/portail/demandes/
  page.tsx` et `vue.tsx` basculés sur la nouvelle fonction et le nouveau type. Gardien :
  `tests/unit/portail/demande-colonnes-fermees.test.ts`, même patron que les quatre
  gardiens existants. **`demande` ne porte aujourd'hui aucune colonne interne ou de
  montant** : ce correctif referme une dérive FUTURE, il ne corrige aucune fuite
  actuelle.
- **`lib/portail/depot.ts::parcDuClient`** — utilisait déjà `SELECTION_FICHE_MACHINE_
  PORTAIL` pour les machines (vérifié par lecture directe du fichier, commit actuel) :
  rien à faire, contrairement à ce que l'étude du 08/11 affirmait (elle datait d'avant
  ce correctif, déjà livré entre-temps par un autre lot).
- **Le bon du portail** (montant_ht, valorisation_figee, taux) — déjà fermé par
  `tests/unit/portail/bon-sans-montant.test.ts` (9J08A-REPRISE-9J08), rejoué et vert
  lors de ce ticket. `lib/interventions/bon.ts::composerBon` calcule le taux et le
  montant pour les DEUX appelants (bureau et portail) par architecture délibérée
  (« rend le taux et le montant SANS décider qui a le droit de les [afficher] ») ; c'est
  la PAGE du portail qui ne les affiche jamais, et c'est elle que le gardien mesure.
  Aucune action : ce n'était pas une fuite, c'est une séparation calcul/affichage déjà
  éprouvée.
- **`garantie_fin`** — non touché, comme demandé (Q4 non tranchée par Alexis).

## 6. Épreuves jouées

- `pnpm test:isolation` complet : 233 fichiers, 2083 tests, tous verts.
- `pnpm test` complet : 509 fichiers, 5592 tests, tous verts.
- E2E (`CI=1 --workers=1`) : les seize specs dont le nom contient « portail » +
  `tous-les-ecrans-rendent.spec.ts` — 147 passés, 3 ignorés (conditionnels), 0 échec.
- `CI=1 pnpm verify` (format:check, typecheck, lint, test, test:isolation, build) : vert.

## 7. Limites assumées, à lire avant d'ouvrir 9K16

- La matrice de lecture est une **classification**, dérivée des formes de politique
  déjà mesurées ailleurs (`scripts/lib/politiques-rls.ts`) et confrontée empiriquement
  quand une donnée différenciée existait. Elle n'a pas semé de données nouvelles pour
  distinguer deux clients sur les ~45 tables filles — faute de budget, dit explicitement
  dans le fichier de test et ici.
- La matrice d'écriture ne couvre que 7 tables sur 59. Les 52 autres portent la mention
  « non mesurée » — ni ouvertes ni fermées par constat direct, seulement par déduction
  de la forme de lecture (une table « fermée » en lecture rendrait très probablement une
  écriture refusée aussi, mais ce n'est PAS mesuré ici).
- `utilisateur_societe` et les sept candidates du §4 sont des DÉCOUVERTES de ce ticket,
  pas des éléments de l'étude du 08/11 : elles demandent une décision d'Alexis ou une
  vérification plus poussée avant toute fermeture — ce ticket ne tranche rien, il
  recense.
