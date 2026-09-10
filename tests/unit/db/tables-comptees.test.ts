import { describe, expect, it } from "vitest";

import {
  TABLES_CLOISONNEES,
  TABLES_HORS_CLOISONNEMENT,
  decompteVide,
  ecartsAvecContexte,
  ecartsMesureVide,
  ecartsPopulation,
  type LigneInventaire,
} from "@/scripts/lib/inventaire";
import {
  EXEMPTIONS_DECOMPTE,
  ecartsCouverture,
  sqlDecompteAPlat,
  sqlDecompteParSociete,
  tablesComptees,
  tablesTemoins,
  type ExemptionDecompte,
} from "@/scripts/lib/tables-comptees";
import { lireSchema, observeesDuSchema } from "@/scripts/lib/schema-prisma";

/**
 * LA POPULATION DE L'INVENTAIRE EST PRODUITE PAR LE SCHÉMA (10/09/2026).
 *
 * ## Ce que ce gardien répare, avec ses dates
 *
 * Le contrôle de la base hébergée — le SEUL qui la regarde — a été aveugle du
 * **07/09/2026 01:28 UTC** (commit `97e8f95`, fusion de #32) au **09/09/2026
 * 22:48 UTC** (commit `52173a1`). Pendant ces deux jours et vingt et une
 * heures, quatorze tables comptaient zéro **des deux côtés** de sa comparaison,
 * dont `site`, `machine` et `intervention`.
 *
 * La réparation du 09/09 a écrit les compteurs manquants — c'est-à-dire qu'elle
 * a porté la liste de huit entrées à vingt et une. **Vingt et un est un nombre,
 * et un nombre tenu à la main dérive comme les huit précédents.** Ce gardien
 * ferme la classe : la population vient du schéma, et toute table qui n'y
 * trouve pas son rang fait rougir le jour de sa création.
 *
 * ## Les deux directions, comme le §9 les exige depuis le 11/09
 *
 * Un gardien est un prédicat à deux directions : *il rougit quand il doit*, et
 * *il ne reste vert que quand il le doit*. Chaque cas qui doit rougir est donc
 * accompagné d'un cas qui doit rester vert POUR SA PROPRE RAISON.
 */

const OBSERVEES = observeesDuSchema(lireSchema());

describe("population dérivée du schéma", () => {
  it("range chaque table du schéma, et le schéma n'est pas vide", () => {
    // TÉMOIN DE NON-VACUITÉ : zéro table lue ressemble trait pour trait à zéro
    // écart. Le seuil est délibérément bas — c'est la présence d'une
    // population qu'il constate, pas sa taille.
    expect(OBSERVEES.length).toBeGreaterThan(20);
    expect(ecartsCouverture(OBSERVEES)).toEqual([]);
  });

  it("compte les tables métier, et jamais un référentiel de plateforme", () => {
    // Le cas qui doit rester VERT pour sa propre raison, à côté des rouges
    // ci-dessous : `intervention` est comptée parce qu'elle porte un
    // `societe_id` obligatoire, `devise` ne l'est pas parce qu'elle est un
    // référentiel — et non parce que le gardien ne les regarde pas.
    expect(TABLES_CLOISONNEES).toContain("intervention");
    expect(TABLES_CLOISONNEES).toContain("site");
    expect(TABLES_CLOISONNEES).toContain("machine");
    expect(TABLES_CLOISONNEES).not.toContain("devise");
    expect(TABLES_CLOISONNEES).not.toContain("utilisateur");
    expect(TABLES_HORS_CLOISONNEMENT).toEqual([
      "devise",
      "jour_ferie",
      "parite",
    ]);
  });

  it("rougit sur une table métier que rien ne range", () => {
    // La faute telle qu'elle se commet : un ticket crée une table métier, la
    // migration la cloisonne, et personne ne pense à l'inventaire. Sous
    // l'ancienne liste tenue à la main, ce silence durait jusqu'à ce qu'un
    // humain relise deux chiffres du même journal.
    const avecNouvelle = [
      ...OBSERVEES,
      { table: "contrat", societeIdObligatoire: true },
    ];
    expect(tablesComptees(avecNouvelle)).toContain("contrat");
    expect(ecartsCouverture(avecNouvelle)).toEqual([]);

    // …et si elle était exclue de la population par une exemption sans motif,
    // le gardien le dirait.
    const muette: ExemptionDecompte[] = [
      ...EXEMPTIONS_DECOMPTE,
      { table: "contrat", motif: "sans_societe", justification: "  " },
    ];
    expect(ecartsCouverture(avecNouvelle, muette).join(" ")).toContain(
      "ne porte aucune justification",
    );
  });

  it("rougit sur une table hors catégorie que personne n'a rangée", () => {
    // Une table sans `societe_id` qui n'est ni référentiel, ni exemptée : elle
    // n'entre dans aucune mesure, et l'ancien dispositif l'aurait ignorée en
    // silence.
    const ecarts = ecartsCouverture([
      ...OBSERVEES,
      { table: "reglage_editeur", societeIdObligatoire: false },
    ]);
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("reglage_editeur");
    expect(ecarts[0]).toContain("ni exemptée");
  });

  it("rougit sur une exemption qui ne s'adosse plus à aucune table", () => {
    // §9 du 31/08 : une exemption qui ne s'applique à personne ne fait échouer
    // personne — elle survit à la disparition de sa table, et la prochaine
    // table de ce nom en hérite sans que personne ne la lui ait accordée.
    const orpheline: ExemptionDecompte[] = [
      ...EXEMPTIONS_DECOMPTE,
      {
        table: "table_disparue",
        motif: "sans_societe",
        justification: "elle n'existe plus.",
      },
    ];
    expect(ecartsCouverture(OBSERVEES, orpheline).join(" ")).toContain(
      "ne s'adosse à aucune table du schéma",
    );
  });

  it("rougit sur une population vide plutôt que de la trouver conforme", () => {
    expect(ecartsCouverture([]).join(" ")).toContain("aucune table lue");
  });
});

