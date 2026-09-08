import { afterAll, describe, expect, it } from "vitest";

import type { PrismaClient } from "@prisma/client";

import { sousSociete, clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  AGENCE_B,
  SOCIETE_A,
  SOCIETE_B,
  TERRITOIRE_A,
  TERRITOIRE_B,
  VAR_SOCIETE,
  feriesFixture,
} from "./setup/fixtures";

/**
 * **Le territoire d'un jour férié référencé** (ticket L0-09a ; D48).
 *
 * **Le trou fermé ici.** Depuis L0-08, `calendrier_ferie` référence le fait
 * public par `(jour_ferie_id, date)`. Cette clé empêche les DATES de diverger,
 * pas les TERRITOIRES : une agence de territoire `NC` pouvait écrire un écart
 * dont le `jour_ferie_id` désignait un férié `FR` tombant le même jour. Le
 * comportement restait juste — `appliquerEcarts` compose par date — mais
 * `jour_ferie_id` cessait d'être fiable comme « le fait public que cet écart
 * surcharge ».
 *
 * **La fermeture est déclarative, jamais applicative.** Deux clés étrangères
 * composites chaînent l'écart à son agence puis au fait public, par une colonne
 * `territoire` qu'il porte lui-même :
 *
 *   `(agence_id, territoire)`           → `agence(id, territoire)`
 *   `(jour_ferie_id, date, territoire)` → `jour_ferie(id, date, territoire)`
 *
 * C'est PostgreSQL qui refuse. Aucun chemin d'écriture n'y échappe — ni un
 * import, ni une synchronisation hors ligne, ni une requête écrite dans trois
 * ans par quelqu'un qui n'aura pas lu D46.
 *
 * **Le jeu fixture rend le scénario réel, pas théorique** : les fériés de `ZZ`
 * et de `XA` tombent aux MÊMES dates (voir `feriesFixture`). Une agence de `ZZ`
 * a donc, chaque année, un férié `XA` de même date sous la main — exactement la
 * configuration qui produisait le défaut.
 *
 * **Chaque refus est éprouvé PAR RETRAIT.** Un gardien vert sur un cas fabriqué
 * n'est pas un gardien éprouvé (CLAUDE.md §9) : chaque scénario de refus a son
 * jumeau qui retire réellement la contrainte, dans une transaction annulée, et
 * montre que l'écriture fautive passe alors. Sans ce jumeau, un test vert ne
 * dirait pas si c'est le chaînage qui a mordu ou une contrainte voisine.
 */

/** Le second férié de l'horizon fixture — décembre, libre de tout écart. */
const DATE_LIBRE = feriesFixture(TERRITOIRE_A)[1]?.date ?? "";

/** Sentinelle d'annulation : elle fait retomber la transaction, sans erreur. */
class Annulation extends Error {}

/** L'identifiant du férié d'un territoire à une date donnée. */
async function idFerie(territoire: string, date: string): Promise<string> {
  const ferie = await clientApp().jourFerie.findUniqueOrThrow({
    where: {
      territoire_date: { territoire, date: new Date(`${date}T00:00:00.000Z`) },
    },
    select: { id: true },
  });
  return ferie.id;
}

/**
 * Exécute `travail` sous le PROPRIÉTAIRE du schéma, après avoir réellement
 * défait le verrou (`retrait` — une ou plusieurs instructions DDL, un retrait
 * pur ou un remplacement par une variante permissive), puis ANNULE tout.
 *
 * C'est l'épreuve par retrait, automatisée. Le DDL est transactionnel en
 * PostgreSQL : la contrainte revient au `ROLLBACK`, et la base sort du scénario
 * exactement comme elle y est entrée. Le contexte société est posé parce que
 * `FORCE ROW LEVEL SECURITY` soumet le propriétaire lui-même aux politiques.
 */
async function sansContrainte(
  retrait: readonly string[],
  societeId: string,
  travail: (tx: PrismaClient) => Promise<void>,
): Promise<void> {
  try {
    await clientOwner().$transaction(async (tx) => {
      for (const instruction of retrait) {
        await tx.$executeRawUnsafe(instruction);
      }
      await tx.$executeRawUnsafe(
        "SELECT set_config($1, $2, true)",
        VAR_SOCIETE,
        societeId,
      );
      await travail(tx as unknown as PrismaClient);
      throw new Annulation();
    });
  } catch (erreur) {
    if (!(erreur instanceof Annulation)) {
      throw erreur;
    }
  }
}

