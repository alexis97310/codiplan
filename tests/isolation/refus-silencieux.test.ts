import { afterAll, describe, expect, it } from "vitest";

import { creerAuth } from "@/lib/auth/config";
import { tenterConnexion } from "@/lib/auth/connexion";
import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { Role } from "@/lib/auth/roles";
import { avecContexteRls } from "@/lib/db/rls";
import { uuidv7 } from "@/lib/db/uuid";

import { clientApp, fermerClients, observerSousProprietaire } from "./setup/db";
import { SOCIETE_A } from "./setup/fixtures";

/**
 * LES REFUS SILENCIEUX DE LA CHAÎNE D'AUTHENTIFICATION, NOMMÉS.
 *
 * ## Pourquoi ce fichier existe
 *
 * **Un refus de RLS est zéro ligne, pas une erreur.** Le dépôt l'a appris trois
 * fois — l'enrôlement qui répondait « c'est fait » sans rien faire (L1-02f), les
 * sept écritures par `id` refusées en silence (D64), le code de secours validé
 * puis rejeté. À chaque fois, la même forme : *une écriture qui compte, dont
 * personne ne compte les lignes.*
 *
 * `lib/auth/enrolement.ts` en a tiré la leçon et compte (`facteur.count === 0`).
 * **Deux autres écritures de la même famille ne comptent pas** :
 *
 *   - `lib/auth/connexion.ts` retire la session d'un compte désactivé, puis rend
 *     le refus uniforme de D35. Si le retrait ne mordait pas, *un compte
 *     désactivé garderait un jeton valide* — et le refus uniforme le cacherait ;
 *   - `lib/auth/enrolement.ts` ferme les deux sessions ouvertes SANS second
 *     facteur. Son propre commentaire dit pourquoi — *un jeton vivant que nul ne
 *     détient reste un jeton vivant* — et ne le vérifie pas.
 *
 * ## Ce que ce fichier fait, et ce qu'il ne fait PAS
 *
 * Il **nomme** les deux, en constatant l'ÉTAT en base plutôt qu'un code de
 * retour. Il ne change rien au code : compter dans le module et changer la
 * réponse romprait l'indiscernabilité de D35, et compter pour se taire ne
 * servirait à rien. *Ce qui manque à un refus silencieux n'est pas un compteur,
 * c'est un appelant qui regarde.* Ce fichier est cet appelant.
 *
 * **Ils passent aujourd'hui**, et c'est le but : le rendez-vous est posé AVANT
 * que le défaut n'existe, pas après. Le jour où une politique se resserre, c'est
 * ici que cela rougira — et non chez un utilisateur qui n'entrera plus.
 */

const MOT_DE_PASSE = "mot-de-passe-de-test-suffisamment-long";
const auth = creerAuth(clientApp());

afterAll(fermerClients);

