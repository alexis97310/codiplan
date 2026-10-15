import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * « TOUT ENVOYER » (9EY-EQUIPE-ALERTE-TOUT-ENVOYER, point 1) —
 * `app/api/equipe/envoyer-acces/tous/route.ts`.
 *
 * Même patron que `bureau-creer-envoi-acces-non-parti.test.ts` : la porte,
 * les dépôts et les gestes d'envoi sont mockés, jamais une vraie base. La
 * POPULATION (qui reçoit un lien) est entièrement calculée par la route — ce
 * fichier la fait varier en contrôlant ce que les dépôts mockés rendent,
 * jamais en la passant dans le corps de la requête (il n'y en a pas de champ
 * prévu pour ça).
 */

vi.mock("@/lib/auth/porte", () => ({
  exigerCapacite: vi.fn().mockResolvedValue({
    utilisateurId: "11111111-1111-1111-1111-111111111111",
    societeId: "22222222-2222-2222-2222-222222222222",
    secondFacteurValide: true,
    adresseIp: null,
    clientId: null,
  }),
  motifDuRefus: vi.fn().mockResolvedValue("auth.refus_droit"),
}));

const listerLesTechniciens = vi.fn();
vi.mock("@/lib/techniciens/depot", async (importOriginal) => {
  const reel = await importOriginal<typeof import("@/lib/techniciens/depot")>();
  return {
    ...reel,
    listerLesTechniciens: (...args: readonly unknown[]): unknown =>
      listerLesTechniciens(...args),
  };
});

const etatsAccesDesTechniciens = vi.fn();
const envoyerLienDAcces = vi.fn();
vi.mock("@/lib/auth/acces-technicien", async (importOriginal) => {
  const reel =
    await importOriginal<typeof import("@/lib/auth/acces-technicien")>();
  return {
    ...reel,
    etatsAccesDesTechniciens: (...args: readonly unknown[]): unknown =>
      etatsAccesDesTechniciens(...args),
    envoyerLienDAcces: (...args: readonly unknown[]): unknown =>
      envoyerLienDAcces(...args),
  };
});

const listerComptesDeBureau = vi.fn();
const etatsAccesDesComptes = vi.fn();
const envoyerLienDAccesBureau = vi.fn();
vi.mock("@/lib/auth/acces-bureau", async (importOriginal) => {
  const reel = await importOriginal<typeof import("@/lib/auth/acces-bureau")>();
  return {
    ...reel,
    listerComptesDeBureau: (...args: readonly unknown[]): unknown =>
      listerComptesDeBureau(...args),
    etatsAccesDesComptes: (...args: readonly unknown[]): unknown =>
      etatsAccesDesComptes(...args),
    envoyerLienDAccesBureau: (...args: readonly unknown[]): unknown =>
      envoyerLienDAccesBureau(...args),
  };
});

import { exigerCapacite } from "@/lib/auth/porte";

import { POST } from "@/app/api/equipe/envoyer-acces/tous/route";

const TECH_1 = "aaaaaaaa-0000-7000-8000-000000000001";
const TECH_2 = "aaaaaaaa-0000-7000-8000-000000000002";
const TECH_ACTIF = "aaaaaaaa-0000-7000-8000-000000000003";
const TECH_INACTIF = "aaaaaaaa-0000-7000-8000-000000000004";
const COMPTE_1 = "bbbbbbbb-0000-7000-8000-000000000001";
const COMPTE_ACTIF = "bbbbbbbb-0000-7000-8000-000000000002";

function technicien(
  utilisateurId: string,
  actif: boolean,
): { utilisateurId: string; nom: string; email: string; actif: boolean } {
  return {
    utilisateurId,
    nom: `Technicien ${utilisateurId}`,
    email: "t@test",
    actif,
  };
}

function compte(utilisateurId: string): {
  utilisateurId: string;
  nom: string;
  email: string;
} {
  return { utilisateurId, nom: `Compte ${utilisateurId}`, email: "c@test" };
}

function requete(acces_a_ouvrir?: boolean): Request {
  const corps = new FormData();
  if (acces_a_ouvrir === true) {
    corps.set("acces_a_ouvrir", "1");
  }
  return new Request("http://localhost/api/equipe/envoyer-acces/tous", {
    method: "POST",
    body: corps,
  });
}

function urlDeRetour(reponse: Response): URL {
  const location = reponse.headers.get("Location");
  expect(location).not.toBeNull();
  return new URL(location as string, "http://localhost");
}

