import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  deverrouillerSecondFacteur,
  RefusDeverrouillage,
} from "@/lib/auth/deverrouillage";
import { Role } from "@/lib/auth/roles";
import { avecContexteRls } from "@/lib/db/rls";
import { uuidv7 } from "@/lib/db/uuid";

import {
  clientApp,
  clientOwner,
  fermerClients,
  observerSousProprietaire,
} from "./setup/db";
import { SOCIETE_A, SOCIETE_B, UTILISATEUR_PAR_ROLE } from "./setup/fixtures";
import "./setup/env";

/**
 * L7-04 — LE DÉVERROUILLAGE D'UN COMPTE PARVENU À L'ESCALADE (D66).
 *
 * ## Ce que ces scénarios doivent prouver, et l'ordre compte
 *
 * *Déverrouiller ne rend que le droit de RÉESSAYER.* Il faut donc prouver deux
 * choses de natures différentes : que la série est bien rompue, **et** que rien
 * d'autre ne l'est — ni le secret, ni les codes de secours, ni l'obligation de
 * présenter un code.
 *
 * ## Le point qui a décidé la forme, et qu'il faut relire avant de « simplifier »
 *
 * Le geste écrit un `UPDATE` **sans clause `WHERE`**. Ce n'est pas un raccourci :
 * PostgreSQL applique les politiques de `SELECT` au `WHERE` d'un `UPDATE`, si
 * bien qu'un `where` naturel aurait exigé d'ouvrir la LECTURE de
 * `second_facteur` à l'administrateur — c'est-à-dire de lui donner le secret de
 * la personne qu'il dépanne. Un scénario ci-dessous mesure cette lecture et la
 * trouve **fermée**.
 */

afterAll(fermerClients);

const ADMIN_A = UTILISATEUR_PAR_ROLE[Role.admin_societe];
const SUJET_A = UTILISATEUR_PAR_ROLE[Role.direction];
const ADV_A = UTILISATEUR_PAR_ROLE[Role.adv];

/** Pose une ligne de second facteur pour le sujet, à l'escalade. */
async function mettreALEscalade(): Promise<void> {
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "second_facteur" WHERE utilisateur_id = $1::uuid`,
    SUJET_A,
  );
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "second_facteur"
       (id, utilisateur_id, secret, codes_secours, verifie,
        echecs_verification, verrouille_jusqu_a, verrouillages_consecutifs)
     VALUES ($1::uuid, $2::uuid, 'SECRET-DU-SUJET', 'CODES-DU-SUJET', true,
             10, "second_facteur_sentinelle_verrouillage"(), 3)`,
    uuidv7(),
    SUJET_A,
  );
}

type Etat = {
  secret: string;
  codes_secours: string;
  verifie: boolean;
  echecs_verification: number;
  verrouille: Date | null;
  consecutifs: number;
};

async function etat(): Promise<Etat | undefined> {
  const [ligne] = await observerSousProprietaire(
    "l'état du second facteur n'est lisible sous le rôle applicatif QUE par " +
      "son sujet : c'est précisément ce que L7-04 ne doit pas ouvrir à " +
      "l'administrateur, et c'est donc ce qu'on observe ici de l'extérieur.",
  ).$queryRawUnsafe<Etat[]>(
    `SELECT secret, codes_secours, verifie, echecs_verification,
            verrouille_jusqu_a AS verrouille,
            verrouillages_consecutifs AS consecutifs
       FROM "second_facteur" WHERE utilisateur_id = $1::uuid`,
    SUJET_A,
  );
  return ligne;
}

beforeEach(mettreALEscalade);