/** L'écriture fautive : un écart de l'agence A adossé au férié du territoire B. */
function insererEcartCroise(
  tx: PrismaClient,
  jourFerieId: string,
  territoire: string,
): Promise<number> {
  return tx.$executeRawUnsafe(
    `INSERT INTO "calendrier_ferie"
       ("id", "societe_id", "agence_id", "territoire", "date", "jour_ferie_id",
        "travaille", "motif")
     VALUES ('aaaaaaaa-0000-7000-8000-0000000000f7', $1::uuid, $2::uuid, $3,
             DATE '${DATE_LIBRE}', $4::uuid, true, 'férié d''un autre territoire')`,
    SOCIETE_A,
    AGENCE_A,
    territoire,
    jourFerieId,
  );
}

describe("agence.territoire est OBLIGATOIRE (D48)", () => {
  afterAll(fermerClients);

  /**
   * **Pourquoi la colonne a cessé d'être nullable.** Une clé étrangère dont une
   * colonne vaut NULL n'est PAS contrôlée en PostgreSQL (`MATCH SIMPLE`). Le
   * chaînage serait donc muet exactement là où la donnée manque : une agence
   * sans territoire aurait pu adosser ses écarts à n'importe quel férié. Le
   * verrou n'a de sens que si la colonne est renseignée partout.
   */
  it("la base refuse une agence sans territoire", async () => {
    await expect(
      sousSociete(SOCIETE_B, (tx) =>
        tx.$executeRawUnsafe(
          `UPDATE "agence" SET "territoire" = NULL WHERE "id" = $1::uuid`,
          AGENCE_B,
        ),
      ),
      // Prisma reformule le message de PostgreSQL : `Null constraint failed`
      // là où le serveur écrit `null value ... violates not-null constraint`.
      // Le motif accepte les deux, et nomme la colonne dans les deux cas.
    ).rejects.toThrow(/null (value|constraint)[^\n]*territoire/i);
  });

  it("ÉPREUVE PAR RETRAIT : sans le NOT NULL, le vide passe", async () => {
    // Sans ce jumeau, le scénario ci-dessus pourrait être vert parce qu'une
    // contrainte voisine mord — la clé composite, le contrôle de forme — et non
    // parce que la colonne est obligatoire.
    let lignes = -1;

    await sansContrainte(
      ['ALTER TABLE "agence" ALTER COLUMN "territoire" DROP NOT NULL'],
      SOCIETE_B,
      async (tx) => {
        lignes = await tx.$executeRawUnsafe(
          `UPDATE "agence" SET "territoire" = NULL WHERE "id" = $1::uuid`,
          AGENCE_B,
        );
      },
    );

    expect(lignes).toBe(1);

    // Et la transaction annulée n'a rien laissé derrière elle.
    const agence = await sousSociete(SOCIETE_B, (tx) =>
      tx.agence.findUniqueOrThrow({
        where: { id: AGENCE_B },
        select: { territoire: true },
      }),
    );
    expect(agence.territoire).toBe(TERRITOIRE_B);
  });
});

