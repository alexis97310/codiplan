import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite } from "@/lib/auth/porte";
import { succederTaux } from "@/lib/tarification/succession-taux";

import { saisieTauxRecue } from "../saisie-recue";

/**
 * POSER UN NOUVEAU TAUX HORAIRE — le chemin ORDINAIRE (TAUX-1).
 *
 * ## Le geste est en DEUX passages, et un seul écrit
 *
 * Le premier passage — sans `confirme` — ne fait QUE relire le montant
 * formaté à l'écran de confirmation ; rien n'est écrit. *« Le montant est relu
 * formaté avant d'être validé » (TAUX-1) : une erreur d'échelle doit se voir
 * avant d'être facturée, comme le geste d'amorçage le fait déjà pour le
 * premier taux.* Le second passage, avec `confirme=oui`, écrit — et lui seul.
 *
 * **Le refus retourne sur l'écran de saisie**, jamais sur la confirmation :
 * un montant ou une date refusés doivent se corriger, pas se reconfirmer.
 */
export async function POST(requete: Request): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete));
}

function vers(parametres: Record<string, string>): Response {
  const suffixe = new URLSearchParams(parametres).toString();
  return new Response(null, {
    status: 303,
    headers: {
      Location: `/parametres/taux-horaire${suffixe === "" ? "" : `?${suffixe}`}`,
    },
  });
}

async function traiter(requete: Request): Promise<Response> {
  const contexte = await exigerCapacite("parametrer_societe");
  if (contexte === null) {
    return vers({ motif: "auth.refus" });
  }

  const formulaire = await requete.formData();
  const saisie = saisieTauxRecue(formulaire);
  if (saisie === null) {
    return vers({ motif: "taux_horaire.refus.saisie" });
  }

  if (formulaire.get("confirme") !== "oui") {
    return vers({
      confirmer: "1",
      montant_mineur: String(saisie.montant_mineur),
      date_effet: saisie.date_effet,
    });
  }

  const resultat = await succederTaux(contexte, {
    montantMineur: BigInt(saisie.montant_mineur),
    dateEffet: saisie.date_effet,
  });
  if (!resultat.accepte) {
    return vers({ motif: `taux_horaire.refus.${resultat.motif}` });
  }
  return new Response(null, {
    status: 303,
    headers: { Location: "/parametres/taux-horaire" },
  });
}
