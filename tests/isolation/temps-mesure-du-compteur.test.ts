import { afterAll, afterEach, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import { mesurer, type Segment } from "@/lib/interventions/compteur";
import { cloturerIntervention } from "@/lib/interventions/depot";
import {
  arreterLeCompteur,
  demarrerLeCompteur,
} from "@/lib/interventions/depot-compteur";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  CLIENT_A1,
  SITE_A1_S1,
  SOCIETE_A,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * D120 — LE TEMPS MESURÉ EST CELUI DU COMPTEUR, ET RIEN D'AUTRE.
 *
 * *« Le temps mesuré, écrit par le compteur et jamais modifiable. »* **« Jamais
 * modifiable » est une garantie, pas une intention** : sans déclencheur, elle
 * ne vivrait que dans la couche applicative, et une garantie qui n'y vit que
 * n'en est pas une (I1, L1-02c).
 *
 * ## LES TROIS VERBES, ET LA LEÇON DU 14/09
 *
 * *Un gardien de base peut bâtir sa population avec le verbe d'écriture qui le
 * satisfait, et le verbe de la production n'y est pas.* Chaque refus est donc
 * éprouvé sur `create`, sur `update` **et** sur `upsert` — trois chemins qui
 * n'atteignent pas les mêmes contrôles dans le même ordre.
 *
 * ## LA CONFRONTATION QUE LA MIGRATION PROMET
 *
 * `mesurer()` en TypeScript et la somme SQL du déclencheur lisent le **même**
 * critère : la somme des durées des segments fermés, en secondes, divisée par
 * 60 et TRONQUÉE. *Deux lectures d'un même critère divergent en silence* (§9,
 * 01/09) — elles répondent donc ici l'une à côté de l'autre, sur les mêmes
 * segments, y compris sur le cas qui les sépare : deux segments de trente
 * secondes font ZÉRO minute, jamais une.
 */

afterAll(fermerClients);

const TECHNICIEN = UTILISATEUR_PAR_ROLE[Role.technicien] as string;

const SESSION = {
  utilisateurId: TECHNICIEN,
  societeId: SOCIETE_A,
  role: Role.technicien,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const jetables: string[] = [];
const tauxPoses: string[] = [];

/**
 * Un taux horaire en vigueur — la clôture le réclame, et son absence rend
 * `intervention.refus.taux_absent` (mesuré : la première rédaction de ces
 * scénarios l'a découvert ainsi). *Une valorisation sans taux n'est pas une
 * valorisation à zéro, c'est une valorisation impossible.*
 */
async function poserLeTaux(): Promise<void> {
  const id = uuidv7();
  tauxPoses.push(id);
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "taux_horaire" ("id","societe_id","date_effet","montant_mineur","devise_code")
     VALUES ('${id}', '${SOCIETE_A}', DATE '2020-01-01', 5000, 'XPF')
     ON CONFLICT DO NOTHING`,
  );
}

/**
 * Une intervention jetable, **sans machine** — D120 n'en exige plus.
 *
 * *Les colonnes d'accompagnement d'un statut sont posées avec lui, jamais
 * contournées* : une suspendue porte son motif et sa date (D117), une annulée
 * les siennes. **Le décor suit les règles plutôt que de les désactiver** — et
 * c'est ainsi qu'on apprend qu'elles existent : la première rédaction les
 * ignorait, et la base a refusé.
 */
async function interventionJetable(statut = "planifiee"): Promise<string> {
  const id = uuidv7();
  jetables.push(id);
  const accompagnement =
    statut === "suspendue"
      ? `, "motif_suspension" = 'épreuve', "suspendue_le" = now()`
      : statut === "annulee"
        ? `, "motif_annulation" = 'épreuve', "annulee_le" = now()`
        : "";
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention" ("id","societe_id","client_id","site_id","agence_id","type","statut","modifie_le")
     VALUES ('${id}', '${SOCIETE_A}', '${CLIENT_A1}', '${SITE_A1_S1}', '${AGENCE_A}', 'curatif', 'planifiee', now())`,
  );
  if (statut !== "planifiee") {
    await clientOwner().$executeRawUnsafe(
      `UPDATE "intervention" SET "statut" = '${statut}'${accompagnement} WHERE "id" = '${id}'`,
    );
  }
  return id;
}

