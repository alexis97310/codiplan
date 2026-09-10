import { afterAll, describe, expect, it } from "vitest";

import { habilitationsDuCompte } from "@/lib/auth/societe-active";
import { ROLE_PORTAIL } from "@/lib/auth/roles";
import { rattachementsDuCompte } from "@/lib/portail/depot";

import { avecIdentite } from "@/lib/db/rls";

import { avecPortail, clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  CLIENT_A1,
  CLIENT_B1,
  MACHINE_A1,
  MACHINE_A2,
  PORTAIL_A_CLIENT,
  PORTAIL_B_CLIENT,
  PORTAIL_DEUX_SOCIETES,
  SITE_A1_S1,
  SITE_A1_S2,
  SOCIETE_A,
  SOCIETE_B,
} from "./setup/fixtures";

/**
 * LA DIXIÈME FORME — « RATTACHEMENT » (D92, ticket L2-12).
 *
 * ## Le mur, mesuré AVANT d'être abattu
 *
 * Un compte portail n'a **aucune** ligne dans `utilisateur_societe` — D10 le
 * veut ainsi, « les deux tables sont exclusives » — et `utilisateur_client`
 * portait la forme « habilitation », ancrée sur `app.societe_id`. Rien ne
 * pouvait donc lui donner une société, et sans société il ne lisait pas son
 * propre rattachement.
 *
 * *Mesuré le 11/09/2026 sous `codiplan_app`, avec témoin — zéro société lisible
 * sans contexte : identité seule → **0 ligne** ; identité + société → 3 ;
 * `utilisateur_societe` du compte portail → **0**.* **Aucun compte portail
 * n'atteignait aucun écran.**
 *
 * ## CE QUE CE FICHIER ÉPROUVE, ET DANS QUEL ORDRE
 *
 * Le témoin d'abord — la politique mord —, puis ce que la forme OUVRE, puis ce
 * qu'elle REFUSE. La troisième partie est celle qui compte : *une politique
 * qu'on n'a pas mise en échec n'est pas une politique éprouvée* (§9, 24/08).
 */

afterAll(fermerClients);

describe("forme « rattachement » — ce qu'elle ouvre", () => {
  it("TÉMOIN — sans identité posée, le rattachement reste invisible", async () => {
    // Sans ce témoin, les mesures suivantes seraient creuses : une politique
    // absente rendrait tout, et le vert ne parlerait de rien (§9, 07/09).
    const vus = await clientApp().$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM "utilisateur_client"`,
    );
    expect(vus[0]?.n).toBe(0);
  });

  it("un compte portail lit SON rattachement, SANS société active", async () => {
    const rattachements = await rattachementsDuCompte(
      PORTAIL_A_CLIENT,
      clientApp(),
    );
    expect(rattachements.length).toBeGreaterThan(0);
    expect(rattachements.every((r) => r.societeId === SOCIETE_A)).toBe(true);
    expect(rattachements.map((r) => r.clientId)).toContain(CLIENT_A1);
  });

  it("et il en tire une HABILITATION, ce qui lui ouvre un écran", async () => {
    // C'est le maillon que personne ne traversait : `habilitationsDuCompte` ne
    // lisait que `utilisateur_societe`, et rendait `[]` pour tout compte
    // portail — donc aucune société à choisir, donc aucun écran.
    const habilitations = await habilitationsDuCompte(
      PORTAIL_A_CLIENT,
      clientApp(),
    );
    expect(habilitations.map((h) => h.societeId)).toContain(SOCIETE_A);
    expect(habilitations.find((h) => h.societeId === SOCIETE_A)?.role).toBe(
      ROLE_PORTAIL,
    );
  });
});

describe("forme « rattachement » — ce qu'elle REFUSE", () => {
  it("un compte ne lit JAMAIS le rattachement d'un autre", async () => {
    const rattachements = await rattachementsDuCompte(
      PORTAIL_A_CLIENT,
      clientApp(),
    );
    // TÉMOIN — l'autre compte a bien un rattachement, lu sous le propriétaire.
    const [autre] = await clientOwner().$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM "utilisateur_client" WHERE utilisateur_id = $1::uuid`,
      PORTAIL_B_CLIENT,
    );
    expect(autre?.n).toBeGreaterThan(0);
    // …et il reste invisible : ce n'est pas « la table est vide ».
    expect(rattachements.length).toBeGreaterThan(0);
    const vus = await avecIdentite(clientApp(), PORTAIL_A_CLIENT, (tx) =>
      tx.$queryRawUnsafe<{ n: number }[]>(
        `SELECT count(*)::int AS n FROM "utilisateur_client" WHERE utilisateur_id = $1::uuid`,
        PORTAIL_B_CLIENT,
      ),
    );
    expect(vus[0]?.n).toBe(0);
  });

  it("la branche est en LECTURE : elle n'ouvre aucune écriture", async () => {
    // LE CŒUR DE LA BORNE. Si la branche valait aussi en écriture, un compte
    // se rattacherait au client de son choix — et s'ouvrirait son parc. La
    // politique est `FOR SELECT` : PostgreSQL n'a alors AUCUNE politique
    // d'INSERT à faire valoir hors de `cloisonnement_habilitation`, qui exige
    // une société active.
    await expect(
      avecIdentite(clientApp(), PORTAIL_A_CLIENT, (tx) =>
        tx.$executeRawUnsafe(
          `INSERT INTO "utilisateur_client" (id, utilisateur_id, client_id, societe_id, actif)
           VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, true)`,
          PORTAIL_A_CLIENT,
          CLIENT_A1,
          SOCIETE_A,
        ),
      ),
    ).rejects.toThrow(/row-level security|violates/i);
  });
});

