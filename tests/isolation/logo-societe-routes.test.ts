import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

/**
 * LES TROIS ROUTES DU LOGO, PAR ELLES-MÊMES (9EZ-LOGO-SOCIETE-1) — le dépôt
 * et le retrait sont déjà éprouvés par `tests/isolation/logo-societe.test.ts`
 * ; ce fichier éprouve ce que les routes ajoutent : la porte (capacité,
 * session), le format HTTP (303 avec motif, 404/304 pour la lecture).
 */

vi.mock("@/lib/auth/porte", () => ({
  exigerCapaciteComplete: vi.fn(),
  exigerSessionActive: vi.fn(),
  motifDuRefus: vi.fn().mockResolvedValue("auth.refus_droit"),
}));

vi.hoisted(() => {
  const base = process.env.TEST_DATABASE_URL;
  if (base === undefined) {
    throw new Error(
      "TEST_DATABASE_URL est requis pour tests/isolation/logo-societe-routes.test.ts.",
    );
  }
  const url = new URL(base);
  url.username = "codiplan_app";
  url.password = "";
  process.env.DATABASE_URL = url.toString();
});

import type { ContexteActif } from "@/lib/auth/contexte";
import { exigerCapaciteComplete, exigerSessionActive } from "@/lib/auth/porte";
import { Role } from "@/lib/auth/roles";

import { GET as getLogo } from "@/app/api/societe/logo/route";
import { POST as postLogo } from "@/app/api/parametres/societe/logo/route";
import { POST as postRetirer } from "@/app/api/parametres/societe/logo/retirer/route";

import { clientOwner, fermerClients } from "./setup/db";
import { SOCIETE_A, SOCIETE_B } from "./setup/fixtures";

afterAll(fermerClients);

const PNG_MINIMAL = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3,
]);

function contexteActif(societeId: string, role: Role): ContexteActif {
  return {
    utilisateurId: "aaaaaaaa-0000-7000-8000-000000000099",
    societeId,
    role,
    secondFacteurValide: true,
    adresseIp: null,
    clientId: null,
  };
}

function motifDeLaRedirection(reponse: Response): string | null {
  const location = reponse.headers.get("location");
  if (location === null) return null;
  return new URL(location, "http://localhost").searchParams.get("motif");
}

afterEach(async () => {
  await clientOwner().societe.updateMany({
    where: { id: { in: [SOCIETE_A, SOCIETE_B] } },
    data: { logo_octets: null, logo_type: null, logo_empreinte: null },
  });
});

describe("GET /api/societe/logo", () => {
  it("sans session, 404", async () => {
    vi.mocked(exigerSessionActive).mockResolvedValueOnce(null);
    const reponse = await getLogo(
      new Request("http://localhost/api/societe/logo"),
    );
    expect(reponse.status).toBe(404);
  });

  it("session active, mais aucun logo déposé : 404", async () => {
    vi.mocked(exigerSessionActive).mockResolvedValueOnce(
      contexteActif(SOCIETE_A, Role.adv),
    );
    const reponse = await getLogo(
      new Request("http://localhost/api/societe/logo"),
    );
    expect(reponse.status).toBe(404);
  });

  it("un logo déposé se lit, avec son ETag ; If-None-Match identique rend 304", async () => {
    vi.mocked(exigerCapaciteComplete).mockResolvedValueOnce(
      contexteActif(SOCIETE_A, Role.admin_societe),
    );
    const depot = await postLogo(
      new Request("http://localhost/api/parametres/societe/logo", {
        method: "POST",
        body: (() => {
          const corps = new FormData();
          corps.set(
            "logo",
            new File([PNG_MINIMAL], "logo.png", {
              type: "image/png",
            }),
          );
          return corps;
        })(),
      }),
    );
    expect(motifDeLaRedirection(depot)).toBeNull();

    vi.mocked(exigerSessionActive).mockResolvedValueOnce(
      contexteActif(SOCIETE_A, Role.adv),
    );
    const lecture = await getLogo(
      new Request("http://localhost/api/societe/logo"),
    );
    expect(lecture.status).toBe(200);
    expect(lecture.headers.get("content-type")).toBe("image/png");
    const etag = lecture.headers.get("etag");
    expect(etag).toMatch(/^[0-9a-f]{64}$/);

    vi.mocked(exigerSessionActive).mockResolvedValueOnce(
      contexteActif(SOCIETE_A, Role.adv),
    );
    const revalidation = await getLogo(
      new Request("http://localhost/api/societe/logo", {
        headers: { "if-none-match": etag ?? "" },
      }),
    );
    expect(revalidation.status).toBe(304);
  });
});

describe("POST /api/parametres/societe/logo", () => {
  it("refuse sans la capacité, avec son motif, et rejette vers l'écran", async () => {
    vi.mocked(exigerCapaciteComplete).mockResolvedValueOnce(null);
    const corps = new FormData();
    corps.set(
      "logo",
      new File([PNG_MINIMAL], "logo.png", { type: "image/png" }),
    );
    const reponse = await postLogo(
      new Request("http://localhost/api/parametres/societe/logo", {
        method: "POST",
        body: corps,
      }),
    );
    expect(reponse.status).toBe(303);
    expect(reponse.headers.get("location")).toContain("/parametres/societe");
    expect(motifDeLaRedirection(reponse)).toBe("auth.refus_droit");
  });

  it("refuse un SVG, en le nommant", async () => {
    vi.mocked(exigerCapaciteComplete).mockResolvedValueOnce(
      contexteActif(SOCIETE_A, Role.admin_societe),
    );
    const corps = new FormData();
    corps.set(
      "logo",
      new File([Buffer.from("<svg></svg>")], "logo.svg", {
        type: "image/svg+xml",
      }),
    );
    const reponse = await postLogo(
      new Request("http://localhost/api/parametres/societe/logo", {
        method: "POST",
        body: corps,
      }),
    );
    expect(motifDeLaRedirection(reponse)).toBe("logo.refus.type");
  });
});

describe("POST /api/parametres/societe/logo/retirer", () => {
  it("refuse sans la capacité", async () => {
    vi.mocked(exigerCapaciteComplete).mockResolvedValueOnce(null);
    const reponse = await postRetirer();
    expect(motifDeLaRedirection(reponse)).toBe("auth.refus_droit");
  });
});
