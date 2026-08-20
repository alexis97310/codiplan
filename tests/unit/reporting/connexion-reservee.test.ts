import { describe, expect, it } from "vitest";

import { fichiersSource } from "../outils/fichiers-source";

/**
 * « Un test vérifie qu'aucun chemin hors `lib/reporting` n'utilise la connexion
 * `codiplan_reporting` » — critère d'acceptation de L0-06, garde-fou n°3 de D21.
 *
 * C'est le seul des trois garde-fous qui ne puisse pas être posé en base : la
 * base ne sait pas quel module de l'application ouvre la connexion. Il se
 * vérifie donc en lisant le dépôt.
 *
 * **Périmètre.** Les chemins APPLICATIFS. `lib/reporting/` en est le titulaire
 * légitime ; `tests/` doit pouvoir éprouver le rôle, sans quoi les scénarios
 * D21 ne pourraient rien prouver.
 */
const REPERTOIRES = ["app", "components", "lib", "prisma", "scripts"];

/** Le seul répertoire autorisé à nommer la connexion de consolidation. */
const TITULAIRE = "lib/reporting/";

/**
 * Marqueurs de l'OUVERTURE de la connexion. Le nom du rôle PostgreSQL lui-même
 * n'en fait pas partie : `lib/db/garde-role.ts` et `lib/db/client.ts` le citent
 * dans leurs commentaires pour expliquer les deux usages, et c'est exactement ce
 * qu'on veut d'eux. Ce qui est interdit, c'est d'ouvrir la connexion, pas de
 * savoir qu'elle existe.
 */
const MARQUEURS: readonly RegExp[] = [
  /REPORTING_DATABASE_URL/,
  /\bclientConsolidation\b/,
  /\bavecConsolidation\b/,
  /\bgarantirRoleConsolidation\b/,
  // L'import du module, et non sa simple mention : `lib/db/client.ts` renvoie
  // le lecteur vers lui en commentaire, ce qui est utile et non fautif.
  /from\s+["'][^"']*lib\/reporting\/connexion["']/,
];

describe("connexion de consolidation réservée à lib/reporting", () => {
  const fichiers = fichiersSource(REPERTOIRES);

  it("parcourt bien des fichiers — sinon le gardien serait vide", () => {
    expect(fichiers.length).toBeGreaterThan(10);
  });

  it("aucun fichier hors de lib/reporting ne nomme la connexion", () => {
    const fautifs = fichiers
      .filter((fichier) => !fichier.chemin.startsWith(TITULAIRE))
      .filter((fichier) =>
        MARQUEURS.some((marqueur) => marqueur.test(fichier.contenu)),
      )
      .map((fichier) => fichier.chemin);

    expect(
      fautifs,
      "la connexion de consolidation contourne le cloisonnement : elle ne " +
        "s'ouvre que depuis lib/reporting (D21)",
    ).toEqual([]);
  });

  it("lib/reporting, lui, la nomme bien — le gardien porte sur quelque chose", () => {
    const titulaires = fichiers.filter(
      (fichier) =>
        fichier.chemin.startsWith(TITULAIRE) &&
        MARQUEURS.some((marqueur) => marqueur.test(fichier.contenu)),
    );

    expect(titulaires.length).toBeGreaterThan(0);
  });

  it("la connexion applicative, elle, ne réutilise pas l'URL de consolidation", () => {
    const client = fichiers.find(
      (fichier) => fichier.chemin === "lib/db/client.ts",
    );

    expect(client).toBeDefined();
    expect(client?.contenu).not.toContain("REPORTING_DATABASE_URL");
  });
});
