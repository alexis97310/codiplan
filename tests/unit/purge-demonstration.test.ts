import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  TABLES_DEMONSTRATION,
  VALEUR_CONFIRMATION,
  VARIABLE_CONFIRMATION,
  confirmationDonnee,
  instructionPurge,
  messagePurge,
} from "../../scripts/purge-demonstration.mjs";

// Vitest s'exécute depuis la racine du dépôt.
const workflow = readFileSync(
  join(process.cwd(), ".github/workflows/db-migrate.yml"),
  "utf8",
);

/** Position d'un fragment dans le workflow, en échouant s'il est absent. */
function position(fragment: string): number {
  const index = workflow.indexOf(fragment);
  expect(index, `fragment absent du workflow : ${fragment}`).toBeGreaterThan(
    -1,
  );
  return index;
}

/**
 * Purge des données de démonstration — impératif « jamais d'exécution par
 * défaut ». Deux barrières indépendantes doivent tenir : la condition du
 * workflow, et le refus du script sans confirmation explicite. Sans ce test,
 * un `default: true` ou un `if:` retiré effacerait la base au premier
 * déclenchement ordinaire, sans que rien ne le signale.
 */
describe("purge des données de démonstration", () => {
  describe("entrée du workflow", () => {
    it("déclare reinitialiser_demo en booléen, par défaut false", () => {
      // Bornée à la déclaration de l'entrée : le bloc s'arrête à `concurrency:`.
      const entree = workflow.slice(
        position("reinitialiser_demo:"),
        position("\nconcurrency:"),
      );

      expect(entree).toContain("type: boolean");
      expect(entree).toContain("default: false");
      expect(entree).not.toContain("default: true");
    });

    it("n'ajoute aucun déclencheur : workflow_dispatch reste le seul", () => {
      const declencheurs = workflow.slice(
        position("\non:"),
        position("\nconcurrency:"),
      );

      expect(declencheurs).toContain("workflow_dispatch:");
      for (const interdit of ["push:", "pull_request:", "schedule:"]) {
        expect(
          declencheurs,
          `déclencheur automatique interdit : ${interdit}`,
        ).not.toContain(interdit);
      }
    });

    it("conditionne l'étape de purge à l'entrée, et la place avant le seed", () => {
      const etapePurge = position(
        "- name: Purger les données de démonstration",
      );
      const etapeSeed = position("- name: Exécuter le seed");

      expect(
        workflow.slice(etapePurge, etapeSeed),
        "l'étape de purge doit être conditionnée par l'entrée",
      ).toContain("if: ${{ inputs.reinitialiser_demo }}");
      expect(etapePurge).toBeLessThan(etapeSeed);
      expect(etapePurge).toBeGreaterThan(
        position("- name: Appliquer la migration"),
      );
    });

    it("transmet la confirmation attendue par le script", () => {
      const etapePurge = workflow.slice(
        position("- name: Purger les données de démonstration"),
      );

      expect(etapePurge).toContain(
        `${VARIABLE_CONFIRMATION}: "${VALEUR_CONFIRMATION}"`,
      );
      expect(etapePurge).toContain("scripts/purge-demonstration.mts");
    });
  });

  describe("garde-fou du script", () => {
    it("refuse de purger sans confirmation explicite", () => {
      expect(confirmationDonnee({})).toBe(false);
      expect(confirmationDonnee({ [VARIABLE_CONFIRMATION]: "" })).toBe(false);
      expect(confirmationDonnee({ [VARIABLE_CONFIRMATION]: "true" })).toBe(
        false,
      );
      expect(confirmationDonnee({ [VARIABLE_CONFIRMATION]: "non" })).toBe(
        false,
      );
    });

    it("n'accepte que la valeur de confirmation exacte", () => {
      expect(
        confirmationDonnee({ [VARIABLE_CONFIRMATION]: VALEUR_CONFIRMATION }),
      ).toBe(true);
    });
  });

  describe("portée de la purge", () => {
    it("vide les tables de démonstration, les référençantes d'abord", () => {
      expect([...TABLES_DEMONSTRATION]).toEqual([
        "utilisateur_client",
        "utilisateur_societe",
        "agence",
        "societe",
        "utilisateur",
      ]);
    });

    it("épargne les référentiels de plateforme (liste close, I1)", () => {
      for (const referentiel of ["devise", "parite"]) {
        expect(
          TABLES_DEMONSTRATION as readonly string[],
          `référentiel de plateforme purgé à tort : ${referentiel}`,
        ).not.toContain(referentiel);
      }
    });

    it("n'efface jamais en cascade — une table oubliée doit faire échouer", () => {
      const instruction = instructionPurge();

      expect(instruction).not.toContain("CASCADE");
      for (const table of TABLES_DEMONSTRATION) {
        expect(instruction).toContain(`"${table}"`);
      }
      expect(instruction.startsWith("TRUNCATE TABLE ")).toBe(true);
    });
  });

  describe("journal", () => {
    it("annonce explicitement la purge et son périmètre", () => {
      const message = messagePurge();

      expect(message).toContain("PURGE DES DONNÉES DE DÉMONSTRATION");
      expect(message).toContain("reinitialiser_demo");
      for (const table of TABLES_DEMONSTRATION) {
        expect(message).toContain(table);
      }
    });
  });
});
