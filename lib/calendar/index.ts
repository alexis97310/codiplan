/**
 * `lib/calendar` — le module qui répond à « QUAND » (ticket L0-08, I7, D13).
 *
 * Ce qui vit ici : les fuseaux, les instants et leur lecture locale, les
 * récurrences, les calendriers d'ouverture par **agence**, les jours fériés
 * appliqués, les jours et heures ouvrés, les semaines ISO 8601.
 *
 * **Ce qui n'y vit pas, et n'y entrera pas : la facturation** (D45). Ni arrondi
 * de durée à visée tarifaire, ni taux de majoration, ni assiette : ils
 * appartiennent à la valorisation, ticket L2-09. Le calendrier dit combien de
 * minutes sont hors ouverture ; il ne dit pas ce qu'elles coûtent. Sans cette
 * frontière, un changement de tarif casserait un planning, et le gardien
 * calendrier défendrait deux règles qui n'ont aucune raison d'évoluer ensemble.
 *
 * `paques.ts` n'est volontairement PAS réexporté : son calcul produit les
 * données de la table `jour_ferie` et n'est appelé que par le seed (point 4 du
 * ticket). Un métier qui l'importerait recalculerait des fériés au lieu de les
 * lire.
 */
export {
  aMinutes,
  anneeCourante,
  cleJour,
  comparerJours,
  decalageMinutes,
  estFuseauConnu,
  instantAMinutes,
  jourDe,
  jourSuivant,
  lireCleJour,
  lireFuseau,
  maintenant,
  minuit,
  minutesDepuisMinuit,
  schemaFuseau,
  versInstant,
  versLocal,
  MINUTES_PAR_JOUR,
  type DateLocale,
  type Fuseau,
  type JourLocal,
} from "./fuseau";
export {
  ecartEnJours,
  estJourSemaineIso,
  joursDeLaSemaine,
  jourSemaineIso,
  lundiDeLaSemaine,
  memeJour,
  semaineIso,
  DIMANCHE,
  LUNDI,
  SAMEDI,
} from "./semaine";
export {
  deroulerOccurrences,
  lireRecurrence,
  lireRegleHebdomadaire,
  occurrenceDuJour,
  schemaRegleHebdomadaire,
  type Creneau,
  type Recurrence,
  type RegleHebdomadaire,
} from "./recurrence";
export {
  appliquerEcarts,
  estChome,
  jourParticulier,
  lireCalendrier,
  plagesDuJourSemaine,
  schemaCalendrier,
  schemaTerritoire,
  type Calendrier,
  type EcartAgence,
  type FaitPublic,
  type JourParticulier,
  type PlageOuverture,
} from "./calendrier";
export {
  creneauxDuJour,
  echeanceEnMinutesOuvrees,
  estJourOuvre,
  estOuvert,
  joursOuvres,
  minutesHorsOuverture,
  minutesOuvrees,
  plagesDuJour,
  prochainCreneauOuvert,
} from "./ouverture";
export {
  chargerCalendrierAgence,
  fuseauDeLAgence,
  type AgenceFuseau,
  type FenetreJours,
} from "./agence";
export {
  avertissementSiteFerme,
  conflitPose,
  departCompteurAccuse,
  echeanceSla,
  jourLocalDe,
  joursOuvresAgence,
  minutesHorsOuvertureTechnicien,
  minutesOuvreesAgence,
  type AvertissementSiteFerme,
  type ConflitCalendrier,
} from "./usages";
export {
  ecartsHorizon,
  ecartsTerritoireManquant,
  horizonSuffisant,
  jourDansNMois,
  jourExige,
  MOIS_D_AVANCE_EXIGES,
  type EtatHorizon,
} from "./horizon";
