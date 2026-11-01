import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 9I8F-STATUT-MACHINE-MODIFIABLE — LE REFUS SERVEUR DE « FUSIONNEE », ET LE
 * PASSAGE DES CINQ AUTRES VALEURS.
 *
 * Même patron que `tests/unit/machines/creer-route-statut.test.ts` : la route
 * mockée, `changerStatutMachine` jamais atteinte quand la valeur postée est
 * hors de `STATUTS_MACHINE_CHOISISSABLES`.
 */

const STATUTS_ACCEPTES = [
  "en_service",
  "en_panne",
  "arretee",
  "remplacee",
  "ferraillee",
] as const;

vi.mock("@/lib/auth/porte", () => ({
  exigerCapacite: vi.fn().mockResolvedValue({
    utilisateurId: "11111111-1111-1111-1111-111111111111",
    societeId: "22222222-2222-2222-2222-222222222222",
    secondFacteurValide: true,
    adresseIp: null,
    clientId: null,
  }),
  motifDuRefus: vi.fn().mockResolvedValue("auth.refus_droit"),
}));

const changerStatutMachine = vi.fn();
vi.mock("@/lib/machines/depot", () => ({
  changerStatutMachine: (...args: readonly unknown[]): unknown =>
    changerStatutMachine(...args),
}));

import { POST } from "@/app/api/machines/[id]/changer-statut/route";

const MACHINE_ID = "66666666-6666-6666-6666-666666666666";

function requete(statut: string, retour?: string): Request {
  const corps = new FormData();
  corps.set("statut", statut);
  if (retour !== undefined) {
    corps.set("retour", retour);
  }
  return new Request(
    `http://localhost/api/machines/${MACHINE_ID}/changer-statut`,
    { method: "POST", body: corps },
  );
}

function params(): Promise<{ id: string }> {
  return Promise.resolve({ id: MACHINE_ID });
}

beforeEach(() => {
  changerStatutMachine.mockReset();
  changerStatutMachine.mockResolvedValue({ accepte: true, id: MACHINE_ID });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/machines/[id]/changer-statut — « fusionnee » n'atteint jamais le dépôt", () => {
  it("redirige vers /parc/<id> avec « machine.refus.statut_invalide », sans appeler changerStatutMachine", async () => {
    const reponse = await POST(requete("fusionnee"), { params: params() });
    expect(reponse.status).toBe(303);
    const url = new URL(
      reponse.headers.get("Location") as string,
      "http://localhost",
    );
    expect(url.pathname).toBe(`/parc/${MACHINE_ID}`);
    expect(url.searchParams.get("motif")).toBe("machine.refus.statut_invalide");
    expect(changerStatutMachine).not.toHaveBeenCalled();
  });

  it("une valeur forgée hors énumération est refusée de la même façon", async () => {
    const reponse = await POST(requete("inventee"), { params: params() });
    const url = new URL(
      reponse.headers.get("Location") as string,
      "http://localhost",
    );
    expect(url.searchParams.get("motif")).toBe("machine.refus.statut_invalide");
    expect(changerStatutMachine).not.toHaveBeenCalled();
  });
});

describe("POST /api/machines/[id]/changer-statut — les cinq valeurs choisissables", () => {
  for (const statut of STATUTS_ACCEPTES) {
    it(`« ${statut} » atteint changerStatutMachine, et redirige avec « machine.statut_modifie »`, async () => {
      const reponse = await POST(requete(statut), { params: params() });
      expect(changerStatutMachine).toHaveBeenCalledWith(
        expect.anything(),
        MACHINE_ID,
        statut,
      );
      const url = new URL(
        reponse.headers.get("Location") as string,
        "http://localhost",
      );
      expect(url.searchParams.get("motif")).toBe("machine.statut_modifie");
    });
  }
});

describe("POST /api/machines/[id]/changer-statut — le retour est fermé à deux fiches", () => {
  it("un « retour » hors de /parc/ ou /interventions/ retombe sur /parc/<id>", async () => {
    const reponse = await POST(requete("en_panne", "/autre-chose"), {
      params: params(),
    });
    const url = new URL(
      reponse.headers.get("Location") as string,
      "http://localhost",
    );
    expect(url.pathname).toBe(`/parc/${MACHINE_ID}`);
  });

  it("un « retour » vers la fiche intervention d'origine est respecté", async () => {
    const interventionId = "77777777-7777-7777-7777-777777777777";
    const reponse = await POST(
      requete("en_panne", `/interventions/${interventionId}`),
      { params: params() },
    );
    const url = new URL(
      reponse.headers.get("Location") as string,
      "http://localhost",
    );
    expect(url.pathname).toBe(`/interventions/${interventionId}`);
  });
});