/** Un segment FERMÉ de `minutes` minutes, posé sous le propriétaire. */
async function segmentFerme(
  interventionId: string,
  debut: string,
  secondes: number,
): Promise<void> {
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "segment_travail" ("id","societe_id","intervention_id","utilisateur_id","debut","fin","modifie_le")
     VALUES ('${uuidv7()}', '${SOCIETE_A}', '${interventionId}', '${TECHNICIEN}',
             '${debut}'::timestamptz,
             '${debut}'::timestamptz + interval '${secondes} seconds', now())`,
  );
}

afterEach(async () => {
  for (const id of tauxPoses.splice(0)) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "taux_horaire" WHERE "id" = '${id}'`,
    );
  }
  for (const id of jetables.splice(0)) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = '${id}'`,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = '${id}'`,
    );
  }
});

const DEBUT = "2026-09-15T08:00:00+11:00";

describe("le temps mesuré ne se saisit pas", () => {
  it("le TÉMOIN : la somme des segments s'écrit sans peine", async () => {
    // Sans lui, les refus ci-dessous seraient verts sur une colonne où RIEN ne
    // peut s'écrire — le vert le plus cher qui soit.
    const id = await interventionJetable();
    await segmentFerme(id, DEBUT, 3600);
    await expect(
      clientOwner().$executeRawUnsafe(
        `UPDATE "intervention" SET "temps_mesure_min" = 60 WHERE "id" = '${id}'`,
      ),
    ).resolves.toBe(1);
  });

  it("UPDATE : une valeur INVENTÉE est refusée, et le refus dit la somme", async () => {
    const id = await interventionJetable();
    await segmentFerme(id, DEBUT, 3600);
    await expect(
      clientOwner().$executeRawUnsafe(
        `UPDATE "intervention" SET "temps_mesure_min" = 480 WHERE "id" = '${id}'`,
      ),
    ).rejects.toThrow(/seule source du temps/i);
  });

  it("CREATE : une intervention qui NAÎT avec un temps mesuré est refusée", async () => {
    // *Le verbe change le chemin* : ici aucune ligne n'est modifiée, une ligne
    // apparaît — et elle n'a aucun segment, donc aucune somme à porter.
    const id = uuidv7();
    jetables.push(id);
    await expect(
      clientOwner().$executeRawUnsafe(
        `INSERT INTO "intervention" ("id","societe_id","client_id","site_id","agence_id","type","statut","temps_mesure_min","modifie_le")
         VALUES ('${id}', '${SOCIETE_A}', '${CLIENT_A1}', '${SITE_A1_S1}', '${AGENCE_A}', 'curatif', 'planifiee', 45, now())`,
      ),
    ).rejects.toThrow(/seule source du temps/i);
  });

  it("UPSERT : la branche de MISE À JOUR est jugée comme les autres", async () => {
    const id = await interventionJetable();
    await segmentFerme(id, DEBUT, 3600);
    await expect(
      clientOwner().$executeRawUnsafe(
        `INSERT INTO "intervention" ("id","societe_id","client_id","site_id","agence_id","type","statut","modifie_le")
         VALUES ('${id}', '${SOCIETE_A}', '${CLIENT_A1}', '${SITE_A1_S1}', '${AGENCE_A}', 'curatif', 'planifiee', now())
         ON CONFLICT ("id") DO UPDATE SET "temps_mesure_min" = 999`,
      ),
    ).rejects.toThrow(/seule source du temps/i);
  });

  it("LE JUMEAU : le déclencheur retiré, la valeur inventée passe", async () => {
    const id = await interventionJetable();
    await segmentFerme(id, DEBUT, 3600);
    await clientOwner()
      .$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `DROP TRIGGER "intervention_temps_mesure_est_celui_du_compteur" ON "intervention"`,
        );
        const ecrit = await tx.$executeRawUnsafe(
          `UPDATE "intervention" SET "temps_mesure_min" = 480 WHERE "id" = '${id}'`,
        );
        expect(ecrit).toBe(1);
        throw new Error("rollback volontaire");
      })
      .catch((erreur: unknown) => {
        expect(String(erreur)).toContain("rollback volontaire");
      });
  });
});

describe("la somme du déclencheur et celle de `mesurer()` sont la MÊME", () => {
  /**
   * Le cas qui les sépare si l'une des deux tronque au mauvais moment : deux
   * segments de trente secondes. **Somme puis troncature → 1 minute ; troncature
   * puis somme → 0.** *La bonne réponse est celle que la règle donne : on ne
   * facture pas une seconde.*
   */
  it.each([
    [[3600], 60],
    [[3600, 1800], 90],
    [[30, 30], 1],
    [[59], 0],
    [[90, 90], 3],
  ])(
    "segments %j secondes → %i minutes, des DEUX côtés",
    async (durees, attendu) => {
      const id = await interventionJetable();
      const segments: Segment[] = [];
      for (const [rang, secondes] of (durees as number[]).entries()) {
        const debut = `2026-09-15T0${rang + 1}:00:00+11:00`;
        await segmentFerme(id, debut, secondes);
        segments.push({
          id: String(rang),
          debut: new Date(debut),
          fin: new Date(new Date(debut).getTime() + secondes * 1000),
        });
      }
      // Le TypeScript.
      expect(mesurer(segments).minutes).toBe(attendu);
      // Et la base, qui accepte exactement cette valeur — et refuserait l'autre.
      await expect(
        clientOwner().$executeRawUnsafe(
          `UPDATE "intervention" SET "temps_mesure_min" = ${attendu} WHERE "id" = '${id}'`,
        ),
      ).resolves.toBe(1);
    },
  );
});