beforeEach(() => {
  vi.mocked(exigerCapacite).mockReset();
  vi.mocked(exigerCapacite).mockResolvedValue({
    utilisateurId: "11111111-1111-1111-1111-111111111111",
    societeId: "22222222-2222-2222-2222-222222222222",
    secondFacteurValide: true,
    adresseIp: null,
    clientId: null,
  } as never);
  listerLesTechniciens.mockReset();
  etatsAccesDesTechniciens.mockReset();
  envoyerLienDAcces.mockReset();
  listerComptesDeBureau.mockReset();
  etatsAccesDesComptes.mockReset();
  envoyerLienDAccesBureau.mockReset();

  listerLesTechniciens.mockResolvedValue([
    technicien(TECH_1, true),
    technicien(TECH_2, true),
    technicien(TECH_ACTIF, true),
    technicien(TECH_INACTIF, false),
  ]);
  etatsAccesDesTechniciens.mockResolvedValue(
    new Map([
      [TECH_1, { etat: "aucun" }],
      [TECH_2, { etat: "lien_expire", horodatage: new Date() }],
      [TECH_ACTIF, { etat: "actif" }],
    ]),
  );
  listerComptesDeBureau.mockResolvedValue([
    compte(COMPTE_1),
    compte(COMPTE_ACTIF),
  ]);
  etatsAccesDesComptes.mockResolvedValue(
    new Map([
      [COMPTE_1, { etat: "lien_envoye", horodatage: new Date() }],
      [COMPTE_ACTIF, { etat: "actif" }],
    ]),
  );
  envoyerLienDAcces.mockResolvedValue({
    accepte: true,
    destinataire: "t@test",
    envoi: { parti: true, reference: "r" },
  });
  envoyerLienDAccesBureau.mockResolvedValue({
    accepte: true,
    destinataire: "c@test",
    envoi: { parti: true, reference: "r" },
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/equipe/envoyer-acces/tous", () => {
  it("un rôle sans « administrer_utilisateurs » refuse, sans appeler aucun envoi", async () => {
    vi.mocked(exigerCapacite).mockResolvedValue(null);

    const reponse = await POST(requete());
    const url = urlDeRetour(reponse);
    expect(url.searchParams.get("motif")).toBe("auth.refus_droit");
    expect(envoyerLienDAcces).not.toHaveBeenCalled();
    expect(envoyerLienDAccesBureau).not.toHaveBeenCalled();
  });

  it("LA POPULATION EST CALCULÉE PAR LA ROUTE — techniciens actifs non-actifs ET comptes de bureau non-actifs seulement", async () => {
    const reponse = await POST(requete());

    expect(envoyerLienDAcces).toHaveBeenCalledTimes(2);
    expect(envoyerLienDAcces).toHaveBeenCalledWith(expect.anything(), TECH_1);
    expect(envoyerLienDAcces).toHaveBeenCalledWith(expect.anything(), TECH_2);
    expect(envoyerLienDAcces).not.toHaveBeenCalledWith(
      expect.anything(),
      TECH_ACTIF,
    );
    expect(envoyerLienDAcces).not.toHaveBeenCalledWith(
      expect.anything(),
      TECH_INACTIF,
    );

    expect(envoyerLienDAccesBureau).toHaveBeenCalledTimes(1);
    expect(envoyerLienDAccesBureau).toHaveBeenCalledWith(
      expect.anything(),
      COMPTE_1,
    );
    expect(envoyerLienDAccesBureau).not.toHaveBeenCalledWith(
      expect.anything(),
      COMPTE_ACTIF,
    );

    const url = urlDeRetour(reponse);
    expect(url.searchParams.get("motif")).toBe("equipe.acces.tous_envoyes");
    expect(url.searchParams.get("n")).toBe("3");
    expect(url.searchParams.get("echecs")).toBe("0");
    expect(url.searchParams.has("acces")).toBe(false);
  });

  it("un échec (courriel non parti, ou RefusEnvoiAcces) est compté, et n'arrête pas les autres envois", async () => {
    const { RefusEnvoiAcces } = await import("@/lib/auth/acces-technicien");
    envoyerLienDAcces
      .mockResolvedValueOnce({
        accepte: true,
        destinataire: "t@test",
        envoi: { parti: false, motif: "canal non configuré" },
      })
      .mockRejectedValueOnce(new RefusEnvoiAcces("aucun jeton"));

    const reponse = await POST(requete());

    expect(envoyerLienDAcces).toHaveBeenCalledTimes(2);
    expect(envoyerLienDAccesBureau).toHaveBeenCalledTimes(1);
    const url = urlDeRetour(reponse);
    expect(url.searchParams.get("n")).toBe("1");
    expect(url.searchParams.get("echecs")).toBe("2");
  });

  it("conserve `acces=a-ouvrir` quand la demande venait de cette vue", async () => {
    const reponse = await POST(requete(true));
    const url = urlDeRetour(reponse);
    expect(url.searchParams.get("acces")).toBe("a-ouvrir");
  });
});
