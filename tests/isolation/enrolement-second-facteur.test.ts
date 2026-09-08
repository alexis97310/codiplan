import { createOTP } from "@better-auth/utils/otp";
import { base32 } from "@better-auth/utils/base32";
import { afterAll, describe, expect, it } from "vitest";

import { creerAuth } from "@/lib/auth/config";
import { confirmerEnrolement, preparerEnrolement } from "@/lib/auth/enrolement";
import { Role } from "@/lib/auth/roles";
import { obtenirSession } from "@/lib/auth/session";
import { avecContexteRls } from "@/lib/db/rls";
import { uuidv7 } from "@/lib/db/uuid";

import {
  clientApp,
  clientOwner,
  fermerClients,
  observerSousProprietaire,
} from "./setup/db";
import { ROLE_APP, SOCIETE_A } from "./setup/fixtures";

/** Sortie forcée d'une transaction de jumeau : le `ROLLBACK` défait le DDL. */
class Annulation extends Error {}

/**
 * L'ENRÔLEMENT DU SECOND FACTEUR, DE BOUT EN BOUT (ticket L1-02f).
 *
 * ## Ce que ce fichier éprouve, et pourquoi il existe
 *
 * Avant ce ticket, la chaîne d'enrôlement **répondait « c'est fait » sans rien
 * faire** — mesuré : `enableTwoFactor` réussissait, `verifyTOTP` rendait HTTP
 * 200 avec un code juste, et le compte se reconnectait ensuite sans qu'aucun
 * second facteur ne lui soit demandé. Les deux écritures étaient refusées en
 * silence par RLS ; zéro ligne modifiée n'est pas une erreur.
 *
 * **Aucun scénario ne pouvait l'attraper, parce que rien n'appelait cette
 * chaîne** — c'est la leçon du 08/09 au §9, rejouée sur un autre maillon. Ce
 * fichier est l'appelant qui manquait, et il regarde l'ÉTAT, jamais le code de
 * retour : un enrôlement se constate en base et à la reconnexion suivante.
 */

const MOT_DE_PASSE = "mot-de-passe-de-test-suffisamment-long";

const auth = creerAuth(clientApp());
const authAdmin = creerAuth(clientApp(), {
  societeId: SOCIETE_A,
  role: Role.admin_societe,
});

afterAll(fermerClients);

/** Ouvre un compte habilité sur A sous `role`, et rend son courriel. */
async function compteHabilite(role: Role, etiquette: string): Promise<string> {
  const email = `enrol-${etiquette}-${uuidv7().slice(0, 8)}@iso.test`;
  const cree = await authAdmin.api.signUpEmail({
    body: { email, password: MOT_DE_PASSE, name: `Enrôlement ${etiquette}` },
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
        role,
      ),
  );
  return email;
}

/** Les en-têtes qu'un navigateur renverrait après une connexion. */
async function connecter(email: string): Promise<Headers> {
  const reponse = await auth.api.signInEmail({
    body: { email, password: MOT_DE_PASSE },
    asResponse: true,
  });
  const cookie = (reponse.headers.getSetCookie?.() ?? [])
    .map((entete) => entete.split(";")[0])
    .join("; ");
  // TÉMOIN : sans cookie, tout ce qui suit mesurerait l'absence de session.
  expect(cookie).not.toBe("");
  return new Headers({ cookie });
}

/**
 * Le code TOTP que porterait l'application d'authentification de l'utilisateur.
 *
 * La clé de l'URI est en base32 ; la bibliothèque, elle, calcule sur le secret
 * BRUT. Mesuré : passer la base32 telle quelle rend un code refusé — un échec
 * qui ressemble à s'y méprendre à un enrôlement qui ne marche pas.
 */
async function codeCourant(cleManuelle: string): Promise<string> {
  const secret = new TextDecoder().decode(base32.decode(cleManuelle));
  return createOTP(secret, { digits: 6, period: 30 }).totp();
}

