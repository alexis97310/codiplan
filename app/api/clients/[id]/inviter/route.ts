import { z } from "zod";

import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { inviterClientAuPortail } from "@/lib/auth/lien-d-acces";
import { exigerCapacite } from "@/lib/auth/porte";

/**
 * `POST /api/clients/<id>/inviter` — INVITE UN CLIENT AU PORTAIL : génère (ou
 * réémet) le lien de premier accès de son compte, et accorde le rattachement
 * à ce client (9J02A-REPRISE-9J02, D96, D230).
 *
 * **Garde `administrer_utilisateurs`, PAS `gerer_client_site`** (D230) : une
 * requête forgée par un ADV reçoit `{ erreur: "acces_refuse" }` ici — rien
 * n'est écrit — avant même d'atteindre `inviterClientAuPortail`, qui vérifie
 * de nouveau la capacité (défense en profondeur).
 *
 * **Rend l'URL en JSON plutôt que de rediriger**, même discipline que
 * `/api/equipe/[id]/copier-lien` (D170) : c'est l'écran, côté NAVIGATEUR, qui
 * la pose dans le presse-papiers — elle n'est jamais écrite ici dans une
 * trace, un journal ou une page.
 *
 * **`Cache-Control: no-store` sur toute réponse** — même motif que
 * `/api/equipe/[id]/copier-lien` : un lien de premier accès est un secret au
 * porteur.
 */
const Saisie = z.object({ email: z.string().trim().toLowerCase().email() });

function reponseInvitation(
  corps: Readonly<{
    readonly url?: string | null;
    readonly dejaActif?: boolean;
    readonly erreur?: string;
  }>,
  init?: ResponseInit,
): Response {
  return Response.json(corps, {
    ...init,
    headers: { ...init?.headers, "cache-control": "no-store" },
  });
}

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
  const contexte = await exigerCapacite("administrer_utilisateurs");
  if (contexte === null) {
    return reponseInvitation({ erreur: "acces_refuse" }, { status: 403 });
  }

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return reponseInvitation({ erreur: "client_introuvable" });
  }

  const corpsRequete: unknown = await requete.json().catch(() => null);
  const saisie = Saisie.safeParse(corpsRequete);
  if (!saisie.success) {
    return reponseInvitation({ erreur: "email_invalide" });
  }

  const resultat = await inviterClientAuPortail(
    contexte,
    id,
    saisie.data.email,
  );
  if (!resultat.accepte) {
    return reponseInvitation({ erreur: resultat.motif });
  }
  return reponseInvitation({
    url: resultat.url,
    dejaActif: resultat.dejaActif,
  });
}
