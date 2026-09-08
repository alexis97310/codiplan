import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

/** Sentinelle d'annulation : elle fait retomber la transaction, sans erreur. */
class Annulation extends Error {}

import {
  ecartsRlsDeclaree,
  SQL_ETAT_RLS,
  TABLES_RLS_FORCEE,
  TABLES_RLS_SIMPLE,
  type EtatRlsTable,
} from "../../scripts/lib/rls-declaree";
import { sousSociete, clientOwner, fermerClients } from "./setup/db";
import { TABLES_FIXTURES } from "./setup/contrat";
import { SOCIETE_A, SOCIETE_B } from "./setup/fixtures";

/**
 * `FORCE ROW LEVEL SECURITY` sur les tables cloisonnées (correction de revue
 * L0-04, I1). Sans FORCE, le propriétaire des tables — donc le rôle qui applique
 * les migrations — échapperait aux politiques : le filet base de données ne
 * protégerait que des rôles inutilisés.
 *
 * Les scénarios vérifient d'une part l'état déclaré dans `pg_class`, d'autre
 * part le chemin d'écriture que le seed emprunte désormais : écrire une société
 * exige de poser son contexte, y compris pour un rôle privilégié.
 */
/**
 * Les listes ne sont plus recopiées ici : elles viennent de
 * `scripts/lib/rls-declaree.ts`, partagées avec le contrôle qui s'exécute
 * contre la base HÉBERGÉE à chaque migration. Les deux éprouvent ainsi la MÊME
 * règle, et non deux formulations voisines.
 *
 * **Ce fichier en couvrait quatre sur huit** — `calendrier`, `calendrier_plage`,
 * `calendrier_ferie` et `journal_audit` manquaient, chacune ajoutée par un
 * ticket qui n'était pas revenu compléter la liste. C'est l'enchaînement du
 * 20/08 sous une autre forme : une liste écrite à la main devient fausse à la
 * table suivante. Le scénario de CLÔTURE ci-dessous renverse la charge — il
 * part du schéma réel, et une table hors des trois listes le fait échouer.
 */
const TABLES_CLOISONNEES = [...TABLES_RLS_FORCEE];

/**
 * Les tables qui existent RÉELLEMENT au schéma Prisma.
 *
 * Lue ici plutôt que déclarée : c'est la source que ce fichier ne contrôle pas,
 * et c'est elle qui dit si une entrée du contrat est encore une fixture.
 */
const TABLES_REELLES = new Set(
  [
    ...readFileSync(
      join(import.meta.dirname, "..", "..", "prisma", "schema.prisma"),
      "utf8",
    ).matchAll(/@@map\("([a-z_][a-z0-9_]*)"\)/g),
  ].map((trouve) => trouve[1]!),
);

/**
 * Tables FIXTURES « contrat » du harnais (L0-05) qui n'ont PAS ENCORE de table
 * réelle. Elles modèlent les vraies tables des lots 1 et 2 et portent
 * délibérément les mêmes politiques, `FORCE` compris ; elles n'existent pas au
 * schéma Prisma, n'ont donc rien à faire dans les listes de production, et le
 * contrôle de la base hébergée ne les connaît pas.
 *
 * ## LE FILTRE `sansTableReelle` EST LA RÉPARATION D'UN MASQUAGE MESURÉ (L2-01)
 *
 * Cette liste était `[...TABLES_FIXTURES]`, sans filtre. Le contrat ne retire
 * pas une entrée quand la vraie table naît — c'est même sa règle, le RETRAIT
 * étant le geste qui ouvre la brèche —, si bien que **le harnais complétait
 * silencieusement la liste de production avec des tables devenues réelles.**
 *
 * Mesuré le 09/09/2026 : `machine` a manqué à `TABLES_CLOISONNEES` le jour de
 * sa livraison. **Ici, tout était vert** — la fixture bouchait le trou — et
 * c'est le contrôle de la BASE HÉBERGÉE qui a refusé, ne connaissant que la
 * liste de production. *Un contrôle qui n'échoue jamais là où les autres
 * échouent déjà ne prouve rien* (§9, 07/09) : celui-là a servi, et celui-ci
 * mentait.
 *
 * Le filtre part du SCHÉMA PRISMA — une source que ce fichier ne contrôle pas :
 * dès qu'une table du contrat y apparaît, elle sort d'ici et doit être rangée
 * dans les listes de production, comme sur la base hébergée.
 */
