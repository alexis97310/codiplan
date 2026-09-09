import { describe, expect, it } from "vitest";

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
      expect(etat.societes).toBeNull();
      expect(etat.comptes).toBeNull();
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
