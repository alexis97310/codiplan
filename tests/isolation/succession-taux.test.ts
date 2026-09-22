import { afterAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { avecContexteRls } from "@/lib/db/rls";
import { succederTaux } from "@/lib/tarification/succession-taux";
import { tauxEnVigueur } from "@/lib/tarification/taux-horaire";
import {
  poserTauxInitial,
  RefusTauxInitial,
} from "@/lib/tarification/taux-initial";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import { SOCIETE_A, SOCIETE_B, UTILISATEUR_PAR_ROLE } from "./setup/fixtures";

/**
 * LA SUCCESSION D'UN TAUX HORAIRE — le chemin ORDINAIRE (ticket TAUX-1).
 *
 * `taux_horaire` n'avait qu'un seul chemin d'écriture, celui de la MISE EN
 * SERVICE (`poserTauxInitial`), qui refuse dès qu'une société porte déjà un
 * taux. Ce fichier éprouve le chemin qui manquait : une société qui porte
 * DÉJÀ un taux en reçoit un SECOND, à une date postérieure, sans que le
 * premier soit touché — et l'ancien taux reste celui qu'on lit pour une date
 * antérieure à la nouvelle ligne. `poserTauxInitial` n'est pas modifiée ; ce
 * fichier vérifie seulement que les deux chemins coexistent.
 */

function contexte(societeId: string, role: Role) {
  return {
    utilisateurId: UTILISATEUR_PAR_ROLE[role],
    societeId,
    role,
    // `admin_societe` est le rôle qui paramètre la société (matrice §5.2), et
    // RG-DRO-05 lui impose un second facteur : le contexte le porte VALIDE.
    secondFacteurValide: true,
    adresseIp: null,
    clientId: null,
  };
}

function lire(societeId: string, aLaDate: string) {
  return avecContexteRls(
    clientApp(),
    { societeId, role: Role.direction },
    (tx) => tauxEnVigueur(tx, new Date(aLaDate)),
  );
}

afterAll(async () => {
  await clientOwner().$executeRawUnsafe(`DELETE FROM "taux_horaire"`);
  await fermerClients();
});

describe("une société qui porte déjà un taux en reçoit un second", () => {
  it("le second taux, à une date postérieure, ne touche pas le premier", async () => {
    const premier = await poserTauxInitial(clientApp(), {
      societeId: SOCIETE_A,
      montantMineur: BigInt(7000),
      dateEffet: "2026-01-01",
    });
    expect(premier.taux.valeur).toBe(BigInt(7000));

    const second = await succederTaux(
      contexte(SOCIETE_A, Role.admin_societe),
      { montantMineur: BigInt(7500), dateEffet: "2026-07-01" },
      clientApp(),
    );
    expect(second.accepte).toBe(true);
    if (!second.accepte) {
      return;
    }
    expect(second.dateEffet).toBe("2026-07-01");
    expect(second.taux.valeur).toBe(BigInt(7500));
    expect(second.taux.devise).toBe("XPF");

    // AVANT la nouvelle date d'effet, l'ANCIEN taux est toujours celui qui
    // s'applique — RG-TAR-04 : une facture qui change quand le tarif change
    // est une facture fausse.
    expect((await lire(SOCIETE_A, "2026-06-30"))?.taux.valeur).toBe(
      BigInt(7000),
    );
    // Le jour même de la nouvelle date d'effet, le NOUVEAU taux s'applique.
    expect((await lire(SOCIETE_A, "2026-07-01"))?.taux.valeur).toBe(
      BigInt(7500),
    );
    expect((await lire(SOCIETE_A, "2026-12-31"))?.taux.valeur).toBe(
      BigInt(7500),
    );

    // TÉMOIN : les DEUX lignes existent bel et bien, le premier montant n'a
    // pas bougé.
    const lignes = await clientOwner().$queryRawUnsafe<
      { date_effet: Date; montant_mineur: bigint }[]
    >(
      `SELECT date_effet, montant_mineur FROM "taux_horaire"
         WHERE societe_id = $1::uuid ORDER BY date_effet ASC`,
      SOCIETE_A,
    );
    expect(lignes).toHaveLength(2);
    expect(lignes[0]!.montant_mineur).toBe(BigInt(7000));
    expect(lignes[1]!.montant_mineur).toBe(BigInt(7500));
  });

  it("poserTauxInitial refuse toujours — les deux chemins coexistent sans se marcher dessus", async () => {
    await expect(
      poserTauxInitial(clientApp(), {
        societeId: SOCIETE_A,
        montantMineur: BigInt(8000),
        dateEffet: "2027-01-01",
      }),
    ).rejects.toBeInstanceOf(RefusTauxInitial);
  });
});

describe("succéder ne porte AUCUN cliquet de premier taux", () => {
  it("poser une ligne sur une société qui n'en porte encore aucune passe aussi", async () => {
    expect(await lire(SOCIETE_B, "2026-03-01")).toBeNull();

    const pose = await succederTaux(
      contexte(SOCIETE_B, Role.admin_societe),
      { montantMineur: BigInt(6500), dateEffet: "2026-01-01" },
      clientApp(),
    );
    expect(pose.accepte).toBe(true);
    if (!pose.accepte) {
      return;
    }
    // La devise vient de LA SOCIÉTÉ, jamais d'un paramètre (I2) : B est en EUR.
    expect(pose.taux.devise).toBe("EUR");
    expect(pose.devise.decimales).toBe(2);
    expect((await lire(SOCIETE_B, "2026-03-01"))?.taux.valeur).toBe(
      BigInt(6500),
    );

    // TÉMOIN DE CLOISONNEMENT : A ne voit rien de la ligne de B.
    expect((await lire(SOCIETE_A, "2026-03-01"))?.taux.devise).not.toBe("EUR");
  });
});

describe("les refus nomment leur motif, et rien n'est écrit", () => {
  it("un montant nul ou négatif est refusé, sans écrire de ligne à cette date", async () => {
    const refus = await succederTaux(
      contexte(SOCIETE_A, Role.admin_societe),
      { montantMineur: BigInt(0), dateEffet: "2028-01-01" },
      clientApp(),
    );
    expect(refus.accepte).toBe(false);
    if (!refus.accepte) {
      expect(refus.motif).toBe("montant_invalide");
    }
    // A porte déjà des lignes antérieures (décrites plus haut) : `lire`
    // rendrait leur héritage même en l'absence d'écriture. Le témoin exact
    // est donc l'ABSENCE d'une ligne datée du 2028-01-01, pas l'absence de
    // taux applicable à cette date.
    const [ligne] = await clientOwner().$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM "taux_horaire"
         WHERE societe_id = $1::uuid AND date_effet = DATE '2028-01-01'`,
      SOCIETE_A,
    );
    expect(Number(ligne?.n)).toBe(0);
  });

  it("une date mal formée est refusée, sans rien écrire", async () => {
    await expect(
      succederTaux(
        contexte(SOCIETE_A, Role.admin_societe),
        { montantMineur: BigInt(7000), dateEffet: "01/10/2026" },
        clientApp(),
      ),
    ).rejects.toThrow();
  });

  it("une seconde ligne à la MÊME date d'effet est refusée, et la première ne bouge pas", async () => {
    const premiere = await succederTaux(
      contexte(SOCIETE_A, Role.admin_societe),
      { montantMineur: BigInt(9000), dateEffet: "2029-01-01" },
      clientApp(),
    );
    expect(premiere.accepte).toBe(true);

    const doublon = await succederTaux(
      contexte(SOCIETE_A, Role.admin_societe),
      { montantMineur: BigInt(9500), dateEffet: "2029-01-01" },
      clientApp(),
    );
    expect(doublon.accepte).toBe(false);
    if (!doublon.accepte) {
      expect(doublon.motif).toBe("date_deja_utilisee");
    }

    expect((await lire(SOCIETE_A, "2029-01-01"))?.taux.valeur).toBe(
      BigInt(9000),
    );
  });
});
