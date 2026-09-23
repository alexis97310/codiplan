import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite } from "@/lib/auth/porte";
import { creerIntervention } from "@/lib/interventions/depot";
import { schemaCreation } from "@/lib/interventions/saisie";
import { uuidv7 } from "@/lib/db/uuid";

import { champ, versLaFiche, versLePlanning } from "../actions";

/**
 * CRÉER UNE INTERVENTION — UNE DEMANDE (lot 2, D84 ; PARCOURS-1, 23/09/2026,
 * arbitrage Alexis).
 *
 * Le lieu arrive sous la forme `client:site` — un seul champ pour un couple qui
 * ne se dissocie jamais. Le faire saisir en deux listes laisserait choisir un
 * lieu d'un autre client, et il faudrait alors le refuser : autant ne pas le
 * proposer.
 *
 * L'identifiant est un UUID v7 attribué ICI (I10) : c'est la même règle qui
 * permettra à l'application mobile d'en générer un hors ligne.
 *
 * **NI DATE, NI TECHNICIEN** — ce formulaire ne les poste plus, `schemaCreation`
 * ne les porte plus : *« lors de la création d'intervention, on ne peut pas
 * décider ni de la date d'intervention, ni du technicien affecté »* (Alexis,
 * 23/09/2026). C'est `PLANIFIER`, sur la fiche, qui les pose — tous ensemble.
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

  const saisie = schemaCreation.safeParse({
    id: uuidv7(),
    client_id: lieu[0],
    site_id: lieu[1],
    // AU PLUS UNE MACHINE (PARCOURS-1) — le champ reste FACULTATIF, et ce
    // n'est pas un raccourci : le dépannage à l'aveugle — on sait qu'un
    // compresseur est en panne, pas lequel — reste le cas ordinaire, et
    // RG-INT-01 n'exige une machine qu'avant de DÉMARRER, contrôle tenu en
    // base par un déclencheur. `schemaCreation.machine_ids` refuse un second
    // identifiant ; `<select>` (non `multiple` depuis ce lot) n'en soumet de
    // toute façon jamais plus d'un.
    machine_ids: formulaire.getAll("machine_ids"),
    type: champ(formulaire, "type"),
    priorite: champ(formulaire, "priorite") ?? "p3",
    mode_valorisation: champ(formulaire, "mode_valorisation") ?? "temps_passe",
    description: champ(formulaire, "description"),
    contact_id: champ(formulaire, "contact_id"),
    reference_client: champ(formulaire, "reference_client"),
  });
  if (!saisie.success) {
    // LE REFUS NOMME CE QUI CLOCHE (L3-01b) : la panne signalée est le champ
    // le plus probable d'un oubli, et « lieu inconnu » pour tout enverrait
    // chercher au mauvais endroit.
    const surLaDescription = saisie.error.issues.some((probleme) =>
      probleme.path.includes("description"),
    );
    return versLePlanning(
      surLaDescription
        ? "intervention.refus.panne_manquante"
        : "intervention.refus.lieu_inconnu",
    );
  }

  const resultat = await creerIntervention(contexte, saisie.data);
  if (!resultat.accepte) {
    return versLePlanning(resultat.cle);
  }
  return versLaFiche(resultat.fiche.id);
}
