import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite } from "@/lib/auth/porte";
import { creerIntervention } from "@/lib/interventions/depot";
import { schemaCreation } from "@/lib/interventions/saisie";
import { uuidv7 } from "@/lib/db/uuid";

import { champ, versLaFiche, versLePlanning } from "../actions";

/**
 * CRÉER UNE INTERVENTION (lot 2, D84).
 *
 * Le lieu arrive sous la forme `client:site` — un seul champ pour un couple qui
 * ne se dissocie jamais. Le faire saisir en deux listes laisserait choisir un
 * lieu d'un autre client, et il faudrait alors le refuser : autant ne pas le
 * proposer.
 *
 * L'identifiant est un UUID v7 attribué ICI (I10) : c'est la même règle qui
 * permettra à l'application mobile d'en générer un hors ligne.
 */
export async function POST(requete: Request): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete));
}

async function traiter(requete: Request): Promise<Response> {
  const contexte = await exigerCapacite("creer_demande");
  if (contexte === null) {
    return versLePlanning("auth.refus");
  }
  const formulaire = await requete.formData();
  const lieu = (champ(formulaire, "site") ?? "").split(":");
  const date = champ(formulaire, "date_planifiee");

  const saisie = schemaCreation.safeParse({
    id: uuidv7(),
    client_id: lieu[0],
    site_id: lieu[1],
    // AUCUNE MACHINE À LA CRÉATION, et ce n'est pas un raccourci : l'écran de
    // création n'en propose pas, le dépannage à l'aveugle étant le cas
    // ordinaire. RG-INT-01 ne l'exige qu'avant de DÉMARRER, et c'est la base
    // qui le tient — un formulaire qui l'exigerait ici refuserait
    // d'enregistrer un appel.
    machine_ids: [],
    type: champ(formulaire, "type"),
    priorite: champ(formulaire, "priorite") ?? "p3",
    mode_valorisation: champ(formulaire, "mode_valorisation") ?? "temps_passe",
    // Un jour lu en UTC, jamais par un `Date` local : UTC+11 décale le jour
    // d'un cran, et une intervention du 1er se rangerait au 31.
    date_planifiee: date === null ? null : new Date(`${date}T00:00:00.000Z`),
    creneau_debut: null,
    creneau_fin: null,
    duree_estimee_min: null,
    technicien_id: champ(formulaire, "technicien_id"),
  });
  if (!saisie.success) {
    return versLePlanning("intervention.refus.lieu_inconnu");
  }

  const resultat = await creerIntervention(contexte, saisie.data);
  if (!resultat.accepte) {
    return versLePlanning(resultat.cle);
  }
  return versLaFiche(resultat.fiche.id);
}
