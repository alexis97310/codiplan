import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite } from "@/lib/auth/porte";
import { creerExigence } from "@/lib/habilitations/depot";

import { champ } from "../../../interventions/actions";
import { exigenceRecue, versLeSite } from "../../saisie-recue";

/**
 * DÉCLARER UNE EXIGENCE SUR UN SITE (ÉQUIPE-2).
 *
 * Depuis la fiche d'un site, `/sites/[id]`. `site_id` voyage dans le corps —
 * c'est un champ caché du formulaire, jamais une valeur choisie par
 * l'utilisateur — et sert aussi de cible de retour : même une saisie invalide
 * doit revenir sur LA FICHE, pas sur une page blanche ni sur la liste des
 * sites.
 */
export async function POST(requete: Request): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete));
}

async function traiter(requete: Request): Promise<Response> {
  const formulaire = await requete.formData();
  const siteId = champ(formulaire, "site_id");
  if (siteId === null) {
    // Aucune cible de retour connue — le champ caché lui-même est absent, ce
    // qu'aucun formulaire de cet écran ne produit. La liste reste le seul
    // point de chute raisonnable.
    return new Response(null, {
      status: 303,
      headers: { Location: "/sites?motif=habilitations.refus.saisie" },
    });
  }
  const contexte = await exigerCapacite("administrer_utilisateurs");
  if (contexte === null) {
    return versLeSite(siteId, "auth.refus");
  }
  const saisie = exigenceRecue(formulaire);
  if (saisie === null) {
    return versLeSite(siteId, "habilitations.refus.saisie");
  }
  const resultat = await creerExigence(contexte, saisie);
  return versLeSite(
    siteId,
    resultat.accepte ? undefined : `habilitations.refus.${resultat.motif}`,
  );
}