describe("un écart ne s'adosse qu'à un férié de SON territoire (D48)", () => {
  afterAll(fermerClients);

  it("le jeu fixture porte bien le même férié sur les deux territoires", async () => {
    // Contrôle positif : sans lui, les refus ci-dessous pourraient tenir à un
    // `jour_ferie_id` inexistant plutôt qu'au territoire — et ils seraient
    // verts sans rien prouver.
    const [ferieA, ferieB] = await Promise.all([
      idFerie(TERRITOIRE_A, DATE_LIBRE),
      idFerie(TERRITOIRE_B, DATE_LIBRE),
    ]);
    expect(ferieA).not.toBe(ferieB);
  });

  it("le férié d'un AUTRE territoire est refusé", async () => {
    // Le défaut lui-même : l'agence A relève de `ZZ`, le férié visé est celui
    // de `XA`, et il tombe le même jour. C'est la ligne que la base écrivait
    // sans broncher avant D48.
    const ferieB = await idFerie(TERRITOIRE_B, DATE_LIBRE);

    await expect(
      sousSociete(SOCIETE_A, (tx) =>
        insererEcartCroise(tx, ferieB, TERRITOIRE_A),
      ),
    ).rejects.toThrow(/jour_ferie_id_date_territoire|foreign key|violates/i);
  });

  it("recopier le territoire du férié ne contourne rien : l'agence refuse", async () => {
    // L'autre côté du chaînage, et c'est ce qui le rend étanche. Faire
    // concorder l'écart avec le fait public de `XA` le fait diverger de son
    // agence, qui est en `ZZ` : la première clé mord alors à la place de la
    // seconde. Les deux ne peuvent pas être satisfaites en même temps.
    const ferieB = await idFerie(TERRITOIRE_B, DATE_LIBRE);

    await expect(
      sousSociete(SOCIETE_A, (tx) =>
        insererEcartCroise(tx, ferieB, TERRITOIRE_B),
      ),
    ).rejects.toThrow(/agence_id_territoire|foreign key|violates/i);
  });

  it("le férié de SON territoire est accepté", async () => {
    // Contrôle positif, et il compte autant : une contrainte qui refuserait
    // tout serait verte sur les deux scénarios ci-dessus sans rien garantir.
    // L'écriture est annulée — le jeu fixture ne bouge pas.
    const ferieA = await idFerie(TERRITOIRE_A, DATE_LIBRE);
    let lignes = -1;

    await sansContrainte([], SOCIETE_A, async (tx) => {
      lignes = await insererEcartCroise(tx, ferieA, TERRITOIRE_A);
    });

    expect(lignes).toBe(1);
  });

  it("le PONT reste possible — `MATCH SIMPLE` ne contrôle pas un NULL", async () => {
    // La conséquence utile du chaînage : `jour_ferie_id` nul rend la seconde
    // clé non contrôlée, si bien qu'un pont — un jour ordinaire que l'agence
    // chôme — s'écrit toujours. La première clé, elle, n'a aucune colonne
    // nullable : le territoire de l'écart reste tenu.
    let lignes = -1;

    await sansContrainte([], SOCIETE_A, async (tx) => {
      lignes = await tx.$executeRawUnsafe(
        `INSERT INTO "calendrier_ferie"
           ("id", "societe_id", "agence_id", "territoire", "date",
            "jour_ferie_id", "travaille", "motif")
         VALUES ('aaaaaaaa-0000-7000-8000-0000000000f8', $1::uuid, $2::uuid, $3,
                 DATE '${DATE_LIBRE}', NULL, false, 'pont')`,
        SOCIETE_A,
        AGENCE_A,
        TERRITOIRE_A,
      );
    });

    expect(lignes).toBe(1);
  });

  it("un pont ne peut pas non plus mentir sur son territoire", async () => {
    // Le pont échappe à la clé du fait public, jamais à celle de l'agence.
    // C'est ce qui empêche la colonne `territoire` de devenir un champ libre
    // sur les lignes sans `jour_ferie_id`.
    await expect(
      sousSociete(SOCIETE_A, (tx) =>
        tx.$executeRawUnsafe(
          `INSERT INTO "calendrier_ferie"
             ("id", "societe_id", "agence_id", "territoire", "date",
              "jour_ferie_id", "travaille", "motif")
           VALUES ('aaaaaaaa-0000-7000-8000-0000000000f9', $1::uuid, $2::uuid,
                   $3, DATE '${DATE_LIBRE}', NULL, false, 'pont menteur')`,
          SOCIETE_A,
          AGENCE_A,
          TERRITOIRE_B,
        ),
      ),
    ).rejects.toThrow(/agence_id_territoire|foreign key|violates/i);
  });

  it("ÉPREUVE PAR RETRAIT : sans le chaînage, le férié d'ailleurs passe", async () => {
    // La preuve que le refus vient bien du chaînage, et de rien d'autre. Les
    // deux clés composites sont réellement retirées, l'écriture fautive est
    // rejouée à l'identique, et elle aboutit. La transaction est annulée : les
    // contraintes reviennent avec elle.
    const ferieB = await idFerie(TERRITOIRE_B, DATE_LIBRE);
    let lignes = -1;

    await sansContrainte(
      [
        'ALTER TABLE "calendrier_ferie" DROP CONSTRAINT "calendrier_ferie_jour_ferie_id_date_territoire_fkey"',
        'ALTER TABLE "calendrier_ferie" DROP CONSTRAINT "calendrier_ferie_agence_id_territoire_fkey"',
      ],
      SOCIETE_A,
      async (tx) => {
        lignes = await insererEcartCroise(tx, ferieB, TERRITOIRE_A);
      },
    );

    expect(lignes).toBe(1);

    // Le chaînage est revenu avec l'annulation : la même écriture est de
    // nouveau refusée. Sans cette seconde moitié, un retrait mal annulé
    // laisserait la suite entière s'exécuter sans verrou.
    await expect(
      sousSociete(SOCIETE_A, (tx) =>
        insererEcartCroise(tx, ferieB, TERRITOIRE_A),
      ),
    ).rejects.toThrow(/foreign key|violates/i);
  });
});

