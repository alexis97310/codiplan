import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import {
  deposerPhotoIntervention,
  photosDeLIntervention,
} from "@/lib/documents/depot";
import {
  definirPrestationsRealiseesDepuisFile,
  derniereSignature,
  enregistrerRapportTexte,
  enregistrerSignature,
  piecesRemplacees,
  prestationsRealisees,
} from "@/lib/interventions/depot-rapport-terrain";

import { avecPortail, clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  INTERVENTION_A1,
  INTERVENTION_A2,
  INTERVENTION_B1,
  CLIENT_A1,
  SITE_A1_S1,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_INTERNE_A,
  UTILISATEUR_INTERNE_B,
} from "./setup/fixtures";

/**
 * LE RAPPORT DE TERRAIN, ÉPROUVÉ SUR LES VRAIES TABLES (ticket 17-BON-2).
 *
 * Trois formes à mesurer : « filiation » sur `intervention_prestation` et
 * `intervention_signature` (D103), « héritage » à trois cibles sur `document`
 * (D93, étendu par BON-2). Chaque table est fille d'`intervention`, de forme
 * « parc » — société, `app.client_id`, `app.perimetre_sites` s'y propagent
 * sans être réécrits ici.
 */

afterAll(fermerClients);

// `responsable_materiel` — un accès COMPLET sur `saisir_rapport` (D151), donc
// insensible à `technicien_id` de l'intervention : ce fichier éprouve le
// cloisonnement par SOCIÉTÉ, pas le périmètre par PERSONNE (qui a sa propre
// épreuve, `tests/isolation/9dc-renfort-saisir-rapport.test.ts`). `adv` ne
// convient plus depuis D151 : il n'a aucun accès à `saisir_rapport`, ○ ou ●.
const SESSION_A = {
  utilisateurId: UTILISATEUR_INTERNE_A,
  societeId: SOCIETE_A,
  role: Role.responsable_materiel,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const SESSION_B = {
  utilisateurId: UTILISATEUR_INTERNE_B,
  societeId: SOCIETE_B,
  role: Role.responsable_materiel,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

/** Le compte portail restreint au site de INTERVENTION_A1 — et lui seul. */
const PORTAIL_SUR_S1 = {
  societeId: SOCIETE_A,
  clientId: CLIENT_A1,
  perimetreSites: [SITE_A1_S1],
};

const PRESTATION_A = uuidv7();
const PRESTATION_B = uuidv7();
const PRESTATION_C = uuidv7();
const PRESTATION_COLLEGUE = uuidv7();

beforeAll(async () => {
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "prestation" ("id", "societe_id", "code", "libelle", "modifie_le")
     VALUES ('${PRESTATION_A}', '${SOCIETE_A}', 'BON2-A', 'Prestation A', now())`,
  );
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "prestation" ("id", "societe_id", "code", "libelle", "modifie_le")
     VALUES ('${PRESTATION_B}', '${SOCIETE_B}', 'BON2-B', 'Prestation B', now())`,
  );
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "prestation" ("id", "societe_id", "code", "libelle", "modifie_le")
     VALUES ('${PRESTATION_C}', '${SOCIETE_A}', 'BON2-C', 'Prestation C', now())`,
  );
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "prestation" ("id", "societe_id", "code", "libelle", "modifie_le")
     VALUES ('${PRESTATION_COLLEGUE}', '${SOCIETE_A}', 'BON2-COLLEGUE', 'Prestation collègue', now())`,
  );
});

afterEach(async () => {
  // Chaque scénario nettoie ses propres écritures ; ce filet ramène
  // `intervention` et les tables filles à leur état de fixture pour le
  // scénario suivant. Le STATUT n'est PAS touché ici : une intervention
  // CLÔTURÉE refuse toute modification hors annulation
  // (`intervention_cycle_de_vie`) — le scénario qui la clôture la restaure
  // lui-même, trigger désactivé le temps du geste.
  await clientOwner().$executeRawUnsafe(
    `UPDATE "intervention" SET "commentaire_technicien" = NULL, "suite_a_donner" = NULL WHERE "id" IN ('${INTERVENTION_A1}', '${INTERVENTION_A2}', '${INTERVENTION_B1}')`,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "intervention_prestation" WHERE "intervention_id" IN ('${INTERVENTION_A1}', '${INTERVENTION_A2}', '${INTERVENTION_B1}')`,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "intervention_piece_remplacee" WHERE "intervention_id" IN ('${INTERVENTION_A1}', '${INTERVENTION_A2}', '${INTERVENTION_B1}')`,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "intervention_signature" WHERE "intervention_id" IN ('${INTERVENTION_A1}', '${INTERVENTION_A2}', '${INTERVENTION_B1}')`,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "document" WHERE "intervention_id" IN ('${INTERVENTION_A1}', '${INTERVENTION_A2}', '${INTERVENTION_B1}')`,
  );
});

