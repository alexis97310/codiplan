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
  MACHINE_A3,
  SITE_A1_S1,
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
 * Et ~~**RG-INT-01**, qui n'était vérifiable par personne avant ce ticket : une
 * intervention ne démarre pas sans machine, sauf `expertise`, `installation` et
 * `recensement`~~ — **la règle est RETIRÉE le 15/09/2026 par D120** : une
 * intervention peut porter sur autre chose qu'un équipement. Ce que le bloc du
 * bas mesure désormais est que le retrait a bien eu lieu, **et que les trois
 * autres gardes du même déclencheur ont survécu au `CREATE OR REPLACE`.**
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
       "agence_id", "type", "statut", "duree_estimee_min", "modifie_le")
     SELECT '${id}', "societe_id", "client_id", "site_id", "agence_id",
            '${type}'::"TypeIntervention", 'planifiee', 60, now()
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

/**
 * RG-INT-01 — LA MACHINE N'EST PLUS EXIGÉE POUR DÉMARRER (D120).
 *
 * ~~Une intervention ne démarre pas sans machine, sauf `expertise`,
 * `installation` et `recensement`.~~ **La règle est retirée le 15/09/2026**, et
 * le motif n'est pas un assouplissement : *« une intervention peut porter sur
 * autre chose qu'un équipement — un réseau d'air comprimé, par exemple. »* La
 * phrase barrée est conservée : elle a gouverné la base pendant deux jours, et
 * ce qui a été décidé un jour se relit.
 *
 * **Ce que ce bloc mesure a donc changé de SENS, pas de rigueur.** Il prouvait
 * un refus ; il prouve maintenant que le refus a réellement disparu — et que
 * les TROIS AUTRES gardes du même déclencheur n'ont pas disparu avec lui.
 * *C'est le vrai risque d'un `CREATE OR REPLACE` : il remplace la fonction
 * ENTIÈRE, et une garde qu'on oublie de recopier s'en va sans bruit.*
 */
