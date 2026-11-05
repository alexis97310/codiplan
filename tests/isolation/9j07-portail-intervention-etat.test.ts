import { afterAll, describe, expect, it } from "vitest";

import {
  ficheInterventionDuParc,
  interventionsDuParc,
} from "@/app/(portail)/portail/interventions/depot";
import { type ContexteSession } from "@/lib/auth/contexte";
import { Role } from "@/lib/auth/roles";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  CLIENT_A1,
  CLIENT_A2,
  INTERVENTION_A1,
  INTERVENTION_A2,
  INTERVENTION_B1,
  PORTAIL_A2_CLIENT,
  PORTAIL_A_CLIENT,
  SITE_A1_S1,
  SOCIETE_A,
} from "./setup/fixtures";

/**
 * LE CLOISONNEMENT DE `interventionsDuParc`/`ficheInterventionDuParc`
 * (9J07-PORTAIL-INTERVENTION-ETAT, point 3) — SOUS LA VRAIE POLITIQUE, pas
 * une comparaison écrite dans le module.
 *
 * `./depot.ts` n'ajoute AUCUNE politique nouvelle : il lit sous la forme
 * « parc » (D84) que `intervention` porte déjà — société, client, périmètre
 * de sites. `INTERVENTION_A1`/`A2`/`B1` sont choisies PAR LE HARNAIS
 * (`tests/isolation/setup/fixtures.ts`) pour séparer les trois filtres :
 * `INTERVENTION_A1` est du client A1 sur le site du périmètre (`SITE_A1_S1`) ;
 * `INTERVENTION_A2` est du MÊME client sur `SITE_A1_S2`, HORS du périmètre du
 * compte `PORTAIL_A_CLIENT` ; `INTERVENTION_B1` est d'une autre société.
 *
 * Même nuance que 9J06 : une fuite par id direct est distincte d'une fuite
 * par liste, et les deux se mesurent séparément ici.
 */
function contextePortailA1(): ContexteSession {
  return {
    utilisateurId: PORTAIL_A_CLIENT,
    societeId: SOCIETE_A,
    role: Role.client,
    secondFacteurValide: true,
    adresseIp: null,
    clientId: CLIENT_A1,
  };
}

afterAll(fermerClients);

describe("interventionsDuParc — ce qu'il ouvre et ce qu'il tait, PAR LISTE", () => {
  it("le compte portail lit SON intervention, dans SON périmètre de sites, jamais celle d'un autre site du même client", async () => {
    const interventions = await interventionsDuParc(
      contextePortailA1(),
      clientApp(),
    );
    const identifiants = interventions.map((i) => i.id);
    expect(identifiants).toContain(INTERVENTION_A1);
    // INTERVENTION_A2 est du MÊME client mais hors du périmètre de sites de ce
    // compte (SITE_A1_S2) : la forme « parc » doit la taire ICI MÊME, en liste.
    expect(identifiants).not.toContain(INTERVENTION_A2);
    expect(identifiants).not.toContain(INTERVENTION_B1);
  });

  it("un compte portail d'un AUTRE client de la même société ne voit AUCUNE intervention du client A1", async () => {
    const interventions = await interventionsDuParc(
      {
        utilisateurId: PORTAIL_A2_CLIENT,
        societeId: SOCIETE_A,
        role: Role.client,
        secondFacteurValide: true,
        adresseIp: null,
        clientId: CLIENT_A2,
      },
      clientApp(),
    );
    const identifiants = interventions.map((i) => i.id);
    expect(identifiants).not.toContain(INTERVENTION_A1);
    expect(identifiants).not.toContain(INTERVENTION_A2);
  });
});

describe("ficheInterventionDuParc — ce qu'il ouvre, PAR ID DIRECT", () => {
  it("le compte portail lit la fiche de SON intervention, dans SON périmètre", async () => {
    const fiche = await ficheInterventionDuParc(
      contextePortailA1(),
      INTERVENTION_A1,
      clientApp(),
    );
    expect(fiche?.id).toBe(INTERVENTION_A1);
    expect(fiche?.siteId).toBe(SITE_A1_S1);
  });
});

describe("ficheInterventionDuParc — ce qu'il REFUSE, PAR ID DIRECT", () => {
  it("une intervention du MÊME client mais HORS du périmètre de sites : `null`", async () => {
    // INTERVENTION_A2 est du client A1, sur SITE_A1_S2 — hors du périmètre du
    // compte PORTAIL_A_CLIENT, restreint à SITE_A1_S1. Absente de la LISTE ne
    // suffit pas à montrer qu'elle reste invisible par id direct.
    const fiche = await ficheInterventionDuParc(
      contextePortailA1(),
      INTERVENTION_A2,
      clientApp(),
    );
    expect(fiche).toBeNull();
    // TÉMOIN — la ligne EXISTE : sans lui, `null` prouverait seulement
    // qu'aucune intervention ne porte cet identifiant.
    const [existe] = await clientOwner().$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM "intervention" WHERE "id" = $1::uuid`,
      INTERVENTION_A2,
    );
    expect(existe?.n).toBe(1);
  });

  it("une intervention d'un AUTRE client de la MÊME société : `null`", async () => {
    const fiche = await ficheInterventionDuParc(
      {
        utilisateurId: PORTAIL_A2_CLIENT,
        societeId: SOCIETE_A,
        role: Role.client,
        secondFacteurValide: true,
        adresseIp: null,
        clientId: CLIENT_A2,
      },
      INTERVENTION_A1,
      clientApp(),
    );
    expect(fiche).toBeNull();
  });

  it("une intervention d'une AUTRE société : `null`", async () => {
    const fiche = await ficheInterventionDuParc(
      contextePortailA1(),
      INTERVENTION_B1,
      clientApp(),
    );
    expect(fiche).toBeNull();
    const [existe] = await clientOwner().$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM "intervention" WHERE "id" = $1::uuid`,
      INTERVENTION_B1,
    );
    expect(existe?.n).toBe(1);
  });

  it("une désignation de client qui n'est PAS la sienne LÈVE — elle ne rend pas `null`", async () => {
    // Même garde que `parcDuClient` (D70) : une désignation refusée
    // INTERROMPT, elle ne se confond pas avec « hors périmètre ».
    await expect(
      ficheInterventionDuParc(
        {
          utilisateurId: PORTAIL_A_CLIENT,
          societeId: SOCIETE_A,
          role: Role.client,
          secondFacteurValide: true,
          adresseIp: null,
          clientId: CLIENT_A2,
        },
        INTERVENTION_A1,
        clientApp(),
      ),
    ).rejects.toThrow();
  });
});
