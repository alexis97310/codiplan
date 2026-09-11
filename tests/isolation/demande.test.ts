import { afterAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import {
  accuserReception,
  cloreSansSuite,
  demandesOuvertes,
  deposerDemande,
  marquerTransformee,
  qualifierDemande,
} from "@/lib/demandes/depot";
import {
  peutCloreSansSuite,
  peutQualifier,
  peutTransformer,
} from "@/lib/demandes/cycle-de-vie";
import { STATUTS_DEMANDE, type StatutDemande } from "@/lib/demandes/saisie";
import { uuidv7 } from "@/lib/db/uuid";

import { avecPortail, clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  CLIENT_A1,
  CLIENT_A2,
  DEMANDE_A1,
  DEMANDE_A2,
  DEMANDE_B1,
  SITE_A1_S1,
  SITE_A1_S2,
  SITE_A2_S1,
  SOCIETE_A,
  UTILISATEUR_INTERNE_A,
} from "./setup/fixtures";

/**
 * LA DEMANDE D'INTERVENTION — cloisonnement et cycle de vie (L2-06, D102).
 *
 * ## Ce que ce fichier confronte, et qui n'est éprouvé nulle part ailleurs
 *
 * `lib/demandes/cycle-de-vie.ts` refuse en TypeScript ce que le déclencheur
 * `demande_cycle_de_vie` refuse en PostgreSQL. **Deux lectures d'un même
 * critère divergent en silence** (§9, 01/09) : chacune resterait juste sur sa
 * propre population, et le trou vivrait entre les deux. Ici elles répondent
 * l'une à côté de l'autre, sur les mêmes transitions.
 *
 * ## La forme « parc » (D102)
 *
 * P5 du chapitre 9 fait DÉPOSER une demande par un compte de portail : c'est la
 * seule table du lot 2 où un client écrit. La clause de société seule y aurait
 * été plus qu'une fuite de lecture.
 */

afterAll(fermerClients);

const SESSION_INTERNE = {
  utilisateurId: UTILISATEUR_INTERNE_A,
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

/**
 * Met une demande jetable DANS un statut, **par le chemin légal**.
 *
 * *La première rédaction posait le statut directement en `UPDATE`, et le
 * déclencheur l'a refusé* — ce qui est exactement ce qu'il doit faire. Un
 * arrangement qui contourne le verrou qu'on éprouve place le scénario dans la
 * configuration où le défaut échoue autrement (§9, 24/08).
 */
async function amener(id: string, vers: StatutDemande): Promise<void> {
  if (vers === "nouvelle") {
    return;
  }
  await clientOwner().$executeRawUnsafe(
    `UPDATE "demande" SET "statut" = 'qualifiee' WHERE "id" = '${id}'`,
  );
  if (vers === "qualifiee") {
    return;
  }
  if (vers === "transformee") {
    await clientOwner().$executeRawUnsafe(
      `UPDATE "demande" SET "statut" = 'transformee' WHERE "id" = '${id}'`,
    );
    return;
  }
  await clientOwner().$executeRawUnsafe(
    `UPDATE "demande" SET "statut" = 'close_sans_suite',
       "motif_cloture" = 'doublon', "close_le" = now() WHERE "id" = '${id}'`,
  );
}

/** Une demande jetable, remise à son état initial après le scénario. */
async function surUneDemandeJetable(
  travail: (id: string) => Promise<void>,
): Promise<void> {
  const id = uuidv7();
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "demande" ("id", "societe_id", "source", "client_id", "site_id",
       "agence_id", "description", "depose_le", "compteur_accuse_le", "modifie_le")
     SELECT '${id}', "societe_id", 'appel', "client_id", "site_id", "agence_id",
            'jetable', now(), now(), now()
       FROM "demande" WHERE "id" = '${DEMANDE_A1}'`,
  );
  try {
    await travail(id);
  } finally {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "demande" WHERE "id" = '${id}'`,
    );
  }
}

