import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite } from "@/lib/auth/porte";
import { cloturerIntervention } from "@/lib/interventions/depot";
import { schemaCloture } from "@/lib/interventions/saisie";

import { champ, versLaFiche } from "../../actions";

/**
 * CLÔTURER — saisir le temps réel, et voir l'arrondi et le plancher s'appliquer
 * (RG-TAR-05, D83).
 *
 * Zod refuse ici ce que la base refuse là : un temps absent, nul ou négatif.
 * Les deux disent la même chose, et c'est voulu — *une action refusée à l'écran
 * mais acceptée par la base est un trou*, et l'inverse est un écran qui ment.
 *
 * **D131 (23/09/2026, DROITS-1).** `exigerCapacite` remplace `contexteCourant()` :
 * un rôle sans `cloturer_intervention` — le client, par exemple — n'atteint
 * plus `cloturerIntervention` du tout. Le ○ du technicien passe la porte ;
 * c'est `cloturerIntervention` qui juge s'IL est le technicien affecté (la
 * porte ne juge jamais la PORTÉE, voir `lib/auth/porte.ts`).
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
  const contexte = await exigerCapacite("cloturer_intervention");
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