describe("changer le territoire d'une agence (D49)", () => {
  afterAll(fermerClients);

  /**
   * **La question que le chaînage soulève, et le cas est réel** : une faute de
   * saisie corrigée trois semaines plus tard. `ON UPDATE CASCADE` a été essayé
   * et mesuré — sur une agence dont les écarts sont tous des ponts, la
   * correction réécrivait leurs territoires **en silence**. D49 la retire :
   * `ON UPDATE RESTRICT` des deux côtés. Un changement de territoire invalide
   * réellement les écarts, et le refus de PostgreSQL est le bon comportement.
   */

  /** L'agence A porte deux écarts de fixture : un férié travaillé, un pont. */
  function changerTerritoireDeA(tx: PrismaClient): Promise<number> {
    return tx.$executeRawUnsafe(
      `UPDATE "agence" SET "territoire" = $2 WHERE "id" = $1::uuid`,
      AGENCE_A,
      TERRITOIRE_B,
    );
  }

  it("le changement est refusé tant qu'un écart subsiste", async () => {
    await expect(sousSociete(SOCIETE_A, changerTerritoireDeA)).rejects.toThrow(
      /refusé/i,
    );
  });

  it("et le message dit QUOI FAIRE, pas seulement que c'est interdit", async () => {
    // Un refus qui n'indique pas la sortie fait rouvrir la base pour comprendre.
    // Le message est donc éprouvé sur ce qu'il apporte : l'agence nommée, les
    // deux territoires, le décompte des écarts, la marche à suivre, et où lire
    // la décision. Ce scénario échoue si quelqu'un raccourcit le message.
    const erreur = await sousSociete(SOCIETE_A, changerTerritoireDeA).catch(
      (cause: unknown) => String(cause),
    );

    expect(erreur).toContain("DUCOS");
    expect(erreur).toContain(TERRITOIRE_A);
    expect(erreur).toContain(TERRITOIRE_B);
    expect(erreur).toMatch(/2 écart\(s\) de calendrier subsistent/);
    expect(erreur).toContain("Marche à suivre");
    expect(erreur).toContain("réadosser chaque férié travaillé");
    expect(erreur).toContain(
      "docs/decisions/2026-08-24-territoire-agence-sans-propagation.md",
    );
  });

  it("la PROCÉDURE aboutit : écarts traités, puis territoire changé", async () => {
    // Le contrôle positif de la procédure écrite dans la décision. Sans lui, un
    // verrou qui refuserait TOUJOURS passerait les scénarios ci-dessus sans que
    // personne ne remarque qu'on ne peut plus jamais corriger une saisie.
    let lignes = -1;

    await sansContrainte([], SOCIETE_A, async (tx) => {
      await tx.$executeRawUnsafe(
        `DELETE FROM "calendrier_ferie" WHERE "agence_id" = $1::uuid`,
        AGENCE_A,
      );
      lignes = await changerTerritoireDeA(tx);
    });

    expect(lignes).toBe(1);
  });

  it("ÉPREUVE PAR RETRAIT : sans le déclencheur, la CLÉ refuse encore", async () => {
    // Le déclencheur double la clé, il ne la remplace pas. Retiré, le refus
    // demeure — avec le message générique de PostgreSQL. C'est ce qui autorise
    // à ne voir dans le déclencheur qu'une voix : le verrou reste déclaratif.
    //
    // **Ce scénario a d'abord été vert pour la mauvaise raison, et l'épreuve
    // l'a montré.** Écrit sur l'agence telle quelle — un férié travaillé et un
    // pont —, il passait aussi avec `ON UPDATE CASCADE` : la propagation
    // échouait alors sur la clé du FAIT PUBLIC, faute de férié correspondant
    // sur le nouveau territoire, et le motif d'erreur générique s'en
    // accommodait. Deux corrections le rendent discriminant : l'écart adossé
    // est retiré d'abord — ne reste que le PONT, c'est-à-dire la configuration
    // exacte où `CASCADE` réussissait en silence — et l'assertion exige LE nom
    // de la clé de l'agence, pour qu'un refus venu de la clé du fait public ne
    // puisse pas passer pour celui-ci.
    //
    // Le `DETAIL` de PostgreSQL — « is still referenced from table ... » — n'est
    // PAS asservi : Prisma ne remonte que la ligne de message. Éprouvé, pas
    // supposé.
    let message = "";

    await sansContrainte(
      ['DROP TRIGGER "agence_territoire_verrou_ecarts" ON "agence"'],
      SOCIETE_A,
      async (tx) => {
        await tx.$executeRawUnsafe(
          `DELETE FROM "calendrier_ferie"
            WHERE "agence_id" = $1::uuid AND "jour_ferie_id" IS NOT NULL`,
          AGENCE_A,
        );

        message = await changerTerritoireDeA(tx).then(
          () => "ACCEPTÉ",
          (cause: unknown) => String(cause),
        );
      },
    );

    expect(message).not.toBe("ACCEPTÉ");
    expect(message).toContain("calendrier_ferie_agence_id_territoire_fkey");
  });

  it("le défaut que D49 retire, rejoué : CASCADE réécrit en silence", async () => {
    // DÉMONSTRATION, et non gardien : ce scénario installe lui-même la variante
    // fautive, il resterait donc vert si quelqu'un remettait `CASCADE` dans la
    // migration. C'est le scénario précédent qui garde le `RESTRICT` ; celui-ci
    // montre ce qu'on perdrait, pour que la décision reste lisible dans dix
    // mois sans avoir à refaire la mesure.
    //
    // Le défaut que D49 retire, rejoué. La clé est remplacée par sa variante
    // `ON UPDATE CASCADE` et le déclencheur écarté ; l'agence n'a plus que son
    // PONT — la configuration de Dolbeau dans le jeu de démonstration. La
    // correction passe alors, `UPDATE 1`, et le territoire de l'écart a changé
    // sans qu'un mot le dise.
    let territoireApres = "";

    await sansContrainte(
      [
        'DROP TRIGGER "agence_territoire_verrou_ecarts" ON "agence"',
        'ALTER TABLE "calendrier_ferie" DROP CONSTRAINT "calendrier_ferie_agence_id_territoire_fkey"',
        `ALTER TABLE "calendrier_ferie" ADD CONSTRAINT "calendrier_ferie_agence_id_territoire_fkey"
           FOREIGN KEY ("agence_id", "territoire") REFERENCES "agence"("id", "territoire")
           ON DELETE CASCADE ON UPDATE CASCADE`,
      ],
      SOCIETE_A,
      async (tx) => {
        // Ne reste que le pont : un écart adossé ferait échouer la propagation
        // sur la clé du fait public, et masquerait la réécriture silencieuse.
        await tx.$executeRawUnsafe(
          `DELETE FROM "calendrier_ferie"
            WHERE "agence_id" = $1::uuid AND "jour_ferie_id" IS NOT NULL`,
          AGENCE_A,
        );

        expect(await changerTerritoireDeA(tx)).toBe(1);

        const ecarts = await tx.$queryRawUnsafe<Array<{ territoire: string }>>(
          `SELECT "territoire" FROM "calendrier_ferie" WHERE "agence_id" = $1::uuid`,
          AGENCE_A,
        );
        territoireApres = ecarts[0]?.territoire ?? "";
      },
    );

    // La preuve du silence : l'écart a suivi l'agence sans que rien ne le dise.
    expect(territoireApres).toBe(TERRITOIRE_B);
  });
});
