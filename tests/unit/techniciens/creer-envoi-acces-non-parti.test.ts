import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * SOLDES 183 ET 184 (relecture de 9ET-COMPTES-BUREAU-2) — l'interrupteur
 * « Envoyer le lien d'accès en l'ajoutant » de `app/api/techniciens/creer/route.ts`
 * ignorait deux cas, silencieusement :
 *
 * - 183 : un envoi ACCEPTÉ mais NON PARTI (le prestataire refuse le
 *   courriel) retombait sur le motif générique (`equipe.info.rattache` ou
 *   rien) au lieu de dire « le lien n'est pas parti », comme le fait déjà le
 *   bouton dédié de la fiche (`/api/equipe/[id]/envoyer-acces`).
 * - 184 : un rattachement à une identité qui a déjà choisi son mot de passe
 *   (le cliquet de D65, motif `deja_un_mot_de_passe`) était traité comme un
 *   ÉCHEC D'ENVOI (« le lien n'a pas pu être envoyé ») alors que la création
 *   a réussi ET que la personne a déjà un accès — `equipe.info.rattache` est
 *   le texte juste, pas `equipe.refus.envoi_echoue`.
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

const creerTechnicien = vi.fn();
vi.mock("@/lib/techniciens/depot", () => ({
  creerTechnicien: (...args: readonly unknown[]): unknown =>
    creerTechnicien(...args),
}));

const envoyerLienDAcces = vi.fn();
vi.mock("@/lib/auth/acces-technicien", () => ({
  envoyerLienDAcces: (...args: readonly unknown[]): unknown =>
    envoyerLienDAcces(...args),
}));

import { POST } from "@/app/api/techniciens/creer/route";

function requete(coche: boolean): Request {
  const corps = new FormData();
  corps.set("nom", "Technicien 9ETA-0");
  corps.set("email", "technicien@9eta0.e2e.test");
  corps.set("agence_id", "33333333-3333-4333-8333-333333333333");
  corps.set("statut_ressource", "salarie");
  if (coche) {
    corps.set("envoyer_acces", "on");
  }
  return new Request("http://localhost/api/techniciens/creer", {
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
  creerTechnicien.mockReset();
  envoyerLienDAcces.mockReset();
  creerTechnicien.mockResolvedValue({
    accepte: true,
    utilisateurId: UTILISATEUR_ID,
    rattache: false,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/techniciens/creer — l'interrupteur « envoyer le lien en l'ajoutant »", () => {
  it("SOLDE 183 — un envoi accepté mais NON PARTI redirige vers « non parti », avec destinataire et raison", async () => {
    envoyerLienDAcces.mockResolvedValue({
      accepte: true,
      destinataire: "technicien@9eta0.e2e.test",
      envoi: { parti: false, motif: "canal non configuré" },
    });

    const reponse = await POST(requete(true));
    const url = urlDeRetour(reponse);
    expect(url.searchParams.get("motif")).toBe("equipe.acces.non_parti");
    expect(url.searchParams.get("technicien")).toBe(UTILISATEUR_ID);
    expect(url.searchParams.get("destinataire")).toBe(
      "technicien@9eta0.e2e.test",
    );
    expect(url.searchParams.get("raison")).toBe("canal non configuré");
  });

  it("un envoi accepté ET parti ne porte aucun motif de non-parti (comportement inchangé)", async () => {
    envoyerLienDAcces.mockResolvedValue({
      accepte: true,
      destinataire: "technicien@9eta0.e2e.test",
      envoi: { parti: true, reference: "ref-123" },
    });

    const reponse = await POST(requete(true));
    const url = urlDeRetour(reponse);
    expect(url.searchParams.get("motif")).toBeNull();
  });

  it("SOLDE 184 — un rattachement DÉJÀ muni d'un mot de passe rend « equipe.info.rattache », jamais « envoi_echoue »", async () => {
    creerTechnicien.mockResolvedValue({
      accepte: true,
      utilisateurId: UTILISATEUR_ID,
      rattache: true,
    });
    envoyerLienDAcces.mockResolvedValue({
      accepte: false,
      motif: "deja_un_mot_de_passe",
    });

    const reponse = await POST(requete(true));
    const url = urlDeRetour(reponse);
    expect(url.searchParams.get("motif")).toBe("equipe.info.rattache");
  });

  it("un refus « deja_un_mot_de_passe » SANS rattachement reste « envoi_echoue » (cas qui ne devrait pas survenir, mais refuse plutôt que d'inventer un succès)", async () => {
    creerTechnicien.mockResolvedValue({
      accepte: true,
      utilisateurId: UTILISATEUR_ID,
      rattache: false,
    });
    envoyerLienDAcces.mockResolvedValue({
      accepte: false,
      motif: "deja_un_mot_de_passe",
    });

    const reponse = await POST(requete(true));
    const url = urlDeRetour(reponse);
    expect(url.searchParams.get("motif")).toBe("equipe.refus.envoi_echoue");
  });
});