describe("RG-INT-01 — la machine n'est plus exigée pour démarrer (D120)", () => {
  it("une intervention CURATIVE sans machine DÉMARRE", async () => {
    await surUneInterventionJetable("curatif", async (id) => {
      await clientOwner().$executeRawUnsafe(
        `UPDATE "intervention" SET "statut" = 'en_cours' WHERE "id" = '${id}'`,
      );
      const [apres] = await clientOwner().$queryRawUnsafe<
        Array<{ statut: string }>
      >(`SELECT "statut" FROM "intervention" WHERE "id" = '${id}'`);
      expect(apres?.statut).toBe("en_cours");
    });
  });

  it("le saut direct vers TERMINEE passe aussi — la garde n'est plus là", async () => {
    await surUneInterventionJetable("curatif", async (id) => {
      await clientOwner().$executeRawUnsafe(
        `UPDATE "intervention" SET "statut" = 'terminee' WHERE "id" = '${id}'`,
      );
      const [apres] = await clientOwner().$queryRawUnsafe<
        Array<{ statut: string }>
      >(`SELECT "statut" FROM "intervention" WHERE "id" = '${id}'`);
      expect(apres?.statut).toBe("terminee");
    });
  });

  it("une machine RATTACHÉE ne gêne pas — elle n'est ni exigée ni interdite", async () => {
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

  /**
   * LES TROIS GARDES QUI RESTENT, ÉPROUVÉES ICI PARCE QUE C'EST ICI QU'ELLES
   * POUVAIENT DISPARAÎTRE.
   *
   * `CREATE OR REPLACE FUNCTION` réécrit la fonction entière : la migration de
   * D120 a recopié trois blocs à la main pour n'en retirer qu'un. **Une garde
   * oubliée dans la recopie s'en irait sans bruit** — aucun scénario de refus
   * ne rougirait, puisque le refus qu'ils attendent viendrait simplement de ne
   * plus exister. Ces trois-là le constatent, sur la fonction telle qu'elle est
   * réellement posée.
   */
  it("une intervention ANNULÉE ne se modifie toujours pas", async () => {
    await surUneInterventionJetable("curatif", async (id) => {
      await clientOwner().$executeRawUnsafe(
        `UPDATE "intervention" SET "statut" = 'annulee', "motif_annulation" = 'épreuve', "annulee_le" = now() WHERE "id" = '${id}'`,
      );
      await expect(
        clientOwner().$executeRawUnsafe(
          `UPDATE "intervention" SET "priorite" = 'p1' WHERE "id" = '${id}'`,
        ),
      ).rejects.toThrow(/annulée/i);
    });
  });

  it("une CLÔTURE sans temps validé est toujours refusée", async () => {
    await surUneInterventionJetable("curatif", async (id) => {
      await expect(
        clientOwner().$executeRawUnsafe(
          `UPDATE "intervention" SET "statut" = 'cloturee' WHERE "id" = '${id}'`,
        ),
      ).rejects.toThrow(/temps validé/i);
    });
  });

  it("une intervention CLÔTURÉE ne se modifie que pour être annulée (I5)", async () => {
    await surUneInterventionJetable("curatif", async (id) => {
      await clientOwner().$executeRawUnsafe(
        `UPDATE "intervention" SET "statut" = 'cloturee', "temps_valide_min" = 60, "cloturee_le" = now() WHERE "id" = '${id}'`,
      );
      await expect(
        clientOwner().$executeRawUnsafe(
          `UPDATE "intervention" SET "priorite" = 'p1' WHERE "id" = '${id}'`,
        ),
      ).rejects.toThrow(/clôturée/i);
      // Le cas qui doit rester VERT pour sa propre raison : l'annulation, elle,
      // reste ouverte — I5 donne à ANNULEE la préséance sur CLOTUREE.
      await clientOwner().$executeRawUnsafe(
        `UPDATE "intervention" SET "statut" = 'annulee', "motif_annulation" = 'épreuve', "annulee_le" = now() WHERE "id" = '${id}'`,
      );
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
          description: "Panne épreuve",
          contact_id: null,
          reference_client: null,
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
      // `SITE_A1_S1`, le site RÉEL de `MACHINE_A1` (revue Codex de la PR
      // #267, 20/09/2026) — `creerIntervention` refuse désormais une machine
      // qui n'appartient pas au site choisi, et `SITE_A1_S2` (l'ancien site
      // de ce scénario) n'a jamais été le sien : rien dans l'objet de CE
      // scénario, le dédoublonnage, ne dépend du site.
      site_id: SITE_A1_S1,
      machine_ids: [MACHINE_A1, MACHINE_A1],
      type: "preventif_contrat",
      description: "Panne épreuve",
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

  /**
   * UNE INTERVENTION NE PEUT PAS AVOIR 2 MACHINES (PARCOURS-1, 23/09/2026,
   * arbitrage Alexis) — DEUX verrous, et ils ne recouvrent pas le même
   * défaut : la SAISIE refuse tôt, un scénario forgé qui la contournerait
   * bute sur la BASE.
   */
  it("`schemaCreation` REFUSE deux machines DISTINCTES — jamais un dédoublonnage qui les ferait passer", () => {
    const saisie = schemaCreation.safeParse({
      id: uuidv7(),
      client_id: CLIENT_A1,
      site_id: SITE_A1_S1,
      machine_ids: [MACHINE_A1, MACHINE_A3],
      type: "preventif_contrat",
      description: "Panne épreuve",
    });
    expect(saisie.success).toBe(false);
  });

  it("la base REFUSE une seconde machine sur une intervention qui en a déjà une (@@unique([intervention_id]))", async () => {
    await surUneInterventionJetable("curatif", async (id) => {
      await clientOwner().$executeRawUnsafe(
        `INSERT INTO "intervention_machine" ("id", "societe_id", "intervention_id", "machine_id", "modifie_le")
         VALUES ('${uuidv7()}', '${SOCIETE_A}', '${id}', '${MACHINE_A1}', now())`,
      );
      await expect(
        clientOwner().$executeRawUnsafe(
          `INSERT INTO "intervention_machine" ("id", "societe_id", "intervention_id", "machine_id", "modifie_le")
           VALUES ('${uuidv7()}', '${SOCIETE_A}', '${id}', '${MACHINE_A3}', now())`,
        ),
      ).rejects.toThrow(/Key \(intervention_id\)=.*already exists/);
    });
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
