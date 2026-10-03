import { envoyerLienDAcces } from "@/lib/auth/acces-technicien";
import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite, motifDuRefus } from "@/lib/auth/porte";

import { versLEquipe } from "@/app/api/techniciens/saisie-recue";

/**
 * ENVOYER (OU RÉÉMETTRE) LE LIEN D'ACCÈS D'UN TECHNICIEN (D162, QT-1).
 *
 * Même garde que les autres routes d'Équipe : `administrer_utilisateurs`,
 * `admin_societe` seul (D37). L'identifiant vient du chemin, jamais du
 * corps — un technicien d'une autre société rend le MÊME refus qu'un
 * identifiant inconnu (`lib/auth/acces-technicien.ts`, motif `introuvable`,
 * D50).
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
  const resultat = await envoyerLienDAcces(contexte, id);
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
