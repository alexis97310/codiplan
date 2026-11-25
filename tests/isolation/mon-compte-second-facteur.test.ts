import { createOTP } from "@better-auth/utils/otp";
import { base32 } from "@better-auth/utils/base32";
import { afterAll, describe, expect, it } from "vitest";

import { creerAuth } from "@/lib/auth/config";
import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { confirmerEnrolement, preparerEnrolement } from "@/lib/auth/enrolement";
import { changerSonMotDePasse } from "@/lib/auth/mon-compte";
import { Role } from "@/lib/auth/roles";
import { obtenirSession } from "@/lib/auth/session";
import { avecContexteRls } from "@/lib/db/rls";
import { uuidv7 } from "@/lib/db/uuid";

import { clientApp, fermerClients } from "./setup/db";
import { SOCIETE_A } from "./setup/fixtures";

/**
 * SECOND FACTEUR DE LA SESSION NEUVE APRÈS UN CHANGEMENT DE MOT DE PASSE
 * (9L43-SECURITE-CHANGEMENT-MOT-DE-PASSE, réserve de revue).
 *
 * `lib/auth/mon-compte.ts` ne reporte RIEN explicitement pour
 * `second_facteur_valide` : la session neuve le reçoit par la MÊME déduction
 * que la session d'avant à SA création —
 * `databaseHooks.session.create.before` (`lib/auth/config.ts`) le pose
 * depuis `utilisateur.mfa_actif`, qu'un changement de mot de passe ne touche
 * pas. Ce fichier mesure le résultat bout en bout plutôt que de le supposer :
 * un compte dont le rôle EXIGE un second facteur (`admin_societe`, D-xxx)
 * garde, après le changement, une session dont le second facteur reste
 * validé — jamais renvoyée à un nouveau défi.
 */

const MOT_DE_PASSE = "mot-de-passe-de-test-suffisamment-long";
const auth = creerAuth(clientApp());
const authAdmin = creerAuth(clientApp(), {
  societeId: SOCIETE_A,
  role: Role.admin_societe,
});

afterAll(fermerClients);

function cookiesDe(reponse: Response): string {
  return (reponse.headers.getSetCookie?.() ?? [])
    .map((entete) => entete.split(";")[0])
    .join("; ");
}

async function codeCourant(cleManuelle: string): Promise<string> {
  const secret = new TextDecoder().decode(base32.decode(cleManuelle));
  return createOTP(secret, { digits: 6, period: 30 }).totp();
}

/** Ouvre un compte habilité `admin_societe` — un rôle qui EXIGE un second facteur. */
async function compteHabiliteAdminSociete(): Promise<string> {
  const email = `9l43-sf-${uuidv7()}@iso.test`;
  const cree = await authAdmin.api.signUpEmail({
    body: { email, password: MOT_DE_PASSE, name: "9L43 admin société" },
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
  return email;
}

/**
 * Enrôle réellement le second facteur, par le chemin applicatif, et rend le
 * secret EN CLAIR (décodé de `cleManuelle`) — c'est la SEULE forme que ce
 * fichier connaît : `second_facteur.secret` est chiffré en base par le
 * greffon, jamais relisible tel quel (même mesure que
 * `tests/isolation/plancher-second-facteur.test.ts`).
 */
async function enroler(email: string): Promise<string> {
  const entree = await dansUnEchangeAuth(() =>
    auth.api.signInEmail({
      body: { email, password: MOT_DE_PASSE },
      asResponse: true,
    }),
  );
  const entetes = new Headers({ cookie: cookiesDe(entree) });
  const session = await dansUnEchangeAuth(() => obtenirSession(entetes, auth));
  if (session === null) {
    throw new Error("connexion refusée avant même l'enrôlement");
  }
  const preparation = await dansUnEchangeAuth(() =>
    preparerEnrolement(entetes, { motDePasse: MOT_DE_PASSE }, auth),
  );
  if (preparation.issue !== "prepare") {
    throw new Error("préparation de l'enrôlement refusée");
  }
  const secret = new TextDecoder().decode(
    base32.decode(preparation.cleManuelle),
  );
  const code = await codeCourant(preparation.cleManuelle);
  const confirmation = await dansUnEchangeAuth(() =>
    confirmerEnrolement(
      entetes,
      session.contexte.utilisateurId,
      session.jetonSession,
      { code },
      auth,
      clientApp(),
    ),
  );
  if (confirmation.issue !== "enrole") {
    throw new Error(`enrôlement refusé : ${confirmation.issue}`);
  }
  return secret;
}

/**
 * Connecte, présente le second facteur, et rend les en-têtes d'une session
 * dont `second_facteur_valide` est VRAI — le point de départ de ce fichier.
 */
async function connecterAvecSecondFacteur(
  email: string,
  secret: string,
): Promise<Headers> {
  const defi = await dansUnEchangeAuth(() =>
    auth.api.signInEmail({
      body: { email, password: MOT_DE_PASSE },
      asResponse: true,
    }),
  );
  const corpsDefi = (await defi.clone().json()) as {
    twoFactorRedirect?: boolean;
  };
  expect(corpsDefi.twoFactorRedirect).toBe(true);
  const entetesDefi = new Headers({ cookie: cookiesDe(defi) });

  const code = await createOTP(secret, { digits: 6, period: 30 }).totp();
  const verification = await dansUnEchangeAuth(() =>
    auth.api.verifyTOTP({
      body: { code },
      headers: entetesDefi,
      asResponse: true,
    }),
  );
  expect(verification.status).toBe(200);
  const entetesConnecte = new Headers({ cookie: cookiesDe(verification) });
  const session = await obtenirSession(entetesConnecte, auth);
  expect(session?.contexte.secondFacteurValide).toBe(true);
  return entetesConnecte;
}

describe("second facteur de la session neuve après un changement de mot de passe (9L43)", () => {
  it(
    "un second facteur validé AVANT le changement reste validé APRÈS, sans " +
      "nouveau défi",
    async () => {
      const email = await compteHabiliteAdminSociete();
      const secret = await enroler(email);
      const entetes = await connecterAvecSecondFacteur(email, secret);
      const nouveau = "NouveauMotDePasseAvecSecondFacteur1";

      const issue = await changerSonMotDePasse(
        {
          motDePasseActuel: MOT_DE_PASSE,
          motDePasse: nouveau,
          confirmation: nouveau,
        },
        entetes,
        auth,
        clientApp(),
      );
      expect(issue.issue).toBe("abouti");
      if (issue.issue !== "abouti") {
        throw new Error("inatteignable, l'assertion précédente l'a vérifié");
      }

      const cookie = issue.cookies
        .map((entete) => entete.split(";")[0])
        .join("; ");
      const entetesApres = new Headers({ cookie });
      const sessionApres = await obtenirSession(entetesApres, auth);

      expect(sessionApres).not.toBeNull();
      expect(sessionApres?.contexte.secondFacteurValide).toBe(true);
    },
  );
});
