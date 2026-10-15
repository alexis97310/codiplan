import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * SOLDES 183 ET 184 (relecture de 9ET-COMPTES-BUREAU-2) — même correctif que
 * `tests/unit/techniciens/creer-envoi-acces-non-parti.test.ts`, appliqué à
 * `app/api/equipe/bureau/creer/route.ts`. Voir ce fichier pour le
 * raisonnement complet.
 */

const UTILISATEUR_ID = "77777777-7777-7777-7777-777777777777";

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

const creerCompteDeBureau = vi.fn();
const envoyerLienDAccesBureau = vi.fn();
vi.mock("@/lib/auth/acces-bureau", async (importOriginal) => {
  const reel = await importOriginal<typeof import("@/lib/auth/acces-bureau")>();
  return {
    ...reel,
    creerCompteDeBureau: (...args: readonly unknown[]): unknown =>
      creerCompteDeBureau(...args),
    envoyerLienDAccesBureau: (...args: readonly unknown[]): unknown =>
      envoyerLienDAccesBureau(...args),
  };
});

import { Role } from "@/lib/auth/roles";

import { POST } from "@/app/api/equipe/bureau/creer/route";

function requete(coche: boolean): Request {
  const corps = new FormData();
  corps.set("nom", "Compte de bureau 9ETA-0");
  corps.set("courriel", "compte@9eta0.e2e.test");
  corps.set("role", Role.adv);
  if (coche) {
    corps.set("envoyer_acces", "on");
  }
  return new Request("http://localhost/api/equipe/bureau/creer", {
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
  creerCompteDeBureau.mockReset();
  envoyerLienDAccesBureau.mockReset();
  creerCompteDeBureau.mockResolvedValue({
    accepte: true,
    utilisateurId: UTILISATEUR_ID,
    rattache: false,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/equipe/bureau/creer — l'interrupteur « envoyer le lien en l'ajoutant »", () => {
  it("SOLDE 183 — un envoi accepté mais NON PARTI redirige vers « non parti », avec compte, destinataire et raison", async () => {
    envoyerLienDAccesBureau.mockResolvedValue({
      accepte: true,
      destinataire: "compte@9eta0.e2e.test",
      envoi: { parti: false, motif: "canal non configuré" },
    });

    const reponse = await POST(requete(true));
    const url = urlDeRetour(reponse);
    expect(url.searchParams.get("onglet")).toBe("bureau");
    expect(url.searchParams.get("motif")).toBe("equipe.acces.non_parti");
    expect(url.searchParams.get("compte")).toBe(UTILISATEUR_ID);
    expect(url.searchParams.get("destinataire")).toBe("compte@9eta0.e2e.test");
    expect(url.searchParams.get("raison")).toBe("canal non configuré");
  });

  it("SOLDE 184 — un rattachement DÉJÀ muni d'un mot de passe rend « equipe.info.rattache », jamais « envoi_echoue »", async () => {
    creerCompteDeBureau.mockResolvedValue({
      accepte: true,
      utilisateurId: UTILISATEUR_ID,
      rattache: true,
    });
    envoyerLienDAccesBureau.mockResolvedValue({
      accepte: false,
      motif: "deja_un_mot_de_passe",
    });

    const reponse = await POST(requete(true));
    const url = urlDeRetour(reponse);
    expect(url.searchParams.get("motif")).toBe("equipe.info.rattache");
  });
});
