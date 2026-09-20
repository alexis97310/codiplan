import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite } from "@/lib/auth/porte";
import { modifierForfait } from "@/lib/tarification/depot-forfaits";

import { deviseDeLaSociete } from "../../devise";
import { saisieForfaitRecue } from "../../saisie-recue";

/**
 * MODIFIER UN FORFAIT (R2-20).
 *
 * **Le refus retourne sur la FICHE, pas sur le catalogue** : c'est là que la
 * saisie vit, et un refus qui renvoie à la liste ferait recommencer.
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
  const { id } = await params;
  const vers = (cle: string): Response =>
    new Response(null, {
      status: 303,
      headers: {
        Location: `/parametres/forfaits/${encodeURIComponent(id)}?motif=${encodeURIComponent(cle)}`,
      },
    });

  const contexte = await exigerCapacite("parametrer_societe");
  if (contexte === null) {
    return vers("auth.refus");
  }

  const saisie = saisieForfaitRecue(await requete.formData());
  if (saisie === null) {
    return vers("forfaits.refus.saisie");
  }

  const devise = await deviseDeLaSociete(contexte);
  if (devise === null) {
    return vers("forfaits.refus.sans_devise");
  }

  const resultat = await modifierForfait(contexte, id, saisie, devise);
  if (!resultat.accepte) {
    return vers(`forfaits.refus.${resultat.motif}`);
  }
  return new Response(null, {
    status: 303,
    headers: { Location: "/parametres/forfaits" },
  });
}
