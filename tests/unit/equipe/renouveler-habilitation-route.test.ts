import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * « RENOUVELER <CODE> » (9EY-EQUIPE-ALERTE-TOUT-ENVOYER, point 3) —
 * `app/api/habilitations/attributions/[id]/renouveler/route.ts`. Même patron
 * que `nouveau-lien-refus-sans-droit.test.ts` : la porte et le dépôt sont
 * mockés, la vraie écriture (et le cloisonnement par société) est éprouvée
 * par `tests/isolation/alimentation-habilitations.test.ts`.
 */

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

const renouvelerAttribution = vi.fn();
vi.mock("@/lib/habilitations/depot", async (importOriginal) => {
  const reel =
    await importOriginal<typeof import("@/lib/habilitations/depot")>();
  return {
    ...reel,
    renouvelerAttribution: (...args: readonly unknown[]): unknown =>
      renouvelerAttribution(...args),
  };
});

import { exigerCapacite } from "@/lib/auth/porte";

import { POST } from "@/app/api/habilitations/attributions/[id]/renouveler/route";

const ATTRIBUTION_ID = "cccccccc-0000-7000-8000-000000000001";

function requete(corps: Record<string, string>): Request {
  const formulaire = new FormData();
  for (const [cle, valeur] of Object.entries(corps)) {
    formulaire.set(cle, valeur);
  }
  return new Request(
    `http://localhost/api/habilitations/attributions/${ATTRIBUTION_ID}/renouveler`,
    { method: "POST", body: formulaire },
  );
}

function params(): Promise<{ id: string }> {
  return Promise.resolve({ id: ATTRIBUTION_ID });
}

function urlDeRetour(reponse: Response): URL {
  const location = reponse.headers.get("Location");
  expect(location).not.toBeNull();
  return new URL(location as string, "http://localhost");
}

beforeEach(() => {
  vi.mocked(exigerCapacite).mockReset();
  vi.mocked(exigerCapacite).mockResolvedValue({
    utilisateurId: "11111111-1111-1111-1111-111111111111",
    societeId: "22222222-2222-2222-2222-222222222222",
    secondFacteurValide: true,
    adresseIp: null,
    clientId: null,
  } as never);
  renouvelerAttribution.mockReset();
  renouvelerAttribution.mockResolvedValue({
    accepte: true,
    id: ATTRIBUTION_ID,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/habilitations/attributions/[id]/renouveler", () => {
  it("un rôle sans « administrer_utilisateurs » refuse, sans appeler le dépôt", async () => {
    vi.mocked(exigerCapacite).mockResolvedValue(null);

    const reponse = await POST(
      requete({ date_obtention: "2026-01-01", date_expiration: "2030-01-01" }),
      { params: params() },
    );
    expect(urlDeRetour(reponse).searchParams.get("motif")).toBe(
      "auth.refus_droit",
    );
    expect(renouvelerAttribution).not.toHaveBeenCalled();
  });

  it("une saisie invalide (expiration ≤ obtention) refuse « habilitations.refus.saisie », sans écrire", async () => {
    const reponse = await POST(
      requete({ date_obtention: "2026-06-01", date_expiration: "2026-01-01" }),
      { params: params() },
    );
    expect(urlDeRetour(reponse).searchParams.get("motif")).toBe(
      "habilitations.refus.saisie",
    );
    expect(renouvelerAttribution).not.toHaveBeenCalled();
  });

  it("une saisie valide renouvelle, et redirige sans motif (succès)", async () => {
    const reponse = await POST(
      requete({ date_obtention: "2026-01-01", date_expiration: "2030-01-01" }),
      { params: params() },
    );
    expect(renouvelerAttribution).toHaveBeenCalledWith(
      expect.anything(),
      ATTRIBUTION_ID,
      {
        date_obtention: new Date("2026-01-01T00:00:00.000Z"),
        date_expiration: new Date("2030-01-01T00:00:00.000Z"),
      },
    );
    const location = reponse.headers.get("Location");
    expect(location).toBe("/parametres/equipe");
  });

  it("une attribution introuvable (autre société) redirige avec son motif", async () => {
    renouvelerAttribution.mockResolvedValue({
      accepte: false,
      motif: "introuvable",
    });

    const reponse = await POST(
      requete({ date_obtention: "2026-01-01", date_expiration: "2030-01-01" }),
      { params: params() },
    );
    expect(urlDeRetour(reponse).searchParams.get("motif")).toBe(
      "habilitations.refus.introuvable",
    );
  });
});
