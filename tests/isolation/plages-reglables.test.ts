import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  ajouterPlage,
  modifierPlage,
  reglerLePas,
  retirerPlage,
} from "@/lib/calendar/depot";
import { uuidv7 } from "@/lib/db/uuid";

import { clientOwner, fermerClients, sousSociete } from "./setup/db";
import { CALENDRIER_B, SOCIETE_A } from "./setup/fixtures";

/**
 * R3-13 — LES PLAGES D'OUVERTURE SE RÈGLENT, ET DEUX ÉTATS SONT INTERDITS.
 *
 * Le ticket a mesuré que les plages ne se modifiaient nulle part dans
 * l'application : le seul chemin était le semis ou une console. Les rendre
 * réglables rend ATTEIGNABLES deux états qui ne l'étaient pas, et ces scénarios
 * sont ce qui les ferme :
 *
 *   1. **deux plages qui se recouvrent** — elles compteraient deux fois les
 *      mêmes heures ouvrables, donc un dénominateur de taux d'occupation faux,
 *      *sans que rien ne le dise* ;
 *   2. **une plage plus courte que le pas** — un jour affiché comme ouvert sur
 *      lequel le planning ne propose AUCUN créneau.
 *
 * ## Le rôle sous lequel ces scénarios s'exécutent n'est pas un détail
 *
 * Les trois déclencheurs sont `SECURITY INVOKER` : leurs lectures passent sous
 * les politiques de l'appelant. **Sous le propriétaire et `FORCE ROW LEVEL
 * SECURITY`, sans contexte, ils ne voient RIEN et s'abstiennent** — c'est écrit
 * dans la migration, et un scénario joué là aurait mesuré une abstention en
 * croyant mesurer un refus (§9, 07/09).
 *
 * Tout se joue donc **sous un contexte de société posé**, qui est le seul état
 * dans lequel l'application écrit. Le jumeau, qui doit pouvoir `DROP TRIGGER`,
 * pose ce même contexte sur la connexion du propriétaire.
 *
 * ## Le témoin du jumeau vit HORS de sa transaction, et c'est mesuré
 *
 * *Un jumeau devrait montrer le refus AVANT de retirer le verrou* — sans quoi
 * il pourrait mesurer une abstention et non un verrou. **PostgreSQL l'interdit
 * dans la même transaction** : une violation ABANDONNE la transaction entière
 * (`25P02`, mesuré le 14/09/2026 sur ces trois scénarios), et tout ce qui suit
 * est refusé sans être exécuté. Le témoin est donc l'assertion de refus qui
 * PRÉCÈDE chaque jumeau, jouée sous le rôle applicatif et sur la même ligne :
 * elle établit que le verrou mord, le jumeau établit que c'est LUI qui mordait.
 */

/** Un calendrier à nous : les fixtures partagées sont lues par d'autres suites. */
const CALENDRIER = uuidv7();
const LUNDI = 1;

/** 8 h – 12 h. Le matin, et la plage contre laquelle tout se compare. */
const MATIN = { debutMinutes: 480, finMinutes: 720 };

