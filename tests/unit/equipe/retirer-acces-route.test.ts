import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * 9L03C-RETIRER-ACCES-DESACTIVER — `POST /api/equipe/[id]/retirer-acces`.
 *
 * Même patron que `tests/unit/equipe/nouveau-lien-refus-sans-droit.test.ts`
 * (mock de `@/lib/auth/porte`) : le refus sans droit n'appelle jamais le
 * geste, et `onglet` décide seul vers quel onglet le retour pointe —
 * techniciens par défaut, bureau quand le formulaire le porte.
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

const retirerAccesInterne = vi.fn();
vi.mock("@/lib/auth/retrait-acces", () => ({
  retirerAccesInterne: (...args: readonly unknown[]): unknown =>
    retirerAccesInterne(...args),
}));

import { POST } from "@/app/api/equipe/[id]/retirer-acces/route";

function requete(onglet?: "bureau"): Request {
  const corps = new FormData();
  if (onglet !== undefined) {
    corps.set("onglet", onglet);
  }
  return new Request(
    `http://localhost/api/equipe/${UTILISATEUR_ID}/retirer-acces`,
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

describe("POST /api/equipe/[id]/retirer-acces", () => {
  it("un rôle sans administrer_utilisateurs refuse, sans jamais appeler le geste", async () => {
    exigerCapacite.mockResolvedValue(null);

    const url = urlDeRetour(await appeler());
    expect(url.pathname).toBe("/parametres/equipe");
    expect(url.searchParams.get("motif")).toBe("auth.refus_droit");
    expect(url.searchParams.get("onglet")).toBeNull();
    expect(retirerAccesInterne).not.toHaveBeenCalled();
  });

  it("le refus sans droit, sur l'onglet bureau, retourne SUR l'onglet bureau", async () => {
    exigerCapacite.mockResolvedValue(null);

    const url = urlDeRetour(await appeler("bureau"));
    expect(url.searchParams.get("onglet")).toBe("bureau");
    expect(url.searchParams.get("motif")).toBe("auth.refus_droit");
    expect(retirerAccesInterne).not.toHaveBeenCalled();
  });

  it("succès, onglet techniciens par défaut : retour avec le motif de réussite", async () => {
    exigerCapacite.mockResolvedValue(CONTEXTE_ADMIN);
    retirerAccesInterne.mockResolvedValue({ accepte: true });

    const url = urlDeRetour(await appeler());
    expect(url.pathname).toBe("/parametres/equipe");
    expect(url.searchParams.get("onglet")).toBeNull();
    expect(url.searchParams.get("motif")).toBe("equipe.retrait_acces.reussi");
    expect(retirerAccesInterne).toHaveBeenCalledWith(
      CONTEXTE_ADMIN,
      UTILISATEUR_ID,
    );
  });

  it("succès, onglet bureau : retour SUR l'onglet bureau avec le motif de réussite", async () => {
    exigerCapacite.mockResolvedValue(CONTEXTE_ADMIN);
    retirerAccesInterne.mockResolvedValue({ accepte: true });

    const url = urlDeRetour(await appeler("bureau"));
    expect(url.searchParams.get("onglet")).toBe("bureau");
    expect(url.searchParams.get("motif")).toBe("equipe.retrait_acces.reussi");
  });

  it("refus nommé (dernier administrateur) : le motif porte le préfixe dédié", async () => {
    exigerCapacite.mockResolvedValue(CONTEXTE_ADMIN);
    retirerAccesInterne.mockResolvedValue({
      accepte: false,
      motif: "dernier_administrateur",
    });

    const url = urlDeRetour(await appeler());
    expect(url.searchParams.get("motif")).toBe(
      "equipe.retrait_acces.refus.dernier_administrateur",
    );
  });

  it("refus nommé (introuvable)", async () => {
    exigerCapacite.mockResolvedValue(CONTEXTE_ADMIN);
    retirerAccesInterne.mockResolvedValue({
      accepte: false,
      motif: "introuvable",
    });

    const url = urlDeRetour(await appeler("bureau"));
    expect(url.searchParams.get("onglet")).toBe("bureau");
    expect(url.searchParams.get("motif")).toBe(
      "equipe.retrait_acces.refus.introuvable",
    );
  });
});
