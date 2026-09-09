import { annulerIntervention } from "@/lib/interventions/depot";
import { schemaAnnulation } from "@/lib/interventions/saisie";

import { champ, contexteCourant, versLaFiche } from "../../actions";

/**
 * ANNULER — avec un motif obligatoire.
 *
 * **Une annulation n'efface rien** : la ligne reste, son statut change, le
 * motif est écrit, et `journal_audit` garde la valeur d'avant. Un motif
 * facultatif serait un motif jamais renseigné.
 */
export async function POST(
  requete: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const contexte = await contexteCourant();
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
