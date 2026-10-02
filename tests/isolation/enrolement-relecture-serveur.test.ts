import { createOTP } from "@better-auth/utils/otp";
import { base32 } from "@better-auth/utils/base32";
import { afterAll, describe, expect, it } from "vitest";

import { creerAuth } from "@/lib/auth/config";
import { dansUnEchangeAuth } from "@/lib/auth/echange";
import {
  confirmerEnrolement,
  preparationEnAttente,
  preparerEnrolement,
  type ConfirmationEnrolement,
  type PreparationEnrolement,
} from "@/lib/auth/enrolement";
import { avecDesignationAuth } from "@/lib/auth/lecture-identite";
import { Role } from "@/lib/auth/roles";
import { obtenirSession } from "@/lib/auth/session";
import { avecContexteRls } from "@/lib/db/rls";
import { uuidv7 } from "@/lib/db/uuid";

import { clientApp, fermerClients } from "./setup/db";
import { SOCIETE_A } from "./setup/fixtures";

/**
 * LA RELECTURE SERVEUR DE LA PRÉPARATION (TR-36, 9CW-TP-S6).
 *
 * ## Ce que ce fichier éprouve
 *
 * `preparationEnAttente` est ce qui remplace le transit des secrets par l'URL :
 * la page relit, côté serveur, la ligne non confirmée de `second_facteur`.
 * Trois choses à prouver, qu'aucun test existant ne regardait — ni
 * `enrolement-second-facteur.test.ts` (qui n'appelle que `preparerEnrolement`/
 * `confirmerEnrolement`, jamais leur RELECTURE), ni aucun autre :
 *
 *   1. la clé déchiffrée ici est la MÊME que celle que `preparerEnrolement`
 *      avait rendue — pas une clé qui ressemble, LA MÊME, au point qu'un code
 *      calculé dessus soit accepté par la confirmation ;
 *   2. une SECONDE préparation, sans confirmer la première, ne laisse PAS deux
 *      lignes en base — mesuré plutôt que supposé (consigne du lot) ;
 *   3. un code refusé à la confirmation (TR-39) laisse la préparation
 *      RELISIBLE — c'est ce qui permet à la page de ne pas retomber sur
 *      l'étape du mot de passe.
 */

const MOT_DE_PASSE = "mot-de-passe-de-test-suffisamment-long";

const auth = creerAuth(clientApp());
const authAdmin = creerAuth(clientApp(), {
  societeId: SOCIETE_A,
  role: Role.admin_societe,
});

afterAll(fermerClients);

