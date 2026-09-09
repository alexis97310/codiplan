import { schemaPasCreneau } from "@/lib/calendar/parametrage";
import { avecContexteApplicatif } from "@/lib/db/client";

import { champ, contexteCourant } from "../../interventions/actions";

/**
 * RÉGLER LE PAS DES CRÉNEAUX (lot 2, I7).
 *
 * Le calendrier est écrit SOUS le contexte cloisonné : un identifiant venu d'un
 * formulaire forgé ne désigne rien hors de la société active, la politique de
 * `calendrier` étant de forme « société ». *On ne recompare pas la société
 * au-dessus de la politique* — ce serait une seconde lecture du même critère.
 *
 * Et la borne est vérifiée DEUX FOIS : par Zod ici, pour que le refus soit
 * lisible, et par la contrainte `CHECK` en base, pour qu'il soit tenu. La
 * seconde est celle qui garde.
 */
export async function POST(requete: Request): Promise<Response> {
  const vers = (cle?: string) =>
    new Response(null, {
      status: 303,
      headers: {
        Location: `/parametres/agences${cle === undefined ? "" : `?motif=${encodeURIComponent(cle)}`}`,
      },
    });

  const contexte = await contexteCourant();
  if (contexte === null) {
    return vers("auth.refus");
  }
  const formulaire = await requete.formData();
  const calendrierId = champ(formulaire, "calendrier_id");
  const pas = schemaPasCreneau.safeParse(
    Number(champ(formulaire, "pas") ?? Number.NaN),
  );
  if (calendrierId === null || !pas.success) {
    return vers("parametres.refus_pas");
  }

  const touches = await avecContexteApplicatif(contexte, (tx) =>
    tx.calendrier.updateMany({
      where: { id: calendrierId },
      data: { pas_creneau_minutes: pas.data },
    }),
  );
  // Zéro ligne touchée n'est pas une erreur technique : c'est la politique qui
  // a refusé, et elle refuse en silence. Le message est le même que pour une
  // valeur invalide — les distinguer apprendrait qu'un calendrier existe
  // ailleurs (D35, D50).
  return vers(touches.count === 0 ? "parametres.refus_pas" : undefined);
}
