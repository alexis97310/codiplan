import { afterAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { avecContexteRls } from "@/lib/db/rls";
import { uuidv7 } from "@/lib/db/uuid";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  FAMILLE_A,
  FAMILLE_B,
  ROLE_APP,
  SOCIETE_A,
  SOCIETE_B,
} from "./setup/fixtures";

/** Sortie forcée d'une transaction de jumeau : le `ROLLBACK` défait le DDL. */
class Annulation extends Error {}

/**
 * LE CATALOGUE DE FORFAITS (ticket L1-06, RG-TAR-06).
 *
 * La table naît VIDE — quels forfaits mettre au catalogue et à quels montants
 * est une question d'exploitation. Ce qui s'éprouve ici est donc le CONTENANT :
 * le cloisonnement par société (forme « société »), l'unicité du code, la devise
 * qui suit la société, et le chaînage composite vers la famille — celui qui
 * empêche un forfait de se conditionner à la famille d'une AUTRE société.
 */

type Options = {
  readonly code?: string;
  readonly familleId?: string | null;
  readonly devise?: string;
  readonly montant?: number;
  readonly zones?: string[] | null;
};

function poser(societeId: string, options: Options = {}): Promise<unknown> {
  const {
    code = "DEP",
    familleId = null,
    devise = "XPF",
    montant = 12000,
    zones = null,
  } = options;
  return avecContexteRls(
    clientApp(),
    { societeId, role: Role.direction },
    (tx) =>
      tx.$executeRawUnsafe(
        `INSERT INTO "forfait"
           ("id","societe_id","code","libelle","type","montant_mineur",
            "devise_code","famille_id","zone_geo","cumulable_temps")
         VALUES ($1::uuid, $2::uuid, $3, $3, 'deplacement', $4::bigint,
                 $5, $6::uuid, $7::text[], false)`,
        uuidv7(),
        societeId,
        code,
        montant,
        devise,
        familleId,
        zones,
      ),
  );
}

function compter(societeId: string): Promise<number> {
  return avecContexteRls(
    clientApp(),
    { societeId, role: Role.direction },
    async (tx) => {
      const [ligne] = await tx.$queryRawUnsafe<{ n: bigint }[]>(
        `SELECT count(*) AS n FROM "forfait"`,
      );
      return Number(ligne?.n ?? 0);
    },
  );
}

afterAll(async () => {
  await clientOwner().$executeRawUnsafe(`DELETE FROM "forfait"`);
  await fermerClients();
});

