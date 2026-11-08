import { describe, expect, it } from "vitest";

import {
  confirmationDuDepot,
  machinePreselectionneeValide,
} from "@/app/(portail)/portail/demandes/presentation";
import type { MachineDuPortail } from "@/lib/portail/depot";

const MACHINE_A: MachineDuPortail = {
  id: "11111111-1111-1111-1111-111111111111",
  numeroSerie: "10044",
  referenceInterne: null,
  localisation: null,
  statut: "en_service",
  siteId: "22222222-2222-2222-2222-222222222222",
  dateMiseEnService: null,
  familleLibelle: "Pont 2 colonnes",
  marque: "Cascos",
  modeleReference: "13442",
};

/**
 * LE BANDEAU DE SUCCÈS NOMME LA DEMANDE DÈS QUE SON NUMÉRO EST CONNU
 * (9K03-PORTAIL-MACHINES-PANNE, point 4).
 */
describe("confirmationDuDepot", () => {
  it("nomme la demande par son numéro quand il est connu", () => {
    expect(confirmationDuDepot(29, 2026)).toBe(
      "Votre demande DEM-2026-0029 est enregistrée.",
    );
  });

  it("retombe sur le texte générique sans numéro", () => {
    expect(confirmationDuDepot(null, null)).toBe(
      "Votre demande est enregistrée.",
    );
  });
});

/**
 * LA MACHINE PRÉ-CHOISIE DEPUIS SA FICHE EST REVÉRIFIÉE CONTRE LE PARC DÉJÀ
 * LU SOUS LE CONTEXTE CLOISONNÉ (9K03, point 3) — jamais crue sur parole
 * depuis le seul paramètre d'URL. `machines` vient de `parcDuClient`, dont le
 * cloisonnement est éprouvé par `tests/isolation/portail-client.test.ts` :
 * une machine qui n'y figure pas est, PAR CONSTRUCTION, une machine hors du
 * périmètre du compte — ce que ce scénario vérifie côté logique pure.
 */
describe("machinePreselectionneeValide", () => {
  it("accepte une machine du parc lu", () => {
    expect(machinePreselectionneeValide(MACHINE_A.id, [MACHINE_A])).toBe(
      MACHINE_A.id,
    );
  });

  it("refuse une machine absente du parc lu (un autre client, par construction)", () => {
    expect(
      machinePreselectionneeValide("99999999-9999-9999-9999-999999999999", [
        MACHINE_A,
      ]),
    ).toBeUndefined();
  });

  it("refuse un paramètre absent", () => {
    expect(
      machinePreselectionneeValide(undefined, [MACHINE_A]),
    ).toBeUndefined();
  });

  it("refuse un paramètre répété (tableau), jamais le premier par défaut", () => {
    expect(
      machinePreselectionneeValide([MACHINE_A.id, MACHINE_A.id], [MACHINE_A]),
    ).toBeUndefined();
  });
});
