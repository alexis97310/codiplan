import { afterAll, describe, expect, it } from "vitest";

import { type ContexteSession } from "@/lib/auth/contexte";
import { Role } from "@/lib/auth/roles";
import { ficheMachineDuParc } from "@/lib/portail/depot";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  CLIENT_A1,
  CLIENT_A2,
  MACHINE_A1,
  MACHINE_A2,
  MACHINE_B1,
  PORTAIL_A2_CLIENT,
  PORTAIL_A_CLIENT,
  SITE_A1_S1,
  SOCIETE_A,
} from "./setup/fixtures";

/**
 * LE CLOISONNEMENT DE `ficheMachineDuParc` (9J06-PORTAIL-FICHE-MACHINE, point
 * 4) — SOUS LA VRAIE POLITIQUE, pas une comparaison écrite dans le module.
 *
 * `lib/portail/depot.ts` n'ajoute AUCUNE politique nouvelle : la fiche lit
 * sous la forme « parc » que `machine` et `site` portent déjà, éprouvée en
 * LISTE par `tests/isolation/portail-client.test.ts`. Ce fichier-ci éprouve
 * la MÊME politique mais traversée par UNE LECTURE PAR ID — la nuance que le
 * ticket nomme explicitement : *une fuite par id direct est distincte d'une
 * fuite par liste*. Un id ne figurant dans AUCUNE liste pourrait malgré tout
 * rester lisible si l'implémentation oubliait un filtre qu'une LISTE, elle,
 * applique par construction (un `WHERE` supplémentaire, par exemple) — c'est
 * exactement ce qu'une lecture par id doit démontrer par elle-même.
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

describe("ficheMachineDuParc — ce qu'il ouvre", () => {
  it("le compte portail lit la fiche de SA machine, dans SON périmètre", async () => {
    const fiche = await ficheMachineDuParc(
      contextePortailA1(),
      MACHINE_A1,
      clientApp(),
    );
    expect(fiche?.machine.id).toBe(MACHINE_A1);
    expect(fiche?.site.id).toBe(SITE_A1_S1);
  });
});

describe("ficheMachineDuParc — ce qu'il REFUSE, PAR ID DIRECT", () => {
  it("une machine du MÊME client mais HORS du périmètre de sites : `null`", async () => {
    // MACHINE_A2 est du client A1, sur SITE_A1_S2 — hors du périmètre du
    // compte PORTAIL_A_CLIENT, restreint à SITE_A1_S1. Absente de la LISTE
    // (`tests/isolation/portail-client.test.ts`) ne suffit pas à montrer
    // qu'elle reste invisible par id direct : c'est ce que ce scénario mesure.
    const fiche = await ficheMachineDuParc(
      contextePortailA1(),
      MACHINE_A2,
      clientApp(),
    );
    expect(fiche).toBeNull();
    // TÉMOIN — la ligne EXISTE : sans lui, `null` prouverait seulement
    // qu'aucune machine ne porte cet identifiant.
    const [existe] = await clientOwner().$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM "machine" WHERE "id" = $1::uuid`,
      MACHINE_A2,
    );
    expect(existe?.n).toBe(1);
  });

  it("une machine d'un AUTRE client de la MÊME société : `null`", async () => {
    // MACHINE_A1 est du client A1, sur SITE_A1_S1 — un site qui, PAR
    // CONSTRUCTION, ne peut jamais figurer dans le périmètre du compte du
    // client A2 (`site.client_id` lie un site à un seul client). Le compte
    // PORTAIL_A2_CLIENT ne le voit donc à aucun prix, et ce scénario le
    // montre plutôt que de le supposer.
    const fiche = await ficheMachineDuParc(
      {
        utilisateurId: PORTAIL_A2_CLIENT,
        societeId: SOCIETE_A,
        role: Role.client,
        secondFacteurValide: true,
        adresseIp: null,
        clientId: CLIENT_A2,
      },
      MACHINE_A1,
      clientApp(),
    );
    expect(fiche).toBeNull();
  });

  it("une machine d'une AUTRE société : `null`", async () => {
    const fiche = await ficheMachineDuParc(
      contextePortailA1(),
      MACHINE_B1,
      clientApp(),
    );
    expect(fiche).toBeNull();
    const [existe] = await clientOwner().$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM "machine" WHERE "id" = $1::uuid`,
      MACHINE_B1,
    );
    expect(existe?.n).toBe(1);
  });

  it("une désignation de client qui n'est PAS la sienne LÈVE — elle ne rend pas `null`", async () => {
    // Même garde que `parcDuClient` (D70) : une désignation refusée
    // INTERROMPT, elle ne se confond pas avec « hors périmètre ».
    await expect(
      ficheMachineDuParc(
        {
          utilisateurId: PORTAIL_A_CLIENT,
          societeId: SOCIETE_A,
          role: Role.client,
          secondFacteurValide: true,
          adresseIp: null,
          clientId: CLIENT_A2,
        },
        MACHINE_A1,
        clientApp(),
      ),
    ).rejects.toThrow();
  });
});