const FIXTURES_CONTRAT = TABLES_FIXTURES.filter(
  (table) => !TABLES_REELLES.has(table),
);

/** Les listes telles que ce harnais les voit — production plus fixtures. */
const LISTES_HARNAIS = {
  forcee: [...TABLES_RLS_FORCEE, ...FIXTURES_CONTRAT],
};

/** Référentiels de plateforme : RLS activée, mais jamais forcée (D4). */
const REFERENTIELS_PLATEFORME = [...TABLES_RLS_SIMPLE];

type EtatRls = { relrowsecurity: boolean; relforcerowsecurity: boolean };

function etatRls(table: string): Promise<EtatRls[]> {
  return clientOwner().$queryRawUnsafe<EtatRls[]>(
    `SELECT "relrowsecurity", "relforcerowsecurity"
       FROM pg_catalog.pg_class
      WHERE "oid" = $1::regclass`,
    table,
  );
}

describe("FORCE ROW LEVEL SECURITY", () => {
  afterAll(fermerClients);

  it.each(TABLES_CLOISONNEES)(
    "la table cloisonnée « %s » force RLS jusque sur son propriétaire",
    async (table) => {
      const [etat] = await etatRls(table);
      expect(etat?.relrowsecurity).toBe(true);
      expect(etat?.relforcerowsecurity).toBe(true);
    },
  );

  it.each(REFERENTIELS_PLATEFORME)(
    "le référentiel de plateforme « %s » active RLS sans la forcer",
    async (table) => {
      const [etat] = await etatRls(table);
      expect(etat?.relrowsecurity).toBe(true);
      expect(etat?.relforcerowsecurity).toBe(false);
    },
  );

  it("CLÔTURE : toute table du schéma est rangée dans une des trois listes", () =>
    clientOwner()
      .$queryRawUnsafe<EtatRlsTable[]>(SQL_ETAT_RLS)
      .then((observees) => {
        // Le renversement de D41, appliqué à l'état RLS : le contrôle part du
        // SCHÉMA et non d'une liste écrite à la main. Une table créée demain
        // sans classement fait tomber la vérification le jour où elle est
        // écrite — c'est ce qui manquait quand ce fichier en couvrait quatre
        // sur huit.
        expect(ecartsRlsDeclaree(observees, LISTES_HARNAIS)).toEqual([]);
        // Le témoin : une énumération vide passerait sans rien garder.
        expect(observees.length).toBeGreaterThanOrEqual(17);
      }));

  it("ÉPREUVE : `ENABLE` réellement retiré d'une table cloisonnée est refusé", async () => {
    // Le jumeau du §9, dans une transaction annulée : le DDL est transactionnel
    // en PostgreSQL, l'état revient au `ROLLBACK`.
    let ecarts: string[] = [];
    try {
      await clientOwner().$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          'ALTER TABLE "societe" DISABLE ROW LEVEL SECURITY',
        );
        ecarts = ecartsRlsDeclaree(
          await tx.$queryRawUnsafe<EtatRlsTable[]>(SQL_ETAT_RLS),
          LISTES_HARNAIS,
        );
        throw new Annulation();
      });
    } catch (erreur) {
      if (!(erreur instanceof Annulation)) {
        throw erreur;
      }
    }

    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("societe");
    expect(ecarts[0]).toContain("NON activée");
  });

  it("ÉPREUVE : `FORCE` réellement retiré est refusé LUI AUSSI", async () => {
    // **Le cas que la lecture ne peut pas voir.** `FORCE` ne concerne que le
    // propriétaire : sous le rôle applicatif, non propriétaire, retirer FORCE
    // ne change RIEN — mesuré, zéro ligne sans contexte dans les deux cas,
    // pendant que le propriétaire, lui, voit les deux sociétés. C'est le seul
    // endroit du dépôt où l'ATTRIBUT est la seule preuve possible, et c'est ce
    // qui justifie qu'on en fasse une.
    let ecarts: string[] = [];
    try {
      await clientOwner().$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          'ALTER TABLE "agence" NO FORCE ROW LEVEL SECURITY',
        );
        ecarts = ecartsRlsDeclaree(
          await tx.$queryRawUnsafe<EtatRlsTable[]>(SQL_ETAT_RLS),
          LISTES_HARNAIS,
        );
        throw new Annulation();
      });
    } catch (erreur) {
      if (!(erreur instanceof Annulation)) {
        throw erreur;
      }
    }

    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("agence");
    expect(ecarts[0]).toContain("NON forcée");
    expect(ecarts[0]).toContain("le PROPRIÉTAIRE y échappe");
  });

  it("ÉPREUVE : un référentiel de plateforme qui gagnerait FORCE est refusé", async () => {
    // Le sens inverse, et il compte autant : `FORCE` sur `devise` empêcherait
    // le propriétaire de l'amorcer, et le seed échouerait (D4).
    let ecarts: string[] = [];
    try {
      await clientOwner().$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          'ALTER TABLE "devise" FORCE ROW LEVEL SECURITY',
        );
        ecarts = ecartsRlsDeclaree(
          await tx.$queryRawUnsafe<EtatRlsTable[]>(SQL_ETAT_RLS),
          LISTES_HARNAIS,
        );
        throw new Annulation();
      });
    } catch (erreur) {
      if (!(erreur instanceof Annulation)) {
        throw erreur;
      }
    }

    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("devise");
    expect(ecarts[0]).toContain("gagné FORCE");
  });

  it("le propriétaire ne lit aucune société sans contexte", async () => {
    // Le propriétaire du schéma des tests est superutilisateur, ce qui court-
    // circuite RLS quoi qu'il arrive : la preuve se fait donc sous le rôle
    // applicatif, seul représentatif de la connexion de service.
    const societes = await sousSociete(SOCIETE_A, (tx) =>
      tx.societe.findMany({ select: { id: true } }),
    );
    expect(societes.map((s) => s.id)).toEqual([SOCIETE_A]);
  });

  it("le chemin d'écriture du seed : une société ne s'écrit que sous son propre contexte", async () => {
    const nouvelle = "cccccccc-0000-7000-8000-0000000000c9";
    const champs = {
      code: "ISO-C",
      raison_sociale: "Société C",
      pays: "Nouvelle-Calédonie",
      territoire: "Province Nord",
      fuseau_horaire: "Pacific/Noumea",
      devise_code: "XPF",
      majoration_hors_ouverture_pct: "50",
      couleur_primaire: "#0b5cad",
      couleur_secondaire: "#f4a300",
      langue: "fr",
    };

    // Sous le contexte d'une AUTRE société, l'écriture est refusée.
    await expect(
      sousSociete(SOCIETE_B, (tx) =>
        tx.societe.create({ data: { id: nouvelle, ...champs } }),
      ),
    ).rejects.toThrow();

    // Sous son propre contexte — ce que fait le seed — elle passe.
    const creee = await sousSociete(nouvelle, (tx) =>
      tx.societe.create({ data: { id: nouvelle, ...champs } }),
    );
    expect(creee.id).toBe(nouvelle);

    await sousSociete(nouvelle, (tx) =>
      tx.societe.delete({ where: { id: nouvelle } }),
    );
  });
});
