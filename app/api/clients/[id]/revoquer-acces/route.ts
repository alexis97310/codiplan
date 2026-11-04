import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { revoquerAccesPortailClient } from "@/lib/auth/lien-d-acces";
import { exigerCapacite, motifDuRefus } from "@/lib/auth/porte";

import { champ } from "../../../interventions/actions";

/**
 * `POST /api/clients/<id du rattachement>/revoquer-acces` — RÉVOQUE L'ACCÈS
 * PORTAIL D'UN COMPTE CLIENT (9J02A-REPRISE-9J02, point 5) : bascule
 * `actif = false` sur la ligne `UtilisateurClient`, jamais de suppression
 * (I6). Même forme que `/api/contacts/[id]/activite`.
 *
 * **`[id]` DÉSIGNE LA LIGNE `UtilisateurClient`**, jamais le client ni le
 * compte : une même personne peut être rattachée à plusieurs clients, chacun
 * révocable indépendamment — c'est pour cela que `retour` voyage dans le
 * formulaire plutôt que de se déduire de l'identifiant.
 *
 * **Garde `administrer_utilisateurs`** (D230) — même garde que l'invitation :
 * un ADV reçoit le refus générique, rien n'est écrit.
 */
const RETOUR_VALIDE = /^\/clients\/[0-9a-f-]{36}(\?[^\s]*)?$/;

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
  const formulaire = await requete.formData();
  const retourBrut = champ(formulaire, "retour") ?? "/clients";
  const retour = RETOUR_VALIDE.test(retourBrut) ? retourBrut : "/clients";

  const versLeRetour = (cle?: string): Response => {
    if (cle === undefined) {
      return new Response(null, { status: 303, headers: { Location: retour } });
    }
    const separateur = retour.includes("?") ? "&" : "?";
    return new Response(null, {
      status: 303,
      headers: {
        Location: `${retour}${separateur}motif=${encodeURIComponent(cle)}`,
      },
    });
  };

  const contexte = await exigerCapacite("administrer_utilisateurs");
  if (contexte === null) {
    return versLeRetour(await motifDuRefus());
  }

  const resultat = await revoquerAccesPortailClient(contexte, id);
  return versLeRetour(
    resultat.accepte
      ? "clients.acces.revoque"
      : `clients.acces.refus.${resultat.motif}`,
  );
}
