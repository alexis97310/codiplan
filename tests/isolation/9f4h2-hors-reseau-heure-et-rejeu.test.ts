import { afterAll, afterEach, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import {
  arreterLeCompteur,
  demarrerLeCompteur,
} from "@/lib/interventions/depot-compteur";
import {
  enregistrerSignature,
  terminerIntervention,
} from "@/lib/interventions/depot-rapport-terrain";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  INTERVENTION_A1,
  INTERVENTION_B1,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_INTERNE_B,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * 9F4H2-HORS-RESEAU-HEURE-ET-REJEU — LE SERVEUR ACCEPTE UNE SAISIE FAITE HORS
 * RÉSEAU (décisions n° 107/108 d'Alexis, 14/10/2026).
 *
 * Même patron que `terminer-intervention.test.ts` : des interventions
 * JETABLES, clonées du décor de `INTERVENTION_A1`/`INTERVENTION_B1`, jamais la
 * fixture partagée elle-même.
 */

afterAll(fermerClients);

const TECHNICIEN = UTILISATEUR_PAR_ROLE[Role.technicien];
const RENFORT = UTILISATEUR_PAR_ROLE[Role.responsable_materiel];

const SESSION_TECH = {
  utilisateurId: TECHNICIEN,
  societeId: SOCIETE_A,
  role: Role.technicien,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const SESSION_RENFORT = {
  utilisateurId: RENFORT,
  societeId: SOCIETE_A,
  role: Role.responsable_materiel,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

/** R2 — une session authentique, mais d'une AUTRE société (SOCIÉTÉ B). */
const SESSION_SOCIETE_B = {
  utilisateurId: UTILISATEUR_INTERNE_B,
  societeId: SOCIETE_B,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const jetables: string[] = [];

/** Une intervention jetable, clonée du décor de `INTERVENTION_A1`. */
async function jetable(technicienId: string): Promise<string> {
  const id = uuidv7();
  jetables.push(id);
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention" ("id","societe_id","client_id","site_id","agence_id",
       "type","statut","date_planifiee","technicien_id","duree_estimee_min","modifie_le")
     SELECT '${id}', "societe_id", "client_id", "site_id", "agence_id",
            'curatif', 'planifiee', DATE '2026-09-14',
            '${technicienId}', 60, now()
       FROM "intervention" WHERE "id" = '${INTERVENTION_A1}'`,
  );
  return id;
}

/** Même chose, mais clonée du décor de `INTERVENTION_B1` (société B). */
async function jetableB(technicienId: string): Promise<string> {
  const id = uuidv7();
  jetables.push(id);
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention" ("id","societe_id","client_id","site_id","agence_id",
       "type","statut","date_planifiee","technicien_id","duree_estimee_min","modifie_le")
     SELECT '${id}', "societe_id", "client_id", "site_id", "agence_id",
            'curatif', 'planifiee', DATE '2026-09-14',
            '${technicienId}', 60, now()
       FROM "intervention" WHERE "id" = '${INTERVENTION_B1}'`,
  );
  return id;
}

async function segmentsDe(interventionId: string): Promise<
  Array<{
    id: string;
    debut: Date;
    fin: Date | null;
    saisi_hors_reseau: boolean;
    utilisateur_id: string;
  }>
> {
  return clientOwner().$queryRawUnsafe(
    `SELECT "id", "debut", "fin", "saisi_hors_reseau", "utilisateur_id"
       FROM "segment_travail" WHERE "intervention_id" = '${interventionId}'`,
  );
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

describe("le compteur en différé — l'heure de l'appareil fait foi", () => {
  it("démarrer à H, arrêter à H+30 min hors réseau : 30 min mesurées, saisi_hors_reseau=true, un rejeu ×2 ne double rien", async () => {
    const id = await jetable(TECHNICIEN);
    const H = new Date("2026-09-14T08:00:00.000Z");
    const H30 = new Date("2026-09-14T08:30:00.000Z");
    const OP_DEMARRER = uuidv7();

    const demarrage = await demarrerLeCompteur(
      SESSION_TECH,
      id,
      H,
      clientApp(),
      { instantAppareil: H, operationId: OP_DEMARRER },
    );
    expect(demarrage.accepte).toBe(true);

    const arret = await arreterLeCompteur(SESSION_TECH, H30, clientApp(), {
      instantAppareil: H30,
    });
    expect(arret.accepte).toBe(true);

    let segments = await segmentsDe(id);
    expect(segments).toHaveLength(1);
    expect(segments[0].saisi_hors_reseau).toBe(true);
    expect(segments[0].id).toBe(OP_DEMARRER);

    const [ligneApresArret] = await clientOwner().$queryRawUnsafe<
      Array<{ temps_mesure_min: number }>
    >(`SELECT "temps_mesure_min" FROM "intervention" WHERE "id" = '${id}'`);
    expect(ligneApresArret.temps_mesure_min).toBe(30);

    // ── LE REJEU — DEUX FOIS, CÔTÉ DÉMARRER ET CÔTÉ ARRÊTER ────────────────
    for (let i = 0; i < 2; i++) {
      const rejoueDemarrer = await demarrerLeCompteur(
        SESSION_TECH,
        id,
        H,
        clientApp(),
        { instantAppareil: H, operationId: OP_DEMARRER },
      );
      expect(rejoueDemarrer.accepte).toBe(true);

      const rejoueArreter = await arreterLeCompteur(
        SESSION_TECH,
        H30,
        clientApp(),
        { instantAppareil: H30 },
      );
      expect(rejoueArreter.accepte).toBe(true);
    }

    segments = await segmentsDe(id);
    expect(segments).toHaveLength(1);
    const [ligneApresRejeu] = await clientOwner().$queryRawUnsafe<
      Array<{ temps_mesure_min: number }>
    >(`SELECT "temps_mesure_min" FROM "intervention" WHERE "id" = '${id}'`);
    expect(ligneApresRejeu.temps_mesure_min).toBe(30);
  });

  it("« arrêter » ne retrouve JAMAIS le segment déjà fermé d'une AUTRE personne, même au MÊME instant (9F4H6, point 7)", async () => {
    const id = await jetable(TECHNICIEN);
    const H = new Date("2026-09-14T08:00:00.000Z");
    const H30 = new Date("2026-09-14T08:30:00.000Z");

    // LE RENFORT démarre et arrête un segment sur CETTE intervention.
    const demarrageRenfort = await demarrerLeCompteur(
      SESSION_RENFORT,
      id,
      H,
      clientApp(),
      { instantAppareil: H, operationId: uuidv7() },
    );
    expect(demarrageRenfort.accepte).toBe(true);
    const arretRenfort = await arreterLeCompteur(
      SESSION_RENFORT,
      H30,
      clientApp(),
      { instantAppareil: H30 },
    );
    expect(arretRenfort.accepte).toBe(true);

    // LE TECHNICIEN, SANS AVOIR RIEN DÉMARRÉ, tente un « arrêter » différé au
    // MÊME instant H30 — le mécanisme de rejeu (`dejaFerme`, filtré sur
    // `utilisateur_id`) ne doit RETROUVER QUE SES PROPRES segments, jamais
    // celui du renfort : sans ce filtre, ce geste serait accepté À TORT
    // comme un rejeu, alors qu'aucun compteur du technicien n'a jamais
    // tourné ici.
    const arretTechnicien = await arreterLeCompteur(
      SESSION_TECH,
      H30,
      clientApp(),
      { instantAppareil: H30 },
    );
    expect(arretTechnicien).toEqual({
      accepte: false,
      cle: "compteur.refus.aucun_en_cours",
    });

    const segments = await segmentsDe(id);
    expect(segments).toHaveLength(1);
    expect(segments[0].utilisateur_id).toBe(RENFORT);
  });

  it("refuse une heure d'appareil plus de 5 minutes dans le futur, AVEC SA CLÉ, et n'écrit rien", async () => {
    const id = await jetable(TECHNICIEN);
    const instantServeur = new Date("2026-09-14T08:00:00.000Z");
    const dansLeFutur = new Date("2026-09-14T08:10:00.000Z");

    const resultat = await demarrerLeCompteur(
      SESSION_TECH,
      id,
      instantServeur,
      clientApp(),
      { instantAppareil: dansLeFutur, operationId: uuidv7() },
    );
    expect(resultat).toEqual({
      accepte: false,
      cle: "compteur.refus.instant_futur",
    });
    expect(await segmentsDe(id)).toHaveLength(0);
  });

  it("refuse une heure d'appareil plus de 7 jours dans le passé, AVEC SA CLÉ, et n'écrit rien", async () => {
    const id = await jetable(TECHNICIEN);
    const instantServeur = new Date("2026-09-14T08:00:00.000Z");
    const tropAncien = new Date("2026-09-06T07:00:00.000Z");

    const resultat = await demarrerLeCompteur(
      SESSION_TECH,
      id,
      instantServeur,
      clientApp(),
      { instantAppareil: tropAncien, operationId: uuidv7() },
    );
    expect(resultat).toEqual({
      accepte: false,
      cle: "compteur.refus.instant_trop_ancien",
    });
    expect(await segmentsDe(id)).toHaveLength(0);
  });

  it("un operation_id qui désigne la ligne d'un AUTRE technicien (même société) est refusé, sans fuite ni écriture", async () => {
    const idRenfort = await jetable(RENFORT);
    const idTechnicien = await jetable(TECHNICIEN);
    const H = new Date("2026-09-14T08:00:00.000Z");
    const OP = uuidv7();

    const poseRenfort = await demarrerLeCompteur(
      SESSION_RENFORT,
      idRenfort,
      H,
      clientApp(),
      { instantAppareil: H, operationId: OP },
    );
    expect(poseRenfort.accepte).toBe(true);

    const tentative = await demarrerLeCompteur(
      SESSION_TECH,
      idTechnicien,
      H,
      clientApp(),
      { instantAppareil: H, operationId: OP },
    );
    expect(tentative).toEqual({
      accepte: false,
      cle: "compteur.refus.operation_invalide",
    });
    expect(await segmentsDe(idTechnicien)).toHaveLength(0);
  });

  it("un operation_id qui désigne la ligne d'une AUTRE société est refusé, sans fuite ni écriture", async () => {
    const idSocieteB = await jetableB(UTILISATEUR_INTERNE_B);
    const idTechnicien = await jetable(TECHNICIEN);
    const H = new Date("2026-09-14T08:00:00.000Z");
    const OP = uuidv7();

    const poseB = await demarrerLeCompteur(
      SESSION_SOCIETE_B,
      idSocieteB,
      H,
      clientApp(),
      { instantAppareil: H, operationId: OP },
    );
    expect(poseB.accepte).toBe(true);

    const tentative = await demarrerLeCompteur(
      SESSION_TECH,
      idTechnicien,
      H,
      clientApp(),
      { instantAppareil: H, operationId: OP },
    );
    expect(tentative).toEqual({
      accepte: false,
      cle: "compteur.refus.operation_invalide",
    });
    expect(await segmentsDe(idTechnicien)).toHaveLength(0);
  });
});

describe("terminer en différé — le rejeu n'envoie jamais un second geste", () => {
  it("ferme le segment à l'heure de l'appareil, marque saisi_hors_reseau, et un rejeu du même operation_id répond accepté sans rien réécrire", async () => {
    const id = await jetable(TECHNICIEN);
    const H8 = new Date("2026-09-14T08:00:00.000Z");
    const H845 = new Date("2026-09-14T08:45:00.000Z");
    const OP = uuidv7();

    await demarrerLeCompteur(SESSION_TECH, id, H8, clientApp());
    await enregistrerSignature(
      SESSION_TECH,
      id,
      {
        issue: "signee",
        image_base64: "data:image/png;base64,AAAA",
        signataire_nom: "Jean Dupont",
      },
      clientApp(),
    );

    const resultat = await terminerIntervention(
      SESSION_TECH,
      id,
      H845,
      clientApp(),
      { instantAppareil: H845, operationId: OP },
    );
    expect(resultat.accepte).toBe(true);
    if (resultat.accepte) {
      expect(resultat.rejoue).toBeUndefined();
    }

    const segments = await segmentsDe(id);
    expect(segments).toHaveLength(1);
    expect(segments[0].saisi_hors_reseau).toBe(true);

    const [ligne] = await clientOwner().$queryRawUnsafe<
      Array<{ statut: string; temps_mesure_min: number }>
    >(
      `SELECT "statut", "temps_mesure_min" FROM "intervention" WHERE "id" = '${id}'`,
    );
    expect(ligne.statut).toBe("terminee");
    expect(ligne.temps_mesure_min).toBe(45);

    // ── LE REJEU, MÊME operation_id ─────────────────────────────────────
    const rejoue = await terminerIntervention(
      SESSION_TECH,
      id,
      new Date("2026-09-14T09:00:00.000Z"),
      clientApp(),
      { instantAppareil: H845, operationId: OP },
    );
    expect(rejoue.accepte).toBe(true);
    if (rejoue.accepte) {
      expect(rejoue.rejoue).toBe(true);
      expect(rejoue.issueSignature).toBe("signee");
    }

    const [ligneApresRejeu] = await clientOwner().$queryRawUnsafe<
      Array<{ statut: string; temps_mesure_min: number }>
    >(
      `SELECT "statut", "temps_mesure_min" FROM "intervention" WHERE "id" = '${id}'`,
    );
    expect(ligneApresRejeu.statut).toBe("terminee");
    expect(ligneApresRejeu.temps_mesure_min).toBe(45);
    expect(await segmentsDe(id)).toHaveLength(1);
  });

  it("une intervention déjà TERMINÉE avec un operation_id DIFFÉRENT garde le refus normal du cycle de vie", async () => {
    const id = await jetable(TECHNICIEN);
    const H8 = new Date("2026-09-14T08:00:00.000Z");
    const H845 = new Date("2026-09-14T08:45:00.000Z");

    await demarrerLeCompteur(SESSION_TECH, id, H8, clientApp());
    await enregistrerSignature(
      SESSION_TECH,
      id,
      { issue: "client_absent", motif: "Client injoignable" },
      clientApp(),
    );
    const premier = await terminerIntervention(
      SESSION_TECH,
      id,
      H845,
      clientApp(),
      { instantAppareil: H845, operationId: uuidv7() },
    );
    expect(premier.accepte).toBe(true);

    const second = await terminerIntervention(
      SESSION_TECH,
      id,
      new Date("2026-09-14T09:00:00.000Z"),
      clientApp(),
      {
        instantAppareil: new Date("2026-09-14T09:00:00.000Z"),
        operationId: uuidv7(),
      },
    );
    expect(second).toEqual({
      accepte: false,
      cle: "intervention.refus.pas_en_cours",
    });
  });
});

describe("la signature — un id fabriqué par l'appareil se rejoue sans doublon", () => {
  it("un renvoi du même id répond la ligne existante, sans en créer une seconde", async () => {
    const id = await jetable(TECHNICIEN);
    const OP = uuidv7();
    const saisie = {
      issue: "signee" as const,
      image_base64: "data:image/png;base64,AAAA",
      signataire_nom: "Jean Dupont",
    };

    const premiere = await enregistrerSignature(
      SESSION_TECH,
      id,
      saisie,
      clientApp(),
      OP,
    );
    expect(premiere).toEqual({ id: OP });

    const seconde = await enregistrerSignature(
      SESSION_TECH,
      id,
      saisie,
      clientApp(),
      OP,
    );
    expect(seconde).toEqual({ id: OP });

    const [{ compte }] = await clientOwner().$queryRawUnsafe<
      Array<{ compte: bigint }>
    >(
      `SELECT COUNT(*)::bigint AS compte FROM "intervention_signature" WHERE "intervention_id" = '${id}'`,
    );
    expect(Number(compte)).toBe(1);
  });

  it("un id qui désigne la ligne d'une AUTRE intervention est refusé, sans écriture", async () => {
    const id1 = await jetable(TECHNICIEN);
    const id2 = await jetable(TECHNICIEN);
    const OP = uuidv7();

    const premiere = await enregistrerSignature(
      SESSION_TECH,
      id1,
      {
        issue: "signee",
        image_base64: "data:image/png;base64,AAAA",
        signataire_nom: "Jean Dupont",
      },
      clientApp(),
      OP,
    );
    expect(premiere).toEqual({ id: OP });

    const tentative = await enregistrerSignature(
      SESSION_TECH,
      id2,
      {
        issue: "signee",
        image_base64: "data:image/png;base64,BBBB",
        signataire_nom: "Quelqu'un d'autre",
      },
      clientApp(),
      OP,
    );
    expect(tentative).toBeNull();

    const [{ compte }] = await clientOwner().$queryRawUnsafe<
      Array<{ compte: bigint }>
    >(
      `SELECT COUNT(*)::bigint AS compte FROM "intervention_signature" WHERE "intervention_id" = '${id2}'`,
    );
    expect(Number(compte)).toBe(0);
  });
});
