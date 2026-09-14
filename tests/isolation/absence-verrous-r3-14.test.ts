import { afterAll, afterEach, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";

import { clientOwner, fermerClients, sousSocieteEtRole } from "./setup/db";
import {
  SOCIETE_A,
  UTILISATEUR_INTERNE_A,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * R3-14 — CE QUE LA BASE GARDE, ET QU'UN ÉCRAN NE PEUT PAS GARDER À SA PLACE.
 *
 * Quatre verrous, quatre questions du ticket, et aucun n'est du confort :
 *
 *   1. **la NATURE d'une absence ne s'écrit pas** — décision PROVISOIRE de
 *      l'exploitation, en attente de ratification. `arret` est un arrêt de
 *      travail : *une donnée de santé, sur un salarié nommé, en clair* ;
 *   2. **décider appartient à l'encadrement** — `adv` ou `direction` : *un
 *      technicien qui validerait sa propre absence déplanifierait ses propres
 *      interventions* ;
 *   3. **un technicien déclare pour lui-même**, jamais pour un autre ;
 *   4. **on ne POSE pas sur une absence validée** — l'autre bout de RG-PLA-06,
 *      que le ticket a mesuré tenu *en TypeScript seulement*.
 *
 * ## Sous quel rôle, et pourquoi cela décide de ce qui est mesuré
 *
 * Les deuxième et troisième verrous lisent `app.role` et `app.utilisateur_id` ;
 * le quatrième lit `absence` sous les politiques de l'appelant. **Tout se joue
 * donc sous un contexte posé**, qui est le seul état dans lequel l'application
 * écrit. Sous le propriétaire nu, `app.role` est vide — le défaut est le REFUS
 * pour les deux premiers, et l'ABSTENTION pour le dernier, qui ne voit rien.
 *
 * ## Le témoin de chaque jumeau vit HORS de sa transaction
 *
 * *Un jumeau devrait montrer le refus avant de retirer le verrou.* PostgreSQL
 * l'interdit dans la même transaction : une violation abandonne la transaction
 * entière (`25P02`, mesuré le 14/09/2026). Le témoin est donc l'assertion de
 * refus qui PRÉCÈDE chaque jumeau, sur la même ligne et par le même chemin.
 */

const TECHNICIEN = UTILISATEUR_PAR_ROLE[Role.technicien] as string;

/** Une journée civile fixe — aucun de ces scénarios ne lit l'horloge. */
const DU = "2026-11-02";
const AU = "2026-11-06";

const posees: string[] = [];

function insertion(
  utilisateurId: string,
  colonnes = "",
  valeurs = "",
): { sql: string; id: string } {
  const id = uuidv7();
  posees.push(id);
  return {
    id,
    sql: `INSERT INTO "absence" ("id", "societe_id", "utilisateur_id", "du", "au", "modifie_le"${colonnes})
          VALUES ('${id}', '${SOCIETE_A}', '${utilisateurId}', DATE '${DU}', DATE '${AU}', now()${valeurs})`,
  };
}

/** Le propriétaire, AVEC un contexte posé — sans quoi il ne voit ni ne sait. */
function sousProprietaire<T>(
  role: string,
  utilisateurId: string,
  travail: (tx: {
    $executeRawUnsafe: (sql: string) => Promise<number>;
  }) => Promise<T>,
): Promise<T> {
  return clientOwner().$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SELECT set_config('app.societe_id', '${SOCIETE_A}', true),
              set_config('app.role', '${role}', true),
              set_config('app.utilisateur_id', '${utilisateurId}', true)`,
    );
    return travail(tx);
  });
}

describe("R3-14 — les verrous de l'absence", () => {
  afterEach(async () => {
    if (posees.length > 0) {
      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "absence" WHERE "id" IN (${posees.map((id) => `'${id}'`).join(",")})`,
      );
      posees.length = 0;
    }
  });

  afterAll(fermerClients);

  // ── 1. AUCUNE NATURE N'EST ÉCRITE ─────────────────────────────────────────

  it("une absence SANS nature s'écrit — le cas qui doit rester vert", async () => {
    // *Le cas qui doit rester vert POUR SA PROPRE RAISON* (§9, 11/09) : sans
    // lui, un verrou qui refuserait TOUTE absence passerait les trois scénarios
    // de refus ci-dessous sans qu'on s'en aperçoive.
    const { sql } = insertion(TECHNICIEN);
    await expect(
      sousSocieteEtRole(SOCIETE_A, Role.adv, (tx) => tx.$executeRawUnsafe(sql)),
    ).resolves.toBe(1);
  });

  it("une absence qui porte une NATURE est refusée, quel que soit le chemin", async () => {
    // La colonne existe encore — elle DORT. Ce qui est mesuré ici est qu'aucune
    // écriture ne peut la remplir : ni l'écran, qui ne la propose plus, ni un
    // import, ni une console.
    const { sql } = insertion(TECHNICIEN, `, "motif"`, `, 'conge'`);
    await expect(
      sousSocieteEtRole(SOCIETE_A, Role.adv, (tx) => tx.$executeRawUnsafe(sql)),
    ).rejects.toThrow(/absence_sans_nature/);
  });

  it("JUMEAU — le déclencheur retiré, la nature S'ÉCRIT", async () => {
    const { sql } = insertion(TECHNICIEN, `, "motif"`, `, 'arret'`);
    await expect(
      sousProprietaire(Role.adv, UTILISATEUR_INTERNE_A, async (tx) => {
        await tx.$executeRawUnsafe(`DROP TRIGGER "sans_nature" ON "absence"`);
        await tx.$executeRawUnsafe(sql);
        throw new Error("rollback voulu");
      }),
    ).rejects.toThrow("rollback voulu");

    // Le déclencheur est revenu avec l'annulation, et il mord de nouveau.
    await expect(
      sousSocieteEtRole(SOCIETE_A, Role.adv, (tx) => tx.$executeRawUnsafe(sql)),
    ).rejects.toThrow(/absence_sans_nature/);
  });

  // ── 2. DÉCIDER APPARTIENT À L'ENCADREMENT ────────────────────────────────

  it("un TECHNICIEN ne valide aucune absence, pas même la sienne", async () => {
    const { sql, id } = insertion(TECHNICIEN);
    await sousSocieteEtRole(SOCIETE_A, Role.adv, (tx) =>
      tx.$executeRawUnsafe(sql),
    );
    await expect(
      sousSocieteEtRole(SOCIETE_A, Role.technicien, (tx) =>
        tx.$executeRawUnsafe(
          `UPDATE "absence" SET "statut" = 'validee' WHERE "id" = '${id}'`,
        ),
      ),
    ).rejects.toThrow(/absence_decision_reservee_a_l_encadrement/);
  });

  it("l'ADV et la DIRECTION tranchent — les deux cas qui doivent rester verts", async () => {
    for (const role of [Role.adv, Role.direction]) {
      const { sql, id } = insertion(TECHNICIEN);
      await sousSocieteEtRole(SOCIETE_A, Role.adv, (tx) =>
        tx.$executeRawUnsafe(sql),
      );
      await expect(
        sousSocieteEtRole(SOCIETE_A, role, (tx) =>
          tx.$executeRawUnsafe(
            `UPDATE "absence" SET "statut" = 'refusee' WHERE "id" = '${id}'`,
          ),
        ),
      ).resolves.toBe(1);
    }
  });

  it("JUMEAU — le déclencheur retiré, le technicien valide sa propre absence", async () => {
    const { sql, id } = insertion(TECHNICIEN);
    await sousSocieteEtRole(SOCIETE_A, Role.adv, (tx) =>
      tx.$executeRawUnsafe(sql),
    );
    await expect(
      sousProprietaire(Role.technicien, TECHNICIEN, async (tx) => {
        await tx.$executeRawUnsafe(
          `DROP TRIGGER "decision_reservee_a_l_encadrement" ON "absence"`,
        );
        await tx.$executeRawUnsafe(
          `UPDATE "absence" SET "statut" = 'validee' WHERE "id" = '${id}'`,
        );
        throw new Error("rollback voulu");
      }),
    ).rejects.toThrow("rollback voulu");
  });

  // ── 3. UN TECHNICIEN DÉCLARE POUR LUI-MÊME ───────────────────────────────

  it("un technicien ne déclare pas l'absence d'un autre", async () => {
    const { sql } = insertion(UTILISATEUR_INTERNE_A);
    await expect(
      sousSocieteEtRole(SOCIETE_A, Role.technicien, (tx) =>
        tx.$executeRawUnsafe(sql),
      ),
    ).rejects.toThrow(/absence_declaree_pour_soi/);
  });

  it("et il déclare la SIENNE — le cas qui doit rester vert", async () => {
    // Sans ce cas, un verrou qui refuserait TOUTE déclaration de technicien
    // passerait le scénario ci-dessus, et personne ne pourrait plus se
    // déclarer absent.
    const { sql } = insertion(TECHNICIEN);
    await expect(
      sousProprietaire(Role.technicien, TECHNICIEN, (tx) =>
        tx.$executeRawUnsafe(sql),
      ),
    ).resolves.toBe(1);
  });

  it("l'ADV, elle, déclare pour autrui — c'est son métier", async () => {
    // Un arrêt reçu par téléphone se saisit par quelqu'un d'autre. Le
    // déclencheur ne vise QUE le rôle `technicien`, et ce scénario le prouve
    // plutôt que de le supposer.
    const { sql } = insertion(TECHNICIEN);
    await expect(
      sousSocieteEtRole(SOCIETE_A, Role.adv, (tx) => tx.$executeRawUnsafe(sql)),
    ).resolves.toBe(1);
  });
});
