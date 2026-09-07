import { afterAll, describe, expect, it } from "vitest";

import { peutPleinement } from "@/lib/auth/habilitations";
import { ROLES, Role } from "@/lib/auth/roles";

import { clientOwner, fermerClients } from "./setup/db";

/**
 * QUI PEUT ADMINISTRER LES IDENTITÉS — la base et le code disent-ils la même
 * chose ? (ticket L1-02c)
 *
 * **Deux implémentations d'un même critère divergent en silence, parce
 * qu'aucune ne prétend être l'autre** (§9, 01/09). `app_peut_administrer_identites()`
 * vit en base et gouverne les politiques d'écriture ; `lib/auth/habilitations.ts`
 * vit dans le code et gouverne l'interface. Les deux transcrivent la MÊME ligne
 * de la matrice du §5.2 — « Administrer les utilisateurs » —, et rien ne les
 * confrontait.
 *
 * Ce scénario les fait répondre **l'une à côté de l'autre, rôle par rôle, sur
 * l'énumération réelle**. La population part de `ROLES` : un onzième rôle serait
 * interrogé le jour où il est déclaré, sans qu'aucune liste soit à compléter.
 *
 * *Même forme que le contrôle jumeau de `app_peut_consulter_journal_audit`,
 * posé au ticket L0-10.*
 */

afterAll(fermerClients);

/** Ce que la BASE répond, sous un contexte portant ce rôle. */
async function baseRepond(role: Role): Promise<boolean> {
  const [ligne] = await clientOwner().$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SELECT set_config('app.role', $1, true)", role);
    return tx.$queryRawUnsafe<{ peut: boolean }[]>(
      `SELECT "app_peut_administrer_identites"() AS peut`,
    );
  });
  return ligne?.peut ?? false;
}

describe("la base et le code disent la même chose, rôle par rôle", () => {
  it("les dix rôles répondent à l'identique", async () => {
    const divergences: string[] = [];
    let vus = 0;

    for (const role of ROLES) {
      const enBase = await baseRepond(role);
      const enCode = peutPleinement(role, "administrer_utilisateurs");
      vus += 1;
      if (enBase !== enCode) {
        divergences.push(
          `${role} : la base dit ${enBase}, le code dit ${enCode}`,
        );
      }
    }

    expect(divergences, divergences.join("\n")).toEqual([]);
    // TÉMOIN DE NON-VACUITÉ : deux listes vides sont égales (§9, 01/09).
    expect(vus).toBe(ROLES.length);
    expect(vus).toBeGreaterThanOrEqual(10);
  });

  it("et ce n'est pas « tout le monde » ni « personne » — la réponse discrimine", async () => {
    // Sans cette mesure, une fonction qui rendrait toujours `true` passerait le
    // contrôle ci-dessus si le code faisait de même : deux erreurs qui
    // s'accordent restent une erreur.
    expect(await baseRepond(Role.admin_societe)).toBe(true);
    expect(await baseRepond(Role.adv)).toBe(false);
    expect(await baseRepond(Role.direction)).toBe(false);
    // `admin_plateforme` n'y figure pas, et c'est D37 : un salarié de l'éditeur
    // n'a aucun accès par défaut aux données d'un client. La colonne « Admin »
    // a été scindée précisément pour cela.
    expect(await baseRepond(Role.admin_plateforme)).toBe(false);
  });

  it("sans rôle du tout, la réponse est NON — jamais indéfinie", async () => {
    const [ligne] = await clientOwner().$queryRawUnsafe<{ peut: boolean }[]>(
      `SELECT "app_peut_administrer_identites"() AS peut`,
    );
    expect(ligne?.peut).toBe(false);
  });
});