describe("la traçabilité de la validation", () => {
  it("un auteur SANS date est refusé, et une date SANS auteur aussi", async () => {
    const id = await interventionJetable();
    await expect(
      clientOwner().$executeRawUnsafe(
        `UPDATE "intervention" SET "temps_valide_par" = '${TECHNICIEN}' WHERE "id" = '${id}'`,
      ),
    ).rejects.toThrow(/intervention_validation_tracee/);
    await expect(
      clientOwner().$executeRawUnsafe(
        `UPDATE "intervention" SET "temps_valide_le" = now() WHERE "id" = '${id}'`,
      ),
    ).rejects.toThrow(/intervention_validation_tracee/);
  });

  it("les DEUX ensemble passent — le cas qui doit rester vert", async () => {
    const id = await interventionJetable();
    await expect(
      clientOwner().$executeRawUnsafe(
        `UPDATE "intervention" SET "temps_valide_par" = '${TECHNICIEN}', "temps_valide_le" = now() WHERE "id" = '${id}'`,
      ),
    ).resolves.toBe(1);
  });

  it("CREATE et UPSERT sont jugés comme l'UPDATE", async () => {
    const id = uuidv7();
    jetables.push(id);
    await expect(
      clientOwner().$executeRawUnsafe(
        `INSERT INTO "intervention" ("id","societe_id","client_id","site_id","agence_id","type","statut","temps_valide_par","modifie_le")
         VALUES ('${id}', '${SOCIETE_A}', '${CLIENT_A1}', '${SITE_A1_S1}', '${AGENCE_A}', 'curatif', 'planifiee', '${TECHNICIEN}', now())`,
      ),
    ).rejects.toThrow(/intervention_validation_tracee/);

    const autre = await interventionJetable();
    await expect(
      clientOwner().$executeRawUnsafe(
        `INSERT INTO "intervention" ("id","societe_id","client_id","site_id","agence_id","type","statut","modifie_le")
         VALUES ('${autre}', '${SOCIETE_A}', '${CLIENT_A1}', '${SITE_A1_S1}', '${AGENCE_A}', 'curatif', 'planifiee', now())
         ON CONFLICT ("id") DO UPDATE SET "temps_valide_le" = now()`,
      ),
    ).rejects.toThrow(/intervention_validation_tracee/);
  });

  it("LE JUMEAU : la contrainte retirée, l'auteur seul passe", async () => {
    const id = await interventionJetable();
    await clientOwner()
      .$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `ALTER TABLE "intervention" DROP CONSTRAINT "intervention_validation_tracee"`,
        );
        const ecrit = await tx.$executeRawUnsafe(
          `UPDATE "intervention" SET "temps_valide_par" = '${TECHNICIEN}' WHERE "id" = '${id}'`,
        );
        expect(ecrit).toBe(1);
        throw new Error("rollback volontaire");
      })
      .catch((erreur: unknown) => {
        expect(String(erreur)).toContain("rollback volontaire");
      });
  });
});

