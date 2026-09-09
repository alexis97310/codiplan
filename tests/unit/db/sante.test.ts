import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { TABLES_CLOISONNEES } from "@/scripts/lib/inventaire";

import { RACINE } from "../outils/fichiers-source";

import { lireSante } from "@/lib/db/sante";

/**
 * LE JUMEAU DE LA PAGE DE SANTÉ — *avec une base injoignable, elle s'affiche
 * quand même et dit « non ». Elle ne rend pas une 500.*
 *
 * ## Pourquoi ce contrat est le seul qui compte ici
 *
 * **Une sonde qui tombe en même temps que ce qu'elle surveille ne surveille
 * rien.** Une page de santé qui rend 500 quand la base est absente ne dit rien
 * de plus que le 500 qu'on cherchait précisément à diagnostiquer — et elle le
 * dit en ayant l'air d'un bogue de l'application plutôt que d'une base
 * injoignable, ce qui envoie chercher au mauvais endroit.
 *
 * ## Ce que ce fichier mesure, et comment
 *
 * Il pointe `DATABASE_URL` sur un port où **rien n'écoute**, ce qui est la
 * forme réelle du défaut : une base éteinte, un pare-feu, un mandataire qui ne
 * relaie pas. Puis il vérifie que `lireSante` **rend un objet** au lieu de
 * lever, et que cet objet dit « non ».
 *
 * Et il vérifie la seconde moitié, celle qu'on oublie : **le motif ne porte
 * aucun secret**. Le message brut d'un pilote PostgreSQL nomme l'hôte, le port
 * et souvent l'hébergeur ; sur une page SANS COMPTE, c'est une carte du système
 * offerte au premier venu (D50).
 */
describe("la page de santé ne tombe pas avec ce qu'elle surveille", () => {
  it("base INJOIGNABLE : elle répond, et elle dit « non »", async () => {
    const avant = process.env.DATABASE_URL;
    // Un port du domaine réservé, où rien n'écoute jamais. La connexion est
    // refusée immédiatement plutôt qu'après un délai d'attente.
    process.env.DATABASE_URL = "postgresql://personne@127.0.0.1:1/nulle_part";
    try {
      const etat = await lireSante();

      expect(etat.baseJointe.ok).toBe(false);
      expect(etat.roleApplicatif.ok).toBe(false);
      expect(etat.migrations.ok).toBe(false);
      // Les décomptes ne disent JAMAIS zéro : ni ici, où la base ne répond
      // pas, ni sur une base saine, où les politiques les refusent à une
      // connexion sans société active. *Un zéro se lit « installation vide »*,
      // ce qui serait la conclusion opposée à la vraie (§9, 06/09).
      expect(etat.societes.lisible).toBe(false);
      expect(etat.comptes.lisible).toBe(false);
    } finally {
      process.env.DATABASE_URL = avant;
    }
  }, 30000);

  it("et le motif ne porte NI hôte, NI port, NI nom de base", async () => {
    const avant = process.env.DATABASE_URL;
    process.env.DATABASE_URL =
      "postgresql://identifiant:motdepasse@hote-secret.example:1/base_secrete";
    try {
      const etat = await lireSante();
      const texte = JSON.stringify(etat);
      // Et le motif du décompte n'en porte pas davantage : il est rendu au
      // lecteur exactement comme le reste de la page.

      // Les quatre choses qu'un message brut de pilote aurait emportées.
      expect(texte).not.toContain("hote-secret");
      expect(texte).not.toContain("base_secrete");
      expect(texte).not.toContain("motdepasse");
      expect(texte).not.toContain("identifiant");
      // TÉMOIN : le motif existe bel et bien. Sans lui, une chaîne vide
      // passerait les quatre assertions ci-dessus sans rien prouver — c'est la
      // vacuité du §9 (30/08), et elle a exactement la forme d'un succès.
      expect(etat.baseJointe.detail).not.toBeNull();
      expect((etat.baseJointe.detail ?? "").length).toBeGreaterThan(10);
    } finally {
      process.env.DATABASE_URL = avant;
    }
  }, 30000);
});

/**
 * L'INVARIANT DU SECOND DÉFAUT DES CAPTURES, FORMULÉ PLUTÔT QUE RÉPARÉ.
 *
 * La page affichait « Sociétés : 0 » sur une base qui en portait deux. Le
 * chiffre était juste au sens de la requête et faux au sens où on le lisait —
 * *un zéro se lit « installation vide »*. La réparation dit « non lisible
 * d'ici » ; **ce qui manquait est la règle qui empêche d'y revenir**, car la
 * correction bien intentionnée s'écrit toute seule : « il suffirait de compter
 * les sociétés ».
 *
 * La règle : **la sonde ne compte AUCUNE table cloisonnée.** Elle est sans
 * compte, elle lit sous le rôle applicatif sans société active, et toute table
 * cloisonnée lui rend zéro — ou lui rendrait tout, si l'on « réparait » en
 * déposant une connexion privilégiée sur une page publique.
 *
 * La population vient de `scripts/lib/inventaire.ts`, **une source que ce
 * gardien ne contrôle pas** (§9, 01/09) : une table cloisonnée créée demain
 * entre d'elle-même dans le périmètre.
 */
describe("la sonde ne publie aucun décompte d'une table cloisonnée", () => {
  const source = readFileSync(join(RACINE, "lib", "db", "sante.ts"), "utf8");

  it("lit réellement le module — le témoin de non-vacuité", () => {
    expect(source.length).toBeGreaterThan(500);
    expect(TABLES_CLOISONNEES.length).toBeGreaterThan(10);
  });

  it("aucune table cloisonnée n'est interrogée", () => {
    const citees = TABLES_CLOISONNEES.filter((table) =>
      new RegExp(`\\b(?:from|join)\\s+"?${table}"?\\b`, "i").test(source),
    );
    expect(
      citees,
      "un décompte lu sans société active rend zéro, et « Sociétés : 0 » se " +
        "lit « installation vide » — la conclusion opposée à la vraie",
    ).toEqual([]);
  });

  it("mais `_prisma_migrations`, elle, EST interrogée — le vert doit être mérité", () => {
    // Le cas qui doit rester vert pour sa propre raison (§9, 11/09) : la sonde
    // DOIT lire quelque chose, et cette table n'est pas cloisonnée. Un gardien
    // qui interdirait toute lecture serait vert aussi, et décrirait une sonde
    // qui ne sonde rien.
    expect(/from\s+_prisma_migrations/i.test(source)).toBe(true);
  });

  it("et la sonde ne fait AUCUN décompte, d'aucune table", () => {
    // `lisible: true` existe dans le TYPE — c'est la branche qu'une future
    // page authentifiée remplira. Ce qui est interdit ici est de la
    // CONSTRUIRE : la sonde ne compte rien, donc elle n'appelle aucun `count`.
    expect(source).toContain("decompteNonLisible()");
    expect(source).not.toMatch(/\.count\s*\(|count\s*\(\s*\*\s*\)/i);
  });
});
