import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerSessionActive } from "@/lib/auth/porte";
import { marquerLue } from "@/lib/notifications/depot";

import { champ } from "../../interventions/actions";

/**
 * MARQUER UNE NOTIFICATION LUE (9J10-NOTIFICATIONS-ECRAN).
 *
 * **Aucune capacité dédiée** — `exigerSessionActive` suffit, même porte que
 * l'écran (`app/(back-office)/notifications/page.tsx`) : c'est
 * `listerNotifications` qui a déjà décidé, au dépôt, quelles lignes CE
 * compte peut voir (9J09) ; `marquerLue` (`updateMany` sous le contexte
 * cloisonné, `where: { id, lue_le: null }`) ne touche de toute façon aucune
 * ligne hors de ce que la politique RLS de la société active laisse
 * atteindre — un `id` forgé ou d'une autre société ne fait rien.
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
