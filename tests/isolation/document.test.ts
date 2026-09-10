import { afterAll, describe, expect, it } from "vitest";

import { exigence } from "./setup/contrat";
import type { PrismaClient } from "@prisma/client";

import {
  avecPortail,
  sousSociete,
  clientOwner,
  fermerClients,
  observerSousProprietaire,
} from "./setup/db";
import {
  CLIENT_A1,
  DOC_MACHINE_A1,
  DOC_MACHINE_A1_INTERNE,
  DOC_MACHINE_A2,
  DOC_MODELE_A,
  DOC_MODELE_AILLEURS,
  DOC_MODELE_B,
  EMPREINTE_NOTICE,
  FAMILLE_A,
  FAMILLE_A_AILLEURS,
  MACHINE_A1,
  MODELE_A,
  MODELE_A_AILLEURS,
  SITE_A1_S1,
  SOCIETE_A,
  VAR_CLIENT,
  VAR_PERIMETRE,
  VAR_SOCIETE,
} from "./setup/fixtures";

/**
 * LA DOCUMENTATION DES MACHINES, ÉPROUVÉE SUR LA VRAIE TABLE
 * (lot 8, tickets L8-01 à L8-04 ; I1, I8 ; D10, D22, D93).
 *
 * ## Ce que ce fichier mesure, et pourquoi il ne suffit pas de regarder
 * `document`
 *
 * La décision d'exploitation du 13/09/2026 :
 *
 *   *« Un compte de portail ne voit les documents d'un MODÈLE que si une
 *   machine de ce modèle se trouve DANS SON PROPRE PÉRIMÈTRE — sa société, son
 *   site, son habilitation. Jamais parce que sa société en possède un
 *   ailleurs. »*
 *
 * **Le jumeau qui compte est celui que l'exploitation a nommé** : un compte
 * habilité sur un seul site, dont la société possède ailleurs une machine d'un
 * modèle absent de son site, ne doit RIEN voir de ce modèle — *ni la notice, ni
 * son existence, ni un compteur à zéro qui la trahirait.* Un « 0 document »
 * affiché là où il n'y a rien à afficher est déjà une fuite : il dit que la
 * question a un sens.
 *
 * C'est pourquoi les scénarios ci-dessous mesurent TROIS étages et non un :
 * le document, le modèle, la famille. Une mesure faite sur `document` seul
 * serait verte alors que la fuite passerait par la ligne du dessus.
 *
 * **Chaque refus a son jumeau** (§9, 24/08) : un scénario qui retire RÉELLEMENT
 * le verrou visé, dans une transaction annulée, et montre que la lecture
 * fautive passe alors. Et **à côté de chaque cas qui doit rougir, un cas qui
 * doit rester vert pour SA PROPRE RAISON** (§9, 11/09) : `DOC_MODELE_A` est
 * visible au même compte, au même instant, sous la même politique.
 */

afterAll(fermerClients);

/** Sentinelle d'annulation : elle fait retomber la transaction, sans erreur. */
class Annulation extends Error {}

/**
 * Retire RÉELLEMENT un verrou, pose un contexte de PORTAIL, joue `travail`,
 * puis ANNULE.
 *
 * Sous le PROPRIÉTAIRE, parce que remplacer une politique est un droit de
 * propriétaire. **Et le propriétaire est soumis à `FORCE ROW LEVEL SECURITY`**,
 * donc les politiques mordent sur lui aussi : c'est ce qui rend la mesure
 * honnête — la lecture qui suit passe bien sous la politique qu'on vient de
 * dégrader, et pas à côté.
 */
