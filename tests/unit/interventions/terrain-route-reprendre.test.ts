import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 9L08C-TERRAIN-REPRENDRE-SUSPENSION — `POST /api/terrain/{id}/reprendre`
 * RÉPOND EN JSON (même mécanisme que ses voisines, voir
 * `terrain-routes-json.test.ts`) — le dépôt reste un mock, seule la FORME de
 * la réponse et le ROUTAGE du refus sont en jeu ici.
 */

const ID = "44444444-4444-7444-8444-444444444444";

vi.mock("@/lib/auth/porte", () => ({
  exigerCapacite: vi.fn().mockResolvedValue({
    utilisateurId: "11111111-1111-1111-1111-111111111111",
    societeId: "22222222-2222-2222-2222-222222222222",
    secondFacteurValide: true,
    adresseIp: null,
    clientId: null,
  }),
  motifDuRefus: vi.fn().mockResolvedValue("motif"),
}));

vi.mock("@/lib/interventions/perimetre-technicien", () => ({
  perimetreDuPlanning: vi.fn().mockReturnValue({
    acces: "restreint",
    technicienId: "11111111-1111-1111-1111-111111111111",
  }),
}));

const reprendreIntervention = vi.fn();

vi.mock("@/lib/interventions/depot", () => ({
  reprendreIntervention: (...args: readonly unknown[]): unknown =>
    reprendreIntervention(...args),
}));

import { POST as postReprendre } from "@/app/api/terrain/[id]/reprendre/route";

function params(): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id: ID }) };
}

function requeteJson(): Request {
  return new Request(`http://localhost/api/terrain/${ID}/reprendre`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
}

beforeEach(() => {
  reprendreIntervention.mockReset();
  reprendreIntervention.mockResolvedValue({
    accepte: true,
    fiche: { id: ID },
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/terrain/{id}/reprendre", () => {
  it("succès : `{ok: true}`, jamais de redirection", async () => {
    const reponse = await postReprendre(requeteJson(), params());
    expect(reponse.status).toBe(200);
    expect(await reponse.json()).toStrictEqual({ ok: true, motif: null });
    expect(reprendreIntervention).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ intervention_id: ID }),
    );
  });

  it("refus du dépôt (pas suspendue) : la route le propage", async () => {
    reprendreIntervention.mockResolvedValue({
      accepte: false,
      cle: "intervention.refus.pas_suspendue",
    });
    const reponse = await postReprendre(requeteJson(), params());
    expect(reponse.status).toBe(200);
    expect(await reponse.json()).toStrictEqual({
      ok: false,
      motif: "intervention.refus.pas_suspendue",
    });
  });

  it("SANS l'en-tête JSON, la redirection 303 habituelle reste", async () => {
    const reponse = await postReprendre(
      new Request(`http://localhost/api/terrain/${ID}/reprendre`, {
        method: "POST",
      }),
      params(),
    );
    expect(reponse.status).toBe(303);
    expect(reponse.headers.get("Location")).toBe(`/terrain/${ID}`);
  });

  it("capacité refusée : le dépôt n'est jamais appelé", async () => {
    const { exigerCapacite } = await import("@/lib/auth/porte");
    vi.mocked(exigerCapacite).mockResolvedValueOnce(null);
    const reponse = await postReprendre(requeteJson(), params());
    expect(await reponse.json()).toStrictEqual({ ok: false, motif: "motif" });
    expect(reprendreIntervention).not.toHaveBeenCalled();
  });

  it("périmètre « complet » (bureau) : refusé, même capacité posée", async () => {
    const { perimetreDuPlanning } =
      await import("@/lib/interventions/perimetre-technicien");
    vi.mocked(perimetreDuPlanning).mockReturnValueOnce({
      acces: "complet",
    } as ReturnType<typeof perimetreDuPlanning>);
    const reponse = await postReprendre(requeteJson(), params());
    expect(await reponse.json()).toStrictEqual({ ok: false, motif: "motif" });
    expect(reprendreIntervention).not.toHaveBeenCalled();
  });
});
