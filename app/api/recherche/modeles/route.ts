import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { obtenirSession } from "@/lib/auth/session";
import { compterModeles, rechercherModeles } from "@/lib/materiel/depot";
import { schemaRechercheModele } from "@/lib/materiel/saisie";

/**
 * RECHERCHE SERVEUR DE MODÈLES DE MATÉRIEL, POUR UN SÉLECTEUR (SELECTEURS-1,
 * 24/09/2026) — voir `rechercherModeles`, `lib/materiel/depot.ts`, pour le
 * détail du critère.
 */
async function traiter(requete: Request): Promise<Response> {
  const session = await obtenirSession(requete.headers);
  if (session === null || session.contexte.societeId === null) {
    return Response.json({ erreur: "session_absente" }, { status: 401 });
  }

  const url = new URL(requete.url);
  const saisie = schemaRechercheModele.safeParse({
    texte: url.searchParams.get("q") ?? undefined,
    famille_id: url.searchParams.get("famille") ?? undefined,
    limite: 20,
    page: url.searchParams.get("page") ?? undefined,
  });
  if (!saisie.success) {
    return Response.json({ erreur: "requete_invalide" }, { status: 400 });
  }
  const criteres = saisie.data;

  const [resultats, total] = await Promise.all([
    rechercherModeles(session.contexte, criteres),
    compterModeles(session.contexte, criteres),
  ]);

  return Response.json({
    resultats: resultats.map((modele) => ({
      id: modele.id,
      libelle: `${modele.marque} — ${modele.reference} (${modele.familleLibelle})`,
    })),
    page: criteres.page,
    limite: criteres.limite,
    total,
  });
}

export async function GET(requete: Request): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete));
}
