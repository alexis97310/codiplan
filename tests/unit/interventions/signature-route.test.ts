import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 9D1-SIGNATURE-CLIENT-ABSENT — régression publiée par 9DF/9DFA (e62923cb) :
 * `schemaSignature` est devenu `.strict()` (R1, relecture du 04/10/2026),
 * mais `POST /api/terrain/{id}/signature` continuait d'envoyer TOUJOURS les
 * clés `image_base64`, `signataire_nom`, `signataire_qualite` (valeur `null`
 * si absentes). Avec un schéma strict, une clé présente à `null` est une clé
 * INCONNUE pour les issues `client_absent` / `refus_signature` : le serveur
 * refusait le formulaire pour « motif manquant » même avec un motif saisi.
 *
 * Ce fichier éprouve la ROUTE (et non `schemaSignature` seul, déjà couvert
 * par `signature-signataire.test.ts`) : c'est l'objet construit par la route
 * avant `safeParse`, pas le schéma, qui était fautif.
 */

const ID = "33333333-3333-3333-3333-333333333333";

vi.mock("@/lib/auth/porte", () => ({
  exigerCapacite: vi.fn().mockResolvedValue({
    utilisateurId: "11111111-1111-1111-1111-111111111111",
    societeId: "22222222-2222-2222-2222-222222222222",
    secondFacteurValide: true,
    adresseIp: null,
    clientId: null,
  }),
  motifDuRefus: vi.fn().mockResolvedValue("motif"),
}));

vi.mock("@/lib/interventions/perimetre-technicien", () => ({
  perimetreDuPlanning: vi.fn().mockReturnValue({
    acces: "restreint",
    technicienId: "11111111-1111-1111-1111-111111111111",
  }),
}));

const enregistrerSignature = vi.fn();
vi.mock("@/lib/interventions/depot-rapport-terrain", async () => {
  const reel = await vi.importActual<
    typeof import("@/lib/interventions/depot-rapport-terrain")
  >("@/lib/interventions/depot-rapport-terrain");
  return {
    ...reel,
    enregistrerSignature: (...args: readonly unknown[]): unknown =>
      enregistrerSignature(...args),
  };
});

import { POST } from "@/app/api/terrain/[id]/signature/route";

function requete(champs: Record<string, string>): Request {
  const corps = new FormData();
  for (const [cle, valeur] of Object.entries(champs)) {
    corps.set(cle, valeur);
  }
  return new Request(`http://localhost/api/terrain/${ID}/signature`, {
    method: "POST",
    body: corps,
  });
}

function params(): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id: ID }) };
}

async function motifDeLaReponse(reponse: Response): Promise<string | null> {
  expect(reponse.status).toBe(303);
  const location = reponse.headers.get("Location");
  expect(location).not.toBeNull();
  return new URL(location as string, "http://localhost").searchParams.get(
    "motif",
  );
}

beforeEach(() => {
  enregistrerSignature.mockReset();
  enregistrerSignature.mockResolvedValue({
    id: "44444444-4444-4444-4444-444444444444",
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/terrain/[id]/signature — issue client_absent / refus_signature", () => {
  it.each(["client_absent", "refus_signature"] as const)(
    "%s avec un motif non vide est ACCEPTÉ, formulaire sans image",
    async (issue) => {
      const reponse = await POST(
        requete({ issue, motif: "Client injoignable" }),
        params(),
      );

      const motif = await motifDeLaReponse(reponse);
      expect(motif).toBeNull();
      expect(enregistrerSignature).toHaveBeenCalledTimes(1);
      const saisie = enregistrerSignature.mock.calls[0]?.[2];
      expect(saisie).toStrictEqual({ issue, motif: "Client injoignable" });
    },
  );

  it.each(["client_absent", "refus_signature"] as const)(
    "%s avec un motif vide est refusé pour motif manquant",
    async (issue) => {
      const reponse = await POST(requete({ issue, motif: "" }), params());

      const motif = await motifDeLaReponse(reponse);
      expect(motif).toBe("terrain.signature.motif_manquant");
      expect(enregistrerSignature).not.toHaveBeenCalled();
    },
  );

  // L'invariant « jamais d'image sur ces deux issues » reste gardé AU NIVEAU
  // DU SCHÉMA (`signature-signataire.test.ts:~156`, préservé) : la route ne
  // construit que `{issue, motif}` pour `client_absent`/`refus_signature`,
  // l'écran terrain ne proposant de canevas que pour `signee` — une image
  // reçue ici ne peut venir que d'un appel direct hors écran, et c'est ce cas
  // que le schéma strict refuse.
  it.each(["client_absent", "refus_signature"] as const)(
    "%s ignore un champ image étranger et enregistre quand même le motif",
    async (issue) => {
      const reponse = await POST(
        requete({
          issue,
          motif: "Client injoignable",
          image_base64: "data:image/png;base64,AAAA",
        }),
        params(),
      );

      const motif = await motifDeLaReponse(reponse);
      expect(motif).toBeNull();
      expect(enregistrerSignature).toHaveBeenCalledTimes(1);
      const saisie = enregistrerSignature.mock.calls[0]?.[2];
      expect(saisie).toStrictEqual({ issue, motif: "Client injoignable" });
    },
  );
});

describe("POST /api/terrain/[id]/signature — issue signee", () => {
  it("avec une image et un nom est accepté", async () => {
    const reponse = await POST(
      requete({
        issue: "signee",
        image_base64: "data:image/png;base64,AAAA",
        signataire_nom: "Jean Dupont",
      }),
      params(),
    );

    const motif = await motifDeLaReponse(reponse);
    expect(motif).toBeNull();
    expect(enregistrerSignature).toHaveBeenCalledTimes(1);
    const saisie = enregistrerSignature.mock.calls[0]?.[2];
    expect(saisie).toStrictEqual({
      issue: "signee",
      image_base64: "data:image/png;base64,AAAA",
      signataire_nom: "Jean Dupont",
      signataire_qualite: null,
    });
  });

  it("sans nom est refusé", async () => {
    const reponse = await POST(
      requete({ issue: "signee", image_base64: "data:image/png;base64,AAAA" }),
      params(),
    );

    const motif = await motifDeLaReponse(reponse);
    expect(motif).toBe("terrain.signature.nom_manquant");
    expect(enregistrerSignature).not.toHaveBeenCalled();
  });
});
