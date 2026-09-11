import { afterAll, afterEach, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import {
  enAttenteDePiece,
  reprendreIntervention,
  suspendreIntervention,
} from "@/lib/interventions/depot";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  INTERVENTION_A1,
  SOCIETE_A,
  UTILISATEUR_INTERNE_A,
} from "./setup/fixtures";

/**
 * LA SUSPENSION, ET LA FILE « EN ATTENTE DE PIÈCE » (L2-10, RG-INT-06).
 *
 * **Ce fichier confronte le module et la base.** `cycle-de-vie.ts` explique le
 * refus avant l'action ; les contraintes et le déclencheur de la migration le
 * tiennent quoi qu'il arrive. *Deux lectures d'un même critère divergent en
 * silence* (§9, 01/09) — ici elles répondent l'une à côté de l'autre.
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

const jetables: string[] = [];

afterEach(async () => {
  for (const id of jetables.splice(0)) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = '${id}'`,
    );
  }
});

/** Une intervention planifiée, jetable, du client du périmètre. */
async function jetable(): Promise<string> {
  const id = uuidv7();
  jetables.push(id);
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention" ("id","societe_id","client_id","site_id","agence_id",
       "type","statut","date_planifiee","modifie_le")
     SELECT '${id}', "societe_id", "client_id", "site_id", "agence_id",
            'curatif', 'planifiee', DATE '2026-09-14', now()
       FROM "intervention" WHERE "id" = '${INTERVENTION_A1}'`,
  );
  return id;
}

describe("la base tient RG-INT-06, et pas seulement l'écran", () => {
  it("une suspension SANS motif est refusée, et la contrainte est nommée", async () => {
    const id = await jetable();
    await expect(
      clientOwner().$executeRawUnsafe(
        `UPDATE "intervention" SET "statut" = 'suspendue', "suspendue_le" = now()
          WHERE "id" = '${id}'`,
      ),
    ).rejects.toThrow(/intervention_suspension_a_son_motif/);
  });

  it("un motif SANS suspension est refusé aussi — le sens qu'on oublie", async () => {
    const id = await jetable();
    await expect(
      clientOwner().$executeRawUnsafe(
        `UPDATE "intervention" SET "motif_suspension" = 'Attente' WHERE "id" = '${id}'`,
      ),
    ).rejects.toThrow(/intervention_suspension_a_son_motif/);
  });

  it("une référence de pièce SANS date est refusée — une file sans horizon", async () => {
    const id = await jetable();
    await expect(
      clientOwner().$executeRawUnsafe(
        `UPDATE "intervention" SET "statut" = 'suspendue', "motif_suspension" = 'Pièce',
            "suspendue_le" = now(), "piece_attendue_ref" = 'CMP-1'
          WHERE "id" = '${id}'`,
      ),
    ).rejects.toThrow(/intervention_piece_attendue_a_son_horizon/);
  });

  it("une attente de pièce SANS suspension est refusée", async () => {
    const id = await jetable();
    await expect(
      clientOwner().$executeRawUnsafe(
        `UPDATE "intervention" SET "piece_attendue_ref" = 'CMP-1',
            "date_dispo_prevue" = DATE '2026-10-01' WHERE "id" = '${id}'`,
      ),
    ).rejects.toThrow(/intervention_piece_attendue_suppose_la_suspension/);
  });

  it("JUMEAU — la contrainte retirée, la suspension sans motif PASSE", async () => {
    // *Un test de refus prouve que le verrou mordait le jour où on l'a écrit*
    // (§9, 24/08). Le jumeau retire LE verrou visé, dans une transaction
    // annulée, et vérifie que l'écriture fautive a bien eu lieu.
    const id = await jetable();
    await expect(
      clientOwner().$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `ALTER TABLE "intervention" DROP CONSTRAINT "intervention_suspension_a_son_motif"`,
        );
        await tx.$executeRawUnsafe(
          `UPDATE "intervention" SET "statut" = 'suspendue', "suspendue_le" = now()
            WHERE "id" = '${id}'`,
        );
        const [apres] = await tx.$queryRawUnsafe<
          Array<{ statut: string; motif_suspension: string | null }>
        >(
          `SELECT "statut", "motif_suspension" FROM "intervention" WHERE "id" = '${id}'`,
        );
        // LA SONDE : la violation a-t-elle bien eu lieu ?
        expect(apres?.statut).toBe("suspendue");
        expect(apres?.motif_suspension).toBeNull();
        throw new Error("rollback voulu");
      }),
    ).rejects.toThrow("rollback voulu");

    // La contrainte est revenue avec l'annulation, et elle mord de nouveau.
    await expect(
      clientOwner().$executeRawUnsafe(
        `UPDATE "intervention" SET "statut" = 'suspendue', "suspendue_le" = now()
          WHERE "id" = '${id}'`,
      ),
    ).rejects.toThrow(/intervention_suspension_a_son_motif/);
  });
});

describe("suspendre et reprendre, par le chemin de production", () => {
  it("la suspension écrit le motif, la pièce et l'instant — daté par le serveur", async () => {
    const id = await jetable();
    const resultat = await suspendreIntervention(
      SESSION,
      {
        intervention_id: id,
        motif: "Attente de pièce fournisseur",
        piece_attendue_ref: "CMP-4417-B",
        date_dispo_prevue: new Date("2026-10-01T00:00:00.000Z"),
      },
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);
    if (!resultat.accepte) return;
    expect(resultat.fiche.statut).toBe("suspendue");
    expect(resultat.fiche.motif_suspension).toBe(
      "Attente de pièce fournisseur",
    );
    expect(resultat.fiche.piece_attendue_ref).toBe("CMP-4417-B");
    expect(resultat.fiche.suspendue_le).not.toBeNull();
  });

  it("la REPRISE efface ce qui ne vaut plus — et c'est la BASE qui le fait", async () => {
    // *Laisser l'appelant remettre les colonnes à NULL serait une seconde
    // lecture du même critère* : le déclencheur `intervention_sortie_de_suspension`
    // s'en charge, parce que les contraintes l'exigent déjà.
    const id = await jetable();
    await suspendreIntervention(
      SESSION,
      {
        intervention_id: id,
        motif: "Attente de pièce",
        piece_attendue_ref: "CMP-4417-B",
        date_dispo_prevue: new Date("2026-10-01T00:00:00.000Z"),
      },
      clientApp(),
    );
    const reprise = await reprendreIntervention(
      SESSION,
      { intervention_id: id },
      clientApp(),
    );
    expect(reprise.accepte).toBe(true);
    if (!reprise.accepte) return;

    // Le statut vient du CRÉNEAU, pas de ce qu'il était avant : la jetable
    // porte une date sans heure, donc `planifiee`.
    expect(reprise.fiche.statut).toBe("planifiee");
    expect(reprise.fiche.motif_suspension).toBeNull();
    expect(reprise.fiche.piece_attendue_ref).toBeNull();
    expect(reprise.fiche.date_dispo_prevue).toBeNull();
    expect(reprise.fiche.suspendue_le).toBeNull();
  });

  it("une seconde suspension est refusée — l'ancienneté ne se rajeunit pas", async () => {
    const id = await jetable();
    await suspendreIntervention(
      SESSION,
      {
        intervention_id: id,
        motif: "Première",
        piece_attendue_ref: null,
        date_dispo_prevue: null,
      },
      clientApp(),
    );
    const seconde = await suspendreIntervention(
      SESSION,
      {
        intervention_id: id,
        motif: "Seconde",
        piece_attendue_ref: null,
        date_dispo_prevue: null,
      },
      clientApp(),
    );
    expect(seconde).toEqual({
      accepte: false,
      cle: "intervention.refus.deja_suspendue",
    });
  });
});

describe("la file « en attente de pièce » et son ancienneté", () => {
  it("ne retient QUE les attentes de pièce, et les ordonne de la plus vieille", async () => {
    const vieille = await jetable();
    const recente = await jetable();
    const sansPiece = await jetable();

    // LES DEUX HORIZONS SE CALCULENT DEPUIS L'INSTANT DU SCÉNARIO, jamais
    // écrits en dur. *Une date de 2026 écrite à la main rend le scénario vert
    // ou rouge selon le jour où on le joue* — c'est la faute que ce fichier a
    // commise à sa première rédaction : le « 20 septembre » choisi comme passé
    // était encore à venir, et `horizonDepasse` valait `false`.
    const MS_PAR_JOUR = 24 * 60 * 60 * 1000;
    const horizonPasse = new Date(Date.now() - 5 * MS_PAR_JOUR);
    const horizonAVenir = new Date(Date.now() + 30 * MS_PAR_JOUR);

    await suspendreIntervention(
      SESSION,
      {
        intervention_id: vieille,
        motif: "Pièce",
        piece_attendue_ref: "VIEUX-1",
        date_dispo_prevue: horizonPasse,
      },
      clientApp(),
    );
    await suspendreIntervention(
      SESSION,
      {
        intervention_id: recente,
        motif: "Pièce",
        piece_attendue_ref: "RECENT-1",
        date_dispo_prevue: horizonAVenir,
      },
      clientApp(),
    );
    await suspendreIntervention(
      SESSION,
      {
        intervention_id: sansPiece,
        motif: "Client absent",
        piece_attendue_ref: null,
        date_dispo_prevue: null,
      },
      clientApp(),
    );

    // La plus vieille est antidatée de 40 jours — le harnais date au serveur.
    await clientOwner().$executeRawUnsafe(
      `UPDATE "intervention" SET "suspendue_le" = now() - interval '40 days'
        WHERE "id" = '${vieille}'`,
    );

    const maintenant = new Date();
    const file = await enAttenteDePiece(SESSION, maintenant, clientApp());
    const ids = file.map((l) => l.ligne.id);

    // *Une suspension qui n'attend pas de pièce n'est pas dans cette file* :
    // le témoin est qu'elle existe, suspendue, et n'y figure pas.
    expect(ids).toContain(vieille);
    expect(ids).toContain(recente);
    expect(ids).not.toContain(sansPiece);
    // L'ordre est celui de l'ancienneté : la plus vieille d'abord.
    expect(ids.indexOf(vieille)).toBeLessThan(ids.indexOf(recente));

    const ligneVieille = file.find((l) => l.ligne.id === vieille);
    expect(ligneVieille?.ancienneteJours).toBeGreaterThanOrEqual(40);
    // Sa date de disponibilité est passée : l'horizon est dépassé.
    expect(ligneVieille?.horizonDepasse).toBe(true);
    // Et celle de la récente ne l'est pas — le témoin qui sépare les deux.
    expect(file.find((l) => l.ligne.id === recente)?.horizonDepasse).toBe(
      false,
    );
  });

  it("l'instant est un PARAMÈTRE : la même file, deux instants, deux anciennetés", async () => {
    // *Lu dans le module, il rendrait un scénario vert parce que l'horloge a
    // bougé.* Ici c'est l'appelant qui le fournit, et la mesure le montre.
    const id = await jetable();
    await suspendreIntervention(
      SESSION,
      {
        intervention_id: id,
        motif: "Pièce",
        piece_attendue_ref: "PARAM-1",
        date_dispo_prevue: new Date("2026-10-20T00:00:00.000Z"),
      },
      clientApp(),
    );

    const maintenant = new Date();
    const dansDixJours = new Date(maintenant.getTime() + 10 * 86400000);
    const [tot] = (
      await enAttenteDePiece(SESSION, maintenant, clientApp())
    ).filter((l) => l.ligne.id === id);
    const [tard] = (
      await enAttenteDePiece(SESSION, dansDixJours, clientApp())
    ).filter((l) => l.ligne.id === id);

    expect(tard!.ancienneteJours - tot!.ancienneteJours).toBe(10);
  });
});
