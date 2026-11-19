import { createOTP } from "@better-auth/utils/otp";
import { base32 } from "@better-auth/utils/base32";
import { afterAll, describe, expect, it } from "vitest";

import { creerAuth } from "@/lib/auth/config";
import { confirmerEnrolement, preparerEnrolement } from "@/lib/auth/enrolement";
import { Role } from "@/lib/auth/roles";
import { obtenirSession } from "@/lib/auth/session";
import { avecContexteRls } from "@/lib/db/rls";
import { uuidv7 } from "@/lib/db/uuid";

import { clientApp, fermerClients } from "./setup/db";
import { SOCIETE_A } from "./setup/fixtures";

/**
 * `second_facteur_valide` NE PEUT PAS ÊTRE VRAI SANS VÉRIFICATION EFFECTIVE
 * (décision d'Alexis du 10/11/2026) — mesuré sur la connexion d'un compte qui
 * porte un second facteur.
 *
 * `lib/auth/config.ts` le déduit de `mfa_actif` À LA CRÉATION DE SESSION. Une
 * première session, portant déjà ce drapeau à `true` puisque `mfa_actif`
 * l'est, existe un instant pendant que Better Auth vérifie les
 * identifiants — AVANT que le second facteur n'ait été présenté. Ce fichier
 * mesure qu'elle ne survit jamais jusqu'à la réponse rendue à l'appelant :
 * la bibliothèque la supprime dans la même requête (`plugins/two-factor`),
 * et aucun cookie qui en proviendrait ne rend de session active.
 *
 * Voir aussi `tests/unit/auth/second-facteur-sans-trust-device.test.ts` : le
 * seul AUTRE mécanisme de la bibliothèque qui rendrait ce drapeau vrai sans
 * vérification à la connexion courante (l'appareil de confiance) reste
 * inerte, faute d'être jamais sollicité par ce dépôt.
 */

const MOT_DE_PASSE = "mot-de-passe-de-test-suffisamment-long";

const auth = creerAuth(clientApp());
const authAdmin = creerAuth(clientApp(), {
  societeId: SOCIETE_A,
  role: Role.admin_societe,
});

afterAll(fermerClients);

async function compteHabilite(etiquette: string): Promise<string> {
  const email = `9l26-${etiquette}-${uuidv7().slice(0, 8)}@iso.test`;
  const cree = await authAdmin.api.signUpEmail({
    body: { email, password: MOT_DE_PASSE, name: `9L26 ${etiquette}` },
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

async function connecter(email: string): Promise<Headers> {
  const reponse = await auth.api.signInEmail({
    body: { email, password: MOT_DE_PASSE },
    asResponse: true,
  });
  const cookie = (reponse.headers.getSetCookie?.() ?? [])
    .map((entete) => entete.split(";")[0])
    .join("; ");
  expect(cookie).not.toBe("");
  return new Headers({ cookie });
}

async function codeCourant(cleManuelle: string): Promise<string> {
  const secret = new TextDecoder().decode(base32.decode(cleManuelle));
  return createOTP(secret, { digits: 6, period: 30 }).totp();
}

/** Enrôle réellement un compte au second facteur, par le chemin à nous. */
async function enroler(email: string): Promise<void> {
  const entetes = await connecter(email);
  const session = await obtenirSession(entetes, auth);
  if (session === null) {
    throw new Error("connexion refusée avant même l'enrôlement");
  }
  const preparation = await preparerEnrolement(
    entetes,
    { motDePasse: MOT_DE_PASSE },
    auth,
  );
  if (preparation.issue !== "prepare") {
    throw new Error("préparation de l'enrôlement refusée");
  }
  const confirmation = await confirmerEnrolement(
    entetes,
    session.contexte.utilisateurId,
    session.jetonSession,
    { code: await codeCourant(preparation.cleManuelle) },
    auth,
    clientApp(),
  );
  if (confirmation.issue !== "enrole") {
    throw new Error("confirmation de l'enrôlement refusée");
  }
}

describe("la connexion d'un compte à second facteur ne rend jamais de session utilisable avant la vérification", () => {
  it("la réponse annonce `twoFactorRedirect`, et le cookie qu'elle porte (s'il en porte un) ne rend AUCUNE session active", async () => {
    const email = await compteHabilite("session-pre-verif");
    await enroler(email);

    const reponse = await auth.api.signInEmail({
      body: { email, password: MOT_DE_PASSE },
      asResponse: true,
    });
    const corps = (await reponse.json()) as { twoFactorRedirect?: boolean };
    expect(corps.twoFactorRedirect).toBe(true);

    // LA PREUVE QUI COMPTE : même le cookie que CETTE réponse-là a pu poser
    // (le greffon « appareil de confiance » en poserait un INOFFENSIF,
    // distinct de celui d'une session — mesuré ci-dessous) ne rend aucune
    // session active. Si une session fuitait ici, elle porterait
    // `second_facteur_valide: true` sans qu'aucun facteur n'ait été présenté
    // à CETTE connexion.
    const cookie = (reponse.headers.getSetCookie?.() ?? [])
      .map((entete) => entete.split(";")[0])
      .join("; ");
    const entetes = new Headers({ cookie });
    expect(await obtenirSession(entetes, auth)).toBeNull();
  });
});
