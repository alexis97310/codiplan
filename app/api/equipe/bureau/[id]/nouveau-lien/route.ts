import { envoyerNouveauLienDAccesBureau } from "@/lib/auth/acces-bureau";
import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite, motifDuRefus } from "@/lib/auth/porte";

import { versLEquipeBureau } from "../../saisie-recue";

/**
 * ENVOYER UN NOUVEAU LIEN D'ACCÈS À UN COMPTE DE BUREAU DONT L'ACCÈS EST
 * DÉJÀ ACTIF (D86, décision n° 86 d'Alexis, 13/10/2026) — même garde que
 * `app/api/equipe/bureau/[id]/envoyer-acces/route.ts`. Distincte de la route
 * de premier envoi : ICI, et ICI SEULEMENT, le cliquet de D65 est sauté
 * (`lib/auth/acces-bureau.ts`).
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
  const resultat = await envoyerNouveauLienDAccesBureau(contexte, id);
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
