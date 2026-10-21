import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { vi } from "vitest";

/**
 * 9F4-TERRAIN-ENREGISTREMENT-AUTO — LES QUATRE ROUTES DU RAPPORT TERRAIN
 * (rapport, prestations, signature, terminer) RÉPONDENT EN JSON QUAND LA
 * REQUÊTE PORTE `Accept: application/json`, ET GARDENT LEUR 303 HABITUEL
 * SINON (le formulaire natif, sans JavaScript, n'envoie jamais cet en-tête).
 *
 * Même mécanisme que celui déjà mesuré pour les photos
 * (`app/api/terrain/[id]/photos/route.ts`) — ce fichier le mesure pour ses
 * trois voisins plus `terminer`. Les dépôts restent des mocks : seule la
 * FORME de la réponse est en jeu ici.
 */

// UN UUID RFC 4122 CONFORME, PAS SEULEMENT « EN FORME DE » UUID
// (9F4H6D-PRESTATIONS-SANS-PERTE, point 5) — `estUuid` (`lib/identifiant.ts`)
// est désormais rejugé par la route `prestations` avant tout `findFirst` ;
// un répété de chiffres sans nibble de version/variante valide (l'ancien
// `"33333333-3333-3333-3333-333333333333"`) s'y faisait refuser, alors que
// RIEN dans ce fichier n'éprouve ce refus-là.
const ID = "33333333-3333-7333-8333-333333333333";

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

const enregistrerRapportTexte = vi.fn();
const terminerIntervention = vi.fn();
const alerterResponsablesSAV = vi.fn();

vi.mock("@/lib/calendar/fuseau", () => ({
  maintenant: vi.fn().mockReturnValue({ instant: new Date("2026-10-17") }),
}));
vi.mock("@/lib/calendar/technicien", () => ({
  fuseauDuTechnicien: vi.fn().mockResolvedValue("Pacific/Noumea"),
}));
vi.mock("@/lib/db/client", () => ({
  avecContexteApplicatif: vi.fn(
    async (_contexte: unknown, fn: (tx: unknown) => unknown) => fn({}),
  ),
}));
vi.mock("@/lib/avertissements/signature-terrain", () => ({
  alerterResponsablesSAV: (...args: readonly unknown[]): unknown =>
    alerterResponsablesSAV(...args),
}));
vi.mock("@/lib/interventions/depot-rapport-terrain", async () => {
  const reel = await vi.importActual<
    typeof import("@/lib/interventions/depot-rapport-terrain")
  >("@/lib/interventions/depot-rapport-terrain");
  return {
    ...reel,
    enregistrerRapportTexte: (...args: readonly unknown[]): unknown =>
      enregistrerRapportTexte(...args),
    definirPrestationsRealisees: vi
      .fn()
      .mockResolvedValue({ id: "33333333-3333-3333-3333-333333333333" }),
    enregistrerSignature: vi
      .fn()
      .mockResolvedValue({ id: "33333333-3333-3333-3333-333333333333" }),
    terminerIntervention: (...args: readonly unknown[]): unknown =>
      terminerIntervention(...args),
  };
});

import { POST as postPrestations } from "@/app/api/terrain/[id]/prestations/route";
import { POST as postRapport } from "@/app/api/terrain/[id]/rapport/route";
import { POST as postSignature } from "@/app/api/terrain/[id]/signature/route";
import { POST as postTerminer } from "@/app/api/terrain/[id]/terminer/route";

function params(): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id: ID }) };
}

function requeteJson(
  route: string,
  champs: Record<string, string> = {},
): Request {
  const corps = new FormData();
  for (const [cle, valeur] of Object.entries(champs)) {
    corps.set(cle, valeur);
  }
  return new Request(`http://localhost/api/terrain/${ID}/${route}`, {
    method: "POST",
    body: corps,
    headers: { Accept: "application/json" },
  });
}

