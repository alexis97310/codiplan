import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite } from "@/lib/auth/porte";
import { lireDocument } from "@/lib/documents/depot";
import { bonDocumentIdDuPret } from "@/lib/prets/depot";

/**
 * `GET /api/prets/{id}/bon` — LE PDF FIGÉ D'UN BON DE PRÊT (9L62-PRET-3-BON-
 * SIGNE).
 *
 * `consulter_planning` — MÊME capacité que `GET /api/documents/{id}/octets`
 * (`app/api/documents/[id]/octets/route.ts`) : la lecture du prêt reste
 * ouverte à tout rôle non technicien (9L61, le même commentaire sur la
 * carte de la fiche intervention), jamais `gerer_prets`, réservée à
 * l'ÉCRITURE. Le portail n'a jamais cette capacité ; `pret_equipement` est
 * de toute façon de forme « interne » (D287) — une politique RLS qu'aucun
 * contexte portail ne franchit, quelle que soit la capacité vérifiée ici.
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
  const documentId = await bonDocumentIdDuPret(contexte, id);
  const document =
    documentId === null ? null : await lireDocument(contexte, documentId);
  if (document === null || document.octets === null) {
    return new Response(null, { status: 404 });
  }
  return new Response(new Uint8Array(document.octets), {
    status: 200,
    headers: {
      "Content-Type": document.type_mime,
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `attachment; filename="${document.nom_fichier}"`,
    },
  });
}
