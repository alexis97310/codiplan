import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/interventions/transmettre/route";
import {
  exigerCapacite,
  exigerCapaciteComplete,
  motifDuRefus,
} from "@/lib/auth/porte";
import { VARIABLE_CLE, VARIABLE_EXPEDITEUR } from "@/lib/courriel";

/**
 * 9DB-RETOUCHES-10 — constat de production du 03/10/2026 (03/10 ~07h05 NC) :
 * un seul technicien, dont le courriel récapitulatif n'est pas parti,
 * s'affichait comme « 1 technicien prévenu par courriel » ET « 1 technicien
 * n'a pas reçu son courriel récapitulatif » à la fois. `techniciens` doit ne
 * compter que les envois PARTIS ; le drapeau `courriel=non_configure` doit
 * se poser quand c'est la configuration elle-même, et non un accident
 * d'envoi, qui a empêché tout départ.
 */

vi.mock("@/lib/auth/porte", async () => {
  const { Role } = await import("@/lib/auth/roles");
  const contexte = {
    utilisateurId: "11111111-1111-1111-1111-111111111111",
    societeId: "22222222-2222-2222-2222-222222222222",
    role: Role.adv,
    secondFacteurValide: true,
    adresseIp: null,
    clientId: null,
  };
  return {
    exigerCapacite: vi.fn().mockResolvedValue(contexte),
    exigerCapaciteComplete: vi.fn().mockResolvedValue(contexte),
    motifDuRefus: vi.fn(),
  };
});

const ID = "33333333-3333-3333-3333-333333333333";

vi.mock("@/lib/interventions/depot", () => ({
  listerPlanifieesATransmettre: vi.fn(),
  debutDuJourSociete: vi.fn(),
  transmettreEnGroupe: vi.fn().mockResolvedValue({
    transmises: ["33333333-3333-3333-3333-333333333333"],
    refusees: [],
  }),
}));

const avertirApresTransmissionGroupee = vi.fn();
vi.mock("@/lib/avertissements/planification", () => ({
  avertirApresTransmissionGroupee: (...args: readonly unknown[]): unknown =>
    avertirApresTransmissionGroupee(...args),
}));

function requete(): Request {
  const corps = new FormData();
  corps.set("id", ID);
  return new Request("http://localhost/api/interventions/transmettre", {
    method: "POST",
    body: corps,
  });
}

async function parametresDeLaReponse(
  reponse: Response,
): Promise<URLSearchParams> {
  expect(reponse.status).toBe(303);
  const location = reponse.headers.get("Location");
  expect(location).not.toBeNull();
  return new URL(location as string, "http://localhost").searchParams;
}

const CLE_INITIALE = process.env[VARIABLE_CLE];
const EXPEDITEUR_INITIAL = process.env[VARIABLE_EXPEDITEUR];

beforeEach(() => {
  avertirApresTransmissionGroupee.mockReset();
});

// Addendum du 05/10/2026 (9D3A-REPRISE-9D3) : le `mockResolvedValueOnce`
// posé sur `exigerCapacite` par l'épreuve « un TECHNICIEN est refusé »
// n'est jamais consommé (la route n'appelle QUE `exigerCapaciteComplete`) —
// sans ce nettoyage, la valeur fuirait sur le prochain appel à
// `exigerCapacite` ; `vi.clearAllMocks()` seul ne vide PAS cette file,
// mesuré, `mockReset()` suivi de la ré-application du défaut, si.
afterEach(async () => {
  const { Role } = await import("@/lib/auth/roles");
  const contexteAdv = {
    utilisateurId: "11111111-1111-1111-1111-111111111111",
    societeId: "22222222-2222-2222-2222-222222222222",
    role: Role.adv,
    secondFacteurValide: true,
    adresseIp: null,
    clientId: null,
  };
  vi.mocked(exigerCapacite).mockReset().mockResolvedValue(contexteAdv);
  vi.mocked(exigerCapaciteComplete).mockReset().mockResolvedValue(contexteAdv);
});

afterEach(() => {
  if (CLE_INITIALE === undefined) {
    delete process.env[VARIABLE_CLE];
  } else {
    process.env[VARIABLE_CLE] = CLE_INITIALE;
  }
  if (EXPEDITEUR_INITIAL === undefined) {
    delete process.env[VARIABLE_EXPEDITEUR];
  } else {
    process.env[VARIABLE_EXPEDITEUR] = EXPEDITEUR_INITIAL;
  }
});

