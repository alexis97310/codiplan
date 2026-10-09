import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * SOLDE 9EP POINT 49 — LE REFUS SERVEUR DES TROIS ÉTATS FERMÉS À LA CRÉATION
 * (D184, décision d'Alexis du 05/10/2026, n° 21, PV-27).
 *
 * `app/api/machines/creer/route.ts` refuse « remplacée », « ferraillée » et
 * « fusionnée » AVANT `schemaMachine.safeParse`, par la clé
 * `machine.refus.statut_creation` — jamais mesuré par un test avant ce
 * ticket. Même patron que `tests/unit/clients/creer-ensuite-site.test.ts`.
 */

const STATUTS_REFUSES = ["remplacee", "ferraillee", "fusionnee"] as const;
const STATUTS_ACCEPTES = ["en_service", "en_panne", "arretee"] as const;

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

const creerMachine = vi.fn();
vi.mock("@/lib/machines/depot", () => ({
  creerMachine: (...args: readonly unknown[]): unknown => creerMachine(...args),
}));

import { POST } from "@/app/api/machines/creer/route";

const MODELE_ID = "33333333-3333-3333-3333-333333333333";
const CLIENT_ID = "44444444-4444-4444-4444-444444444444";
const SITE_ID = "55555555-5555-5555-5555-555555555555";
const MACHINE_ID = "66666666-6666-6666-6666-666666666666";

function champsValides(statut: string): Record<string, string> {
  return {
    modele_id: MODELE_ID,
    client_id: CLIENT_ID,
    site_id: SITE_ID,
    numero_serie: "SN-9EP-49",
    statut,
  };
}

function requeteJson(champs: Record<string, string>): Request {
  const corps = new FormData();
  for (const [cle, valeur] of Object.entries(champs)) {
    corps.set(cle, valeur);
  }
  return new Request("http://localhost/api/machines/creer", {
    method: "POST",
    headers: { Accept: "application/json" },
    body: corps,
  });
}

function requeteFormulaire(champs: Record<string, string>): Request {
  const corps = new FormData();
  for (const [cle, valeur] of Object.entries(champs)) {
    corps.set(cle, valeur);
  }
  return new Request("http://localhost/api/machines/creer", {
    method: "POST",
    body: corps,
  });
}

beforeEach(() => {
  creerMachine.mockReset();
  creerMachine.mockResolvedValue({ accepte: true, id: MACHINE_ID });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/machines/creer — les trois statuts fermés à la création", () => {
  for (const statut of STATUTS_REFUSES) {
    it(`« ${statut} » est refusé par « machine.refus.statut_creation » (JSON), sans jamais atteindre creerMachine`, async () => {
      const reponse = await POST(requeteJson(champsValides(statut)));
      expect(reponse.status).toBe(200);
      const corps = (await reponse.json()) as {
        accepte: boolean;
        cle: string | null;
        id: string | null;
      };
      expect(corps).toEqual({
        accepte: false,
        cle: "machine.refus.statut_creation",
        id: null,
      });
      expect(creerMachine).not.toHaveBeenCalled();
    });

    it(`« ${statut} » redirige vers /parc/nouvelle avec le motif « machine.refus.statut_creation » (hors JSON)`, async () => {
      const reponse = await POST(requeteFormulaire(champsValides(statut)));
      expect(reponse.status).toBe(303);
      const location = reponse.headers.get("Location");
      expect(location).not.toBeNull();
      const url = new URL(location as string, "http://localhost");
      expect(url.pathname).toBe("/parc/nouvelle");
      expect(url.searchParams.get("motif")).toBe(
        "machine.refus.statut_creation",
      );
      expect(creerMachine).not.toHaveBeenCalled();
    });
  }

  for (const statut of STATUTS_ACCEPTES) {
    it(`« ${statut} » n'est jamais refusé par « machine.refus.statut_creation »`, async () => {
      const reponse = await POST(requeteJson(champsValides(statut)));
      const corps = (await reponse.json()) as {
        accepte: boolean;
        cle: string | null;
        id: string | null;
      };
      expect(corps.cle).not.toBe("machine.refus.statut_creation");
    });
  }
});
