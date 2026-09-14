import { appliquerLeLotDeClients } from "@/lib/imports/application";

import { contexteCourant } from "../../../interventions/actions";

/**
 * APPLIQUER UN LOT — LA SECONDE MOITIÉ DE I6 (L1-11 ; RG-IMP-01, RG-IMP-04).
 *
 * **C'est le SECOND geste, et il porte toute la valeur du premier.** I6 veut un
 * rapport, *puis* une validation explicite ; cette route est cette validation.
 * Elle ne reçoit ni fichier, ni ligne, ni décompte : **seulement l'identifiant
 * du lot que l'écran vient de montrer.** *Lui passer quoi que ce soit d'autre
 * rouvrirait l'écart entre ce qu'un humain a validé et ce qui sera écrit.*
 *
 * **Elle ne décide rien**, et `appliquerLeLotDeClients` non plus : la décision
 * a été prise par `lib/excel/controle.ts` et posée sur `import_lot_ligne.action`.
 *
 * **Le refus revient sur le lot, avec son motif.** Un lot déjà appliqué, un lot
 * annulé, un lot introuvable — les trois se lisent, et ils ne se corrigent pas
 * au même endroit. *Rediriger vers la liste ferait perdre de vue lequel des
 * lots a refusé.*
 */
export async function POST(
  _requete: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const versLeLot = (cle: string): Response =>
    new Response(null, {
      status: 303,
      headers: {
        Location: `/imports/${encodeURIComponent(id)}?motif=${encodeURIComponent(cle)}`,
      },
    });

  const contexte = await contexteCourant();
  if (contexte === null) {
    return versLeLot("auth.refus");
  }

  const resultat = await appliquerLeLotDeClients(contexte, id);
  if (!resultat.applique) {
    return versLeLot(`imports.refus.${resultat.motif}`);
  }
  return versLeLot("imports.applique");
}