describe("un compte portail sur DEUX sociétés atteint les deux", () => {
  /**
   * RG-SOC-03 vaut aussi côté client : *une même personne travaille
   * légitimement pour deux sociétés.* Le même acheteur suit un parc chez
   * CODIMA-NC et un autre chez CODIMA-EU.
   *
   * **C'est le mur de D92 dans sa forme la plus visible** : sans la dixième
   * forme, ce compte ne lisait AUCUNE des deux — il n'a pas de ligne dans
   * `utilisateur_societe` (D10), donc aucune société active pour commencer, et
   * la forme « habilitation » exigeait cette société.
   */
  it("il lit ses DEUX rattachements, sans société active", async () => {
    const rattachements = await rattachementsDuCompte(
      PORTAIL_DEUX_SOCIETES,
      clientApp(),
    );
    expect(rattachements.map((r) => r.societeId).sort()).toEqual(
      [SOCIETE_A, SOCIETE_B].sort(),
    );
    expect(rattachements.map((r) => r.clientId).sort()).toEqual(
      [CLIENT_A1, CLIENT_B1].sort(),
    );
  });

  it("et il en tire DEUX habilitations, une par société", async () => {
    const habilitations = await habilitationsDuCompte(
      PORTAIL_DEUX_SOCIETES,
      clientApp(),
    );
    expect(habilitations.map((h) => h.societeId).sort()).toEqual(
      [SOCIETE_A, SOCIETE_B].sort(),
    );
    expect(habilitations.every((h) => h.role === ROLE_PORTAIL)).toBe(true);
    // TÉMOIN — un compte à UNE seule société n'en rend qu'une : sans lui, une
    // fonction qui rendrait TOUTES les sociétés passerait le test ci-dessus.
    const uneSeule = await habilitationsDuCompte(PORTAIL_A_CLIENT, clientApp());
    expect(uneSeule.map((h) => h.societeId)).toEqual([SOCIETE_A]);
  });

  it("et il NOMME les deux — la neuvième forme les couvre aussi (D67 étendue)", async () => {
    const noms = await avecIdentite(clientApp(), PORTAIL_DEUX_SOCIETES, (tx) =>
      tx.societe.findMany({ select: { id: true }, orderBy: { id: "asc" } }),
    );
    expect(noms.map((n) => n.id).sort()).toEqual([SOCIETE_A, SOCIETE_B].sort());
    // TÉMOIN — la lecture est bornée : un compte d'UNE société n'en nomme
    // qu'une. Sans cela, une politique `USING (true)` passerait aussi.
    const uneSeule = await avecIdentite(clientApp(), PORTAIL_A_CLIENT, (tx) =>
      tx.societe.findMany({ select: { id: true } }),
    );
    expect(uneSeule.map((n) => n.id)).toEqual([SOCIETE_A]);
  });
});

