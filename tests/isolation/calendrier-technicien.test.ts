import { afterAll, afterEach, describe, expect, it } from "vitest";

import { minutesOuvrees } from "@/lib/calendar/ouverture";
import { chargerCalendrierAgence } from "@/lib/calendar/agence";
import { chargerCalendrierDuTechnicien } from "@/lib/calendar/technicien";
import { lireCleJour } from "@/lib/calendar";

import { clientOwner, fermerClients, sousSociete } from "./setup/db";
import {
  AGENCE_A,
  CALENDRIER_SAMEDI_A,
  SOCIETE_A,
  UTILISATEUR_INTERNE_A,
} from "./setup/fixtures";

/**
 * LA RÈGLE DE PRIORITÉ DU CALENDRIER DE TRAVAIL (L3-01a ; D72, D13, I7).
 *
 * > *« Horaires propres s'il en a, sinon ceux de son agence ; **fériés et ponts
 * > toujours ceux de son agence**. »* (L3-01)
 *
 * **La seconde moitié est celle qui compte.** Un technicien peut travailler le
 * samedi par exception ; *il ne décrète pas les jours fériés de son
 * territoire.* C'est la ligne de partage de D46, appliquée à une personne au
 * lieu d'une agence.
 */

afterAll(fermerClients);

/** La semaine de mesure : un lundi et le samedi qui suit. */
const FENETRE = {
  du: lireCleJour("2026-08-17"),
  au: lireCleJour("2026-08-23"),
};

const nettoyages: Array<() => Promise<unknown>> = [];

afterEach(async () => {
  for (const nettoyer of nettoyages.splice(0)) {
    await nettoyer();
  }
});

/** Rattache l'utilisateur interne à l'agence A, le temps d'un scénario. */
async function rattacher(): Promise<void> {
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "technicien" ("societe_id","utilisateur_id","agence_id","modifie_le")
     VALUES ('${SOCIETE_A}', '${UTILISATEUR_INTERNE_A}', '${AGENCE_A}', now())`,
  );
  nettoyages.push(() =>
    clientOwner().$executeRawUnsafe(
      `DELETE FROM "technicien" WHERE "societe_id" = '${SOCIETE_A}'
        AND "utilisateur_id" = '${UTILISATEUR_INTERNE_A}'`,
    ),
  );
}

/** Lui donne son calendrier PROPRE — celui qui ouvre le samedi. */
async function donnerLeSamedi(): Promise<void> {
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "technicien_calendrier" ("societe_id","utilisateur_id","calendrier_id","modifie_le")
     VALUES ('${SOCIETE_A}', '${UTILISATEUR_INTERNE_A}', '${CALENDRIER_SAMEDI_A}', now())`,
  );
  nettoyages.push(() =>
    clientOwner().$executeRawUnsafe(
      `DELETE FROM "technicien_calendrier" WHERE "societe_id" = '${SOCIETE_A}'
        AND "utilisateur_id" = '${UTILISATEUR_INTERNE_A}'`,
    ),
  );
}

