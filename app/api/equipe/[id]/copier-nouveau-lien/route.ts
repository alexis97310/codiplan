import { copierNouveauLienDAcces } from "@/lib/auth/acces-technicien";
import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite } from "@/lib/auth/porte";
import { reponseLienCopie } from "@/lib/auth/reponse-lien-copie";

/**
 * `POST /api/equipe/<id>/copier-nouveau-lien` — COPIE UN NOUVEAU LIEN D'ACCÈS
 * (mot de passe oublié, D86) D'UN TECHNICIEN DONT L'ACCÈS EST DÉJÀ ACTIF
 * (9I6B-LIEN-ACCES-A-COPIER, D170) — même garde que
 * `app/api/equipe/[id]/copier-lien/route.ts`. Distincte de la route de
 * premier envoi : ICI, et ICI SEULEMENT, le cliquet de D65 est sauté
 * (`lib/auth/acces-technicien.ts`).
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
    return reponseLienCopie({ erreur: "acces_refuse" }, { status: 403 });
  }
  const { id } = await params;
  const resultat = await copierNouveauLienDAcces(contexte, id);
  if (!resultat.accepte) {
    return reponseLienCopie({ erreur: resultat.motif });
  }
  return reponseLienCopie({ url: resultat.url });
}
