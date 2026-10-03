import { afterAll, afterEach, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import {
  instantDuJour,
  jourDe,
  jourSuivant,
  maintenant,
} from "@/lib/calendar/fuseau";
import { uuidv7 } from "@/lib/db/uuid";
import { schemaRechercheParc } from "@/lib/machines/saisie";

import { clientApp, clientOwner, fermerClients, urlApp } from "./setup/db";
import {
  AGENCE_A,
  CLIENT_A1,
  FUSEAU_SOCIETE_A,
  MACHINE_A2,
  MACHINE_A3,
  SITE_A1_S1,
  SOCIETE_A,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * POURQUOI `DATABASE_URL` EST POSÉE ICI, ET LES DEUX DÉPÔTS IMPORTÉS
 * DYNAMIQUEMENT APRÈS — même geste que `vgp-compte-tuile-registre.test.ts` :
 * `listerLeRegistre` (`lib/vgp/registre.ts`) n'accepte AUCUN client
 * explicite, à la différence de `rechercherLeParc` — elle passe toujours par
 * le client global de `lib/db/client.ts`. Un `import` STATIQUE de l'un ou
 * l'autre dépôt serait hissé avant cette ligne et construirait ce client
 * global sans `DATABASE_URL` : c'est pour la même raison que
 * `rechercherLeParc` est importée dynamiquement ici aussi, bien qu'elle
 * accepte un client explicite — elle transite par le même module.
 */
const URL_DATABASE_AVANT = process.env.DATABASE_URL;
process.env.DATABASE_URL = urlApp();
const { rechercherLeParc } = await import("@/lib/machines/depot");
const { listerLeRegistre } = await import("@/lib/vgp/registre");

/**
 * LE PARC ET LE REGISTRE VGP DU TECHNICIEN RESTREINT (QT-2, D152, A et B),
 * ÉPROUVÉS SUR LA VRAIE TABLE.
 *
 * `tests/unit/interventions/parc-du-technicien.test.ts` éprouve
 * `fragmentDuParcDuTechnicien` — la PART PURE, les bornes. Ce fichier-ci
 * éprouve que `perimetreParcDuTechnicien` (sa coquille, qui lit la base pour
 * la civile du jour) produit bien un fragment qui MORD sous la politique de
 * forme « parc » réelle — les deux branches, l'une après l'autre.
 *
 * **MACHINE_A2 et MACHINE_A3 sont choisies parce qu'AUCUNE ligne
 * `intervention_machine` du harnais partagé ne les touche** (mesuré sur
 * `tests/isolation/setup/global.ts` : seule MACHINE_A1 y est rattachée, à
 * `INTERVENTION_A1` et `INTERVENTION_A2`). Les deux branches du périmètre
 * restent donc indépendantes l'une de l'autre dans ce fichier : rien ne les
 * fait correspondre pour une autre raison que celle posée ici.
 */

afterAll(async () => {
  process.env.DATABASE_URL = URL_DATABASE_AVANT;
  await fermerClients();
});

const TECHNICIEN = UTILISATEUR_PAR_ROLE[Role.technicien] as string;
/** Un collègue — une VALEUR posée sur `technicien_id`, jamais authentifiée. */
const COLLEGUE = "aaaaaaaa-0000-7000-8000-0000000009c1";

const SESSION_TECH = {
  utilisateurId: TECHNICIEN,
  societeId: SOCIETE_A,
  role: Role.technicien,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const TOUT = schemaRechercheParc.parse({});
const AUJOURD_HUI_LOCAL = jourDe(maintenant(FUSEAU_SOCIETE_A).local);

function dateSql(decalageJours: number): string {
  return instantDuJour(jourSuivant(AUJOURD_HUI_LOCAL, decalageJours))
    .toISOString()
    .slice(0, 10);
}

const jetables: string[] = [];

async function jetableIntervention(options: {
  readonly technicienId: string | null;
  readonly decalageJours: number;
  readonly statut: "planifiee" | "annulee" | "cloturee";
}): Promise<string> {
  const id = uuidv7();
  jetables.push(id);
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention" ("id","societe_id","client_id","site_id","agence_id",
       "type","statut","date_planifiee","technicien_id","duree_estimee_min","modifie_le")
     VALUES ('${id}', '${SOCIETE_A}', '${CLIENT_A1}', '${SITE_A1_S1}', '${AGENCE_A}',
             'curatif', '${options.statut}', DATE '${dateSql(options.decalageJours)}',
             ${options.technicienId === null ? "NULL" : `'${options.technicienId}'`},
             60, now())`,
  );
  return id;
}

async function relier(
  interventionId: string,
  machineId: string,
): Promise<void> {
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention_machine" ("id","societe_id","intervention_id","machine_id","modifie_le")
     VALUES ('${uuidv7()}', '${SOCIETE_A}', '${interventionId}', '${machineId}', now())`,
  );
}

afterEach(async () => {
  for (const id of jetables.splice(0)) {
    // CASCADE sur `intervention` (schéma) : supprimer l'intervention suffit
    // à effacer la ligne `intervention_machine` qui la rattache.
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = '${id}'`,
    );
  }
});

describe("le parc — branche « clients visités sous sept jours » (choix 5, QT-2)", () => {
  it("J (aujourd'hui) : la machine du client visité est présente", async () => {
    await jetableIntervention({
      technicienId: TECHNICIEN,
      decalageJours: 0,
      statut: "planifiee",
    });
    const fiches = await rechercherLeParc(SESSION_TECH, TOUT, clientApp());
    expect(fiches.map((f) => f.id)).toContain(MACHINE_A2);
  });

  it("J+6 : encore présente", async () => {
    await jetableIntervention({
      technicienId: TECHNICIEN,
      decalageJours: 6,
      statut: "planifiee",
    });
    const fiches = await rechercherLeParc(SESSION_TECH, TOUT, clientApp());
    expect(fiches.map((f) => f.id)).toContain(MACHINE_A2);
  });

  it("J+8 : absente — hors de la fenêtre de sept jours", async () => {
    await jetableIntervention({
      technicienId: TECHNICIEN,
      decalageJours: 8,
      statut: "planifiee",
    });
    const fiches = await rechercherLeParc(SESSION_TECH, TOUT, clientApp());
    expect(fiches.map((f) => f.id)).not.toContain(MACHINE_A2);
  });

  it("une intervention assignée à un COLLÈGUE ne rend pas le client visible", async () => {
    await jetableIntervention({
      technicienId: COLLEGUE,
      decalageJours: 2,
      statut: "planifiee",
    });
    const fiches = await rechercherLeParc(SESSION_TECH, TOUT, clientApp());
    expect(fiches.map((f) => f.id)).not.toContain(MACHINE_A2);
  });

  it("une intervention ANNULÉE dans la fenêtre ne rend pas le client visible", async () => {
    await jetableIntervention({
      technicienId: TECHNICIEN,
      decalageJours: 1,
      statut: "annulee",
    });
    const fiches = await rechercherLeParc(SESSION_TECH, TOUT, clientApp());
    expect(fiches.map((f) => f.id)).not.toContain(MACHINE_A2);
  });
});

describe("le parc — branche « ses propres interventions » (choix 5, QT-2) et le registre VGP", () => {
  it("une intervention PASSÉE, non annulée, rend la machine présente — sans borne de date", async () => {
    const id = await jetableIntervention({
      technicienId: TECHNICIEN,
      decalageJours: -30,
      statut: "cloturee",
    });
    await relier(id, MACHINE_A3);
    const fiches = await rechercherLeParc(SESSION_TECH, TOUT, clientApp());
    expect(fiches.map((f) => f.id)).toContain(MACHINE_A3);

    // LE MÊME PÉRIMÈTRE GOUVERNE LE REGISTRE VGP (B) — jamais une seconde
    // écriture du critère.
    const registre = await listerLeRegistre(SESSION_TECH, new Date(), 500);
    expect(registre.map((l) => l.id)).toContain(MACHINE_A3);
  });

  it("une intervention passée mais ANNULÉE ne rend pas la machine présente", async () => {
    const id = await jetableIntervention({
      technicienId: TECHNICIEN,
      decalageJours: -30,
      statut: "annulee",
    });
    await relier(id, MACHINE_A3);
    const fiches = await rechercherLeParc(SESSION_TECH, TOUT, clientApp());
    expect(fiches.map((f) => f.id)).not.toContain(MACHINE_A3);
  });
});

describe("un rôle de bureau (accès complet) n'est pas concerné par ce périmètre", () => {
  it("rechercherLeParc d'un rôle complet voit les deux machines, sans aucun jetable posé", async () => {
    const SESSION_ADV = {
      ...SESSION_TECH,
      role: Role.adv,
    };
    const fiches = await rechercherLeParc(SESSION_ADV, TOUT, clientApp());
    const ids = fiches.map((f) => f.id);
    expect(ids).toContain(MACHINE_A2);
    expect(ids).toContain(MACHINE_A3);
  });
});
