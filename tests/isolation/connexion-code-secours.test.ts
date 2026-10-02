import { createOTP } from "@better-auth/utils/otp";
import { base32 } from "@better-auth/utils/base32";
import { afterAll, describe, expect, it } from "vitest";

import { creerAuth } from "@/lib/auth/config";
import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { confirmerEnrolement, preparerEnrolement } from "@/lib/auth/enrolement";
import { Role } from "@/lib/auth/roles";
import { obtenirSession } from "@/lib/auth/session";
import { avecContexteRls } from "@/lib/db/rls";
import { uuidv7 } from "@/lib/db/uuid";

import { clientApp, fermerClients } from "./setup/db";
import { SOCIETE_A } from "./setup/fixtures";

/**
 * LA SAISIE D'UN CODE DE SECOURS, CÔTÉ BIBLIOTHÈQUE (TR-34, 9CW-TP-S6).
 *
 * ## Ce que ce fichier éprouve, et ce qu'il ne refait pas
 *
 * `tests/isolation/plancher-second-facteur.test.ts` a déjà prouvé, le
 * 08/09/2026, que `auth.api.verifyBackupCode` ouvre une session (D64, « le
 * code de secours rendait 409 après avoir été validé ») — ce fichier ne
 * rejoue pas cette preuve, il éprouve ce qu'AUCUN scénario existant ne
 * regardait avant la route neuve `/api/session/code-secours` : l'USAGE
 * UNIQUE d'un code, le refus d'un code inventé, et l'exigence du cookie de
 * défi — les trois garde-fous que ce lot doit tenir.
 */

const MOT_DE_PASSE = "mot-de-passe-de-test-suffisamment-long";

const auth = creerAuth(clientApp());

afterAll(fermerClients);

type CompteEnrole = {
  email: string;
  codesSecours: readonly string[];
};

function cookiesDe(reponse: Response): string {
  return (reponse.headers.getSetCookie?.() ?? [])
    .map((entete) => entete.split(";")[0])
    .join("; ");
}

async function codeCourant(secret: string): Promise<string> {
  return createOTP(secret, { digits: 6, period: 30 }).totp();
}

/** Ouvre un compte et l'enrôle réellement — mêmes étapes que la vraie chaîne. */
async function compteEnrole(etiquette: string): Promise<CompteEnrole> {
  const email = `secours-${etiquette}-${uuidv7().slice(0, 8)}@iso.test`;
  const cree = await creerAuth(clientApp(), {
    societeId: SOCIETE_A,
    role: Role.admin_societe,
  }).api.signUpEmail({
    body: { email, password: MOT_DE_PASSE, name: `Secours ${etiquette}` },
  });
  await avecContexteRls(
    clientApp(),
    { societeId: SOCIETE_A, role: Role.admin_societe },
    (tx) =>
      tx.$executeRawUnsafe(
        `INSERT INTO "utilisateur_societe" ("id","utilisateur_id","societe_id","role")
           VALUES ($1::uuid, $2::uuid, $3::uuid, $4::"Role")`,
        uuidv7(),
        cree.user.id,
        SOCIETE_A,
        Role.admin_societe,
      ),
  );

  const entree = await dansUnEchangeAuth(() =>
    auth.api.signInEmail({
      body: { email, password: MOT_DE_PASSE },
      asResponse: true,
    }),
  );
  const entetes = new Headers({ cookie: cookiesDe(entree) });
  const session = await dansUnEchangeAuth(() => obtenirSession(entetes, auth));
  const preparation = await dansUnEchangeAuth(() =>
    preparerEnrolement(entetes, { motDePasse: MOT_DE_PASSE }, auth),
  );
  if (preparation.issue !== "prepare") {
    throw new Error("préparation d'enrôlement refusée");
  }
  const secret = new TextDecoder().decode(
    base32.decode(preparation.cleManuelle),
  );
  const code = await codeCourant(secret);
  const confirmation = await dansUnEchangeAuth(() =>
    confirmerEnrolement(
      entetes,
      session!.contexte.utilisateurId,
      session!.jetonSession,
      { code },
      auth,
      clientApp(),
    ),
  );
  if (confirmation.issue !== "enrole") {
    throw new Error(`enrôlement refusé : ${confirmation.issue}`);
  }

  return { email, codesSecours: preparation.codesSecours };
}

/** Ouvre un défi de second facteur et rend l'en-tête cookie correspondant. */
async function defi(email: string): Promise<Headers> {
  const reponse = await dansUnEchangeAuth(() =>
    auth.api.signInEmail({
      body: { email, password: MOT_DE_PASSE },
      asResponse: true,
    }),
  );
  const corps = (await reponse.clone().json()) as {
    twoFactorRedirect?: boolean;
  };
  // TÉMOIN : sans défi, tout ce qui suit mesurerait un compte non enrôlé.
  expect(corps.twoFactorRedirect).toBe(true);
  return new Headers({ cookie: cookiesDe(reponse) });
}

/** Présente un code de secours dans un échange — comme la route neuve le fait. */
async function presenter(
  entetes: Headers,
  code: string,
): Promise<{ status: number; corps: string }> {
  const reponse = await dansUnEchangeAuth(() =>
    auth.api.verifyBackupCode({
      body: { code },
      headers: entetes,
      asResponse: true,
    }),
  );
  return { status: reponse.status, corps: await reponse.clone().text() };
}

describe("verifyBackupCode — la saisie d'un code de secours (TR-34)", () => {
  it("un code de secours VALIDE ouvre une session", async () => {
    const compte = await compteEnrole("valide");
    const entetes = await defi(compte.email);

    const { status } = await presenter(entetes, compte.codesSecours[0] ?? "");
    expect(status).toBe(200);
  });

  it("USAGE UNIQUE — le MÊME code une seconde fois est refusé", async () => {
    const compte = await compteEnrole("unique");
    const code = compte.codesSecours[0] ?? "";

    const premiere = await presenter(await defi(compte.email), code);
    expect(premiere.status).toBe(200);

    // Un second défi, un second cookie — mais le MÊME code, déjà consommé.
    const seconde = await presenter(await defi(compte.email), code);
    expect(
      seconde.status,
      "un code de secours déjà utilisé a rouvert une session : il n'est plus " +
        "à usage unique, ce qui en ferait un mot de passe permanent.",
    ).not.toBe(200);
  });

  it("un code INVENTÉ est refusé", async () => {
    const compte = await compteEnrole("invente");
    const entetes = await defi(compte.email);

    const { status } = await presenter(entetes, "AAAAA-00000");
    expect(status).not.toBe(200);
  });

  it("SANS le cookie de défi, la présentation est refusée — jamais par le code", async () => {
    const compte = await compteEnrole("sansdefi");
    // Aucun défi ouvert : pas de mot de passe présenté, donc pas de cookie de
    // second facteur. Le code lui-même est pourtant valide.
    const { status, corps } = await presenter(
      new Headers(),
      compte.codesSecours[0] ?? "",
    );
    expect(status).toBe(401);
    expect(corps).toContain("INVALID_TWO_FACTOR_COOKIE");
  });
});
