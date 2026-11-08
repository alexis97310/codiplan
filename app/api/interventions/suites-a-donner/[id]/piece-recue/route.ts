import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapaciteComplete, motifDuRefus } from "@/lib/auth/porte";
import { marquerPieceRecue } from "@/lib/suite-a-donner/depot";

/**
 * PIÈCE REÇUE (FLX-8, 9J19 pour le mécanisme ; 9K05-SUITES-A-DONNER-
 * DEBLOQUEES pour ce bouton) : `accord_recu` → `a_replanifier`. Aucun champ
 * à saisir — même porte complète que les autres gestes de ce registre.
 */
export async function POST(
  requete: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  return dansUnEchangeAuth(() => traiter(id));
}

async function traiter(id: string): Promise<Response> {
  const contexte = await exigerCapaciteComplete("modifier_planning");
  if (contexte === null) {
    return versLeRegistre(await motifDuRefus());
  }

  const resultat = await marquerPieceRecue(contexte, id);
  return versLeRegistre(
    resultat.accepte ? "suites_a_donner.piece_recue" : resultat.cle,
  );
}

function versLeRegistre(cle: string): Response {
  return new Response(null, {
    status: 303,
    headers: {
      Location: `/interventions/suites-a-donner?motif=${encodeURIComponent(cle)}`,
    },
  });
}
