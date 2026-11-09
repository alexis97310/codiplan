import { z } from "zod";

import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { copierNouveauLienDAccesPortail } from "@/lib/auth/lien-d-acces";
import { exigerCapacite } from "@/lib/auth/porte";
import { reponseLienCopie } from "@/lib/auth/reponse-lien-copie";

/**
 * `POST /api/clients/<id>/comptes/<utilisateurId>/copier-nouveau-lien` —
 * COPIE UN NOUVEAU LIEN D'ACCÈS (mot de passe oublié) D'UN COMPTE DU PORTAIL
 * CLIENT DONT L'ACCÈS EST DÉJÀ ACTIF (9K14-PORTAIL-COPIER-NOUVEAU-LIEN,
 * D223/D226 appliquées) — même forme que
 * `app/api/equipe/bureau/[id]/copier-nouveau-lien/route.ts`.
 *
 * `<id>` désigne le CLIENT, `<utilisateurId>` le compte du portail : la
 * fiche client peut lister plusieurs comptes pour un même client, et
 * `copierNouveauLienDAccesPortail` doit vérifier le rattachement des DEUX,
 * jamais de l'un seul.
 */
export async function POST(
  _requete: Request,
  { params }: { params: Promise<{ id: string; utilisateurId: string }> },
): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(params));
}

async function traiter(
  params: Promise<{ id: string; utilisateurId: string }>,
): Promise<Response> {
  const contexte = await exigerCapacite("administrer_utilisateurs");
  if (contexte === null) {
    return reponseLienCopie({ erreur: "acces_refuse" }, { status: 403 });
  }
  const { id, utilisateurId } = await params;
  if (
    !z.uuid().safeParse(id).success ||
    !z.uuid().safeParse(utilisateurId).success
  ) {
    return reponseLienCopie({ erreur: "introuvable" });
  }

  const resultat = await copierNouveauLienDAccesPortail(
    contexte,
    id,
    utilisateurId,
  );
  if (!resultat.accepte) {
    return reponseLienCopie({ erreur: resultat.motif });
  }
  return reponseLienCopie({ url: resultat.url });
}
