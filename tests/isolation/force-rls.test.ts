import { afterAll, describe, expect, it } from "vitest";

import { avecSociete, clientOwner, fermerClients } from "./setup/db";
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
const TABLES_CLOISONNEES = [
  "societe",
  "agence",
  "utilisateur_societe",
  "utilisateur_client",
];

/** Référentiels de plateforme : RLS activée, mais jamais forcée (D4). */
const REFERENTIELS_PLATEFORME = ["devise", "parite"];

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

  it("le propriétaire ne lit aucune société sans contexte", async () => {
    // Le propriétaire du schéma des tests est superutilisateur, ce qui court-
    // circuite RLS quoi qu'il arrive : la preuve se fait donc sous le rôle
    // applicatif, seul représentatif de la connexion de service.
    const societes = await avecSociete(SOCIETE_A, (tx) =>
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
      taux_horaire_defaut: "7000",
      majoration_hors_ouverture_pct: "50",
      couleur_primaire: "#0b5cad",
      couleur_secondaire: "#f4a300",
      langue: "fr",
    };

    // Sous le contexte d'une AUTRE société, l'écriture est refusée.
    await expect(
      avecSociete(SOCIETE_B, (tx) =>
        tx.societe.create({ data: { id: nouvelle, ...champs } }),
      ),
    ).rejects.toThrow();

    // Sous son propre contexte — ce que fait le seed — elle passe.
    const creee = await avecSociete(nouvelle, (tx) =>
      tx.societe.create({ data: { id: nouvelle, ...champs } }),
    );
    expect(creee.id).toBe(nouvelle);

    await avecSociete(nouvelle, (tx) =>
      tx.societe.delete({ where: { id: nouvelle } }),
    );
  });
});
