/**
 * Référentiel client (ticket L1-01, module M1 du chapitre 7).
 *
 * `saisie` porte les règles de saisie — pures, éprouvables sans base ;
 * `depot` porte les accès, tous cloisonnés par le contexte de session ;
 * `code-externe` porte le libellé paramétrable par société (D29).
 */
export {
  LIMITE_RECHERCHE_MAXIMALE,
  LIMITE_RECHERCHE_PAR_DEFAUT,
  schemaCreationClient,
  schemaModificationClient,
  schemaRechercheClient,
  type CreationClient,
  type ModificationClient,
  type RechercheClient,
} from "./saisie";
export {
  compterClients,
  compterSansCodeExterne,
  creerClient,
  libelleCodeExterneDeLaSociete,
  lireClient,
  modifierClient,
  rechercherClients,
  sitesParClient,
  supprimerClient,
  type FicheClient,
  type SitesDUnClient,
  type MotifRefusClient,
  type ResultatEcriture,
} from "./depot";
export { libelleCodeExterne } from "./code-externe";
