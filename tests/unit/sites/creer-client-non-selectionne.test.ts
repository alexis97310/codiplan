import { describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/sites/creer/route";

/**
 * CS40 (audit TP-CLI du 28/09/2026) — UN NOM DE CLIENT TAPÉ DANS LE
 * SÉLECTEUR, SANS ÊTRE CHOISI DANS LA LISTE.
 *
 * `client_id` n'est alors jamais un UUID : avant ce ticket, `schemaCreationSite`
 * refusait avec la clé générique `site.refus.saisie` — « vérifiez les champs
 * numériques et les longueurs » —, qui ne désigne rien de ce qui a vraiment
 * manqué. Ce fichier éprouve la SÉLECTION DE LA CLÉ par la route, sans
 * traverser la base — `creerSite` n'est jamais atteint puisque la saisie
 * échoue avant.
 */

vi.mock("@/lib/auth/porte", async () => {
  const { Role } = await import("@/lib/auth/roles");
  const contexte = {
    utilisateurId: "11111111-1111-1111-1111-111111111111",
    societeId: "22222222-2222-2222-2222-222222222222",
    role: Role.adv,
    secondFacteurValide: true,
    adresseIp: null,
    clientId: null,
  };
  return {
    exigerCapacite: vi.fn().mockResolvedValue(contexte),
    exigerCapaciteComplete: vi.fn().mockResolvedValue(contexte),
    motifDuRefus: vi.fn().mockResolvedValue("porte.refus"),
  };
});

const AGENCE_ID = "33333333-3333-7333-8333-333333333333";
const CLIENT_ID = "44444444-4444-7444-8444-444444444444";

function requete(champs: Readonly<Record<string, string>>): Request {
  const corps = new FormData();
  for (const [nom, valeur] of Object.entries(champs)) {
    corps.set(nom, valeur);
  }
  return new Request("http://localhost/api/sites/creer", {
    method: "POST",
    body: corps,
  });
}

async function motifDuRetour(
  champs: Readonly<Record<string, string>>,
): Promise<string | null> {
  const reponse = await POST(requete(champs));
  const location = reponse.headers.get("Location");
  expect(location).not.toBeNull();
  const url = new URL(location as string, "http://localhost");
  return url.searchParams.get("motif");
}

describe("POST /api/sites/creer, le client tapé sans être choisi dans la liste", () => {
  it("un nom de client en texte libre refuse par « client_non_selectionne », jamais le message générique", async () => {
    const motif = await motifDuRetour({
      client_id: "Dupont Électricité",
      agence_id: AGENCE_ID,
      libelle: "Atelier",
    });
    expect(motif).toBe("site.refus.client_non_selectionne");
  });

  it("un client_id VALIDE (UUID) garde le refus générique pour les AUTRES fautes de saisie", async () => {
    const motif = await motifDuRetour({
      client_id: CLIENT_ID,
      agence_id: AGENCE_ID,
      libelle: "",
    });
    expect(motif).toBe("site.refus.saisie");
  });
});
