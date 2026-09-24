import {
  avertirApresPlanification,
  clesAvertissementCourriel,
} from "@/lib/avertissements/planification";
import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite } from "@/lib/auth/porte";
import { affecterTechnicien } from "@/lib/interventions/depot";

import { avecFilet, champ, versLaFiche } from "../../actions";

/**
 * AFFECTER UN TECHNICIEN (RG-PLA-04) — l'affectation est **bloquée**, pas
 * signalée.
 *
 * Le refus d'habilitation revient à l'écran par sa clé, et il s'y affiche à la
 * place de l'action. Il ne se contourne pas ici : le dépôt le prononce, et le
 * cycle de vie en base tient le reste.
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
  return avecFilet(id, "affecter", async () => {
    const contexte = await exigerCapacite("qualifier_affecter");
    if (contexte === null) {
      return versLaFiche(id, "auth.refus");
    }
    const formulaire = await requete.formData();
    const technicien = champ(formulaire, "technicien_id");
    if (technicien === null) {
      return versLaFiche(id, "intervention.refus.habilitation");
    }
    const resultat = await affecterTechnicien(contexte, id, technicien);
    // AVERTISSEMENTS-1 : le courriel part APRÈS que la transaction a validé,
    // jamais dans `affecterTechnicien` — même raison que pour le déplacement.
    const compteRenduCourriel =
      resultat.accepte && resultat.etatAvant !== undefined
        ? await avertirApresPlanification(contexte, id, resultat.etatAvant)
        : null;
    const avertissements =
      compteRenduCourriel === null
        ? undefined
        : clesAvertissementCourriel(compteRenduCourriel);
    return versLaFiche(
      id,
      resultat.accepte ? undefined : resultat.cle,
      avertissements !== undefined && avertissements.length > 0
        ? avertissements
        : undefined,
    );
  });
}
