import { afterAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { type FeuilleLue } from "@/lib/excel/classeur";
import { controlerFeuille, type ModeleDImport } from "@/lib/excel/controle";
import { enregistrerLeControle } from "@/lib/imports/depot";

import { avecPortail, clientApp, sousSociete, fermerClients } from "./setup/db";
import {
  CLIENT_A1,
  SITE_A1_S1,
  SOCIETE_A,
  UTILISATEUR_INTERNE_A,
} from "./setup/fixtures";

/**
 * L'APPELANT DE LA CHAÎNE D'IMPORT (L1-08e).
 *
 * ## Pourquoi ce fichier existe, et ce qu'il ne remplace pas
 *
 * *Une suite qui éprouve tous les maillons n'éprouve pas la chaîne* (§9,
 * 08/09). `lib/excel/controle.ts` a ses 106 scénarios et ne touche aucune
 * base ; `tests/isolation/lot-dimport.test.ts` a les siens et ne passe par
 * aucun code de production. **Entre les deux, personne ne traversait** — et
 * c'est exactement le maillon où L1-02c avait cassé toutes les pages
 * authentifiées sans qu'un seul gardien rougisse.
 *
 * Ce scénario traverse : une feuille → le contrôle → l'enregistrement par le
 * chemin de PRODUCTION (`avecContexteApplicatif`, donc sous les politiques) →
 * la relecture sous contexte cloisonné.
 *
 * **Il donne aussi son appelant à `lib/imports/depot.ts`**, qui n'en aura pas
 * d'autre avant l'écran d'import (L1-09). *Une interface sans appelant est la
 * maladie que ce dépôt soigne ; un appelant d'épreuve n'est pas un écran, mais
 * il traverse la même chaîne et il rougit le jour où elle casse.*
 */

afterAll(fermerClients);

const MODELE: ModeleDImport = {
  type: "machines",
  version: 1,
  colonnes: [
    { nom: "Numéro de série", obligatoire: true },
    { nom: "Marque", obligatoire: false },
  ],
  identifiantes: ["Numéro de série"],
  colonneSerie: "Numéro de série",
};

/** Une feuille à trois lignes : une création, un gabarit, une ligne vide. */
const FEUILLE: FeuilleLue = {
  nom: "Parc",
  lignes: [
    [{ texte: "CODIPLAN-machines-v1" }],
    [{ texte: "Numéro de série" }, { texte: "Marque" }],
    [{ texte: "SN-IMPORT-1" }, { texte: "Bosch" }],
    [undefined, { texte: "à compléter" }],
    [undefined, undefined],
  ],
};

/** La session d'un utilisateur INTERNE — aucun client désigné. */
const SESSION_INTERNE = {
  utilisateurId: UTILISATEUR_INTERNE_A,
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

describe("la chaîne feuille → contrôle → lot en base", () => {
  it("traverse, et ce que la base porte est EXACTEMENT ce que le rapport a décidé", async () => {
    const controle = controlerFeuille(FEUILLE, MODELE, new Set());
    expect(controle.lisible).toBe(true);
    if (!controle.lisible) return;

    // Le TÉMOIN du rapport : il a bien retenu des lignes, et il les explique
    // toutes. Sans lui, un rapport vide ferait passer tout ce qui suit.
    expect(controle.lignes.length).toBe(3);
    expect(controle.totalExplique).toBe(true);

    const { lotId, decomptes } = await enregistrerLeControle(
      SESSION_INTERNE,
      { nom: "parc-epreuve.xlsx", type: MODELE.type, version: MODELE.version },
      controle.lignes,
      clientApp(),
    );

    // Les décomptes viennent de `proposerDepuisLesLignes` et de lui seul : ce
    // module n'en tient aucun second. C'est ce qui rend cette assertion utile
    // — elle compare la BASE au rapport, jamais deux comptages l'un à l'autre.
    expect(decomptes.creations).toBe(1);
    expect(decomptes.gabarits).toBe(1);
    expect(decomptes.vides).toBe(1);

    const lu = await sousSociete(SOCIETE_A, (tx) =>
      tx.importLot.findUnique({
        where: { id: lotId },
        select: {
          statut: true,
          nom_fichier: true,
          lignes_creations: true,
          lignes_gabarits: true,
          lignes_vides: true,
          lignes: {
            select: { rang: true, action: true, cle: true, complete: true },
            orderBy: { rang: "asc" },
          },
        },
      }),
    );

    // LE LOT NAÎT « CONTRÔLÉ » : le rapport existe, rien n'a été écrit dans le
    // parc. C'est la moitié « d'abord » de I6, et elle est en base.
    expect(lu?.statut).toBe("controle");
    expect(lu?.nom_fichier).toBe("parc-epreuve.xlsx");
    expect(lu?.lignes_creations).toBe(1);
    expect(lu?.lignes_gabarits).toBe(1);
    expect(lu?.lignes_vides).toBe(1);

    expect(lu?.lignes).toEqual([
      { rang: 3, action: "creation", cle: "SN-IMPORT-1", complete: true },
      // *Un gabarit et une ligne vide ne portent AUCUNE clé* — la propriété de
      // L1-08c, traversée jusqu'à la base, où une contrainte la tient aussi.
      { rang: 4, action: "gabarit", cle: null, complete: null },
      { rang: 5, action: "vide", cle: null, complete: null },
    ]);
  });

  it("et ce que la chaîne a écrit reste fermé au portail", async () => {
    // La moitié qui compte pour D100 : le lot écrit par le chemin de
    // production n'est pas plus lisible qu'une fixture. *Mesuré à travers le
    // code réel, et pas seulement sur une ligne posée en SQL.*
    const vus = await avecPortail(
      {
        societeId: SOCIETE_A,
        clientId: CLIENT_A1,
        perimetreSites: [SITE_A1_S1],
      },
      (tx) => tx.importLotLigne.findMany({ select: { cle: true } }),
    );
    expect(vus).toEqual([]);

    // LE CAS QUI DOIT RESTER VERT POUR SA PROPRE RAISON : sous le contexte
    // interne, la même lecture rend bien la ligne que la chaîne vient d'écrire.
    const parLinterne = await sousSociete(SOCIETE_A, (tx) =>
      tx.importLotLigne.findMany({ select: { cle: true } }),
    );
    expect(parLinterne.map((l) => l.cle)).toContain("SN-IMPORT-1");
  });
});