/** Ouvre un compte habilité, et rend son courriel et son identifiant. */
async function compte(
  etiquette: string,
  role: Role,
): Promise<{ email: string; utilisateurId: string }> {
  const email = `refus-${etiquette}-${uuidv7().slice(0, 8)}@iso.test`;
  const cree = await creerAuth(clientApp(), {
    societeId: SOCIETE_A,
    role: Role.admin_societe,
  }).api.signUpEmail({
    body: { email, password: MOT_DE_PASSE, name: `Refus ${etiquette}` },
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
  return { email, utilisateurId: cree.user.id };
}

function proprietaire() {
  return observerSousProprietaire(
    "compter les sessions d'un compte SANS présenter de jeton — or c'est " +
      "précisément l'absence de jeton présenté qui est mesurée : le rôle " +
      "applicatif ne peut pas lire ce qu'il n'a pas désigné",
  );
}

async function sessionsDe(utilisateurId: string): Promise<number> {
  const [ligne] = await proprietaire().$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT count(*) AS n FROM "session" WHERE "utilisateur_id" = $1::uuid`,
    utilisateurId,
  );
  return Number(ligne?.n);
}

/**
 * Retire les sessions qu'un compte porte déjà.
 *
 * **Sans cela, la mesure conclut faux, et elle l'a fait.** `signUpEmail` OUVRE
 * une session à la création du compte : la première lecture de cette mesure a vu
 * une session survivre à la connexion refusée et en a conclu que le retrait ne
 * mordait pas. C'était la session de l'inscription, que le chemin de connexion
 * n'a aucune raison de connaître.
 *
 * *Un rouge inattendu est un soupçon sur la mesure avant d'être un fait sur le
 * monde* — §9, 07/09, dans les deux sens.
 */
async function repartirSansSession(utilisateurId: string): Promise<void> {
  await proprietaire().$executeRawUnsafe(
    `DELETE FROM "session" WHERE "utilisateur_id" = $1::uuid`,
    utilisateurId,
  );
  expect(await sessionsDe(utilisateurId)).toBe(0);
}

describe("un compte désactivé ne garde AUCUN jeton vivant", () => {
  it("la session ouverte par la connexion est réellement retirée", async () => {
    const { email, utilisateurId } = await compte("desactive", Role.adv);
    await repartirSansSession(utilisateurId);

    // La désactivation passe par le chemin ADMINISTRATIF : le déclencheur
    // `utilisateur_enrolement_mfa_seul` refuse toute autre colonne que
    // `mfa_actif` tant qu'aucune société n'est active — y compris au
    // propriétaire. Mesuré en écrivant ce fichier.
    await proprietaire().$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        "SELECT set_config('app.societe_id', $1, true)",
        SOCIETE_A,
      );
      await tx.$executeRawUnsafe(
        `UPDATE "utilisateur" SET "actif" = false WHERE "id" = $1::uuid`,
        utilisateurId,
      );
    });

    const resultat = await dansUnEchangeAuth(() =>
      tenterConnexion({ email, motDePasse: MOT_DE_PASSE }, auth, clientApp()),
    );
    expect(resultat.issue).toBe("refus");

    expect(
      await sessionsDe(utilisateurId),
      "le compte est désactivé, le refus est rendu — et une session survit. " +
        "Le retrait a été refusé en silence, et le refus uniforme de D35 le " +
        "cache : un compte désactivé garde un jeton valide.",
    ).toBe(0);
  });

  it("TÉMOIN — le même compte, ACTIF, ouvre bien une session", async () => {
    // Sans ce témoin, « zéro session » ne distinguerait pas « retirée » de
    // « jamais ouverte » : la connexion pourrait échouer pour une tout autre
    // raison et le scénario resterait vert.
    const { email, utilisateurId } = await compte("actif", Role.adv);
    await repartirSansSession(utilisateurId);

    const resultat = await dansUnEchangeAuth(() =>
      tenterConnexion({ email, motDePasse: MOT_DE_PASSE }, auth, clientApp()),
    );
    expect(resultat.issue).toBe("session");
    expect(await sessionsDe(utilisateurId)).toBe(1);
  });
});

describe("l'inscription OUVRE une session, et rien ne la ferme", () => {
  it("MESURE — un compte fraîchement ouvert porte déjà un jeton vivant", async () => {
    // **Ce n'est pas un défaut aujourd'hui, et c'est pourquoi il est écrit
    // plutôt que réparé** : aucun chemin de production n'appelle `signUpEmail`.
    // Mais le geste d'ouverture du premier compte l'appellera, et il faut
    // savoir ceci avant de l'écrire : *celui qui ouvre un compte en repart avec
    // une session ouverte AU NOM de ce compte.* C'est un second canal, à côté
    // du mot de passe, que personne n'avait nommé.
    const { utilisateurId } = await compte("inscription", Role.adv);

    expect(
      await sessionsDe(utilisateurId),
      "si ce décompte tombe à zéro, quelqu'un a fermé cette session — et la " +
        "réserve inscrite au registre sur le geste d'amorçage n'a plus lieu " +
        "d'être. C'est une bonne nouvelle qui doit se constater ici.",
    ).toBe(1);
  });
});
