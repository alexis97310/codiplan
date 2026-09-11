import { describe, expect, it } from "vitest";

import { schemaCreationClient } from "@/lib/clients/saisie";
import { controlerFeuille, MOTIF_AMBIGUITE } from "@/lib/excel/controle";
import { type FeuilleLue } from "@/lib/excel/classeur";
import {
  CHAMPS_CLIENTS,
  CHAMPS_CLIENTS_ECARTES,
  COLONNES_CLIENTS,
  MODELE_CLIENTS,
  marqueurDu,
  MOTIF_SAISIE_REFUSEE,
  saisieDepuisLaLigne,
} from "@/lib/imports/modeles";

/**
 * Un parc connu, à partir de ses seules clés — `ambigues` vide est une
 * AFFIRMATION et non un oubli : *« ce parc ne porte aucune ambiguïté »*
 * (L1-08g). Les scénarios qui éprouvent l'ambiguïté la passent explicitement.
 */
function parc(cles: readonly string[] = [], ambigues: readonly string[] = []) {
  return { cles: new Set(cles), ambigues: new Set(ambigues) };
}

/**
 * LE GABARIT EST CONFRONTÉ AU SCHÉMA DE SAISIE (L1-09a).
 *
 * **La population ne vient pas du gabarit, elle vient du SCHÉMA** — la parade
 * du §9 (31/08) : sélectionner « les colonnes du modèle » exclurait exactement
 * le champ qu'on a oublié d'exposer. L'analyse part donc de `schemaCreationClient`
 * et exige que chacun de ses champs soit **exposé** ou **écarté nommément**.
 *
 * Les deux sens sont gardés, et le second est celui qu'on oublie : une colonne
 * qui n'alimente aucun champ ferait remplir une case pour rien.
 */

/** Les champs du schéma, et lesquels refusent l'absence. */
const CHAMPS_DU_SCHEMA = Object.entries(schemaCreationClient.shape).map(
  ([nom, champ]) => ({
    nom,
    obligatoire: !(
      champ as { safeParse: (v: unknown) => { success: boolean } }
    ).safeParse(undefined).success,
  }),
);

describe("le gabarit « clients » dit exactement ce que la saisie attend", () => {
  it("a réellement lu un schéma — le témoin de non-vacuité", () => {
    // Deux listes vides s'accordent parfaitement (§9, 10/09).
    expect(CHAMPS_DU_SCHEMA.length).toBeGreaterThanOrEqual(6);
    expect(MODELE_CLIENTS.colonnes.length).toBeGreaterThan(0);
    expect(CHAMPS_DU_SCHEMA.some((c) => c.obligatoire)).toBe(true);
  });

  it("chaque champ du schéma est EXPOSÉ ou ÉCARTÉ nommément", () => {
    const exposes = new Set(Object.values(CHAMPS_CLIENTS));
    const orphelins = CHAMPS_DU_SCHEMA.filter(
      (champ) =>
        !exposes.has(champ.nom) &&
        !Object.hasOwn(CHAMPS_CLIENTS_ECARTES, champ.nom),
    ).map((champ) => champ.nom);
    expect(
      orphelins,
      "champs du schéma que le gabarit ignore en silence",
    ).toEqual([]);
  });

  it("chaque champ écarté porte son MOTIF, et existe au schéma", () => {
    // Une exemption qui ne s'adosse à rien n'exempte plus personne, et ne
    // rougit jamais (§9, 31/08).
    const auSchema = new Set(CHAMPS_DU_SCHEMA.map((c) => c.nom));
    for (const [champ, motif] of Object.entries(CHAMPS_CLIENTS_ECARTES)) {
      expect(motif, champ).toBeTruthy();
      expect(auSchema.has(champ), `${champ} n'existe pas au schéma`).toBe(true);
    }
  });

  it("aucune colonne ORPHELINE — le sens qu'on oublie", () => {
    const auSchema = new Set(CHAMPS_DU_SCHEMA.map((c) => c.nom));
    for (const colonne of MODELE_CLIENTS.colonnes) {
      const champ = CHAMPS_CLIENTS[colonne.nom];
      expect(
        champ,
        `la colonne « ${colonne.nom} » n'alimente aucun champ`,
      ).toBeTruthy();
      expect(auSchema.has(champ!), `${champ} n'existe pas au schéma`).toBe(
        true,
      );
    }
  });

  it("tout champ OBLIGATOIRE a une colonne obligatoire", () => {
    // Sans quoi le gabarit produirait des fiches que la saisie refuse, et
    // l'import échouerait sur un fichier correctement rempli.
    const parChamp = new Map(
      MODELE_CLIENTS.colonnes.map((colonne) => [
        CHAMPS_CLIENTS[colonne.nom],
        colonne,
      ]),
    );
    for (const champ of CHAMPS_DU_SCHEMA.filter((c) => c.obligatoire)) {
      const colonne = parChamp.get(champ.nom);
      expect(colonne, `${champ.nom} n'a aucune colonne`).toBeTruthy();
      expect(colonne?.obligatoire, `${champ.nom} : colonne facultative`).toBe(
        true,
      );
    }
  });

  it("et la réciproque : une colonne obligatoire alimente un champ obligatoire", () => {
    // Le cas qui doit rester vert POUR SA PROPRE RAISON (§9, 11/09) : si tout
    // était marqué obligatoire, la vérification ci-dessus passerait aussi.
    const obligatoires = new Set(
      CHAMPS_DU_SCHEMA.filter((c) => c.obligatoire).map((c) => c.nom),
    );
    for (const colonne of MODELE_CLIENTS.colonnes.filter(
      (c) => c.obligatoire,
    )) {
      expect(
        obligatoires.has(CHAMPS_CLIENTS[colonne.nom]!),
        `« ${colonne.nom} » est exigée alors que la saisie s'en passe`,
      ).toBe(true);
    }
    // Et le témoin : il n'y en a qu'UNE. Un gabarit dont tout serait
    // obligatoire refuserait des fichiers que la saisie accepte.
    expect(MODELE_CLIENTS.colonnes.filter((c) => c.obligatoire)).toHaveLength(
      1,
    );
  });
});

