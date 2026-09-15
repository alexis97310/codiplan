import { cloturerIntervention } from "@/lib/interventions/depot";
import { schemaCloture } from "@/lib/interventions/saisie";

import { champ, contexteCourant, versLaFiche } from "../../actions";

/**
 * CLÔTURER — saisir le temps réel, et voir l'arrondi et le plancher s'appliquer
 * (RG-TAR-05, D83).
 *
 * Zod refuse ici ce que la base refuse là : un temps absent, nul ou négatif.
 * Les deux disent la même chose, et c'est voulu — *une action refusée à l'écran
 * mais acceptée par la base est un trou*, et l'inverse est un écran qui ment.
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
  const saisie = schemaCloture.safeParse({
    intervention_id: id,
    temps_valide_min: Number(
      champ(formulaire, "temps_valide_min") ?? Number.NaN,
    ),
  });
  if (!saisie.success) {
    return versLaFiche(id, "intervention.refus.temps_manquant");
  }
  const resultat = await cloturerIntervention(contexte, saisie.data);
  return versLaFiche(id, resultat.accepte ? undefined : resultat.cle);
}
