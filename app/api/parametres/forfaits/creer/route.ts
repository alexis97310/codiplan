import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapaciteComplete, motifDuRefus } from "@/lib/auth/porte";
import { creerForfait } from "@/lib/tarification/depot-forfaits";

import { champ } from "../../../interventions/actions";
import { deviseDeLaSociete } from "../devise";
import { saisieForfaitRecue } from "../saisie-recue";
import { versLeFormulaire } from "./formulaire";

/**
 * CRÉER UN FORFAIT (R2-20).
 *
 * **Le refus retourne sur le catalogue avec son motif**, et non sur une page
 * blanche : *un refus qui renvoie ailleurs fait perdre la saisie.* Le catalogue
 * porte le formulaire, si bien que le retour est aussi le lieu de la correction.
 */
export async function POST(requete: Request): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete));
}

async function traiter(requete: Request): Promise<Response> {
  const contexte = await exigerCapaciteComplete("parametrer_societe");
  if (contexte === null) {
    return versLeFormulaire(await motifDuRefus());
  }

  const formulaire = await requete.formData();
  // CE QUI AVAIT ÉTÉ SOUMIS, capturé AVANT toute validation
  // (9BR-TP-A4b-MESSAGES, PV-45).
  const champsResoumis = {
    forfait_code: champ(formulaire, "code") ?? undefined,
    forfait_libelle: champ(formulaire, "libelle") ?? undefined,
    forfait_type: champ(formulaire, "type") ?? undefined,
    forfait_rang: champ(formulaire, "rang") ?? undefined,
    forfait_montant_mineur: champ(formulaire, "montant_mineur") ?? undefined,
    forfait_zone_geo: champ(formulaire, "zone_geo") ?? undefined,
    forfait_cumulable_temps:
      formulaire.get("cumulable_temps") !== null ? "1" : "0",
    forfait_actif: formulaire.get("actif") !== null ? "1" : "0",
  };

  const saisie = saisieForfaitRecue(formulaire);
  if (saisie === null) {
    return versLeFormulaire("forfaits.refus.saisie", champsResoumis);
  }

  // LA DEVISE VIENT DE LA SOCIÉTÉ, jamais du formulaire : I2 veut qu'un montant
  // soit stocké dans la devise de sa société, et la laisser saisir ouvrirait la
  // porte à un forfait en euros dans un catalogue en francs.
  const devise = await deviseDeLaSociete(contexte);
  if (devise === null) {
    return versLeFormulaire("forfaits.refus.sans_devise", champsResoumis);
  }

  const resultat = await creerForfait(contexte, saisie, devise);
  if (!resultat.accepte) {
    return versLeFormulaire(`forfaits.refus.${resultat.motif}`, champsResoumis);
  }
  return new Response(null, {
    status: 303,
    headers: { Location: "/parametres/forfaits" },
  });
}
