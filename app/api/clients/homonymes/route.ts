import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite } from "@/lib/auth/porte";
import {
  rechercherClients,
  sitesParClient,
  type FicheClient,
} from "@/lib/clients/depot";
import {
  LIMITE_RECHERCHE_MAXIMALE,
  schemaRechercheClient,
} from "@/lib/clients/saisie";
import { normaliserRaisonSociale } from "@/lib/excel/rapprochement";

/**
 * `GET /api/clients/homonymes?raison_sociale=` — LE DOUBLON POSSIBLE, EN
 * LECTURE SEULE (9EK-TP-UX5-2-CREATIONS-1, CS40).
 *
 * Sert `/clients/nouveau` (`AlerteHomonymes`) : à la sortie du champ Raison
 * sociale, l'écran demande s'il existe déjà une fiche dont la raison sociale
 * NORMALISÉE (`normaliserRaisonSociale`, RG-IMP-05, D29 — casse, accents,
 * ponctuation) est identique. Aucun blocage — un homonyme réel existe (CS40,
 * deux garages du même nom) — seulement un avertissement qui nomme la fiche.
 *
 * **La même capacité que la création** (`gerer_client_site`) : cette route ne
 * lit rien qu'un compte qui peut créer un client ne verrait déjà par
 * `/api/recherche/clients`, mais elle rend l'état de la fiche (`actif`) et le
 * nombre de sites — une lecture dédiée, pas une extension d'une route
 * partagée par un sélecteur.
 *
 * **Candidats bornés par `rechercherClients`, puis filtrés en égalité
 * EXACTE.** `rechercherClients` cherche déjà en SOUS-CHAÎNE normalisée
 * (`clientsFiltresParTexte`) — le texte tapé sert donc à borner la
 * population (jusqu'à `LIMITE_RECHERCHE_MAXIMALE`, la limite connue de toute
 * recherche de ce dépôt), et seule l'égalité normalisée STRICTE retient un
 * homonyme. Aucun masquage (`etat: "tous"`) : un client inactif EST un
 * doublon possible, et doit être nommé comme tel (CS40).
 */
async function traiter(requete: Request): Promise<Response> {
  const contexte = await exigerCapacite("gerer_client_site");
  if (contexte === null) {
    return Response.json({ erreur: "acces_refuse" }, { status: 403 });
  }

  const url = new URL(requete.url);
  const raisonSociale = url.searchParams.get("raison_sociale") ?? "";
  const normalisee = normaliserRaisonSociale(raisonSociale);
  if (normalisee.length === 0) {
    return Response.json({ resultats: [] });
  }

  const criteres = schemaRechercheClient.parse({
    texte: raisonSociale,
    etat: "tous",
    limite: LIMITE_RECHERCHE_MAXIMALE,
  });
  const candidats = await rechercherClients(contexte, criteres);
  const homonymes = candidats.filter(
    (client: FicheClient) =>
      normaliserRaisonSociale(client.raison_sociale) === normalisee,
  );
  const sites = await sitesParClient(contexte, homonymes);

  return Response.json({
    resultats: homonymes.map((client) => ({
      id: client.id,
      raison_sociale: client.raison_sociale,
      commune: sites.get(client.id)?.communes[0] ?? null,
      nombreSites: sites.get(client.id)?.nombre ?? 0,
      actif: client.actif,
    })),
  });
}

export async function GET(requete: Request): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete));
}
