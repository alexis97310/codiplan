import { libelleClientSite } from "@/app/(back-office)/presentation";
import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { obtenirSession } from "@/lib/auth/session";
import {
  libellesDesSites,
  compterSites,
  rechercherSites,
} from "@/lib/sites/depot";
import { schemaRechercheSite } from "@/lib/sites/saisie";

/**
 * RECHERCHE SERVEUR DE SITES, POUR UN SÉLECTEUR (SELECTEURS-1, 24/09/2026).
 *
 * `rechercherSites` existait déjà (L1-02) — cette route expose ses critères
 * par l'URL. `clientActif=1` pose `client_actif: true`, qui applique
 * EXACTEMENT le critère RG-PLA-08 que `interventions/nouvelle` posait en dur
 * (`client: { actif: true }`) avant ce lot — la même règle, une seule
 * écriture désormais (`lib/sites/depot.ts`).
 *
 * Le libellé rendu, « CLIENT — site », est composé ici avec
 * `libellesDesSites` — la même fonction que `/sites` utilise déjà pour
 * résoudre les raisons sociales d'une page de résultats, jamais une seconde
 * jointure écrite à part.
 *
 * DEPUIS 92-CREATION-2 (audit d'ergonomie du 25/09/2026, constat 7) : la
 * composition passe par `libelleClientSite` (85-PARC-SITES) plutôt qu'une
 * concaténation locale — un site qui porte le nom de son client ne se répète
 * plus deux fois dans la liste proposée (« AUTOPOINT DUCOS — AUTOPOINT
 * DUCOS »), même règle que `/parc` applique déjà à son filtre.
 */
async function traiter(requete: Request): Promise<Response> {
  const session = await obtenirSession(requete.headers);
  if (session === null || session.contexte.societeId === null) {
    return Response.json({ erreur: "session_absente" }, { status: 401 });
  }

  const url = new URL(requete.url);
  const saisie = schemaRechercheSite.safeParse({
    texte: url.searchParams.get("q") ?? undefined,
    client_id: url.searchParams.get("client") ?? undefined,
    actifs_seulement: true,
    inclure_sans_equipement: true,
    sous_contrat_seulement: false,
    client_actif:
      url.searchParams.get("clientActif") === "1" ? true : undefined,
    limite: 20,
    page: url.searchParams.get("page") ?? undefined,
  });
  if (!saisie.success) {
    return Response.json({ erreur: "requete_invalide" }, { status: 400 });
  }
  const criteres = saisie.data;

  const [resultats, total] = await Promise.all([
    rechercherSites(session.contexte, criteres),
    compterSites(session.contexte, criteres),
  ]);
  const { clients } = await libellesDesSites(session.contexte, resultats);

  return Response.json({
    resultats: resultats.map((site) => ({
      id: site.id,
      libelle: libelleClientSite(
        clients.get(site.client_id) ?? "",
        site.libelle,
      ),
      // `interventions/nouvelle` compose `client_id:site_id` à partir de ce
      // champ (`app/api/interventions/creer/route.ts` attend ce couple sur un
      // seul champ) ; `/parc/nouvelle` l'ignore et soumet `id` seul. La route
      // rend les deux, chaque appelant choisit par `versValeurChamp`
      // (`components/ui/selecteur-recherche.tsx`).
      clientId: site.client_id,
    })),
    page: criteres.page,
    limite: criteres.limite,
    total,
  });
}

export async function GET(requete: Request): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete));
}
