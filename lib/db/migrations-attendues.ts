/**
 * LES MIGRATIONS QUE LE CODE DÉPLOYÉ ATTEND (panne du 11/09/2026).
 *
 * ## Pourquoi cette liste existe, et ce qu'elle répare
 *
 * `/sante` affirmait « migrations à jour » en interrogeant `_prisma_migrations`
 * et en cherchant **une ligne en échec**. Or une migration **jamais appliquée
 * n'a pas de ligne** : la recherche ne trouvait rien, et la réponse était
 * « oui ».
 *
 * > **La question posée était « une migration a-t-elle échoué ? », et la réponse
 * > était rendue sous le libellé « les migrations sont-elles à jour ? ».** Ce
 * > sont deux questions différentes, et la seconde **ne peut pas se répondre
 * > depuis la base seule** — il y faut ce que le dépôt attend.
 *
 * *Mesuré le 11/09/2026 : sept migrations manquaient à la base de démonstration,
 * `/planning` rendait une exception serveur, et `/sante` répondait quatre oui.*
 *
 * ## C'est une RECOPIE, et ce qui la confronte est un gardien
 *
 * Le code déployé ne peut pas lire `prisma/migrations/` : le répertoire n'est
 * pas embarqué dans le paquet de production. La liste est donc écrite ici —
 * *et le test à faire passer à toute duplication qui se prétend inévitable est
 * « qu'est-ce qui confronterait les deux copies ? »* (§9, 01/09).
 *
 * La réponse est `tests/unit/db/migrations-attendues.test.ts` : il lit le
 * répertoire — une source que ce module ne contrôle pas — et **rougit dans les
 * deux sens**, une migration ajoutée au dépôt comme une entrée qui ne
 * s'adosserait à rien. Une migration créée demain fait donc échouer `verify`
 * tant qu'elle n'est pas inscrite ici.
 *
 * ## Ce que ce module NE fait pas
 *
 * Il ne dit pas si une migration est **juste**, ni si elle a été **appliquée** :
 * il dit ce que le code attend. Le rapprochement avec la base est fait par
 * `sante.ts`, et par lui seul.
 *
 * ## ⚠ ET CETTE LISTE A ÉTÉ ÉCRITE DE MÉMOIRE UNE PREMIÈRE FOIS
 *
 * *Mesuré à la minute où le gardien a été lancé : **18 noms inventés, 36
 * manquants**, sur 47 répertoires réels.* C'est la faute même qu'on répare ici —
 * **affirmer un état observable au lieu de l'observer** (§9, 07/09) —, commise
 * en la réparant. Elle n'a coûté qu'une exécution parce que la confrontation
 * existait AVANT la liste.
 *
 * **La liste se GÉNÈRE donc depuis le répertoire, elle ne se rédige pas.** Et
 * le gardien reste ce qui la tient : une liste générée une fois est une liste
 * écrite à la main dès le lendemain.
 */

/**
 * Les noms de répertoire de `prisma/migrations/`, dans l'ordre où Prisma les
 * applique — c'est-à-dire l'ordre lexical de leur horodatage.
 *
 * **Ordre conservé, et ce n'est pas décoratif** : il rend le rapport lisible
 * quand plusieurs manquent — *la première manquante est celle par laquelle la
 * base a décroché.*
 */
export const MIGRATIONS_ATTENDUES: readonly string[] = [
  "20260819000000_init",
  "20260820120000_rls_policies",
  "20260820130000_force_rls_role_applicatif",
  "20260820140000_identifiants_uuid",
  "20260820150000_authentification_et_roles",
  "20260820160000_arbitrages_l0_06b",
  "20260821120000_calendriers_agence_et_feries",
  "20260823130000_territoire_du_ferie_reference",
  "20260824040000_note_asymetrie_message_cloisonne",
  "20260828120000_charte_societe_optionnelle",
  "20260829120000_journal_audit",
  "20260901120000_client_l1_01",
  "20260906120000_site_l1_02",
  "20260907120000_perimetre_sites_l1_02b",
  "20260907130000_identites_cloisonnees_l1_02c",
  "20260907140000_contact_l1_03",
  "20260908090000_categorie3_cloisonnee_l1_02d",
  "20260908120000_habilitations_l1_04",
  "20260908140000_enrolement_second_facteur_l1_02f",
  "20260908160000_plancher_second_facteur_d62",
  "20260908170000_familles_et_modeles_l1_05",
  "20260908180000_taux_horaire_historise_l1_07",
  "20260908190000_forfaits_l1_06",
  "20260909100000_amorcage_premier_compte_q1",
  "20260909110000_deverrouillage_escalade_l7_04",
  "20260909120000_societe_de_mes_habilitations_q8",
  "20260909130000_retrait_taux_horaire_defaut_q3",
  "20260909140000_retrait_heures_incluses_q4",
  "20260909150000_machine_l2_01",
  "20260909160000_designation_du_client_portail",
  "20260909200000_intervention_l2_planning",
  "20260909210000_parametrage_par_agence",
  "20260910000000_reemission_premier_acces",
  "20260910010000_trajet_donnee_de_planification_d74",
  "20260910020000_statut_fusionnee_d28",
  "20260910030000_forfait_rang_d86",
  "20260911010000_rattachement_portail_d92",
  "20260911020000_assujettissement_vgp_l9",
  "20260913100000_documents_l8",
  "20260913110000_bac_de_reception_l8_07",
  "20260913120000_lot_dimport_l1_08e",
  "20260913130000_annulation_import_l1_08j",
  "20260913140000_demande_l2_06",
  "20260913150000_intervention_machines_l2_08a",
  "20260913160000_suspension_l2_10",
  "20260913170000_technicien_l3_01a",
  "20260913180000_absence_l3_04",
  "20260913190000_trajet_par_zone_r3_03",
  "20260913200000_reference_interne_unique_d6",
  "20260913210000_statut_affectee_d8",
  "20260913220000_statut_facturation_d8",
  "20260913230000_prestation_l1_12",
  "20260913240000_vgp_verification_l9",
  "20260913250000_rattrapage_suspensions_r3_02",
  "20260914100000_plages_reglables_r3_13",
  "20260914110000_absence_reglable_r3_14",
  "20260914200000_chevauchement_apres_ecriture",
];
