import { afterAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { avecContexteRls } from "@/lib/db/rls";
import { uuidv7 } from "@/lib/db/uuid";
import {
  lireCatalogueTrajets,
  reglerTrajetZone,
  retirerTrajetZone,
} from "@/lib/sites/depot";
import { schemaTrajetZone } from "@/lib/sites/trajet-zone";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  ROLE_APP,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_INTERNE_A,
  UTILISATEUR_INTERNE_B,
} from "./setup/fixtures";

/** Sortie forcée d'une transaction de jumeau : le `ROLLBACK` défait le DDL. */
class Annulation extends Error {}

/**
 * LE CATALOGUE DES TEMPS DE TRAJET PAR ZONE (R3-03, D107).
 *
 * ## Ce que ce fichier mesure, et que rien d'autre ne mesurerait
 *
 * **LE CLOISONNEMENT, forme « société ».** Une durée de trajet est un réglage
 * d'exploitation, et deux sociétés hébergées sur la même plateforme n'ont
 * aucune raison de lire celui de l'autre. Le témoin de non-vacuité est écrit :
 * B écrit bien LE SIEN.
 *
 * **LES DEUX VERROUS DE LA BASE, chacun avec son jumeau.** Zéro est refusé —
 * *il se lirait « l'établissement est sur place » là où il faut lire « je ne
 * sais pas encore »* — et l'unicité par zone l'est aussi : *deux lignes pour la
 * même zone rendraient indécidable celle qui s'applique.*
 *
 * **ET LA CHAÎNE COMPLÈTE, du dépôt à la lecture.** Régler, relire, corriger,
 * retirer. C'est l'appelant que le §9 du 08/09 réclame : *un module dont aucun
 * test ne franchit la frontière avec le suivant est un endroit où un ticket
 * ultérieur casse quelque chose en silence.*
 */

afterAll(async () => {
  await clientOwner().$executeRawUnsafe(`DELETE FROM "temps_trajet_zone"`);
  await fermerClients();
});

