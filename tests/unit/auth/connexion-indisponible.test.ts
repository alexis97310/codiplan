import { type PrismaClient } from "@prisma/client";
import { APIError } from "better-auth/api";
import { describe, expect, it } from "vitest";

import { type Auth } from "@/lib/auth/config";
import { tenterConnexion } from "@/lib/auth/connexion";

/**
 * TR-31 (9BP-TP-A4a-MESSAGES) — LA BASE INJOIGNABLE N'EST PAS UN REFUS.
 *
 * Avant ce ticket, `lib/auth/connexion.ts` attrapait indistinctement toute
 * exception de `instance.api.signInEmail` et rendait le refus uniforme de
 * D35. C'est juste pour un compte inexistant ou un mot de passe faux — Better
 * Auth lève une `APIError` dans les deux cas, et il n'y a rien à distinguer
 * (D35 l'exige même). C'est FAUX pour une base injoignable : ce n'est ni un
 * identifiant à vérifier, ni un compte à contacter chez l'administrateur.
 *
 * Ce fichier n'ouvre AUCUNE session, AUCUNE base : `instance` est une
 * fabrication qui n'implémente que ce que `tenterConnexion` appelle
 * réellement, `api.signInEmail`.
 *
 * Depuis D258, `tenterConnexion` consulte le limiteur de tentatives AVANT
 * tout appel à `instance` — `client` doit donc être fabriqué aussi, avec le
 * seul accès que le limiteur fait dans ces trois scénarios : un décompte, qui
 * rend toujours zéro, puisque ce fichier n'éprouve ni le verrouillage ni la
 * persistance des échecs (ce domaine vit dans
 * `tests/isolation/limiteur-connexion.test.ts`).
 */

function instanceFactice(
  signInEmail: (args: unknown) => Promise<unknown>,
): Auth {
  return { api: { signInEmail } } as unknown as Auth;
}

function clientFactice(): PrismaClient {
  return {
    $extends: () => ({
      tentativeConnexion: {
        count: async () => 0,
        create: async () => ({}),
      },
    }),
  } as unknown as PrismaClient;
}

const ENTREE = {
  email: "epreuve@codima.test",
  motDePasse: "un-mot-de-passe-suffisamment-long",
};

describe("TR-31 — tenterConnexion distingue le refus de la panne", () => {
  it("`signInEmail` lève une APIError (identifiants) → refus, comme avant", async () => {
    const instance = instanceFactice(() => {
      throw new APIError("UNAUTHORIZED", {
        message: "Invalid email or password",
      });
    });

    const resultat = await tenterConnexion(ENTREE, instance, clientFactice());

    expect(resultat.issue).toBe("refus");
  });

  it("`signInEmail` lève une erreur qui n'est PAS une APIError (base injoignable) → indisponible", async () => {
    const instance = instanceFactice(() => {
      throw new Error("connect ECONNREFUSED 127.0.0.1:5432");
    });

    const resultat = await tenterConnexion(ENTREE, instance, clientFactice());

    expect(resultat.issue).toBe("indisponible");
  });

  it("`signInEmail` répond hors 200 sans lever → refus, comme avant (inchangé)", async () => {
    const instance = instanceFactice(
      async () => new Response(null, { status: 401 }),
    );

    const resultat = await tenterConnexion(ENTREE, instance, clientFactice());

    expect(resultat.issue).toBe("refus");
  });
});
