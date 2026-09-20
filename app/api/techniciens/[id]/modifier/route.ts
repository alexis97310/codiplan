import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite } from "@/lib/auth/porte";
import { modifierTechnicien } from "@/lib/techniciens/depot";

import { saisieModificationRecue, versLEquipe } from "../../saisie-recue";

/**
 * MODIFIER UN TECHNICIEN (ÉQUIPE-1).
 *
 * L'identifiant vient du chemin, jamais du corps — c'est le `utilisateur_id`
 * du technicien, unique DANS la société active (clé primaire composite de
 * `technicien`). Un technicien d'une autre société rend le MÊME refus qu'un
 * identifiant inconnu (D35, D50).
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
    return versLEquipe("auth.refus");
  }
  const { id } = await params;
  const saisie = saisieModificationRecue(await requete.formData());
  if (saisie === null) {
    return versLEquipe("equipe.refus.saisie");
  }
  const resultat = await modifierTechnicien(contexte, id, saisie);
  return versLEquipe(
    resultat.accepte ? undefined : `equipe.refus.${resultat.motif}`,
  );
}