describe("horaires propres s'il en a, sinon ceux de son agence", () => {
  it("TÉMOIN — les deux calendriers DIFFÈRENT, sinon la règle ne se mesure pas", async () => {
    // *Sans cet écart, la priorité se mesurerait sur deux calendriers
    // identiques, c'est-à-dire sur rien.* L'agence ouvre le lundi, le
    // calendrier propre le samedi.
    const [agence] = await clientOwner().$queryRawUnsafe<
      Array<{ jour_semaine: number }>
    >(
      `SELECT p."jour_semaine" FROM "calendrier_plage" p
        JOIN "agence" a ON a."calendrier_id" = p."calendrier_id"
       WHERE a."id" = '${AGENCE_A}'`,
    );
    const [propre] = await clientOwner().$queryRawUnsafe<
      Array<{ jour_semaine: number }>
    >(
      `SELECT "jour_semaine" FROM "calendrier_plage"
        WHERE "calendrier_id" = '${CALENDRIER_SAMEDI_A}'`,
    );
    expect(agence?.jour_semaine).not.toBe(propre?.jour_semaine);
  });

  it("SANS calendrier propre, il travaille aux horaires de son AGENCE", async () => {
    await rattacher();
    const [duTechnicien, deLAgence] = await sousSociete(
      SOCIETE_A,
      async (tx) => [
        await chargerCalendrierDuTechnicien(tx, {
          societeId: SOCIETE_A,
          utilisateurId: UTILISATEUR_INTERNE_A,
          fenetre: FENETRE,
        }),
        await chargerCalendrierAgence(tx, {
          societeId: SOCIETE_A,
          agenceId: AGENCE_A,
          fenetre: FENETRE,
        }),
      ],
    );
    expect(duTechnicien).toEqual(deLAgence);
  });

  it("AVEC un calendrier propre, ce sont SES horaires qui font foi", async () => {
    await rattacher();
    await donnerLeSamedi();
    const calendrier = await sousSociete(SOCIETE_A, (tx) =>
      chargerCalendrierDuTechnicien(tx, {
        societeId: SOCIETE_A,
        utilisateurId: UTILISATEUR_INTERNE_A,
        fenetre: FENETRE,
      }),
    );
    expect(calendrier?.plages.map((p) => p.jour_semaine)).toEqual([6]);
  });

  it("MAIS le fuseau, le territoire et les fériés restent ceux de l'AGENCE", async () => {
    // **C'est la moitié qui compte.** *Un technicien peut travailler le samedi
    // par exception ; il ne décrète pas les jours fériés de son territoire.*
    await rattacher();
    await donnerLeSamedi();
    const [duTechnicien, deLAgence] = await sousSociete(
      SOCIETE_A,
      async (tx) => [
        await chargerCalendrierDuTechnicien(tx, {
          societeId: SOCIETE_A,
          utilisateurId: UTILISATEUR_INTERNE_A,
          fenetre: FENETRE,
        }),
        await chargerCalendrierAgence(tx, {
          societeId: SOCIETE_A,
          agenceId: AGENCE_A,
          fenetre: FENETRE,
        }),
      ],
    );
    expect(duTechnicien?.fuseau).toBe(deLAgence?.fuseau);
    expect(duTechnicien?.territoire).toBe(deLAgence?.territoire);
    expect(duTechnicien?.jours_particuliers).toEqual(
      deLAgence?.jours_particuliers,
    );
    // Et le témoin qui donne du sens aux trois égalités : les PLAGES, elles,
    // diffèrent. Sans lui, deux calendriers identiques passeraient aussi.
    expect(duTechnicien?.plages).not.toEqual(deLAgence?.plages);
  });

  it("et cela change le NOMBRE D'HEURES OUVRÉES de la semaine", async () => {
    // La règle n'est pas décorative : elle change un dénominateur, donc un taux
    // d'occupation, donc ce qu'un planificateur décide.
    await rattacher();
    const du = new Date("2026-08-17T00:00:00.000Z");
    const au = new Date("2026-08-24T00:00:00.000Z");

    const sansPropre = await sousSociete(SOCIETE_A, (tx) =>
      chargerCalendrierDuTechnicien(tx, {
        societeId: SOCIETE_A,
        utilisateurId: UTILISATEUR_INTERNE_A,
        fenetre: FENETRE,
      }),
    );
    await donnerLeSamedi();
    const avecPropre = await sousSociete(SOCIETE_A, (tx) =>
      chargerCalendrierDuTechnicien(tx, {
        societeId: SOCIETE_A,
        utilisateurId: UTILISATEUR_INTERNE_A,
        fenetre: FENETRE,
      }),
    );

    expect(minutesOuvrees(sansPropre!, du, au)).not.toBe(
      minutesOuvrees(avecPropre!, du, au),
    );
  });
});

describe("ce qui n'a pas de calendrier le DIT, et n'en invente pas", () => {
  it("un technicien SANS rattachement rend `null`", async () => {
    // *« Inconnu » n'est pas « ouvert »* (I7, RG-PLA-07). Un calendrier sans
    // plage se lirait « fermé toute la semaine », ce qui est une réponse — et
    // fausse.
    const calendrier = await sousSociete(SOCIETE_A, (tx) =>
      chargerCalendrierDuTechnicien(tx, {
        societeId: SOCIETE_A,
        utilisateurId: UTILISATEUR_INTERNE_A,
        fenetre: FENETRE,
      }),
    );
    expect(calendrier).toBeNull();
  });

  it("le MÊME appel, rattachement posé, rend un calendrier — le `null` vient bien de là", async () => {
    // Le cas qui doit rester vert POUR SA PROPRE RAISON (§9, 11/09) : sans lui,
    // une fonction qui rendrait toujours `null` passerait le scénario ci-dessus.
    await rattacher();
    const calendrier = await sousSociete(SOCIETE_A, (tx) =>
      chargerCalendrierDuTechnicien(tx, {
        societeId: SOCIETE_A,
        utilisateurId: UTILISATEUR_INTERNE_A,
        fenetre: FENETRE,
      }),
    );
    expect(calendrier).not.toBeNull();
  });
});
