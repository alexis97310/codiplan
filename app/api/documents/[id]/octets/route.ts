import { headers } from "next/headers";

import { type ContexteSession } from "@/lib/auth/contexte";
import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite } from "@/lib/auth/porte";
import { estRolePortail } from "@/lib/auth/roles";
import { obtenirSession } from "@/lib/auth/session";
import { lireDocument, octetsDocumentDuParc } from "@/lib/documents/depot";
import { formatImageReconnu } from "@/lib/documents/formats-image";
import { lireObjet } from "@/lib/documents/stockage";
import { rattachementsDuCompte } from "@/lib/portail/depot";

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
 * au bon côté bureau et terrain — pas de capacité neuve pour un octet qu'une
 * lecture cloisonnée protège déjà.
 *
 * **Le portail n'a pas cette capacité** (décision d'Alexis du 10/11/2026) :
 * un compte client n'est jamais `peut(role, "consulter_planning")`, et le
 * bon du portail (`bonInterventionDuParc`) montre pourtant des photos — ce
 * même `<img>`, partagé avec le bureau (`components/interventions/bon-
 * tuiles.tsx`), demande donc cette même route. Un second essai, sous le rôle
 * portail et `octetsDocumentDuParc`, couvre ce cas SANS toucher au premier.
 */
export async function GET(
  _requete: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(params));
}

async function contexteParc(): Promise<ContexteSession | null> {
  const session = await obtenirSession(await headers());
  if (
    session === null ||
    session.contexte.societeId === null ||
    session.contexte.role === null ||
    !estRolePortail(session.contexte.role)
  ) {
    return null;
  }
  const rattachements = await rattachementsDuCompte(
    session.contexte.utilisateurId,
  );
  const premier = rattachements.find(
    (r) => r.societeId === session.contexte.societeId,
  );
  if (premier === undefined) {
    return null;
  }
  return { ...session.contexte, clientId: premier.clientId };
}

async function traiter(params: Promise<{ id: string }>): Promise<Response> {
  const { id } = await params;
  const contexteBureau = await exigerCapacite("consulter_planning");
  const document =
    contexteBureau !== null
      ? await lireDocument(contexteBureau, id)
      : await (async () => {
          const contexte = await contexteParc();
          return contexte === null ? null : octetsDocumentDuParc(contexte, id);
        })();
  if (document === null) {
    return new Response(null, { status: 404 });
  }

  // LES OCTETS EN BASE D'ABORD (D96) : une photo déposée depuis
  // 9EWB-PHOTOS-EN-BASE n'a plus rien sous `objet_cle` — le repli sur
  // `lireObjet` ne sert plus qu'aux documents déposés avant cette colonne.
  const octets = document.octets ?? (await lireObjet(document.objet_cle));

  // LE TYPE SERVI EST DÉDUIT DES OCTETS, jamais pris sur la foi de la
  // colonne (9EWB-PHOTOS-EN-BASE) — une image le confirme ; un document qui
  // n'en est pas une (notice, certificat) retombe sur le type stocké, que
  // `nosniff` empêche un navigateur de réinterpréter.
  const type = formatImageReconnu(octets) ?? document.type_mime;

  return new Response(new Uint8Array(octets), {
    status: 200,
    headers: {
      "Content-Type": type,
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `inline; filename="${document.nom_fichier}"`,
    },
  });
}
