import { afterAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import { creerIntervention } from "@/lib/interventions/depot";
import { schemaCreation } from "@/lib/interventions/saisie";

import { avecPortail, clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  CLIENT_A1,
  CLIENT_A2,
  INTERVENTION_A1,
  INTERVENTION_A2,
  INTERVENTION_B1,
  MACHINE_A1,
  SITE_A1_S1,
  SITE_A1_S2,
  SOCIETE_A,
  UTILISATEUR_INTERNE_A,
} from "./setup/fixtures";

/**
 * UNE VISITE, PLUSIEURS MACHINES (L2-08a, D103).
 *
 * > *« Une visite peut couvrir plusieurs machines : plusieurs lignes machine,
 * > chacune avec sa checklist et son état de sortie, un seul déplacement, un
 * > seul rapport. »* (chapitre 7/M3)
 *
 * ## Ce que ce fichier mesure, et que rien d'autre ne mesure
 *
 * La forme **« filiation »** : *une fille est visible si son parent l'est.* Les
 * trois filtres de la forme « parc » d'`intervention` s'y propagent **sans
 * qu'aucun soit réécrit** — et c'est précisément ce qu'il faut prouver, une
 * politique qui recopierait les filtres passerait les mêmes scénarios en
 * portant une seconde lecture du même critère.
 *
 * Et **RG-INT-01**, qui n'était vérifiable par personne avant ce ticket : une
 * intervention ne démarre pas sans machine, sauf `expertise`, `installation` et
 * `recensement`.
 */

afterAll(fermerClients);

const SESSION = {
  utilisateurId: UTILISATEUR_INTERNE_A,
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

/** Une intervention jetable du client A1 sur le site du périmètre. */
async function surUneInterventionJetable(
  type: string,
  travail: (id: string) => Promise<void>,
): Promise<void> {
  const id = uuidv7();
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id",
       "agence_id", "type", "statut", "modifie_le")
     SELECT '${id}', "societe_id", "client_id", "site_id", "agence_id",
            '${type}'::"TypeIntervention", 'planifiee', now()
       FROM "intervention" WHERE "id" = '${INTERVENTION_A1}'`,
  );
  try {
    await travail(id);
  } finally {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = '${id}'`,
    );
  }
}

describe("la forme « filiation » : la fille suit son parent (D103)", () => {
  it("TÉMOIN — la politique est en vigueur et elle MORD", async () => {
    const [drapeaux] = await clientOwner().$queryRawUnsafe<
      Array<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>
    >(
      `SELECT "relrowsecurity", "relforcerowsecurity" FROM pg_class WHERE relname = 'intervention_machine'`,
    );
    expect(drapeaux).toEqual({
      relrowsecurity: true,
      relforcerowsecurity: true,
    });

    // Zéro ligne sans contexte, et de vraies lignes en base : les deux moitiés
    // du témoin (§9, 07/09).
    expect(
      await clientApp().interventionMachine.findMany({ select: { id: true } }),
    ).toEqual([]);
    const [total] = await clientOwner().$queryRawUnsafe<Array<{ n: bigint }>>(
      `SELECT count(*) AS n FROM "intervention_machine"`,
    );
    expect(Number(total?.n ?? 0)).toBeGreaterThanOrEqual(3);
  });

  it("un utilisateur interne voit les rattachements de SA société, jamais d'une autre", async () => {
    const vues = await clientApp().$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.societe_id', '${SOCIETE_A}', true)`,
      );
      return tx.interventionMachine.findMany({
        select: { intervention_id: true },
      });
    });
    const ids = vues.map((l) => l.intervention_id);
    expect(ids).toContain(INTERVENTION_A1);
    expect(ids).toContain(INTERVENTION_A2);
    expect(ids).not.toContain(INTERVENTION_B1);
  });

  it("le filtre de PÉRIMÈTRE se propage — sans être écrit dans la politique fille", async () => {
    // C'est tout l'objet de la forme. La politique d'`intervention_machine` ne
    // nomme NI `app.client_id` NI `app.perimetre_sites` : elle demande seulement
    // si le parent est visible. Restreint à S1, ce compte perd le rattachement
    // de l'intervention de S2.
    const vues = await avecPortail(
      {
        societeId: SOCIETE_A,
        clientId: CLIENT_A1,
        perimetreSites: [SITE_A1_S1],
      },
      (tx) =>
        tx.interventionMachine.findMany({ select: { intervention_id: true } }),
    );
    const ids = vues.map((l) => l.intervention_id);
    expect(ids).toContain(INTERVENTION_A1);
    expect(ids).not.toContain(INTERVENTION_A2);
  });

  it("PREUVE que la politique fille ne recopie RIEN : elle ne nomme aucune variable de parc", async () => {
    // *Recopier les filtres passerait tous les scénarios ci-dessus* — et
    // porterait une seconde lecture du même critère, qui vieillit sans rougir.
    // Le seul moyen de distinguer les deux est de LIRE la clause.
    const [politique] = await clientOwner().$queryRawUnsafe<
      Array<{ qual: string; with_check: string }>
    >(
      `SELECT "qual", "with_check" FROM pg_policies WHERE tablename = 'intervention_machine'`,
    );
    expect(politique?.qual).toContain("intervention");
    expect(politique?.qual).not.toContain("client_id");
    expect(politique?.qual).not.toContain("perimetre_sites");
    expect(politique?.with_check).not.toContain("perimetre_sites");
  });

  it("un compte d'un AUTRE client ne voit rien de ces rattachements", async () => {
    const vues = await avecPortail(
      { societeId: SOCIETE_A, clientId: CLIENT_A2 },
      (tx) =>
        tx.interventionMachine.findMany({ select: { intervention_id: true } }),
    );
    expect(vues.map((l) => l.intervention_id)).not.toContain(INTERVENTION_A1);
  });
});

