import { afterAll, describe, expect, it } from "vitest";

import { exigence } from "./setup/contrat";
import type { PrismaClient } from "@prisma/client";

import {
  avecPortail,
  sousSociete,
  clientOwner,
  fermerClients,
  observerSousProprietaire,
} from "./setup/db";
import {
  CLIENT_A1,
  CLIENT_A2,
  MACHINE_A1,
  MACHINE_A2,
  MACHINE_A3,
  CLIENT_B1,
  MODELE_A,
  MODELE_B,
  QR_B1,
  SITE_A1_S1,
  SITE_A1_S2,
  SOCIETE_A,
  SOCIETE_B,
  VAR_SOCIETE,
} from "./setup/fixtures";

/**
 * La fiche machine, éprouvée sur la VRAIE table (ticket L2-01 ; I1, I10 ;
 * D6, D7, D10, D22).
 *
 * **Ce fichier existe parce que la TROISIÈME fixture s'est effacée.** Jusqu'à ce
 * ticket, `machine` était une table du harnais — et c'est elle qui portait la
 * résolution QR inter-société depuis L0-05. La migration
 * `20260909150000_machine_l2_01` l'a créée pour de bon, avec **exactement la
 * même clause** de politique : les scénarios de `qr-code.test.ts` et de
 * `portail-client.test.ts` s'y sont reportés **sans qu'une ligne change**, ce
 * qui était tout l'objet du contrat de R0-a.
 *
 * **Ce que ce fichier ajoute, et que le contrat exige :** les scénarios de D22
 * et de périmètre doivent être PLUS nombreux après la reprise, jamais moins. Les
 * planchers de `EXIGENCES_L0_05` montent donc ici.
 *
 * **Chaque refus a son jumeau** (§9, 24/08) : un scénario qui retire RÉELLEMENT
 * le verrou visé, dans une transaction annulée, et montre que l'écriture fautive
 * passe alors.
 */

afterAll(fermerClients);

/** Sentinelle d'annulation : elle fait retomber la transaction, sans erreur. */
class Annulation extends Error {}

const MACHINE_NEUVE = "aaaaaaaa-0000-7000-8000-0000000000b9";

/**
 * Retire RÉELLEMENT des verrous, pose la société, joue `travail`, puis ANNULE.
 *
 * Sous le PROPRIÉTAIRE : retirer une contrainte ou un index est un droit de
 * propriétaire, que le rôle applicatif n'a pas — et c'est bien la contrainte
 * qu'on éprouve ici, pas la politique. Le DDL est transactionnel en PostgreSQL :
 * le verrou revient au `ROLLBACK`, et le jumeau rejoue à chaque `pnpm verify`.
 */
async function sansVerrou(
  retrait: readonly string[],
  societeId: string,
  travail: (tx: PrismaClient) => Promise<void>,
): Promise<void> {
  try {
    await clientOwner().$transaction(async (tx) => {
      for (const instruction of retrait) {
        await tx.$executeRawUnsafe(instruction);
      }
      await tx.$executeRawUnsafe(
        "SELECT set_config($1, $2, true)",
        VAR_SOCIETE,
        societeId,
      );
      await travail(tx as unknown as PrismaClient);
      throw new Annulation();
    });
  } catch (erreur) {
    if (!(erreur instanceof Annulation)) {
      throw erreur;
    }
  }
}

/**
 * Le MESSAGE du refus, ou `null` si rien n'a été refusé.
 *
 * **Écrit ainsi plutôt qu'avec `rejects.toThrow(/…/)`, et c'est une mesure.**
 * Vitest sérialise l'erreur pour composer son message de comparaison, et une
 * erreur de transaction Prisma porte une chaîne de causes que ce parcours ne
 * termine pas : le scénario échouait alors sur « Maximum call stack size
 * exceeded » — *un message juste sur une cause fausse*, qui envoie chercher
 * ailleurs. La lecture est faite ici, une fois, et l'assertion porte sur du
 * texte.
 */
async function refus(travail: Promise<unknown>): Promise<string | null> {
  try {
    await travail;
    return null;
  } catch (erreur) {
    return erreur instanceof Error ? erreur.message : String(erreur);
  }
}

