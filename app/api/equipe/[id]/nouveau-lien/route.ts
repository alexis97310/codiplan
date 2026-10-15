import { envoyerNouveauLienDAcces } from "@/lib/auth/acces-technicien";
import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite, motifDuRefus } from "@/lib/auth/porte";

import { versLEquipe } from "@/app/api/techniciens/saisie-recue";

/**
 * ENVOYER UN NOUVEAU LIEN D'ACCÈS À UN TECHNICIEN DONT L'ACCÈS EST DÉJÀ ACTIF
 * (D86, décision n° 86 d'Alexis, 13/10/2026 ; mot de passe oublié) — même
 * garde que `app/api/equipe/[id]/envoyer-acces/route.ts` :
 * `administrer_utilisateurs`, L'identifiant vient du chemin, jamais du
 * corps. Distincte de la route de premier envoi : ICI, et ICI SEULEMENT, le
 * cliquet de D65 est sauté (`lib/auth/acces-technicien.ts`).
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
    return versLEquipe(await motifDuRefus());
  }
  const { id } = await params;
  const resultat = await envoyerNouveauLienDAcces(contexte, id);
  if (!resultat.accepte) {
    return versLEquipe(
      resultat.motif === "introuvable"
        ? "equipe.refus.introuvable"
        : `equipe.acces.refus.${resultat.motif}`,
    );
  }

  const suite = new URLSearchParams({
    motif: resultat.envoi.parti
      ? "equipe.acces.envoye"
      : "equipe.acces.non_parti",
    technicien: id,
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
