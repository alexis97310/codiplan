import { afterAll, describe, expect, it } from "vitest";

import {
  FONCTIONS_IDENTITE,
  ROW_SECURITY_ATTENDU,
  SEARCH_PATH_ATTENDU,
  SQL_FONCTIONS_IDENTITE,
  etatsFonctionsIdentite,
  exemptionFonctionsIdentiteOk,
  type LigneFonctionIdentite,
} from "../../lib/db/exemption-fonctions-identite";
import { ecartsExemptionFonctionsIdentite } from "../../scripts/lib/exemption-fonctions-identite";
import { clientApp, fermerClients } from "./setup/db";

/**
 * Exemption des deux fonctions SECURITY DEFINER d'identité (D226, D233) —
 * décision d'Alexis du 10/11/2026.
 *
 * ## Ce que cette base de test prouve, et ce qu'elle ne prouve pas
 *
 * La base locale de test est la base JETABLE de `TEST_DATABASE_URL`, dont le
 * propriétaire (`postgres`) est SUPERUTILISATEUR — jamais le cas sur la base
 * hébergée, où le propriétaire n'est que `BYPASSRLS` (mesuré par la passation
 * de 9I8D2). `etat.exempte` doit donc être VRAI ici, par la branche
 * `rolsuper`, alors qu'en production c'est la branche `rolbypassrls` qui
 * répond. Les deux sont des exemptions légitimes (voir
 * `lib/db/exemption-fonctions-identite.ts`) ; ce scénario mesure CETTE base,
 * et dit pourquoi elle diffère, plutôt que de prétendre reproduire la
 * production.
 */
describe("exemption des fonctions d'identité — mesurée sous le rôle applicatif", () => {
  afterAll(fermerClients);

  it("lecture SANS privilège particulier : codiplan_app voit les deux fonctions", async () => {
    const lignes = await clientApp().$queryRawUnsafe<LigneFonctionIdentite[]>(
      SQL_FONCTIONS_IDENTITE,
    );
    expect(lignes.map((l) => l.fonction).sort()).toEqual(
      [...FONCTIONS_IDENTITE].sort(),
    );
  });

  it("sur CETTE base, le propriétaire est exempté par SUPERUTILISATEUR, pas BYPASSRLS", async () => {
    const lignes = await clientApp().$queryRawUnsafe<LigneFonctionIdentite[]>(
      SQL_FONCTIONS_IDENTITE,
    );
    for (const ligne of lignes) {
      expect(ligne.proprietaire_superutilisateur, ligne.fonction).toBe(true);
    }
    const etats = etatsFonctionsIdentite(lignes);
    expect(exemptionFonctionsIdentiteOk(etats)).toBe(true);
    expect(ecartsExemptionFonctionsIdentite(etats)).toEqual([]);
  });

  it("les réglages posés par les deux migrations sont ceux attendus", async () => {
    const lignes = await clientApp().$queryRawUnsafe<LigneFonctionIdentite[]>(
      SQL_FONCTIONS_IDENTITE,
    );
    for (const ligne of lignes) {
      expect(ligne.securite_definer, ligne.fonction).toBe(true);
      expect(ligne.reglages, ligne.fonction).toContain(
        `search_path=${SEARCH_PATH_ATTENDU}`,
      );
      expect(ligne.reglages, ligne.fonction).toContain(
        `row_security=${ROW_SECURITY_ATTENDU}`,
      );
    }
  });

  it("ÉPREUVE : un propriétaire non exempté, injecté dans la lecture réelle, est vu", async () => {
    // Les LIGNES viennent de la vraie base ; seule la propriété « exemptée »
    // est falsifiée ici — sans toucher à un rôle réel ni à une migration —
    // pour prouver que le JUGEMENT, lui, refuse bien ce cas.
    const lignes = await clientApp().$queryRawUnsafe<LigneFonctionIdentite[]>(
      SQL_FONCTIONS_IDENTITE,
    );
    const [premiere, ...reste] = lignes;
    if (premiere === undefined) {
      throw new Error(
        "Aucune fonction d'identité lue : la migration a-t-elle été jouée ?",
      );
    }
    const falsifiees = [
      {
        ...premiere,
        proprietaire_contourne_rls: false,
        proprietaire_superutilisateur: false,
      },
      ...reste,
    ];
    const ecarts = ecartsExemptionFonctionsIdentite(
      etatsFonctionsIdentite(falsifiees),
    );
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain(premiere.fonction);
  });
});

/**
 * REMARQUE D'ALEXIS (non bloquante) : le rôle applicatif ne doit pas pouvoir
 * créer d'objet dans le schéma `public`, où vivent les deux fonctions
 * d'identité et toutes les tables cloisonnées — `search_path` les y expose.
 *
 * Mesuré avant d'écrire ce test (`has_schema_privilege('codiplan_app',
 * 'public', 'CREATE')` rend `f`, et un `CREATE TABLE` est refusé) : PostgreSQL
 * 15+ retire par défaut le droit `CREATE` sur `public` à `PUBLIC`, et aucune
 * migration ne le lui redonne (recherche sur les fichiers `migration.sql` du
 * dépôt : aucun `GRANT CREATE ON SCHEMA public`). Ce test fige la mesure :
 * le jour où il rougit, c'est le point d'arrêt que le ticket demandait, pas
 * un simple ajustement.
 */
describe("remarque d'Alexis : codiplan_app ne peut pas créer dans public", () => {
  afterAll(fermerClients);

  it("CREATE TABLE est refusé", async () => {
    await expect(
      clientApp().$executeRawUnsafe(
        'CREATE TABLE "public"."essai_9l05_create_refuse" (id int)',
      ),
    ).rejects.toThrow(/permission denied for schema/i);
  });

  it("CREATE FUNCTION est refusé", async () => {
    await expect(
      clientApp().$executeRawUnsafe(
        `CREATE FUNCTION "public"."essai_9l05_fonction_refusee"() RETURNS void
           LANGUAGE plpgsql AS $$ BEGIN END $$`,
      ),
    ).rejects.toThrow(/permission denied for schema/i);
  });
});