describe("le PÉRIMÈTRE DE SITES mord, et la base le refuse", () => {
  /**
   * Le troisième filtre de la forme « parc », et le seul qui sépare DEUX SITES
   * D'UN MÊME CLIENT. `MACHINE_A1` est sur `SITE_A1_S1`, `MACHINE_A2` sur
   * `SITE_A1_S2` ; les deux appartiennent au client A1, dans la société A. Le
   * compte portail de A1 est restreint à S1.
   *
   * *Ni le filtre société ni le filtre client ne savent produire cette
   * séparation :* c'est ce que ce couple mesure, et c'est pourquoi les deux
   * machines doivent exister avant que la mesure veuille dire quelque chose.
   */
  const machinesVues = (tx: {
    $queryRawUnsafe: <T>(sql: string) => Promise<T>;
  }) => tx.$queryRawUnsafe<Array<{ id: string }>>(`SELECT "id" FROM "machine"`);

  it("le compte restreint à S1 ne voit PAS la machine de S2 — même client", async () => {
    const vues = await avecPortail(
      {
        societeId: SOCIETE_A,
        clientId: CLIENT_A1,
        perimetreSites: [SITE_A1_S1],
      },
      (tx) => machinesVues(tx),
    );
    expect(vues.map((v) => v.id)).toEqual([MACHINE_A1]);
    // TÉMOIN — la seconde machine EXISTE, et elle est du même client : sans
    // cela, l'assertion ci-dessus serait vraie sur un parc d'une seule machine.
    const [toutes] = await clientOwner().$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM "machine" WHERE client_id = $1::uuid`,
      CLIENT_A1,
    );
    expect(toutes?.n).toBe(2);
  });

  it("JUMEAU — le périmètre RETIRÉ, la machine de S2 reparaît", async () => {
    // Le verrou VISÉ est la branche `app.perimetre_sites` de la politique de
    // `machine`, et rien d'autre. Le jumeau la retire dans une transaction
    // annulée — le DDL est transactionnel en PostgreSQL — et montre ce qu'elle
    // fermait. Sans lui, le refus ci-dessus prouverait qu'un verrou mordait le
    // jour où on l'a écrit, jamais qu'il mord ENCORE (§9, 24/08).
    const proprietaire = clientOwner();
    let vues: string[] = [];
    await expect(
      proprietaire.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `ALTER POLICY "cloisonnement_parc" ON "machine" USING (
             "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
             AND (
               NULLIF(current_setting('app.client_id', true), '') IS NULL
               OR "client_id" = NULLIF(current_setting('app.client_id', true), '')::uuid
             )
           )`,
        );
        // Les politiques ne mordent pas le propriétaire : sans cette bascule le
        // jumeau lirait tout et ne prouverait rien (§9, 31/08).
        await tx.$executeRawUnsafe(`SET LOCAL ROLE "codiplan_app"`);
        await tx.$executeRawUnsafe(
          "SELECT set_config('app.societe_id',$1,true), " +
            "set_config('app.client_id',$2,true), " +
            "set_config('app.perimetre_sites',$3,true)",
          SOCIETE_A,
          CLIENT_A1,
          SITE_A1_S1,
        );
        const lignes = await tx.$queryRawUnsafe<Array<{ id: string }>>(
          `SELECT "id" FROM "machine" ORDER BY "id"`,
        );
        vues = lignes.map((l) => l.id);
        throw new Error("annulation volontaire du jumeau");
      }),
    ).rejects.toThrow(/annulation volontaire/);

    // C'EST ICI QUE LE JUMEAU PROUVE : la machine de l'autre site reparaît,
    // avec le MÊME contexte que le refus ci-dessus.
    expect(vues).toEqual([MACHINE_A1, MACHINE_A2].sort());
    expect(SITE_A1_S1).not.toBe(SITE_A1_S2);

    // Et le verrou est REVENU avec le `ROLLBACK`, par le chemin ordinaire.
    const apres = await avecPortail(
      {
        societeId: SOCIETE_A,
        clientId: CLIENT_A1,
        perimetreSites: [SITE_A1_S1],
      },
      (tx) => machinesVues(tx),
    );
    expect(apres.map((v) => v.id)).toEqual([MACHINE_A1]);
  });
});