const CONTEXTE_A = {
  utilisateurId: UTILISATEUR_INTERNE_A,
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const CONTEXTE_B = {
  ...CONTEXTE_A,
  utilisateurId: UTILISATEUR_INTERNE_B,
  societeId: SOCIETE_B,
};

/** Une écriture brute, pour éprouver les verrous que Zod ne voit pas. */
function poser(
  societeId: string,
  zone: string,
  minutes: number,
): Promise<unknown> {
  return avecContexteRls(
    clientApp(),
    { societeId, role: Role.direction },
    (tx) =>
      tx.$executeRawUnsafe(
        `INSERT INTO "temps_trajet_zone"
           ("id","societe_id","zone","minutes","modifie_le")
         VALUES ($1::uuid, $2::uuid, $3, $4::int, CURRENT_TIMESTAMP)`,
        uuidv7(),
        societeId,
        zone,
        minutes,
      ),
  );
}

describe("le catalogue est propre à chaque société — forme « société »", () => {
  it("B ne lit pas le réglage de A, et A lit le sien", async () => {
    await reglerTrajetZone(
      CONTEXTE_A,
      schemaTrajetZone.parse({ zone: "sud", minutes: 120 }),
      clientApp(),
    );

    expect([...(await lireCatalogueTrajets(CONTEXTE_A, clientApp()))]).toEqual([
      ["sud", 120],
    ]);
    expect(
      [...(await lireCatalogueTrajets(CONTEXTE_B, clientApp()))],
      "un temps de trajet est un réglage d'exploitation : le lire depuis " +
        "une autre société renseignerait sur son organisation.",
    ).toEqual([]);

    // TÉMOIN DE NON-VACUITÉ : B écrit bien LE SIEN, sur la même zone.
    await reglerTrajetZone(
      CONTEXTE_B,
      schemaTrajetZone.parse({ zone: "sud", minutes: 25 }),
      clientApp(),
    );
    expect([...(await lireCatalogueTrajets(CONTEXTE_B, clientApp()))]).toEqual([
      ["sud", 25],
    ]);
    // Et A n'a pas bougé : l'unicité est PAR société.
    expect([...(await lireCatalogueTrajets(CONTEXTE_A, clientApp()))]).toEqual([
      ["sud", 120],
    ]);
  });

  it("écrire chez une AUTRE société est refusé par le `WITH CHECK`", async () => {
    const message = await avecContexteRls(
      clientApp(),
      { societeId: SOCIETE_A, role: Role.direction },
      (tx) =>
        tx.$executeRawUnsafe(
          `INSERT INTO "temps_trajet_zone"
             ("id","societe_id","zone","minutes","modifie_le")
           VALUES (gen_random_uuid(), $1::uuid, 'nord', 200, CURRENT_TIMESTAMP)`,
          SOCIETE_B,
        ),
    ).then(
      () => "AUCUN REFUS",
      (e: unknown) => String((e as Error).message),
    );
    expect(message).toMatch(/row-level security/i);
  });

  it("JUMEAU — la politique retirée, la ligne d'une autre société passe", async () => {
    // Le jumeau retire LE verrou visé (§9, 24/08) et montre que l'écriture
    // fautive passe alors. Sans lui, ce refus pourrait venir d'ailleurs.
    //
    // ── ET LE DÉCLENCHEUR D'AUDIT A ÉTÉ RETIRÉ AVEC ELLE, PARCE QUE MESURÉ ──
    //
    // La politique seule desserrée, le refus ne disparaît pas : **il se déplace
    // sur `journal_audit`** (`42501`, mesuré). Le déclencheur d'audit écrit la
    // trace sous `societe_id = NEW.societe_id`, c'est-à-dire sous la société B,
    // et la politique du journal la refuse depuis un contexte A.
    //
    // *C'est le voisin qui échoue à la place du verrou visé* (§9, 24/08) — et
    // ici il échoue en REFUSANT, ce qui ressemble à s'y méprendre à une garantie
    // éprouvée (§9, 08/09). La garantie est donc exigée DEUX fois, et l'écrire
    // vaut mieux que de l'ignorer : le journal d'audit interdit lui aussi
    // d'écrire pour le compte d'une autre société. Ce jumeau-ci vise la
    // politique de la table, il retire donc les deux.
    const message = await clientOwner()
      .$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `DROP POLICY "cloisonnement_societe" ON "temps_trajet_zone"`,
        );
        await tx.$executeRawUnsafe(
          `CREATE POLICY "cloisonnement_societe" ON "temps_trajet_zone"
             USING (true) WITH CHECK (true)`,
        );
        await tx.$executeRawUnsafe(
          `DROP TRIGGER "journal_audit" ON "temps_trajet_zone"`,
        );
        await tx.$executeRawUnsafe(`SET LOCAL ROLE "${ROLE_APP}"`);
        await tx.$executeRawUnsafe(
          "SELECT set_config('app.societe_id', $1, true)",
          SOCIETE_A,
        );
        await tx.$executeRawUnsafe(
          `INSERT INTO "temps_trajet_zone"
             ("id","societe_id","zone","minutes","modifie_le")
           VALUES (gen_random_uuid(), '${SOCIETE_B}'::uuid, 'nord', 200,
                   CURRENT_TIMESTAMP)`,
        );
        throw new Annulation("PASSE SANS POLITIQUE");
      })
      .catch((erreur: unknown) => String((erreur as Error).message));

    expect(message).toBe("PASSE SANS POLITIQUE");
  });
});

describe("les verrous de la base", () => {
  it("zéro est refusé, et une minute passe", async () => {
    await expect(poser(SOCIETE_A, "nord", 0)).rejects.toThrow(
      /temps_trajet_zone_minutes_plausibles/,
    );
    // Vert POUR SA PROPRE RAISON : la même écriture avec 1 passe. Sans elle,
    // un refus venu d'ailleurs — la clé étrangère, la politique — passerait
    // pour celui de la contrainte.
    await expect(poser(SOCIETE_A, "nord", 1)).resolves.toBeDefined();
    await retirerTrajetZone(CONTEXTE_A, "nord", clientApp());
  });

  it("plus d'une journée est refusé, et la journée entière passe", async () => {
    await expect(poser(SOCIETE_A, "cote_est", 1441)).rejects.toThrow(
      /temps_trajet_zone_minutes_plausibles/,
    );
    await expect(poser(SOCIETE_A, "cote_est", 1440)).resolves.toBeDefined();
    await retirerTrajetZone(CONTEXTE_A, "cote_est", clientApp());
  });

  it("JUMEAU — la contrainte retirée, zéro passe", async () => {
    const message = await clientOwner()
      .$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `ALTER TABLE "temps_trajet_zone"
             DROP CONSTRAINT "temps_trajet_zone_minutes_plausibles"`,
        );
        await tx.$executeRawUnsafe(`SET LOCAL ROLE "${ROLE_APP}"`);
        await tx.$executeRawUnsafe(
          "SELECT set_config('app.societe_id', $1, true)",
          SOCIETE_A,
        );
        await tx.$executeRawUnsafe(
          `INSERT INTO "temps_trajet_zone"
             ("id","societe_id","zone","minutes","modifie_le")
           VALUES (gen_random_uuid(), '${SOCIETE_A}'::uuid, 'zero', 0,
                   CURRENT_TIMESTAMP)`,
        );
        throw new Annulation("ZÉRO PASSE SANS LA CONTRAINTE");
      })
      .catch((erreur: unknown) => String((erreur as Error).message));

    expect(message).toBe("ZÉRO PASSE SANS LA CONTRAINTE");
  });

  it("deux lignes pour la même zone sont refusées", async () => {
    // *Deux lignes rendraient indécidable celle qui s'applique*, et le choix se
    // ferait alors sur l'ordre de lecture — au hasard, rendu stable.
    await expect(poser(SOCIETE_A, "sud", 200)).rejects.toThrow(/23505/);
  });

  it("une zone vide n'est pas une zone", async () => {
    await expect(poser(SOCIETE_A, "   ", 60)).rejects.toThrow(
      /temps_trajet_zone_zone_non_vide/,
    );
  });
});