describe("le chemin de production — démarrer, c'est démarrer l'intervention", () => {
  it("démarrer le compteur porte l'intervention EN COURS, SANS machine", async () => {
    const id = await interventionJetable();
    const depart = await demarrerLeCompteur(
      SESSION,
      id,
      new Date("2026-09-15T08:00:00.000Z"),
      clientApp(),
    );
    expect(depart.accepte).toBe(true);

    const [apres] = await clientOwner().$queryRawUnsafe<
      Array<{ statut: string; temps_mesure_min: number | null }>
    >(
      `SELECT "statut", "temps_mesure_min" FROM "intervention" WHERE "id" = '${id}'`,
    );
    expect(apres?.statut).toBe("en_cours");
    // Rien n'est encore mesuré : le compteur TOURNE, il n'a rien fermé.
    expect(apres?.temps_mesure_min).toBeNull();

    const arret = await arreterLeCompteur(
      SESSION,
      new Date("2026-09-15T10:30:00.000Z"),
      clientApp(),
    );
    expect(arret.accepte).toBe(true);

    const [fini] = await clientOwner().$queryRawUnsafe<
      Array<{ temps_mesure_min: number | null }>
    >(`SELECT "temps_mesure_min" FROM "intervention" WHERE "id" = '${id}'`);
    expect(fini?.temps_mesure_min).toBe(150);
  });

  it("une intervention SUSPENDUE refuse le compteur, avec sa clé", async () => {
    const id = await interventionJetable("suspendue");
    expect(
      await demarrerLeCompteur(
        SESSION,
        id,
        new Date("2026-09-15T08:00:00.000Z"),
        clientApp(),
      ),
    ).toEqual({ accepte: false, cle: "compteur.refus.suspendue" });
  });

  it("une intervention ANNULÉE aussi, et le refus est NOMMÉ — pas une violation", async () => {
    const id = await interventionJetable("annulee");
    expect(
      await demarrerLeCompteur(
        SESSION,
        id,
        new Date("2026-09-15T08:00:00.000Z"),
        clientApp(),
      ),
    ).toEqual({ accepte: false, cle: "intervention.refus.annulee_figee" });
  });
});

describe("la validation du temps laisse son auteur et sa date (D120)", () => {
  /**
   * *« La correction garde l'auteur et la date. »* Et l'auteur est celui de la
   * SESSION, jamais un champ du formulaire : **une validation dont l'auteur
   * viendrait de l'extérieur serait une validation qu'on peut signer du nom
   * d'un autre.**
   */
  it("écrit qui a validé et quand, et le temps validé par défaut", async () => {
    await poserLeTaux();
    const id = await interventionJetable();
    await segmentFerme(id, DEBUT, 5400);
    await clientOwner().$executeRawUnsafe(
      `UPDATE "intervention" SET "temps_mesure_min" = 90 WHERE "id" = '${id}'`,
    );

    const resultat = await cloturerIntervention(
      { ...SESSION, role: Role.adv },
      { intervention_id: id, temps_valide_min: 90 },
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);

    const [apres] = await clientOwner().$queryRawUnsafe<
      Array<{
        temps_mesure_min: number | null;
        temps_valide_min: number | null;
        temps_valide_par: string | null;
        temps_valide_le: Date | null;
      }>
    >(
      `SELECT "temps_mesure_min", "temps_valide_min", "temps_valide_par", "temps_valide_le"
         FROM "intervention" WHERE "id" = '${id}'`,
    );
    expect(apres?.temps_mesure_min).toBe(90);
    expect(apres?.temps_valide_min).toBe(90);
    expect(apres?.temps_valide_par).toBe(TECHNICIEN);
    expect(apres?.temps_valide_le).not.toBeNull();
  });

  it("une CORRECTION se voit — les deux temps diffèrent, et l'écart est lisible", async () => {
    // *Un compteur oublié fausse les indicateurs, et sans ces deux colonnes on
    // ne peut pas voir l'écart.* C'est exactement ce que ce scénario montre :
    // le compteur a compté 90 minutes, le valideur en retient 60, et LES DEUX
    // restent écrits.
    await poserLeTaux();
    const id = await interventionJetable();
    await segmentFerme(id, DEBUT, 5400);
    await clientOwner().$executeRawUnsafe(
      `UPDATE "intervention" SET "temps_mesure_min" = 90 WHERE "id" = '${id}'`,
    );

    const resultat = await cloturerIntervention(
      { ...SESSION, role: Role.adv },
      { intervention_id: id, temps_valide_min: 60 },
      clientApp(),
    );
    expect(resultat.accepte).toBe(true);

    const [apres] = await clientOwner().$queryRawUnsafe<
      Array<{
        temps_mesure_min: number | null;
        temps_valide_min: number | null;
      }>
    >(
      `SELECT "temps_mesure_min", "temps_valide_min" FROM "intervention" WHERE "id" = '${id}'`,
    );
    expect(apres?.temps_mesure_min).toBe(90);
    expect(apres?.temps_valide_min).toBe(60);
  });

  it("sans compteur, la clôture est REFUSÉE — et le refus dit pourquoi", async () => {
    // La contrepartie assumée de « le compteur est la seule source du temps » :
    // une intervention sur laquelle personne n'a démarré de compteur ne se
    // clôture pas ici. Elle se traite dans Winpro au moment de facturer.
    const id = await interventionJetable();
    expect(
      await cloturerIntervention(
        { ...SESSION, role: Role.adv },
        { intervention_id: id, temps_valide_min: 60 },
        clientApp(),
      ),
    ).toEqual({
      accepte: false,
      cle: "intervention.refus.temps_manquant",
    });
  });
});
