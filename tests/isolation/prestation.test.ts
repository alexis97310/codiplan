import { afterAll, afterEach, describe, expect, it } from "vitest";

import { uuidv7 } from "@/lib/db/uuid";

import {
  clientApp,
  clientOwner,
  fermerClients,
  observerSousProprietaire,
  sousSociete,
} from "./setup/db";
import { FAMILLE_A, SOCIETE_A, SOCIETE_B, VAR_SOCIETE } from "./setup/fixtures";

/**
 * LE CATALOGUE DES PRESTATIONS, ÉPROUVÉ SUR LA VRAIE TABLE (L1-12 ; D109, D113).
 *
 * ## CE QUE CE FICHIER MESURE
 *
 * Le cloisonnement — forme « société » —, et les **bornes de la donnée**, qui
 * sont en base et pas seulement dans Zod : *l'import Excel et une correction à
 * la main sont deux chemins de plus*, et une borne qui ne vit que dans la
 * validation d'entrée n'en est pas une (la leçon de `iles`, R3-04).
 *
 * ## CE QU'IL NE MESURE PAS, ET POURQUOI
 *
 * **L'absence de colonne de montant** : elle se tient par un gardien STATIQUE
 * (`tests/unit/prestations/aucun-montant.test.ts`), et non ici. Un scénario ne
 * peut prouver qu'une colonne existe ; *il ne peut pas prouver qu'aucune n'a
 * été ajoutée* — la population lui échappe par construction.
 */

class Annulation extends Error {}

afterAll(fermerClients);

const jetables: string[] = [];