describe("le déverrouillage rompt la série, et RIEN d'autre", () => {
  it("l'administrateur de la société rompt la série", async () => {
    const avant = await etat();
    expect(avant?.consecutifs).toBe(3);
    expect(avant?.verrouille).not.toBeNull();

    const rompu = await deverrouillerSecondFacteur(
      {
        societeId: SOCIETE_A,
        role: Role.admin_societe,
        auteurId: ADMIN_A,
        sujetId: SUJET_A,
      },
      clientApp(),
    );
    expect(rompu).toBe(true);

    const apres = await etat();
    expect(apres?.verrouille).toBeNull();
    expect(apres?.consecutifs).toBe(0);
    expect(apres?.echecs_verification).toBe(0);

    // ET RIEN D'AUTRE : le facteur est INTACT — la personne devra présenter un
    // code valide, et n'a rien à réenrôler.
    expect(apres?.secret).toBe("SECRET-DU-SUJET");
    expect(apres?.codes_secours).toBe("CODES-DU-SUJET");
    expect(apres?.verifie).toBe(true);
  });

  it("la trace porte l'auteur, la société et le compte", async () => {
    await deverrouillerSecondFacteur(
      {
        societeId: SOCIETE_A,
        role: Role.admin_societe,
        auteurId: ADMIN_A,
        sujetId: SUJET_A,
      },
      clientApp(),
    );
    const [ligne] = await observerSousProprietaire(
      "`journal_acces` n'est lisible que sous désignation (L1-02d) ; on " +
        "l'observe ici pour ce qu'elle porte.",
    ).$queryRawUnsafe<
      { evenement: string; cible: string; role: string; detail: string }[]
    >(
      `SELECT evenement::text, societe_id_cible::text AS cible, role::text,
              detail
         FROM "journal_acces"
        WHERE utilisateur_id = $1::uuid
          AND evenement = 'deverrouillage_second_facteur'
        ORDER BY horodatage DESC LIMIT 1`,
      ADMIN_A,
    );
    expect(ligne?.evenement).toBe("deverrouillage_second_facteur");
    expect(ligne?.cible).toBe(SOCIETE_A);
    expect(ligne?.role).toBe(Role.admin_societe);
    expect(ligne?.detail).toContain(SUJET_A);
  });
});

describe("ce que la BASE refuse — et le refus est éprouvé par RETRAIT", () => {
  /**
   * Joue le geste EN BASE, sous le rôle applicatif, avec le contexte donné.
   * Rend le nombre de lignes écrites. Aucune assertion ne passe par le module :
   * ce qui est éprouvé ici est la politique.
   */
  async function ecrire(
    societeId: string,
    role: Role | null,
    sujetId: string,
  ): Promise<number> {
    return avecContexteRls(
      clientApp(),
      { societeId, role, deverrouillageSujetId: sujetId },
      async (tx) => {
        const { count } = await tx.secondFacteur.updateMany({
          data: { verrouille_jusqu_a: null, echecs_verification: 0 },
        });
        return count;
      },
    );
  }

  it("l'administrateur de SA société écrit — le témoin de la mesure", async () => {
    expect(await ecrire(SOCIETE_A, Role.admin_societe, SUJET_A)).toBe(1);
  });

  it("la DIRECTION de la société concernée n'écrit rien", async () => {
    expect(await ecrire(SOCIETE_A, Role.direction, SUJET_A)).toBe(0);
  });

  it("l'ADV n'écrit rien", async () => {
    expect(await ecrire(SOCIETE_A, Role.adv, SUJET_A)).toBe(0);
  });

  it("l'administrateur de plateforme n'écrit rien", async () => {
    expect(await ecrire(SOCIETE_A, Role.admin_plateforme, SUJET_A)).toBe(0);
  });

  it("le SUJET lui-même n'écrit rien par ce chemin", async () => {
    // Il n'a pas le rôle, et c'est la première condition ; mais surtout, sa
    // propre politique de modification ne s'applique pas : le contexte de
    // déverrouillage ne pose aucune désignation d'authentification.
    expect(await ecrire(SOCIETE_A, Role.technicien, SUJET_A)).toBe(0);
  });

  it("un administrateur d'une AUTRE société n'écrit rien", async () => {
    expect(await ecrire(SOCIETE_B, Role.admin_societe, SUJET_A)).toBe(0);
  });

  it("sans sujet désigné, RIEN n'est écrit — l'UPDATE est pourtant sans WHERE", async () => {
    // C'est la mesure qui compte le plus : un `UPDATE` sans clause `WHERE`
    // écrirait TOUTE la table si la politique ne le bornait pas.
    expect(await ecrire(SOCIETE_A, Role.admin_societe, "")).toBe(0);
  });

  it("une ligne SAINE n'est pas atteignable — la politique ne vise que l'escalade", async () => {
    await clientOwner().$executeRawUnsafe(
      `UPDATE "second_facteur" SET verrouille_jusqu_a = NULL,
              verrouillages_consecutifs = 0 WHERE utilisateur_id = $1::uuid`,
      SUJET_A,
    );
    expect(await ecrire(SOCIETE_A, Role.admin_societe, SUJET_A)).toBe(0);
  });

  it("JUMEAU — la politique retirée, le geste de l'administrateur ne passe plus", async () => {
    let passeSansLaPolitique = true;
    await clientOwner()
      .$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `DROP POLICY "second_facteur_deverrouillage" ON "second_facteur"`,
        );
        await tx.$executeRawUnsafe(`SET LOCAL ROLE codiplan_app`);
        await tx.$executeRawUnsafe(
          `SELECT set_config('app.societe_id',$1,true)`,
          SOCIETE_A,
        );
        await tx.$executeRawUnsafe(
          `SELECT set_config('app.role',$1,true)`,
          Role.admin_societe,
        );
        await tx.$executeRawUnsafe(
          `SELECT set_config('app.deverrouillage_sujet_id',$1,true)`,
          SUJET_A,
        );
        const n = await tx.$executeRawUnsafe(
          `UPDATE "second_facteur" SET verrouille_jusqu_a = NULL,
                  echecs_verification = 0`,
        );
        passeSansLaPolitique = n > 0;
        throw new Error("rollback voulu");
      })
      .catch((e: unknown) => {
        if ((e as Error).message !== "rollback voulu") {
          throw e;
        }
      });
    expect(passeSansLaPolitique).toBe(false);
    // TÉMOIN : la politique rendue, le même geste passe.
    expect(await ecrire(SOCIETE_A, Role.admin_societe, SUJET_A)).toBe(1);
  });
});

