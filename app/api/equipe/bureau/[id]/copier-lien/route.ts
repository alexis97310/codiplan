import { copierLienDAccesBureau } from "@/lib/auth/acces-bureau";
import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite } from "@/lib/auth/porte";
import { reponseLienCopie } from "@/lib/auth/reponse-lien-copie";

/**
 * `POST /api/equipe/bureau/<id>/copier-lien` — COPIE (SANS L'ENVOYER) LE LIEN
 * DE PREMIER ACCÈS D'UN COMPTE DE BUREAU (9I6B-LIEN-ACCES-A-COPIER, D170) —
 * même garde que la route technicien
 * (`app/api/equipe/[id]/copier-lien/route.ts`) : `administrer_utilisateurs`,
 * L'identifiant vient du chemin, jamais du corps. Rend l'URL en JSON, jamais
 * dans une trace, un journal ou une page.
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
  const resultat = await copierLienDAccesBureau(contexte, id);
  if (!resultat.accepte) {
    return reponseLienCopie({ erreur: resultat.motif });
  }
  return reponseLienCopie({ url: resultat.url });
}
