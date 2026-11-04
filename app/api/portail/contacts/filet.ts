import { versLeRetourPortail } from "./saisie-recue";

/**
 * LE FILET DES ROUTES D'ÉCRITURE DU PORTAIL (9J03-PORTAIL-CONTACTS) — même
 * forme que `avecFilet` (`app/api/interventions/actions.ts`, 74-FORMULAIRES-3,
 * SAV-02) : une panne pendant l'écriture ramène à l'écran avec un message,
 * jamais une page d'erreur brute.
 *
 * **Pourquoi ce filet est nécessaire ICI précisément.** `creerContact` et
 * `modifierContact` (`lib/contacts/depot.ts`, hors territoire de ce ticket)
 * ne reconnaissent que les violations de contrainte CONNUES — pas le refus de
 * la politique `WITH CHECK` de `contact` (SQLSTATE `42501`) qu'un `site_id`
 * hors du périmètre du compte déclenche. Ce refus-là lève donc une erreur que
 * `motifDeLErreur` ne convertit pas, et sans ce filet elle remonterait en page
 * d'erreur brute plutôt qu'en refus lisible — exactement la faute que
 * SAV-02 a nommée pour la fiche intervention.
 *
 * Une exception de REDIRECTION Next porte un `digest` qui commence par
 * `NEXT_` : ce n'est pas une panne, elle continue sa route sans être avalée.
 */
export async function avecFiletPortail(
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
    console.error("portail contacts", erreur);
    return versLeRetourPortail("contacts.refus.erreur_serveur");
  }
}
