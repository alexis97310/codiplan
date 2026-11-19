import { afterAll, describe, expect, it } from "vitest";

import { creerAuth } from "@/lib/auth/config";
import { estCheminFerme } from "@/lib/auth/inscription-fermee";
import { avecDesignationAuth } from "@/lib/auth/lecture-identite";
import { Role } from "@/lib/auth/roles";

import { clientApp, fermerClients } from "./setup/db";
import { SOCIETE_A } from "./setup/fixtures";

/**
 * L'INSCRIPTION FERMÉE PAR L'OPTION DE LA BIBLIOTHÈQUE, EN PLUS DU FILTRE DE
 * CHEMIN (décision d'Alexis du 10/11/2026).
 *
 * `lib/auth/inscription-fermee.ts` compare des CHAÎNES, par construction
 * sensible à la casse et à l'encodage : une variante du chemin que le filtre
 * ne reconnaît pas ne doit PAS, pour autant, ouvrir l'inscription. Ce fichier
 * éprouve la défense qui ne dépend pas de la forme du texte — `disableSignUp`,
 * lu par la bibliothèque À L'INTÉRIEUR de `signUpEmail`, sur l'instance de
 * PRODUCTION (`administration === undefined`).
 */
describe("inscription fermée par l'option de la bibliothèque (décision d'Alexis du 10/11/2026)", () => {
  const auth = creerAuth(clientApp());
  const authAdmin = creerAuth(clientApp(), {
    societeId: SOCIETE_A,
    role: Role.admin_societe,
  });

  afterAll(async () => {
    await fermerClients();
  });

  it("l'instance de PRODUCTION refuse signUpEmail, même appelée directement — pas seulement le filtre de chemin", async () => {
    await expect(
      auth.api.signUpEmail({
        body: {
          email: `9l26-prod-${Date.now()}@exemple.test`,
          password: "mot-de-passe-de-test-assez-long",
          name: "Ne doit jamais exister",
        },
      }),
    ).rejects.toThrow(/sign up is not enabled/i);
  });

  it("une instance ADMINISTRATIVE reste autorisée — l'amorçage (Q1/D65) et le chemin d'Équipe (D162) en dépendent", async () => {
    const adresse = `9l26-admin-${Date.now()}@exemple.test`;
    const cree = await authAdmin.api.signUpEmail({
      body: {
        email: adresse,
        password: "mot-de-passe-de-test-assez-long",
        name: "Ouvert administrativement",
      },
    });
    expect(cree).toBeTruthy();

    const relu = await avecDesignationAuth(clientApp()).utilisateur.findFirst({
      where: { email: adresse },
    });
    expect(relu?.email).toBe(adresse);
  });

  it("une variante de CASSE du chemin, que le filtre ne reconnaît PAS, n'ouvre pas l'inscription pour autant", async () => {
    const varianteCasse = "/api/auth/SIGN-UP/email";
    // TÉMOIN : le filtre, par construction sensible à la casse, laisse
    // passer cette forme — sans l'option de la bibliothèque, rien d'autre ne
    // la retiendrait.
    expect(estCheminFerme(varianteCasse)).toBe(false);

    const adresse = `9l26-casse-${Date.now()}@exemple.test`;
    const reponse = await auth.handler(
      new Request(`http://localhost${varianteCasse}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: adresse,
          password: "mot-de-passe-de-test-assez-long",
          name: "Ne doit jamais exister",
        }),
      }),
    );
    expect(reponse.status).not.toBe(200);

    const relu = await avecDesignationAuth(clientApp()).utilisateur.findFirst({
      where: { email: adresse },
    });
    expect(relu).toBeNull();
  });

  it("une variante d'ENCODAGE du chemin n'ouvre pas l'inscription non plus", async () => {
    const adresse = `9l26-encodage-${Date.now()}@exemple.test`;
    const reponse = await auth.handler(
      new Request("http://localhost/api/auth/sign%2Dup/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: adresse,
          password: "mot-de-passe-de-test-assez-long",
          name: "Ne doit jamais exister",
        }),
      }),
    );
    expect(reponse.status).not.toBe(200);

    const relu = await avecDesignationAuth(clientApp()).utilisateur.findFirst({
      where: { email: adresse },
    });
    expect(relu).toBeNull();
  });
});
