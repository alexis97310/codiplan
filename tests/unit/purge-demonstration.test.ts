import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  EXCEPTIONS_PURGE,
  VALEUR_CONFIRMATION,
  VARIABLE_CONFIRMATION,
  confirmationDonnee,
  ecartsExceptions,
  instructionPurge,
  messagePurge,
  tablesAPurger,
  tablesEpargnees,
} from "../../scripts/purge-demonstration.mjs";
import { lireSchema, modelesDuSchema } from "./outils/schema-prisma";

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

      const conditionPurge = workflow.slice(etapePurge, etapeSeed);
      expect(
        conditionPurge,
        "l'étape de purge doit être conditionnée par l'entrée",
      ).toContain("inputs.reinitialiser_demo");
      // Depuis le 09/09/2026, une SECONDE condition : la purge ne vise jamais
      // la base de production. L'assertion s'est resserrée, pas relâchée — elle
      // portait sur la graphie exacte d'une condition simple, et une graphie
      // exacte refuse aussi ce qui est plus fort qu'elle.
      expect(
        conditionPurge,
        "la purge ne doit jamais viser la base de production",
      ).toContain("inputs.cible != 'production'");
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

  describe("portée de la purge — fermée par le SCHÉMA", () => {
    /**
     * **Ce que ce gardien répare, et ce n'est pas une table.** La liste des
     * tables purgées était fermée à la main et n'avait pas suivi les trois
     * tables du calendrier depuis L0-08. Mesuré en base :
     *
     *     ERROR:  cannot truncate a table referenced in a foreign key constraint
     *     DETAIL:  Table "calendrier_ferie" references "agence".
     *
     * L'échec était bruyant — donc l'option était inopérante plutôt que
     * dangereuse — mais c'est la même maladie que I1, que le périmètre d'audit
     * et que les citations du backlog. La corriger d'une ligne l'aurait
     * recassée au module suivant.
     *
     * **Le renversement de D41, appliqué à la purge :** le contrôle part du
     * SCHÉMA et exige que chaque table y soit purgée OU exemptée. Zéro échoue
     * — c'est l'oubli ; deux échouent aussi — une table exemptée qui serait
     * quand même purgée n'existerait pas, la différence d'ensembles l'interdit,
     * mais une exception qui ne s'adosse à rien est refusée séparément.
     */
    const tablesDuSchema = modelesDuSchema(lireSchema())
      .map((modele) => modele.table)
      // La table de Prisma n'est pas dans le schéma Prisma : elle existe en
      // base et le script l'y verra. On l'ajoute donc à la population, sans
      // quoi son exception paraîtrait ne s'adosser à rien.
      .concat("_prisma_migrations");

    it("le gardien a réellement lu un schéma", () => {
      // Témoin : une population vide rendrait « aucune table oubliée » vrai
      // sans avoir rien regardé (§9, 30/08).
      expect(tablesDuSchema.length).toBeGreaterThanOrEqual(15);
      expect(tablesDuSchema).toContain("societe");
      expect(EXCEPTIONS_PURGE.length).toBeGreaterThanOrEqual(4);
    });

    it("toute table du schéma est PURGÉE ou EXEMPTÉE, jamais ni l'un ni l'autre", () => {
      const purgees = tablesAPurger(tablesDuSchema);
      const epargnees = tablesEpargnees();

      for (const table of tablesDuSchema) {
        const dansUne =
          (purgees.includes(table) ? 1 : 0) +
          (epargnees.includes(table) ? 1 : 0);
        expect(
          dansUne,
          `« ${table} » n'est ni purgée ni exemptée : la liste de la purge a ` +
            "cessé de suivre le schéma, et c'est ainsi qu'elle s'est cassée à " +
            "L0-08.",
        ).toBe(1);
      }
    });

    it("les trois tables du calendrier — l'oubli de L0-08 — sont purgées", () => {
      // Le cas nommé. Il ne s'agit pas de vérifier trois lignes ajoutées à la
      // main : elles sont purgées parce qu'elles sont au schéma et hors
      // exceptions, et ce test le constate là où le défaut s'était produit.
      const purgees = tablesAPurger(tablesDuSchema);
      for (const table of [
        "calendrier",
        "calendrier_plage",
        "calendrier_ferie",
      ]) {
        expect(purgees, table).toContain(table);
      }
    });

    it("ÉPREUVE : une table métier NOUVELLE est purgée sans qu'on ait rien ajouté", () => {
      // La propriété qui remplace l'ancienne liste, éprouvée sur une table
      // fabriquée : aucune liste n'a été touchée pour qu'elle soit prise.
      const purgees = tablesAPurger([...tablesDuSchema, "intervention"]);
      expect(purgees).toContain("intervention");
    });

    it("épargne les référentiels de plateforme et le journal (liste close, I1)", () => {
      const purgees = tablesAPurger(tablesDuSchema);
      for (const epargnee of [
        "devise",
        "parite",
        "jour_ferie",
        "journal_audit",
        "_prisma_migrations",
      ]) {
        expect(purgees, epargnee).not.toContain(epargnee);
      }
    });

    it("chaque exception porte un motif et une justification écrite", () => {
      expect(ecartsExceptions(tablesDuSchema)).toEqual([]);
      for (const exception of EXCEPTIONS_PURGE) {
        expect(exception.justification.length, exception.table).toBeGreaterThan(
          60,
        );
        expect(["referentiel", "survit"], exception.table).toContain(
          exception.motif,
        );
      }
    });

    it("ÉPREUVE : une exception qui ne s'adosse à rien est refusée", () => {
      // Corollaire du 31/08 : une exception survit au renommage de sa table,
      // ne protège plus rien, et la prochaine table qui reprendra ce nom en
      // héritera sans que personne ne le lui ait accordé.
      const ecarts = ecartsExceptions(tablesDuSchema, [
        {
          table: "table_disparue",
          motif: "referentiel",
          justification:
            "une justification suffisamment longue pour passer le contrôle de longueur",
        },
      ]);

      expect(ecarts).toHaveLength(1);
      expect(ecarts[0]).toContain("table_disparue");
      expect(ecarts[0]).toContain("ne s'applique à personne");
    });

    it("n'efface jamais en cascade — une table oubliée doit faire échouer", () => {
      const tables = tablesAPurger(tablesDuSchema);
      const instruction = instructionPurge(tables);

      expect(instruction).not.toContain("CASCADE");
      for (const table of tables) {
        expect(instruction).toContain(`"${table}"`);
      }
      expect(instruction.startsWith("TRUNCATE TABLE ")).toBe(true);
    });

    it("ÉPREUVE : une purge SANS cible lève plutôt que de passer", () => {
      // Un `TRUNCATE` sans table ne prouverait rien, et une base vide
      // ressemblerait à une purge réussie.
      expect(() => instructionPurge([])).toThrow(/Aucune table à purger/);
    });
  });

  describe("journal", () => {
    it("annonce explicitement la purge et son périmètre", () => {
      const tables = tablesAPurger(
        modelesDuSchema(lireSchema()).map((modele) => modele.table),
      );
      const message = messagePurge(tables);

      expect(message).toContain("PURGE DES DONNÉES DE DÉMONSTRATION");
      expect(message).toContain("reinitialiser_demo");
      // Ce qui est vidé ET ce qui est épargné : un journal qui ne dirait que
      // le premier laisserait croire que rien n'a survécu.
      for (const table of tables) {
        expect(message).toContain(table);
      }
      for (const epargnee of tablesEpargnees()) {
        expect(message).toContain(epargnee);
      }
    });
  });
});
