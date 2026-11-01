import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  reinitialiserSecondFacteur,
  RefusReinitialisation,
} from "@/lib/auth/reinitialisation";
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
 * 9IA — RÉINITIALISATION DU SECOND FACTEUR (téléphone perdu, décision
 * d'Alexis du 28/10/2026, réponse « A et B »).
 *
 * Voisin de `tests/isolation/deverrouillage-escalade.test.ts` (L7-04), même
 * forme de preuve : que les deux écritures (verrouillage/vérification sur
 * `second_facteur`, `mfa_actif` sur `utilisateur`) ont bien lieu, et que
 * RIEN d'autre ne bouge — ni le secret, ni les codes de secours, ni la propre
 * ligne de l'acteur.
 */

afterAll(fermerClients);

const ADMIN_B = UTILISATEUR_PAR_ROLE[Role.admin_societe];
const ADMIN_PLATEFORME = UTILISATEUR_PAR_ROLE[Role.admin_plateforme];
const SUJET = UTILISATEUR_PAR_ROLE[Role.responsable_sav];

/** Pose une ligne de second facteur ordinaire pour le sujet — téléphone perdu, pas d'escalade. */
async function poserSujetAvecSecondFacteur(): Promise<void> {
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "second_facteur" WHERE utilisateur_id = $1::uuid`,
    SUJET,
  );
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "second_facteur"
       (id, utilisateur_id, secret, codes_secours, verifie, echecs_verification)
     VALUES ($1::uuid, $2::uuid, 'SECRET-DU-SUJET', 'CODES-DU-SUJET', true, 2)`,
    uuidv7(),
    SUJET,
  );
  await clientOwner().$executeRawUnsafe(
    `UPDATE "utilisateur" SET mfa_actif = true WHERE id = $1::uuid`,
    SUJET,
  );
}

async function restaurerSujet(): Promise<void> {
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "second_facteur" WHERE utilisateur_id = $1::uuid`,
    SUJET,
  );
  await clientOwner().$executeRawUnsafe(
    `UPDATE "utilisateur" SET mfa_actif = true WHERE id = $1::uuid`,
    SUJET,
  );
}

type EtatFacteur = {
  secret: string;
  codes_secours: string;
  verifie: boolean;
  echecs_verification: number;
  verrouille: Date | null;
  consecutifs: number;
};

async function etatFacteur(): Promise<EtatFacteur | undefined> {
  const [ligne] = await observerSousProprietaire(
    "l'état du second facteur n'est lisible sous le rôle applicatif QUE par " +
      "son sujet : c'est précisément ce que ce geste ne doit pas ouvrir à " +
      "l'administrateur.",
  ).$queryRawUnsafe<EtatFacteur[]>(
    `SELECT secret, codes_secours, verifie, echecs_verification,
            verrouille_jusqu_a AS verrouille,
            verrouillages_consecutifs AS consecutifs
       FROM "second_facteur" WHERE utilisateur_id = $1::uuid`,
    SUJET,
  );
  return ligne;
}

async function mfaActifSujet(): Promise<boolean | undefined> {
  const [ligne] = await observerSousProprietaire(
    "mfa_actif n'est pas un secret, mais l'observation se fait quand même de " +
      "l'extérieur, par discipline uniforme avec etatFacteur().",
  ).$queryRawUnsafe<{ mfa_actif: boolean }[]>(
    `SELECT mfa_actif FROM "utilisateur" WHERE id = $1::uuid`,
    SUJET,
  );
  return ligne?.mfa_actif;
}

beforeEach(poserSujetAvecSecondFacteur);
afterEach(restaurerSujet);

describe("la réinitialisation force le ré-enrôlement, et RIEN d'autre", () => {
  it("B (admin_societe) réinitialise un autre membre de SA société", async () => {
    await reinitialiserSecondFacteur(
      {
        societeId: SOCIETE_A,
        role: Role.admin_societe,
        auteurId: ADMIN_B,
        sujetId: SUJET,
      },
      clientApp(),
    );

    const facteur = await etatFacteur();
    expect(facteur?.verifie).toBe(false);
    expect(facteur?.echecs_verification).toBe(0);
    expect(facteur?.verrouille).toBeNull();
    expect(facteur?.consecutifs).toBe(0);
    // ET RIEN D'AUTRE : jamais lu ni écrit par ce module.
    expect(facteur?.secret).toBe("SECRET-DU-SUJET");
    expect(facteur?.codes_secours).toBe("CODES-DU-SUJET");

    expect(await mfaActifSujet()).toBe(false);
  });

  it("A (admin_plateforme) réinitialise n'importe quel compte, sans société active", async () => {
    await reinitialiserSecondFacteur(
      {
        societeId: "",
        role: Role.admin_plateforme,
        auteurId: ADMIN_PLATEFORME,
        sujetId: SUJET,
      },
      clientApp(),
    );

    expect((await etatFacteur())?.verifie).toBe(false);
    expect(await mfaActifSujet()).toBe(false);
  });

  it("A peut se cibler lui-même — la décision ne l'exclut pas", async () => {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "second_facteur" WHERE utilisateur_id = $1::uuid`,
      ADMIN_PLATEFORME,
    );
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "second_facteur" (id, utilisateur_id, secret, codes_secours, verifie)
       VALUES ($1::uuid, $2::uuid, 'SECRET-PLATEFORME', 'CODES-PLATEFORME', true)`,
      uuidv7(),
      ADMIN_PLATEFORME,
    );
    try {
      await reinitialiserSecondFacteur(
        {
          societeId: "",
          role: Role.admin_plateforme,
          auteurId: ADMIN_PLATEFORME,
          sujetId: ADMIN_PLATEFORME,
        },
        clientApp(),
      );
      const [ligne] = await clientOwner().$queryRawUnsafe<
        { verifie: boolean }[]
      >(
        `SELECT verifie FROM "second_facteur" WHERE utilisateur_id = $1::uuid`,
        ADMIN_PLATEFORME,
      );
      expect(ligne?.verifie).toBe(false);
    } finally {
      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "second_facteur" WHERE utilisateur_id = $1::uuid`,
        ADMIN_PLATEFORME,
      );
      await clientOwner().$executeRawUnsafe(
        `UPDATE "utilisateur" SET mfa_actif = true WHERE id = $1::uuid`,
        ADMIN_PLATEFORME,
      );
    }
  });

  it("la trace porte l'auteur, la société et le compte", async () => {
    await reinitialiserSecondFacteur(
      {
        societeId: SOCIETE_A,
        role: Role.admin_societe,
        auteurId: ADMIN_B,
        sujetId: SUJET,
      },
      clientApp(),
    );
    const [ligne] = await observerSousProprietaire(
      "`journal_acces` n'est lisible que sous désignation (L1-02d).",
    ).$queryRawUnsafe<
      { evenement: string; cible: string; role: string; detail: string }[]
    >(
      `SELECT evenement::text, societe_id_cible::text AS cible, role::text, detail
         FROM "journal_acces"
        WHERE utilisateur_id = $1::uuid
          AND evenement = 'reinitialisation_second_facteur'
        ORDER BY horodatage DESC LIMIT 1`,
      ADMIN_B,
    );
    expect(ligne?.evenement).toBe("reinitialisation_second_facteur");
    expect(ligne?.cible).toBe(SOCIETE_A);
    expect(ligne?.role).toBe(Role.admin_societe);
    expect(ligne?.detail).toContain(SUJET);
  });
});