describe("RG-INT-01 — pas de démarrage sans machine, sauf trois types (D16)", () => {
  it("une intervention CURATIVE sans machine refuse de démarrer", async () => {
    await surUneInterventionJetable("curatif", async (id) => {
      await expect(
        clientOwner().$executeRawUnsafe(
          `UPDATE "intervention" SET "statut" = 'en_cours' WHERE "id" = '${id}'`,
        ),
      ).rejects.toThrow(/machine/i);
    });
  });

  it("la MÊME intervention, une machine rattachée, démarre — le refus venait bien de là", async () => {
    // Le cas qui doit rester VERT pour sa propre raison (§9, 11/09) : sans lui,
    // un déclencheur qui refuserait toute entrée en `en_cours` passerait le
    // scénario ci-dessus.
    await surUneInterventionJetable("curatif", async (id) => {
      await clientOwner().$executeRawUnsafe(
        `INSERT INTO "intervention_machine" ("id", "societe_id", "intervention_id", "machine_id", "modifie_le")
         VALUES ('${uuidv7()}', '${SOCIETE_A}', '${id}', '${MACHINE_A1}', now())`,
      );
      await clientOwner().$executeRawUnsafe(
        `UPDATE "intervention" SET "statut" = 'en_cours' WHERE "id" = '${id}'`,
      );
      const [apres] = await clientOwner().$queryRawUnsafe<
        Array<{ statut: string }>
      >(`SELECT "statut" FROM "intervention" WHERE "id" = '${id}'`);
      expect(apres?.statut).toBe("en_cours");
    });
  });

  it.each(["expertise", "installation", "recensement"])(
    "une intervention de type « %s » démarre SANS machine — D16",
    async (type) => {
      await surUneInterventionJetable(type, async (id) => {
        await clientOwner().$executeRawUnsafe(
          `UPDATE "intervention" SET "statut" = 'en_cours' WHERE "id" = '${id}'`,
        );
        const [apres] = await clientOwner().$queryRawUnsafe<
          Array<{ statut: string }>
        >(`SELECT "statut" FROM "intervention" WHERE "id" = '${id}'`);
        expect(apres?.statut).toBe("en_cours");
      });
    },
  );

  it("le saut direct vers TERMINEE est gardé aussi — la base garde des ÉTATS, pas des trajets", async () => {
    // *Ne surveiller que `en_cours` rendrait la règle vraie du chemin ordinaire
    // et fausse de tous les autres.*
    await surUneInterventionJetable("curatif", async (id) => {
      await expect(
        clientOwner().$executeRawUnsafe(
          `UPDATE "intervention" SET "statut" = 'terminee' WHERE "id" = '${id}'`,
        ),
      ).rejects.toThrow(/machine/i);
    });
  });

  it("JUMEAU — le contrôle retiré de la fonction, le démarrage sans machine PASSE", async () => {
    // *Un test de refus prouve que le verrou mordait le jour où on l'a écrit*
    // (§9, 24/08). Le jumeau retire LE contrôle visé — pas le déclencheur
    // entier, pas une contrainte voisine — dans une transaction annulée.
    await surUneInterventionJetable("curatif", async (id) => {
      await expect(
        clientOwner().$transaction(async (tx) => {
          await tx.$executeRawUnsafe(`
            CREATE OR REPLACE FUNCTION "intervention_cycle_de_vie"()
            RETURNS TRIGGER AS $jumeau$
            BEGIN
              RETURN NEW;
            END;
            $jumeau$ LANGUAGE plpgsql;
          `);
          await tx.$executeRawUnsafe(
            `UPDATE "intervention" SET "statut" = 'en_cours' WHERE "id" = '${id}'`,
          );
          const [apres] = await tx.$queryRawUnsafe<Array<{ statut: string }>>(
            `SELECT "statut" FROM "intervention" WHERE "id" = '${id}'`,
          );
          expect(apres?.statut).toBe("en_cours");
          throw new Error("rollback voulu");
        }),
      ).rejects.toThrow("rollback voulu");

      // La fonction est revenue avec l'annulation, et elle mord de nouveau.
      await expect(
        clientOwner().$executeRawUnsafe(
          `UPDATE "intervention" SET "statut" = 'en_cours' WHERE "id" = '${id}'`,
        ),
      ).rejects.toThrow(/machine/i);
    });
  });
});