describe("POST /api/interventions/transmettre — compte-rendu après transmission groupée", () => {
  it("un envoi PARTI est compté « prévenu », jamais un envoi seulement TENTÉ", async () => {
    avertirApresTransmissionGroupee.mockResolvedValue([
      { technicienId: "t1", nombre: 1, envoi: { type: "parti" } },
    ]);

    const parametres = await parametresDeLaReponse(await POST(requete()));
    expect(parametres.get("techniciens")).toBe("1");
    expect(parametres.get("echecsCourriel")).toBe("0");
  });

  it("un envoi NON PARTI n'est jamais compté « prévenu », même s'il a été tenté", async () => {
    avertirApresTransmissionGroupee.mockResolvedValue([
      {
        technicienId: "t1",
        nombre: 1,
        envoi: { type: "non_parti", motif: "Resend a refusé l'envoi." },
      },
    ]);

    const parametres = await parametresDeLaReponse(await POST(requete()));
    expect(parametres.get("techniciens")).toBe("0");
    expect(parametres.get("echecsCourriel")).toBe("1");
  });

  it("un envoi SANS DESTINATAIRE n'est jamais compté « prévenu »", async () => {
    avertirApresTransmissionGroupee.mockResolvedValue([
      { technicienId: "t1", nombre: 1, envoi: { type: "sans_destinataire" } },
    ]);

    const parametres = await parametresDeLaReponse(await POST(requete()));
    expect(parametres.get("techniciens")).toBe("0");
    expect(parametres.get("echecsCourriel")).toBe("1");
  });

  it("canal non configuré : le drapeau se pose, et chaque non-parti est tracé sans adresse ni contenu", async () => {
    delete process.env[VARIABLE_CLE];
    delete process.env[VARIABLE_EXPEDITEUR];
    const motif =
      "L'envoi de courriel n'est pas configuré : COURRIEL_API_CLE et " +
      "COURRIEL_EXPEDITEUR sont absentes. RIEN N'A ÉTÉ ENVOYÉ.";
    avertirApresTransmissionGroupee.mockResolvedValue([
      { technicienId: "t1", nombre: 1, envoi: { type: "non_parti", motif } },
    ]);

    const espionErreur = vi.spyOn(console, "error").mockImplementation(() => {
      // rien — on vérifie seulement l'appel
    });
    try {
      const parametres = await parametresDeLaReponse(await POST(requete()));
      expect(parametres.get("courriel")).toBe("non_configure");
      expect(parametres.get("techniciens")).toBe("0");
      expect(parametres.get("echecsCourriel")).toBe("1");

      expect(espionErreur).toHaveBeenCalledTimes(1);
      const [message, motifTrace] = espionErreur.mock
        .calls[0] as readonly unknown[];
      expect(message).toContain("t1");
      expect(message).toContain("non_parti");
      expect(motifTrace).toBe(motif);
      expect(motifTrace).not.toMatch(/@/);
    } finally {
      espionErreur.mockRestore();
    }
  });

  it("canal configuré mais échec propre à l'envoi (pas la configuration) : aucun drapeau", async () => {
    process.env[VARIABLE_CLE] = "une-cle-de-test";
    process.env[VARIABLE_EXPEDITEUR] = "expediteur@example.test";
    avertirApresTransmissionGroupee.mockResolvedValue([
      {
        technicienId: "t1",
        nombre: 1,
        envoi: { type: "non_parti", motif: "Resend a refusé l'envoi." },
      },
    ]);

    const espionErreur = vi.spyOn(console, "error").mockImplementation(() => {
      // rien — on vérifie seulement l'appel
    });
    try {
      const parametres = await parametresDeLaReponse(await POST(requete()));
      expect(parametres.get("courriel")).toBeNull();
    } finally {
      espionErreur.mockRestore();
    }
  });

  /**
   * 9D3-PLANNING-TECHNICIEN-ACTIONS — même garde-fou que
   * `deplacer-refus-saisie.test.ts` : les épreuves ci-dessus font répondre
   * un contexte ADV aux DEUX fonctions de la porte, quelle que soit celle
   * appelée. Cette épreuve distingue `exigerCapacite` (laisserait passer le
   * ○ du technicien) de `exigerCapaciteComplete` (jamais) — un retour de
   * cette route à `exigerCapacite` simple rougirait ici.
   */
  it("un TECHNICIEN est refusé : si la route revenait à exigerCapacite, ce test rougirait", async () => {
    const contexteTechnicien = {
      utilisateurId: "11111111-1111-1111-1111-111111111111",
      societeId: "22222222-2222-2222-2222-222222222222",
      role: (await import("@/lib/auth/roles")).Role.technicien,
      secondFacteurValide: true,
      adresseIp: null,
      clientId: null,
    };
    vi.mocked(exigerCapacite).mockResolvedValueOnce(contexteTechnicien);
    vi.mocked(exigerCapaciteComplete).mockResolvedValueOnce(null);
    vi.mocked(motifDuRefus).mockResolvedValueOnce("auth.refus_droit");

    const parametres = await parametresDeLaReponse(await POST(requete()));
    expect(parametres.get("motif")).toBe("auth.refus_droit");
    expect(exigerCapaciteComplete).toHaveBeenCalled();
  });
});
