import { describe, expect, it } from "vitest";

import { decrireConnexion } from "../../../scripts/lib/decrire-connexion";

/**
 * decrireConnexion NE RECOPIE JAMAIS LE SECRET (9CR-CI-CLOISONNEMENT-CONNEXION).
 *
 * L'URL fabriquée ci-dessous porte un utilisateur, un mot de passe et une
 * valeur de paramètre fictifs : aucun des trois ne doit jamais ressortir de la
 * description, quel que soit le champ interrogé.
 */
const URL_FABRIQUEE =
  "postgresql://utilisateur-fictif:secret-fictif@ep-exemple-pooler.ap-southeast-2.aws.neon.tech:5432/base?sslmode=require&connect_timeout=9";

describe("decrireConnexion", () => {
  it("rend hôte, port, mutualisation, région, base et NOMS de paramètres", () => {
    expect(decrireConnexion(URL_FABRIQUEE)).toEqual({
      lisible: true,
      hote: "ep-exemple-pooler.ap-southeast-2.aws.neon.tech",
      port: "5432",
      mutualise: true,
      region: "ap-southeast-2",
      base: "base",
      parametres: ["sslmode", "connect_timeout"],
    });
  });

  it("ne recopie ni l'utilisateur, ni le mot de passe, ni la valeur d'un paramètre", () => {
    const serialisee = JSON.stringify(decrireConnexion(URL_FABRIQUEE));
    expect(serialisee).not.toContain("utilisateur-fictif");
    expect(serialisee).not.toContain("secret-fictif");
    // La VALEUR du paramètre connect_timeout — « 9 » — ne doit apparaître
    // nulle part en dehors du port, qui porte lui-même la chaîne « 5432 ».
    expect(serialisee.replaceAll("5432", "")).not.toMatch(/\b9\b/);
  });

  it("un hôte DIRECT, sans point de mutualisation", () => {
    expect(
      decrireConnexion("postgresql://u:p@db.exemple.tech:5432/base"),
    ).toMatchObject({ lisible: true, mutualise: false });
  });

  it("un hôte sans second segment : région nulle", () => {
    expect(
      decrireConnexion("postgresql://u:p@localhost:5432/base"),
    ).toMatchObject({ lisible: true, region: null });
  });

  it("aucun paramètre de requête : liste vide, pas une absence", () => {
    expect(decrireConnexion("postgresql://u:p@h:5432/base")).toMatchObject({
      lisible: true,
      parametres: [],
    });
  });

  it("URL vide, absente ou illisible : { lisible: false }, jamais recopiée", () => {
    expect(decrireConnexion("")).toEqual({ lisible: false });
    expect(decrireConnexion(undefined)).toEqual({ lisible: false });
    expect(decrireConnexion("   ")).toEqual({ lisible: false });
    expect(decrireConnexion("pas une url")).toEqual({ lisible: false });
  });
});
