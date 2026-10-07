import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * L'ADRESSE, LES CONSIGNES ET « SOUS CONTRAT » DÈS LA CRÉATION
 * (9EK-TP-UX5-2-CREATIONS-1, QT-18 (a), CONTRAT-SITE-1) — la route construit
 * `adresse` en `{ rue }` (forme lue par `formatAdresseSite`), lit
 * `consignes_acces` tel quel, et `sous_contrat` par la même discipline que
 * la modification (`getAll(...).includes("1")` — une case décochée est
 * absente de `FormData`).
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

const creerSite = vi.fn();
vi.mock("@/lib/sites/depot", () => ({
  creerSite: (...args: readonly unknown[]): unknown => creerSite(...args),
}));

import { POST } from "@/app/api/sites/creer/route";

const CLIENT_ID = "33333333-3333-7333-8333-333333333333";
const AGENCE_ID = "44444444-4444-7444-8444-444444444444";

function requete(
  champs: Record<string, string>,
  { sousContrat }: { sousContrat?: boolean } = {},
): Request {
  const corps = new FormData();
  for (const [cle, valeur] of Object.entries(champs)) {
    corps.set(cle, valeur);
  }
  if (sousContrat === true) {
    corps.set("sous_contrat", "1");
  }
  return new Request("http://localhost/api/sites/creer", {
    method: "POST",
    body: corps,
  });
}

function base(): Record<string, string> {
  return {
    client_id: CLIENT_ID,
    agence_id: AGENCE_ID,
    libelle: "Atelier",
  };
}

function emplacement(reponse: Response): URL {
  expect(reponse.status).toBe(303);
  const location = reponse.headers.get("Location");
  expect(location).not.toBeNull();
  return new URL(location as string, "http://localhost");
}

beforeEach(() => {
  creerSite.mockReset();
  creerSite.mockResolvedValue({
    accepte: true,
    fiche: { id: "55555555-5555-5555-5555-555555555555" },
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/sites/creer — adresse, consignes, sous contrat", () => {
  it("une adresse saisie devient `{ rue }` en base", async () => {
    await POST(requete({ ...base(), adresse: "12 rue des Palmiers" }));
    expect(creerSite).toHaveBeenCalledTimes(1);
    const saisie = creerSite.mock.calls[0]?.[1];
    expect(saisie.adresse).toEqual({ rue: "12 rue des Palmiers" });
  });

  it("une adresse vide devient `null`, jamais une chaîne vide", async () => {
    await POST(requete(base()));
    const saisie = creerSite.mock.calls[0]?.[1];
    expect(saisie.adresse).toBeNull();
  });

  it("les consignes sont transmises telles quelles", async () => {
    await POST(
      requete({ ...base(), consignes_acces: "Badge requis à l'entrée" }),
    );
    const saisie = creerSite.mock.calls[0]?.[1];
    expect(saisie.consignes_acces).toBe("Badge requis à l'entrée");
  });

  it("la case « sous contrat » cochée écrit `true`", async () => {
    await POST(requete(base(), { sousContrat: true }));
    const saisie = creerSite.mock.calls[0]?.[1];
    expect(saisie.sous_contrat).toBe(true);
  });

  it("la case absente (décochée) écrit `false`, le défaut", async () => {
    await POST(requete(base()));
    const saisie = creerSite.mock.calls[0]?.[1];
    expect(saisie.sous_contrat).toBe(false);
  });

  it("un refus garde l'adresse et les consignes dans l'URL de retour", async () => {
    const reponse = await POST(
      requete({
        client_id: CLIENT_ID,
        agence_id: AGENCE_ID,
        libelle: "",
        adresse: "12 rue des Palmiers",
        consignes_acces: "Badge requis",
      }),
    );
    expect(creerSite).not.toHaveBeenCalled();
    const url = emplacement(reponse);
    expect(url.searchParams.get("adresse")).toBe("12 rue des Palmiers");
    expect(url.searchParams.get("consignes_acces")).toBe("Badge requis");
  });
});
