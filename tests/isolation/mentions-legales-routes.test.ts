import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

/**
 * LA ROUTE DES MENTIONS LÉGALES, PAR ELLE-MÊME (point 3, relecture de 9I7A,
 * 9I7D-RESERVES-DE-REVUE-ACCES-ET-MENTIONS) — `tests/isolation/
 * mentions-legales-societe.test.ts` éprouve déjà `enregistrerMentionsLegales`
 * directement ; ce fichier éprouve ce que la ROUTE ajoute (la porte), et le
 * vrai texte envoyé en POST, sur le modèle de
 * `tests/isolation/logo-societe-routes.test.ts`.
 */

vi.mock("@/lib/auth/porte", () => ({
  exigerCapaciteComplete: vi.fn(),
  motifDuRefus: vi.fn().mockResolvedValue("auth.refus_droit"),
}));

vi.hoisted(() => {
  const base = process.env.TEST_DATABASE_URL;
  if (base === undefined) {
    throw new Error(
      "TEST_DATABASE_URL est requis pour tests/isolation/mentions-legales-routes.test.ts.",
    );
  }
  const url = new URL(base);
  url.username = "codiplan_app";
  url.password = "";
  process.env.DATABASE_URL = url.toString();
});

import type { ContexteActif } from "@/lib/auth/contexte";
import { exigerCapaciteComplete } from "@/lib/auth/porte";
import { Role } from "@/lib/auth/roles";

import { POST } from "@/app/api/parametres/societe/mentions-legales/route";

import { clientOwner, fermerClients } from "./setup/db";
import { SOCIETE_A } from "./setup/fixtures";

afterAll(fermerClients);

function contexteActif(role: Role): ContexteActif {
  return {
    utilisateurId: "aaaaaaaa-0000-7000-8000-000000000099",
    societeId: SOCIETE_A,
    role,
    secondFacteurValide: true,
    adresseIp: null,
    clientId: null,
  };
}

function requete(texte: string): Request {
  const corps = new FormData();
  corps.set("mentions_legales", texte);
  return new Request(
    "http://localhost/api/parametres/societe/mentions-legales",
    { method: "POST", body: corps },
  );
}

function motifDeLaRedirection(reponse: Response): string | null {
  const location = reponse.headers.get("location");
  if (location === null) return null;
  return new URL(location, "http://localhost").searchParams.get("motif");
}

async function texteEnBase(): Promise<string | null> {
  const societe = await clientOwner().societe.findUniqueOrThrow({
    where: { id: SOCIETE_A },
    select: { mentions_legales: true },
  });
  return societe.mentions_legales;
}

afterEach(async () => {
  await clientOwner().societe.update({
    where: { id: SOCIETE_A },
    data: { mentions_legales: null },
  });
});

describe("POST /api/parametres/societe/mentions-legales — la porte", () => {
  it("un rôle ADV est refusé — rien n'est écrit", async () => {
    vi.mocked(exigerCapaciteComplete).mockResolvedValueOnce(null);
    const reponse = await POST(requete("Tentative ADV"));
    expect(motifDeLaRedirection(reponse)).toBe("auth.refus_droit");
    expect(await texteEnBase()).toBeNull();
  });

  it("un rôle technicien est refusé — rien n'est écrit", async () => {
    vi.mocked(exigerCapaciteComplete).mockResolvedValueOnce(null);
    const reponse = await POST(requete("Tentative technicien"));
    expect(motifDeLaRedirection(reponse)).toBe("auth.refus_droit");
    expect(await texteEnBase()).toBeNull();
  });
});

describe("POST /api/parametres/societe/mentions-legales — le texte", () => {
  it("plus de 1000 caractères : refus nommé, rien n'est écrit", async () => {
    vi.mocked(exigerCapaciteComplete).mockResolvedValueOnce(
      contexteActif(Role.admin_societe),
    );
    const reponse = await POST(requete("a".repeat(1001)));
    expect(motifDeLaRedirection(reponse)).toBe("mentions_legales.refus.taille");
    expect(await texteEnBase()).toBeNull();
  });

  it("les retours à la ligne sont conservés à l'aller-retour, \\r\\n devenu \\n", async () => {
    vi.mocked(exigerCapaciteComplete).mockResolvedValueOnce(
      contexteActif(Role.admin_societe),
    );
    const reponse = await POST(requete("Ligne 1\r\nLigne 2\r\nLigne 3"));
    expect(motifDeLaRedirection(reponse)).toBeNull();
    expect(await texteEnBase()).toBe("Ligne 1\nLigne 2\nLigne 3");
  });

  it("un octet NUL refuse, maîtrisé — jamais une erreur 500 de PostgreSQL", async () => {
    vi.mocked(exigerCapaciteComplete).mockResolvedValueOnce(
      contexteActif(Role.admin_societe),
    );
    const reponse = await POST(requete("Avant\u0000Après"));
    expect(motifDeLaRedirection(reponse)).toBe(
      "mentions_legales.refus.caracteres",
    );
    expect(await texteEnBase()).toBeNull();
  });
});
