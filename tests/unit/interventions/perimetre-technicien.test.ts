import { describe, expect, it } from "vitest";

import { niveau } from "@/lib/auth/habilitations";
import { Role, ROLES } from "@/lib/auth/roles";
import {
  filtreDuPerimetre,
  motifRefusPlanning,
  perimetreDuPlanning,
} from "@/lib/interventions/perimetre-technicien";

/**
 * R5-01 — LE PÉRIMÈTRE DU PLANNING, RÔLE PAR RÔLE.
 *
 * **La population est DÉRIVÉE de `ROLES`**, jamais énumérée ici : un onzième
 * rôle écrit demain entre dans ce scénario le jour où il est écrit. C'est la
 * parade de D41, appliquée à une matrice au lieu d'un schéma — *une liste
 * fermée un jour, une décision ultérieure qui crée un rôle, personne qui
 * revient le ranger.*
 */

const CONTEXTE = {
  utilisateurId: "aaaaaaaa-0000-7000-8000-000000000001",
  societeId: "aaaaaaaa-0000-7000-8000-000000000002",
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

function contexteDe(role: Role) {
  return {
    ...CONTEXTE,
    role,
    clientId:
      role === Role.client ? "aaaaaaaa-0000-7000-8000-000000000003" : null,
  };
}

describe("le périmètre du planning suit la matrice, et rien d'autre", () => {
  it.each(ROLES)("%s reçoit le degré que la matrice lui donne", (role) => {
    const perimetre = perimetreDuPlanning(contexteDe(role));
    expect(perimetre.acces).toBe(niveau(role, "consulter_planning"));
  });

  /**
   * LE TÉMOIN DE NON-VACUITÉ, et il porte sur les TROIS verdicts.
   *
   * *Un scénario qui parcourt dix rôles et n'en trouve qu'un seul degré ne
   * prouve rien* — il serait vert sur une matrice qui rendrait « aucun »
   * partout, c'est-à-dire sur un planning que personne ne lit.
   */
  it("les trois verdicts sont réellement représentés", () => {
    const degres = new Set(
      ROLES.map((role) => perimetreDuPlanning(contexteDe(role)).acces),
    );
    expect([...degres].sort()).toEqual(["aucun", "complet", "restreint"]);
  });

  it("le technicien est restreint à SA PROPRE identité", () => {
    const perimetre = perimetreDuPlanning(contexteDe(Role.technicien));
    expect(perimetre).toEqual({
      acces: "restreint",
      technicienId: CONTEXTE.utilisateurId,
    });
    expect(filtreDuPerimetre(perimetre)).toEqual({
      technicien_id: CONTEXTE.utilisateurId,
    });
  });

  /**
   * LE CAS QUI DOIT RESTER VERT POUR SA PROPRE RAISON (§9, 11/09).
   *
   * À côté de chaque cas qui doit rougir, un cas qui passe — et qui tomberait
   * si le filtre était posé par erreur sur un accès complet. *Un `undefined`
   * et un `{}` se composent pareil ; seul le premier dit qu'aucun filtre n'a
   * été posé.*
   */
  it("un accès complet ne pose AUCUN filtre, et un accès nul non plus", () => {
    expect(filtreDuPerimetre({ acces: "complet" })).toBeUndefined();
    expect(filtreDuPerimetre({ acces: "aucun" })).toBeUndefined();
  });

  it("l'accès nul REFUSE au lieu de rendre une liste vide", () => {
    expect(motifRefusPlanning({ acces: "aucun" })).toContain(
      "aucun accès au planning",
    );
    expect(motifRefusPlanning({ acces: "complet" })).toBeNull();
    expect(
      motifRefusPlanning({ acces: "restreint", technicienId: "x" }),
    ).toBeNull();
  });
});
