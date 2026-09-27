import { describe, expect, it } from "vitest";

import { champEnCause } from "../../../app/(back-office)/interventions/presentation";

/**
 * GR17-M14 (audit GR du 26/09/2026, constat M14) — LE CHAMP EN CAUSE D'UN
 * REFUS DE SAISIE, SUR `/interventions/nouvelle`.
 *
 * Seuls deux motifs désignent un champ avec CERTITUDE — voir
 * `app/api/interventions/creer/route.ts` : `lieu_inconnu` est un REPLI qui
 * couvre tout le reste, jamais le champ Site à coup sûr.
 */
describe("champEnCause", () => {
  it("désigne « type » pour la nature manquante", () => {
    expect(champEnCause("intervention.refus.nature_manquante")).toBe("type");
  });

  it("désigne « description » pour la panne manquante", () => {
    expect(champEnCause("intervention.refus.panne_manquante")).toBe(
      "description",
    );
  });

  it("ne désigne aucun champ pour le repli « lieu inconnu »", () => {
    expect(champEnCause("intervention.refus.lieu_inconnu")).toBeNull();
  });

  it("ne désigne aucun champ pour un motif inconnu", () => {
    expect(champEnCause("intervention.refus.erreur_serveur")).toBeNull();
  });
});