describe("le cloisonnement de la demande est de forme « parc » (D102)", () => {
  it("TÉMOIN — la politique est en vigueur et elle MORD", async () => {
    // *Toute mesure d'une politique porte un témoin préalable* (§9, 07/09) :
    // les DEUX drapeaux, jamais un seul, et zéro ligne sans contexte. Sans lui,
    // une base reconstruite entre-temps rendrait un vert qui ne parle de rien.
    const [drapeaux] = await clientOwner().$queryRawUnsafe<
      Array<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>
    >(
      `SELECT "relrowsecurity", "relforcerowsecurity" FROM pg_class WHERE relname = 'demande'`,
    );
    expect(drapeaux).toEqual({
      relrowsecurity: true,
      relforcerowsecurity: true,
    });

    const sansContexte = await clientApp().demande.findMany({
      select: { id: true },
    });
    expect(sansContexte).toEqual([]);
  });

  it("un utilisateur interne voit les demandes de SA société, et rien d'une autre", async () => {
    const vues = await demandesOuvertes(SESSION_INTERNE, clientApp());
    const ids = vues.map((d) => d.id);
    expect(ids).toContain(DEMANDE_A1);
    expect(ids).toContain(DEMANDE_A2);
    expect(ids).not.toContain(DEMANDE_B1);
  });

  it("un compte portail ne voit QUE son client — le second filtre mord", async () => {
    // Sans `app.client_id`, la forme « parc » se lit « utilisateur interne » et
    // OUVRE (§9, 09/09). A2 est de la MÊME société que A1 : c'est ce qui
    // distingue « autre client » de « autre société ».
    const vues = await avecPortail(
      { societeId: SOCIETE_A, clientId: CLIENT_A2 },
      (tx) => tx.demande.findMany({ select: { id: true } }),
    );
    expect(vues.map((d) => d.id)).not.toContain(DEMANDE_A1);
    expect(vues.map((d) => d.id)).not.toContain(DEMANDE_A2);
  });

  it("un compte portail RESTREINT perd la demande de l'autre site — le troisième filtre mord", async () => {
    const vues = await avecPortail(
      {
        societeId: SOCIETE_A,
        clientId: CLIENT_A1,
        perimetreSites: [SITE_A1_S1],
      },
      (tx) => tx.demande.findMany({ select: { id: true } }),
    );
    const ids = vues.map((d) => d.id);
    // Le cas qui doit rester VERT pour sa propre raison : sans lui, une
    // politique qui refuserait tout passerait la moitié refusante.
    expect(ids).toContain(DEMANDE_A1);
    expect(ids).not.toContain(DEMANDE_A2);
  });

  it("le MÊME compte, périmètre élargi, retrouve les deux — c'est bien le périmètre qui décide", async () => {
    const vues = await avecPortail(
      {
        societeId: SOCIETE_A,
        clientId: CLIENT_A1,
        perimetreSites: [SITE_A1_S1, SITE_A1_S2],
      },
      (tx) => tx.demande.findMany({ select: { id: true } }),
    );
    expect(vues.map((d) => d.id).sort()).toEqual(
      [DEMANDE_A1, DEMANDE_A2].sort(),
    );
  });
});

