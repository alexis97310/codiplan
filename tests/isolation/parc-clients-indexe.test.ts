import { afterAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { controlerFeuille, MOTIF_AMBIGUITE } from "@/lib/excel/controle";
import { type FeuilleLue } from "@/lib/excel/classeur";
import { PREFIXE_RAISON_SOCIALE } from "@/lib/excel/rapprochement";
import { indexerLesAgences } from "@/lib/imports/parc-agences";
import { indexerLeParcClients } from "@/lib/imports/parc-clients";
import {
  MODELE_CLIENTS,
  marqueurDu,
  modeleContacts,
  modeleSites,
  MOTIF_PARENT_INTROUVABLE,
  MOTIF_SAISIE_REFUSEE,
} from "@/lib/imports/modeles";

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

describe("LE GABARIT « CONTACTS » désigne un parent, et le rapport le dit (L1-09b)", () => {
  function feuilleContacts(
    modele: ReturnType<typeof modeleContacts>,
    lignes: readonly (readonly string[])[],
  ): FeuilleLue {
    return {
      nom: "Contacts",
      lignes: [
        [{ texte: marqueurDu(modele) }],
        modele.colonnes.map((colonne) => ({ texte: colonne.nom })),
        ...lignes.map((ligne) => ligne.map((valeur) => ({ texte: valeur }))),
      ],
    };
  }

  it("un client désigné par son CODE est résolu, et la ligne passe", async () => {
    const parc = await indexerLeParcClients(SESSION, clientApp());
    const modele = modeleContacts(parc);
    const controle = controlerFeuille(
      feuilleContacts(modele, [
        [
          "C-001",
          "Jean Dupont",
          "",
          "",
          "",
          "jean@garage.test",
          "donneur_ordre",
        ],
      ]),
      modele,
      { cles: new Set(), ambigues: new Set() },
    );
    expect(controle.lisible).toBe(true);
    if (!controle.lisible) return;
    expect(controle.lignes[0]?.action).toBe("creation");
    // La clé porte le CLIENT : deux contacts du même nom chez deux clients
    // différents sont deux personnes.
    expect(controle.lignes[0]?.cle?.cle).toContain(CLIENT_A1);
  });

  it("un client désigné par son NOM est résolu aussi — RG-IMP-05, seconde moitié", async () => {
    const parc = await indexerLeParcClients(SESSION, clientApp());
    const modele = modeleContacts(parc);
    const controle = controlerFeuille(
      feuilleContacts(modele, [
        [
          "  client   a1  ",
          "Marie Martin",
          "",
          "",
          "",
          "marie@garage.test",
          "comptabilite",
        ],
      ]),
      modele,
      { cles: new Set(), ambigues: new Set() },
    );
    expect(controle.lisible).toBe(true);
    if (!controle.lisible) return;
    expect(controle.lignes[0]?.action).toBe("creation");
    expect(controle.lignes[0]?.cle?.cle).toContain(CLIENT_A1);
  });

  it("un client INTROUVABLE est rejeté — et son motif n'est pas celui d'une saisie", async () => {
    // *Une saisie refusée se corrige dans le FICHIER, un client introuvable se
    // corrige dans le PARC* — rendre le même code ferait chercher au mauvais
    // endroit.
    const parc = await indexerLeParcClients(SESSION, clientApp());
    const modele = modeleContacts(parc);
    const controle = controlerFeuille(
      feuilleContacts(modele, [
        [
          "Garage qui n'existe pas",
          "Jean Dupont",
          "",
          "",
          "",
          "",
          "signataire",
        ],
      ]),
      modele,
      { cles: new Set(), ambigues: new Set() },
    );
    expect(controle.lisible).toBe(true);
    if (!controle.lisible) return;
    expect(controle.lignes[0]?.action).toBe("rejet");
    expect(controle.lignes[0]?.rejetMotif).toBe(MOTIF_PARENT_INTROUVABLE);
  });

  it("un client d'une AUTRE société est introuvable — le cloisonnement passe par le parc", async () => {
    // Le parc est indexé SOUS le contexte : le client B1 porte le même code
    // « C-001 » que A1, et il n'entre jamais dans cet index. *Aucune
    // comparaison de société n'est écrite dans le gabarit.*
    const parcB = await indexerLeParcClients(
      { ...SESSION, societeId: SOCIETE_B },
      clientApp(),
    );
    const modele = modeleContacts(parcB);
    const controle = controlerFeuille(
      feuilleContacts(modele, [
        [
          "client a1",
          "Jean Dupont",
          "",
          "",
          "",
          "jean@garage.test",
          "donneur_ordre",
        ],
      ]),
      modele,
      { cles: new Set(), ambigues: new Set() },
    );
    expect(controle.lisible).toBe(true);
    if (!controle.lisible) return;
    expect(controle.lignes[0]?.rejetMotif).toBe(MOTIF_PARENT_INTROUVABLE);
  });

  it("un RÔLE inconnu est refusé par la SAISIE, et le motif change", async () => {
    // Le cas qui doit rester distinct pour sa propre raison (§9, 11/09) : le
    // parent est résolu, c'est la saisie qui refuse. Deux motifs différents
    // pour deux corrections différentes.
    const parc = await indexerLeParcClients(SESSION, clientApp());
    const modele = modeleContacts(parc);
    const controle = controlerFeuille(
      feuilleContacts(modele, [
        ["C-001", "Jean Dupont", "", "", "", "jean@garage.test", "grand chef"],
      ]),
      modele,
      { cles: new Set(), ambigues: new Set() },
    );
    expect(controle.lisible).toBe(true);
    if (!controle.lisible) return;
    expect(controle.lignes[0]?.rejetMotif).toBe(MOTIF_SAISIE_REFUSEE);
  });
});

describe("LE GABARIT « SITES » — deux parents, deux règles (L1-09c, D101)", () => {
  async function modele() {
    return modeleSites(
      await indexerLeParcClients(SESSION, clientApp()),
      await indexerLesAgences(SESSION, clientApp()),
    );
  }

  function feuilleSites(
    m: ReturnType<typeof modeleSites>,
    lignes: readonly (readonly string[])[],
  ): FeuilleLue {
    return {
      nom: "Sites",
      lignes: [
        [{ texte: marqueurDu(m) }],
        m.colonnes.map((colonne) => ({ texte: colonne.nom })),
        ...lignes.map((ligne) => ligne.map((valeur) => ({ texte: valeur }))),
      ],
    };
  }

  it("les DEUX parents résolus, et la ligne passe", async () => {
    const m = await modele();
    const controle = controlerFeuille(
      feuilleSites(m, [["C-001", "DUCOS", "Atelier neuf"]]),
      m,
      { cles: new Set(), ambigues: new Set() },
    );
    expect(controle.lisible).toBe(true);
    if (!controle.lisible) return;
    expect(controle.lignes[0]?.action).toBe("creation");
    // La clé porte le CLIENT : deux ateliers du même nom chez deux clients
    // différents sont deux lieux.
    expect(controle.lignes[0]?.cle?.cle).toContain(CLIENT_A1);
  });

  it("le CODE d'agence tolère la CASSE — une cellule est écrite à la main", async () => {
    const m = await modele();
    const controle = controlerFeuille(
      feuilleSites(m, [["C-001", "ducos", "Atelier en minuscules"]]),
      m,
      { cles: new Set(), ambigues: new Set() },
    );
    expect(controle.lisible).toBe(true);
    if (!controle.lisible) return;
    expect(controle.lignes[0]?.action).toBe("creation");
  });

  it("et le LIBELLÉ d'une agence n'est PAS une clé — D101", async () => {
    // **CE SCÉNARIO A DÛ CHANGER DE SOCIÉTÉ, et la mesure vaut d'être écrite :**
    // chez la société A, l'agence a pour code « DUCOS » et pour libellé
    // « Ducos » — *ils coïncident à la casse près, et aucun scénario ne peut
    // y distinguer une règle de l'autre.* Chez B, le code est « SIEGE » et le
    // libellé « Siège » : l'accent les sépare, et la distinction devient
    // observable.
    //
    // *Écrire l'épreuve chez A l'aurait fait passer POUR UNE MAUVAISE RAISON —
    // elle aurait montré une tolérance de casse, pas un refus de libellé.*
    const m = modeleSites(
      await indexerLeParcClients(
        { ...SESSION, societeId: SOCIETE_B },
        clientApp(),
      ),
      await indexerLesAgences(
        { ...SESSION, societeId: SOCIETE_B },
        clientApp(),
      ),
    );
    const controle = controlerFeuille(
      feuilleSites(m, [
        // Le code : accepté.
        ["C-001", "SIEGE", "Atelier par code"],
        // Le libellé RÉEL de la même agence : refusé. *Un site rattaché à la
        // mauvaise agence fausse le temps de trajet (D56), le calendrier de
        // référence (I7) et la majoration.*
        ["C-001", "Siège", "Atelier par libellé"],
      ]),
      m,
      { cles: new Set(), ambigues: new Set() },
    );
    expect(controle.lisible).toBe(true);
    if (!controle.lisible) return;
    expect(controle.lignes[0]?.action).toBe("creation");
    expect(controle.lignes[1]?.rejetMotif).toBe(MOTIF_PARENT_INTROUVABLE);
  });

  it("une agence d'une AUTRE société est introuvable — le parc cloisonne", async () => {
    const m = modeleSites(
      await indexerLeParcClients(
        { ...SESSION, societeId: SOCIETE_B },
        clientApp(),
      ),
      await indexerLesAgences(
        { ...SESSION, societeId: SOCIETE_B },
        clientApp(),
      ),
    );
    const controle = controlerFeuille(
      feuilleSites(m, [["C-001", "DUCOS", "Atelier chez B"]]),
      m,
      { cles: new Set(), ambigues: new Set() },
    );
    expect(controle.lisible).toBe(true);
    if (!controle.lisible) return;
    // Le client « C-001 » existe chez B, mais pas l'agence « DUCOS ».
    expect(controle.lignes[0]?.rejetMotif).toBe(MOTIF_PARENT_INTROUVABLE);
  });

  it("une ZONE inconnue est refusée par la SAISIE — le motif change", async () => {
    // Le cas qui doit rester distinct pour sa raison : les deux parents sont
    // résolus, et c'est la saisie qui refuse.
    const m = await modele();
    const controle = controlerFeuille(
      feuilleSites(m, [
        ["C-001", "DUCOS", "Atelier zoné", "", "", "Nulle part"],
      ]),
      m,
      { cles: new Set(), ambigues: new Set() },
    );
    expect(controle.lisible).toBe(true);
    if (!controle.lisible) return;
    expect(controle.lignes[0]?.rejetMotif).toBe(MOTIF_SAISIE_REFUSEE);
  });
});
