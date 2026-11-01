import { afterAll, describe, expect, it } from "vitest";

import { creerAuth } from "@/lib/auth/config";
import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { avecDesignationAuth } from "@/lib/auth/lecture-identite";
import {
  changerSonMotDePasse,
  type SaisieChangementMotDePasse,
} from "@/lib/auth/mon-compte";
import { Role } from "@/lib/auth/roles";
import { obtenirSession } from "@/lib/auth/session";
import { avecContexteRls } from "@/lib/db/rls";
import { uuidv7 } from "@/lib/db/uuid";

import { clientApp, fermerClients } from "./setup/db";
import { SOCIETE_A } from "./setup/fixtures";

/**
 * MON COMPTE — CHANGER SON MOT DE PASSE EN ÉTANT CONNECTÉ (9I9-MON-COMPTE).
 *
 * ## Ce que ce fichier éprouve, et pourquoi en appelant la chaîne entière
 *
 * `lib/auth/mon-compte.ts` délègue la vérification du mot de passe actuel et
 * l'écriture du nouveau à Better Auth (`changePassword`), qui relit QUI agit
 * depuis la session portée par les en-têtes — jamais depuis un paramètre de
 * la fonction. *La bonne façon d'éprouver « on ne change que SON PROPRE
 * compte » n'est pas de lire le code, c'est de forger une tentative et de
 * constater qu'elle n'atteint personne d'autre.*
 */

const MOT_DE_PASSE = "mot-de-passe-de-test-suffisamment-long";
const auth = creerAuth(clientApp());
// SEULE LA CRÉATION DE COMPTE EXIGE L'ADMINISTRATION (même patron que
// `tests/isolation/chaine-session.test.ts`) — `signInEmail` et
// `changePassword`, eux, tournent sur `auth` SEULE, comme en production : ni
// l'un ni l'autre n'a besoin d'une désignation d'écriture élargie.
const authAdmin = creerAuth(clientApp(), {
  societeId: SOCIETE_A,
  role: Role.admin_societe,
});

afterAll(fermerClients);

