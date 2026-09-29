import { describe, expect, it, vi } from "vitest";

import { POST as postAffecter } from "@/app/api/interventions/[id]/affecter/route";
import { POST as postCloturer } from "@/app/api/interventions/[id]/cloturer/route";
import { POST as postSuspendre } from "@/app/api/interventions/[id]/suspendre/route";
import { exigerCapacite } from "@/lib/auth/porte";

/**
 * IN-22 (audit du 28/09, 9BP-TP-A4a-MESSAGES) — TROIS MOTIFS FAUX SUR LA
 * FICHE INTERVENTION.
 *
 * Mesuré sur `main` avant ce ticket : Affecter sans technicien rendait
 * `intervention.refus.habilitation` (un verdict qui n'a jamais été prononcé —
 * aucun technicien n'a même été désigné) ; Suspendre confondait « motif
 * manquant » et « référence de pièce sans sa date » sous la même clé ;
 * Clôturer confondait « aucun temps mesuré » et « temps saisi mais invalide »
 * sous la même clé. Ce fichier éprouve la SÉLECTION DE LA CLÉ par la route,
 * sans traverser la base — le dépôt n'est jamais atteint puisque la saisie
 * échoue avant (même parti pris que
 * `tests/unit/interventions/deplacer-refus-saisie.test.ts`).
 *
 * Le facteur importe `Role` lui-même plutôt que de lire une variable de
 * portée externe : un `vi.mock` est hoissé au-dessus de tout import de ce
 * fichier, et « aucun rôle en chaîne libre » interdit d'écrire le nom du rôle
 * entre guillemets ici (gardien `roles-sans-chaine-libre`).
 */
vi.mock("@/lib/auth/porte", async () => {
  const { Role } = await import("@/lib/auth/roles");
  return {
    exigerCapacite: vi.fn().mockResolvedValue({
      utilisateurId: "11111111-1111-1111-1111-111111111111",
      societeId: "22222222-2222-2222-2222-222222222222",
      role: Role.adv,
      secondFacteurValide: true,
      adresseIp: null,
      clientId: null,
    }),
    motifDuRefus: vi.fn().mockResolvedValue("auth.refus_droit"),
  };
});

const ID = "33333333-3333-3333-3333-333333333333";

function requete(
  chemin: string,
  champs: Readonly<Record<string, string>>,
): Request {
  const corps = new FormData();
  for (const [nom, valeur] of Object.entries(champs)) {
    corps.set(nom, valeur);
  }
  return new Request(`http://localhost/api/interventions/${ID}/${chemin}`, {
    method: "POST",
    body: corps,
  });
}

function motifDeLaRedirection(reponse: Response): string | null {
  const location = reponse.headers.get("location");
  if (location === null) {
    return null;
  }
  return new URL(location, "http://localhost").searchParams.get("motif");
}

const PARAMS = { params: Promise.resolve({ id: ID }) };

describe("Affecter — sans technicien, jamais « intervention.refus.habilitation »", () => {
  it("aucun technicien_id → intervention.refus.planification_technicien_manquant", async () => {
    const reponse = await postAffecter(requete("affecter", {}), PARAMS);
    expect(motifDeLaRedirection(reponse)).toBe(
      "intervention.refus.planification_technicien_manquant",
    );
  });
});

describe("Suspendre — le motif manquant et la pièce sans date, deux clés distinctes", () => {
  it("motif présent, référence de pièce SANS date → intervention.refus.piece_et_date", async () => {
    const reponse = await postSuspendre(
      requete("suspendre", {
        motif: "Attente d'une pièce détachée",
        piece_attendue_ref: "REF-4821",
      }),
      PARAMS,
    );
    expect(motifDeLaRedirection(reponse)).toBe(
      "intervention.refus.piece_et_date",
    );
  });

  it("aucun motif → intervention.refus.motif_manquant (inchangé)", async () => {
    const reponse = await postSuspendre(requete("suspendre", {}), PARAMS);
    expect(motifDeLaRedirection(reponse)).toBe(
      "intervention.refus.motif_manquant",
    );
  });
});

describe("Clôturer — un temps saisi mais invalide n'est pas « aucun temps mesuré »", () => {
  it("temps fractionnaire (2.5) → intervention.refus.temps_invalide", async () => {
    const reponse = await postCloturer(
      requete("cloturer", { temps_valide_min: "2.5" }),
      PARAMS,
    );
    expect(motifDeLaRedirection(reponse)).toBe(
      "intervention.refus.temps_invalide",
    );
  });

  it("temps nul (0) → intervention.refus.temps_invalide", async () => {
    const reponse = await postCloturer(
      requete("cloturer", { temps_valide_min: "0" }),
      PARAMS,
    );
    expect(motifDeLaRedirection(reponse)).toBe(
      "intervention.refus.temps_invalide",
    );
  });
});

describe("Le refus de droit traverse ces trois routes comme les autres (D-12)", () => {
  it("Affecter, contexte refusé par la porte → auth.refus_droit", async () => {
    vi.mocked(exigerCapacite).mockResolvedValueOnce(null);
    const reponse = await postAffecter(
      requete("affecter", {
        technicien_id: "44444444-4444-4444-4444-444444444444",
      }),
      PARAMS,
    );
    expect(motifDeLaRedirection(reponse)).toBe("auth.refus_droit");
  });
});