describe("le cycle de vie : la BASE refuse ce que le module refuse", () => {
  /** Les transitions que le module refuse, jouées contre la base. */
  const REFUSEES: ReadonlyArray<{
    depuis: StatutDemande;
    vers: StatutDemande;
    action: (statut: StatutDemande) => { refuse: boolean };
  }> = [
    {
      depuis: "transformee",
      vers: "close_sans_suite",
      action: peutCloreSansSuite,
    },
    { depuis: "close_sans_suite", vers: "qualifiee", action: peutQualifier },
    { depuis: "nouvelle", vers: "transformee", action: peutTransformer },
  ];

  it("la population couvre l'énumération — sans quoi la confrontation est creuse", () => {
    // Témoin : chaque statut figé apparaît au moins une fois comme point de
    // départ, et `transformee` comme cible interdite depuis `nouvelle`.
    expect(REFUSEES.length).toBeGreaterThan(2);
    expect(STATUTS_DEMANDE).toContain("transformee");
  });

  it.each(REFUSEES)(
    "de « $depuis » vers « $vers » : le module refuse, et la base aussi",
    async ({ depuis, vers, action }) => {
      // 1. LE MODULE refuse.
      expect(action(depuis).refuse).toBe(true);

      // 2. LA BASE refuse la même chose, sur une vraie ligne.
      await surUneDemandeJetable(async (id) => {
        await amener(id, depuis);
        await expect(
          clientOwner().$executeRawUnsafe(
            `UPDATE "demande" SET "statut" = '${vers}'${
              vers === "close_sans_suite"
                ? `, "motif_cloture" = 'doublon', "close_le" = now()`
                : ""
            } WHERE "id" = '${id}'`,
          ),
        ).rejects.toThrow(/statut|transformée|close sans suite|QUALIFIEE/i);
      });
    },
  );

  it("JUMEAU — le déclencheur retiré, l'écriture fautive PASSE", async () => {
    // *Un test de refus prouve que le verrou mordait le jour où on l'a écrit*
    // (§9, 24/08). Le jumeau retire LE verrou visé — le déclencheur, pas une
    // contrainte voisine — dans une transaction annulée, et montre la
    // transition interdite réussir.
    await surUneDemandeJetable(async (id) => {
      await amener(id, "transformee");
      await expect(
        clientOwner().$transaction(async (tx) => {
          await tx.$executeRawUnsafe(
            `DROP TRIGGER "demande_cycle_de_vie" ON "demande"`,
          );
          await tx.$executeRawUnsafe(
            `UPDATE "demande" SET "statut" = 'qualifiee' WHERE "id" = '${id}'`,
          );
          const [apres] = await tx.$queryRawUnsafe<Array<{ statut: string }>>(
            `SELECT "statut" FROM "demande" WHERE "id" = '${id}'`,
          );
          expect(apres?.statut).toBe("qualifiee");
          throw new Error("rollback voulu");
        }),
      ).rejects.toThrow("rollback voulu");

      // Le déclencheur est revenu avec l'annulation, et il mord de nouveau.
      await expect(
        clientOwner().$executeRawUnsafe(
          `UPDATE "demande" SET "statut" = 'qualifiee' WHERE "id" = '${id}'`,
        ),
      ).rejects.toThrow(/transformée/i);
    });
  });

  it("une clôture SANS motif est refusée, et un motif SANS clôture aussi", async () => {
    // *Le second sens est celui qu'on oublie.* Une clôture sans motif effacerait
    // la mesure du service rendu à distance ; un motif posé sur une demande qui
    // suit son cours dirait qu'elle est close alors qu'elle ne l'est pas.
    await surUneDemandeJetable(async (id) => {
      await expect(
        clientOwner().$executeRawUnsafe(
          `UPDATE "demande" SET "statut" = 'close_sans_suite', "close_le" = now() WHERE "id" = '${id}'`,
        ),
      ).rejects.toThrow(/demande_cloture_a_son_motif/);

      await expect(
        clientOwner().$executeRawUnsafe(
          `UPDATE "demande" SET "motif_cloture" = 'doublon' WHERE "id" = '${id}'`,
        ),
      ).rejects.toThrow(/demande_cloture_a_son_motif/);
    });
  });
});

