import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite, motifDuRefus } from "@/lib/auth/porte";
import { renouvelerAttribution } from "@/lib/habilitations/depot";

import { renouvellementRecu, versLEquipe } from "../../../saisie-recue";

/**
 * RENOUVELER UNE ATTRIBUTION EXPIRÉE (9EY-EQUIPE-ALERTE-TOUT-ENVOYER,
 * point 3) — « Renouveler <CODE> » du tableau/des cartes de l'onglet
 * Techniciens. Même garde que les routes voisines de ce dossier
 * (`administrer_utilisateurs`) ; l'identifiant de l'attribution vient du
 * chemin, jamais du corps.
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
  const contexte = await exigerCapacite("administrer_utilisateurs");
  if (contexte === null) {
    return versLEquipe(await motifDuRefus());
  }
  const saisie = renouvellementRecu(await requete.formData());
  if (saisie === null) {
    return versLEquipe("habilitations.refus.saisie");
  }
  const { id } = await params;
  const resultat = await renouvelerAttribution(contexte, id, saisie);
  return versLEquipe(
    resultat.accepte ? undefined : `habilitations.refus.${resultat.motif}`,
  );
}