afterEach(async () => {
  if (jetables.length === 0) return;
  const ids = jetables.splice(0, jetables.length);
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "prestation" WHERE "id" = ANY($1::uuid[])`,
    ids,
  );
});

/** Écrit une prestation sous le propriétaire, et rend le motif du refus. */
async function ecrire(
  societeId: string,
  colonnes: {
    code?: string;
    libelle?: string;
    familleId?: string | null;
    duree?: number | null;
  },
  garder = false,
): Promise<string> {
  const id = uuidv7();
  try {
    await clientOwner().$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        "SELECT set_config($1, $2, true)",
        VAR_SOCIETE,
        societeId,
      );
      await tx.$executeRawUnsafe(
        `INSERT INTO "prestation" ("id", "societe_id", "code", "libelle",
           "famille_id", "duree_standard_min", "modifie_le")
         VALUES ($1::uuid, $2::uuid, $3, $4, $5::uuid, $6, now())`,
        id,
        societeId,
        colonnes.code ?? "ENT-PONT",
        colonnes.libelle ?? "Entretien annuel pont élévateur",
        colonnes.familleId ?? null,
        colonnes.duree ?? null,
      );
      if (!garder) {
        throw new Annulation();
      }
    });
  } catch (erreur) {
    if (erreur instanceof Annulation) return "";
    return String(erreur);
  }
  if (garder) jetables.push(id);
  return "";
}

describe("LES BORNES SONT EN BASE, jamais seulement dans Zod", () => {
  it("un code vide est refusé par la contrainte NOMMÉE", async () => {
    // L'assertion NOMME la contrainte (§9, 24/08) : sans cela, un refus venu
    // d'ailleurs — la clé étrangère, l'unicité — passerait pour le bon.
    expect(await ecrire(SOCIETE_A, { code: "   " })).toContain(
      "prestation_code_non_vide",
    );
  });

  it("un libellé vide aussi, et par SA contrainte", async () => {
    expect(await ecrire(SOCIETE_A, { libelle: "" })).toContain(
      "prestation_libelle_non_vide",
    );
  });

  it("ZÉRO minute est refusé — une prestation qui dure zéro n'en est pas une", async () => {
    expect(await ecrire(SOCIETE_A, { duree: 0 })).toContain(
      "prestation_duree_positive",
    );
  });

  it("LE CAS QUI DOIT RESTER VERT POUR SA PROPRE RAISON — une durée NULLE passe", async () => {
    // *NULLE dit « personne ne l'a encore estimée », ce qui est l'état
    // ordinaire d'un catalogue qu'on remplit.* Sans cette moitié, « zéro est
    // refusé » serait aussi bien la preuve que la colonne refuse tout.
    expect(await ecrire(SOCIETE_A, { duree: null })).toBe("");
    expect(await ecrire(SOCIETE_A, { duree: 90 })).toBe("");
  });
});

describe("LA FAMILLE NE PEUT PAS VENIR D'UNE AUTRE SOCIÉTÉ", () => {
  it("une famille de la société A est refusée à une prestation de B", async () => {
    // *Sans la société dans la clé, le verrou serait muet là où le
    // cloisonnement doit mordre* — et les contrôles d'intégrité référentielle
    // contournent les politiques RLS par construction.
    const motif = await ecrire(SOCIETE_B, { familleId: FAMILLE_A });
    expect(motif).toContain("prestation_famille_fkey");
  });

  it("LE CAS QUI DOIT RESTER VERT — la même famille passe pour SA société", async () => {
    expect(await ecrire(SOCIETE_A, { familleId: FAMILLE_A })).toBe("");
  });

  it("et une prestation SANS famille passe — le parent est facultatif", async () => {
    // Un déplacement, un diagnostic ou une formation ne visent aucune famille.
    expect(await ecrire(SOCIETE_A, { familleId: null })).toBe("");
  });
});

describe("LE CLOISONNEMENT — forme « société »", () => {
  it("TÉMOIN PRÉALABLE — la politique est en vigueur et elle mord", async () => {
    // §9, 07/09 : sans ce témoin, une base reconstruite entre-temps rendrait un
    // vert qui ne parle de rien.
    const [drapeaux] = await observerSousProprietaire(
      "lire les deux drapeaux RLS de « prestation » : FORCE ne se prouve pas " +
        "par la lecture, il se lit dans le catalogue (§9, 31/08).",
    ).$queryRawUnsafe<Array<{ actif: boolean; force: boolean }>>(
      `SELECT relrowsecurity AS "actif", relforcerowsecurity AS "force"
         FROM pg_class WHERE relname = 'prestation'`,
    );
    expect(drapeaux?.actif).toBe(true);
    expect(drapeaux?.force).toBe(true);

    const sansContexte = await clientApp().prestation.findMany({
      select: { id: true },
    });
    expect(sansContexte).toHaveLength(0);
  });

  it("une société ne lit que SES prestations", async () => {
    await ecrire(SOCIETE_A, { code: "CHEZ-A" }, true);
    await ecrire(SOCIETE_B, { code: "CHEZ-B" }, true);

    const chezA = await sousSociete(SOCIETE_A, (tx) =>
      tx.prestation.findMany({ select: { code: true } }),
    );
    expect(chezA.map((p) => p.code)).toEqual(["CHEZ-A"]);
  });

  it("le MÊME code existe dans les deux sociétés — l'unicité est PAR société", async () => {
    // *Deux sociétés vendent le même entretien sous le même code*, et c'est
    // l'unicité globale qui serait fausse — jamais celle-ci.
    expect(await ecrire(SOCIETE_A, { code: "ENT-ANNUEL" }, true)).toBe("");
    expect(await ecrire(SOCIETE_B, { code: "ENT-ANNUEL" }, true)).toBe("");
  });

  it("mais DEUX FOIS dans la MÊME société est refusé, et l'index le dit", async () => {
    await ecrire(SOCIETE_A, { code: "DOUBLON" }, true);
    expect(await ecrire(SOCIETE_A, { code: "DOUBLON" })).toContain("23505");
  });
});

describe("L'AUDIT est posé sans qu'on l'ait demandé (I8, D55)", () => {
  it("le déclencheur existe sur la table", async () => {
    // Le périmètre est INVERSÉ : toute table métier cloisonnée est auditée, et
    // le gardien la réclame le jour où elle apparaît. Ce scénario le CONSTATE
    // sur la base plutôt que sur une liste.
    const [presence] = await observerSousProprietaire(
      "compter le déclencheur d'audit de « prestation » : un décompte nul " +
        "ressemble toujours à un sans-faute.",
    ).$queryRawUnsafe<Array<{ n: bigint }>>(
      `SELECT count(*) AS "n" FROM pg_trigger t
         JOIN pg_class c ON c.oid = t.tgrelid
        WHERE c.relname = 'prestation' AND t.tgname = 'journal_audit'`,
    );
    expect(Number(presence?.n)).toBe(1);
  });
});
