import { describe, expect, it } from "vitest";

import { niveau } from "@/lib/auth/habilitations";
import { Role, ROLES } from "@/lib/auth/roles";
import {
  accesSurCetteIntervention,
  dansLePerimetre,
  filtreDuPerimetre,
  motifRefusPlanning,
  perimetreDuPlanning,
  perimetreParPersonne,
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

/**
 * D131 (23/09/2026, DROITS-1) — `perimetreParPersonne` généralise
 * `perimetreDuPlanning` à n'importe quelle capacité, et `dansLePerimetre` /
 * `accesSurCetteIntervention` jugent une intervention PRÉCISE, pas une liste.
 */
describe("D131 — le périmètre d'UNE action, sur UNE intervention précise", () => {
  it("`perimetreDuPlanning` reste `perimetreParPersonne` appliquée à consulter_planning", () => {
    for (const role of ROLES) {
      expect(perimetreDuPlanning(contexteDe(role))).toEqual(
        perimetreParPersonne(contexteDe(role), "consulter_planning"),
      );
    }
  });

  it("un accès complet agit sur N'IMPORTE QUELLE intervention, affectée ou non", () => {
    expect(dansLePerimetre({ acces: "complet" }, null)).toBe(true);
    expect(dansLePerimetre({ acces: "complet" }, "un-autre-id")).toBe(true);
  });

  it("un accès nul n'agit sur AUCUNE intervention", () => {
    expect(dansLePerimetre({ acces: "aucun" }, CONTEXTE.utilisateurId)).toBe(
      false,
    );
  });

  it("un accès restreint n'agit que sur SA PROPRE intervention affectée", () => {
    const perimetre = {
      acces: "restreint" as const,
      technicienId: CONTEXTE.utilisateurId,
    };
    expect(dansLePerimetre(perimetre, CONTEXTE.utilisateurId)).toBe(true);
    expect(dansLePerimetre(perimetre, "un-collegue")).toBe(false);
    // Une intervention NON AFFECTÉE n'est le périmètre de personne — pas
    // même de son restreint : `null !== technicienId` est toujours vrai.
    expect(dansLePerimetre(perimetre, null)).toBe(false);
  });

  it("`accesSurCetteIntervention` — le technicien clôture SA sienne, pas celle d'un collègue", () => {
    const contexte = contexteDe(Role.technicien);
    expect(
      accesSurCetteIntervention(
        contexte,
        "cloturer_intervention",
        contexte.utilisateurId,
      ),
    ).toBe(true);
    expect(
      accesSurCetteIntervention(
        contexte,
        "cloturer_intervention",
        "un-collegue",
      ),
    ).toBe(false);
  });

  it("`accesSurCetteIntervention` — le bureau agit sur toutes, le client sur aucune", () => {
    const bureau = contexteDe(Role.adv);
    expect(
      accesSurCetteIntervention(bureau, "cloturer_intervention", null),
    ).toBe(true);
    expect(
      accesSurCetteIntervention(bureau, "cloturer_intervention", "n-importe-qui"),
    ).toBe(true);

    const client = contexteDe(Role.client);
    expect(
      accesSurCetteIntervention(
        client,
        "cloturer_intervention",
        client.utilisateurId,
      ),
    ).toBe(false);
  });
});
