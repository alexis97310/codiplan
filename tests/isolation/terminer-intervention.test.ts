import { afterAll, afterEach, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import {
  arreterLeCompteur,
  demarrerLeCompteur,
} from "@/lib/interventions/depot-compteur";
import {
  enregistrerRapportTexte,
  enregistrerSignature,
  terminerIntervention,
} from "@/lib/interventions/depot-rapport-terrain";
import { marquerVuParTechnicien } from "@/lib/interventions/depot";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  INTERVENTION_A1,
  SOCIETE_A,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * TERMINER — EN COURS → TERMINÉE (9DE-TP-CY1, D8 à la lettre : QT-4(a) ;
 * D-S5, décision du 03/10/2026 point 11).
 *
 * Même patron que `tests/isolation/9dc-renfort-saisir-rapport.test.ts` :
 * une intervention JETABLE, clonée du décor de `INTERVENTION_A1`, affectée à
 * qui le scénario choisit.
 */

afterAll(fermerClients);

const TECHNICIEN = UTILISATEUR_PAR_ROLE[Role.technicien];
const RENFORT = UTILISATEUR_PAR_ROLE[Role.responsable_materiel];
/** Le COLLÈGUE — une valeur posée sur `technicien_id`, jamais authentifiée. */
const COLLEGUE = "aaaaaaaa-0000-7000-8000-0000000009de";

const SESSION_TECH = {
  utilisateurId: TECHNICIEN,
  societeId: SOCIETE_A,
  role: Role.technicien,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const SESSION_BUREAU = {
  utilisateurId: RENFORT,
  societeId: SOCIETE_A,
  role: Role.responsable_materiel,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const jetables: string[] = [];

/** Une intervention jetable, clonée du décor de `INTERVENTION_A1`. */
async function jetable(
  technicienId: string,
  statut: string = "planifiee",
): Promise<string> {
  const id = uuidv7();
  jetables.push(id);
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention" ("id","societe_id","client_id","site_id","agence_id",
       "type","statut","date_planifiee","technicien_id","duree_estimee_min","modifie_le")
     SELECT '${id}', "societe_id", "client_id", "site_id", "agence_id",
            'curatif', '${statut}', DATE '2026-09-14',
            '${technicienId}', 60, now()
       FROM "intervention" WHERE "id" = '${INTERVENTION_A1}'`,
  );
  return id;
}

afterEach(async () => {
  for (const id of jetables.splice(0)) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = '${id}'`,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention_signature" WHERE "intervention_id" = '${id}'`,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = '${id}'`,
    );
  }
});

describe("terminerIntervention — le chemin accepté", () => {
  it("le technicien termine SA PROPRE intervention : statut terminee, segment fermé, temps = somme", async () => {
    const id = await jetable(TECHNICIEN);

    const demarrage = await demarrerLeCompteur(
      SESSION_TECH,
      id,
      new Date("2026-09-14T08:00:00.000Z"),
      clientApp(),
    );
    expect(demarrage.accepte).toBe(true);
    const arret = await arreterLeCompteur(
      SESSION_TECH,
      new Date("2026-09-14T09:00:00.000Z"),
      clientApp(),
    );
    expect(arret.accepte).toBe(true);

    const signature = await enregistrerSignature(
      SESSION_TECH,
      id,
      {
        issue: "signee",
        image_base64: "data:image/png;base64,AAAA",
        signataire_nom: "Jean Dupont",
      },
      clientApp(),
    );
    expect(signature).not.toBeNull();

    const resultat = await terminerIntervention(
      SESSION_TECH,
      id,
      new Date("2026-09-14T09:05:00.000Z"),
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);
    if (resultat.accepte) {
      expect(resultat.issueSignature).toBe("signee");
      expect(resultat.motifSignature).toBeNull();
    }

    const [ligne] = await clientOwner().$queryRawUnsafe<
      Array<{ statut: string; temps_mesure_min: number }>
    >(
      `SELECT "statut", "temps_mesure_min" FROM "intervention" WHERE "id" = '${id}'`,
    );
    expect(ligne.statut).toBe("terminee");
    expect(ligne.temps_mesure_min).toBe(60);
  });

  it("ferme le segment OUVERT de l'appelant lui-même, sans arrêt préalable", async () => {
    const id = await jetable(TECHNICIEN);

    const demarrage = await demarrerLeCompteur(
      SESSION_TECH,
      id,
      new Date("2026-09-14T08:00:00.000Z"),
      clientApp(),
    );
    expect(demarrage.accepte).toBe(true);

    await enregistrerSignature(
      SESSION_TECH,
      id,
      { issue: "client_absent", motif: "Client injoignable" },
      clientApp(),
    );

    const resultat = await terminerIntervention(
      SESSION_TECH,
      id,
      new Date("2026-09-14T08:30:00.000Z"),
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);
    if (resultat.accepte) {
      expect(resultat.issueSignature).toBe("client_absent");
      expect(resultat.motifSignature).toBe("Client injoignable");
    }

    const [segment] = await clientOwner().$queryRawUnsafe<
      Array<{ fin: Date | null }>
    >(`SELECT "fin" FROM "segment_travail" WHERE "intervention_id" = '${id}'`);
    expect(segment.fin).not.toBeNull();

    const [ligne] = await clientOwner().$queryRawUnsafe<
      Array<{ temps_mesure_min: number }>
    >(`SELECT "temps_mesure_min" FROM "intervention" WHERE "id" = '${id}'`);
    expect(ligne.temps_mesure_min).toBe(30);
  });
});

