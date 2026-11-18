import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 9L24-ROUTES-SANS-CAPACITE — LE BACK-OFFICE EST FERMÉ AU TECHNICIEN PAR LE
 * SERVEUR LUI-MÊME, PAS SEULEMENT PAR L'EN-TÊTE DU MIDDLEWARE.
 *
 * `tests/unit/navigation/redirection-technicien.test.ts` n'éprouve que les
 * fonctions PURES (`fermeAuTechnicienParD221`, `idInterventionDuChemin`) —
 * son en-tête le dit explicitement : le reste (session, rôle, redirection)
 * n'était éprouvé qu'en bout en bout (`tests/e2e/9g8-redirection-
 * technicien.spec.ts`), donc après fusion. `middleware.ts`, lui, ne JUGE
 * rien (voir son en-tête) : il recopie seulement le chemin dans
 * `x-chemin`/`x-recherche`.
 *
 * Ce fichier exécute directement `GardeTechnicienBureau`
 * (`app/(back-office)/template.tsx`, le vrai garde depuis 9G8D) avec une
 * session TECHNICIEN fabriquée et un chemin de back-office quelconque : le
 * serveur doit refuser — ici, `redirect()` de Next, qui lève une exception
 * portant `/terrain` — avant même de songer à ce que `middleware.ts` a posé.
 */

vi.mock("@/lib/auth/porte", () => ({
  exigerSessionActive: vi.fn(),
}));
vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

import { headers } from "next/headers";

import { exigerSessionActive } from "@/lib/auth/porte";
import { Role } from "@/lib/auth/roles";

import GardeTechnicienBureau from "@/app/(back-office)/template";

const SOCIETE = "0192f0a0-1000-7000-8000-0000000000a1";
const TECHNICIEN = "0192f0a0-1000-7000-8000-0000000000b2";

function session(role: Role) {
  return {
    utilisateurId: TECHNICIEN,
    societeId: SOCIETE,
    role,
    secondFacteurValide: true,
    adresseIp: null,
    clientId: null,
  };
}

/** Deux « once » par scénario, jamais reportés sur le suivant (R1). */
beforeEach(() => {
  vi.mocked(exigerSessionActive).mockReset();
  vi.mocked(headers).mockReset();
});

function poserLaSceneServeur(role: Role, chemin: string): void {
  vi.mocked(exigerSessionActive).mockResolvedValueOnce(session(role));
  vi.mocked(headers).mockResolvedValueOnce(
    new Headers({ "x-chemin": chemin }) as unknown as Awaited<
      ReturnType<typeof headers>
    >,
  );
}

async function digestDuRefus(chemin: string): Promise<string> {
  poserLaSceneServeur(Role.technicien, chemin);
  try {
    await GardeTechnicienBureau({ children: null });
  } catch (erreur) {
    const digest = (erreur as { digest?: string }).digest;
    if (digest === undefined) throw erreur;
    return digest;
  }
  throw new Error("GardeTechnicienBureau n'a pas refusé — aucune exception");
}

describe("9L24 — GardeTechnicienBureau refuse le technicien, par lui-même", () => {
  it("une page quelconque du back-office (/parametres/agences) redirige vers /terrain", async () => {
    const digest = await digestDuRefus("/parametres/agences");
    expect(digest).toMatch(/^NEXT_REDIRECT;/);
    expect(digest).toContain("/terrain");
  });

  it("une autre page (/clients) redirige aussi — ce n'est pas un cas isolé", async () => {
    const digest = await digestDuRefus("/clients");
    expect(digest).toMatch(/^NEXT_REDIRECT;/);
    expect(digest).toContain("/terrain");
  });

  it("LE TÉMOIN — un rôle non technicien n'est jamais refusé ici", async () => {
    poserLaSceneServeur(Role.admin_societe, "/parametres/agences");
    const rendu = await GardeTechnicienBureau({ children: "contenu" });
    expect(rendu).toBe("contenu");
  });

  it("LE TÉMOIN — /arrivee reste ouverte au technicien (exemption connue)", async () => {
    poserLaSceneServeur(Role.technicien, "/arrivee");
    const rendu = await GardeTechnicienBureau({ children: "contenu" });
    expect(rendu).toBe("contenu");
  });
});
