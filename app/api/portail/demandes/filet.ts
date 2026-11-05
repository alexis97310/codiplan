import { versLeRetourPortailDemandes } from "./saisie-recue";

/**
 * LE FILET DES ROUTES D'ÉCRITURE DU PORTAIL (9J04-PORTAIL-DEMANDES) — même
 * forme que `avecFiletPortail` (`app/api/portail/contacts/filet.ts`) : une
 * panne pendant le dépôt ramène à l'écran avec un message, jamais une page
 * d'erreur brute.
 *
 * Une exception de REDIRECTION Next porte un `digest` qui commence par
 * `NEXT_` : ce n'est pas une panne, elle continue sa route sans être avalée.
 */
export async function avecFiletPortailDemandes(
  action: () => Promise<Response>,
): Promise<Response> {
  try {
    return await action();
  } catch (erreur) {
    const digest =
      erreur !== null &&
      typeof erreur === "object" &&
      "digest" in erreur &&
      typeof erreur.digest === "string"
        ? erreur.digest
        : undefined;
    if (digest !== undefined && digest.startsWith("NEXT_")) {
      throw erreur;
    }
    console.error("portail demandes", erreur);
    return versLeRetourPortailDemandes("portail.demandes.refus.erreur_serveur");
  }
}
