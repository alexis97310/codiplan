import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerSessionActive } from "@/lib/auth/porte";
import { marquerLue } from "@/lib/notifications/depot";

import { champ } from "../../interventions/actions";

/**
 * MARQUER UNE NOTIFICATION LUE (9J10-NOTIFICATIONS-ECRAN).
 *
 * **Aucune capacité dédiée** — `exigerSessionActive` suffit, même porte que
 * l'écran (`app/(back-office)/notifications/page.tsx`) : `marquerLue`
 * (9J10A) revérifie elle-même, sous le contexte cloisonné, que la
 * notification est visible pour CET acteur (destinataire nommé ou collectif,
 * capacité tenue aujourd'hui) avant de poser sa propre ligne dans
 * `notification_lecture` — un `id` forgé, d'une autre société, ou visant la
 * notification personnelle d'un collègue, n'écrit rien.
 */
export async function POST(requete: Request): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete));
}

async function traiter(requete: Request): Promise<Response> {
  const contexte = await exigerSessionActive();
  if (contexte === null) {
    return new Response(null, {
      status: 303,
      headers: { Location: "/connexion" },
    });
  }
  const formulaire = await requete.formData();
  const id = champ(formulaire, "id");
  if (id !== null) {
    await marquerLue(contexte, id);
  }
  return new Response(null, {
    status: 303,
    headers: { Location: "/notifications" },
  });
}