describe("ce que la BASE refuse — et le refus est éprouvé par RETRAIT", () => {
  /**
   * Joue les deux écritures EN BASE, sous le rôle applicatif, avec le
   * contexte donné. Rend le nombre de lignes écrites sur chaque table.
   * Aucune assertion ne passe par le module : ce qui est éprouvé ici est la
   * politique.
   */
  async function ecrire(
    societeId: string,
    role: Role | null,
    sujetId: string,
  ): Promise<{ facteur: number; identite: number }> {
    return avecContexteRls(
      clientApp(),
      { societeId, role, reinitialisationSujetId: sujetId },
      async (tx) => {
        const facteur = await tx.secondFacteur.updateMany({
          data: { verifie: false, echecs_verification: 0 },
        });
        const identite = await tx.utilisateur.updateMany({
          data: { mfa_actif: false },
        });
        return { facteur: facteur.count, identite: identite.count };
      },
    );
  }

  // RESTAURATION DE SOCIÉTÉ A ENTIÈRE — certains scénarios ci-dessous
  // (« direction », « sans sujet désigné ») touchent `identite` par un canal
  // PRÉEXISTANT et SANS RAPPORT avec 9IA : `utilisateur_modification` (D37)
  // laisse déjà admin_societe/direction écrire `mfa_actif` de toute identité
  // de leur société — aucun déclencheur ne l'a jamais borné, faute de route
  // applicative l'ayant jamais exercé avant ce ticket. Signalé en passation,
  // hors territoire (modifier cette politique n'est pas ce lot). On restaure
  // toute la société après CHAQUE scénario pour ne pas polluer les fixtures
  // partagées par les fichiers suivants (`fileParallelism: false`).
  afterEach(async () => {
    await clientOwner().$executeRawUnsafe(
      `UPDATE "utilisateur" SET mfa_actif = true
         WHERE id IN (
           SELECT utilisateur_id FROM "utilisateur_societe" WHERE societe_id = $1::uuid
         )`,
      SOCIETE_A,
    );
  });

  it("B, sur SA société — le témoin de la mesure", async () => {
    expect(await ecrire(SOCIETE_A, Role.admin_societe, SUJET)).toEqual({
      facteur: 1,
      identite: 1,
    });
  });

  it("A, sans aucune société active — le témoin de la mesure", async () => {
    expect(await ecrire("", Role.admin_plateforme, SUJET)).toEqual({
      facteur: 1,
      identite: 1,
    });
  });

  it("la direction n'écrit rien sur `second_facteur` — la décision ne nomme que A et B", async () => {
    // `identite` n'est PAS 0 ici : `utilisateur_modification` (préexistante,
    // D199) laisse déjà la direction administrer `mfa_actif` de SA société —
    // voir le commentaire de `afterEach` ci-dessus. Ce que 9IA borne, c'est
    // `second_facteur`, seule table où aucune autre politique n'ouvrait rien
    // à la direction.
    expect((await ecrire(SOCIETE_A, Role.direction, SUJET)).facteur).toBe(0);
  });

  it("l'ADV n'écrit rien", async () => {
    expect(await ecrire(SOCIETE_A, Role.adv, SUJET)).toEqual({
      facteur: 0,
      identite: 0,
    });
  });

  it("un administrateur d'une AUTRE société n'écrit rien", async () => {
    expect(await ecrire(SOCIETE_B, Role.admin_societe, SUJET)).toEqual({
      facteur: 0,
      identite: 0,
    });
  });

  it("sans sujet désigné, `second_facteur` ne bouge pas — l'UPDATE est pourtant sans WHERE", async () => {
    // Même nuance que ci-dessus pour `identite` : sans sujet désigné, ma
    // politique RESTRICTIVE ne borne plus rien (elle vaut « hors contexte »),
    // et `utilisateur_modification` — préexistante — matche alors TOUTE la
    // société. C'est la mesure qui compte le plus pour `second_facteur` : un
    // `UPDATE` sans `WHERE` écrirait toute la table si sa politique ne le
    // bornait pas, et elle ne bouge pas.
    const resultat = await ecrire(SOCIETE_A, Role.admin_societe, "");
    expect(resultat.facteur).toBe(0);
    expect(resultat.identite).toBeGreaterThan(1);
  });

  it("JUMEAU second_facteur — la politique retirée, B ne passe plus", async () => {
    let passeSansLaPolitique = true;
    await clientOwner()
      .$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `DROP POLICY "second_facteur_reinitialisation" ON "second_facteur"`,
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
          `SELECT set_config('app.reinitialisation_sujet_id',$1,true)`,
          SUJET,
        );
        const n = await tx.$executeRawUnsafe(
          `UPDATE "second_facteur" SET verifie = false`,
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
    expect((await ecrire(SOCIETE_A, Role.admin_societe, SUJET)).facteur).toBe(
      1,
    );
  });

  it("JUMEAU utilisateur — la politique retirée, A ne passe plus", async () => {
    // A (admin_plateforme), jamais B : `utilisateur_modification` couvre déjà
    // B indépendamment de ma politique (voir le commentaire de `afterEach`
    // ci-dessus) — la retirer ne prouverait donc rien pour B. A, lui, n'a
    // aucune autre voie : aucune société active, donc `utilisateur_
    // modification` ne le couvre jamais.
    let passeSansLaPolitique = true;
    await clientOwner()
      .$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `DROP POLICY "utilisateur_reinitialisation" ON "utilisateur"`,
        );
        await tx.$executeRawUnsafe(`SET LOCAL ROLE codiplan_app`);
        await tx.$executeRawUnsafe(
          `SELECT set_config('app.role',$1,true)`,
          Role.admin_plateforme,
        );
        await tx.$executeRawUnsafe(
          `SELECT set_config('app.reinitialisation_sujet_id',$1,true)`,
          SUJET,
        );
        const n = await tx.$executeRawUnsafe(
          `UPDATE "utilisateur" SET mfa_actif = false`,
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
    // TÉMOIN : la politique rendue, le même geste (A) passe.
    expect((await ecrire("", Role.admin_plateforme, SUJET)).identite).toBe(1);
  });
});