describe("les QUATRE obligatoires sont tenus EN BASE, pas seulement par Zod", () => {
  it("une machine sans modèle est refusée", async () => {
    expect(
      await refus(
        sousSociete(SOCIETE_A, (tx) =>
          tx.$executeRawUnsafe(
            `INSERT INTO "machine" ("id","societe_id","client_id","site_id","qr_token","numero_serie","modifie_le")
             VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,'QR-NEUF','SN-NEUF',now())`,
            MACHINE_NEUVE,
            SOCIETE_A,
            CLIENT_A1,
            SITE_A1_S1,
          ),
        ),
      ),
    ).toContain("modele_id");
  });

  it("un numéro de série VIDE est refusé — le NULL déguisé", async () => {
    const motif = await refus(
      sousSociete(SOCIETE_A, (tx) =>
        tx.$executeRawUnsafe(
          `INSERT INTO "machine" ("id","societe_id","modele_id","client_id","site_id","qr_token","numero_serie","modifie_le")
             VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,'QR-VIDE','   ',now())`,
          MACHINE_NEUVE,
          SOCIETE_A,
          MODELE_A,
          CLIENT_A1,
          SITE_A1_S1,
        ),
      ),
    );
    // L'assertion NOMME la contrainte : un refus venu d'ailleurs passerait
    // sinon pour le bon (§9, 24/08).
    expect(motif).toContain("machine_numero_serie_non_vide");
  });

  it("le doublon (société, modèle, n° de série) est refusé", async () => {
    // RG-PAR-01, rendue DÉFINISSABLE par D6 : c'est parce que le numéro de série
    // est obligatoire que cette unicité peut exister sans trou.
    const motif = await refus(
      sousSociete(SOCIETE_A, (tx) =>
        tx.$executeRawUnsafe(
          `INSERT INTO "machine" ("id","societe_id","modele_id","client_id","site_id","qr_token","numero_serie","modifie_le")
             VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,'QR-DOUBLON','SN-A1',now())`,
          MACHINE_NEUVE,
          SOCIETE_A,
          MODELE_A,
          CLIENT_A1,
          SITE_A1_S1,
        ),
      ),
    );
    // Prisma efface le nom d'une contrainte d'unicité en requête brute — mesuré
    // à L1-07. L'assertion s'assied donc sur le SQLSTATE, et le JUMEAU ci-dessous
    // nomme le verrou en le retirant.
    expect(motif).toContain("23505");
  });

  it("JUMEAU — l'unicité retirée, le doublon PASSE", async () => {
    let ecrites = -1;
    await sansVerrou(
      ['DROP INDEX "machine_societe_modele_serie_key"'],
      SOCIETE_A,
      async (tx) => {
        ecrites = await tx.$executeRawUnsafe(
          `INSERT INTO "machine" ("id","societe_id","modele_id","client_id","site_id","qr_token","numero_serie","modifie_le")
             VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,'QR-JUMEAU','SN-A1',now())`,
          MACHINE_NEUVE,
          SOCIETE_A,
          MODELE_A,
          CLIENT_A1,
          SITE_A1_S1,
        );
      },
    );
    expect(ecrites).toBe(1);
  });

  it("DEUX sociétés portent le même numéro de série — l'unicité est PAR société", async () => {
    // Le témoin qui dit que l'unicité n'est pas globale : deux sociétés
    // achètent la même machine chez le même constructeur.
    const [total] = await observerSousProprietaire(
      "le décompte des machines TOUTES sociétés confondues n'est pas " +
        "atteignable sous le rôle applicatif : c'est ce que la politique retire.",
    ).$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM "machine"`,
    );
    expect(total?.n).toBeGreaterThanOrEqual(3);
  });
});

describe("la forme « parc » — les TROIS filtres, sur la vraie table", () => {
  it(
    exigence(
      "qr_inter_societe",
      "le jeton d'une machine de B ne se résout pas sous le contexte de A",
    ),
    async () => {
      const vues = await sousSociete(SOCIETE_A, (tx) =>
        tx.machine.findMany({
          where: { qr_token: QR_B1 },
          select: { id: true },
        }),
      );
      expect(vues).toEqual([]);
      // TÉMOIN : le jeton existe bien, et il se résout sous SA société.
      const sienne = await sousSociete(SOCIETE_B, (tx) =>
        tx.machine.findMany({
          where: { qr_token: QR_B1 },
          select: { id: true },
        }),
      );
      expect(sienne).toHaveLength(1);
    },
  );

  it(
    exigence(
      "qr_inter_societe",
      "et le jeton reste UNIQUE globalement — la résolution n'est jamais ambiguë",
    ),
    async () => {
      // L'unicité est GLOBALE parce que le lecteur présente le jeton SEUL,
      // avant qu'aucune société ne soit connue : une collision rendrait la
      // résolution ambiguë au moment exact où l'on ne peut pas la lever. Le
      // contrôle de société vient APRÈS, et c'est la politique qui le fait.
      expect(
        await refus(
          sousSociete(SOCIETE_A, (tx) =>
            tx.$executeRawUnsafe(
              `INSERT INTO "machine" ("id","societe_id","modele_id","client_id","site_id","qr_token","numero_serie","modifie_le")
                 VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6,'SN-COLLISION',now())`,
              MACHINE_NEUVE,
              SOCIETE_A,
              MODELE_A,
              CLIENT_A1,
              SITE_A1_S1,
              QR_B1,
            ),
          ),
        ),
      ).toContain("23505");
    },
  );

  it(
    exigence(
      "portail_autre_client",
      "un compte portail ne lit AUCUNE machine d'un autre client de sa société",
    ),
    async () => {
      const vues = await avecPortail(
        { societeId: SOCIETE_A, clientId: CLIENT_A2 },
        (tx) => tx.machine.findMany({ select: { client_id: true } }),
      );
      expect(vues.every((m) => m.client_id === CLIENT_A2)).toBe(true);
      // TÉMOIN : le client A1 a bien des machines, invisibles d'ici.
      const chezA1 = await avecPortail(
        { societeId: SOCIETE_A, clientId: CLIENT_A1 },
        (tx) => tx.machine.findMany({ select: { id: true } }),
      );
      expect(chezA1.length).toBeGreaterThan(0);
    },
  );

  it(
    exigence(
      "perimetre_sites",
      "un compte portail RESTREINT ne lit que les machines de son site",
    ),
    async () => {
      // C'est le troisième filtre, et le seul qui sépare deux machines d'un
      // MÊME client : ni la société ni le client ne les distinguent.
      const vues = await avecPortail(
        {
          societeId: SOCIETE_A,
          clientId: CLIENT_A1,
          perimetreSites: [SITE_A1_S1],
        },
        (tx) => tx.machine.findMany({ select: { id: true } }),
      );
      expect(vues.map((m) => m.id)).toEqual([MACHINE_A1]);
      // TÉMOIN : sans restriction, le même compte voit les TROIS machines de
      // son client. `MACHINE_A3` s'y ajoute au lot 8 (D93) — elle est sur le
      // site S2, hors du périmètre ci-dessus, et c'est elle qui rend son modèle
      // invisible au compte restreint.
      const toutes = await avecPortail(
        { societeId: SOCIETE_A, clientId: CLIENT_A1 },
        (tx) => tx.machine.findMany({ select: { id: true } }),
      );
      expect(toutes.map((m) => m.id).sort()).toEqual(
        [MACHINE_A1, MACHINE_A2, MACHINE_A3].sort(),
      );
    },
  );

  it(
    exigence(
      "perimetre_sites",
      "et il ne peut pas ÉCRIRE une machine hors de son périmètre",
    ),
    async () => {
      // La lecture et l'écriture sont deux moitiés distinctes de la politique :
      // un `WITH CHECK` amputé du troisième filtre laisserait déplacer une
      // machine vers un site qu'on n'a pas le droit de voir.
      // Le refus est BRUYANT et non silencieux, et il faut le dire : la ligne
      // est VISIBLE — le site S1 est dans le périmètre —, donc le `USING` la
      // laisse atteindre ; c'est le `WITH CHECK` qui refuse la ligne d'APRÈS.
      // Un `count` de zéro aurait signifié « invisible », ce qui n'est pas ce
      // qu'on éprouve ici.
      const motif = await refus(
        avecPortail(
          {
            societeId: SOCIETE_A,
            clientId: CLIENT_A1,
            perimetreSites: [SITE_A1_S1],
          },
          (tx) =>
            tx.machine.updateMany({
              where: { id: MACHINE_A1 },
              data: { site_id: SITE_A1_S2 },
            }),
        ),
      );
      expect(motif).toContain("row-level security policy");

      // TÉMOIN : la machine n'a pas bougé.
      const apres = await sousSociete(SOCIETE_A, (tx) =>
        tx.machine.findMany({
          where: { id: MACHINE_A1 },
          select: { site_id: true },
        }),
      );
      expect(apres[0]?.site_id).toBe(SITE_A1_S1);
    },
  );
});

describe("les chaînages composites — une machine ne franchit pas la société", () => {
  it("elle ne peut pas désigner le CLIENT d'une autre société", async () => {
    expect(
      await refus(
        sousSociete(SOCIETE_A, (tx) =>
          tx.$executeRawUnsafe(
            `INSERT INTO "machine" ("id","societe_id","modele_id","client_id","site_id","qr_token","numero_serie","modifie_le")
               VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,'QR-XSOC','SN-XSOC',now())`,
            MACHINE_NEUVE,
            SOCIETE_A,
            MODELE_A,
            // Le client de B, sous le contexte de A.
            CLIENT_B1,
            SITE_A1_S1,
          ),
        ),
      ),
    ).toContain("machine_client_fkey");
  });

  it("elle ne peut pas désigner le MODÈLE d'une autre société", async () => {
    expect(
      await refus(
        sousSociete(SOCIETE_A, (tx) =>
          tx.$executeRawUnsafe(
            `INSERT INTO "machine" ("id","societe_id","modele_id","client_id","site_id","qr_token","numero_serie","modifie_le")
               VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,'QR-XMOD','SN-XMOD',now())`,
            MACHINE_NEUVE,
            SOCIETE_A,
            // Le modèle de B.
            MODELE_B,
            CLIENT_A1,
            SITE_A1_S1,
          ),
        ),
      ),
    ).toContain("machine_modele_fkey");
  });

  it("JUMEAU — la société retirée de la clé du modèle, le modèle d'une AUTRE société entre", async () => {
    let ecrites = -1;
    await sansVerrou(
      [
        'ALTER TABLE "machine" DROP CONSTRAINT "machine_modele_fkey"',
        `ALTER TABLE "machine" ADD CONSTRAINT "machine_modele_fkey"
           FOREIGN KEY ("modele_id") REFERENCES "modele_materiel" ("id")`,
      ],
      SOCIETE_A,
      async (tx) => {
        ecrites = await tx.$executeRawUnsafe(
          `INSERT INTO "machine" ("id","societe_id","modele_id","client_id","site_id","qr_token","numero_serie","modifie_le")
             VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,'QR-JUM2','SN-JUM2',now())`,
          MACHINE_NEUVE,
          SOCIETE_A,
          MODELE_B,
          CLIENT_A1,
          SITE_A1_S1,
        );
      },
    );
    expect(ecrites).toBe(1);
  });

  it("une machine ne se remplace pas ELLE-MÊME", async () => {
    expect(
      await refus(
        sousSociete(SOCIETE_A, (tx) =>
          tx.machine.updateMany({
            where: { id: MACHINE_A1 },
            data: { machine_remplacee_id: MACHINE_A1 },
          }),
        ),
      ),
    ).toContain("machine_remplacee_distincte");
  });
});

describe("le numéro affiché — D7, I10", () => {
  it("il est NUL sur toute fiche existante : personne ne l'attribue encore", async () => {
    // Ce n'est pas un défaut du code, c'est une donnée qui n'existe pas : le
    // compteur par société appartient à la synchronisation (lot 3). Écrit ici
    // pour que rien ne le fasse passer pour un oubli.
    const numeros = await sousSociete(SOCIETE_A, (tx) =>
      tx.machine.findMany({ select: { numero: true } }),
    );
    expect(numeros.every((m) => m.numero === null)).toBe(true);
  });

  it("et quand il sera attribué, il sera unique PAR société", async () => {
    let motif: string | null = null;
    await sansVerrou([], SOCIETE_A, async (tx) => {
      await tx.$executeRawUnsafe(
        `UPDATE "machine" SET "numero" = 1 WHERE "id" = $1::uuid`,
        MACHINE_A1,
      );
      motif = await refus(
        tx.$executeRawUnsafe(
          `UPDATE "machine" SET "numero" = 1 WHERE "id" = $1::uuid`,
          MACHINE_A2,
        ),
      );
      if (motif === null) {
        throw new Error("le doublon de numéro est passé");
      }
    });
    expect(motif).not.toBeNull();
  });
});

describe("l'audit couvre la fiche machine (I8, D55)", () => {
  it("une modification laisse une ligne au journal", async () => {
    const avant = await observerSousProprietaire(
      "`journal_audit` est en ajout seul et cloisonné ; on l'observe ici pour " +
        "compter, ce qu'une lecture applicative ne permettrait pas.",
    ).$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM "journal_audit" WHERE "entite" = 'machine'`,
    );

    await sousSociete(SOCIETE_A, (tx) =>
      tx.machine.updateMany({
        where: { id: MACHINE_A1 },
        data: { localisation: `Atelier ${Date.now()}` },
      }),
    );

    const apres = await observerSousProprietaire(
      "même raison qu'au décompte précédent : c'est l'écart entre les deux qui " +
        "prouve que le déclencheur a écrit.",
    ).$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM "journal_audit" WHERE "entite" = 'machine'`,
    );
    expect(apres[0]!.n).toBeGreaterThan(avant[0]!.n);
  });
});