async function compteHabilite(etiquette: string): Promise<string> {
  const email = `relecture-${etiquette}-${uuidv7().slice(0, 8)}@iso.test`;
  const cree = await authAdmin.api.signUpEmail({
    body: {
      email,
      password: MOT_DE_PASSE,
      name: `Relecture ${etiquette}`,
    },
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

/**
 * Prépare, dans UN échange — comme `app/api/session/enrolement/route.ts` le
 * fait réellement (`obtenirSession` puis `preparerEnrolement`, sous le MÊME
 * `dansUnEchangeAuth`).
 *
 * **Indispensable à partir d'une SECONDE préparation.** La bibliothèque
 * réutilise la ligne existante (`existingTwoFactor`) et la réécrit par son
 * `id` — qui n'est pas une clé de désignation de `second_facteur` (D64) :
 * cette écriture n'a de chance que si l'échange a déjà retenu `utilisateur_id`
 * via la lecture de session qui précède, exactement comme sur une vraie
 * requête HTTP. Sans cet échange, l'écriture est refusée EN SILENCE — zéro
 * ligne, aucune erreur — et la relecture verrait encore l'ancienne clé.
 */
function preparer(entetes: Headers): Promise<PreparationEnrolement> {
  return dansUnEchangeAuth(async () => {
    await obtenirSession(entetes, auth);
    return preparerEnrolement(entetes, { motDePasse: MOT_DE_PASSE }, auth);
  });
}

function confirmer(
  entetes: Headers,
  utilisateurId: string,
  jetonSession: string,
  code: string,
): Promise<ConfirmationEnrolement> {
  return dansUnEchangeAuth(() =>
    confirmerEnrolement(
      entetes,
      utilisateurId,
      jetonSession,
      { code },
      auth,
      clientApp(),
    ),
  );
}

describe("preparationEnAttente — la relecture serveur qui remplace l'URL", () => {
  it("rend `null` tant qu'aucune préparation n'est en attente", async () => {
    const email = await compteHabilite("rien");
    const entetes = await connecter(email);
    const session = await obtenirSession(entetes, auth);
    expect(session).not.toBeNull();

    const rien = await preparationEnAttente(
      session!.contexte.utilisateurId,
      email,
      auth,
      clientApp(),
    );
    expect(rien).toBeNull();
  });

  it("relit EXACTEMENT la clé préparée — un code calculé sur la relecture est accepté", async () => {
    const email = await compteHabilite("cle");
    const entetes = await connecter(email);
    const session = await obtenirSession(entetes, auth);
    const utilisateurId = session!.contexte.utilisateurId;

    const preparation = await preparer(entetes);
    if (preparation.issue !== "prepare") {
      throw new Error("préparation refusée");
    }

    const relue = await preparationEnAttente(
      utilisateurId,
      email,
      auth,
      clientApp(),
    );
    expect(relue).not.toBeNull();
    expect(relue!.cleManuelle).toBe(preparation.cleManuelle);
    expect(relue!.uriTotp).toMatch(/^otpauth:\/\/totp\//);
    expect(relue!.codesSecours).toEqual(preparation.codesSecours);

    // LA PREUVE QUI COMPTE : un code calculé sur la clé RELUE — jamais sur
    // celle que `preparerEnrolement` avait rendue — est accepté par la
    // confirmation. Si le déchiffrement relisait autre chose que le même
    // secret, ce code serait refusé.
    const confirmation = await confirmer(
      entetes,
      utilisateurId,
      session!.jetonSession,
      await codeCourant(relue!.cleManuelle),
    );
    expect(confirmation.issue).toBe("enrole");

    // Et la préparation n'est plus en attente, une fois confirmée.
    expect(
      await preparationEnAttente(utilisateurId, email, auth, clientApp()),
    ).toBeNull();
  });

  it("MESURE — une seconde préparation ne laisse pas deux lignes en base", async () => {
    const email = await compteHabilite("deuxieme");
    const entetes = await connecter(email);
    const session = await obtenirSession(entetes, auth);
    const utilisateurId = session!.contexte.utilisateurId;

    const premiere = await preparer(entetes);
    if (premiere.issue !== "prepare") {
      throw new Error("première préparation refusée");
    }

    const apresPremiere = await avecDesignationAuth(
      clientApp(),
    ).secondFacteur.findMany({
      where: { utilisateur_id: utilisateurId },
    });
    expect(apresPremiere).toHaveLength(1);

    // Deuxième préparation, SANS confirmer la première — exactement le
    // scénario d'un parcours abandonné puis repris.
    const seconde = await preparer(entetes);
    if (seconde.issue !== "prepare") {
      throw new Error("seconde préparation refusée");
    }

    const apresSeconde = await avecDesignationAuth(
      clientApp(),
    ).secondFacteur.findMany({
      where: { utilisateur_id: utilisateurId },
    });
    // MESURÉ, pas supposé : la bibliothèque réutilise la ligne existante
    // (`existingTwoFactor`) plutôt que d'en créer une seconde. Toujours UNE
    // ligne, jamais deux.
    expect(apresSeconde).toHaveLength(1);

    // La clé a changé — la relecture voit TOUJOURS la dernière préparation,
    // jamais la première, abandonnée.
    expect(seconde.cleManuelle).not.toBe(premiere.cleManuelle);
    const relue = await preparationEnAttente(
      utilisateurId,
      email,
      auth,
      clientApp(),
    );
    expect(relue!.cleManuelle).toBe(seconde.cleManuelle);
  });

  it("TR-39 — un code refusé laisse la préparation RELISIBLE", async () => {
    const email = await compteHabilite("codefaux");
    const entetes = await connecter(email);
    const session = await obtenirSession(entetes, auth);
    const utilisateurId = session!.contexte.utilisateurId;

    const preparation = await preparer(entetes);
    if (preparation.issue !== "prepare") {
      throw new Error("préparation refusée");
    }

    const confirmation = await confirmer(
      entetes,
      utilisateurId,
      session!.jetonSession,
      "000000",
    );
    expect(confirmation.issue).toBe("code_invalide");

    // La page ne doit PAS retomber sur l'étape du mot de passe : la clé reste
    // là, exactement celle qui avait été préparée.
    const relue = await preparationEnAttente(
      utilisateurId,
      email,
      auth,
      clientApp(),
    );
    expect(relue).not.toBeNull();
    expect(relue!.cleManuelle).toBe(preparation.cleManuelle);
  });
});