/** Ouvre un compte habilité sur la société A, et rend son courriel. */
async function compteHabilite(role: Role): Promise<string> {
  const email = `mon-compte-${role}-${uuidv7()}@iso.test`;
  const cree = await authAdmin.api.signUpEmail({
    body: { email, password: MOT_DE_PASSE, name: `Mon compte ${role}` },
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
async function connecter(
  email: string,
  motDePasse = MOT_DE_PASSE,
): Promise<Headers> {
  const reponse = await auth.api.signInEmail({
    body: { email, password: motDePasse },
    asResponse: true,
  });
  const cookie = (reponse.headers.getSetCookie?.() ?? [])
    .map((entete) => entete.split(";")[0])
    .join("; ");
  expect(cookie).not.toBe("");
  return new Headers({ cookie });
}

/** Le mot de passe donné ouvre-t-il réellement ce compte ? */
async function ouvre(email: string, motDePasse: string): Promise<boolean> {
  try {
    const reponse = await dansUnEchangeAuth(() =>
      auth.api.signInEmail({
        body: { email, password: motDePasse },
        asResponse: true,
      }),
    );
    return reponse.status === 200;
  } catch {
    return false;
  }
}

/**
 * Ce que le navigateur renverrait désormais, après avoir appliqué les
 * `Set-Cookie` d'une réponse — même conversion que `connecter`, sur des
 * cookies déjà reçus plutôt que sur une connexion.
 */
function entetesApres(cookies: readonly string[]): Headers {
  const cookie = cookies.map((entete) => entete.split(";")[0]).join("; ");
  expect(cookie).not.toBe("");
  return new Headers({ cookie });
}

/** La ligne `session` de ce jeton existe-t-elle encore en base ? */
async function sessionEnBase(jeton: string): Promise<boolean> {
  const vues = await avecDesignationAuth(clientApp()).session.findMany({
    where: { token: jeton },
  });
  return vues.length > 0;
}

describe("changer son mot de passe en étant connecté", () => {
  it("un mot de passe actuel correct change réellement le mot de passe", async () => {
    const email = await compteHabilite(Role.adv);
    const entetes = await connecter(email);
    const nouveau = "NouveauMotDePasseChoisi1";

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

    expect(await ouvre(email, MOT_DE_PASSE)).toBe(false);
    expect(await ouvre(email, nouveau)).toBe(true);
  });

  it("un mot de passe actuel FAUX refuse, et ne change rien", async () => {
    const email = await compteHabilite(Role.adv);
    const entetes = await connecter(email);

    const issue = await changerSonMotDePasse(
      {
        motDePasseActuel: "ce-n-est-pas-le-bon-mot-de-passe",
        motDePasse: "UnAutreMotDePasse1",
        confirmation: "UnAutreMotDePasse1",
      },
      entetes,
      auth,
      clientApp(),
    );
    expect(issue.issue).toBe("actuel_incorrect");
    expect(await ouvre(email, MOT_DE_PASSE)).toBe(true);
  });

  it("deux saisies discordantes refusent, et ne changent rien", async () => {
    const email = await compteHabilite(Role.adv);
    const entetes = await connecter(email);

    const issue = await changerSonMotDePasse(
      {
        motDePasseActuel: MOT_DE_PASSE,
        motDePasse: "UnMotDePasse1",
        confirmation: "UnAutreMotDePasse2",
      },
      entetes,
      auth,
      clientApp(),
    );
    expect(issue.issue).toBe("discordance");
    expect(await ouvre(email, MOT_DE_PASSE)).toBe(true);
  });

  it("un mot de passe trop court refuse, et ne change rien", async () => {
    const email = await compteHabilite(Role.adv);
    const entetes = await connecter(email);
    const court = "a".repeat(7);

    const issue = await changerSonMotDePasse(
      {
        motDePasseActuel: MOT_DE_PASSE,
        motDePasse: court,
        confirmation: court,
      },
      entetes,
      auth,
      clientApp(),
    );
    expect(issue.issue).toBe("trop_court");
    expect(await ouvre(email, MOT_DE_PASSE)).toBe(true);
  });

  it("une tentative de désigner un AUTRE compte reste sans effet : seul le compte de la session change", async () => {
    const victime = await compteHabilite(Role.responsable_sav);
    const auteur = await compteHabilite(Role.adv);
    const entetesAuteur = await connecter(auteur);
    const nouveau = "MotDePasseForgePourAutrui1";

    // AUCUN paramètre de `changerSonMotDePasse` ne désigne un compte — la
    // saisie n'en porte pas non plus. Une tentative de forger un champ
    // supplémentaire (ce qu'une requête HTTP bricolée pourrait poster) est
    // simplement ignorée : Zod ne lit que les trois champs attendus.
    const saisieForgee: SaisieChangementMotDePasse & Record<string, string> = {
      motDePasseActuel: MOT_DE_PASSE,
      motDePasse: nouveau,
      confirmation: nouveau,
      utilisateurId: victime,
      cible: victime,
    };

    const issue = await changerSonMotDePasse(
      saisieForgee,
      entetesAuteur,
      auth,
      clientApp(),
    );
    expect(issue.issue).toBe("abouti");

    // Le compte qui a changé est celui de LA SESSION (l'auteur) — jamais
    // celui qu'un champ forgé aurait pu nommer.
    expect(await ouvre(auteur, nouveau)).toBe(true);
    expect(await ouvre(victime, MOT_DE_PASSE)).toBe(true);
    expect(await ouvre(victime, nouveau)).toBe(false);
  });

  it("un aboutissement ferme l'AUTRE session, et remplace la courante sans déconnecter", async () => {
    const email = await compteHabilite(Role.adv);
    const entetesA = await connecter(email);
    const entetesB = await connecter(email);
    const sessionAAvant = await obtenirSession(entetesA, auth);
    const sessionBAvant = await obtenirSession(entetesB, auth);
    if (sessionAAvant === null || sessionBAvant === null) {
      throw new Error("les deux connexions doivent ouvrir une session");
    }
    expect(await sessionEnBase(sessionAAvant.jetonSession)).toBe(true);
    expect(await sessionEnBase(sessionBAvant.jetonSession)).toBe(true);

    const nouveau = "NouveauMotDePasseFermeLesAutres1";
    const issue = await changerSonMotDePasse(
      {
        motDePasseActuel: MOT_DE_PASSE,
        motDePasse: nouveau,
        confirmation: nouveau,
      },
      entetesA,
      auth,
      clientApp(),
    );
    expect(issue.issue).toBe("abouti");
    if (issue.issue !== "abouti") {
      throw new Error("inatteignable, l'assertion précédente l'a vérifié");
    }

    // L'AUTRE session (B) n'existe plus en base.
    expect(await sessionEnBase(sessionBAvant.jetonSession)).toBe(false);
    expect(await obtenirSession(entetesB, auth)).toBeNull();

    // La session A d'origine a été REMPLACÉE : son jeton d'avant n'existe
    // plus, mais la personne reste connectée sous la session neuve que les
    // `Set-Cookie` rendus désignent.
    expect(await sessionEnBase(sessionAAvant.jetonSession)).toBe(false);
    const entetesAApres = entetesApres(issue.cookies);
    const sessionAApres = await obtenirSession(entetesAApres, auth);
    expect(sessionAApres).not.toBeNull();
    expect(sessionAApres?.jetonSession).not.toBe(sessionAAvant.jetonSession);
    expect(await sessionEnBase(sessionAApres?.jetonSession ?? "")).toBe(true);
  });

  it("un mot de passe actuel FAUX ne révoque AUCUNE session", async () => {
    const email = await compteHabilite(Role.adv);
    const entetesA = await connecter(email);
    const entetesB = await connecter(email);
    const sessionAAvant = await obtenirSession(entetesA, auth);
    const sessionBAvant = await obtenirSession(entetesB, auth);
    if (sessionAAvant === null || sessionBAvant === null) {
      throw new Error("les deux connexions doivent ouvrir une session");
    }

    const issue = await changerSonMotDePasse(
      {
        motDePasseActuel: "ce-n-est-pas-le-bon-mot-de-passe",
        motDePasse: "UnAutreMotDePasse1",
        confirmation: "UnAutreMotDePasse1",
      },
      entetesA,
      auth,
      clientApp(),
    );
    expect(issue.issue).toBe("actuel_incorrect");

    expect(await sessionEnBase(sessionAAvant.jetonSession)).toBe(true);
    expect(await sessionEnBase(sessionBAvant.jetonSession)).toBe(true);
    expect(await obtenirSession(entetesA, auth)).not.toBeNull();
    expect(await obtenirSession(entetesB, auth)).not.toBeNull();
  });
});
