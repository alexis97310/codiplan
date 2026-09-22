import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite } from "@/lib/auth/porte";
import { cloreSansSuite } from "@/lib/demandes/depot";
import { schemaCloture } from "@/lib/demandes/saisie";

import { champ } from "../../../interventions/actions";
import { versLaFicheDemande } from "../../actions";

/**
 * CLORE SANS SUITE (DEMANDES-1) — le motif est EXIGÉ, comme `schemaCloture`
 * l'exige déjà : *cette information est conservée, elle mesure le service
 * rendu à distance* (chapitre 7/M3).
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
  const contexte = await exigerCapacite("creer_demande");
  if (contexte === null) {
    return versLaFicheDemande(id, "auth.refus");
  }
  const formulaire = await requete.formData();
  const saisie = schemaCloture.safeParse({
    id,
    motif: champ(formulaire, "motif"),
  });
  if (!saisie.success) {
    return versLaFicheDemande(id, "demande.cloture.motif_requis");
  }
  const resultat = await cloreSansSuite(contexte, saisie.data);
  return versLaFicheDemande(id, resultat.accepte ? undefined : resultat.cle);
}