async function poserLeCalendrier(pas: number): Promise<void> {
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "calendrier" ("id", "societe_id", "code", "libelle", "pas_creneau_minutes")
     VALUES ('${CALENDRIER}', '${SOCIETE_A}', 'ISO-R313', 'Horaires réglables', ${pas})
     ON CONFLICT ("id") DO UPDATE SET "pas_creneau_minutes" = ${pas}`,
  );
}

/** Remet le calendrier à son seul matin — chaque scénario part du même état. */
async function remettreAuMatin(): Promise<void> {
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "calendrier_plage" WHERE "calendrier_id" = '${CALENDRIER}'`,
  );
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "calendrier_plage" ("id", "societe_id", "calendrier_id", "jour_semaine", "debut_minutes", "fin_minutes")
     VALUES ('${uuidv7()}', '${SOCIETE_A}', '${CALENDRIER}', ${LUNDI}, ${MATIN.debutMinutes}, ${MATIN.finMinutes})`,
  );
}

/**
 * Les plages d'un jour, LUES SOUS LE RÔLE APPLICATIF.
 *
 * Jamais sous le propriétaire : un décompte nul lu sous cette identité ne
 * distingue pas « la ligne n'existe pas » de « elle est masquée », et sur la
 * base jetable le propriétaire est superutilisateur. C'est ici que zéro veut
 * dire quelque chose.
 */
function plagesDuJour(
  jour: number,
): Promise<Array<{ id: string; debut_minutes: number; fin_minutes: number }>> {
  return sousSociete(SOCIETE_A, (tx) =>
    tx.$queryRawUnsafe(
      `SELECT "id", "debut_minutes", "fin_minutes" FROM "calendrier_plage"
        WHERE "calendrier_id" = '${CALENDRIER}' AND "jour_semaine" = ${jour}
        ORDER BY "debut_minutes"`,
    ),
  );
}

/** Les plages du lundi — le jour contre lequel tout se compare. */
function plagesDuLundi(): Promise<
  Array<{ id: string; debut_minutes: number; fin_minutes: number }>
> {
  return plagesDuJour(LUNDI);
}

/** Le propriétaire, AVEC le contexte de société — sans quoi il ne voit rien. */
function sousProprietaireContextualise<T>(
  travail: (tx: {
    $executeRawUnsafe: (sql: string) => Promise<number>;
  }) => Promise<T>,
): Promise<T> {
  return clientOwner().$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SELECT set_config('app.societe_id', '${SOCIETE_A}', true)`,
    );
    return travail(tx);
  });
}

const insertion = (debut: number, fin: number, jour = LUNDI) =>
  `INSERT INTO "calendrier_plage" ("id", "societe_id", "calendrier_id", "jour_semaine", "debut_minutes", "fin_minutes")
   VALUES ('${uuidv7()}', '${SOCIETE_A}', '${CALENDRIER}', ${jour}, ${debut}, ${fin})`;