describe("la chaîne complète — régler, corriger, retirer", () => {
  it("régler deux fois la même zone CORRIGE, sans créer de seconde ligne", async () => {
    await reglerTrajetZone(
      CONTEXTE_A,
      schemaTrajetZone.parse({ zone: "sud", minutes: 100 }),
      clientApp(),
    );
    expect([...(await lireCatalogueTrajets(CONTEXTE_A, clientApp()))]).toEqual([
      ["sud", 100],
    ]);
  });

  it("retirer rend la main au défaut, et retirer DEUX FOIS ne refuse pas", async () => {
    expect(await retirerTrajetZone(CONTEXTE_A, "sud", clientApp())).toBe(1);
    expect([...(await lireCatalogueTrajets(CONTEXTE_A, clientApp()))]).toEqual(
      [],
    );
    // *Un geste idempotent qui refuse la seconde fois apprend à cliquer deux
    // fois pour vérifier.* Zéro ligne touchée n'est pas une erreur.
    expect(await retirerTrajetZone(CONTEXTE_A, "sud", clientApp())).toBe(0);
  });

  it("et retirer chez A ne touche pas B — le témoin qui rend le retrait lisible", async () => {
    expect([...(await lireCatalogueTrajets(CONTEXTE_B, clientApp()))]).toEqual([
      ["sud", 25],
    ]);
  });
});

describe("l'audit (I8, D55)", () => {
  it("toute écriture laisse sa trace, avec les valeurs avant et après", async () => {
    await reglerTrajetZone(
      CONTEXTE_A,
      schemaTrajetZone.parse({ zone: "nord", minutes: 210 }),
      clientApp(),
    );
    await reglerTrajetZone(
      CONTEXTE_A,
      schemaTrajetZone.parse({ zone: "nord", minutes: 215 }),
      clientApp(),
    );

    const lignes = await clientOwner().$queryRawUnsafe<
      { action: string; avant: unknown; apres: unknown }[]
    >(
      // FILTRÉ SUR LA ZONE, et c'est le scénario qui l'a exigé : les autres
      // scénarios de ce fichier ont déjà écrit des traces, et prendre « la
      // première modification » rendait celle d'une autre zone. *Une assertion
      // qui lit la mauvaise ligne est verte ou rouge pour la mauvaise raison.*
      `SELECT "action", "valeurs_avant" AS avant, "valeurs_apres" AS apres
         FROM "journal_audit"
        WHERE "entite" = 'temps_trajet_zone'
          AND coalesce("valeurs_apres"->>'zone', "valeurs_avant"->>'zone') = 'nord'
        ORDER BY "horodatage" ASC`,
    );

    // *Une durée de trajet est le numérateur d'un taux d'occupation* : le jour
    // où un taux paraîtra faux, « depuis quelle valeur » est la seule question
    // qui y réponde — et elle ne se reconstitue d'aucune autre table.
    expect(lignes.length).toBeGreaterThanOrEqual(2);
    const modification = lignes.find((l) => l.action === "modification");
    expect(modification).toBeDefined();
    expect(JSON.stringify(modification?.avant)).toContain("210");
    expect(JSON.stringify(modification?.apres)).toContain("215");

    await retirerTrajetZone(CONTEXTE_A, "nord", clientApp());
  });
});
