import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite } from "@/lib/auth/porte";
import { lireDocument } from "@/lib/documents/depot";
import { lireObjet } from "@/lib/documents/stockage";

/**
 * `GET /api/documents/{id}/octets` — LES OCTETS D'UN DOCUMENT (BON-2).
 *
 * **Aucune règle de cloisonnement n'est écrite ici** : `lireDocument` passe
 * par `avecContexteApplicatif`, donc par la politique « héritage » de
 * `document` (D93, étendue par BON-2) — un document dont la cible n'est pas
 * visible, ou dont la classe `interne` est fermée au portail, rend `null`
 * exactement comme n'importe quelle autre lecture de cette table.
 *
 * `consulter_planning` est la capacité la plus large qui couvre déjà l'accès
 * au bon — pas de capacité neuve pour un octet qu'une lecture cloisonnée
 * protège déjà.
 */
export async function GET(
  _requete: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(params));
}

async function traiter(params: Promise<{ id: string }>): Promise<Response> {
  const { id } = await params;
  const contexte = await exigerCapacite("consulter_planning");
  if (contexte === null) {
    return new Response(null, { status: 404 });
  }

  const document = await lireDocument(contexte, id);
  if (document === null) {
    return new Response(null, { status: 404 });
  }

  const octets = await lireObjet(document.objet_cle);
  return new Response(new Uint8Array(octets), {
    status: 200,
    headers: {
      "Content-Type": document.type_mime,
      "Content-Disposition": `inline; filename="${document.nom_fichier}"`,
    },
  });
}
