import { afterAll, describe, expect, it } from "vitest";

import { tauxEnVigueur } from "@/lib/tarification/taux-horaire";
import { Role } from "@/lib/auth/roles";
import { avecContexteRls } from "@/lib/db/rls";
import { uuidv7 } from "@/lib/db/uuid";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import { ROLE_APP, SOCIETE_A, SOCIETE_B } from "./setup/fixtures";

/** Sortie forcée d'une transaction de jumeau : le `ROLLBACK` défait le DDL. */
class Annulation extends Error {}

/**
 * LE TAUX HORAIRE HISTORISÉ (ticket L1-07, RG-TAR-04).
 *
 * *Une intervention se facture au taux en vigueur à SA date. Une facture qui
 * change quand le tarif change est une facture fausse.* Ce fichier éprouve cette
 * phrase, et les trois verrous qui la tiennent : le cloisonnement par société,
 * l'unicité par date d'effet, et la devise qui ne s'écarte pas de celle de sa
 * société.
 */

const XPF = "XPF";

/** Pose un taux pour une société, à une date donnée. */
function poser(
  societeId: string,
  dateEffet: string,
  montantMineur: number,
  devise = XPF,
): Promise<unknown> {
  return avecContexteRls(
    clientApp(),
    { societeId, role: Role.direction },
    (tx) =>
      tx.$executeRawUnsafe(
        `INSERT INTO "taux_horaire" ("id","societe_id","date_effet","montant_mineur","devise_code")
           VALUES ($1::uuid, $2::uuid, $3::date, $4::bigint, $5)`,
        uuidv7(),
        societeId,
        dateEffet,
        montantMineur,
        devise,
      ),
  );
}

/** Lit le taux en vigueur sous le contexte d'une société. */
function lire(societeId: string, aLaDate: string) {
  return avecContexteRls(
    clientApp(),
    { societeId, role: Role.direction },
    (tx) => tauxEnVigueur(tx, new Date(aLaDate)),
  );
}

afterAll(async () => {
  await clientOwner().$executeRawUnsafe(`DELETE FROM "taux_horaire"`);
  await fermerClients();
});

describe("le taux en vigueur est celui de la DATE, jamais celui d'aujourd'hui", () => {
  it("une hausse ne réécrit pas le passé", async () => {
    await poser(SOCIETE_A, "2026-01-01", 7000);
    await poser(SOCIETE_A, "2026-07-01", 7500);

    const avant = await lire(SOCIETE_A, "2026-03-15");
    const apres = await lire(SOCIETE_A, "2026-09-15");

    expect(avant?.taux.valeur).toBe(BigInt(7000));
    expect(
      apres?.taux.valeur,
      "la lecture ne distingue pas les deux dates : une intervention de mars " +
        "serait refacturée au tarif de juillet, et la facture changerait avec " +
        "le tarif.",
    ).toBe(BigInt(7500));

    // Le jour même de la date d'effet, le NOUVEAU taux s'applique : « à partir
    // de », et non « après ».
    expect((await lire(SOCIETE_A, "2026-07-01"))?.taux.valeur).toBe(
      BigInt(7500),
    );
  });

  it("le montant ne voyage JAMAIS sans sa devise (I2)", async () => {
    const lu = await lire(SOCIETE_A, "2026-09-15");
    expect(lu?.taux.devise).toBe(XPF);
    expect(lu?.taux.nature).toBe("reel");
    // Et c'est un entier : `bigint`, jamais un flottant (I3).
    expect(typeof lu?.taux.valeur).toBe("bigint");
  });

  it("avant toute date d'effet, il n'y a PAS de taux — et surtout pas zéro", async () => {
    // Un taux manquant qui se lirait « gratuit » serait la pire des valeurs par
    // défaut : la facture partirait à zéro sans que personne ne s'en aperçoive.
    expect(await lire(SOCIETE_A, "2025-12-31")).toBeNull();
  });

  it("la société B ne lit pas le taux de A — forme « société »", async () => {
    expect(await lire(SOCIETE_B, "2026-09-15")).toBeNull();

    // TÉMOIN DE NON-VACUITÉ : B lit bien LE SIEN, une fois posé.
    await poser(SOCIETE_B, "2026-01-01", 6500, "EUR");
    const chezB = await lire(SOCIETE_B, "2026-09-15");
    expect(chezB?.taux.valeur).toBe(BigInt(6500));
    expect(chezB?.taux.devise).toBe("EUR");
  });
});

