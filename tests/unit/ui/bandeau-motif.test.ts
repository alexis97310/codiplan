import { describe, expect, it } from "vitest";

import { tonDuMotifDeFiche } from "@/components/ui/bandeau-motif";

/**
 * 9BR-TP-A4b-MESSAGES (CS17, PA-05) — LE TON D'UN BANDEAU DE FICHE.
 *
 * Liste EXPLICITE, jamais un jugement par sous-chaîne (à la différence de
 * `tonDuMotif` des imports) : une clé de succès qui ne contient pas « refus »
 * sort verte, une clé de refus — même sans le mot « refus » — sort rouge.
 */
describe("tonDuMotifDeFiche", () => {
  const CLES_REUSSITE = [
    "clients.cree",
    "clients.modifie",
    "contacts.cree",
    "contacts.modifie",
    "sites.cree",
    "sites.modifie",
    "agence.creee",
    "agence.modifiee",
    "equipe.info.rattache",
    "machine.creee",
    "machine.modifiee",
    // TR-24/TR-25 (9DI-TP-TER1-JOURNEE-FICHE, 04/10/2026).
    "terrain.rapport.enregistre",
    "terrain.prestations.enregistre",
    "terrain.signature.enregistre",
  ];

  it.each([
    "clients.cree",
    "clients.modifie",
    "contacts.cree",
    "contacts.modifie",
    "sites.cree",
    "sites.modifie",
    "agence.creee",
    "agence.modifiee",
    "equipe.info.rattache",
    "machine.creee",
    "machine.modifiee",
    "terrain.rapport.enregistre",
    "terrain.prestations.enregistre",
    "terrain.signature.enregistre",
  ])("« %s » est un succès (vert)", (cle) => {
    expect(tonDuMotifDeFiche(cle)).toBe("succes");
  });

  it.each([
    "client.refus.saisie",
    "auth.refus_droit",
    "auth.refus",
    "site.refus.saisie",
    "equipe.avertissement.desactivation_a_venir",
    "auth.indisponible",
  ])("« %s » n'est pas dans la liste des onze : refus (rouge)", (cle) => {
    expect(tonDuMotifDeFiche(cle)).toBe("refus");
  });

  it("la liste des clés de succès est fermée : aucune autre clé ne sort verte par accident", () => {
    expect(CLES_REUSSITE).toHaveLength(14);
  });
});
