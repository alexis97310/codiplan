import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite } from "@/lib/auth/porte";
import { reglerLePas } from "@/lib/calendar/depot";
import { avecContexteApplicatif } from "@/lib/db/client";

import { champ } from "../../interventions/actions";

/**
 * RÉGLER LE PAS DES CRÉNEAUX (lot 2, I7 ; amendé par R3-13).
 *
 * Le calendrier est écrit SOUS le contexte cloisonné : un identifiant venu d'un
 * formulaire forgé ne désigne rien hors de la société active, la politique de
 * `calendrier` étant de forme « société ». *On ne recompare pas la société
 * au-dessus de la politique* — ce serait une seconde lecture du même critère.
 *
 * **R3-13 a déplacé l'écriture dans `lib/calendar/depot.ts`, et ce n'est pas un
 * rangement.** Le pas et les plages sont désormais réglables tous les deux, et
 * ils doivent s'accorder : un pas plus grand que la plus courte plage rendrait
 * une grille VIDE — un jour affiché comme ouvert sur lequel le planning ne
 * propose rien. Le refus est prononcé au même endroit pour les deux sens ;
 * l'écrire ici en aurait fait une seconde lecture, et c'est celle qui vieillit
 * sans rougir.
 *
 * La borne du pas reste vérifiée DEUX FOIS : par Zod, pour que le refus soit
 * lisible, et par la contrainte `CHECK` en base, pour qu'il soit tenu.
 */
export async function POST(requete: Request): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete));
}

async function traiter(requete: Request): Promise<Response> {
  const vers = (cle?: string) =>
    new Response(null, {
      status: 303,
      headers: {
        Location: `/parametres/agences${cle === undefined ? "" : `?motif=${encodeURIComponent(cle)}`}`,
      },
    });

  const contexte = await exigerCapacite("parametrer_societe");
  if (contexte === null) {
    return vers("auth.refus");
  }
  const formulaire = await requete.formData();
  const calendrierId = champ(formulaire, "calendrier_id");
  if (calendrierId === null) {
    return vers("parametres.refus_pas");
  }

  const reglage = await avecContexteApplicatif(contexte, (tx) =>
    reglerLePas(
      tx,
      calendrierId,
      Number(champ(formulaire, "pas") ?? Number.NaN),
    ),
  );
  // Un calendrier hors périmètre rend le MÊME refus qu'une valeur invalide : les
  // distinguer apprendrait qu'un calendrier existe ailleurs (D35, D50).
  return vers(reglage.ok ? undefined : reglage.motif);
}
