import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapaciteComplete, motifDuRefus } from "@/lib/auth/porte";
import { marquerDevisEnvoye } from "@/lib/suite-a-donner/depot";

/**
 * DEVIS ENVOYÉ (9K05-SUITES-A-DONNER-DEBLOQUEES) : `qualifiee` →
 * `accord_attendu`. Aucun champ à saisir — même porte complète que
 * « Qualifier »/« Déplacer… » sur ce même registre.
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

  const resultat = await marquerDevisEnvoye(contexte, id);
  return versLeRegistre(
    resultat.accepte ? "suites_a_donner.devis_envoye" : resultat.cle,
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
