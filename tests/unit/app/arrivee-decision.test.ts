import { describe, expect, it } from "vitest";

import {
  destinationSiSocieteUnique,
  pointEntreeRole,
  pretAChoisirUneDestination,
} from "@/app/(apres-session)/arrivee/decision";
import type { ContexteSession } from "@/lib/auth/contexte";
import { Role } from "@/lib/auth/roles";

const CONTEXTE: ContexteSession = {
  utilisateurId: "un-compte",
  societeId: "une-societe",
  role: Role.adv,
  secondFacteurValide: false,
  adresseIp: null,
  clientId: null,
};

/**
 * PAR OÙ UN RÔLE ENTRE, ET QUAND (99A-ARRIVEE).
 *
 * `pointEntreeRole` est la même fonction que le lien de `/arrivee` (`Entree`,
 * `page.tsx`) ET que sa redirection automatique : ce fichier l'éprouve sans
 * navigateur, comme `tests/unit/app/arrivee-choix-aide.test.tsx` le fait déjà
 * pour `Choix`.
 *
 * **Le cas « plusieurs sociétés »** n'a pas d'épreuve de bout en bout : aucun
 * compte de `tests/e2e/setup/scene.ts` n'est habilité sur deux sociétés, et en
 * forger un romprait le cloisonnement d'une scène partagée sous
 * `fullyParallel` (voir le piège du ticket). C'est ici, sur la fonction pure,
 * que ce cas se mesure.
 */
describe("pointEntreeRole — par où un rôle entre", () => {
  it("le portail pour un rôle client, quel que soit le périmètre", () => {
    expect(pointEntreeRole(Role.client, null)).toBe("/portail");
    expect(pointEntreeRole(Role.client, { acces: "complet" })).toBe("/portail");
  });

  it("le terrain pour un accès restreint, hors portail", () => {
    expect(
      pointEntreeRole(Role.technicien, {
        acces: "restreint",
        technicienId: "un-technicien",
      }),
    ).toBe("/terrain");
  });

  it("le planning pour un accès complet, ou en l'absence de périmètre", () => {
    expect(pointEntreeRole(Role.adv, { acces: "complet" })).toBe("/planning");
    expect(pointEntreeRole(Role.admin_societe, null)).toBe("/planning");
  });
});

describe("destinationSiSocieteUnique — la redirection d'une société unique", () => {
  it("rend la destination du rôle quand une seule société rattache le compte", () => {
    expect(destinationSiSocieteUnique(1, Role.adv, { acces: "complet" })).toBe(
      "/planning",
    );
    expect(
      destinationSiSocieteUnique(1, Role.technicien, {
        acces: "restreint",
        technicienId: "un-technicien",
      }),
    ).toBe("/terrain");
    expect(destinationSiSocieteUnique(1, Role.client, null)).toBe("/portail");
  });

  it("rend `null` sans société — la page garde son message, jamais de redirection", () => {
    expect(destinationSiSocieteUnique(0, Role.adv, { acces: "complet" })).toBe(
      null,
    );
  });

  it("rend `null` avec PLUSIEURS sociétés — le sélecteur reste affiché", () => {
    expect(destinationSiSocieteUnique(2, Role.adv, { acces: "complet" })).toBe(
      null,
    );
    expect(
      destinationSiSocieteUnique(3, Role.technicien, {
        acces: "restreint",
        technicienId: "un-technicien",
      }),
    ).toBe(null);
  });
});

describe("pretAChoisirUneDestination — assez pour router, pas pour lire (9J21)", () => {
  it("un compte PORTAIL juste basculé (clientId null, D70) est PRÊT malgré tout", () => {
    expect(
      pretAChoisirUneDestination({
        ...CONTEXTE,
        role: Role.client,
        clientId: null,
      }),
    ).toBe(true);
  });

  it("aucune société active : jamais prêt", () => {
    expect(
      pretAChoisirUneDestination({ ...CONTEXTE, societeId: null }),
    ).toBe(false);
  });

  it("aucun rôle sur la société active : jamais prêt", () => {
    expect(pretAChoisirUneDestination({ ...CONTEXTE, role: null })).toBe(
      false,
    );
  });

  it("un rôle qui exige le second facteur, absent : pas prêt", () => {
    expect(
      pretAChoisirUneDestination({
        ...CONTEXTE,
        role: Role.direction,
        secondFacteurValide: false,
      }),
    ).toBe(false);
  });

  it("un rôle qui exige le second facteur, validé : prêt", () => {
    expect(
      pretAChoisirUneDestination({
        ...CONTEXTE,
        role: Role.direction,
        secondFacteurValide: true,
      }),
    ).toBe(true);
  });
});