describe("R3-13 — régler les plages d'ouverture", () => {
  beforeAll(async () => {
    await poserLeCalendrier(30);
    await remettreAuMatin();
  });

  afterAll(async () => {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "calendrier_plage" WHERE "calendrier_id" = '${CALENDRIER}'`,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "calendrier" WHERE "id" = '${CALENDRIER}'`,
    );
    await fermerClients();
  });

  it("le chemin de production OUVRE un jour, et le referme", async () => {
    // *Un jour sans plage EST un jour fermé* : il n'y a pas d'interrupteur, et
    // c'est ce que ce scénario mesure — ouvrir, c'est donner une plage.
    const MARDI = 2;
    const ouverture = await sousSociete(SOCIETE_A, (tx) =>
      ajouterPlage(tx, CALENDRIER, { jourSemaine: MARDI, ...MATIN }),
    );
    expect(ouverture.ok).toBe(true);

    // Les décomptes se lisent SOUS LE RÔLE APPLICATIF : un zéro lu sous le
    // propriétaire ne distingue pas « la ligne n'existe pas » de « elle est
    // masquée », et sur la base jetable il est superutilisateur.
    const posees = await plagesDuJour(MARDI);
    expect(posees).toHaveLength(1);

    const fermeture = await sousSociete(SOCIETE_A, (tx) =>
      retirerPlage(tx, posees[0]?.id ?? ""),
    );
    expect(fermeture.ok).toBe(true);
    await expect(plagesDuJour(MARDI)).resolves.toHaveLength(0);
  });

  it("deux plages qui se TOUCHENT sont admises — le cas qui doit rester vert", async () => {
    // *Le cas qui doit rester vert POUR SA PROPRE RAISON* (§9, 11/09). Une
    // journée coupée par le déjeuner est le cas ORDINAIRE : un verrou qui la
    // refuserait serait vert sur tous les scénarios de chevauchement et
    // interdirait la forme la plus répandue d'un horaire d'agence.
    await remettreAuMatin();
    const apresMidi = { debutMinutes: MATIN.finMinutes, finMinutes: 1020 };
    const verdict = await sousSociete(SOCIETE_A, (tx) =>
      ajouterPlage(tx, CALENDRIER, { jourSemaine: LUNDI, ...apresMidi }),
    );
    expect(verdict.ok).toBe(true);
    await expect(plagesDuLundi()).resolves.toHaveLength(2);
    await remettreAuMatin();
  });

  it("une plage qui en RECOUVRE une autre est refusée — par le module et par la base", async () => {
    await remettreAuMatin();
    // 1. Le module refuse AVEC SON MOTIF, pour que l'écran ait quoi afficher.
    const verdict = await sousSociete(SOCIETE_A, (tx) =>
      ajouterPlage(tx, CALENDRIER, {
        jourSemaine: LUNDI,
        debutMinutes: 600,
        finMinutes: 900,
      }),
    );
    expect(verdict).toStrictEqual({
      ok: false,
      motif: "parametres.plage.refus_chevauchement",
    });

    // 2. LA BASE refuse la même chose sur une écriture qui ne passe pas par le
    // module — un import, un semis, une console. *Une garantie qui ne vit que
    // dans la couche applicative n'en est pas une.*
    await expect(
      sousSociete(SOCIETE_A, (tx) => tx.$executeRawUnsafe(insertion(600, 900))),
    ).rejects.toThrow(/calendrier_plage_sans_chevauchement/);

    await expect(plagesDuLundi()).resolves.toHaveLength(1);
  });

  it("modifier une plage ne la fait pas se chevaucher ELLE-MÊME", async () => {
    // Une plage ne se chevauche pas elle-même, et l'oublier rendrait TOUTE
    // modification impossible — le verrou serait vert et l'écran inutilisable.
    await remettreAuMatin();
    const [plage] = await plagesDuLundi();
    const verdict = await sousSociete(SOCIETE_A, (tx) =>
      modifierPlage(tx, plage?.id ?? "", {
        debutMinutes: 480,
        finMinutes: 780,
      }),
    );
    expect(verdict.ok).toBe(true);
    await expect(plagesDuLundi()).resolves.toStrictEqual([
      { id: plage?.id, debut_minutes: 480, fin_minutes: 780 },
    ]);
    await remettreAuMatin();
  });

  it("JUMEAU — le déclencheur de chevauchement retiré, l'écriture fautive PASSE", async () => {
    await remettreAuMatin();
    await expect(
      sousProprietaireContextualise(async (tx) => {
        await tx.$executeRawUnsafe(
          `DROP TRIGGER "plage_sans_chevauchement" ON "calendrier_plage"`,
        );
        await tx.$executeRawUnsafe(insertion(600, 900));
        throw new Error("rollback voulu");
      }),
    ).rejects.toThrow("rollback voulu");

    // Le déclencheur est revenu avec l'annulation, et il mord de nouveau.
    await expect(
      sousSociete(SOCIETE_A, (tx) => tx.$executeRawUnsafe(insertion(600, 900))),
    ).rejects.toThrow(/calendrier_plage_sans_chevauchement/);
    await expect(plagesDuLundi()).resolves.toHaveLength(1);
  });

  it("une plage plus COURTE que le pas est refusée — par le module et par la base", async () => {
    await poserLeCalendrier(60);
    await remettreAuMatin();
    const MERCREDI = 3;
    const verdict = await sousSociete(SOCIETE_A, (tx) =>
      ajouterPlage(tx, CALENDRIER, {
        jourSemaine: MERCREDI,
        debutMinutes: 480,
        finMinutes: 510,
      }),
    );
    expect(verdict).toStrictEqual({
      ok: false,
      motif: "parametres.plage.refus_plage_courte",
    });
    await expect(
      sousSociete(SOCIETE_A, (tx) =>
        tx.$executeRawUnsafe(insertion(480, 510, MERCREDI)),
      ),
    ).rejects.toThrow(/calendrier_plage_tient_le_pas/);
    await poserLeCalendrier(30);
  });

  it("JUMEAU — le déclencheur du pas retiré, la plage trop courte PASSE", async () => {
    await poserLeCalendrier(60);
    await remettreAuMatin();
    const JEUDI = 4;
    await expect(
      sousProprietaireContextualise(async (tx) => {
        await tx.$executeRawUnsafe(
          `DROP TRIGGER "plage_tient_le_pas" ON "calendrier_plage"`,
        );
        await tx.$executeRawUnsafe(insertion(480, 510, JEUDI));
        throw new Error("rollback voulu");
      }),
    ).rejects.toThrow("rollback voulu");
    await poserLeCalendrier(30);
  });

  it("un PAS qui dépasse la plus courte plage est refusé — les deux sens du même état", async () => {
    // *Le second sens est celui qu'on oublie.* Le pas se règle depuis la ligne
    // du tableau, la plage depuis l'écran de détail : n'en garder qu'un
    // laisserait l'autre produire exactement l'état qu'on interdit.
    await poserLeCalendrier(30);
    await remettreAuMatin();
    const verdict = await sousSociete(SOCIETE_A, (tx) =>
      reglerLePas(tx, CALENDRIER, 300),
    );
    expect(verdict).toStrictEqual({
      ok: false,
      motif: "parametres.pas.refus_plage_courte",
    });

    await expect(
      sousSociete(SOCIETE_A, (tx) =>
        tx.$executeRawUnsafe(
          `UPDATE "calendrier" SET "pas_creneau_minutes" = 300 WHERE "id" = '${CALENDRIER}'`,
        ),
      ),
    ).rejects.toThrow(/calendrier_pas_tient_dans_les_plages/);

    // Et un pas qui TIENT passe — le cas qui doit rester vert pour sa raison.
    const tenable = await sousSociete(SOCIETE_A, (tx) =>
      reglerLePas(tx, CALENDRIER, 60),
    );
    expect(tenable.ok).toBe(true);
    await poserLeCalendrier(30);
  });

  it("JUMEAU — le déclencheur du pas retiré, le pas trop grand PASSE", async () => {
    await poserLeCalendrier(30);
    await remettreAuMatin();
    await expect(
      sousProprietaireContextualise(async (tx) => {
        await tx.$executeRawUnsafe(
          `DROP TRIGGER "pas_tient_dans_les_plages" ON "calendrier"`,
        );
        await tx.$executeRawUnsafe(
          `UPDATE "calendrier" SET "pas_creneau_minutes" = 300 WHERE "id" = '${CALENDRIER}'`,
        );
        throw new Error("rollback voulu");
      }),
    ).rejects.toThrow("rollback voulu");
  });

  it("un calendrier d'une AUTRE société est introuvable, jamais refusé autrement", async () => {
    // Aucune comparaison de société n'est écrite dans le dépôt : on écrit SOUS
    // le contexte, la politique prononce, et un calendrier d'ailleurs rend le
    // MÊME refus qu'un identifiant inconnu — les distinguer ferait un oracle
    // (D35, D50).
    const ailleurs = await sousSociete(SOCIETE_A, (tx) =>
      ajouterPlage(tx, CALENDRIER_B, { jourSemaine: LUNDI, ...MATIN }),
    );
    const inconnu = await sousSociete(SOCIETE_A, (tx) =>
      ajouterPlage(tx, uuidv7(), { jourSemaine: LUNDI, ...MATIN }),
    );
    expect(ailleurs).toStrictEqual(inconnu);
    expect(ailleurs).toStrictEqual({
      ok: false,
      motif: "parametres.plage.refus_introuvable",
    });
  });
});
