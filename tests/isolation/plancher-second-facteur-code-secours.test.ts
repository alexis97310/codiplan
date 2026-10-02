import { createOTP } from "@better-auth/utils/otp";
import { base32 } from "@better-auth/utils/base32";
import { afterAll, describe, expect, it } from "vitest";

import {
  creerAuth,
  DUREE_VERROUILLAGE_SECONDES,
  SEUIL_ECHECS_SECOND_FACTEUR,
} from "@/lib/auth/config";
import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { confirmerEnrolement, preparerEnrolement } from "@/lib/auth/enrolement";
import { Role } from "@/lib/auth/roles";
import { obtenirSession } from "@/lib/auth/session";
import { avecContexteRls } from "@/lib/db/rls";
import { uuidv7 } from "@/lib/db/uuid";

import { clientApp, fermerClients, observerSousProprietaire } from "./setup/db";
import { SOCIETE_A } from "./setup/fixtures";

/**
 * LE CLIQUET D'ÉCHECS DE D64 COUVRE-T-IL AUSSI LE CODE DE SECOURS ? (D64, D149 §2)
 *
 * `tests/isolation/plancher-second-facteur.test.ts` mesure déjà le compteur
 * EN ESSAYANT sur le chemin TOTP (`verifyTOTP`) : des codes faux jusqu'à ce
 * que la porte se ferme (429), et le décompte exact des comparaisons.
 * `app/api/session/code-secours/route.ts` et D149 §2 AFFIRMENT que le même
 * cliquet s'applique au chemin `verifyBackupCode`, sans rien y ajouter — mais
 * aucune mesure ne l'avait encore éprouvé sur CE chemin précis.
 *
 * La lecture de la bibliothèque (`better-auth/dist/plugins/two-factor/...`)
 * montre que `verifyBackupCode` appelle exactement les mêmes fonctions que
 * `verifyTOTP` — `assertTwoFactorNotLocked`, `recordTwoFactorFailure`,
 * `resetTwoFactorFailures` —, toutes désignées par `id`, donc nourries par le
 * même report d'échange (D64). C'est une LECTURE DE CODE, pas une mesure : ce
 * fichier essaie réellement, comme l'original.
 */

const MOT_DE_PASSE = "mot-de-passe-de-test-suffisamment-long";

const auth = creerAuth(clientApp());

afterAll(fermerClients);

type CompteEnrole = {
  email: string;
  utilisateurId: string;
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
  const email = `secours-cliquet-${etiquette}-${uuidv7().slice(0, 8)}@iso.test`;
  const cree = await creerAuth(clientApp(), {
    societeId: SOCIETE_A,
    role: Role.admin_societe,
  }).api.signUpEmail({
    body: {
      email,
      password: MOT_DE_PASSE,
      name: `Secours cliquet ${etiquette}`,
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

  return { email, utilisateurId: cree.user.id };
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

/** Présente un code de secours FAUX dans un échange — jamais un des vrais. */
async function presenterCodeSecoursFaux(entetes: Headers): Promise<number> {
  const reponse = await dansUnEchangeAuth(() =>
    auth.api.verifyBackupCode({
      body: { code: "AAAAA-00000" },
      headers: entetes,
      asResponse: true,
    }),
  );
  return reponse.status;
}

/** L'état des compteurs, lu sous le propriétaire — même lecture que l'original. */
async function compteurs(utilisateurId: string): Promise<{
  echecs: number;
  verrouilleJusquA: Date | null;
}> {
  const proprietaire = observerSousProprietaire(
    "les compteurs de second_facteur ne sont pas lisibles sans désignation ; " +
      "l'épreuve doit les observer sans en poser une, sinon elle mesurerait " +
      "sa propre pose plutôt que l'effet du chemin de vérification",
  );
  const [ligne] = await proprietaire.$queryRawUnsafe<
    { echecs_verification: number; verrouille_jusqu_a: Date | null }[]
  >(
    `SELECT "echecs_verification", "verrouille_jusqu_a"
       FROM "second_facteur" WHERE "utilisateur_id" = $1::uuid`,
    utilisateurId,
  );
  return {
    echecs: ligne!.echecs_verification,
    verrouilleJusquA: ligne!.verrouille_jusqu_a,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
describe("LE CLIQUET D'ÉCHECS COUVRE AUSSI LE CHEMIN CODE DE SECOURS (D64, D149 §2)", () => {
  it("des codes de secours faux ferment la porte (429) au MÊME seuil que le TOTP, compté en essayant", async () => {
    const compte = await compteEnrole("compteur");

    let comparés = 0;
    let statutFermeture = 0;
    // Assez de défis pour dépasser largement le seuil : la boucle doit
    // s'arrêter parce que le SYSTÈME refuse, jamais parce qu'elle s'épuise.
    for (let d = 0; d < SEUIL_ECHECS_SECOND_FACTEUR + 5; d += 1) {
      const entetes = await defi(compte.email);
      let defiEpuise = false;
      for (let i = 0; i < 6 && !defiEpuise; i += 1) {
        const statut = await presenterCodeSecoursFaux(entetes);
        if (statut === 401) {
          comparés += 1;
        } else if (statut === 429) {
          statutFermeture = 429;
        } else {
          // 400 — le défi a épuisé ses cinq essais : on en rouvre un.
          defiEpuise = true;
        }
      }
      if (statutFermeture !== 0) {
        break;
      }
    }

    expect(
      statutFermeture,
      "aucun verrouillage n'est jamais survenu en présentant des codes de " +
        "secours faux : le cliquet de D64 ne couvre PAS ce chemin, et un " +
        "code de secours se devine à force d'essais.",
    ).toBe(429);
    expect(comparés).toBe(SEUIL_ECHECS_SECOND_FACTEUR);

    const etat = await compteurs(compte.utilisateurId);
    expect(etat.echecs).toBeGreaterThanOrEqual(SEUIL_ECHECS_SECOND_FACTEUR);
    expect(etat.verrouilleJusquA).not.toBeNull();

    // La durée est celle qui a été arbitrée, à la seconde de vol près.
    const restant = (etat.verrouilleJusquA!.getTime() - Date.now()) / 1000;
    expect(restant).toBeGreaterThan(DUREE_VERROUILLAGE_SECONDES - 120);
    expect(restant).toBeLessThanOrEqual(DUREE_VERROUILLAGE_SECONDES);
  }, 180000);
});
