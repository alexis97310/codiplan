import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * « CRÉER ET AJOUTER UN SITE » (9EK-TP-UX5-2-CREATIONS-1) — le bouton
 * secondaire de `/clients/nouveau` porte `name="ensuite" value="site"` : la
 * route doit alors rediriger vers `/sites/nouveau?client=<id>`, le client
 * prérempli, plutôt que vers la fiche créée.
 */

const FICHE_ID = "33333333-3333-3333-3333-333333333333";

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

const creerClient = vi.fn();
vi.mock("@/lib/clients/depot", () => ({
  creerClient: (...args: readonly unknown[]): unknown => creerClient(...args),
}));

import { POST } from "@/app/api/clients/creer/route";

function requete(champs: Record<string, string>): Request {
  const corps = new FormData();
  for (const [cle, valeur] of Object.entries(champs)) {
    corps.set(cle, valeur);
  }
  return new Request("http://localhost/api/clients/creer", {
    method: "POST",
    body: corps,
  });
}

function emplacement(reponse: Response): URL {
  expect(reponse.status).toBe(303);
  const location = reponse.headers.get("Location");
  expect(location).not.toBeNull();
  return new URL(location as string, "http://localhost");
}

beforeEach(() => {
  creerClient.mockReset();
  creerClient.mockResolvedValue({
    accepte: true,
    fiche: { id: FICHE_ID, raison_sociale: "TPA4-Client" },
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/clients/creer — le paramètre `ensuite`", () => {
  it("`ensuite=site` redirige vers /sites/nouveau avec le client prérempli et le motif de succès", async () => {
    const reponse = await POST(
      requete({ raison_sociale: "TPA4-Client", ensuite: "site" }),
    );
    const url = emplacement(reponse);
    expect(url.pathname).toBe("/sites/nouveau");
    expect(url.searchParams.get("client")).toBe(FICHE_ID);
    expect(url.searchParams.get("motif")).toBe("clients.cree");
  });

  it("sans `ensuite`, la redirection mène à la fiche créée, comme avant", async () => {
    const reponse = await POST(requete({ raison_sociale: "TPA4-Client" }));
    const url = emplacement(reponse);
    expect(url.pathname).toBe(`/clients/${FICHE_ID}`);
    expect(url.searchParams.get("motif")).toBe("clients.cree");
  });

  it("une valeur `ensuite` inconnue est ignorée — même redirection que son absence", async () => {
    const reponse = await POST(
      requete({ raison_sociale: "TPA4-Client", ensuite: "autre-chose" }),
    );
    const url = emplacement(reponse);
    expect(url.pathname).toBe(`/clients/${FICHE_ID}`);
  });

  it("un refus de saisie ne crée rien, quel que soit `ensuite`", async () => {
    const reponse = await POST(
      requete({ raison_sociale: "", ensuite: "site" }),
    );
    expect(creerClient).not.toHaveBeenCalled();
    const url = emplacement(reponse);
    expect(url.pathname).toBe("/clients/nouveau");
  });
});
