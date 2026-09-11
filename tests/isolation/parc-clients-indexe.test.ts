import { afterAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { controlerFeuille, MOTIF_AMBIGUITE } from "@/lib/excel/controle";
import { type FeuilleLue } from "@/lib/excel/classeur";
import { PREFIXE_RAISON_SOCIALE } from "@/lib/excel/rapprochement";
import { indexerLeParcClients } from "@/lib/imports/parc-clients";
import { MODELE_CLIENTS, marqueurDu } from "@/lib/imports/modeles";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  CLIENT_A1,
  CLIENT_A2,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_INTERNE_A,
} from "./setup/fixtures";

/**
 * L'AMBIGUÏTÉ EST UN FAIT DU PARC, ET ELLE DEVIENT UN REJET (L1-08g, RG-IMP-05).
 *
 * L1-08f avait écrit sa limite plutôt que de la taire : *le contrôle ne recevait
 * qu'un `Set<string>`, qui ne pouvait pas porter le troisième cas de
 * RG-IMP-05.* Ce fichier mesure qu'elle est levée, **à travers la base** et non
 * sur un ensemble fabriqué : c'est une collision de clés entre deux fiches
 * réelles qui produit le rejet.
 */

afterAll(fermerClients);

const SESSION = {
  utilisateurId: UTILISATEUR_INTERNE_A,
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

function feuille(lignes: readonly (readonly string[])[]): FeuilleLue {
  return {
    nom: "Clients",
    lignes: [
      [{ texte: marqueurDu(MODELE_CLIENTS) }],
      MODELE_CLIENTS.colonnes.map((colonne) => ({ texte: colonne.nom })),
      ...lignes.map((ligne) => ligne.map((valeur) => ({ texte: valeur }))),
    ],
  };
}

describe("le parc des clients, indexé par sa clé", () => {
  it("TÉMOIN — il lit des fiches RÉELLES, et celles de sa société seulement", async () => {
    // Zéro contre zéro n'est pas un résultat (§9, 10/09) : sans ce témoin, un
    // parc vide ferait passer tout ce qui suit.
    const parc = await indexerLeParcClients(SESSION, clientApp());
    expect(parc.fiches.size).toBeGreaterThan(0);
    expect(parc.fiches.get("C-001")).toBe(CLIENT_A1);
    expect(parc.fiches.get("C-002")).toBe(CLIENT_A2);
    // La société B porte elle aussi un « C-001 » : s'il apparaissait ici, ce
    // serait une fuite de cloisonnement ET une ambiguïté fabriquée.
    expect(parc.ambigues.size).toBe(0);
  });

  it("un code externe rapproche, et la ligne devient une MODIFICATION", async () => {
    const parc = await indexerLeParcClients(SESSION, clientApp());
    const controle = controlerFeuille(
      feuille([["C-001", "Peu importe le nom"]]),
      MODELE_CLIENTS,
      parc,
    );
    expect(controle.lisible).toBe(true);
    if (!controle.lisible) return;
    expect(controle.lignes[0]?.action).toBe("modification");
  });
});

describe("DEUX fiches de même clé rendent la ligne INDÉCIDABLE", () => {
  const HOMONYME = "aaaaaaaa-0000-7000-8000-00000000c0ff";

  /**
   * Pose un homonyme, mesure, et REND TOUT EN L'ÉTAT.
   *
   * *Pourquoi pas une transaction annulée, comme les jumeaux de ce répertoire :*
   * `indexerLeParcClients` ouvre SA transaction — c'est le chemin de
   * production, et c'est tout l'intérêt de l'éprouver. Une transaction
   * extérieure ne lui serait pas visible. Le nettoyage est donc explicite, dans
   * un `finally`, et **une assertion le constate** : *une remise en état qu'on
   * ne vérifie pas est une intention.*
   */
  async function avecUnHomonyme<T>(
    travail: (parc: Awaited<ReturnType<typeof indexerLeParcClients>>) => T,
  ): Promise<T> {
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "client" ("id", "societe_id", "code_externe", "raison_sociale")
         VALUES ('${HOMONYME}', '${SOCIETE_A}', NULL, 'Client A1')`,
    );
    // Et la fiche d'origine perd son code : les deux ne se rapprochent alors
    // plus que par le NOM, ce qui est exactement le cas de D29.
    await clientOwner().$executeRawUnsafe(
      `UPDATE "client" SET "code_externe" = NULL WHERE "id" = '${CLIENT_A1}'`,
    );
    try {
      return travail(await indexerLeParcClients(SESSION, clientApp()));
    } finally {
      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "client" WHERE "id" = '${HOMONYME}'`,
      );
      await clientOwner().$executeRawUnsafe(
        `UPDATE "client" SET "code_externe" = 'C-001' WHERE "id" = '${CLIENT_A1}'`,
      );
    }
  }

  it("la clé partagée est AMBIGUË, et elle ne désigne plus aucune fiche", async () => {
    const cle = `${PREFIXE_RAISON_SOCIALE}client a1`;
    const { ambigue, designe, connue } = await avecUnHomonyme((parc) => ({
      ambigue: parc.ambigues.has(cle),
      // *Laisser la première ferait que la ligne écrase celle-là plutôt que
      // l'autre, c'est-à-dire un choix au hasard rendu stable par l'ordre de
      // lecture.* Elle est donc RETIRÉE de l'index.
      designe: parc.fiches.has(cle),
      // …et elle reste CONNUE : c'est ce qui permet au contrôle de trancher
      // dans le bon ordre.
      connue: parc.cles.has(cle),
    }));
    expect(ambigue).toBe(true);
    expect(designe).toBe(false);
    expect(connue).toBe(true);
  });

  it("et la ligne qui la porte est REJETÉE avec son motif — RG-IMP-05", async () => {
    const { action, motif, rejets } = await avecUnHomonyme((parc) => {
      const controle = controlerFeuille(
        feuille([["", "Client A1"]]),
        MODELE_CLIENTS,
        parc,
      );
      if (!controle.lisible) throw new Error("feuille illisible");
      return {
        action: controle.lignes[0]?.action,
        motif: controle.lignes[0]?.rejetMotif,
        rejets: controle.proposition.rejets,
      };
    });
    expect(action).toBe("rejet");
    expect(motif).toBe(MOTIF_AMBIGUITE);
    // Le rejet S'ADDITIONNE — il n'est pas une qualification : le total doit
    // continuer d'expliquer chaque ligne lue.
    expect(rejets).toBe(1);
  });

  it("la remise en état a bien eu lieu — sans quoi les scénarios suivants mesureraient autre chose", async () => {
    const parc = await indexerLeParcClients(SESSION, clientApp());
    expect(parc.ambigues.size).toBe(0);
    expect(parc.fiches.get("C-001")).toBe(CLIENT_A1);
  });

  it("LE CAS QUI DOIT RESTER VERT POUR SA RAISON — une autre ligne passe quand même", async () => {
    // §9 (11/09). Sans lui, un contrôle qui rejetterait TOUT passerait le
    // scénario ci-dessus. Ici la seconde ligne, non ambiguë, reste une
    // création : ce n'est pas le fichier qui est refusé, c'est une ligne.
    const actions = await avecUnHomonyme((parc) => {
      const controle = controlerFeuille(
        feuille([
          ["", "Client A1"],
          ["", "Garage tout neuf"],
        ]),
        MODELE_CLIENTS,
        parc,
      );
      if (!controle.lisible) throw new Error("feuille illisible");
      return controle.lignes.map((l) => l.action);
    });
    expect(actions).toEqual(["rejet", "creation"]);
  });
});

describe("le cloisonnement tient sur le parc indexé", () => {
  it("la société B ne voit AUCUNE clé de la société A", async () => {
    const parcB = await indexerLeParcClients(
      { ...SESSION, societeId: SOCIETE_B },
      clientApp(),
    );
    expect(parcB.fiches.has("C-002")).toBe(false);
    // …et elle voit bien SON « C-001 », qui porte le même code : la preuve que
    // ce n'est pas une lecture vide.
    expect(parcB.fiches.get("C-001")).toBeTruthy();
    expect(parcB.fiches.get("C-001")).not.toBe(CLIENT_A1);
  });
});