describe("D90 rejoué — l'acteur a LUI-MÊME un second facteur", () => {
  async function poserLigneActeur(echecs: number): Promise<void> {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "second_facteur" WHERE utilisateur_id = $1::uuid`,
      ADMIN_B,
    );
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "second_facteur"
         (id, utilisateur_id, secret, codes_secours, verifie, echecs_verification)
       VALUES ($1::uuid, $2::uuid, 'SECRET-ACTEUR', 'CODES-ACTEUR', true, $3)`,
      uuidv7(),
      ADMIN_B,
      echecs,
    );
  }

  it("B réinitialise le sujet SANS que sa propre ligne, ni son propre mfa_actif, ne bougent", async () => {
    await poserLigneActeur(5);
    try {
      await reinitialiserSecondFacteur(
        {
          societeId: SOCIETE_A,
          role: Role.admin_societe,
          auteurId: ADMIN_B,
          sujetId: SUJET,
        },
        clientApp(),
      );
      expect((await etatFacteur())?.verifie).toBe(false);

      const [ligneActeur] = await clientOwner().$queryRawUnsafe<
        { echecs_verification: number }[]
      >(
        `SELECT echecs_verification FROM "second_facteur" WHERE utilisateur_id = $1::uuid`,
        ADMIN_B,
      );
      expect(ligneActeur?.echecs_verification).toBe(5);

      const [acteur] = await clientOwner().$queryRawUnsafe<
        { mfa_actif: boolean }[]
      >(`SELECT mfa_actif FROM "utilisateur" WHERE id = $1::uuid`, ADMIN_B);
      expect(acteur?.mfa_actif).toBe(true);
    } finally {
      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "second_facteur" WHERE utilisateur_id = $1::uuid`,
        ADMIN_B,
      );
      await clientOwner().$executeRawUnsafe(
        `UPDATE "utilisateur" SET mfa_actif = true WHERE id = $1::uuid`,
        ADMIN_B,
      );
    }
  });
});

describe("la LECTURE n'est pas ouverte", () => {
  it("l'administrateur ne lit RIEN de `second_facteur`", async () => {
    const lignes = await avecContexteRls(
      clientApp(),
      {
        societeId: SOCIETE_A,
        role: Role.admin_societe,
        auteurId: ADMIN_B,
        reinitialisationSujetId: SUJET,
      },
      (tx) => tx.secondFacteur.findMany({ select: { id: true } }),
    );
    expect(lignes).toEqual([]);
    expect((await etatFacteur())?.secret).toBe("SECRET-DU-SUJET");
  });
});

describe("le FILET DE COLONNES refuse tout ce qui n'est pas prévu", () => {
  it("sur `second_facteur` : rien d'autre que le verrouillage/vérification", async () => {
    await expect(
      avecContexteRls(
        clientApp(),
        {
          societeId: SOCIETE_A,
          role: Role.admin_societe,
          reinitialisationSujetId: SUJET,
        },
        (tx) =>
          tx.secondFacteur.updateMany({
            data: { verifie: false, secret: "SECRET-REMPLACE" },
          }),
      ),
    ).rejects.toThrow(/ne modifie que/);
    expect((await etatFacteur())?.secret).toBe("SECRET-DU-SUJET");
  });

  it("sur `utilisateur` : rien d'autre que `mfa_actif`", async () => {
    await expect(
      avecContexteRls(
        clientApp(),
        {
          societeId: SOCIETE_A,
          role: Role.admin_societe,
          reinitialisationSujetId: SUJET,
        },
        (tx) =>
          tx.utilisateur.updateMany({
            where: {}, // la désignation vient de la politique, pas d'ici
            data: { mfa_actif: false, nom: "Nom remplacé" },
          }),
      ),
    ).rejects.toThrow(/ne modifie que/);
  });
});

describe("ce que le MODULE refuse, lisiblement", () => {
  it("un rôle qui n'y figure pas est refusé avant toute écriture", async () => {
    const ADV_A = UTILISATEUR_PAR_ROLE[Role.adv];
    await expect(
      reinitialiserSecondFacteur(
        {
          societeId: SOCIETE_A,
          role: Role.adv,
          auteurId: ADV_A,
          sujetId: SUJET,
        },
        clientApp(),
      ),
    ).rejects.toBeInstanceOf(RefusReinitialisation);
    expect((await etatFacteur())?.verifie).toBe(true);
  });

  it("la direction est refusée — la décision ne nomme que A et B", async () => {
    const DIRECTION_A = UTILISATEUR_PAR_ROLE[Role.direction];
    await expect(
      reinitialiserSecondFacteur(
        {
          societeId: SOCIETE_A,
          role: Role.direction,
          auteurId: DIRECTION_A,
          sujetId: SUJET,
        },
        clientApp(),
      ),
    ).rejects.toBeInstanceOf(RefusReinitialisation);
  });

  it("B ne se réinitialise jamais lui-même", async () => {
    await expect(
      reinitialiserSecondFacteur(
        {
          societeId: SOCIETE_A,
          role: Role.admin_societe,
          auteurId: ADMIN_B,
          sujetId: ADMIN_B,
        },
        clientApp(),
      ),
    ).rejects.toBeInstanceOf(RefusReinitialisation);
  });
});
