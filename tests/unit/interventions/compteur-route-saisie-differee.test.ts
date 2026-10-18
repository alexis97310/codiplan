import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 9F4H2A-REJEU-SANS-DOUBLON, point 4 — ÉPREUVE ABSENTE : `operation_id` SEUL,
 * SANS `instant_appareil`, sur la route du compteur. `differeDuFormulaire`
 * (app/api/terrain/[id]/compteur/route.ts) traite ce cas comme INVALIDE —
 * contrairement à `terminer`/`signature`, qui le traiteraient comme ABSENT
 * (voir la précision sous D214, docs/arbitrages.md) — et refuse NOMMÉMENT
 * AVANT toute lecture du fuseau ou écriture du compteur.
 */

const ID = "33333333-3333-3333-3333-333333333333";

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
const fuseauDuTechnicien = vi.fn();
vi.mock("@/lib/calendar/technicien", () => ({
  fuseauDuTechnicien: (...args: readonly unknown[]): unknown =>
    fuseauDuTechnicien(...args),
}));
vi.mock("@/lib/calendar/fuseau", () => ({
  maintenant: vi.fn().mockReturnValue({ instant: new Date("2026-10-18") }),
}));
vi.mock("@/lib/db/client", () => ({
  avecContexteApplicatif: vi.fn(
    async (_contexte: unknown, fn: (tx: unknown) => unknown) => fn({}),
  ),
}));
const demarrerLeCompteur = vi.fn();
const arreterLeCompteur = vi.fn();
vi.mock("@/lib/interventions/depot-compteur", () => ({
  demarrerLeCompteur: (...args: readonly unknown[]): unknown =>
    demarrerLeCompteur(...args),
  arreterLeCompteur: (...args: readonly unknown[]): unknown =>
    arreterLeCompteur(...args),
}));

import { POST as postCompteur } from "@/app/api/terrain/[id]/compteur/route";

function requete(champs: Record<string, string>): Request {
  const corps = new FormData();
  for (const [cle, valeur] of Object.entries(champs)) {
    corps.set(cle, valeur);
  }
  return new Request(`http://localhost/api/terrain/${ID}/compteur`, {
    method: "POST",
    body: corps,
    headers: { Accept: "application/json" },
  });
}

function params(): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id: ID }) };
}

beforeEach(() => {
  fuseauDuTechnicien.mockReset();
  fuseauDuTechnicien.mockResolvedValue("Pacific/Noumea");
  demarrerLeCompteur.mockReset();
  arreterLeCompteur.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("compteur — operation_id SEUL, sans instant_appareil", () => {
  it("refuse compteur.refus.saisie_differee_invalide, rien n'est écrit", async () => {
    const reponse = await postCompteur(
      requete({
        geste: "demarrer",
        operation_id: "01933b5e-0000-7000-8000-000000000001",
      }),
      params(),
    );
    expect(reponse.status).toBe(200);
    expect(await reponse.json()).toStrictEqual({
      ok: false,
      motif: "compteur.refus.saisie_differee_invalide",
    });
    expect(demarrerLeCompteur).not.toHaveBeenCalled();
    expect(fuseauDuTechnicien).not.toHaveBeenCalled();
  });

  it("refuse de même à l'arrêt, rien n'est écrit", async () => {
    const reponse = await postCompteur(
      requete({
        geste: "arreter",
        operation_id: "01933b5e-0000-7000-8000-000000000001",
      }),
      params(),
    );
    expect(reponse.status).toBe(200);
    expect(await reponse.json()).toStrictEqual({
      ok: false,
      motif: "compteur.refus.saisie_differee_invalide",
    });
    expect(arreterLeCompteur).not.toHaveBeenCalled();
  });
});