describe("le dépôt écrit les machines dans la MÊME transaction", () => {
  it("une intervention créée avec deux machines les porte toutes les deux", async () => {
    const id = uuidv7();
    try {
      const resultat = await creerIntervention(
        SESSION,
        {
          id,
          client_id: CLIENT_A1,
          site_id: SITE_A1_S1,
          machine_ids: [MACHINE_A1],
          type: "preventif_contrat",
          priorite: "p3",
          mode_valorisation: "temps_passe",
          date_planifiee: null,
          creneau_debut: null,
          creneau_fin: null,
          duree_estimee_min: null,
          technicien_id: null,
        },
        clientApp(),
      );
      expect(resultat.accepte).toBe(true);
      if (!resultat.accepte) return;
      expect(resultat.fiche.machines.map((m) => m.machine_id)).toEqual([
        MACHINE_A1,
      ]);
    } finally {
      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "intervention" WHERE "id" = '${id}'`,
      );
    }
  });

  it("la même machine nommée DEUX FOIS n'est écrite qu'une — la CHAÎNE dédoublonne", async () => {
    // *Une même machine nommée deux fois dans un formulaire est une maladresse
    // de saisie, pas une faute à refuser* — et l'index unique l'aurait refusée.
    //
    // **Ce scénario traverse la FRONTIÈRE** : il passe par `schemaCreation`,
    // comme la route de production, plutôt que de fabriquer l'objet déjà
    // dédoublonné. *Une suite qui éprouve tous les maillons n'éprouve pas la
    // chaîne* (§9, 08/09) — et c'est la mesure qui l'a montré : l'objet
    // fabriqué à la main sautait le dédoublonnage et butait sur l'index.
    const id = uuidv7();
    const saisie = schemaCreation.parse({
      id,
      client_id: CLIENT_A1,
      site_id: SITE_A1_S2,
      machine_ids: [MACHINE_A1, MACHINE_A1],
      type: "preventif_contrat",
    });
    expect(saisie.machine_ids).toHaveLength(1);

    try {
      const resultat = await creerIntervention(SESSION, saisie, clientApp());
      expect(resultat.accepte && resultat.fiche.machines).toHaveLength(1);
    } finally {
      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "intervention" WHERE "id" = '${id}'`,
      );
    }
  });

  it("l'index REFUSE un vrai doublon — le dédoublonnage n'est pas la seule garantie", async () => {
    // Le second verrou, et il ne recouvre pas le premier : la saisie corrige une
    // maladresse, l'index refuse une écriture qui viendrait d'ailleurs.
    await surUneInterventionJetable("curatif", async (jetable) => {
      await clientOwner().$executeRawUnsafe(
        `INSERT INTO "intervention_machine" ("id", "societe_id", "intervention_id", "machine_id", "modifie_le")
         VALUES ('${uuidv7()}', '${SOCIETE_A}', '${jetable}', '${MACHINE_A1}', now())`,
      );
      await expect(
        clientOwner().$executeRawUnsafe(
          `INSERT INTO "intervention_machine" ("id", "societe_id", "intervention_id", "machine_id", "modifie_le")
           VALUES ('${uuidv7()}', '${SOCIETE_A}', '${jetable}', '${MACHINE_A1}', now())`,
        ),
        // L'assertion NOMME la contrainte (§9, 24/08), et elle la nomme telle
        // que PostgreSQL la rend : par ses COLONNES. *Un `toThrow()` nu aurait
        // accepté n'importe quel refus — une clé étrangère, une politique —, et
        // c'est ainsi qu'un jumeau finit par mesurer le voisin.*
      ).rejects.toThrow(/Key \(intervention_id, machine_id\)=.*already exists/);
    });
  });

  it("la CASCADE est réelle : supprimer l'intervention emporte ses rattachements", async () => {
    // L'action référentielle est une règle de gestion déguisée (§9, 24/08) :
    // elle se mesure, elle ne se déclare pas.
    const id = uuidv7();
    await surUneInterventionJetable("curatif", async (jetable) => {
      await clientOwner().$executeRawUnsafe(
        `INSERT INTO "intervention_machine" ("id", "societe_id", "intervention_id", "machine_id", "modifie_le")
         VALUES ('${id}', '${SOCIETE_A}', '${jetable}', '${MACHINE_A1}', now())`,
      );
      const [avant] = await clientOwner().$queryRawUnsafe<Array<{ n: bigint }>>(
        `SELECT count(*) AS n FROM "intervention_machine" WHERE "id" = '${id}'`,
      );
      expect(Number(avant?.n ?? 0)).toBe(1);
    });
    // `surUneInterventionJetable` a supprimé l'intervention en sortant.
    const [apres] = await clientOwner().$queryRawUnsafe<Array<{ n: bigint }>>(
      `SELECT count(*) AS n FROM "intervention_machine" WHERE "id" = '${id}'`,
    );
    expect(Number(apres?.n ?? 0)).toBe(0);
  });
});
