import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite } from "@/lib/auth/porte";
import { reprendreIntervention } from "@/lib/interventions/depot";
import { schemaReprise } from "@/lib/interventions/saisie";

import { avecFilet, versLaFiche } from "../../actions";

/**
 * REPRENDRE une intervention suspendue (L2-10).
 *
 * **Aucune saisie** : le statut retrouvé se déduit du CRÉNEAU, et le motif
 * comme la référence sont effacés par la base — *les remettre à `null` ici
 * serait une seconde lecture d'un critère que les contraintes portent déjà.*
 *
 * **D131 (23/09/2026, DROITS-1).** Même capacité que « suspendre » — voir
 * cette route.
 */
export async function POST(
  _requete: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(params));
}

async function traiter(params: Promise<{ id: string }>): Promise<Response> {
  const { id } = await params;
  return avecFilet(id, "reprendre", async () => {
    const contexte = await exigerCapacite("suspendre_reprendre_intervention");
    if (contexte === null) {
      return versLaFiche(id, "auth.refus");
    }
    const saisie = schemaReprise.safeParse({ intervention_id: id });
    if (!saisie.success) {
      return versLaFiche(id, "intervention.refus.inconnue");
    }
    const resultat = await reprendreIntervention(contexte, saisie.data);
    return versLaFiche(id, resultat.accepte ? undefined : resultat.cle);
  });
}
