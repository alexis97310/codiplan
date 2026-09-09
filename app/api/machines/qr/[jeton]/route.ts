import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { obtenirSession } from "@/lib/auth/session";
import { resoudreParJeton } from "@/lib/machines/resolution";

/**
 * `GET /api/machines/qr/{jeton}` — LA RÉSOLUTION D'UN SCAN (L2-02, D22).
 *
 * ## Ce chemin est MINCE, et c'est une règle du dépôt
 *
 * Il lit la session, délègue à `lib/machines/resolution`, et met en forme. Rien
 * d'autre : *le cloisonnement se prouve sous le rôle applicatif restreint, par
 * la fonction que l'application appelle réellement*, et une règle écrite ici ne
 * s'éprouverait qu'en montant un navigateur.
 *
 * ## TROIS RÉPONSES, ET DEUX SEULEMENT SONT DISTINGUABLES
 *
 * `401` sans session — l'appelant doit s'authentifier, et le lui dire ne révèle
 * rien. `200` avec la fiche. Et `404` pour **tout le reste** : jeton mal formé,
 * jeton inconnu, machine d'une autre société, machine hors du périmètre d'un
 * compte portail. Les distinguer ferait de ce chemin un ORACLE — *ce jeton
 * existe-t-il quelque part ?* —, c'est-à-dire un moyen d'apprendre depuis un
 * compte quelconque qu'une machine étiquetée appartient à un concurrent (D35,
 * D50). Un scénario d'isolation mesure l'indiscernabilité.
 *
 * ## Ce que la réponse ne porte pas
 *
 * Aucune chaîne destinée à un humain : la coupure de L0-11 met les libellés au
 * dictionnaire, et cette réponse est lue par une machine. L'écran qui l'affiche
 * choisira ses mots.
 */
async function traiter(
  requete: Request,
  contexte: { params: Promise<{ jeton: string }> },
): Promise<Response> {
  const session = await obtenirSession(requete.headers);
  if (session === null) {
    return Response.json({ erreur: "session_absente" }, { status: 401 });
  }

  const { jeton } = await contexte.params;
  const machine = await resoudreParJeton(session.contexte, jeton);
  if (machine === null) {
    // LE MÊME REFUS POUR QUATRE CAUSES. Voir l'en-tête : les séparer
    // transformerait ce chemin en oracle.
    return Response.json({ erreur: "introuvable" }, { status: 404 });
  }

  return Response.json({ machine });
}

/**
 * L'ÉCHANGE D'AUTHENTIFICATION EST OUVERT ICI (D64).
 *
 * `obtenirSession` passe par la bibliothèque, qui relit puis **réécrit** des
 * lignes en les nommant par leur `id` — une clé qui n'est la désignation
 * d'aucune de ces tables. Sans échange ouvert, ces écritures ne reçoivent aucun
 * report, la politique lit une variable vide et **refuse en silence**.
 *
 * *L'oubli casse la fonctionnalité ; il n'ouvre jamais rien* — c'est le seul
 * sens de défaillance acceptable ici, et c'est ce qui rend la liste des
 * ouvertures gardable. `tests/unit/auth/echange.test.ts` déduit sa population
 * du dépôt : cette route y est entrée d'elle-même, et le gardien l'a réclamée.
 */
export async function GET(
  requete: Request,
  contexte: { params: Promise<{ jeton: string }> },
): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete, contexte));
}