describe("le gabarit se lit par la chaîne réelle", () => {
  it("son marqueur est DÉRIVÉ, et le contrôle l'accepte", () => {
    // Le marqueur n'est pas recopié : une recopie devient fausse le jour où la
    // version change, et elle ne rougit pas.
    expect(marqueurDu(MODELE_CLIENTS)).toBe("CODIPLAN-clients-v1");

    const feuille: FeuilleLue = {
      nom: "Clients",
      lignes: [
        [{ texte: marqueurDu(MODELE_CLIENTS) }],
        MODELE_CLIENTS.colonnes.map((colonne) => ({ texte: colonne.nom })),
        [{ texte: "C001" }, { texte: "Garage Dupont" }],
      ],
    };

    const controle = controlerFeuille(feuille, MODELE_CLIENTS, parc());
    expect(controle.lisible).toBe(true);
    if (!controle.lisible) return;
    expect(controle.anomalies).toEqual([]);
    expect(controle.inconnues).toEqual([]);
    expect(controle.lignes.map((l) => l.cle?.cle)).toEqual(["C001"]);
    expect(controle.proposition.creations).toBe(1);
  });

  it("une feuille SANS la colonne obligatoire est refusée AVANT toute ligne", () => {
    // Les trois refus de D31 précèdent le comptage : un rapport qui proposerait
    // des créations sous une colonne obligatoire absente proposerait d'écrire
    // des fiches amputées.
    const feuille: FeuilleLue = {
      nom: "Clients",
      lignes: [
        [{ texte: marqueurDu(MODELE_CLIENTS) }],
        [{ texte: COLONNES_CLIENTS.codeExterne }],
        [{ texte: "C001" }],
      ],
    };
    const controle = controlerFeuille(feuille, MODELE_CLIENTS, parc());
    expect(controle.lisible).toBe(false);
  });
});

describe("le rapport montre ce que la saisie REFUSERA (L1-08h)", () => {
  function feuilleDe(lignes: readonly (readonly string[])[]): FeuilleLue {
    return {
      nom: "Clients",
      lignes: [
        [{ texte: marqueurDu(MODELE_CLIENTS) }],
        MODELE_CLIENTS.colonnes.map((colonne) => ({ texte: colonne.nom })),
        ...lignes.map((ligne) => ligne.map((valeur) => ({ texte: valeur }))),
      ],
    };
  }

  it("une raison sociale VIDE est rejetée par le RAPPORT, pas par l'application", () => {
    // I6 : un import produit d'abord un rapport, PUIS attend une validation
    // explicite. *Une ligne que la saisie refusera et que le rapport annonce en
    // création est un rapport qui ment* — on valide 300 créations, on en obtient
    // 297, et les trois manquantes ne se découvrent qu'après coup.
    const controle = controlerFeuille(
      feuilleDe([["C-777", "   "]]),
      MODELE_CLIENTS,
      parc(),
    );
    expect(controle.lisible).toBe(true);
    if (!controle.lisible) return;

    expect(controle.lignes[0]?.action).toBe("rejet");
    expect(controle.lignes[0]?.rejetMotif).toBe(MOTIF_SAISIE_REFUSEE);
    expect(controle.proposition.rejets).toBe(1);
    expect(controle.proposition.creations).toBe(0);
  });

  it("LE CAS QUI DOIT RESTER VERT POUR SA RAISON — une ligne saine passe", () => {
    // §9 (11/09). Sans lui, une validation qui refuserait TOUT passerait le
    // scénario ci-dessus, et le gabarit serait inutilisable sans que rien ne
    // le dise.
    const controle = controlerFeuille(
      feuilleDe([["C-778", "Garage Tout Neuf"]]),
      MODELE_CLIENTS,
      parc(),
    );
    expect(controle.lisible).toBe(true);
    if (!controle.lisible) return;
    expect(controle.lignes[0]?.action).toBe("creation");
    expect(controle.lignes[0]?.rejetMotif).toBeUndefined();
  });

  it("l'AMBIGUÏTÉ passe avant la saisie, et l'ordre se lit", () => {
    // Une ligne indécidable ne vaut pas la peine d'être validée : rendre le
    // motif de saisie ferait chercher une correction dans le FICHIER là où le
    // problème est dans le PARC.
    const controle = controlerFeuille(
      feuilleDe([["C-999", "   "]]),
      MODELE_CLIENTS,
      parc(["C-999"], ["C-999"]),
    );
    expect(controle.lisible).toBe(true);
    if (!controle.lisible) return;
    expect(controle.lignes[0]?.rejetMotif).toBe(MOTIF_AMBIGUITE);
  });

  it("une ligne traduite ne porte AUCUNE chaîne vide", () => {
    // Les cellules vides n'apparaissent pas : c'est le schéma qui pose ses
    // défauts. Une chaîne vide dans `raison_sociale` la ferait refuser pour
    // une autre raison que la bonne, et l'auteur chercherait longtemps.
    const saisie = saisieDepuisLaLigne(
      {
        [COLONNES_CLIENTS.codeExterne]: "  ",
        [COLONNES_CLIENTS.raisonSociale]: "  Garage  ",
        [COLONNES_CLIENTS.ridet]: undefined,
      },
      CHAMPS_CLIENTS,
    );
    expect(saisie).toEqual({ raison_sociale: "Garage" });
  });
});
