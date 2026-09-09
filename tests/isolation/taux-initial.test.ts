import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { cleJour, jourDe, lireFuseau, maintenant } from "@/lib/calendar/fuseau";
import { avecContexteRls } from "@/lib/db/rls";
import { uuidv7 } from "@/lib/db/uuid";
import { tauxEnVigueur } from "@/lib/tarification/taux-horaire";
import {
  poserTauxInitial,
  RefusTauxInitial,
} from "@/lib/tarification/taux-initial";

import {
  clientApp,
  clientOwner,
  fermerClients,
  observerSousProprietaire,
} from "./setup/db";
import { SOCIETE_A, SOCIETE_B } from "./setup/fixtures";

/**
 * LE PREMIER TAUX HORAIRE — geste séparé de l'amorçage (09/09/2026 ; D68).
 *
 * Ce qu'on éprouve : le geste écrit UNE ligne dans la devise de la société, à
 * la date fournie ou au jour courant dans le fuseau de la société ; il refuse
 * dès que la société porte un taux — refus mesuré APRÈS un succès, sur la
 * même société, jamais sur une société fabriquée à part ; et son jumeau
 * retire ce que le cliquet lit (la ligne) pour montrer le geste repasser.
 */

const FUSEAU_NOUMEA = "Pacific/Noumea";

/** Une société créée pour la date par défaut, dans un fuseau connu. */
const SOCIETE_DU_JOUR = uuidv7();

function lire(societeId: string, aLaDate: string) {
  return avecContexteRls(
    clientApp(),
    { societeId, role: Role.direction },
    (tx) => tauxEnVigueur(tx, new Date(aLaDate)),
  );
}

beforeAll(async () => {
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "societe" (id, code, raison_sociale, pays, territoire,
       fuseau_horaire, devise_code, majoration_hors_ouverture_pct, langue, actif)
     VALUES ($1::uuid, $2, $3, 'NC', 'NC', $4, 'XPF', 0, 'fr', true)`,
    SOCIETE_DU_JOUR,
    `TAUX-${SOCIETE_DU_JOUR.slice(0, 8)}`,
    "Société du jour",
    FUSEAU_NOUMEA,
  );
});

afterAll(async () => {
  await clientOwner().$executeRawUnsafe(`DELETE FROM "taux_horaire"`);
  await fermerClients();
});

describe("le premier taux d'une société", () => {
  it("TÉMOIN — la table naît vide pour A et pour B", async () => {
    const [n] = await observerSousProprietaire(
      "le décompte TOTAL de la table n'est pas atteignable sous le rôle " +
        "applicatif ; il prouve que la suite part bien d'une table vide.",
    ).$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM "taux_horaire"`,
    );
    expect(n?.n).toBe(0);
  });

  it("écrit UNE ligne, dans la devise de la société, à la date fournie", async () => {
    const pose = await poserTauxInitial(clientApp(), {
      societeId: SOCIETE_A,
      montantMineur: BigInt(7000),
      dateEffet: "2026-10-01",
    });
    expect(pose.dateEffet).toBe("2026-10-01");
    expect(pose.taux.valeur).toBe(BigInt(7000));
    expect(pose.taux.devise).toBe("XPF");
    expect(pose.devise.decimales).toBe(0);

    // RG-TAR-04 : le jour même de la date d'effet, le taux s'applique ; la
    // veille, il n'y a PAS de taux — et surtout pas zéro.
    expect((await lire(SOCIETE_A, "2026-10-01"))?.taux.valeur).toBe(
      BigInt(7000),
    );
    expect(await lire(SOCIETE_A, "2026-09-30")).toBeNull();
  });

  it("le second appel sur la MÊME société est refusé, lisiblement", async () => {
    await expect(
      poserTauxInitial(clientApp(), {
        societeId: SOCIETE_A,
        montantMineur: BigInt(7500),
        dateEffet: "2026-11-01",
      }),
    ).rejects.toThrow(/porte déjà un taux horaire/);
    // Et rien n'a été écrit : le taux de novembre n'existe pas.
    expect((await lire(SOCIETE_A, "2026-11-15"))?.taux.valeur).toBe(
      BigInt(7000),
    );
  });

  it("B n'est pas concernée par le refus de A — et pose le sien, dans SA devise", async () => {
    // TÉMOIN DE NON-VACUITÉ : le refus de A ne venait pas d'une table pleine
    // mais des lignes de A, que B ne voit pas.
    expect(await lire(SOCIETE_B, "2026-12-01")).toBeNull();
    const pose = await poserTauxInitial(clientApp(), {
      societeId: SOCIETE_B,
      montantMineur: BigInt(6500),
      dateEffet: "2026-10-01",
    });
    expect(pose.taux.devise).toBe("EUR");
    expect(pose.devise.decimales).toBe(2);
    expect((await lire(SOCIETE_B, "2026-12-01"))?.taux.valeur).toBe(
      BigInt(6500),
    );
  });

  it("sans date, c'est le jour courant DANS LE FUSEAU DE LA SOCIÉTÉ", async () => {
    const attendu = cleJour(
      jourDe(maintenant(lireFuseau(FUSEAU_NOUMEA)).local),
    );
    const pose = await poserTauxInitial(clientApp(), {
      societeId: SOCIETE_DU_JOUR,
      montantMineur: BigInt(7000),
    });
    expect(pose.dateEffet).toBe(attendu);
  });

  it("refuse un montant nul, une date mal formée, une société inconnue — sans rien écrire", async () => {
    await expect(
      poserTauxInitial(clientApp(), {
        societeId: SOCIETE_B,
        montantMineur: BigInt(0),
      }),
    ).rejects.toBeInstanceOf(RefusTauxInitial);
    await expect(
      poserTauxInitial(clientApp(), {
        societeId: uuidv7(),
        montantMineur: BigInt(7000),
      }),
    ).rejects.toBeInstanceOf(RefusTauxInitial);
    await expect(
      poserTauxInitial(clientApp(), {
        societeId: uuidv7(),
        montantMineur: BigInt(7000),
        dateEffet: "01/10/2026",
      }),
    ).rejects.toThrow();
  });

  it("JUMEAU — la ligne retirée, le geste REPASSE ; rendue, le refus revient", async () => {
    // Ce que le cliquet lit est la table elle-même : on retire la ligne de A
    // sous le propriétaire, le geste passe ; on la retrouve ensuite (le geste
    // vient de la réécrire), et le refus revient. C'est la preuve que c'est
    // bien ce fait-là qui gouverne, et pas un voisin.
    const retirees = await clientOwner().$executeRawUnsafe(
      `DELETE FROM "taux_horaire" WHERE societe_id = $1::uuid`,
      SOCIETE_A,
    );
    expect(retirees).toBe(1);

    const pose = await poserTauxInitial(clientApp(), {
      societeId: SOCIETE_A,
      montantMineur: BigInt(7000),
      dateEffet: "2026-10-01",
    });
    expect(pose.taux.valeur).toBe(BigInt(7000));

    await expect(
      poserTauxInitial(clientApp(), {
        societeId: SOCIETE_A,
        montantMineur: BigInt(7000),
        dateEffet: "2026-10-01",
      }),
    ).rejects.toBeInstanceOf(RefusTauxInitial);
  });
});
