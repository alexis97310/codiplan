import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { avecFilet } from "@/app/api/interventions/actions";

/**
 * LE FILET (74-FORMULAIRES-3, SAV-02) — une panne pendant une action de la
 * fiche ramène à la fiche avec un message, jamais une page d'erreur brute.
 *
 * Les 8 routes `app/api/interventions/[id]/*` n'avaient aucun `try` : une
 * exception du dépôt (base injoignable, délai, conflit) remontait jusqu'à
 * Next, l'utilisateur perdait la fiche et ne savait pas si l'action avait été
 * faite.
 */

const ROUTES = [
  "affecter",
  "annuler",
  "cloturer",
  "deplacer",
  "machine",
  "note-interne",
  "reprendre",
  "suspendre",
] as const;

const ID = "44444444-4444-4444-4444-444444444444";

describe("avecFilet", () => {
  it("rend la réponse de l'action, inchangée, quand elle réussit", async () => {
    const reponse = new Response(null, {
      status: 303,
      headers: { Location: `/interventions/${ID}` },
    });
    const resultat = await avecFilet(ID, "affecter", async () => reponse);
    expect(resultat).toBe(reponse);
  });

  it("ramène à la fiche avec le motif générique sur une panne ordinaire — et journalise", async () => {
    const espionErreur = vi.spyOn(console, "error").mockImplementation(() => {
      // rien — on vérifie seulement l'appel
    });
    try {
      const resultat = await avecFilet(ID, "affecter", async () => {
        throw new Error("base injoignable");
      });
      expect(resultat.status).toBe(303);
      const location = resultat.headers.get("Location");
      expect(location).not.toBeNull();
      const url = new URL(location as string, "http://localhost");
      expect(url.pathname).toBe(`/interventions/${ID}`);
      expect(url.searchParams.get("motif")).toBe(
        "intervention.refus.erreur_serveur",
      );
      expect(espionErreur).toHaveBeenCalledTimes(1);
    } finally {
      espionErreur.mockRestore();
    }
  });

  it("relance une erreur de redirection Next sans l'avaler", async () => {
    const erreurDeRedirection = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;push;/planning;303;",
    });
    await expect(
      avecFilet(ID, "affecter", async () => {
        throw erreurDeRedirection;
      }),
    ).rejects.toBe(erreurDeRedirection);
  });
});

describe("gardien — chaque route d'intervention appelle avecFilet", () => {
  for (const route of ROUTES) {
    it(`app/api/interventions/[id]/${route}/route.ts appelle avecFilet`, () => {
      const chemin = join(
        process.cwd(),
        "app",
        "api",
        "interventions",
        "[id]",
        route,
        "route.ts",
      );
      const contenu = readFileSync(chemin, "utf8");
      expect(contenu).toMatch(/\bavecFilet\(/);
    });
  }
});