describe("le dépôt et les quatre actions, à travers le contexte de production", () => {
  it("une demande déposée porte son agence et son départ de compteur, DÉDUITS", async () => {
    const id = uuidv7();
    try {
      const pose = await deposerDemande(
        SESSION_INTERNE,
        {
          id,
          source: "appel",
          client_id: CLIENT_A1,
          site_id: SITE_A1_S1,
          machine_id: null,
          contact_id: null,
          description: "Bruit anormal au démarrage",
          urgence: "p2",
          machine_arretee: true,
          date_souhaitee: null,
        },
        clientApp(),
      );
      expect(pose.accepte).toBe(true);
      if (!pose.accepte) return;

      // L'agence n'a pas été saisie : elle vient du site (D56).
      expect(pose.fiche.agence_id).not.toBeNull();
      expect(pose.fiche.statut).toBe("nouvelle");
      expect(pose.fiche.accuse_le).toBeNull();
      // Le départ du compteur n'est jamais AVANT le dépôt (D13).
      expect(pose.fiche.compteur_accuse_le.getTime()).toBeGreaterThanOrEqual(
        pose.fiche.depose_le.getTime(),
      );

      // Accuser, qualifier, transformer — et le second accusé est refusé.
      const accuse = await accuserReception(SESSION_INTERNE, id, clientApp());
      expect(accuse.accepte).toBe(true);
      const second = await accuserReception(SESSION_INTERNE, id, clientApp());
      expect(second).toEqual({
        accepte: false,
        cle: "demande.refus.deja_accusee",
      });

      const transformerTrop_tot = await marquerTransformee(
        SESSION_INTERNE,
        id,
        clientApp(),
      );
      expect(transformerTrop_tot).toEqual({
        accepte: false,
        cle: "demande.refus.transformer_sans_qualifier",
      });

      expect(
        (await qualifierDemande(SESSION_INTERNE, id, clientApp())).accepte,
      ).toBe(true);
      const transformee = await marquerTransformee(
        SESSION_INTERNE,
        id,
        clientApp(),
      );
      expect(transformee.accepte && transformee.fiche.statut).toBe(
        "transformee",
      );

      // Et une demande transformée ne se clôt plus.
      const close = await cloreSansSuite(
        SESSION_INTERNE,
        { id, motif: "doublon" },
        clientApp(),
      );
      expect(close).toEqual({
        accepte: false,
        cle: "demande.refus.deja_transformee",
      });
    } finally {
      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "demande" WHERE "id" = '${id}'`,
      );
    }
  });

  it("clore sans suite écrit le motif, et la demande sort de la file", async () => {
    await surUneDemandeJetable(async (id) => {
      const close = await cloreSansSuite(
        SESSION_INTERNE,
        { id, motif: "resolue_telephone" },
        clientApp(),
      );
      expect(close.accepte && close.fiche.motif_cloture).toBe(
        "resolue_telephone",
      );
      expect(close.accepte && close.fiche.close_le).not.toBeNull();

      const file = await demandesOuvertes(SESSION_INTERNE, clientApp());
      expect(file.map((d) => d.id)).not.toContain(id);
    });
  });

  it("un site d'un AUTRE client est refusé — et par la lecture, pas par une comparaison", async () => {
    const refus = await deposerDemande(
      SESSION_INTERNE,
      {
        id: uuidv7(),
        source: "appel",
        client_id: CLIENT_A1,
        // Le site du client A2 — MÊME société. C'est ce qui distingue « autre
        // client » de « autre société » : sous une clause de société seule, ce
        // dépôt passerait.
        site_id: SITE_A2_S1,
        machine_id: null,
        contact_id: null,
        description: "Site qui n'est pas le sien",
        urgence: "p3",
        machine_arretee: false,
        date_souhaitee: null,
      },
      clientApp(),
    );
    expect(refus).toEqual({
      accepte: false,
      cle: "demande.refus.lieu_inconnu",
    });
  });
});

describe("l'audit (I8, D55) ne se demande pas, il est réclamé par le schéma", () => {
  it("le dépôt d'une demande laisse une ligne au journal", async () => {
    await surUneDemandeJetable(async (id) => {
      await qualifierDemande(SESSION_INTERNE, id, clientApp());
      const traces = await clientOwner().$queryRawUnsafe<
        Array<{ action: string }>
      >(
        `SELECT "action" FROM "journal_audit" WHERE "entite" = 'demande' AND "entite_id" = '${id}'`,
      );
      // Le témoin est le DÉCOMPTE NON NUL : un journal vide ressemble trop à un
      // journal sain (§9, 30/08).
      expect(traces.length).toBeGreaterThan(0);
    });
  });
});
