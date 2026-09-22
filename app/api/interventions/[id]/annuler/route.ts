import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite } from "@/lib/auth/porte";
import { annulerIntervention } from "@/lib/interventions/depot";
import { schemaAnnulation } from "@/lib/interventions/saisie";

import { champ, versLaFiche } from "../../actions";

/**
 * ANNULER — avec un motif obligatoire.
 *
 * **Une annulation n'efface rien** : la ligne reste, son statut change, le
 * motif est écrit, et `journal_audit` garde la valeur d'avant. Un motif
 * facultatif serait un motif jamais renseigné.
 *
 * **D131 (23/09/2026, DROITS-1).** `annuler_intervention` ne porte AUCUN ○ :
 * le technicien n'annule jamais, une annulation étant une décision
 * commerciale du bureau. Il n'y a donc rien à juger ici de plus que la porte —
 * à la différence de « clôturer » et « suspendre / reprendre ».
 */
export async function POST(
  requete: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete, params));
}

async function traiter(
  requete: Request,
  params: Promise<{ id: string }>,
): Promise<Response> {
  const { id } = await params;
  const contexte = await exigerCapacite("annuler_intervention");
  if (contexte === null) {
    return versLaFiche(id, "auth.refus");
  }
  const formulaire = await requete.formData();
  const saisie = schemaAnnulation.safeParse({
    intervention_id: id,
    motif: champ(formulaire, "motif") ?? "",
  });
  if (!saisie.success) {
    return versLaFiche(id, "intervention.annulation.obligatoire");
  }
  const resultat = await annulerIntervention(contexte, saisie.data);
  return versLaFiche(id, resultat.accepte ? undefined : resultat.cle);
}