afterAll(async () => {
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "prestation" WHERE "id" IN
     ('${PRESTATION_A}', '${PRESTATION_B}', '${PRESTATION_C}', '${PRESTATION_COLLEGUE}')`,
  );
});

describe("le TÉMOIN PRÉALABLE — RLS en vigueur sur les deux tables neuves", () => {
  it.each(["intervention_prestation", "intervention_signature"])(
    "les deux drapeaux sont posés sur « %s »",
    async (table) => {
      const [etat] = await clientOwner().$queryRawUnsafe<
        Array<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>
      >(
        `SELECT "relrowsecurity", "relforcerowsecurity" FROM "pg_class"
          WHERE "relname" = $1 AND "relnamespace" = 'public'::regnamespace`,
        table,
      );
      expect(etat?.relrowsecurity).toBe(true);
      expect(etat?.relforcerowsecurity).toBe(true);
    },
  );
});

describe("le commentaire et la suite à donner", () => {
  it("s'écrivent sous la société qui voit l'intervention, jamais sous l'autre", async () => {
    const ecrite = await enregistrerRapportTexte(
      SESSION_A,
      INTERVENTION_A1,
      {
        commentaire_technicien: "Filtre changé",
        suite_a_donner: "Revoir dans 3 mois",
      },
      clientApp(),
    );
    expect(ecrite).not.toBeNull();

    const [ligne] = await clientOwner().$queryRawUnsafe<
      Array<{
        commentaire_technicien: string | null;
        suite_a_donner: string | null;
      }>
    >(
      `SELECT "commentaire_technicien", "suite_a_donner" FROM "intervention" WHERE "id" = '${INTERVENTION_A1}'`,
    );
    expect(ligne?.commentaire_technicien).toBe("Filtre changé");
    expect(ligne?.suite_a_donner).toBe("Revoir dans 3 mois");

    // LE CAS QUI DOIT ÉCHOUER : la société B ne voit pas l'intervention de A,
    // et l'écriture rend `null` plutôt qu'une erreur (D35, D50).
    const refus = await enregistrerRapportTexte(
      SESSION_B,
      INTERVENTION_A1,
      { commentaire_technicien: "détourné", suite_a_donner: null },
      clientApp(),
    );
    expect(refus).toBeNull();
    const [intacte] = await clientOwner().$queryRawUnsafe<
      Array<{ commentaire_technicien: string | null }>
    >(
      `SELECT "commentaire_technicien" FROM "intervention" WHERE "id" = '${INTERVENTION_A1}'`,
    );
    expect(intacte?.commentaire_technicien).toBe("Filtre changé");
  });
});

describe("les pièces remplacées, saisie libre (9I7B) — forme « filiation »", () => {
  it("se remplacent intégralement sous la société propriétaire, jamais sous l'autre", async () => {
    const ecrite = await enregistrerRapportTexte(
      SESSION_A,
      INTERVENTION_A1,
      {
        commentaire_technicien: null,
        suite_a_donner: null,
        pieces_remplacees: [
          { designation: "Vis M6", reference: "V6", quantite: 2 },
          { designation: "Joint", reference: null, quantite: 1 },
        ],
      },
      clientApp(),
    );
    expect(ecrite).not.toBeNull();

    const lues = await piecesRemplacees(
      SESSION_A,
      INTERVENTION_A1,
      clientApp(),
    );
    expect(lues).toEqual([
      { designation: "Vis M6", reference: "V6", quantite: 2 },
      { designation: "Joint", reference: null, quantite: 1 },
    ]);

    // Société B : l'intervention de A lui est invisible, `null` et non `[]`.
    const horsSociete = await piecesRemplacees(
      SESSION_B,
      INTERVENTION_A1,
      clientApp(),
    );
    expect(horsSociete).toBeNull();

    // L'ÉCRITURE SOUS LA SOCIÉTÉ B NE TOUCHE RIEN DE A — refusée comme le
    // commentaire/la suite (`null`, D35/D50), jamais une erreur non rattrapée.
    const refus = await enregistrerRapportTexte(
      SESSION_B,
      INTERVENTION_A1,
      {
        commentaire_technicien: null,
        suite_a_donner: null,
        pieces_remplacees: [
          { designation: "détournée", reference: null, quantite: 1 },
        ],
      },
      clientApp(),
    );
    expect(refus).toBeNull();
    const intactes = await piecesRemplacees(
      SESSION_A,
      INTERVENTION_A1,
      clientApp(),
    );
    expect(intactes).toHaveLength(2);
  });

  it("un second enregistrement REMPLACE l'ensemble, jamais une fusion ni un ajout", async () => {
    await enregistrerRapportTexte(
      SESSION_A,
      INTERVENTION_A1,
      {
        commentaire_technicien: null,
        suite_a_donner: null,
        pieces_remplacees: [
          { designation: "Première pièce", reference: null, quantite: 1 },
        ],
      },
      clientApp(),
    );
    await enregistrerRapportTexte(
      SESSION_A,
      INTERVENTION_A1,
      {
        commentaire_technicien: null,
        suite_a_donner: null,
        pieces_remplacees: [
          { designation: "Seconde pièce", reference: null, quantite: 3 },
        ],
      },
      clientApp(),
    );
    const lues = await piecesRemplacees(
      SESSION_A,
      INTERVENTION_A1,
      clientApp(),
    );
    expect(lues).toEqual([
      { designation: "Seconde pièce", reference: null, quantite: 3 },
    ]);
  });

  it("omise (`undefined`), l'ancienne saisie de pièces reste intacte — seul un tableau explicite remplace", async () => {
    await enregistrerRapportTexte(
      SESSION_A,
      INTERVENTION_A1,
      {
        commentaire_technicien: null,
        suite_a_donner: null,
        pieces_remplacees: [
          { designation: "Gardée", reference: null, quantite: 1 },
        ],
      },
      clientApp(),
    );
    await enregistrerRapportTexte(
      SESSION_A,
      INTERVENTION_A1,
      {
        commentaire_technicien: "Sans toucher aux pièces",
        suite_a_donner: null,
      },
      clientApp(),
    );
    const lues = await piecesRemplacees(
      SESSION_A,
      INTERVENTION_A1,
      clientApp(),
    );
    expect(lues).toEqual([
      { designation: "Gardée", reference: null, quantite: 1 },
    ]);
  });

  // POINT 2, 9I7B2-PIECES-CORRECTIFS-DE-REVUE — le TYPE est contrôlé au
  // SERVEUR, jamais seulement à l'écran : hors curatif/garantie/reprise, des
  // pièces envoyées sont refusées EN BLOC, avant toute écriture (même
  // doctrine que le refus `estFige`) — ni les pièces, ni le commentaire, ni
  // la suite ne s'écrivent.
  it("des pièces envoyées sur un type qui n'en porte pas sont refusées EN BLOC — rien n'est écrit", async () => {
    await clientOwner().$executeRawUnsafe(
      `UPDATE "intervention" SET "type" = 'preventif_contrat' WHERE "id" = '${INTERVENTION_A2}'`,
    );
    try {
      const refus = await enregistrerRapportTexte(
        SESSION_A,
        INTERVENTION_A2,
        {
          commentaire_technicien: "Devrait être refusé avec les pièces",
          suite_a_donner: null,
          pieces_remplacees: [
            {
              designation: "Ne doit pas s'écrire",
              reference: null,
              quantite: 1,
            },
          ],
        },
        clientApp(),
      );
      expect(refus).toEqual({
        refuse: true,
        cle: "terrain.rapport.pieces_type_refuse",
      });
      const lues = await piecesRemplacees(
        SESSION_A,
        INTERVENTION_A2,
        clientApp(),
      );
      expect(lues).toEqual([]);
      const [ligne] = await clientOwner().$queryRawUnsafe<
        Array<{ commentaire_technicien: string | null }>
      >(
        `SELECT "commentaire_technicien" FROM "intervention" WHERE "id" = '${INTERVENTION_A2}'`,
      );
      expect(ligne?.commentaire_technicien).toBeNull();
    } finally {
      await clientOwner().$executeRawUnsafe(
        `UPDATE "intervention" SET "type" = 'curatif' WHERE "id" = '${INTERVENTION_A2}'`,
      );
    }
  });

  // POINT 5, 9I7B2-PIECES-CORRECTIFS-DE-REVUE — IDEMPOTENCE AU REJEU : la
  // réponse du premier envoi peut se perdre (coupure réseau juste après que
  // le serveur a écrit), et la file hors réseau rejoue alors le MÊME geste —
  // le remplacement intégral garantit déjà un état final identique, jamais
  // une série de lignes doublée.
  it("rejoué deux fois avec les MÊMES pièces (réponse perdue puis second envoi) : une seule série de lignes", async () => {
    const saisie = {
      commentaire_technicien: null,
      suite_a_donner: null,
      pieces_remplacees: [
        { designation: "Vis M6", reference: "V6", quantite: 2 },
        { designation: "Joint", reference: null, quantite: 1 },
      ],
    };
    await enregistrerRapportTexte(
      SESSION_A,
      INTERVENTION_A1,
      saisie,
      clientApp(),
    );
    const rejouee = await enregistrerRapportTexte(
      SESSION_A,
      INTERVENTION_A1,
      saisie,
      clientApp(),
    );
    expect(rejouee).not.toBeNull();
    const lues = await piecesRemplacees(
      SESSION_A,
      INTERVENTION_A1,
      clientApp(),
    );
    expect(lues).toEqual([
      { designation: "Vis M6", reference: "V6", quantite: 2 },
      { designation: "Joint", reference: null, quantite: 1 },
    ]);
    const [{ n }] = await clientOwner().$queryRawUnsafe<Array<{ n: bigint }>>(
      `SELECT count(*) AS "n" FROM "intervention_piece_remplacee" WHERE "intervention_id" = '${INTERVENTION_A1}'`,
    );
    expect(Number(n)).toBe(2);
  });
});

// DEPUIS 9F4H6E-PRESTATIONS-DIFFERENCE-EN-LIGNE (D143) — `definirPrestations
// Realisees`, qui remplaçait l'ENSEMBLE entier, a disparu : les deux chemins
// terrain (en ligne et rejeu depuis la file) passent désormais par
// `definirPrestationsRealiseesDepuisFile`, une DIFFÉRENCE. Les scénarios
// propres à la sémantique d'ENSEMBLE (un retrait qui efface l'ancien, un
// rejeu du MÊME ensemble sans doublon) ont disparu avec elle ; le rejeu sans
// doublon d'une DIFFÉRENCE reste éprouvé plus bas (« REJEU DU MÊME ENVOI »).
describe("les prestations réalisées — forme « filiation »", () => {
  it("se lisent et s'écrivent sous la société propriétaire, jamais sous l'autre", async () => {
    const ecrite = await definirPrestationsRealiseesDepuisFile(
      SESSION_A,
      INTERVENTION_A1,
      [PRESTATION_A],
      [],
      clientApp(),
    );
    expect(ecrite).not.toBeNull();

    const lues = await prestationsRealisees(
      SESSION_A,
      INTERVENTION_A1,
      clientApp(),
    );
    expect(lues?.map((l) => l.prestation_id)).toEqual([PRESTATION_A]);

    // Société B : l'intervention de A lui est invisible, `null` et non `[]`.
    const horsSociete = await prestationsRealisees(
      SESSION_B,
      INTERVENTION_A1,
      clientApp(),
    );
    expect(horsSociete).toBeNull();
  });

  it("un compte portail sur le BON site les voit ; sur un autre site, non", async () => {
    await definirPrestationsRealiseesDepuisFile(
      SESSION_A,
      INTERVENTION_A1,
      [PRESTATION_A],
      [],
      clientApp(),
    );
    await definirPrestationsRealiseesDepuisFile(
      SESSION_A,
      INTERVENTION_A2,
      [PRESTATION_A],
      [],
      clientApp(),
    );

    const surSonSite = await avecPortail(PORTAIL_SUR_S1, (tx) =>
      tx.interventionPrestation.findMany({
        where: { intervention_id: INTERVENTION_A1 },
        select: { id: true },
      }),
    );
    expect(surSonSite).toHaveLength(1);

    // INTERVENTION_A2 est sur SITE_A1_S2 : hors du périmètre du compte.
    const surLAutreSite = await avecPortail(PORTAIL_SUR_S1, (tx) =>
      tx.interventionPrestation.findMany({
        where: { intervention_id: INTERVENTION_A2 },
        select: { id: true },
      }),
    );
    expect(surLAutreSite).toEqual([]);
  });

  it("un retrait explicite efface la ligne, sans toucher au reste (D143)", async () => {
    await definirPrestationsRealiseesDepuisFile(
      SESSION_A,
      INTERVENTION_A1,
      [PRESTATION_A, PRESTATION_C],
      [],
      clientApp(),
    );
    const ecrite = await definirPrestationsRealiseesDepuisFile(
      SESSION_A,
      INTERVENTION_A1,
      [],
      [PRESTATION_A],
      clientApp(),
    );
    expect(ecrite).not.toBeNull();
    const lues = await prestationsRealisees(
      SESSION_A,
      INTERVENTION_A1,
      clientApp(),
    );
    expect(lues?.map((l) => l.prestation_id)).toEqual([PRESTATION_C]);
  });
});

// 9F4H6A-COQUILLE-ANCIENNE-COPIE, point 2 — un rejeu depuis la file hors
// réseau ne connaît que CE QUE SON APPAREIL a changé depuis l'instantané
// qu'il a emporté, jamais l'ensemble entier : voir l'en-tête de
// `definirPrestationsRealiseesDepuisFile`.
describe("les prestations réalisées — un rejeu DEPUIS LA FILE applique une DIFFÉRENCE, jamais un ensemble", () => {
  it("un ajout d'un collègue, PENDANT la coupure, n'est jamais effacé par le rejeu de la coquille", async () => {
    // A est déjà fait au moment de l'instantané emporté par la coquille.
    await definirPrestationsRealiseesDepuisFile(
      SESSION_A,
      INTERVENTION_A1,
      [PRESTATION_A],
      [],
      clientApp(),
    );
    // UN COLLÈGUE ajoute B EN LIGNE pendant la coupure — la coquille ne le
    // sait pas, son instantané date d'avant.
    await definirPrestationsRealiseesDepuisFile(
      SESSION_A,
      INTERVENTION_A1,
      [PRESTATION_COLLEGUE],
      [],
      clientApp(),
    );
    // LA COQUILLE coche C, puis rejoue : elle ne connaît que « A » (son
    // instantané) et son propre ajout de C — jamais « B ».
    const rejouee = await definirPrestationsRealiseesDepuisFile(
      SESSION_A,
      INTERVENTION_A1,
      [PRESTATION_C],
      [],
      clientApp(),
    );
    expect(rejouee).not.toBeNull();
    const apresAjout = await prestationsRealisees(
      SESSION_A,
      INTERVENTION_A1,
      clientApp(),
    );
    expect(new Set(apresAjout?.map((l) => l.prestation_id))).toEqual(
      new Set([PRESTATION_A, PRESTATION_COLLEGUE, PRESTATION_C]),
    );

    // LA COQUILLE décoche A, puis rejoue : seule A est retirée — B et C
    // restent intacts.
    const rejoueeRetrait = await definirPrestationsRealiseesDepuisFile(
      SESSION_A,
      INTERVENTION_A1,
      [],
      [PRESTATION_A],
      clientApp(),
    );
    expect(rejoueeRetrait).not.toBeNull();
    const apresRetrait = await prestationsRealisees(
      SESSION_A,
      INTERVENTION_A1,
      clientApp(),
    );
    expect(new Set(apresRetrait?.map((l) => l.prestation_id))).toEqual(
      new Set([PRESTATION_COLLEGUE, PRESTATION_C]),
    );

    // REJEU DU MÊME ENVOI (retransmission réseau) : rien de doublé, rien de
    // plus retiré — l'ajout est déjà là, le retrait déjà fait.
    const rejoueeEncore = await definirPrestationsRealiseesDepuisFile(
      SESSION_A,
      INTERVENTION_A1,
      [],
      [PRESTATION_A],
      clientApp(),
    );
    expect(rejoueeEncore).not.toBeNull();
    const lignesFinales = await clientOwner().interventionPrestation.findMany({
      where: { intervention_id: INTERVENTION_A1 },
      select: { prestation_id: true },
    });
    expect(new Set(lignesFinales.map((l) => l.prestation_id))).toEqual(
      new Set([PRESTATION_COLLEGUE, PRESTATION_C]),
    );
    expect(lignesFinales).toHaveLength(2);
  });

  it("ne s'écrit ni ne se lit sous la société qui ne voit pas l'intervention", async () => {
    const refus = await definirPrestationsRealiseesDepuisFile(
      SESSION_B,
      INTERVENTION_A1,
      [PRESTATION_C],
      [],
      clientApp(),
    );
    expect(refus).toBeNull();
  });

  // POINT 4, 9F4H6B-FILE-ANCIEN-FORMAT — un `ajouter_id` D'UNE AUTRE société
  // violerait la FK composite `(societe_id, prestation_id)` sans ce
  // contrôle ; la mesure est ici qu'il REFUSE PROPREMENT (une promesse
  // résolue, jamais rejetée) plutôt que de lever une erreur Prisma non
  // rattrapée, et qu'il n'écrit RIEN — ni la prestation refusée, ni le reste
  // d'un éventuel lot mêlé.
  it("un `ajouter_id` d'une AUTRE société est refusé proprement — jamais une erreur non rattrapée, rien n'est écrit", async () => {
    await expect(
      definirPrestationsRealiseesDepuisFile(
        SESSION_A,
        INTERVENTION_A1,
        [PRESTATION_B],
        [],
        clientApp(),
      ),
    ).resolves.toBeNull();
    const lignes = await clientOwner().interventionPrestation.findMany({
      where: { intervention_id: INTERVENTION_A1 },
    });
    expect(lignes).toHaveLength(0);
  });

  it("un lot mêlé (une prestation valide, une d'une autre société) est refusé EN BLOC — la valide n'est pas écrite seule", async () => {
    await expect(
      definirPrestationsRealiseesDepuisFile(
        SESSION_A,
        INTERVENTION_A1,
        [PRESTATION_A, PRESTATION_B],
        [],
        clientApp(),
      ),
    ).resolves.toBeNull();
    const lignes = await clientOwner().interventionPrestation.findMany({
      where: { intervention_id: INTERVENTION_A1 },
    });
    expect(lignes).toHaveLength(0);
  });

  // POINT 5, 9F4H6C-FILE-ROBUSTESSE — un `ajouter_id`/`retirer_id` qui n'est
  // PAS un UUID atteindrait `prestation.findMany`/`interventionPrestation.
  // deleteMany` (`prestation_id` est `@db.Uuid`) et lèverait à la base
  // (« invalid input syntax for type uuid »), une erreur Prisma NON
  // rattrapée — mesuré ici par une promesse RÉSOLUE (jamais rejetée).
  it("un `ajouter_id` qui n'est pas un UUID est refusé proprement — jamais une erreur non rattrapée", async () => {
    await expect(
      definirPrestationsRealiseesDepuisFile(
        SESSION_A,
        INTERVENTION_A1,
        ["pas-un-uuid"],
        [],
        clientApp(),
      ),
    ).resolves.toBeNull();
    const lignes = await clientOwner().interventionPrestation.findMany({
      where: { intervention_id: INTERVENTION_A1 },
    });
    expect(lignes).toHaveLength(0);
  });

  it("un `retirer_id` qui n'est pas un UUID est refusé proprement — jamais une erreur non rattrapée", async () => {
    await definirPrestationsRealiseesDepuisFile(
      SESSION_A,
      INTERVENTION_A1,
      [PRESTATION_A],
      [],
      clientApp(),
    );
    await expect(
      definirPrestationsRealiseesDepuisFile(
        SESSION_A,
        INTERVENTION_A1,
        [],
        ["pas-un-uuid"],
        clientApp(),
      ),
    ).resolves.toBeNull();
    // REFUSÉ EN BLOC — PRESTATION_A, valide, n'est pas retirée seule.
    const lignes = await clientOwner().interventionPrestation.findMany({
      where: { intervention_id: INTERVENTION_A1 },
    });
    expect(lignes).toHaveLength(1);
  });
});

describe("le commentaire et la suite à donner — rejoué (point 4, 9F4H2A-REJEU-SANS-DOUBLON)", () => {
  it("rejoué deux fois avec les MÊMES valeurs : état final identique", async () => {
    const saisie = {
      commentaire_technicien: "Filtre changé",
      suite_a_donner: "Revoir dans 3 mois",
    };
    await enregistrerRapportTexte(
      SESSION_A,
      INTERVENTION_A1,
      saisie,
      clientApp(),
    );
    const rejouee = await enregistrerRapportTexte(
      SESSION_A,
      INTERVENTION_A1,
      saisie,
      clientApp(),
    );
    expect(rejouee).not.toBeNull();
    const [ligne] = await clientOwner().$queryRawUnsafe<
      Array<{
        commentaire_technicien: string | null;
        suite_a_donner: string | null;
      }>
    >(
      `SELECT "commentaire_technicien", "suite_a_donner" FROM "intervention" WHERE "id" = '${INTERVENTION_A1}'`,
    );
    expect(ligne?.commentaire_technicien).toBe("Filtre changé");
    expect(ligne?.suite_a_donner).toBe("Revoir dans 3 mois");
  });
});

describe("la signature — HISTORISÉE, jamais réécrite", () => {
  it("une re-signature AJOUTE une ligne ; la plus récente est celle qu'on montre", async () => {
    const image1 = "data:image/png;base64,AAAA";
    const image2 = "data:image/png;base64,BBBB";

    const premiere = await enregistrerSignature(
      SESSION_A,
      INTERVENTION_A1,
      { issue: "signee", image_base64: image1, signataire_nom: "Jean Dupont" },
      clientApp(),
    );
    expect(premiere).not.toBeNull();

    await enregistrerSignature(
      SESSION_A,
      INTERVENTION_A1,
      { issue: "signee", image_base64: image2, signataire_nom: "Jean Dupont" },
      clientApp(),
    );

    const derniere = await derniereSignature(
      SESSION_A,
      INTERVENTION_A1,
      clientApp(),
    );
    expect(derniere?.image_base64).toBe(image2);

    // LES DEUX LIGNES EXISTENT TOUJOURS EN BASE — l'ancienne n'a pas disparu.
    const [{ n }] = await clientOwner().$queryRawUnsafe<Array<{ n: bigint }>>(
      `SELECT count(*) AS "n" FROM "intervention_signature" WHERE "intervention_id" = '${INTERVENTION_A1}'`,
    );
    expect(Number(n)).toBe(2);
  });

  // 9F4-TERRAIN-ENREGISTREMENT-AUTO — l'enregistrement automatique envoie la
  // signature dès qu'elle est complète, puis de nouveau si l'onglet se
  // rouvre et renvoie le même brouillon local : sans ce filtre, chaque
  // rechargement ajouterait une ligne identique à l'historique.
  it("une saisie IDENTIQUE à la dernière n'ajoute pas de ligne — rend la dernière", async () => {
    const image = "data:image/png;base64,AAAA";

    const premiere = await enregistrerSignature(
      SESSION_A,
      INTERVENTION_A2,
      { issue: "signee", image_base64: image, signataire_nom: "Jean Dupont" },
      clientApp(),
    );
    expect(premiere).not.toBeNull();

    const seconde = await enregistrerSignature(
      SESSION_A,
      INTERVENTION_A2,
      { issue: "signee", image_base64: image, signataire_nom: "Jean Dupont" },
      clientApp(),
    );
    expect(seconde?.id).toBe(premiere?.id);

    const [{ n }] = await clientOwner().$queryRawUnsafe<Array<{ n: bigint }>>(
      `SELECT count(*) AS "n" FROM "intervention_signature" WHERE "intervention_id" = '${INTERVENTION_A2}'`,
    );
    expect(Number(n)).toBe(1);
  });

  it("une saisie qui DIFFÈRE (même issue, nom changé) ajoute bien une ligne", async () => {
    await enregistrerSignature(
      SESSION_A,
      INTERVENTION_A2,
      {
        issue: "signee",
        image_base64: "data:image/png;base64,AAAA",
        signataire_nom: "Jean Dupont",
      },
      clientApp(),
    );
    await enregistrerSignature(
      SESSION_A,
      INTERVENTION_A2,
      {
        issue: "signee",
        image_base64: "data:image/png;base64,AAAA",
        signataire_nom: "Jeanne Martin",
      },
      clientApp(),
    );

    const [{ n }] = await clientOwner().$queryRawUnsafe<Array<{ n: bigint }>>(
      `SELECT count(*) AS "n" FROM "intervention_signature" WHERE "intervention_id" = '${INTERVENTION_A2}'`,
    );
    expect(Number(n)).toBe(2);
  });

  it("s'ajoute même sur une intervention CLÔTURÉE — I5, le travail terrain n'est jamais perdu", async () => {
    // LA MATRICE D8 (D160) : la clôture ne part que de TERMINEE — la ligne
    // est amenée ici par la seule chaîne que D8 permet, avant d'être close.
    await clientOwner().$executeRawUnsafe(
      `UPDATE "intervention" SET "statut" = 'affectee' WHERE "id" = '${INTERVENTION_A1}'`,
    );
    await clientOwner().$executeRawUnsafe(
      `UPDATE "intervention" SET "statut" = 'en_cours' WHERE "id" = '${INTERVENTION_A1}'`,
    );
    await clientOwner().$executeRawUnsafe(
      `UPDATE "intervention" SET "statut" = 'terminee' WHERE "id" = '${INTERVENTION_A1}'`,
    );
    // RAPPORT VALIDÉ POSÉ ICI (RG-INT-03, D135, 9H1) : ce scénario éprouve
    // I5 (le travail terrain n'est jamais perdu), pas la validation du
    // rapport — posée à part dans `rapport-valide-avant-cloture.test.ts`.
    await clientOwner().$executeRawUnsafe(
      `UPDATE "intervention" SET "statut" = 'cloturee', "temps_valide_min" = 60, "rapport_valide_par" = '${UTILISATEUR_INTERNE_A}', "rapport_valide_le" = now() WHERE "id" = '${INTERVENTION_A1}'`,
    );
    try {
      const ecrite = await enregistrerSignature(
        SESSION_A,
        INTERVENTION_A1,
        {
          issue: "signee",
          image_base64: "data:image/png;base64,CCCC",
          signataire_nom: "Jean Dupont",
        },
        clientApp(),
      );
      expect(ecrite).not.toBeNull();
    } finally {
      // RESTAURATION : une intervention clôturée refuse toute modification
      // hors annulation (`intervention_cycle_de_vie`) — le trigger est
      // désactivé le temps de ramener la fixture à son état de départ, sur
      // CETTE connexion (propriétaire) et pour la durée de ces deux requêtes.
      await clientOwner().$executeRawUnsafe(
        `ALTER TABLE "intervention" DISABLE TRIGGER "intervention_cycle_de_vie"`,
      );
      await clientOwner().$executeRawUnsafe(
        `UPDATE "intervention" SET "statut" = 'planifiee', "temps_valide_min" = NULL, "rapport_valide_par" = NULL, "rapport_valide_le" = NULL WHERE "id" = '${INTERVENTION_A1}'`,
      );
      await clientOwner().$executeRawUnsafe(
        `ALTER TABLE "intervention" ENABLE TRIGGER "intervention_cycle_de_vie"`,
      );
    }
  });

  it("ne se lit ni ne s'écrit sous la société qui ne voit pas l'intervention", async () => {
    await enregistrerSignature(
      SESSION_A,
      INTERVENTION_A1,
      {
        issue: "signee",
        image_base64: "data:image/png;base64,AAAA",
        signataire_nom: "Jean Dupont",
      },
      clientApp(),
    );
    const refusEcriture = await enregistrerSignature(
      SESSION_B,
      INTERVENTION_A1,
      {
        issue: "signee",
        image_base64: "data:image/png;base64,DDDD",
        signataire_nom: "Jean Dupont",
      },
      clientApp(),
    );
    expect(refusEcriture).toBeNull();

    const refusLecture = await derniereSignature(
      SESSION_B,
      INTERVENTION_A1,
      clientApp(),
    );
    expect(refusLecture).toBeNull();
  });

  it("est IMMUABLE : ni UPDATE ni DELETE ne sont accordés au rôle applicatif", async () => {
    const pose = await enregistrerSignature(
      SESSION_A,
      INTERVENTION_A1,
      {
        issue: "signee",
        image_base64: "data:image/png;base64,AAAA",
        signataire_nom: "Jean Dupont",
      },
      clientApp(),
    );
    expect(pose).not.toBeNull();

    await expect(
      clientApp().$executeRawUnsafe(
        `UPDATE "intervention_signature" SET "image_base64" = 'x' WHERE "id" = '${pose?.id}'`,
      ),
    ).rejects.toThrow(/permission denied/i);

    await expect(
      clientApp().$executeRawUnsafe(
        `DELETE FROM "intervention_signature" WHERE "id" = '${pose?.id}'`,
      ),
    ).rejects.toThrow(/permission denied/i);

    // LA LIGNE EST TOUJOURS LÀ — ni l'un ni l'autre n'a mordu.
    const [{ n }] = await clientOwner().$queryRawUnsafe<Array<{ n: bigint }>>(
      `SELECT count(*) AS "n" FROM "intervention_signature" WHERE "id" = '${pose?.id}'`,
    );
    expect(Number(n)).toBe(1);
  });
});

describe("les photos — `document`, forme « héritage » à trois cibles", () => {
  it("se déposent et se lisent sous la société propriétaire, jamais sous l'autre", async () => {
    const depot = await deposerPhotoIntervention(
      SESSION_A,
      INTERVENTION_A1,
      {
        classe: "client",
        libelle: "Avant intervention",
        nom_fichier: "avant.jpg",
        type_mime: "image/jpeg",
        octets: Buffer.from("a".repeat(64)),
      },
      clientApp(),
    );
    expect(depot).not.toBeNull();

    const lues = await photosDeLIntervention(
      SESSION_A,
      INTERVENTION_A1,
      clientApp(),
    );
    expect(lues?.map((p) => p.id)).toEqual([depot?.id]);

    const horsSociete = await photosDeLIntervention(
      SESSION_B,
      INTERVENTION_A1,
      clientApp(),
    );
    expect(horsSociete).toBeNull();
  });

  it("la classe `interne` ne franchit pas le portail, `client` si", async () => {
    await deposerPhotoIntervention(
      SESSION_A,
      INTERVENTION_A1,
      {
        classe: "client",
        libelle: "Photo client",
        nom_fichier: "client.jpg",
        type_mime: "image/jpeg",
        octets: Buffer.from("b".repeat(64)),
      },
      clientApp(),
    );
    await deposerPhotoIntervention(
      SESSION_A,
      INTERVENTION_A1,
      {
        classe: "interne",
        libelle: "Photo interne",
        nom_fichier: "interne.jpg",
        type_mime: "image/jpeg",
        octets: Buffer.from("c".repeat(64)),
      },
      clientApp(),
    );

    const auPortail = await avecPortail(PORTAIL_SUR_S1, (tx) =>
      tx.document.findMany({
        where: { intervention_id: INTERVENTION_A1 },
        select: { classe: true },
      }),
    );
    expect(auPortail.map((d) => d.classe)).toEqual(["client"]);

    const enInterne = await photosDeLIntervention(
      SESSION_A,
      INTERVENTION_A1,
      clientApp(),
    );
    expect(enInterne?.map((p) => p.classe).sort()).toEqual([
      "client",
      "interne",
    ]);
  });

  it("la contrainte de cible unique refuse une ligne à DEUX cibles, INTERVENTION comprise", async () => {
    const id = uuidv7();
    let motif = "";
    try {
      await clientOwner().$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `INSERT INTO "document" ("id", "societe_id", "intervention_id", "machine_id",
             "classe", "libelle", "nom_fichier", "type_mime", "taille_octets",
             "empreinte", "objet_cle", "modifie_le")
           VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 'client', 'x', 'x.jpg',
             'image/jpeg', 1, $5, 'iso/x.jpg', now())`,
          id,
          SOCIETE_A,
          INTERVENTION_A1,
          // Une machine réelle n'est pas nécessaire : la contrainte se lit
          // avant toute clé étrangère, et n'importe quel UUID suffit à
          // remplir la DEUXIÈME colonne.
          uuidv7(),
          "d".repeat(64),
        );
        throw new Error("ANNULATION");
      });
    } catch (erreur) {
      motif = String(erreur);
    }
    expect(motif).toContain("document_cible_unique");
  });
});