describe("le catalogue est propre à chaque société — forme « société »", () => {
  it("B ne voit pas le catalogue de A, et A voit le sien", async () => {
    await poser(SOCIETE_A, { code: "DEP-SUD" });

    expect(await compter(SOCIETE_A)).toBe(1);
    expect(
      await compter(SOCIETE_B),
      "un forfait est un prix de vente : le lire depuis une autre société " +
        "donnerait son tarif à un concurrent hébergé sur la même plateforme.",
    ).toBe(0);

    // TÉMOIN DE NON-VACUITÉ : B écrit bien LE SIEN, dans SA devise.
    await poser(SOCIETE_B, { code: "DEP-SUD", devise: "EUR" });
    expect(await compter(SOCIETE_B)).toBe(1);
  });

  it("le MÊME code existe des deux côtés — l'unicité est par société", async () => {
    // Mesuré par le scénario ci-dessus : `DEP-SUD` chez A et chez B.
    const [ligne] = await clientOwner().$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM "forfait" WHERE "code" = 'DEP-SUD'`,
    );
    expect(Number(ligne?.n)).toBe(2);
  });

  it("mais deux fois le même code DANS une société est refusé", async () => {
    const message = await poser(SOCIETE_A, { code: "DEP-SUD" }).then(
      () => "AUCUN REFUS",
      (e: unknown) => String((e as Error).message),
    );
    // Prisma efface le nom de la contrainte sur une violation d'unicité en
    // requête brute (mesuré à L1-07) : l'assertion s'assied sur le SQLSTATE, et
    // le jumeau ci-dessous nomme le verrou en le retirant.
    expect(message).toContain("23505");
  });

  it("écrire chez une AUTRE société est refusé — par le DÉCLENCHEUR d'abord", async () => {
    // ── CE QUI REFUSE N'EST PAS CE QU'ON CROYAIT, ET C'EST MESURÉ ────────
    //
    // L'intention était d'éprouver le `WITH CHECK` de la forme « société ». Le
    // refus vient d'ailleurs : le déclencheur de devise est un `BEFORE`, il
    // s'exécute AVANT que la politique ne juge la ligne, et sous le contexte de
    // A il ne peut pas lire la société B — donc il refuse. C'est le voisin qui
    // échoue à la place du verrou visé (§9, 24/08), et le nommer « politique »
    // aurait fait passer un refus pour un autre.
    //
    // Le refus est réel et il vient bien du cloisonnement — le déclencheur ne
    // voit pas B PARCE QUE la politique de `societe` le lui interdit. Mais c'est
    // une seconde garantie, pas celle qu'on annonçait : le scénario suivant va
    // chercher le `WITH CHECK` derrière lui.
    await expect(
      avecContexteRls(
        clientApp(),
        { societeId: SOCIETE_A, role: Role.direction },
        (tx) =>
          tx.$executeRawUnsafe(
            `INSERT INTO "forfait"
               ("id","societe_id","code","libelle","type","montant_mineur",
                "devise_code","cumulable_temps")
             VALUES ($1::uuid, $2::uuid, 'INTRUS', 'Intrus', 'controle', 1,
                     'EUR', false)`,
            uuidv7(),
            SOCIETE_B,
          ),
      ),
    ).rejects.toThrow(/lire la devise de la société/);
  });

  it("et le `WITH CHECK` refuse LUI AUSSI, une fois le déclencheur ôté", async () => {
    // La garantie est donc exigée DEUX fois. Sans cette mesure, on ne saurait
    // pas si la politique d'écriture mord : le déclencheur l'aurait toujours
    // devancée, et une politique sans `WITH CHECK` serait passée inaperçue.
    const message = await clientOwner()
      .$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `DROP TRIGGER "forfait_devise_de_la_societe" ON "forfait"`,
        );
        await tx.$executeRawUnsafe(`SET LOCAL ROLE "${ROLE_APP}"`);
        await tx.$executeRawUnsafe(
          "SELECT set_config('app.societe_id', $1, true)",
          SOCIETE_A,
        );
        await tx.$executeRawUnsafe(
          `INSERT INTO "forfait"
             ("id","societe_id","code","libelle","type","montant_mineur",
              "devise_code","cumulable_temps")
           VALUES (gen_random_uuid(), '${SOCIETE_B}'::uuid, 'INTRUS', 'Intrus',
                   'controle', 1, 'EUR', false)`,
        );
        throw new Annulation("AUCUN REFUS");
      })
      .catch((erreur: unknown) => String((erreur as Error).message));

    expect(message).toMatch(/row-level security/i);
  });
});

describe("les verrous de la base", () => {
  it("un forfait ne se conditionne pas à la famille d'une AUTRE société", async () => {
    await expect(
      poser(SOCIETE_A, { code: "AVEC-FAMILLE-B", familleId: FAMILLE_B }),
    ).rejects.toThrow(/forfait_famille_fkey/);

    // TÉMOIN : la famille de SA société passe — sans quoi ce refus ne
    // prouverait que l'existence d'un refus.
    await expect(
      poser(SOCIETE_A, { code: "AVEC-FAMILLE-A", familleId: FAMILLE_A }),
    ).resolves.toBeDefined();
  });

  it("un forfait ne porte pas la devise d'une autre société", async () => {
    await expect(
      poser(SOCIETE_A, { code: "MAUVAISE-DEVISE", devise: "EUR" }),
    ).rejects.toThrow(/devise de sa société/);
  });

  it("un montant négatif est refusé, ZÉRO est accepté", async () => {
    await expect(
      poser(SOCIETE_A, { code: "AVOIR", montant: -1 }),
    ).rejects.toThrow(/forfait_montant_non_negatif/);
    await expect(
      poser(SOCIETE_A, { code: "OFFERT", montant: 0 }),
    ).resolves.toBeDefined();
  });

  it("un tableau de conditions VIDE est refusé — « sans condition » est NULL", async () => {
    await expect(
      poser(SOCIETE_A, { code: "ZONES-VIDES", zones: [] }),
    ).rejects.toThrow(/forfait_zones_non_vides/);
  });

  it("un doublon dans les zones est refusé", async () => {
    await expect(
      poser(SOCIETE_A, { code: "ZONES-DOUBLON", zones: ["sud", "sud"] }),
    ).rejects.toThrow(/forfait_zones_non_vides/);
    await expect(
      poser(SOCIETE_A, { code: "ZONES-OK", zones: ["sud", "nord"] }),
    ).resolves.toBeDefined();
  });
});

describe("les jumeaux — chaque refus s'accompagne du retrait de SON verrou", () => {
  /** Rejoue une écriture fautive après avoir défait un verrou, puis annule. */
  async function sansLeVerrou(
    ddl: string,
    ecriture: string,
    societeId = SOCIETE_A,
  ): Promise<number> {
    return clientOwner()
      .$transaction(async (tx) => {
        await tx.$executeRawUnsafe(ddl);
        await tx.$executeRawUnsafe(`SET LOCAL ROLE "${ROLE_APP}"`);
        await tx.$executeRawUnsafe(
          "SELECT set_config('app.societe_id', $1, true)",
          societeId,
        );
        const n = await tx.$executeRawUnsafe(ecriture);
        throw new Annulation(String(n));
      })
      .catch((erreur: unknown) =>
        erreur instanceof Annulation ? Number(erreur.message) : -1,
      );
  }

  it("retirez le chaînage composite, et la famille de B entre chez A", async () => {
    const passees = await sansLeVerrou(
      `ALTER TABLE "forfait" DROP CONSTRAINT "forfait_famille_fkey"`,
      `INSERT INTO "forfait"
         ("id","societe_id","code","libelle","type","montant_mineur",
          "devise_code","famille_id","cumulable_temps")
       VALUES (gen_random_uuid(), '${SOCIETE_A}'::uuid, 'JUMEAU-FK', 'x',
               'controle', 1, 'XPF', '${FAMILLE_B}'::uuid, false)`,
    );
    // LA VIOLATION A BIEN EU LIEU : un forfait de A pointe une famille de B.
    expect(passees).toBe(1);

    const [present] = await clientOwner().$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM pg_constraint
        WHERE conname = 'forfait_famille_fkey'`,
    );
    expect(Number(present?.n)).toBe(1);
  });

  it("retirez l'unicité du code, et le doublon passe", async () => {
    const passees = await sansLeVerrou(
      `DROP INDEX "forfait_societe_id_code_key"`,
      `INSERT INTO "forfait"
         ("id","societe_id","code","libelle","type","montant_mineur",
          "devise_code","cumulable_temps")
       VALUES (gen_random_uuid(), '${SOCIETE_A}'::uuid, 'DEP-SUD', 'x',
               'controle', 1, 'XPF', false)`,
    );
    expect(passees).toBe(1);

    const [present] = await clientOwner().$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM pg_indexes
        WHERE indexname = 'forfait_societe_id_code_key'`,
    );
    expect(Number(present?.n)).toBe(1);
  });

  it("retirez le déclencheur de devise, et la devise étrangère passe", async () => {
    const passees = await sansLeVerrou(
      `DROP TRIGGER "forfait_devise_de_la_societe" ON "forfait"`,
      `INSERT INTO "forfait"
         ("id","societe_id","code","libelle","type","montant_mineur",
          "devise_code","cumulable_temps")
       VALUES (gen_random_uuid(), '${SOCIETE_A}'::uuid, 'JUMEAU-DEVISE', 'x',
               'controle', 1, 'EUR', false)`,
    );
    // LA VIOLATION A BIEN EU LIEU : une société en XPF porte un forfait en EUR.
    expect(passees).toBe(1);

    const [present] = await clientOwner().$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM pg_trigger
        WHERE tgname = 'forfait_devise_de_la_societe' AND NOT tgisinternal`,
    );
    expect(Number(present?.n)).toBe(1);
  });

  it("retirez la politique, et B lit le catalogue de A", async () => {
    const vues = await clientOwner()
      .$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `DROP POLICY "cloisonnement_societe" ON "forfait"`,
        );
        await tx.$executeRawUnsafe(
          `CREATE POLICY "cloisonnement_societe" ON "forfait" USING (true) WITH CHECK (true)`,
        );
        await tx.$executeRawUnsafe(`SET LOCAL ROLE "${ROLE_APP}"`);
        await tx.$executeRawUnsafe(
          "SELECT set_config('app.societe_id', $1, true)",
          SOCIETE_B,
        );
        const [ligne] = await tx.$queryRawUnsafe<{ n: bigint }[]>(
          `SELECT count(*) AS n FROM "forfait" WHERE "societe_id" = '${SOCIETE_A}'::uuid`,
        );
        throw new Annulation(String(Number(ligne?.n ?? 0)));
      })
      .catch((erreur: unknown) =>
        erreur instanceof Annulation ? Number(erreur.message) : -1,
      );

    // LA VIOLATION A BIEN EU LIEU : B a lu des forfaits de A. Sans ce témoin,
    // un catalogue vide rendrait ce jumeau muet — et un décompte nul ressemble
    // toujours à un sans-faute.
    expect(vues).toBeGreaterThan(0);

    const [présente] = await clientOwner().$queryRawUnsafe<{ q: string }[]>(
      `SELECT coalesce(qual, '') AS q FROM pg_policies
        WHERE tablename = 'forfait' AND policyname = 'cloisonnement_societe'`,
    );
    expect(présente?.q).toContain("app.societe_id");
  });
});
