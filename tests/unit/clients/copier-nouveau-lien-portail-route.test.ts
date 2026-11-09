import { afterEach, describe, expect, it, vi } from "vitest";

import { Role } from "@/lib/auth/roles";

/**
 * 9K14-PORTAIL-COPIER-NOUVEAU-LIEN (backlog B7) — LA ROUTE `POST
 * /api/clients/<id>/comptes/<utilisateurId>/copier-nouveau-lien`.
 *
 * Même patron de mock que `tests/unit/equipe/copier-lien-cache-control.test.ts`
 * (B4) : `Cache-Control: no-store` sur TOUTE réponse, succès comme refus —
 * l'URL qu'un succès porte est un secret au porteur.
 */

const exigerCapacite = vi.fn();
vi.mock("@/lib/auth/porte", () => ({
  exigerCapacite: (...args: readonly unknown[]): unknown =>
    exigerCapacite(...args),
}));

const copierNouveauLienDAccesPortail = vi.fn();
vi.mock("@/lib/auth/lien-d-acces", () => ({
  copierNouveauLienDAccesPortail: (...args: readonly unknown[]): unknown =>
    copierNouveauLienDAccesPortail(...args),
}));

import { POST } from "@/app/api/clients/[id]/comptes/[utilisateurId]/copier-nouveau-lien/route";

const CLIENT_ID = "11111111-1111-4111-8111-111111111111";
const UTILISATEUR_ID = "77777777-7777-4777-8777-777777777777";

function requete(): Request {
  return new Request("http://localhost/x", { method: "POST" });
}

function params(
  id = CLIENT_ID,
  utilisateurId = UTILISATEUR_ID,
): Promise<{ id: string; utilisateurId: string }> {
  return Promise.resolve({ id, utilisateurId });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST .../comptes/[utilisateurId]/copier-nouveau-lien", () => {
  it("refus de droit (403), sans jamais atteindre le domaine", async () => {
    exigerCapacite.mockResolvedValue(null);
    const reponse = await POST(requete(), { params: params() });
    expect(reponse.status).toBe(403);
    expect(reponse.headers.get("cache-control")).toBe("no-store");
    const corps: { erreur?: string } = await reponse.json();
    expect(corps.erreur).toBe("acces_refuse");
    expect(copierNouveauLienDAccesPortail).not.toHaveBeenCalled();
  });

  it("un identifiant qui n'est pas un UUID est refusé NOMMÉMENT, sans atteindre le domaine", async () => {
    exigerCapacite.mockResolvedValue({
      societeId: "s",
      role: Role.admin_societe,
    });
    const reponse = await POST(requete(), {
      params: params("pas-un-uuid", UTILISATEUR_ID),
    });
    const corps: { erreur?: string } = await reponse.json();
    expect(corps.erreur).toBe("introuvable");
    expect(reponse.headers.get("cache-control")).toBe("no-store");
    expect(copierNouveauLienDAccesPortail).not.toHaveBeenCalled();
  });

  it("transmet les DEUX identifiants au domaine, dans l'ordre client puis utilisateur", async () => {
    exigerCapacite.mockResolvedValue({
      societeId: "s",
      role: Role.admin_societe,
    });
    copierNouveauLienDAccesPortail.mockResolvedValue({
      accepte: true,
      url: "https://exemple.test/x",
    });
    await POST(requete(), { params: params() });
    expect(copierNouveauLienDAccesPortail).toHaveBeenCalledWith(
      { societeId: "s", role: Role.admin_societe },
      CLIENT_ID,
      UTILISATEUR_ID,
    );
  });

  it("sur un refus nommé du domaine (revoque), rend le motif, pas l'URL", async () => {
    exigerCapacite.mockResolvedValue({
      societeId: "s",
      role: Role.admin_societe,
    });
    copierNouveauLienDAccesPortail.mockResolvedValue({
      accepte: false,
      motif: "revoque",
    });
    const reponse = await POST(requete(), { params: params() });
    const corps: { erreur?: string; url?: string } = await reponse.json();
    expect(corps.erreur).toBe("revoque");
    expect(corps.url).toBeUndefined();
    expect(reponse.headers.get("cache-control")).toBe("no-store");
  });

  it("sur le succès, rend l'URL", async () => {
    exigerCapacite.mockResolvedValue({
      societeId: "s",
      role: Role.admin_societe,
    });
    copierNouveauLienDAccesPortail.mockResolvedValue({
      accepte: true,
      url: "https://exemple.test/x",
    });
    const reponse = await POST(requete(), { params: params() });
    const corps: { url?: string } = await reponse.json();
    expect(corps.url).toBe("https://exemple.test/x");
    expect(reponse.headers.get("cache-control")).toBe("no-store");
  });
});