/** L'état réel des deux drapeaux, lu sous le propriétaire. */
async function drapeaux(
  email: string,
): Promise<{ mfaActif: boolean; verifie: boolean | null }> {
  const proprietaire = observerSousProprietaire(
    "l'enrôlement se constate en base : c'est l'ÉTAT qui prouve, pas le code " +
      "de retour d'une API qui rendait déjà 200 sans rien écrire",
  );
  const lignes = await proprietaire.$queryRawUnsafe<
    { mfa_actif: boolean; verifie: boolean | null }[]
  >(
    `SELECT "u"."mfa_actif", "sf"."verifie"
       FROM "utilisateur" "u"
       LEFT JOIN "second_facteur" "sf" ON "sf"."utilisateur_id" = "u"."id"
      WHERE "u"."email" = $1`,
    email,
  );
  return {
    mfaActif: lignes[0]?.mfa_actif ?? false,
    verifie: lignes[0]?.verifie ?? null,
  };
}

describe("l'enrôlement du second facteur, par un chemin à nous", () => {
  it("enrôle vraiment : les deux drapeaux, et la connexion suivante l'exige", async () => {
    const email = await compteHabilite(Role.admin_societe, "complet");
    const entetes = await connecter(email);
    const session = await obtenirSession(entetes, auth);
    expect(session).not.toBeNull();

    // TÉMOIN PRÉALABLE : rien n'est enrôlé au départ. Sans lui, un scénario où
    // le compte serait déjà enrôlé passerait sans rien mesurer.
    expect(await drapeaux(email)).toEqual({ mfaActif: false, verifie: null });

    const preparation = await preparerEnrolement(
      entetes,
      { motDePasse: MOT_DE_PASSE },
      auth,
    );
    expect(preparation.issue).toBe("prepare");
    if (preparation.issue !== "prepare") {
      return;
    }
    expect(preparation.uriTotp).toMatch(/^otpauth:\/\/totp\//);
    expect(preparation.cleManuelle).not.toBe("");
    expect(preparation.codesSecours.length).toBeGreaterThan(0);

    // La préparation N'ENRÔLE PAS : un parcours abandonné laisse le compte dans
    // l'état où il était.
    expect((await drapeaux(email)).mfaActif).toBe(false);

    const confirmation = await confirmerEnrolement(
      entetes,
      session!.contexte.utilisateurId,
      session!.jetonSession,
      { code: await codeCourant(preparation.cleManuelle) },
      auth,
      clientApp(),
    );
    expect(confirmation.issue).toBe("enrole");

    // ── LA PREUVE, ET ELLE EST EN BASE ────────────────────────────────────
    expect(await drapeaux(email)).toEqual({ mfaActif: true, verifie: true });

    // ── ET LA PREUVE QUI COMPTE VRAIMENT : LA CONNEXION SUIVANTE ──────────
    //
    // C'est exactement ce qui échouait avant le ticket — le compte se
    // reconnectait sans qu'aucun facteur ne lui soit demandé.
    const reponse = await auth.api.signInEmail({
      body: { email, password: MOT_DE_PASSE },
      asResponse: true,
    });
    const corps = (await reponse.json()) as { twoFactorRedirect?: boolean };
    expect(
      corps.twoFactorRedirect,
      "le compte s'est reconnecté sans qu'aucun second facteur ne lui soit " +
        "demandé : l'enrôlement a répondu « c'est fait » sans rien faire.",
    ).toBe(true);
  });

  it("la session qui a enrôlé est FERMÉE — elle n'avait pas présenté de facteur", async () => {
    const email = await compteHabilite(Role.admin_societe, "fermeture");
    const entetes = await connecter(email);
    const session = await obtenirSession(entetes, auth);
    const preparation = await preparerEnrolement(
      entetes,
      { motDePasse: MOT_DE_PASSE },
      auth,
    );
    if (preparation.issue !== "prepare") {
      throw new Error("préparation refusée");
    }
    await confirmerEnrolement(
      entetes,
      session!.contexte.utilisateurId,
      session!.jetonSession,
      { code: await codeCourant(preparation.cleManuelle) },
      auth,
      clientApp(),
    );

    expect(await obtenirSession(entetes, auth)).toBeNull();
  });

  it("un code faux n'enrôle rien, et laisse le compte utilisable", async () => {
    const email = await compteHabilite(Role.admin_societe, "codefaux");
    const entetes = await connecter(email);
    const session = await obtenirSession(entetes, auth);
    const preparation = await preparerEnrolement(
      entetes,
      { motDePasse: MOT_DE_PASSE },
      auth,
    );
    if (preparation.issue !== "prepare") {
      throw new Error("préparation refusée");
    }

    const confirmation = await confirmerEnrolement(
      entetes,
      session!.contexte.utilisateurId,
      session!.jetonSession,
      { code: "000000" },
      auth,
      clientApp(),
    );
    expect(confirmation.issue).toBe("code_invalide");
    expect((await drapeaux(email)).mfaActif).toBe(false);

    // Le compte n'est pas ENFERMÉ : il se reconnecte sans facteur, puisqu'il
    // n'en déclare aucun. C'est le sens de défaillance que l'ordre des deux
    // écritures a choisi.
    const reponse = await auth.api.signInEmail({
      body: { email, password: MOT_DE_PASSE },
      asResponse: true,
    });
    expect(reponse.status).toBe(200);
  });

  it("un mot de passe faux ne prépare rien — une session volée ne suffit pas", async () => {
    const email = await compteHabilite(Role.admin_societe, "mdpfaux");
    const entetes = await connecter(email);

    const preparation = await preparerEnrolement(
      entetes,
      { motDePasse: "ce-n-est-pas-le-bon-mot-de-passe" },
      auth,
    );
    expect(preparation.issue).toBe("refus");
    expect((await drapeaux(email)).verifie).toBeNull();
  });

  it("LE CLIQUET NE SE DESSERRE PAS : le drapeau ne repasse jamais à false", async () => {
    const email = await compteHabilite(Role.admin_societe, "cliquet");
    const entetes = await connecter(email);
    const session = await obtenirSession(entetes, auth);
    const preparation = await preparerEnrolement(
      entetes,
      { motDePasse: MOT_DE_PASSE },
      auth,
    );
    if (preparation.issue !== "prepare") {
      throw new Error("préparation refusée");
    }
    await confirmerEnrolement(
      entetes,
      session!.contexte.utilisateurId,
      session!.jetonSession,
      { code: await codeCourant(preparation.cleManuelle) },
      auth,
      clientApp(),
    );
    expect((await drapeaux(email)).mfaActif).toBe(true);

    const utilisateurId = session!.contexte.utilisateurId;

    // Le sujet lui-même, sous sa propre désignation, tente de se désenrôler.
    // Le refus est SILENCIEUX — zéro ligne, pas une erreur.
    const retrait = await clientApp().$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        "SELECT set_config('app.authentification_utilisateur_id', $1, true)",
        utilisateurId,
      );
      return tx.$executeRawUnsafe(
        `UPDATE "utilisateur" SET "mfa_actif" = false WHERE "id" = $1::uuid`,
        utilisateurId,
      );
    });
    expect(retrait).toBe(0);
    expect((await drapeaux(email)).mfaActif).toBe(true);
  });

  it("et le chemin d'enrôlement ne change RIEN D'AUTRE que le drapeau", async () => {
    // RLS est par LIGNE : sans le déclencheur, la même instruction qui pose
    // `mfa_actif = true` poserait aussi un autre courriel. C'est le point de
    // conception du ticket, et il se mesure.
    const email = await compteHabilite(Role.direction, "colonnes");
    const entetes = await connecter(email);
    const session = await obtenirSession(entetes, auth);
    const utilisateurId = session!.contexte.utilisateurId;

    await expect(
      clientApp().$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          "SELECT set_config('app.authentification_utilisateur_id', $1, true)",
          utilisateurId,
        );
        return tx.$executeRawUnsafe(
          `UPDATE "utilisateur" SET "mfa_actif" = true, "email" = $2 WHERE "id" = $1::uuid`,
          utilisateurId,
          `detourne-${uuidv7().slice(0, 8)}@iso.test`,
        );
      }),
    ).rejects.toThrow(/utilisateur_enrolement_mfa_seul|second facteur/i);

    const apres = await drapeaux(email);
    expect(apres.mfaActif).toBe(false);
  });

  it("JUMEAU — retirez le déclencheur, et le courriel part avec le drapeau", async () => {
    // Le jumeau du §9 (24/08), et il vise LE verrou en cause : le déclencheur,
    // pas la politique. Sans lui, la politique laisse passer l'instruction
    // entière — c'est très exactement ce que « RLS est par LIGNE » veut dire.
    const email = await compteHabilite(Role.direction, "jumeau-colonnes");
    const entetes = await connecter(email);
    const utilisateurId = (await obtenirSession(entetes, auth))!.contexte
      .utilisateurId;
    const nouveau = `jumeau-${uuidv7().slice(0, 8)}@iso.test`;

    const modifiees = await clientOwner()
      .$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `DROP TRIGGER "utilisateur_enrolement_mfa_seul" ON "utilisateur"`,
        );
        await tx.$executeRawUnsafe(`SET LOCAL ROLE "${ROLE_APP}"`);
        await tx.$executeRawUnsafe(
          "SELECT set_config('app.authentification_utilisateur_id', $1, true)",
          utilisateurId,
        );
        const n = await tx.$executeRawUnsafe(
          `UPDATE "utilisateur" SET "mfa_actif" = true, "email" = $2 WHERE "id" = $1::uuid`,
          utilisateurId,
          nouveau,
        );
        throw new Annulation(String(n));
      })
      .catch((erreur: unknown) =>
        erreur instanceof Annulation ? Number(erreur.message) : -1,
      );

    // La violation a bien eu lieu : sans ce décompte, le jumeau serait creux.
    expect(modifiees).toBe(1);

    // Et la transaction annulée n'a rien laissé derrière elle.
    expect((await drapeaux(email)).mfaActif).toBe(false);
    const [declencheur] = await clientOwner().$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM pg_trigger
        WHERE tgname = 'utilisateur_enrolement_mfa_seul' AND NOT tgisinternal`,
    );
    expect(Number(declencheur?.n)).toBe(1);
  });

  it("JUMEAU — rendez au WITH CHECK le droit de dire false, et le cliquet cède", async () => {
    // Le cliquet ne tient qu'à l'ASYMÉTRIE des deux expressions : `USING` lit
    // l'ancienne ligne, `WITH CHECK` la nouvelle. Ce jumeau remplace la seconde
    // par une expression symétrique — la faute telle qu'un correcteur bien
    // intentionné l'écrirait, en croyant simplifier — et montre que le drapeau
    // repasse alors à `false`.
    const email = await compteHabilite(Role.admin_societe, "jumeau-cliquet");
    const entetes = await connecter(email);
    const session = await obtenirSession(entetes, auth);
    const preparation = await preparerEnrolement(
      entetes,
      { motDePasse: MOT_DE_PASSE },
      auth,
    );
    if (preparation.issue !== "prepare") {
      throw new Error("préparation refusée");
    }
    await confirmerEnrolement(
      entetes,
      session!.contexte.utilisateurId,
      session!.jetonSession,
      { code: await codeCourant(preparation.cleManuelle) },
      auth,
      clientApp(),
    );
    // TÉMOIN : le jumeau part d'un compte réellement enrôlé, sinon il ne
    // desserrerait rien.
    expect((await drapeaux(email)).mfaActif).toBe(true);

    const utilisateurId = session!.contexte.utilisateurId;
    const desenroles = await clientOwner()
      .$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `DROP POLICY "utilisateur_enrolement_mfa" ON "utilisateur"`,
        );
        await tx.$executeRawUnsafe(
          `CREATE POLICY "jumeau_cliquet" ON "utilisateur"
             FOR UPDATE
             USING ("id" = NULLIF(current_setting('app.authentification_utilisateur_id', true), '')::uuid)
             WITH CHECK ("id" = NULLIF(current_setting('app.authentification_utilisateur_id', true), '')::uuid)`,
        );
        await tx.$executeRawUnsafe(`SET LOCAL ROLE "${ROLE_APP}"`);
        await tx.$executeRawUnsafe(
          "SELECT set_config('app.authentification_utilisateur_id', $1, true)",
          utilisateurId,
        );
        const n = await tx.$executeRawUnsafe(
          `UPDATE "utilisateur" SET "mfa_actif" = false WHERE "id" = $1::uuid`,
          utilisateurId,
        );
        throw new Annulation(String(n));
      })
      .catch((erreur: unknown) =>
        erreur instanceof Annulation ? Number(erreur.message) : -1,
      );

    expect(desenroles).toBe(1);
    expect((await drapeaux(email)).mfaActif).toBe(true);
    const [politiques] = await clientOwner().$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM pg_policies
        WHERE tablename = 'utilisateur' AND policyname = 'utilisateur_enrolement_mfa'`,
    );
    expect(Number(politiques?.n)).toBe(1);
  });
});