describe("les verrous de la base", () => {
  it("deux taux le même jour pour la même société sont refusés", async () => {
    // ── L'ASSERTION NE PEUT PAS NOMMER LA CONTRAINTE, ET C'EST MESURÉ ─────
    //
    // §9 (24/08) exige qu'un test de refus NOMME le verrou visé, sans quoi un
    // refus venu d'ailleurs passe pour le bon. **Prisma ne le permet pas ici** :
    // sur une violation d'unicité en requête brute, il rend
    // « Unique constraint failed: » — le nom est VIDE. Mesuré ; sur une clé
    // étrangère (23503), il le garde, comme le montre le scénario de
    // `modele_materiel_famille_fkey`.
    //
    // On assied donc l'assertion sur le CODE SQLSTATE, qui distingue déjà
    // l'unicité de tout autre refus, et **le jumeau ci-dessous nomme le verrou
    // en le retirant** — ce qu'aucun message ne peut faire à sa place.
    const message = await poser(SOCIETE_A, "2026-01-01", 8000).then(
      () => "AUCUN REFUS",
      (e: unknown) => String((e as Error).message),
    );
    expect(message).toContain("23505");
  });

  it("un montant nul ou négatif est refusé", async () => {
    await expect(poser(SOCIETE_A, "2027-01-01", 0)).rejects.toThrow(
      /taux_horaire_montant_positif/,
    );
  });

  it("un taux ne porte pas la devise d'une AUTRE société", async () => {
    await expect(poser(SOCIETE_A, "2028-01-01", 7000, "EUR")).rejects.toThrow(
      /devise de sa société/,
    );
  });

  it("JUMEAU — retirez l'unicité, et le doublon de date passe", async () => {
    const passees = await clientOwner()
      .$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `DROP INDEX "taux_horaire_societe_id_date_effet_key"`,
        );
        await tx.$executeRawUnsafe(`SET LOCAL ROLE "${ROLE_APP}"`);
        await tx.$executeRawUnsafe(
          "SELECT set_config('app.societe_id', $1, true)",
          SOCIETE_A,
        );
        const n = await tx.$executeRawUnsafe(
          `INSERT INTO "taux_horaire" ("id","societe_id","date_effet","montant_mineur","devise_code")
             VALUES ($1::uuid, $2::uuid, DATE '2026-01-01', 8000, 'XPF')`,
          uuidv7(),
          SOCIETE_A,
        );
        throw new Annulation(String(n));
      })
      .catch((erreur: unknown) =>
        erreur instanceof Annulation ? Number(erreur.message) : -1,
      );

    // LA VIOLATION A BIEN EU LIEU : deux taux au même jour, et la lecture
    // devrait alors choisir sans règle pour le faire.
    expect(passees).toBe(1);

    const [present] = await clientOwner().$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM pg_indexes
        WHERE indexname = 'taux_horaire_societe_id_date_effet_key'`,
    );
    expect(Number(present?.n)).toBe(1);
  });

  it("JUMEAU — retirez le déclencheur, et la devise étrangère passe", async () => {
    const passees = await clientOwner()
      .$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `DROP TRIGGER "taux_horaire_devise_de_la_societe" ON "taux_horaire"`,
        );
        await tx.$executeRawUnsafe(`SET LOCAL ROLE "${ROLE_APP}"`);
        await tx.$executeRawUnsafe(
          "SELECT set_config('app.societe_id', $1, true)",
          SOCIETE_A,
        );
        const n = await tx.$executeRawUnsafe(
          `INSERT INTO "taux_horaire" ("id","societe_id","date_effet","montant_mineur","devise_code")
             VALUES ($1::uuid, $2::uuid, DATE '2029-01-01', 7000, 'EUR')`,
          uuidv7(),
          SOCIETE_A,
        );
        throw new Annulation(String(n));
      })
      .catch((erreur: unknown) =>
        erreur instanceof Annulation ? Number(erreur.message) : -1,
      );

    // LA VIOLATION A BIEN EU LIEU : une société en XPF porte un taux en EUR.
    expect(passees).toBe(1);

    // Et le déclencheur est bien revenu au ROLLBACK.
    const [present] = await clientOwner().$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM pg_trigger
        WHERE tgname = 'taux_horaire_devise_de_la_societe' AND NOT tgisinternal`,
    );
    expect(Number(present?.n)).toBe(1);
  });
});