beforeEach(() => {
  enregistrerRapportTexte.mockReset();
  enregistrerRapportTexte.mockResolvedValue({ id: ID });
  terminerIntervention.mockReset();
  terminerIntervention.mockResolvedValue({
    accepte: true,
    id: "33333333-3333-3333-3333-333333333333",
    issueSignature: "signee",
    motifSignature: null,
  });
  alerterResponsablesSAV.mockReset();
  alerterResponsablesSAV.mockResolvedValue({ type: "envoye" });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("les routes du rapport terrain répondent en JSON sur `Accept: application/json`", () => {
  it("rapport — succès : `{ok: true}`, jamais de redirection", async () => {
    const reponse = await postRapport(
      requeteJson("rapport", { commentaire_technicien: "Fait" }),
      params(),
    );
    expect(reponse.status).toBe(200);
    expect(await reponse.json()).toStrictEqual({
      ok: true,
      motif: "terrain.rapport.enregistre",
    });
  });

  it("prestations — succès : `{ok: true}`", async () => {
    const reponse = await postPrestations(requeteJson("prestations"), params());
    expect(reponse.status).toBe(200);
    expect(await reponse.json()).toStrictEqual({
      ok: true,
      motif: "terrain.prestations.enregistre",
    });
  });

  it("signature — succès : `{ok: true}`", async () => {
    const reponse = await postSignature(
      requeteJson("signature", {
        issue: "signee",
        image_base64: "data:image/png;base64,AAAA",
        signataire_nom: "Jean Dupont",
      }),
      params(),
    );
    expect(reponse.status).toBe(200);
    expect(await reponse.json()).toStrictEqual({
      ok: true,
      motif: "terrain.signature.enregistre",
    });
  });

  it("signature — refus nommé : `{ok: false, motif}`, jamais de redirection", async () => {
    const reponse = await postSignature(
      requeteJson("signature", { issue: "signee" }),
      params(),
    );
    expect(reponse.status).toBe(200);
    expect(await reponse.json()).toStrictEqual({
      ok: false,
      motif: "terrain.signature.nom_manquant",
    });
  });

  it("terminer — succès : `{ok: true}`", async () => {
    const reponse = await postTerminer(requeteJson("terminer"), params());
    expect(reponse.status).toBe(200);
    expect(await reponse.json()).toStrictEqual({ ok: true, motif: null });
  });

  // 9F4H2A-REJEU-SANS-DOUBLON, point 4 — « terminer rejoué PAR LA ROUTE
  // (un seul courriel) » : le dépôt reconnaît le rejeu (`rejoue: true`), et
  // c'est la ROUTE qui décide alors de ne PAS alerter le SAV une seconde
  // fois (app/api/terrain/[id]/terminer/route.ts, ~:129).
  it("terminer — un geste NORMAL (client absent) alerte le SAV", async () => {
    terminerIntervention.mockResolvedValue({
      accepte: true,
      id: "33333333-3333-3333-3333-333333333333",
      issueSignature: "client_absent",
      motifSignature: "Injoignable",
    });
    const reponse = await postTerminer(requeteJson("terminer"), params());
    expect(reponse.status).toBe(200);
    expect(await reponse.json()).toStrictEqual({ ok: true, motif: null });
    expect(alerterResponsablesSAV).toHaveBeenCalledTimes(1);
  });

  it("terminer — un REJEU reconnu (rejoue: true) n'alerte PAS le SAV une seconde fois", async () => {
    terminerIntervention.mockResolvedValue({
      accepte: true,
      id: "33333333-3333-3333-3333-333333333333",
      issueSignature: "client_absent",
      motifSignature: "Injoignable",
      rejoue: true,
    });
    const reponse = await postTerminer(requeteJson("terminer"), params());
    expect(reponse.status).toBe(200);
    expect(await reponse.json()).toStrictEqual({ ok: true, motif: null });
    expect(alerterResponsablesSAV).not.toHaveBeenCalled();
  });

  it("rapport — SANS l'en-tête JSON, la redirection 303 habituelle reste", async () => {
    const corps = new FormData();
    corps.set("commentaire_technicien", "Fait");
    const reponse = await postRapport(
      new Request(`http://localhost/api/terrain/${ID}/rapport`, {
        method: "POST",
        body: corps,
      }),
      params(),
    );
    expect(reponse.status).toBe(303);
  });
});
