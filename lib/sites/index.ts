/**
 * Référentiel des sites d'intervention (ticket L1-02, module M1 du chapitre 7).
 *
 * `zones` porte l'énumération arrêtée par D23 — close ICI, à l'entrée serveur,
 * et délibérément pas en base ;
 * `saisie` porte les règles de saisie — pures, éprouvables sans base ;
 * `depot` porte les accès, tous cloisonnés par le contexte de session, avec le
 * filtre de périmètre de sites que la politique « parc » applique.
 */
export {
  ZONES_GEOGRAPHIQUES,
  estZoneConnue,
  schemaZoneGeographique,
  type ZoneGeographique,
} from "./zones";
export {
  LIMITE_RECHERCHE_MAXIMALE,
  LIMITE_RECHERCHE_PAR_DEFAUT,
  schemaCreationSite,
  schemaModificationSite,
  schemaRechercheSite,
  type CreationSite,
  type ModificationSite,
  type RechercheSite,
} from "./saisie";
export {
  creerSite,
  lireSite,
  modifierSite,
  rechercherSites,
  supprimerSite,
  type FicheSite,
  type MotifRefusSite,
  type ResultatEcriture,
} from "./depot";
