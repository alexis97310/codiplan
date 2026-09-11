import { reprendreIntervention } from "@/lib/interventions/depot";
import { schemaReprise } from "@/lib/interventions/saisie";

import { contexteCourant, versLaFiche } from "../../actions";

/**
 * REPRENDRE une intervention suspendue (L2-10).
 *
 * **Aucune saisie** : le statut retrouvé se déduit du CRÉNEAU, et le motif
 * comme la référence sont effacés par la base — *les remettre à `null` ici
 * serait une seconde lecture d'un critère que les contraintes portent déjà.*
 */
export async function POST(
  _requete: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const contexte = await contexteCourant();
  if (contexte === null) {
    return versLaFiche(id, "auth.refus");
  }
  const saisie = schemaReprise.safeParse({ intervention_id: id });
  if (!saisie.success) {
    return versLaFiche(id, "intervention.refus.inconnue");
  }
  const resultat = await reprendreIntervention(contexte, saisie.data);
  return versLaFiche(id, resultat.accepte ? undefined : resultat.cle);
}
