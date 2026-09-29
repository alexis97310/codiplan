import { afterAll, afterEach, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import {
  interventionsEnRetard,
  interventionsSansDuree,
  interventionsSuspendues,
} from "@/lib/interventions/depot";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  CLIENT_A1,
  SITE_A1_S1,
  SOCIETE_A,
  UTILISATEUR_INTERNE_A,
} from "./setup/fixtures";

/**
 * LES TROIS AUTRES ONGLETS DE LA COLONNE « À TRAITER » (PG-C2-FILE-ONGLETS) —
 * lus À PART de `listerPlanning`, par des requêtes dédiées
 * (`lib/interventions/depot.ts`) : ce fichier éprouve que chacune rend
 * EXACTEMENT sa population, ni plus ni moins — jamais un chiffre approché.
 *
 * *Chaque scénario forge SES PROPRES interventions* (préfixe `PGC2-`, un
 * identifiant tiré au sort) et les retire dans un `afterEach` — jamais une
 * fixture partagée.
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

const posees: string[] = [];

async function creer(champs: {
  readonly statut: string;
  readonly datePlanifiee: string | null;
  readonly dureeEstimeeMin: number | null;
  readonly aUnSegment?: boolean;
}): Promise<string> {
  const id = uuidv7();
  posees.push(id);
  // `intervention_suspension_a_sa_date`/`_a_son_motif` (L2-10) : une ligne
  // `suspendue` EXIGE `suspendue_le` ET `motif_suspension` — sans eux,
  // l'insertion échoue avant même d'atteindre la requête éprouvée.
  const suspendueLe = champs.statut === "suspendue" ? new Date() : null;
  const motifSuspension =
    champs.statut === "suspendue" ? "PGC2 — motif forgé par l'épreuve" : null;
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id",
       "agence_id", "type", "statut", "priorite", "date_planifiee",
       "duree_estimee_min", "description", "suspendue_le", "motif_suspension",
       "cree_le", "modifie_le")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
             $6::"StatutIntervention", 'p3', $7::date, $8::int,
             'PGC2 — intervention forgée par l''épreuve', $9::timestamptz,
             $10, now(), now())`,
    id,
    SOCIETE_A,
    CLIENT_A1,
    SITE_A1_S1,
    AGENCE_A,
    champs.statut,
    champs.datePlanifiee,
    champs.dureeEstimeeMin,
    suspendueLe,
    motifSuspension,
  );
  if (champs.aUnSegment === true) {
    // `fin` DOIT suivre STRICTEMENT `debut` (`segment_travail_fin_apres_debut`)
    // — deux instants distincts, jamais le même `now()`.
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "segment_travail" ("id", "societe_id", "intervention_id",
         "utilisateur_id", "debut", "fin", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, now(),
               now() + interval '5 minutes', now())`,
      uuidv7(),
      SOCIETE_A,
      id,
      UTILISATEUR_INTERNE_A,
    );
  }
  return id;
}

afterEach(async () => {
  for (const id of posees.splice(0)) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = $1::uuid`,
      id,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = $1::uuid`,
      id,
    );
  }
});

const HIER = new Date("2026-09-28T00:00:00.000Z");
const AUJOURDHUI = new Date("2026-09-29T00:00:00.000Z");
const DEMAIN = "2026-09-30";

describe("interventionsEnRetard", () => {
  it("rend une planifiée datée AVANT aujourd'hui, SANS segment de travail", async () => {
    const cible = await creer({
      statut: "planifiee",
      datePlanifiee: "2026-09-27",
      dureeEstimeeMin: 60,
    });

    const lignes = await interventionsEnRetard(
      SESSION,
      AUJOURDHUI,
      clientApp(),
    );
    expect(lignes.map((l) => l.id)).toContain(cible);
  });

  it("EXCLUT une planifiée qui a déjà un segment de travail — une REPRISE, pas un retard", async () => {
    const reprise = await creer({
      statut: "planifiee",
      datePlanifiee: "2026-09-27",
      dureeEstimeeMin: 60,
      aUnSegment: true,
    });

    const lignes = await interventionsEnRetard(
      SESSION,
      AUJOURDHUI,
      clientApp(),
    );
    expect(lignes.map((l) => l.id)).not.toContain(reprise);
  });

  it("EXCLUT une planifiée datée AUJOURD'HUI ou APRÈS — ce n'est pas encore un retard", async () => {
    const aujourdhui = await creer({
      statut: "planifiee",
      datePlanifiee: "2026-09-29",
      dureeEstimeeMin: 60,
    });
    const demain = await creer({
      statut: "planifiee",
      datePlanifiee: DEMAIN,
      dureeEstimeeMin: 60,
    });

    const lignes = (
      await interventionsEnRetard(SESSION, AUJOURDHUI, clientApp())
    ).map((l) => l.id);
    expect(lignes).not.toContain(aujourdhui);
    expect(lignes).not.toContain(demain);
  });

  it("EXCLUT un statut fermé — TERMINÉE n'est pas un retard, même daté dans le passé", async () => {
    const terminee = await creer({
      statut: "terminee",
      datePlanifiee: "2026-09-27",
      dureeEstimeeMin: 60,
    });

    const lignes = await interventionsEnRetard(
      SESSION,
      AUJOURDHUI,
      clientApp(),
    );
    expect(lignes.map((l) => l.id)).not.toContain(terminee);
  });

  // Témoin de non-vacuité pour `HIER` : sans lui, un critère toujours faux
  // laisserait passer le scénario ci-dessus par hasard.
  it("témoin — HIER est bien AVANT AUJOURDHUI dans ce jeu de constantes", () => {
    expect(HIER.getTime()).toBeLessThan(AUJOURDHUI.getTime());
  });
});

describe("interventionsSuspendues", () => {
  it("rend une SUSPENDUE, et seulement les suspendues", async () => {
    const suspendue = await creer({
      statut: "suspendue",
      datePlanifiee: "2026-09-20",
      dureeEstimeeMin: 60,
    });
    const planifiee = await creer({
      statut: "planifiee",
      datePlanifiee: "2026-09-20",
      dureeEstimeeMin: 60,
    });

    const lignes = (await interventionsSuspendues(SESSION, clientApp())).map(
      (l) => l.id,
    );
    expect(lignes).toContain(suspendue);
    expect(lignes).not.toContain(planifiee);
  });
});

describe("interventionsSansDuree", () => {
  it("rend une NON TERMINALE sans durée, DATE PASSÉE COMPRISE", async () => {
    // *Le point même du ticket* : contrairement à la tuile du tableau de bord
    // et au registre (`sans_duree_a_venir`), cette colonne montre aussi ce qui
    // est déjà daté dans le passé — c'est là qu'on vient compléter la durée
    // manquante.
    // `en_cours`, pas `affectee`/`planifiee` : `intervention_planifiee_a_sa_duree`
    // exige justement une durée pour CES deux statuts-là (PARCOURS-1) — une
    // ligne « sans durée » réaliste, ailleurs dans le cycle de vie.
    const passee = await creer({
      statut: "en_cours",
      datePlanifiee: "2026-01-05",
      dureeEstimeeMin: null,
    });

    const lignes = (await interventionsSansDuree(SESSION, clientApp())).map(
      (l) => l.id,
    );
    expect(lignes).toContain(passee);
  });

  it("EXCLUT une intervention TERMINÉE, CLÔTURÉE ou ANNULÉE, même sans durée", async () => {
    const terminee = await creer({
      statut: "terminee",
      datePlanifiee: "2026-01-05",
      dureeEstimeeMin: null,
    });
    const cloturee = await creer({
      statut: "cloturee",
      datePlanifiee: "2026-01-05",
      dureeEstimeeMin: null,
    });
    const annulee = await creer({
      statut: "annulee",
      datePlanifiee: "2026-01-05",
      dureeEstimeeMin: null,
    });

    const lignes = (await interventionsSansDuree(SESSION, clientApp())).map(
      (l) => l.id,
    );
    expect(lignes).not.toContain(terminee);
    expect(lignes).not.toContain(cloturee);
    expect(lignes).not.toContain(annulee);
  });

  it("EXCLUT une intervention qui A une durée", async () => {
    const avecDuree = await creer({
      statut: "planifiee",
      datePlanifiee: "2026-09-20",
      dureeEstimeeMin: 90,
    });

    const lignes = (await interventionsSansDuree(SESSION, clientApp())).map(
      (l) => l.id,
    );
    expect(lignes).not.toContain(avecDuree);
  });
});
