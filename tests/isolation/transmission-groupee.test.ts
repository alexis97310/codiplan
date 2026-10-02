import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import {
  listerPlanifieesATransmettre,
  transmettreEnGroupe,
  transmettreIntervention,
} from "@/lib/interventions/depot";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  AGENCE_B,
  CLIENT_A1,
  CLIENT_B1,
  SITE_A1_S1,
  SITE_B1_S1,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_INTERNE_A,
  UTILISATEUR_INTERNE_B,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * 9CP-PG-G14B-TRANSMETTRE-GROUPE — LE TRI PRÊT/LAISSÉE ET LA TRANSMISSION
 * GROUPÉE NE TRAVERSENT JAMAIS LES SOCIÉTÉS, ET UN REFUS AU MILIEU N'ANNULE
 * PAS LES AUTRES.
 *
 * Même modèle que `deplanifiee-cloisonnement.test.ts` : des lignes FORGÉES
 * par ce fichier, jamais `SCENE.*`, deux sociétés avec le MÊME `technicien_id`
 * (I10 : l'identité n'est pas cloisonnée, seul le rattachement l'est).
 */

afterAll(fermerClients);

const TECHNICIEN = UTILISATEUR_PAR_ROLE[Role.technicien];

const SESSION_A = {
  utilisateurId: UTILISATEUR_INTERNE_A,
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const SESSION_B = {
  utilisateurId: UTILISATEUR_INTERNE_B,
  societeId: SOCIETE_B,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const JOUR_SQL = "2026-11-09";
const JOUR = { annee: 2026, mois: 11, jour: 9 };
const AUTRE_JOUR_SQL = "2026-11-16";
const CRENEAU = new Date("2026-11-09T08:00:00.000Z");

type Ligne = {
  readonly id: string;
  readonly societeId: string;
  readonly clientId: string;
  readonly siteId: string;
  readonly agenceId: string;
  readonly statut: "planifiee" | "affectee";
  readonly datePlanifiee: string | null;
  readonly technicienId: string | null;
  readonly creneauDebut: Date | null;
  readonly dureeEstimeeMin: number | null;
};

async function poser(ligne: Ligne): Promise<void> {
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id",
       "agence_id", "type", "statut", "technicien_id", "date_planifiee",
       "creneau_debut", "duree_estimee_min", "modifie_le")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
             $6::"StatutIntervention", $7::uuid, $8::date, $9::timestamptz,
             $10::int, now())`,
    ligne.id,
    ligne.societeId,
    ligne.clientId,
    ligne.siteId,
    ligne.agenceId,
    ligne.statut,
    ligne.technicienId,
    ligne.datePlanifiee,
    ligne.creneauDebut,
    ligne.dureeEstimeeMin,
  );
}

async function lireStatut(id: string): Promise<string> {
  const [ligne] = await clientOwner().$queryRawUnsafe<
    Array<{ statut: string }>
  >(`SELECT "statut" FROM "intervention" WHERE "id" = $1::uuid`, id);
  return ligne.statut;
}

let preteA = "";
let laisseeA = "";
let preteAutreJourA = "";
let dejaAffecteeA = "";
let preteB = "";

beforeEach(async () => {
  preteA = uuidv7();
  laisseeA = uuidv7();
  preteAutreJourA = uuidv7();
  dejaAffecteeA = uuidv7();
  preteB = uuidv7();

  await poser({
    id: preteA,
    societeId: SOCIETE_A,
    clientId: CLIENT_A1,
    siteId: SITE_A1_S1,
    agenceId: AGENCE_A,
    statut: "planifiee",
    datePlanifiee: JOUR_SQL,
    technicienId: TECHNICIEN,
    creneauDebut: CRENEAU,
    dureeEstimeeMin: 60,
  });
  // LAISSÉE — sans technicien ET sans heure, deux motifs à la fois.
  //
  // JAMAIS « sans durée » ici : `intervention_planifiee_a_sa_duree` est
  // `NOT VALID` sur l'EXISTANT (D104), mais elle reste vérifiée sur toute
  // ligne ÉCRITE — une Planifiée sans durée ne peut plus se forger
  // fraîchement, seulement se trouver parmi des lignes antérieures à la
  // contrainte (même raison que `planning-file-a-traiter.test.ts`, qui
  // emploie `en_cours` pour le même motif). Ce troisième manque reste
  // couvert, lui, par `motifsNonTransmissible` en test UNITAIRE pur.
  await poser({
    id: laisseeA,
    societeId: SOCIETE_A,
    clientId: CLIENT_A1,
    siteId: SITE_A1_S1,
    agenceId: AGENCE_A,
    statut: "planifiee",
    datePlanifiee: JOUR_SQL,
    technicienId: null,
    creneauDebut: null,
    dureeEstimeeMin: 60,
  });
  // PRÊTE, mais un AUTRE jour — pour distinguer le filtre « jour » de « toutes ».
  await poser({
    id: preteAutreJourA,
    societeId: SOCIETE_A,
    clientId: CLIENT_A1,
    siteId: SITE_A1_S1,
    agenceId: AGENCE_A,
    statut: "planifiee",
    datePlanifiee: AUTRE_JOUR_SQL,
    technicienId: TECHNICIEN,
    creneauDebut: new Date("2026-11-16T08:00:00.000Z"),
    dureeEstimeeMin: 60,
  });
  // DÉJÀ AFFECTÉE — jamais rendue par `listerPlanifieesATransmettre`, et
  // refusée (nommée) si on force sa transmission malgré tout.
  await poser({
    id: dejaAffecteeA,
    societeId: SOCIETE_A,
    clientId: CLIENT_A1,
    siteId: SITE_A1_S1,
    agenceId: AGENCE_A,
    statut: "affectee",
    datePlanifiee: JOUR_SQL,
    technicienId: TECHNICIEN,
    creneauDebut: CRENEAU,
    dureeEstimeeMin: 60,
  });
  // UNE AUTRE SOCIÉTÉ, MÊME JOUR, MÊME technicien_id (I10) — le témoin de
  // cloisonnement.
  await poser({
    id: preteB,
    societeId: SOCIETE_B,
    clientId: CLIENT_B1,
    siteId: SITE_B1_S1,
    agenceId: AGENCE_B,
    statut: "planifiee",
    datePlanifiee: JOUR_SQL,
    technicienId: TECHNICIEN,
    creneauDebut: CRENEAU,
    dureeEstimeeMin: 60,
  });
});

afterEach(async () => {
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "intervention" WHERE "id" IN ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid)`,
    preteA,
    laisseeA,
    preteAutreJourA,
    dejaAffecteeA,
    preteB,
  );
});

