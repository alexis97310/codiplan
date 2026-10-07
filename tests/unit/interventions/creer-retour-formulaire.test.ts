import { describe, expect, it } from "vitest";

import {
  motifDuRefusDeSaisie,
  versLeFormulaire,
} from "@/app/api/interventions/creer/formulaire";
import { schemaCreation } from "@/lib/interventions/saisie";

/**
 * LE RETOUR AU FORMULAIRE APRÈS UN REFUS DE SAISIE (56-FORMULAIRES-2).
 *
 * `POST /api/interventions/creer` redirigeait TOUT refus vers `/planning`,
 * perdant ce que l'utilisateur avait saisi. `versLeFormulaire` construit
 * désormais l'URL de retour vers `/interventions/nouvelle`, motif compris et
 * chaque champ soumis reporté.
 */

const CHAMPS = {
  site: "11111111-1111-1111-1111-111111111111",
  machine: "22222222-2222-2222-2222-222222222222",
  type: "curatif",
  priorite: "p2",
  description: "Le compresseur ne démarre plus & fait un bruit anormal.",
  reference_client: "FRM2-ref",
  contact_id: "33333333-3333-3333-3333-333333333333",
  duree_min: "90",
  demande: "44444444-4444-4444-4444-444444444444",
  mode_valorisation: "forfait",
};

function urlDeRetour(reponse: Response): URL {
  const location = reponse.headers.get("Location");
  expect(location).not.toBeNull();
  return new URL(location as string, "http://localhost");
}

describe("versLeFormulaire", () => {
  it("redirige en 303 vers /interventions/nouvelle", () => {
    const reponse = versLeFormulaire("intervention.refus.panne_manquante", {});
    expect(reponse.status).toBe(303);
    const url = urlDeRetour(reponse);
    expect(url.pathname).toBe("/interventions/nouvelle");
  });

  it("porte le motif comme clé de traduction", () => {
    const url = urlDeRetour(
      versLeFormulaire("intervention.refus.lieu_inconnu", {}),
    );
    expect(url.searchParams.get("motif")).toBe(
      "intervention.refus.lieu_inconnu",
    );
  });

  it("porte CHAQUE champ soumis, encodé — un aller-retour restitue la valeur exacte", () => {
    const url = urlDeRetour(
      versLeFormulaire("intervention.refus.panne_manquante", CHAMPS),
    );
    expect(url.searchParams.get("site")).toBe(CHAMPS.site);
    expect(url.searchParams.get("machine")).toBe(CHAMPS.machine);
    expect(url.searchParams.get("type")).toBe(CHAMPS.type);
    expect(url.searchParams.get("priorite")).toBe(CHAMPS.priorite);
    expect(url.searchParams.get("description")).toBe(CHAMPS.description);
    expect(url.searchParams.get("reference_client")).toBe(
      CHAMPS.reference_client,
    );
    expect(url.searchParams.get("contact_id")).toBe(CHAMPS.contact_id);
    expect(url.searchParams.get("duree_min")).toBe(CHAMPS.duree_min);
    expect(url.searchParams.get("demande")).toBe(CHAMPS.demande);
    expect(url.searchParams.get("mode_valorisation")).toBe(
      CHAMPS.mode_valorisation,
    );
    // L'ESPERLUETTE DE LA DESCRIPTION N'A PAS COUPÉ L'URL — la seule façon de
    // la restituer intacte est qu'elle ait été correctement encodée.
    expect(url.toString()).not.toContain(" & ");
  });

  it("omet un champ absent plutôt que d'écrire une valeur vide", () => {
    const url = urlDeRetour(
      versLeFormulaire("intervention.refus.lieu_inconnu", {
        type: "curatif",
      }),
    );
    expect(url.searchParams.has("site")).toBe(false);
    expect(url.searchParams.has("machine")).toBe(false);
    expect(url.searchParams.get("type")).toBe("curatif");
  });

  it("TRONQUE la description à 1000 caractères dans l'URL", () => {
    const longue = "a".repeat(1500);
    const url = urlDeRetour(
      versLeFormulaire("intervention.refus.panne_manquante", {
        description: longue,
      }),
    );
    expect(url.searchParams.get("description")).toHaveLength(1000);
    expect(url.searchParams.get("description")).toBe("a".repeat(1000));
  });
});

const UUID_VALIDE = "11111111-1111-1111-8111-111111111111";

/**
 * LA PRIORITÉ OBLIGATOIRE À CETTE ROUTE SEULE (décision 15 d'Alexis du
 * 05/10/2026, TP-UX5-1-FORMULAIRES) — `schemaCreation` garde son
 * `.default("p3")` (la réserve VGP et la reprise d'import en dépendent) :
 * c'est `priorite: null` — ce que `champ()` rend pour un champ ABSENT, sans
 * le repli `?? "p3"` que la route retire — qui doit refuser, jamais le
 * défaut du schéma qui ne remplace qu'un `undefined`.
 */
describe("motifDuRefusDeSaisie", () => {
  it("une priorité absente (`null`) désigne `priorite_manquante`, jamais le repli générique", () => {
    const saisie = schemaCreation.safeParse({
      id: UUID_VALIDE,
      client_id: UUID_VALIDE,
      site_id: UUID_VALIDE,
      type: "curatif",
      priorite: null,
      description: "Le compresseur ne démarre plus.",
    });
    expect(saisie.success).toBe(false);
    if (!saisie.success) {
      expect(motifDuRefusDeSaisie(saisie.error)).toBe(
        "intervention.refus.priorite_manquante",
      );
    }
  });

  it("une priorité valide ne fait PAS échouer le schéma sur `priorite`", () => {
    const saisie = schemaCreation.safeParse({
      id: UUID_VALIDE,
      client_id: UUID_VALIDE,
      site_id: UUID_VALIDE,
      type: "curatif",
      priorite: "p2",
      description: "Le compresseur ne démarre plus.",
    });
    expect(saisie.success).toBe(true);
  });

  it("une nature manquante reste prioritaire sur une priorité manquante", () => {
    const saisie = schemaCreation.safeParse({
      id: UUID_VALIDE,
      client_id: UUID_VALIDE,
      site_id: UUID_VALIDE,
      type: null,
      priorite: null,
      description: "Le compresseur ne démarre plus.",
    });
    expect(saisie.success).toBe(false);
    if (!saisie.success) {
      expect(motifDuRefusDeSaisie(saisie.error)).toBe(
        "intervention.refus.nature_manquante",
      );
    }
  });

  it("sans aucun champ en cause, retombe sur le repli « lieu inconnu »", () => {
    const saisie = schemaCreation.safeParse({
      id: UUID_VALIDE,
      client_id: "pas-un-uuid",
      site_id: UUID_VALIDE,
      type: "curatif",
      priorite: "p2",
      description: "Le compresseur ne démarre plus.",
    });
    expect(saisie.success).toBe(false);
    if (!saisie.success) {
      expect(motifDuRefusDeSaisie(saisie.error)).toBe(
        "intervention.refus.lieu_inconnu",
      );
    }
  });
});
