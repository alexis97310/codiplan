import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite } from "@/lib/auth/porte";
import { ajouterMachineAIntervention } from "@/lib/interventions/depot";

import { avecFilet, champ, versLaFiche } from "../../actions";

/**
 * RATTACHER UNE MACHINE APRÈS COUP (chantier INT-MACHINE 2.2, 20/09/2026).
 *
 * Le dépôt écrit déjà `intervention_machine` à la CRÉATION
 * (`creerIntervention`, `lib/interventions/depot.ts`) ; cette route couvre le
 * second chemin, depuis la fiche, quand le diagnostic arrive plus tard.
 *
 * **La capacité retenue est `qualifier_affecter`** — la même que la route
 * voisine (`affecter`, juste au-dessus sur la fiche) : rattacher une machine
 * qualifie l'intervention au même titre qu'affecter un technicien, et c'est
 * un arbitrage de ce lot (ni RG-DRO-03 ni la matrice du §5.2 ne nomment
 * explicitement ce geste) — ouvert à discussion, voir la description de la
 * PR.
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
  return avecFilet(id, "machine", async () => {
    const contexte = await exigerCapacite("qualifier_affecter");
    if (contexte === null) {
      return versLaFiche(id, "auth.refus");
    }
    const formulaire = await requete.formData();
    const machineId = champ(formulaire, "machine_id");
    if (machineId === null) {
      return versLaFiche(id, "intervention.refus.machine_invalide");
    }
    const resultat = await ajouterMachineAIntervention(
      contexte,
      id,
      machineId,
    );
    return versLaFiche(id, resultat.accepte ? undefined : resultat.cle);
  });
}