async function sousPortailDegrade(
  degradation: readonly string[],
  contexte: { societeId: string; clientId: string; sites?: readonly string[] },
  travail: (tx: PrismaClient) => Promise<void>,
): Promise<void> {
  try {
    await clientOwner().$transaction(async (tx) => {
      for (const instruction of degradation) {
        await tx.$executeRawUnsafe(instruction);
      }
      await tx.$executeRawUnsafe(
        "SELECT set_config($1, $2, true)",
        VAR_SOCIETE,
        contexte.societeId,
      );
      await tx.$executeRawUnsafe(
        "SELECT set_config($1, $2, true)",
        VAR_CLIENT,
        contexte.clientId,
      );
      await tx.$executeRawUnsafe(
        "SELECT set_config($1, $2, true)",
        VAR_PERIMETRE,
        (contexte.sites ?? []).join(","),
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

/** Le contexte du compte portail restreint : client A1, site S1, et lui seul. */
const PORTAIL_RESTREINT = {
  societeId: SOCIETE_A,
  clientId: CLIENT_A1,
  perimetreSites: [SITE_A1_S1],
} as const;

describe("le TÉMOIN PRÉALABLE — la politique est en vigueur et elle mord", () => {
  // §9, 07/09 : « un résultat qui vous surprend en bien est un soupçon sur la
  // mesure avant d'être un fait sur le monde ». Sans ce témoin, une base
  // reconstruite entre-temps rendrait un vert qui ne parle de rien.
  it("les DEUX drapeaux RLS sont posés sur `document`", async () => {
    const [etat] = await observerSousProprietaire(
      "lire pg_class : `FORCE ROW LEVEL SECURITY` ne concerne QUE le " +
        "propriétaire, et ne se prouve donc pas par une lecture faite sous le " +
        "rôle applicatif (§9, 31/08). C'est le seul endroit où l'attribut est " +
        "la seule preuve possible.",
    ).$queryRawUnsafe<
      Array<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>
    >(
      `SELECT "relrowsecurity", "relforcerowsecurity" FROM "pg_class"
        WHERE "relname" = 'document' AND "relnamespace" = 'public'::regnamespace`,
    );
    expect(etat?.relrowsecurity).toBe(true);
    expect(etat?.relforcerowsecurity).toBe(true);
  });

  it("sans contexte, la table ne rend AUCUNE ligne", async () => {
    const vues = await sousSociete("", (tx) =>
      tx.document.findMany({ select: { id: true } }),
    );
    expect(vues).toEqual([]);
    // TÉMOIN DE NON-VACUITÉ : il y a bien des lignes à voir. Zéro contre zéro
    // n'est pas un résultat, c'est une absence de mesure (§9, 10/09).
    const [reel] = await observerSousProprietaire(
      "compter les lignes réellement présentes : sans ce nombre, « aucune " +
        "ligne visible » serait vrai d'une base vide.",
    ).$queryRawUnsafe<Array<{ n: bigint }>>(
      `SELECT count(*) AS "n" FROM "document"`,
    );
    expect(Number(reel?.n)).toBe(6);
  });
});

describe("l'utilisateur INTERNE ne perd rien", () => {
  it("il lit les cinq documents de sa société, classe `interne` comprise", async () => {
    const vus = await sousSociete(SOCIETE_A, (tx) =>
      tx.document.findMany({ select: { id: true } }),
    );
    expect(vus.map((d) => d.id).sort()).toEqual(
      [
        DOC_MODELE_A,
        DOC_MODELE_AILLEURS,
        DOC_MACHINE_A1,
        DOC_MACHINE_A2,
        DOC_MACHINE_A1_INTERNE,
      ].sort(),
    );
    // Et rien de l'autre société : c'est la sous-requête qui le tient, aucune
    // clause de société n'étant écrite dans la politique de `document`.
    expect(vus.map((d) => d.id)).not.toContain(DOC_MODELE_B);
  });

  it("il lit tout le catalogue, machines ou pas — la branche interne de l'ascendance", async () => {
    // C'est la moitié de la forme « ascendance » que personne ne remarque, et
    // sans laquelle créer un modèle avant sa première machine serait
    // impossible : la table se refuserait à elle-même.
    const modeles = await sousSociete(SOCIETE_A, (tx) =>
      tx.modeleMateriel.findMany({ select: { id: true } }),
    );
    expect(modeles.map((m) => m.id).sort()).toEqual(
      [MODELE_A, MODELE_A_AILLEURS].sort(),
    );
    const familles = await sousSociete(SOCIETE_A, (tx) =>
      tx.familleMateriel.findMany({ select: { id: true } }),
    );
    expect(familles.map((f) => f.id).sort()).toEqual(
      [FAMILLE_A, FAMILLE_A_AILLEURS].sort(),
    );
  });
});

describe("LA DÉCISION DU 13/09 — le chemin passe par la machine, jamais par la société", () => {
  it(
    exigence(
      "perimetre_sites",
      "un compte portail restreint ne voit QUE les documents de son périmètre",
    ),
    async () => {
      const vus = await avecPortail(PORTAIL_RESTREINT, (tx) =>
        tx.document.findMany({ select: { id: true } }),
      );
      // DEUX, et deux exactement : la notice du modèle qu'il possède, et le
      // certificat de sa machine. Le certificat de la machine du site S2
      // disparaît par la forme « parc » de `machine` ; la notice du modèle
      // d'ailleurs par la forme « ascendance » de `modele_materiel` ; la note
      // interne par le rétrécissement de la classe.
      expect(vus.map((d) => d.id).sort()).toEqual(
        [DOC_MODELE_A, DOC_MACHINE_A1].sort(),
      );
    },
  );

  it(
    exigence(
      "perimetre_sites",
      "il ne voit NI la notice du modèle d'ailleurs, NI le modèle, NI sa famille",
    ),
    async () => {
      // LES TROIS ÉTAGES. Une mesure faite sur `document` seul serait verte
      // alors que la fuite passerait par la ligne du dessus — c'est
      // exactement ce que l'exploitation a nommé : « ni la notice, ni son
      // existence, ni un compteur à zéro qui la trahirait ».
      const documents = await avecPortail(PORTAIL_RESTREINT, (tx) =>
        tx.document.findMany({
          where: { modele_id: MODELE_A_AILLEURS },
          select: { id: true },
        }),
      );
      expect(documents).toEqual([]);

      const modeles = await avecPortail(PORTAIL_RESTREINT, (tx) =>
        tx.modeleMateriel.findMany({ select: { id: true } }),
      );
      expect(modeles.map((m) => m.id)).toEqual([MODELE_A]);

      const familles = await avecPortail(PORTAIL_RESTREINT, (tx) =>
        tx.familleMateriel.findMany({ select: { id: true } }),
      );
      expect(familles.map((f) => f.id)).toEqual([FAMILLE_A]);

      // **AUCUN COMPTEUR À ZÉRO N'EST POSSIBLE**, et c'est le point : un écran
      // ne peut pas afficher « 0 document » pour un modèle dont il ne peut pas
      // lire la ligne. Le compte ne peut même pas nommer le modèle qu'il
      // interroge.
      const [compteur] = await avecPortail(PORTAIL_RESTREINT, (tx) =>
        tx.$queryRawUnsafe<Array<{ n: bigint }>>(
          `SELECT count(*) AS "n" FROM "modele_materiel" WHERE "id" = $1::uuid`,
          MODELE_A_AILLEURS,
        ),
      );
      expect(Number(compteur?.n)).toBe(0);

      // LE CAS QUI DOIT RESTER VERT POUR SA PROPRE RAISON (§9, 11/09) : le
      // modèle qu'il POSSÈDE se compte, lui, et il vaut un. Sans cette moitié,
      // « zéro » serait aussi bien la preuve que la lecture ne marche pas.
      const [temoin] = await avecPortail(PORTAIL_RESTREINT, (tx) =>
        tx.$queryRawUnsafe<Array<{ n: bigint }>>(
          `SELECT count(*) AS "n" FROM "modele_materiel" WHERE "id" = $1::uuid`,
          MODELE_A,
        ),
      );
      expect(Number(temoin?.n)).toBe(1);
    },
  );

  it(
    exigence(
      "perimetre_sites",
      "JUMEAU — l'ascendance retirée, la notice du modèle d'ailleurs REPARAÎT",
    ),
    async () => {
      // La faute TELLE QU'ELLE SE COMMETTRAIT : quelqu'un « simplifie » la
      // politique de `modele_materiel` en lui rendant la clause de société
      // seule — la forme que portent onze autres tables, et qui passe tous les
      // gardiens de forme sans rien dire.
      await sousPortailDegrade(
        [
          `DROP POLICY "cloisonnement_ascendance" ON "modele_materiel"`,
          `CREATE POLICY "cloisonnement_societe" ON "modele_materiel"
             USING ("societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid)
             WITH CHECK ("societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid)`,
        ],
        { societeId: SOCIETE_A, clientId: CLIENT_A1, sites: [SITE_A1_S1] },
        async (tx) => {
          const vus = await tx.$queryRawUnsafe<Array<{ id: string }>>(
            `SELECT "id" FROM "document" ORDER BY "id"`,
          );
          // LA FUITE, MESURÉE : la notice du pont élévateur de Koné apparaît
          // au compte restreint à Ducos, et avec elle l'information que la
          // société en exploite un.
          expect(vus.map((d) => d.id)).toContain(DOC_MODELE_AILLEURS);
          // Et le modèle lui-même, qui est la vraie fuite : le document n'en
          // était que le symptôme.
          const modeles = await tx.$queryRawUnsafe<Array<{ id: string }>>(
            `SELECT "id" FROM "modele_materiel" ORDER BY "id"`,
          );
          expect(modeles.map((m) => m.id)).toContain(MODELE_A_AILLEURS);
        },
      );

      // LE VERROU EST REVENU au `ROLLBACK` — sans quoi le jumeau laisserait la
      // base dégradée pour les scénarios suivants.
      const apres = await avecPortail(PORTAIL_RESTREINT, (tx) =>
        tx.document.findMany({ select: { id: true } }),
      );
      expect(apres.map((d) => d.id)).not.toContain(DOC_MODELE_AILLEURS);
    },
  );
});

describe("LA CLASSE RÉTRÉCIT, elle n'ouvre rien (L8-03, L8-04)", () => {
  it("un document `interne` est invisible au portail et visible à l'interne", async () => {
    const auPortail = await avecPortail(PORTAIL_RESTREINT, (tx) =>
      tx.document.findMany({
        where: { machine_id: MACHINE_A1 },
        select: { id: true, classe: true },
      }),
    );
    expect(auPortail.map((d) => d.id)).toEqual([DOC_MACHINE_A1]);

    // LE CAS QUI DOIT RESTER VERT POUR SA PROPRE RAISON : la MÊME machine, le
    // MÊME contexte de société, rend les DEUX documents à l'interne. Ce n'est
    // donc pas la machine qui disparaît, c'est la classe qui retire.
    const enInterne = await sousSociete(SOCIETE_A, (tx) =>
      tx.document.findMany({
        where: { machine_id: MACHINE_A1 },
        select: { id: true },
      }),
    );
    expect(enInterne.map((d) => d.id).sort()).toEqual(
      [DOC_MACHINE_A1, DOC_MACHINE_A1_INTERNE].sort(),
    );
  });

  it("JUMEAU — le rétrécissement retiré, la note interne reparaît au portail", async () => {
    await sousPortailDegrade(
      [
        `DROP POLICY "cloisonnement_heritage" ON "document"`,
        `CREATE POLICY "cloisonnement_heritage" ON "document"
           USING (
             EXISTS (SELECT 1 FROM "machine" WHERE "machine"."id" = "document"."machine_id")
             OR EXISTS (SELECT 1 FROM "modele_materiel" WHERE "modele_materiel"."id" = "document"."modele_id")
           )
           WITH CHECK (
             EXISTS (SELECT 1 FROM "machine" WHERE "machine"."id" = "document"."machine_id")
             OR EXISTS (SELECT 1 FROM "modele_materiel" WHERE "modele_materiel"."id" = "document"."modele_id")
           )`,
      ],
      { societeId: SOCIETE_A, clientId: CLIENT_A1, sites: [SITE_A1_S1] },
      async (tx) => {
        const vus = await tx.$queryRawUnsafe<Array<{ id: string }>>(
          `SELECT "id" FROM "document" WHERE "machine_id" = $1::uuid`,
          MACHINE_A1,
        );
        expect(vus.map((d) => d.id)).toContain(DOC_MACHINE_A1_INTERNE);
      },
    );
  });
});

describe("LA CIBLE UNIQUE, tenue par le SCHÉMA (L8-01)", () => {
  const NEUF = "aaaaaaaa-0000-7000-8000-00000000d0ff";

  /** Écrit une ligne de document sous le propriétaire, et rend le motif du refus. */
  async function refusDEcriture(
    modeleId: string | null,
    machineId: string | null,
  ): Promise<string> {
    try {
      await clientOwner().$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          "SELECT set_config($1, $2, true)",
          VAR_SOCIETE,
          SOCIETE_A,
        );
        await tx.$executeRawUnsafe(
          `INSERT INTO "document" ("id", "societe_id", "modele_id", "machine_id",
             "classe", "libelle", "nom_fichier", "type_mime", "taille_octets",
             "empreinte", "objet_cle", "modifie_le")
           VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 'client', 'x', 'x.pdf',
             'application/pdf', 1, $5, 'iso/x.pdf', now())`,
          NEUF,
          SOCIETE_A,
          modeleId,
          machineId,
          EMPREINTE_NOTICE,
        );
        throw new Annulation();
      });
    } catch (erreur) {
      if (erreur instanceof Annulation) {
        return "";
      }
      return String(erreur);
    }
    return "";
  }

  it("une ligne à DEUX cibles est refusée par la contrainte NOMMÉE", async () => {
    const motif = await refusDEcriture(MODELE_A, MACHINE_A1);
    // L'assertion NOMME la contrainte : sans cela, un refus venu d'ailleurs
    // passerait pour le bon (§9, 24/08).
    expect(motif).toContain("document_cible_unique");
  });

  it("une ligne SANS cible est refusée par la MÊME contrainte", async () => {
    const motif = await refusDEcriture(null, null);
    expect(motif).toContain("document_cible_unique");
  });

  it("JUMEAU — la contrainte retirée, la ligne à deux cibles PASSE", async () => {
    let ecrite = 0;
    try {
      await clientOwner().$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `ALTER TABLE "document" DROP CONSTRAINT "document_cible_unique"`,
        );
        await tx.$executeRawUnsafe(
          "SELECT set_config($1, $2, true)",
          VAR_SOCIETE,
          SOCIETE_A,
        );
        ecrite = await tx.$executeRawUnsafe(
          `INSERT INTO "document" ("id", "societe_id", "modele_id", "machine_id",
             "classe", "libelle", "nom_fichier", "type_mime", "taille_octets",
             "empreinte", "objet_cle", "modifie_le")
           VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 'client', 'x', 'x.pdf',
             'application/pdf', 1, $5, 'iso/x.pdf', now())`,
          NEUF,
          SOCIETE_A,
          MODELE_A,
          MACHINE_A1,
          EMPREINTE_NOTICE,
        );
        throw new Annulation();
      });
    } catch (erreur) {
      if (!(erreur instanceof Annulation)) {
        throw erreur;
      }
    }
    // LA VIOLATION A BIEN EU LIEU (§9, 30/08) : sans ce décompte, le jumeau
    // serait vert sans avoir rien écrit.
    expect(ecrite).toBe(1);
  });
});

