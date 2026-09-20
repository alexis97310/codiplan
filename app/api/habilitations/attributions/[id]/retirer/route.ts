import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite } from "@/lib/auth/porte";
import { retirerAttribution } from "@/lib/habilitations/depot";

import { versLEquipe } from "../../../saisie-recue";

/**
 * RETIRER UNE ATTRIBUTION (ÉQUIPE-2).
 *
 * L'identifiant vient du chemin. Contrairement au référentiel, il n'y a pas
 * de bascule d'activité ici : une attribution posée par erreur se retire, elle
 * ne se désactive pas — voir l'en-tête de `lib/habilitations/depot.ts`.
 */
export async function POST(
  _requete: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(_requete, params));
}

async function traiter(
  _requete: Request,
  params: Promise<{ id: string }>,
): Promise<Response> {
  const contexte = await exigerCapacite("administrer_utilisateurs");
  if (contexte === null) {
    return versLEquipe("auth.refus");
  }
  const { id } = await params;
  const resultat = await retirerAttribution(contexte, id);
  return versLEquipe(
    resultat.accepte ? undefined : `habilitations.refus.${resultat.motif}`,
  );
}
