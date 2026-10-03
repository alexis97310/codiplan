import { afterAll, afterEach, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import { listerPlanning } from "@/lib/interventions/depot";

import {
  clientApp,
  clientOwner,
  fermerClients,
  sousSocieteEtRole,
} from "./setup/db";
import {
  AGENCE_A,
  CLIENT_A1,
  SITE_A1_S1,
  SOCIETE_A,
  UTILISATEUR_INTERNE_A,
} from "./setup/fixtures";

/**
 * 9DD-PG-G14C-TERRAIN-TRANSMISES (D141, 14C) — LE TERRAIN NE VOIT QUE LE
 * TRANSMIS.
 *
 * **Mesuré sur `main` avant ce ticket** : `listerPlanning` ne filtrait sur
 * AUCUNE `PLANIFIEE` — une intervention encore préparée par le bureau,
 * jamais transmise au technicien (D141), restait pourtant sur « Ma
 * journée ».
 *
 * **Le paramètre `options.inclurePlanifiees` vaut `true` PAR DÉFAUT** — même
 * discipline que `inclureAnnulees` (PG-A8-ANNULEES-MASQUEES) — parce que les
 * DEUX AUTRES appelants (`/planning`, `/tableau-de-bord`) n'ont aucune
 * connaissance de ce paramètre et doivent continuer de voir exactement ce
 * qu'ils voyaient. C'est `app/(mobile)/terrain/page.tsx` qui passe
 * `inclurePlanifiees: false` EXPLICITEMENT. Ce fichier éprouve la fonction,
 * pure ; `tests/e2e/9dd-pg-g14c-terrain-transmises.spec.ts` éprouve l'écran.
 *
 * Trois lignes forgées ici (préfixe `9DD-` dans leur description, aucune
 * fixture `SCENE.*` partagée), supprimées en fin de scénario — jamais un
 * statut, une date ou un technicien écrits sur une ligne du semis partagé.
 */

const PERIODE_DU = new Date("2026-09-01T00:00:00.000Z");
const PERIODE_AU = new Date("2026-09-30T00:00:00.000Z");
const DATE_DANS_LA_FENETRE = new Date("2026-09-15T00:00:00.000Z");

const PLANIFICATEUR = {
  utilisateurId: UTILISATEUR_INTERNE_A,
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const interventionsPosees: string[] = [];

function squelette(
  id: string,
  statut: "planifiee" | "affectee",
): {
  id: string;
  societe_id: string;
  client_id: string;
  site_id: string;
  agence_id: string;
  type: "curatif";
  statut: "planifiee" | "affectee";
  date_planifiee: Date;
  // EXIGÉE par `intervention_planifiee_a_sa_duree` dès que le statut est
  // `planifiee` ou `affectee` (D104, PARCOURS-1).
  duree_estimee_min: number;
  description: string;
} {
  interventionsPosees.push(id);
  return {
    id,
    societe_id: SOCIETE_A,
    client_id: CLIENT_A1,
    site_id: SITE_A1_S1,
    agence_id: AGENCE_A,
    type: "curatif",
    statut,
    date_planifiee: DATE_DANS_LA_FENETRE,
    duree_estimee_min: 60,
    // Identifie la ligne dans un export de base, sans effet sur aucune
    // requête ni aucun décompte lu par une autre épreuve.
    description: "9DD- épreuve d'isolation, supprimée en fin de scénario",
  };
}

async function poserLesDeuxStatuts(): Promise<{
  planifiee: string;
  affectee: string;
}> {
  const planifiee = uuidv7();
  const affectee = uuidv7();
  await sousSocieteEtRole(SOCIETE_A, Role.adv, (tx) =>
    tx.intervention.create({ data: squelette(planifiee, "planifiee") }),
  );
  await sousSocieteEtRole(SOCIETE_A, Role.adv, (tx) =>
    tx.intervention.create({ data: squelette(affectee, "affectee") }),
  );
  return { planifiee, affectee };
}

afterEach(async () => {
  if (interventionsPosees.length > 0) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" IN (${interventionsPosees
        .map((id) => `'${id}'`)
        .join(",")})`,
    );
    interventionsPosees.length = 0;
  }
});

afterAll(fermerClients);

describe("9DD-PG-G14C-TERRAIN-TRANSMISES — listerPlanning", () => {
  it("TÉMOIN — sans l'option, le défaut historique reste inchangé (planning, tableau de bord)", async () => {
    const { planifiee, affectee } = await poserLesDeuxStatuts();
    const sansOption = await listerPlanning(
      PLANIFICATEUR,
      PERIODE_DU,
      PERIODE_AU,
      clientApp(),
    );
    const ids = sansOption.map((ligne) => ligne.id);
    expect(ids).toContain(planifiee);
    expect(ids).toContain(affectee);
  });

  it("inclurePlanifiees: false — ce que /terrain demande — écarte la Planifiée, garde l'Affectée", async () => {
    const { planifiee, affectee } = await poserLesDeuxStatuts();
    const masquees = await listerPlanning(
      PLANIFICATEUR,
      PERIODE_DU,
      PERIODE_AU,
      clientApp(),
      { inclurePlanifiees: false },
    );
    const ids = masquees.map((ligne) => ligne.id);
    expect(ids).not.toContain(planifiee);
    expect(ids).toContain(affectee);
  });

  it("inclurePlanifiees: true — explicite — remontre la Planifiée", async () => {
    const { planifiee, affectee } = await poserLesDeuxStatuts();
    const remontrees = await listerPlanning(
      PLANIFICATEUR,
      PERIODE_DU,
      PERIODE_AU,
      clientApp(),
      { inclurePlanifiees: true },
    );
    const ids = remontrees.map((ligne) => ligne.id);
    expect(ids).toContain(planifiee);
    expect(ids).toContain(affectee);
  });
});