describe("L'UNION de L8-02, sans qu'aucune ligne soit copiée", () => {
  it("l'écran d'une machine voit ses documents ET ceux de son modèle", async () => {
    const union = await avecPortail(PORTAIL_RESTREINT, (tx) =>
      tx.document.findMany({
        where: {
          OR: [{ machine_id: MACHINE_A1 }, { modele_id: MODELE_A }],
        },
        select: { id: true, modele_id: true, machine_id: true },
      }),
    );
    expect(union.map((d) => d.id).sort()).toEqual(
      [DOC_MACHINE_A1, DOC_MODELE_A].sort(),
    );
    // La DISTINCTION reste visible : un document de modèle se corrige une fois
    // pour toutes, un document de machine n'existe que là.
    expect(union.filter((d) => d.modele_id !== null)).toHaveLength(1);
    expect(union.filter((d) => d.machine_id !== null)).toHaveLength(1);
  });

  it("une correction du document de modèle se voit sur TOUTES ses machines", async () => {
    // Aucune ligne n'est copiée : c'est la même, et c'est tout l'objet de
    // L8-02 — « éviter de dupliquer un PDF sur cinq cents machines et de ne
    // jamais pouvoir le corriger ».
    const [avant] = await observerSousProprietaire(
      "compter les documents accrochés au modèle : la propriété à mesurer est " +
        "qu'il n'y en a QU'UN pour deux machines, ce qu'une lecture cloisonnée " +
        "ne distinguerait pas d'un filtre.",
    ).$queryRawUnsafe<Array<{ n: bigint }>>(
      `SELECT count(*) AS "n" FROM "document" WHERE "modele_id" = $1::uuid`,
      MODELE_A,
    );
    expect(Number(avant?.n)).toBe(1);

    const [machines] = await observerSousProprietaire(
      "compter les machines de ce modèle : sans ce nombre, « un seul " +
        "document » ne dirait rien sur la non-duplication.",
    ).$queryRawUnsafe<Array<{ n: bigint }>>(
      `SELECT count(*) AS "n" FROM "machine" WHERE "modele_id" = $1::uuid`,
      MODELE_A,
    );
    expect(Number(machines?.n)).toBe(2);
  });
});