describe("terminerIntervention — les refus", () => {
  it("refuse sans aucune issue de signature enregistrée", async () => {
    const id = await jetable(TECHNICIEN);
    await demarrerLeCompteur(
      SESSION_TECH,
      id,
      new Date("2026-09-14T08:00:00.000Z"),
      clientApp(),
    );
    await arreterLeCompteur(
      SESSION_TECH,
      new Date("2026-09-14T09:00:00.000Z"),
      clientApp(),
    );

    const resultat = await terminerIntervention(
      SESSION_TECH,
      id,
      new Date("2026-09-14T09:05:00.000Z"),
      clientApp(),
    );
    expect(resultat.accepte).toBe(false);
    if (!resultat.accepte) {
      expect(resultat.cle).toBe("intervention.refus.signature_manquante");
    }
  });

  it("refuse — intervention d'un collègue : même clé que « introuvable »", async () => {
    const id = await jetable(COLLEGUE);
    // Une signature posée par le bureau (accès complet) ne change rien au
    // périmètre : le refus tombe avant même de la lire.
    await enregistrerSignature(
      SESSION_BUREAU,
      id,
      {
        issue: "signee",
        image_base64: "data:image/png;base64,BBBB",
        signataire_nom: "Le bureau",
      },
      clientApp(),
    );

    const resultat = await terminerIntervention(
      SESSION_TECH,
      id,
      new Date("2026-09-14T09:05:00.000Z"),
      clientApp(),
    );
    expect(resultat.accepte).toBe(false);
    if (!resultat.accepte) {
      expect(resultat.cle).toBe("intervention.refus.inconnue");
    }
  });

  it("refuse — un AUTRE segment ouvert sur cette intervention (un renfort pointe encore)", async () => {
    const id = await jetable(TECHNICIEN);
    await demarrerLeCompteur(
      SESSION_TECH,
      id,
      new Date("2026-09-14T08:00:00.000Z"),
      clientApp(),
    );
    await arreterLeCompteur(
      SESSION_TECH,
      new Date("2026-09-14T09:00:00.000Z"),
      clientApp(),
    );
    await enregistrerSignature(
      SESSION_TECH,
      id,
      {
        issue: "signee",
        image_base64: "data:image/png;base64,CCCC",
        signataire_nom: "Jean Dupont",
      },
      clientApp(),
    );

    // LE RENFORT POINTE ENCORE — posé directement en base (propriétaire),
    // exactement ce qu'un second `demarrerLeCompteur`, par un AUTRE
    // utilisateur, aurait écrit.
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "segment_travail" ("id","societe_id","intervention_id","utilisateur_id","debut","modifie_le")
       VALUES ('${uuidv7()}', '${SOCIETE_A}', '${id}', '${RENFORT}', '2026-09-14T09:10:00.000Z', now())`,
    );

    const resultat = await terminerIntervention(
      SESSION_TECH,
      id,
      new Date("2026-09-14T09:20:00.000Z"),
      clientApp(),
    );
    expect(resultat.accepte).toBe(false);
    if (!resultat.accepte) {
      expect(resultat.cle).toBe("intervention.refus.compteur_tourne_encore");
    }
  });

  it("refuse — un statut qui n'est pas en_cours (ici, planifiee)", async () => {
    const id = await jetable(TECHNICIEN, "planifiee");
    const resultat = await terminerIntervention(
      SESSION_TECH,
      id,
      new Date("2026-09-14T09:05:00.000Z"),
      clientApp(),
    );
    expect(resultat.accepte).toBe(false);
    if (!resultat.accepte) {
      expect(resultat.cle).toBe("intervention.refus.pas_en_cours");
    }
  });
});

describe("la contrainte « intervention_signature_issue_coherente » — le jumeau", () => {
  afterEach(async () => {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention_signature" WHERE "intervention_id" = '${INTERVENTION_A1}' AND "signataire_nom" = 'JUMEAU'`,
    );
  });

  it("refuse une ligne « signee » SANS image", async () => {
    await expect(
      clientOwner().$executeRawUnsafe(
        `INSERT INTO "intervention_signature" ("id","societe_id","intervention_id","issue","image_base64","signataire_nom")
         SELECT '${uuidv7()}', "societe_id", '${INTERVENTION_A1}', 'signee', NULL, 'JUMEAU'
           FROM "intervention" WHERE "id" = '${INTERVENTION_A1}'`,
      ),
    ).rejects.toThrow(/intervention_signature_issue_coherente/);
  });

  it("refuse une ligne « client_absent » AVEC une image", async () => {
    await expect(
      clientOwner().$executeRawUnsafe(
        `INSERT INTO "intervention_signature" ("id","societe_id","intervention_id","issue","image_base64","motif")
         SELECT '${uuidv7()}', "societe_id", '${INTERVENTION_A1}', 'client_absent', 'data:image/png;base64,AAAA', 'JUMEAU'
           FROM "intervention" WHERE "id" = '${INTERVENTION_A1}'`,
      ),
    ).rejects.toThrow(/intervention_signature_issue_coherente/);
  });

  it("accepte la forme COHÉRENTE jumelle : « client_absent », un motif, aucune image", async () => {
    await expect(
      clientOwner().$executeRawUnsafe(
        `INSERT INTO "intervention_signature" ("id","societe_id","intervention_id","issue","motif","signataire_nom")
         SELECT '${uuidv7()}', "societe_id", '${INTERVENTION_A1}', 'client_absent', 'motif JUMEAU', 'JUMEAU'
           FROM "intervention" WHERE "id" = '${INTERVENTION_A1}'`,
      ),
    ).resolves.toBeDefined();
  });
});

