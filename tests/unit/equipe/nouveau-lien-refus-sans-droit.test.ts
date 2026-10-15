import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * 9EXB-EQUIPE-EPREUVES-CAPTURES, point 3 — un rôle SANS la capacité
 * `administrer_utilisateurs` (ADV, technicien) refuse les deux routes
 * « nouveau lien » (D86), même forme de refus que les routes voisines
 * `envoyer-acces` : `exigerCapacite` rend `null`, la route redirige vers
 * `motifDuRefus()` SANS appeler le geste d'envoi — rien n'est écrit.
 *
 * Même patron que `tests/unit/equipe/bureau-creer-envoi-acces-non-parti.test.ts`
 * (mock de `@/lib/auth/porte`), adapté au refus plutôt qu'au succès.
 */

vi.mock("@/lib/auth/porte", () => ({
  exigerCapacite: vi.fn().mockResolvedValue(null),
  motifDuRefus: vi.fn().mockResolvedValue("auth.refus_droit"),
}));

const envoyerNouveauLienDAcces = vi.fn();
vi.mock("@/lib/auth/acces-technicien", () => ({
  envoyerNouveauLienDAcces: (...args: readonly unknown[]): unknown =>
    envoyerNouveauLienDAcces(...args),
}));

const envoyerNouveauLienDAccesBureau = vi.fn();
vi.mock("@/lib/auth/acces-bureau", () => ({
  envoyerNouveauLienDAccesBureau: (...args: readonly unknown[]): unknown =>
    envoyerNouveauLienDAccesBureau(...args),
}));

import { POST as POST_TECHNICIEN } from "@/app/api/equipe/[id]/nouveau-lien/route";
import { POST as POST_BUREAU } from "@/app/api/equipe/bureau/[id]/nouveau-lien/route";

const UTILISATEUR_ID = "77777777-7777-7777-7777-777777777777";

function requete(url: string): Request {
  return new Request(url, { method: "POST" });
}

function urlDeRetour(reponse: Response): URL {
  const location = reponse.headers.get("Location");
  expect(location).not.toBeNull();
  return new URL(location as string, "http://localhost");
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/equipe/[id]/nouveau-lien — refus sans droit", () => {
  it("un rôle sans administrer_utilisateurs refuse, sans jamais appeler le geste d'envoi", async () => {
    const reponse = await POST_TECHNICIEN(
      requete(`http://localhost/api/equipe/${UTILISATEUR_ID}/nouveau-lien`),
      { params: Promise.resolve({ id: UTILISATEUR_ID }) },
    );
    const url = urlDeRetour(reponse);
    expect(url.searchParams.get("motif")).toBe("auth.refus_droit");
    expect(envoyerNouveauLienDAcces).not.toHaveBeenCalled();
  });
});

describe("POST /api/equipe/bureau/[id]/nouveau-lien — refus sans droit", () => {
  it("un rôle sans administrer_utilisateurs refuse, sans jamais appeler le geste d'envoi", async () => {
    const reponse = await POST_BUREAU(
      requete(
        `http://localhost/api/equipe/bureau/${UTILISATEUR_ID}/nouveau-lien`,
      ),
      { params: Promise.resolve({ id: UTILISATEUR_ID }) },
    );
    const url = urlDeRetour(reponse);
    expect(url.searchParams.get("motif")).toBe("auth.refus_droit");
    expect(envoyerNouveauLienDAccesBureau).not.toHaveBeenCalled();
  });
});
