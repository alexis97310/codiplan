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

  it("D199 (13/10/2026, décision n° 85) — la DIRECTION de la société concernée écrit aussi désormais", async () => {
    expect(await ecrire(SOCIETE_A, Role.direction, SUJET_A)).toBe(1);
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
  it("D199 (13/10/2026, décision n° 85) — la direction administre désormais aussi les identités, elle n'est plus refusée ici", async () => {
    // SA PROPRE IDENTITÉ, jamais SUJET_A : SUJET_A est PARTAGÉE par
    // `beforeEach(mettreALEscalade)` avec tous les scénarios de ce fichier — un
    // sujet nommément créé ici, visé nulle part ailleurs, retire toute
    // ambiguïté sur ce que l'UPDATE sans `WHERE` compte.
    const sujetDedieId = uuidv7();
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "utilisateur" (id, nom, email, modifie_le)
         VALUES ($1::uuid, $2, $3, now())`,
      sujetDedieId,
      "9EV Sujet dédié",
      `9ev-sujet-dedie-${sujetDedieId}@codima.test`,
    );
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "utilisateur_societe" (id, utilisateur_id, societe_id, role)
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::"Role")`,
      uuidv7(),
      sujetDedieId,
      SOCIETE_A,
      Role.direction,
    );
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "second_facteur"
         (id, utilisateur_id, secret, codes_secours, verifie,
          echecs_verification, verrouille_jusqu_a, verrouillages_consecutifs)
       VALUES ($1::uuid, $2::uuid, 'SECRET-DEDIE', 'CODES-DEDIES', true,
               10, "second_facteur_sentinelle_verrouillage"(), 3)`,
      uuidv7(),
      sujetDedieId,
    );
    try {
      // AUTEUR = ADMIN_A, jamais ADV_A : découvert en écrivant cette épreuve
      // (§9) — `second_facteur_modification` (L1-02d) est une SECONDE
      // politique d'UPDATE permissive sur `second_facteur`, combinée par OR à
      // `second_facteur_deverrouillage` ; sa branche `utilisateur_id =
      // app.utilisateur_id` matche la PROPRE ligne de l'auteur, inconditionnel
      // de son état de verrouillage. `categorie-authentification.test.ts`
      // laisse ADV_A avec sa propre ligne de `second_facteur` (fixture
      // `AUTRUI`, sans nettoyage) : la prendre comme auteur fait remonter
      // `count = 2` et le refus de sûreté se déclenche — un défaut
      // PRÉEXISTANT et plus large que ce lot, signalé en passation plutôt que
      // réparé ici (il touche une politique RLS, hors territoire de D199).
      // ADMIN_A n'a jamais de ligne propre dans ce run : c'est ce que fait
      // déjà le scénario voisin, « l'administrateur de SA société écrit ».
      const rompu = await deverrouillerSecondFacteur(
        {
          societeId: SOCIETE_A,
          role: Role.direction,
          auteurId: ADMIN_A,
          sujetId: sujetDedieId,
        },
        clientApp(),
      );
      expect(rompu).toBe(true);
      const [ligne] = await clientOwner().$queryRawUnsafe<
        { consecutifs: number }[]
      >(
        `SELECT verrouillages_consecutifs AS consecutifs FROM "second_facteur" WHERE utilisateur_id = $1::uuid`,
        sujetDedieId,
      );
      expect(ligne?.consecutifs).toBe(0);
    } finally {
      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "second_facteur" WHERE utilisateur_id = $1::uuid`,
        sujetDedieId,
      );
      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "utilisateur_societe" WHERE utilisateur_id = $1::uuid`,
        sujetDedieId,
      );
      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "utilisateur" WHERE id = $1::uuid`,
        sujetDedieId,
      );
    }
    // SUJET_A, lui, est resté intact : cette épreuve n'y a jamais touché.
    expect((await etat())?.consecutifs).toBe(3);
  });

  it("un rôle qui n'administre pas est refusé avant toute écriture (D199 ne l'élargit pas à tous)", async () => {
    const ADV_A = UTILISATEUR_PAR_ROLE[Role.adv];
    await expect(
      deverrouillerSecondFacteur(
        {
          societeId: SOCIETE_A,
          role: Role.adv,
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

describe("D90 (décision n° 90 d'Alexis, 13/10/2026) — l'auteur a LUI-MÊME un second facteur", () => {
  /**
   * Pose une ligne de second facteur ORDINAIRE pour l'auteur — pas à
   * l'escalade, comme tout admin_societe ou direction en production (MFA sur
   * rôles sensibles, §2). `echecs_verification` non nul la rend observable :
   * si le geste la touchait, ce serait visible.
   */
  async function poserLigneAuteur(
    utilisateurId: string,
    echecsVerification: number,
  ): Promise<void> {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "second_facteur" WHERE utilisateur_id = $1::uuid`,
      utilisateurId,
    );
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "second_facteur"
         (id, utilisateur_id, secret, codes_secours, verifie, echecs_verification)
       VALUES ($1::uuid, $2::uuid, 'SECRET-AUTEUR', 'CODES-AUTEUR', true, $3)`,
      uuidv7(),
      utilisateurId,
      echecsVerification,
    );
  }

  async function supprimerLigneAuteur(utilisateurId: string): Promise<void> {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "second_facteur" WHERE utilisateur_id = $1::uuid`,
      utilisateurId,
    );
  }

  async function etatAuteur(
    utilisateurId: string,
  ): Promise<
    { echecs_verification: number; verrouille: Date | null } | undefined
  > {
    const [ligne] = await observerSousProprietaire(
      "l'état propre de l'auteur, observé de l'extérieur pour la même raison " +
        "que `etat()` ci-dessus.",
    ).$queryRawUnsafe<
      { echecs_verification: number; verrouille: Date | null }[]
    >(
      `SELECT echecs_verification, verrouille_jusqu_a AS verrouille
         FROM "second_facteur" WHERE utilisateur_id = $1::uuid`,
      utilisateurId,
    );
    return ligne;
  }

  it("l'administrateur réussit le geste SANS que sa propre ligne ne bouge", async () => {
    await poserLigneAuteur(ADMIN_A, 4);
    try {
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

      const cible = await etat();
      expect(cible?.verrouille).toBeNull();
      expect(cible?.consecutifs).toBe(0);
      expect(cible?.echecs_verification).toBe(0);

      const auteur = await etatAuteur(ADMIN_A);
      expect(auteur?.echecs_verification).toBe(4);
      expect(auteur?.verrouille).toBeNull();
    } finally {
      await supprimerLigneAuteur(ADMIN_A);
    }
  });

  it("D199 — la direction, dotée de son propre second facteur, réussit aussi", async () => {
    const DIRECTION_A = UTILISATEUR_PAR_ROLE[Role.direction];
    // DIRECTION_A n'est autre que SUJET_A (voir le fichier) : on vise ici un
    // sujet DÉDIÉ, jamais SUJET_A, pour ne pas confondre la ligne de l'auteur
    // avec celle du compte qu'on déverrouille.
    const sujetDedieId = uuidv7();
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "utilisateur" (id, nom, email, modifie_le)
         VALUES ($1::uuid, $2, $3, now())`,
      sujetDedieId,
      "D90 Sujet dédié",
      `d90-sujet-dedie-${sujetDedieId}@codima.test`,
    );
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "utilisateur_societe" (id, utilisateur_id, societe_id, role)
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::"Role")`,
      uuidv7(),
      sujetDedieId,
      SOCIETE_A,
      Role.technicien,
    );
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "second_facteur"
         (id, utilisateur_id, secret, codes_secours, verifie,
          echecs_verification, verrouille_jusqu_a, verrouillages_consecutifs)
       VALUES ($1::uuid, $2::uuid, 'SECRET-DEDIE-D90', 'CODES-DEDIES-D90', true,
               10, "second_facteur_sentinelle_verrouillage"(), 3)`,
      uuidv7(),
      sujetDedieId,
    );
    await poserLigneAuteur(DIRECTION_A, 2);
    try {
      const rompu = await deverrouillerSecondFacteur(
        {
          societeId: SOCIETE_A,
          role: Role.direction,
          auteurId: DIRECTION_A,
          sujetId: sujetDedieId,
        },
        clientApp(),
      );
      expect(rompu).toBe(true);
      const [ligne] = await clientOwner().$queryRawUnsafe<
        { consecutifs: number }[]
      >(
        `SELECT verrouillages_consecutifs AS consecutifs FROM "second_facteur" WHERE utilisateur_id = $1::uuid`,
        sujetDedieId,
      );
      expect(ligne?.consecutifs).toBe(0);
      const auteur = await etatAuteur(DIRECTION_A);
      expect(auteur?.echecs_verification).toBe(2);
    } finally {
      await supprimerLigneAuteur(DIRECTION_A);
      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "second_facteur" WHERE utilisateur_id = $1::uuid`,
        sujetDedieId,
      );
      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "utilisateur_societe" WHERE utilisateur_id = $1::uuid`,
        sujetDedieId,
      );
      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "utilisateur" WHERE id = $1::uuid`,
        sujetDedieId,
      );
    }
  });

  it("le témoin direct — `ecrire()` avec l'auteur désigné et sa propre ligne — compte UN", async () => {
    await poserLigneAuteur(ADMIN_A, 1);
    try {
      const n = await avecContexteRls(
        clientApp(),
        {
          societeId: SOCIETE_A,
          role: Role.admin_societe,
          auteurId: ADMIN_A,
          deverrouillageSujetId: SUJET_A,
        },
        async (tx) => {
          const { count } = await tx.secondFacteur.updateMany({
            data: { verrouille_jusqu_a: null, echecs_verification: 0 },
          });
          return count;
        },
      );
      expect(n).toBe(1);
    } finally {
      await supprimerLigneAuteur(ADMIN_A);
    }
  });

  it("JUMEAU — la politique restrictive retirée, la ligne de l'auteur redevient atteignable", async () => {
    await poserLigneAuteur(ADMIN_A, 7);
    try {
      let compteSansLaPolitique = -1;
      await clientOwner()
        .$transaction(async (tx) => {
          await tx.$executeRawUnsafe(
            `DROP POLICY "second_facteur_deverrouillage_exclusif" ON "second_facteur"`,
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
            `SELECT set_config('app.utilisateur_id',$1,true)`,
            ADMIN_A,
          );
          await tx.$executeRawUnsafe(
            `SELECT set_config('app.deverrouillage_sujet_id',$1,true)`,
            SUJET_A,
          );
          const n = await tx.$executeRawUnsafe(
            `UPDATE "second_facteur" SET verrouille_jusqu_a = NULL,
                    echecs_verification = 0`,
          );
          compteSansLaPolitique = n;
          throw new Error("rollback voulu");
        })
        .catch((e: unknown) => {
          if ((e as Error).message !== "rollback voulu") {
            throw e;
          }
        });
      expect(compteSansLaPolitique).toBe(2);

      // TÉMOIN : la politique rendue, le même geste ne compte plus qu'UNE ligne.
      const n = await avecContexteRls(
        clientApp(),
        {
          societeId: SOCIETE_A,
          role: Role.admin_societe,
          auteurId: ADMIN_A,
          deverrouillageSujetId: SUJET_A,
        },
        async (tx) => {
          const { count } = await tx.secondFacteur.updateMany({
            data: { verrouille_jusqu_a: null, echecs_verification: 0 },
          });
          return count;
        },
      );
      expect(n).toBe(1);
    } finally {
      await supprimerLigneAuteur(ADMIN_A);
    }
  });
});