describe("estFige — le terrain ne lève plus sur une figée jamais vue (9DE-TP-CY1, partie G)", () => {
  it("marquerVuParTechnicien : aucune écriture, aucune erreur, sur une ANNULÉE jamais vue", async () => {
    const id = await jetable(TECHNICIEN, "annulee");
    await expect(
      marquerVuParTechnicien(SESSION_TECH, id, clientApp()),
    ).resolves.toBeUndefined();

    const [ligne] = await clientOwner().$queryRawUnsafe<
      Array<{ vue_technicien_le: Date | null }>
    >(`SELECT "vue_technicien_le" FROM "intervention" WHERE "id" = '${id}'`);
    expect(ligne.vue_technicien_le).toBeNull();
  });

  it("enregistrerRapportTexte refuse — nommé — sur une FIGÉE", async () => {
    const annulee = await jetable(TECHNICIEN, "annulee");
    const refusAnnulee = await enregistrerRapportTexte(
      SESSION_TECH,
      annulee,
      { commentaire_technicien: "tentative", suite_a_donner: null },
      clientApp(),
    );
    expect(refusAnnulee).not.toBeNull();
    expect(refusAnnulee && "refuse" in refusAnnulee && refusAnnulee.cle).toBe(
      "intervention.refus.annulee_figee",
    );

    const cloturee = await jetable(TECHNICIEN, "cloturee");
    const refusCloturee = await enregistrerRapportTexte(
      SESSION_TECH,
      cloturee,
      { commentaire_technicien: "tentative", suite_a_donner: null },
      clientApp(),
    );
    expect(refusCloturee).not.toBeNull();
    expect(
      refusCloturee && "refuse" in refusCloturee && refusCloturee.cle,
    ).toBe("intervention.refus.cloturee_figee");
  });
});
