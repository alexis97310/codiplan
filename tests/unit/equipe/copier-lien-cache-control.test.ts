import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * B4 (relecture de 9I6B, 9I7D-RESERVES-DE-REVUE-ACCES-ET-MENTIONS) —
 * `Cache-Control: no-store` SUR TOUTE RÉPONSE DES QUATRE ROUTES « COPIER UN
 * LIEN D'ACCÈS », succès comme refus de droit comme refus nommé — l'URL
 * qu'un succès porte est un secret au porteur.
 *
 * Même patron de mock que `tests/unit/equipe/nouveau-lien-refus-sans-droit.test.ts`.
 */

const exigerCapacite = vi.fn();
vi.mock("@/lib/auth/porte", () => ({
  exigerCapacite: (...args: readonly unknown[]): unknown =>
    exigerCapacite(...args),
}));

const copierLienDAcces = vi.fn();
const copierNouveauLienDAcces = vi.fn();
vi.mock("@/lib/auth/acces-technicien", () => ({
  copierLienDAcces: (...args: readonly unknown[]): unknown =>
    copierLienDAcces(...args),
  copierNouveauLienDAcces: (...args: readonly unknown[]): unknown =>
    copierNouveauLienDAcces(...args),
}));

const copierLienDAccesBureau = vi.fn();
const copierNouveauLienDAccesBureau = vi.fn();
vi.mock("@/lib/auth/acces-bureau", () => ({
  copierLienDAccesBureau: (...args: readonly unknown[]): unknown =>
    copierLienDAccesBureau(...args),
  copierNouveauLienDAccesBureau: (...args: readonly unknown[]): unknown =>
    copierNouveauLienDAccesBureau(...args),
}));

import { POST as COPIER_LIEN_TECHNICIEN } from "@/app/api/equipe/[id]/copier-lien/route";
import { POST as COPIER_NOUVEAU_LIEN_TECHNICIEN } from "@/app/api/equipe/[id]/copier-nouveau-lien/route";
import { POST as COPIER_LIEN_BUREAU } from "@/app/api/equipe/bureau/[id]/copier-lien/route";
import { POST as COPIER_NOUVEAU_LIEN_BUREAU } from "@/app/api/equipe/bureau/[id]/copier-nouveau-lien/route";

const UTILISATEUR_ID = "77777777-7777-7777-7777-777777777777";

function requete(): Request {
  return new Request(`http://localhost/x`, { method: "POST" });
}

function params(): Promise<{ id: string }> {
  return Promise.resolve({ id: UTILISATEUR_ID });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe.each([
  { nom: "copier-lien (technicien)", POST: COPIER_LIEN_TECHNICIEN, geste: copierLienDAcces },
  {
    nom: "copier-nouveau-lien (technicien)",
    POST: COPIER_NOUVEAU_LIEN_TECHNICIEN,
    geste: copierNouveauLienDAcces,
  },
  { nom: "copier-lien (bureau)", POST: COPIER_LIEN_BUREAU, geste: copierLienDAccesBureau },
  {
    nom: "copier-nouveau-lien (bureau)",
    POST: COPIER_NOUVEAU_LIEN_BUREAU,
    geste: copierNouveauLienDAccesBureau,
  },
])("$nom — Cache-Control: no-store", ({ POST, geste }) => {
  it("sur le refus de droit (403)", async () => {
    exigerCapacite.mockResolvedValue(null);
    const reponse = await POST(requete(), { params: params() });
    expect(reponse.status).toBe(403);
    expect(reponse.headers.get("cache-control")).toBe("no-store");
  });

  it("sur un refus nommé", async () => {
    exigerCapacite.mockResolvedValue({ societeId: "s", role: "admin_societe" });
    geste.mockResolvedValue({ accepte: false, motif: "introuvable" });
    const reponse = await POST(requete(), { params: params() });
    expect(reponse.headers.get("cache-control")).toBe("no-store");
  });

  it("sur le succès, qui porte l'URL", async () => {
    exigerCapacite.mockResolvedValue({ societeId: "s", role: "admin_societe" });
    geste.mockResolvedValue({ accepte: true, url: "https://exemple.test/x" });
    const reponse = await POST(requete(), { params: params() });
    expect(reponse.headers.get("cache-control")).toBe("no-store");
  });
});