describe("listerPlanifieesATransmettre — le tri pret/laissée, cloisonné", () => {
  it("avec un jour : ne rend que les Planifiées de CE jour, de CETTE société", async () => {
    const { pretes, laissees } = await listerPlanifieesATransmettre(
      SESSION_A,
      { jour: JOUR },
      clientApp(),
    );

    expect(pretes.map((p) => p.id)).toEqual([preteA]);
    expect(laissees.map((l) => l.id)).toEqual([laisseeA]);
    expect(laissees[0].motifs).toEqual(["sans_technicien", "sans_heure"]);
  });

  it("sans jour (« toutes ») : les Planifiées prêtes de la société, tous jours confondus", async () => {
    // `toContain`, jamais une égalité stricte : SOCIETE_A porte déjà des
    // fixtures globales « planifiee » (`INTERVENTION_A1`/`A2`,
    // `tests/isolation/setup/fixtures.ts`) que ce test ne possède pas et ne
    // doit pas prétendre nommer en entier — seules SES PROPRES lignes sont
    // ici affirmées.
    const { pretes, laissees } = await listerPlanifieesATransmettre(
      SESSION_A,
      {},
      clientApp(),
    );
    const idsPretes = pretes.map((p) => p.id);

    expect(idsPretes).toContain(preteA);
    expect(idsPretes).toContain(preteAutreJourA);
    expect(laissees.map((l) => l.id)).toContain(laisseeA);
    // Ni la déjà-Affectée (pas « planifiee ») ni la ligne de SOCIETE_B.
    expect(pretes.some((p) => p.id === dejaAffecteeA)).toBe(false);
    expect(pretes.some((p) => p.id === preteB)).toBe(false);
  });

  it("une LAISSÉE n'est jamais écrite — son statut reste « planifiee »", async () => {
    await listerPlanifieesATransmettre(SESSION_A, { jour: JOUR }, clientApp());
    expect(await lireStatut(laisseeA)).toBe("planifiee");
  });

  it("TÉMOIN — la société B voit SA prête, pas celle de A", async () => {
    const { pretes } = await listerPlanifieesATransmettre(
      SESSION_B,
      { jour: JOUR },
      clientApp(),
    );
    expect(pretes.map((p) => p.id)).toEqual([preteB]);
  });

  it("avec aPartirDe (décision d'Alexis du 02/10/2026, point 7, D141) : une Planifiée avant la borne est laissée « date_passee », celle qui l'égale part", async () => {
    const { pretes, laissees } = await listerPlanifieesATransmettre(
      SESSION_A,
      { aPartirDe: new Date(`${AUTRE_JOUR_SQL}T00:00:00.000Z`) },
      clientApp(),
    );
    const idsPretes = pretes.map((p) => p.id);

    expect(idsPretes).toContain(preteAutreJourA);
    expect(idsPretes).not.toContain(preteA);
    const laisseeDatePassee = laissees.find((l) => l.id === preteA);
    expect(laisseeDatePassee?.motifs).toEqual(["date_passee"]);
  });
});

