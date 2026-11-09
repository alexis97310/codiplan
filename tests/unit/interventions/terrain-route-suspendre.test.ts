import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 9K13-TERRAIN-ATTENTE-PIECE — `POST /api/terrain/{id}/suspendre` RÉPOND EN
 * JSON (même mécanisme que ses voisines, voir `terrain-routes-json.test.ts`),
 * et REFUSE NOMMÉMENT une référence sans sa date (ou l'inverse) AVANT
 * d'atteindre `suspendreIntervention` — le dépôt reste un mock, seule la
 * FORME de la réponse et le ROUTAGE du refus sont en jeu ici.
 */

const ID = "33333333-3333-7333-8333-333333333333";

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

const suspendreIntervention = vi.fn();

vi.mock("@/lib/interventions/depot", () => ({
  suspendreIntervention: (...args: readonly unknown[]): unknown =>
    suspendreIntervention(...args),
}));

import { POST as postSuspendre } from "@/app/api/terrain/[id]/suspendre/route";

function params(): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id: ID }) };
}

function requeteJson(champs: Record<string, string> = {}): Request {
  const corps = new FormData();
  for (const [cle, valeur] of Object.entries(champs)) {
    corps.set(cle, valeur);
  }
  return new Request(`http://localhost/api/terrain/${ID}/suspendre`, {
    method: "POST",
    body: corps,
    headers: { Accept: "application/json" },
  });
}

const CHAMPS_COMPLETS = {
  motif: "Attente de pièce signalée depuis le terrain.",
  piece_attendue_ref: "REF-42",
  date_dispo_prevue: "2026-12-01",
};

beforeEach(() => {
  suspendreIntervention.mockReset();
  suspendreIntervention.mockResolvedValue({ accepte: true, fiche: { id: ID } });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/terrain/{id}/suspendre", () => {
  it("succès : `{ok: true}`, jamais de redirection", async () => {
    const reponse = await postSuspendre(requeteJson(CHAMPS_COMPLETS), params());
    expect(reponse.status).toBe(200);
    expect(await reponse.json()).toStrictEqual({ ok: true, motif: null });
    expect(suspendreIntervention).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        intervention_id: ID,
        motif: CHAMPS_COMPLETS.motif,
        piece_attendue_ref: "REF-42",
      }),
    );
  });

  it("référence SANS date : refus nommé, le dépôt n'est jamais appelé", async () => {
    const reponse = await postSuspendre(
      requeteJson({ motif: "Motif", piece_attendue_ref: "REF-42" }),
      params(),
    );
    expect(reponse.status).toBe(200);
    expect(await reponse.json()).toStrictEqual({
      ok: false,
      motif: "intervention.refus.piece_et_date",
    });
    expect(suspendreIntervention).not.toHaveBeenCalled();
  });

  it("date SANS référence : refus nommé, le dépôt n'est jamais appelé", async () => {
    const reponse = await postSuspendre(
      requeteJson({ motif: "Motif", date_dispo_prevue: "2026-12-01" }),
      params(),
    );
    expect(reponse.status).toBe(200);
    expect(await reponse.json()).toStrictEqual({
      ok: false,
      motif: "intervention.refus.piece_et_date",
    });
    expect(suspendreIntervention).not.toHaveBeenCalled();
  });

  it("motif absent : refus nommé, le dépôt n'est jamais appelé", async () => {
    const reponse = await postSuspendre(
      requeteJson({
        piece_attendue_ref: "REF-42",
        date_dispo_prevue: "2026-12-01",
      }),
      params(),
    );
    expect(reponse.status).toBe(200);
    expect(await reponse.json()).toStrictEqual({
      ok: false,
      motif: "intervention.refus.motif_manquant",
    });
    expect(suspendreIntervention).not.toHaveBeenCalled();
  });

  it("refus du dépôt (déjà suspendue) : la route le propage", async () => {
    suspendreIntervention.mockResolvedValue({
      accepte: false,
      cle: "intervention.refus.deja_suspendue",
    });
    const reponse = await postSuspendre(requeteJson(CHAMPS_COMPLETS), params());
    expect(reponse.status).toBe(200);
    expect(await reponse.json()).toStrictEqual({
      ok: false,
      motif: "intervention.refus.deja_suspendue",
    });
  });

  it("SANS l'en-tête JSON, la redirection 303 habituelle reste", async () => {
    const corps = new FormData();
    for (const [cle, valeur] of Object.entries(CHAMPS_COMPLETS)) {
      corps.set(cle, valeur);
    }
    const reponse = await postSuspendre(
      new Request(`http://localhost/api/terrain/${ID}/suspendre`, {
        method: "POST",
        body: corps,
      }),
      params(),
    );
    expect(reponse.status).toBe(303);
  });
});
