import { describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/interventions/transmettre/route";
import {
  exigerCapacite,
  exigerCapaciteComplete,
  motifDuRefus,
} from "@/lib/auth/porte";

/**
 * 9CY-RETOUCHES-8, point 3 — un échec de RELECTURE des avertissements après
 * une transmission groupée (`avertirApresTransmissionGroupee`) ne doit ni
 * transformer la réponse en 500 (la transmission a déjà été écrite en base),
 * ni disparaître sans trace : il est journalisé comme les autres pannes du
 * dépôt (`app/api/interventions/actions.ts:106`).
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
    motifDuRefus: vi.fn(),
  };
});

const ID = "33333333-3333-3333-3333-333333333333";

vi.mock("@/lib/interventions/depot", () => ({
  listerPlanifieesATransmettre: vi.fn(),
  debutDuJourSociete: vi.fn(),
  transmettreEnGroupe: vi.fn().mockResolvedValue({
    transmises: ["33333333-3333-3333-3333-333333333333"],
    refusees: [],
  }),
}));

vi.mock("@/lib/avertissements/planification", () => ({
  avertirApresTransmissionGroupee: vi
    .fn()
    .mockRejectedValue(new Error("relecture indisponible")),
}));

function requete(): Request {
  const corps = new FormData();
  corps.set("id", ID);
  return new Request("http://localhost/api/interventions/transmettre", {
    method: "POST",
    body: corps,
  });
}

describe("POST /api/interventions/transmettre — relecture des avertissements en échec", () => {
  it("journalise l'erreur et ramène quand même la redirection 303 vers /planning", async () => {
    const espionErreur = vi.spyOn(console, "error").mockImplementation(() => {
      // rien — on vérifie seulement l'appel
    });
    try {
      const reponse = await POST(requete());

      expect(reponse.status).toBe(303);
      const location = reponse.headers.get("Location");
      expect(location).not.toBeNull();
      const url = new URL(location as string, "http://localhost");
      expect(url.pathname).toBe("/planning");
      expect(url.searchParams.get("transmis")).toBe("1");
      expect(url.searchParams.get("techniciens")).toBe("0");
      expect(url.searchParams.get("echecsCourriel")).toBe("0");

      expect(espionErreur).toHaveBeenCalledTimes(1);
      const [message] = espionErreur.mock.calls[0] as readonly unknown[];
      expect(message).toContain(ID);
    } finally {
      espionErreur.mockRestore();
    }
  });

  /**
   * 9D3-PLANNING-TECHNICIEN-ACTIONS — même garde-fou que
   * `deplacer-refus-saisie.test.ts` et `transmettre-compte-rendu-route.test.ts` :
   * un retour de cette route à `exigerCapacite` simple rougirait ici.
   */
  it("un TECHNICIEN est refusé : si la route revenait à exigerCapacite, ce test rougirait", async () => {
    const contexteTechnicien = {
      utilisateurId: "11111111-1111-1111-1111-111111111111",
      societeId: "22222222-2222-2222-2222-222222222222",
      role: (await import("@/lib/auth/roles")).Role.technicien,
      secondFacteurValide: true,
      adresseIp: null,
      clientId: null,
    };
    vi.mocked(exigerCapacite).mockResolvedValueOnce(contexteTechnicien);
    vi.mocked(exigerCapaciteComplete).mockResolvedValueOnce(null);
    vi.mocked(motifDuRefus).mockResolvedValueOnce("auth.refus_droit");

    const reponse = await POST(requete());
    expect(reponse.status).toBe(303);
    const location = reponse.headers.get("Location");
    expect(location).not.toBeNull();
    const url = new URL(location as string, "http://localhost");
    expect(url.pathname).toBe("/planning");
    expect(url.searchParams.get("motif")).toBe("auth.refus_droit");
  });
});