describe("transmettreEnGroupe — un refus au milieu n'annule pas les autres", () => {
  it("transmet les deux valides, nomme le refus de la ligne déjà Affectée, entre les deux", async () => {
    const { transmises, refusees } = await transmettreEnGroupe(
      SESSION_A,
      [preteA, dejaAffecteeA, preteAutreJourA],
      clientApp(),
    );

    expect(transmises).toEqual([preteA, preteAutreJourA]);
    expect(refusees).toEqual([
      { id: dejaAffecteeA, cle: "intervention.refus.pas_planifiee" },
    ]);
    expect(await lireStatut(preteA)).toBe("affectee");
    expect(await lireStatut(preteAutreJourA)).toBe("affectee");
  });

  it("cloisonnement : la société A ne peut pas transmettre la ligne de la société B", async () => {
    const { transmises, refusees } = await transmettreEnGroupe(
      SESSION_A,
      [preteB],
      clientApp(),
    );

    expect(transmises).toEqual([]);
    expect(refusees).toEqual([
      { id: preteB, cle: "intervention.refus.inconnue" },
    ]);
    expect(await lireStatut(preteB)).toBe("planifiee");
  });

  it("TÉMOIN — la société B transmet bien SA ligne par le même mécanisme", async () => {
    const { transmises, refusees } = await transmettreEnGroupe(
      SESSION_B,
      [preteB],
      clientApp(),
    );

    expect(transmises).toEqual([preteB]);
    expect(refusees).toEqual([]);
    expect(await lireStatut(preteB)).toBe("affectee");
  });
});

describe("transmettreIntervention — sans doublon sous CONCURRENCE (9CT-RETOUCHES-5)", () => {
  it("deux transmissions concurrentes de la même ligne : une acceptée, une refusée, jamais les deux", async () => {
    const [resultat1, resultat2] = await Promise.all([
      transmettreIntervention(SESSION_A, preteA, clientApp()),
      transmettreIntervention(SESSION_A, preteA, clientApp()),
    ]);

    const acceptes = [resultat1, resultat2].filter((r) => r.accepte);
    const refuses = [resultat1, resultat2].filter((r) => !r.accepte);
    expect(acceptes).toHaveLength(1);
    expect(refuses).toHaveLength(1);
    expect(refuses[0].accepte === false && refuses[0].cle).toBe(
      "intervention.refus.pas_planifiee",
    );
    expect(await lireStatut(preteA)).toBe("affectee");
  });
});