describe("le SQL du décompte est fabriqué depuis la population", () => {
  it("nomme chaque table comptée, et `societe` par son identité (D42)", () => {
    const sql = sqlDecompteParSociete(TABLES_CLOISONNEES, ["societe"]);
    for (const table of TABLES_CLOISONNEES) {
      expect(sql).toContain(`FROM "${table}"`);
    }
    expect(sql).toContain(`SELECT 'societe' AS "table", "id"::text`);
    expect(sql).toContain(`SELECT 'site' AS "table", "societe_id"::text`);
  });

  it("refuse de fabriquer une requête sans table", () => {
    // Une requête sans table rendrait zéro partout, ce qui ressemble trait
    // pour trait à un cloisonnement parfait. Elle se refuse, elle ne se
    // simplifie pas.
    expect(() => sqlDecompteParSociete([], ["societe"])).toThrow(
      /population dérivée du schéma est vide/,
    );
    expect(() => sqlDecompteAPlat([])).toThrow(/vide/);
  });

  it("refuse un nom de table qui n'est pas un identifiant", () => {
    expect(() => sqlDecompteAPlat(['x"; DROP TABLE "societe'])).toThrow(
      /Nom de table inattendu/,
    );
  });
});

describe("zéro contre zéro n'est pas un résultat", () => {
  const societe: LigneInventaire = {
    societe_id: "0192f0a0-0000-7000-8000-000000000001",
    code: "CODIMA-NC",
    decomptes: decompteVide(),
  };

  it("refuse une comparaison dont les deux côtés sont vides", () => {
    const ecarts = ecartsMesureVide(
      societe.decomptes,
      decompteVide(),
      "société CODIMA-NC",
    );
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("absence de mesure");
  });

  it("LE JUMEAU : sans lui, la comparaison se déclare satisfaite", () => {
    // C'est la mise en échec exigée par le protocole — et elle porte sur la
    // faute telle qu'elle a réellement eu lieu. `ecartsAvecContexte` compare
    // table par table ; les deux côtés à zéro, elle ne trouve RIEN à redire.
    // C'est exactement le vert qu'a rendu le contrôle de la base hébergée du
    // 07/09 au 09/09, sur `site`, `machine` et `intervention`.
    expect(ecartsAvecContexte(societe, decompteVide())).toEqual([]);
  });

  it("reste vert dès qu'un seul côté porte des lignes — pour sa raison", () => {
    // La direction permissive, celle qui ne produit aucun signal : le refus ne
    // doit pas se déclencher sur une base réelle. Une société se compte
    // toujours elle-même dans « societe », donc le cas ci-dessous est celui de
    // toute base saine — et le déficit est signalé par l'autre gardien, qui
    // est celui dont c'est le travail.
    const reelle: LigneInventaire = {
      ...societe,
      decomptes: { ...decompteVide(), societe: 1, site: 4 },
    };
    expect(ecartsMesureVide(reelle.decomptes, decompteVide(), "x")).toEqual([]);
    expect(ecartsAvecContexte(reelle, decompteVide())).not.toEqual([]);
  });
});

describe("la population du dépôt est complète", () => {
  it("ne laisse aucune table du schéma hors de tout rang", () => {
    expect(ecartsPopulation()).toEqual([]);
  });

  it("porte une justification écrite pour chaque exemption", () => {
    expect(EXEMPTIONS_DECOMPTE.length).toBeGreaterThan(0);
    for (const exemption of EXEMPTIONS_DECOMPTE) {
      expect(exemption.justification.length).toBeGreaterThan(40);
    }
  });

  it("dérive les témoins de la liste close de I1, sans la recopier", () => {
    expect(tablesTemoins()).toEqual([...TABLES_HORS_CLOISONNEMENT]);
  });
});