describe("la LECTURE n'est pas ouverte, et c'est tout l'objet de la forme", () => {
  it("l'administrateur ne lit RIEN de `second_facteur`", async () => {
    const lignes = await avecContexteRls(
      clientApp(),
      {
        societeId: SOCIETE_A,
        role: Role.admin_societe,
        auteurId: ADMIN_A,
        deverrouillageSujetId: SUJET_A,
      },
      (tx) => tx.secondFacteur.findMany({ select: { id: true } }),
    );
    expect(lignes).toEqual([]);
    // TÉMOIN DE NON-VACUITÉ : il y a bien une ligne à ne pas voir.
    expect((await etat())?.secret).toBe("SECRET-DU-SUJET");
  });

  it("le FILET DE COLONNES refuse tout ce qui n'est pas le verrouillage", async () => {
    await expect(
      avecContexteRls(
        clientApp(),
        {
          societeId: SOCIETE_A,
          role: Role.admin_societe,
          deverrouillageSujetId: SUJET_A,
        },
        (tx) =>
          tx.secondFacteur.updateMany({
            data: {
              verrouille_jusqu_a: null,
              echecs_verification: 0,
              secret: "SECRET-REMPLACE",
            },
          }),
      ),
    ).rejects.toThrow(/ne modifie que le verrouillage/);
    expect((await etat())?.secret).toBe("SECRET-DU-SUJET");
  });
});

describe("ce que le MODULE refuse, lisiblement", () => {
  it("un rôle qui n'administre pas est refusé avant toute écriture", async () => {
    await expect(
      deverrouillerSecondFacteur(
        {
          societeId: SOCIETE_A,
          role: Role.direction,
          auteurId: ADV_A,
          sujetId: SUJET_A,
        },
        clientApp(),
      ),
    ).rejects.toBeInstanceOf(RefusDeverrouillage);
    expect((await etat())?.consecutifs).toBe(3);
  });

  it("personne ne se déverrouille soi-même", async () => {
    await expect(
      deverrouillerSecondFacteur(
        {
          societeId: SOCIETE_A,
          role: Role.admin_societe,
          auteurId: SUJET_A,
          sujetId: SUJET_A,
        },
        clientApp(),
      ),
    ).rejects.toBeInstanceOf(RefusDeverrouillage);
  });

  it("un compte qui n'est pas à l'escalade rend `false`, sans rien écrire", async () => {
    await clientOwner().$executeRawUnsafe(
      `UPDATE "second_facteur" SET verrouille_jusqu_a = NULL,
              verrouillages_consecutifs = 0 WHERE utilisateur_id = $1::uuid`,
      SUJET_A,
    );
    const rompu = await deverrouillerSecondFacteur(
      {
        societeId: SOCIETE_A,
        role: Role.admin_societe,
        auteurId: ADMIN_A,
        sujetId: SUJET_A,
      },
      clientApp(),
    );
    expect(rompu).toBe(false);
  });
});