describe("L'ÉCRITURE est bornée par la même politique", () => {
  it("un compte portail ne peut pas accrocher un document à une machine hors périmètre", async () => {
    let ecrite = -1;
    await avecPortail(PORTAIL_RESTREINT, async (tx) => {
      // La ligne est INVISIBLE pour lui : le refus est SILENCIEUX — zéro ligne
      // écrite, pas une erreur. C'est le sens de défaillance de RLS, et il faut
      // le mesurer comme tel (§9, 08/09).
      ecrite = await tx.$executeRawUnsafe(
        `UPDATE "document" SET "libelle" = 'détourné' WHERE "id" = $1::uuid`,
        DOC_MACHINE_A2,
      );
    });
    expect(ecrite).toBe(0);

    // LE CAS QUI DOIT RESTER VERT POUR SA PROPRE RAISON : le MÊME geste sur SON
    // document passe. Sans cette moitié, « zéro » serait aussi bien la preuve
    // que l'écriture ne marche nulle part.
    let sienne = -1;
    await avecPortail(PORTAIL_RESTREINT, async (tx) => {
      sienne = await tx.$executeRawUnsafe(
        `UPDATE "document" SET "libelle" = "libelle" WHERE "id" = $1::uuid`,
        DOC_MACHINE_A1,
      );
    });
    expect(sienne).toBe(1);
  });

  it("et il ne peut pas se donner un document en le rattachant à SON modèle", async () => {
    // La faute exacte qu'un `WITH CHECK` absent laisserait passer : recopier la
    // notice d'un modèle qu'on ne voit pas vers un modèle qu'on voit. Elle est
    // refusée en amont — la ligne source est déjà invisible.
    const source = await avecPortail(PORTAIL_RESTREINT, (tx) =>
      tx.document.findMany({
        where: { id: DOC_MODELE_AILLEURS },
        select: { id: true },
      }),
    );
    expect(source).toEqual([]);
  });
});

