import { afterAll, describe, expect, it } from "vitest";

import { avecSociete, clientOwner, fermerClients } from "./setup/db";
import { SOCIETE_A } from "./setup/fixtures";

/**
 * Identifiants en `uuid` natif et forme D4 des politiques (correction de revue
 * L0-04).
 *
 * D4 arrête la politique de cloisonnement sous la forme
 * `societe_id = current_setting('app.societe_id')::uuid OR societe_id IS NULL`.
 * Le `::uuid` avait été écarté parce que les colonnes étaient stockées en
 * `text` ; elles sont désormais typées `uuid`, et le cast est rétabli. Ces
 * scénarios verrouillent les deux moitiés de la correction — sans quoi rien
 * n'empêcherait un futur retour au `text`.
 */
type ColonneType = {
  table_name: string;
  column_name: string;
  udt_name: string;
};

/** Colonnes d'identifiants de toutes les tables réelles du socle. */
const COLONNES_IDENTIFIANT = [
  ["societe", "id"],
  ["parite", "id"],
  ["agence", "id"],
  ["agence", "societe_id"],
  ["agence", "calendrier_id"],
  ["utilisateur", "id"],
  ["utilisateur_societe", "id"],
  ["utilisateur_societe", "utilisateur_id"],
  ["utilisateur_societe", "societe_id"],
  ["utilisateur_client", "id"],
  ["utilisateur_client", "utilisateur_id"],
  ["utilisateur_client", "client_id"],
  ["utilisateur_client", "societe_id"],
] as const;

/** Politiques de cloisonnement des tables réelles, et la colonne qu'elles filtrent. */
const POLITIQUES_CLOISONNEMENT = [
  ["societe", "cloisonnement_identite"],
  ["agence", "cloisonnement_societe"],
  ["utilisateur_societe", "cloisonnement_societe"],
  ["utilisateur_client", "cloisonnement_habilitation"],
  ["utilisateur_client_site", "cloisonnement_habilitation"],
] as const;

function typeColonne(table: string, colonne: string): Promise<ColonneType[]> {
  return clientOwner().$queryRawUnsafe<ColonneType[]>(
    `SELECT "table_name", "column_name", "udt_name"
       FROM information_schema.columns
      WHERE "table_schema" = 'public' AND "table_name" = $1 AND "column_name" = $2`,
    table,
    colonne,
  );
}

type Politique = { qual: string | null; with_check: string | null };

function politique(table: string, nom: string): Promise<Politique[]> {
  return clientOwner().$queryRawUnsafe<Politique[]>(
    `SELECT "qual", "with_check"
       FROM pg_catalog.pg_policies
      WHERE "schemaname" = 'public' AND "tablename" = $1 AND "policyname" = $2`,
    table,
    nom,
  );
}

describe("identifiants en uuid natif", () => {
  afterAll(fermerClients);

  it.each(COLONNES_IDENTIFIANT)(
    "%s.%s est typée uuid, pas text",
    async (table, colonne) => {
      const [description] = await typeColonne(table, colonne);
      expect(description?.udt_name).toBe("uuid");
    },
  );

  it("le périmètre de sites est un uuid — et une CLÉ, depuis L1-02b (D10)", async () => {
    // Cette garantie portait sur `utilisateur_client.perimetre_sites uuid[]`.
    // Elle n'est pas retirée : elle est déplacée et RENFORCÉE. Le tableau
    // garantissait le type de ses éléments et rien d'autre — PostgreSQL 16 ne
    // sait pas contraindre les éléments d'un tableau, si bien qu'un site
    // inexistant ou d'une autre société y entrait sans obstacle.
    const [description] = await typeColonne(
      "utilisateur_client_site",
      "site_id",
    );
    expect(description?.udt_name).toBe("uuid");

    // Et la colonne d'origine a bien DISPARU : deux sources d'un même périmètre
    // divergeraient en silence (§9, 01/09).
    const [ancienne] = await typeColonne(
      "utilisateur_client",
      "perimetre_sites",
    );
    expect(ancienne).toBeUndefined();
  });

  it("devise.code reste du texte : c'est un code ISO, pas un identifiant", async () => {
    const [description] = await typeColonne("devise", "code");
    expect(description?.udt_name).toBe("text");
  });
});

describe("forme D4 des politiques de cloisonnement", () => {
  afterAll(fermerClients);

  it.each(POLITIQUES_CLOISONNEMENT)(
    "la politique « %s / %s » compare bien à un uuid",
    async (table, nom) => {
      const [expression] = await politique(table, nom);
      expect(expression?.qual).toContain("::uuid");
      expect(expression?.with_check).toContain("::uuid");
    },
  );

  it("une société positionnée hors format uuid est refusée, pas silencieusement ignorée", async () => {
    // Conséquence assumée du typage : une valeur de contexte qui n'est pas un
    // UUID lève, au lieu de ne rien remonter. Un contexte corrompu se voit.
    await expect(
      avecSociete("pas-un-uuid", (tx) => tx.agence.findMany()),
    ).rejects.toThrow();
  });

  it("le contexte reste fonctionnel avec un uuid bien formé", async () => {
    const agences = await avecSociete(SOCIETE_A, (tx) =>
      tx.agence.findMany({ select: { societe_id: true } }),
    );
    expect(agences.every((a) => a.societe_id === SOCIETE_A)).toBe(true);
    expect(agences.length).toBeGreaterThan(0);
  });
});
