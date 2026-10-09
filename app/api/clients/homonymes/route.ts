import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite } from "@/lib/auth/porte";
import { clientsHomonymesExacts, sitesParClient } from "@/lib/clients/depot";
import { RAISON_SOCIALE_LONGUEUR_MAXIMALE } from "@/lib/clients/saisie";

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
 * **`clientsHomonymesExacts` porte l'égalité EXACTE sur TOUTE la population
 * filtrée** (solde 9EP point 41) — jamais seulement une page triée, qui
 * pouvait laisser passer l'homonyme exact derrière plus de 200 candidats
 * substring. Aucun masquage (`etat: "tous"`, posé par la fonction elle-même) :
 * un client inactif EST un doublon possible, et doit être nommé comme tel
 * (CS40).
 *
 * **Le paramètre est borné À LA MÊME longueur que la raison sociale** (200,
 * `RAISON_SOCIALE_LONGUEUR_MAXIMALE`) AVANT toute lecture de la base — un
 * texte plus long ne peut égaler aucune fiche existante.
 */
async function traiter(requete: Request): Promise<Response> {
  const contexte = await exigerCapacite("gerer_client_site");
  if (contexte === null) {
    return Response.json({ erreur: "acces_refuse" }, { status: 403 });
  }

  const url = new URL(requete.url);
  const raisonSociale = url.searchParams.get("raison_sociale") ?? "";
  if (raisonSociale.length > RAISON_SOCIALE_LONGUEUR_MAXIMALE) {
    return Response.json({ resultats: [] });
  }

  const homonymes = await clientsHomonymesExacts(contexte, raisonSociale);
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
