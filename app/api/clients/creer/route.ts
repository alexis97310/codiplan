import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite } from "@/lib/auth/porte";
import { creerClient } from "@/lib/clients/depot";
import { schemaCreationClient } from "@/lib/clients/saisie";

import { champ } from "../../interventions/actions";
import { versLeFormulaire } from "./formulaire";

/**
 * CRÉER UNE FICHE CLIENT (14/09/2026, L1-01 rouvert par R3-12).
 *
 * **Le refus retourne sur le formulaire, pas sur la liste** : *un refus qui
 * renvoie ailleurs fait perdre la saisie*, et c'est la façon la plus sûre
 * d'apprendre à ne plus faire confiance à l'écran.
 *
 * Le succès mène à la FICHE créée : c'est là qu'on vérifie ce qu'on vient
 * d'écrire, et c'est de là qu'on repart.
 *
 * **La société n'est PAS lue dans le formulaire.** Aucun schéma de
 * `lib/clients/saisie.ts` ne porte de `societe_id`, et le schéma est `strict` :
 * en fournir un serait un REFUS, jamais un champ ignoré en silence. *Une
 * société transmise par l'appelant serait une habilitation auto-déclarée.*
 */
export async function POST(requete: Request): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete));
}

async function traiter(requete: Request): Promise<Response> {
  const contexte = await exigerCapacite("gerer_client_site");
  if (contexte === null) {
    return versLeFormulaire("auth.refus");
  }

  const formulaire = await requete.formData();
  // CE QUI AVAIT ÉTÉ SOUMIS, capturé AVANT toute validation
  // (9BR-TP-A4b-MESSAGES, CS23) — c'est ce qui part vers `versLeFormulaire`
  // si le schéma ou `creerClient` refusent.
  const champsResoumis = {
    raison_sociale: champ(formulaire, "raison_sociale") ?? undefined,
    code_externe: champ(formulaire, "code_externe") ?? undefined,
    ridet: champ(formulaire, "ridet") ?? undefined,
    categorie: champ(formulaire, "categorie") ?? undefined,
    conditions_reglement:
      champ(formulaire, "conditions_reglement") ?? undefined,
    commercial_referent: champ(formulaire, "commercial_referent") ?? undefined,
  };
  const saisie = schemaCreationClient.safeParse({
    raison_sociale: champ(formulaire, "raison_sociale") ?? "",
    // `champ` rend `null` sur un champ vide, et le schéma de CRÉATION range
    // `null` en absence : c'est là, et là seulement, que « non fourni » veut
    // effectivement dire « vide ».
    code_externe: champ(formulaire, "code_externe"),
    ridet: champ(formulaire, "ridet"),
    categorie: champ(formulaire, "categorie"),
    conditions_reglement: champ(formulaire, "conditions_reglement"),
    commercial_referent: champ(formulaire, "commercial_referent"),
  });
  if (!saisie.success) {
    return versLeFormulaire("client.refus.saisie", champsResoumis);
  }

  const resultat = await creerClient(contexte, saisie.data);
  if (!resultat.accepte) {
    return versLeFormulaire(`client.refus.${resultat.motif}`, champsResoumis);
  }
  return new Response(null, {
    status: 303,
    headers: {
      Location: `/clients/${resultat.fiche.id}?motif=${encodeURIComponent("clients.cree")}`,
    },
  });
}
