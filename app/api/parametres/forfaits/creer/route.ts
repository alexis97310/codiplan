import { creerForfait } from "@/lib/tarification/depot-forfaits";

import { contexteCourant } from "../../../interventions/actions";
import { deviseDeLaSociete } from "../devise";
import { saisieForfaitRecue } from "../saisie-recue";

/**
 * CRÉER UN FORFAIT (R2-20).
 *
 * **Le refus retourne sur le catalogue avec son motif**, et non sur une page
 * blanche : *un refus qui renvoie ailleurs fait perdre la saisie.* Le catalogue
 * porte le formulaire, si bien que le retour est aussi le lieu de la correction.
 */
export async function POST(requete: Request): Promise<Response> {
  const vers = (cle: string): Response =>
    new Response(null, {
      status: 303,
      headers: {
        Location: `/parametres/forfaits?motif=${encodeURIComponent(cle)}`,
      },
    });

  const contexte = await contexteCourant();
  if (contexte === null) {
    return vers("auth.refus");
  }

  const saisie = saisieForfaitRecue(await requete.formData());
  if (saisie === null) {
    return vers("forfaits.refus.saisie");
  }

  // LA DEVISE VIENT DE LA SOCIÉTÉ, jamais du formulaire : I2 veut qu'un montant
  // soit stocké dans la devise de sa société, et la laisser saisir ouvrirait la
  // porte à un forfait en euros dans un catalogue en francs.
  const devise = await deviseDeLaSociete(contexte);
  if (devise === null) {
    return vers("forfaits.refus.sans_devise");
  }

  const resultat = await creerForfait(contexte, saisie, devise);
  if (!resultat.accepte) {
    return vers(`forfaits.refus.${resultat.motif}`);
  }
  return new Response(null, {
    status: 303,
    headers: { Location: "/parametres/forfaits" },
  });
}
