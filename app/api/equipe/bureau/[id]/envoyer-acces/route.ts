import { envoyerLienDAccesBureau } from "@/lib/auth/acces-bureau";
import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite, motifDuRefus } from "@/lib/auth/porte";

import { versLEquipeBureau } from "../../saisie-recue";

/**
 * ENVOYER (OU RÉÉMETTRE) LE LIEN D'ACCÈS D'UN COMPTE DE BUREAU (D196,
 * 9ET-COMPTES-BUREAU-1) — même garde que la route technicien
 * (`app/api/equipe/[id]/envoyer-acces/route.ts`) : `administrer_utilisateurs`,
 * `admin_societe` seul (D37). L'identifiant vient du chemin, jamais du corps
 * — un compte de bureau d'une autre société, ou un technicien, rend le MÊME
 * refus qu'un identifiant inconnu (`lib/auth/acces-bureau.ts`, motif
 * `introuvable`, D50).
 */
export async function POST(
  _requete: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(params));
}

async function traiter(params: Promise<{ id: string }>): Promise<Response> {
  const contexte = await exigerCapacite("administrer_utilisateurs");
  if (contexte === null) {
    return versLEquipeBureau(await motifDuRefus());
  }
  const { id } = await params;
  const resultat = await envoyerLienDAccesBureau(contexte, id);
  if (!resultat.accepte) {
    return versLEquipeBureau(
      resultat.motif === "introuvable"
        ? "equipe.bureau.refus.introuvable"
        : `equipe.bureau.acces.refus.${resultat.motif}`,
    );
  }

  const suite = new URLSearchParams({
    onglet: "bureau",
    motif: resultat.envoi.parti
      ? "equipe.acces.envoye"
      : "equipe.acces.non_parti",
    compte: id,
    destinataire: resultat.destinataire,
  });
  if (!resultat.envoi.parti) {
    suite.set("raison", resultat.envoi.motif);
  }
  return new Response(null, {
    status: 303,
    headers: { Location: `/parametres/equipe?${suite.toString()}` },
  });
}