describe("LE COÛT, MESURÉ et non affirmé (§9, 07/09)", () => {
  it("l'ascendance produit un sous-plan HACHÉ, pas une exécution par ligne", async () => {
    // *« Une sous-requête d'existence à chaque ligne lue »* est un coût énoncé,
    // et le §9 (07/09) dit ce qu'il vaut : le 06/09, la même phrase a été
    // démentie par un `EXPLAIN` qui rendait un *hash semi-join*. On mesure donc
    // plutôt que d'affirmer, et on rend la mesure avec ce qui l'a produite.
    const plan = await avecPortail(PORTAIL_RESTREINT, async (tx) => {
      const lignes = await tx.$queryRawUnsafe<Array<Record<string, string>>>(
        `EXPLAIN SELECT "id" FROM "modele_materiel"`,
      );
      return lignes.map((l) => Object.values(l)[0] ?? "").join("\n");
    });
    // LA MESURE, RENDUE AVEC CE QUI L'A PRODUITE. PostgreSQL 16 rend, sur les
    // fixtures : `filter: (... or (hashed subplan 2))`. **« hashed »** est le
    // mot qui décide — le sous-plan est évalué UNE fois et haché, puis chaque
    // ligne de modèle n'est qu'une recherche dans la table de hachage. Ce n'est
    // donc pas « une sous-requête à chaque ligne lue », qui est exactement la
    // phrase que le §9 (07/09) a déjà démentie une fois par un `EXPLAIN`.
    expect(plan.toLowerCase()).toMatch(/hashed subplan|semi join|hash join/);
    // TÉMOIN : le plan a bien été lu. Une chaîne vide passerait la ligne
    // ci-dessus si le motif était absent, et un plan vide ressemble trait pour
    // trait à un plan sain.
    expect(plan.length).toBeGreaterThan(20);
  });
});
