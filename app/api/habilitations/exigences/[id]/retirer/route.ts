import { retirerExigence } from "@/lib/habilitations/depot";

import { champ, contexteCourant } from "../../../../interventions/actions";
import { versLeSite } from "../../../saisie-recue";

/**
 * RETIRER UNE EXIGENCE DE SITE (ÉQUIPE-2).
 *
 * L'identifiant de l'EXIGENCE vient du chemin ; celui du SITE, dont l'écran a
 * besoin pour le retour, voyage en champ caché — la même raison que
 * `exigences/creer`.
 */
export async function POST(
  requete: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const formulaire = await requete.formData();
  const siteId = champ(formulaire, "site_id");
  if (siteId === null) {
    return new Response(null, {
      status: 303,
      headers: { Location: "/sites?motif=habilitations.refus.saisie" },
    });
  }
  const contexte = await contexteCourant();
  if (contexte === null) {
    return versLeSite(siteId, "auth.refus");
  }
  const { id } = await params;
  const resultat = await retirerExigence(contexte, id);
  return versLeSite(
    siteId,
    resultat.accepte ? undefined : `habilitations.refus.${resultat.motif}`,
  );
}
