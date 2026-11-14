import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * 9L04K-REACTIVER-ACCES-INTERNE — `POST /api/equipe/[id]/retablir-acces`.
 *
 * Même patron que `tests/unit/equipe/retirer-acces-route.test.ts`, son
 * symétrique : le refus sans droit n'appelle jamais le geste, et `onglet`
 * décide seul vers quel onglet le retour pointe.
 */

import { Role } from "@/lib/auth/roles";

const UTILISATEUR_ID = "77777777-7777-7777-7777-777777777777";

const CONTEXTE_ADMIN = {
  utilisateurId: "11111111-1111-1111-1111-111111111111",
  societeId: "22222222-2222-2222-2222-222222222222",
  role: Role.admin_societe,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const exigerCapacite = vi.fn();
const motifDuRefus = vi.fn().mockResolvedValue("auth.refus_droit");
vi.mock("@/lib/auth/porte", () => ({
  exigerCapacite: (...args: readonly unknown[]): unknown =>
    exigerCapacite(...args),
  motifDuRefus: (...args: readonly unknown[]): unknown => motifDuRefus(...args),
}));

const retablirAccesInterne = vi.fn();
vi.mock("@/lib/auth/retrait-acces", () => ({
  retablirAccesInterne: (...args: readonly unknown[]): unknown =>
    retablirAccesInterne(...args),
}));

import { POST } from "@/app/api/equipe/[id]/retablir-acces/route";

function requete(onglet?: "bureau"): Request {
  const corps = new FormData();
  if (onglet !== undefined) {
    corps.set("onglet", onglet);
  }
  return new Request(
    `http://localhost/api/equipe/${UTILISATEUR_ID}/retablir-acces`,
    { method: "POST", body: corps },
  );
}

function appeler(onglet?: "bureau"): Promise<Response> {
  return POST(requete(onglet), {
    params: Promise.resolve({ id: UTILISATEUR_ID }),
  });
}

function urlDeRetour(reponse: Response): URL {
  const location = reponse.headers.get("Location");
  expect(location).not.toBeNull();
  return new URL(location as string, "http://localhost");
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/equipe/[id]/retablir-acces", () => {
  it("un rôle sans administrer_utilisateurs refuse, sans jamais appeler le geste", async () => {
    exigerCapacite.mockResolvedValue(null);

    const url = urlDeRetour(await appeler());
    expect(url.pathname).toBe("/parametres/equipe");
    expect(url.searchParams.get("motif")).toBe("auth.refus_droit");
    expect(url.searchParams.get("onglet")).toBeNull();
    expect(retablirAccesInterne).not.toHaveBeenCalled();
  });

  it("le refus sans droit, sur l'onglet bureau, retourne SUR l'onglet bureau", async () => {
    exigerCapacite.mockResolvedValue(null);

    const url = urlDeRetour(await appeler("bureau"));
    expect(url.searchParams.get("onglet")).toBe("bureau");
    expect(url.searchParams.get("motif")).toBe("auth.refus_droit");
    expect(retablirAccesInterne).not.toHaveBeenCalled();
  });

  it("succès, onglet techniciens par défaut : retour avec le motif de réussite", async () => {
    exigerCapacite.mockResolvedValue(CONTEXTE_ADMIN);
    retablirAccesInterne.mockResolvedValue({ accepte: true });

    const url = urlDeRetour(await appeler());
    expect(url.pathname).toBe("/parametres/equipe");
    expect(url.searchParams.get("onglet")).toBeNull();
    expect(url.searchParams.get("motif")).toBe("equipe.retablir_acces.reussi");
    expect(retablirAccesInterne).toHaveBeenCalledWith(
      CONTEXTE_ADMIN,
      UTILISATEUR_ID,
    );
  });

  it("succès, onglet bureau : retour SUR l'onglet bureau avec le motif de réussite", async () => {
    exigerCapacite.mockResolvedValue(CONTEXTE_ADMIN);
    retablirAccesInterne.mockResolvedValue({ accepte: true });

    const url = urlDeRetour(await appeler("bureau"));
    expect(url.searchParams.get("onglet")).toBe("bureau");
    expect(url.searchParams.get("motif")).toBe("equipe.retablir_acces.reussi");
  });

  it("refus nommé (deja_membre) : le motif porte le préfixe dédié", async () => {
    exigerCapacite.mockResolvedValue(CONTEXTE_ADMIN);
    retablirAccesInterne.mockResolvedValue({
      accepte: false,
      motif: "deja_membre",
    });

    const url = urlDeRetour(await appeler());
    expect(url.searchParams.get("motif")).toBe(
      "equipe.retablir_acces.refus.deja_membre",
    );
  });

  it("refus nommé (introuvable)", async () => {
    exigerCapacite.mockResolvedValue(CONTEXTE_ADMIN);
    retablirAccesInterne.mockResolvedValue({
      accepte: false,
      motif: "introuvable",
    });

    const url = urlDeRetour(await appeler("bureau"));
    expect(url.searchParams.get("onglet")).toBe("bureau");
    expect(url.searchParams.get("motif")).toBe(
      "equipe.retablir_acces.refus.introuvable",
    );
  });
});
