import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ouvrirPremierCompte } from "@/lib/auth/amorcage";
import { creerAuth } from "@/lib/auth/config";
import { dansUnEchangeAuth } from "@/lib/auth/echange";
import {
  LONGUEUR_MINIMALE,
  choisirLePremierMotDePasse,
} from "@/lib/auth/premier-acces";
import { uuidv7 } from "@/lib/db/uuid";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import "./setup/env";

/**
 * LE PREMIER ACCÈS — LA CHAÎNE ENTIÈRE, DU JETON AU MOT DE PASSE QUI OUVRE.
 *
 * ## Ce qu'il répare, et il a été mesuré
 *
 * `lib/auth/amorcage.ts` délivre une URL de premier accès depuis le 09/09/2026,
 * et sa redirection finale pointe sur `/premier-acces`. **Cet écran n'existait
 * pas** : mesuré le 11/09/2026 en suivant le lien réellement émis, la chaîne
 * aboutissait à `/premier-acces?token=…` et rendait **404**.
 *
 * *La conséquence n'était pas cosmétique.* Le seed n'attribue aucun mot de
 * passe — il n'en existe aucun tant qu'une personne n'en a pas choisi un —, et
 * ce lien est l'unique chemin pour en choisir un. **Une base neuve était donc
 * inaccessible à quiconque, et rien ne le disait.**
 *
 * ## POURQUOI CE FICHIER EXISTE PLUTÔT QU'UNE ASSERTION DE PLUS
 *
 * C'est un APPELANT, au sens du §9 du 08/09 : *une suite qui éprouve tous les
 * maillons n'éprouve pas la chaîne.* `amorcage-premier-compte.test.ts` éprouve
 * l'émission du jeton ; `tests/unit/auth/premier-acces.test.ts` éprouve les
 * refus de saisie. Le maillon que personne ne traversait est celui-ci : *le
 * jeton émis ouvre-t-il vraiment un compte par lequel on se connecte ensuite ?*
 */

afterAll(fermerClients);

const SOCIETE = uuidv7();
const CODE = `PREMACC-${SOCIETE.slice(0, 8)}`;
const EMAIL = `premier-acces-${SOCIETE.slice(0, 8)}@example.test`;
const CHOISI = "MotDePasseChoisiParLaPersonne1";

beforeAll(async () => {
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "societe" (id, code, raison_sociale, pays, territoire,
       fuseau_horaire, devise_code, majoration_hors_ouverture_pct, langue, actif)
     VALUES ($1::uuid, $2, $3, 'NC', 'NC', 'Pacific/Noumea', 'XPF', 0, 'fr', true)`,
    SOCIETE,
    CODE,
    `Société ${CODE}`,
  );
});

/** Le jeton est un SEGMENT DE CHEMIN de l'URL émise, jamais un paramètre. */
function jetonDe(url: string): string {
  const chemin = new URL(url, "http://amorcage.invalid").pathname;
  const jeton = chemin.split("/").pop();
  if (jeton === undefined || jeton === "") {
    throw new Error(`L'URL émise ne porte aucun jeton : ${url}`);
  }
  return jeton;
}

describe("premier accès", () => {
  let jeton = "";

  beforeAll(async () => {
    const ouverture = await ouvrirPremierCompte(clientApp(), {
      societeId: SOCIETE,
      email: EMAIL,
      nom: "Premier accès",
    });
    jeton = jetonDe(ouverture.urlPremierAcces);
  });

  it("TÉMOIN — avant le premier accès, AUCUN mot de passe n'ouvre le compte", async () => {
    // Sans ce témoin, la mesure suivante serait creuse : un compte qui aurait
    // DÉJÀ un mot de passe se connecterait tout aussi bien, et le vert ne
    // dirait rien de ce que le premier accès a fait (§9, 07/09).
    const [ligne] = await clientOwner().$queryRawUnsafe<{ avec: boolean }[]>(
      `SELECT c.mot_de_passe IS NOT NULL AS avec
         FROM "compte" c JOIN "utilisateur" u ON u.id = c.utilisateur_id
        WHERE u.email = $1`,
      EMAIL,
    );
    expect(ligne?.avec).toBe(false);

    await expect(
      dansUnEchangeAuth(() =>
        creerAuth(clientApp()).api.signInEmail({
          body: { email: EMAIL, password: CHOISI },
        }),
      ),
    ).rejects.toThrow();
  });

  it("un mot de passe trop court NE CONSOMME PAS le jeton", async () => {
    const trop = "a".repeat(LONGUEUR_MINIMALE - 1);
    const refus = await choisirLePremierMotDePasse(
      {
        jeton,
        motDePasse: trop,
        confirmation: trop,
      },
      creerAuth(clientApp()),
      clientApp(),
    );
    expect(refus.issue).toBe("trop_court");
    // ET LE JETON VIT ENCORE — c'est ce que « ne consomme pas » veut dire, et
    // c'est la seule façon de le mesurer : le réutiliser et réussir.
    const abouti = await choisirLePremierMotDePasse(
      {
        jeton,
        motDePasse: CHOISI,
        confirmation: CHOISI,
      },
      creerAuth(clientApp()),
      clientApp(),
    );
    expect(abouti.issue).toBe("abouti");
  });

  it("le mot de passe choisi OUVRE réellement le compte", async () => {
    const reponse = await dansUnEchangeAuth(() =>
      creerAuth(clientApp()).api.signInEmail({
        body: { email: EMAIL, password: CHOISI },
        asResponse: true,
      }),
    );
    expect(reponse.status).toBe(200);
  });

  it("et le jeton est MORT : il ne se rejoue pas", async () => {
    const rejeu = await choisirLePremierMotDePasse(
      {
        jeton,
        motDePasse: "UnAutreMotDePasseEncore1",
        confirmation: "UnAutreMotDePasseEncore1",
      },
      creerAuth(clientApp()),
      clientApp(),
    );
    expect(rejeu.issue).toBe("refuse");

    // TÉMOIN — le refus vient bien du jeton mort, pas d'un contrôle de saisie :
    // le mot de passe d'origine, lui, ouvre toujours.
    const reponse = await dansUnEchangeAuth(() =>
      creerAuth(clientApp()).api.signInEmail({
        body: { email: EMAIL, password: CHOISI },
        asResponse: true,
      }),
    );
    expect(reponse.status).toBe(200);
  });

  it("un jeton inconnu et un jeton mort rendent LE MÊME refus — aucun oracle", async () => {
    const inconnu = await choisirLePremierMotDePasse(
      {
        jeton: "jeton-jamais-emis-par-personne",
        motDePasse: CHOISI,
        confirmation: CHOISI,
      },
      creerAuth(clientApp()),
      clientApp(),
    );
    const mort = await choisirLePremierMotDePasse(
      {
        jeton,
        motDePasse: CHOISI,
        confirmation: CHOISI,
      },
      creerAuth(clientApp()),
      clientApp(),
    );
    expect(inconnu).toEqual(mort);
    expect(inconnu.issue).toBe("refuse");
  });
});

/**
 * CHOISIR UN MOT DE PASSE PAR LIEN FERME LES AUTRES SESSIONS DU COMPTE —
 * décision d'Alexis du 10/11/2026 (9L09-SESSIONS-FERMEES-REINITIALISATION).
 *
 * Ce module n'ouvre lui-même aucune session (voir l'en-tête de
 * `lib/auth/premier-acces.ts`) : « fermer les AUTRES » revient donc à fermer
 * TOUTES les sessions déjà ouvertes du compte. Compte SÉPARÉ de celui de
 * « premier accès » ci-dessus, pour ne pas dépendre de l'ordre dans lequel
 * son unique jeton est consommé par les scénarios précédents.
 */
describe("choisir un mot de passe par lien ferme les sessions déjà ouvertes", () => {
  // SA PROPRE SOCIÉTÉ — `ouvrirPremierCompte` n'ouvre que la PREMIÈRE
  // identité d'une société (amorçage) ; celle du bloc « premier accès »
  // ci-dessus porte déjà une habilitation.
  const SOCIETE_SESSIONS = uuidv7();
  const CODE_SESSIONS = `PREMACCS-${SOCIETE_SESSIONS.slice(0, 8)}`;
  const EMAIL_SESSIONS = `premier-acces-sessions-${SOCIETE_SESSIONS.slice(0, 8)}@example.test`;
  let utilisateurIdSessions = "";
  let jetonSessions = "";

  beforeAll(async () => {
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "societe" (id, code, raison_sociale, pays, territoire,
         fuseau_horaire, devise_code, majoration_hors_ouverture_pct, langue, actif)
       VALUES ($1::uuid, $2, $3, 'NC', 'NC', 'Pacific/Noumea', 'XPF', 0, 'fr', true)`,
      SOCIETE_SESSIONS,
      CODE_SESSIONS,
      `Société ${CODE_SESSIONS}`,
    );
    const ouverture = await ouvrirPremierCompte(clientApp(), {
      societeId: SOCIETE_SESSIONS,
      email: EMAIL_SESSIONS,
      nom: "Sessions fermées",
    });
    jetonSessions = jetonDe(ouverture.urlPremierAcces);
    const [ligne] = await clientOwner().$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "utilisateur" WHERE email = $1`,
      EMAIL_SESSIONS,
    );
    utilisateurIdSessions = ligne!.id;
  });

  async function poserSessionSessions(): Promise<void> {
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "session"
         (id, token, utilisateur_id, expire_le, cree_le, modifie_le)
       VALUES ($1::uuid, $2, $3::uuid, now() + interval '1 day', now(), now())`,
      uuidv7(),
      uuidv7(),
      utilisateurIdSessions,
    );
  }

  async function sessionsRestantesSessions(): Promise<number> {
    const lignes = await clientOwner().$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*)::bigint AS n FROM "session" WHERE utilisateur_id = $1::uuid`,
      utilisateurIdSessions,
    );
    return Number(lignes[0]?.n ?? 0);
  }

  it("ferme toutes les sessions déjà ouvertes une fois le mot de passe posé", async () => {
    await poserSessionSessions();
    await poserSessionSessions();
    expect(await sessionsRestantesSessions()).toBe(2);

    const issue = await choisirLePremierMotDePasse(
      {
        jeton: jetonSessions,
        motDePasse: CHOISI,
        confirmation: CHOISI,
      },
      creerAuth(clientApp()),
      clientApp(),
    );
    expect(issue.issue).toBe("abouti");

    // AUCUNE SESSION NE SURVIT — la politique `session_fermeture` ne
    // reconnaît plus ni jeton ni identité pour ces lignes.
    expect(await sessionsRestantesSessions()).toBe(0);
  });
});

/**
 * UN LIEN EXPIRÉ EST REFUSÉ — scénario manquant avant 9L09. La bibliothèque
 * (`consumeVerificationValue`, Better Auth) traite déjà une ligne passé son
 * `expiresAt` comme invalide : ce scénario le PROUVE plutôt que de le
 * supposer — une ligne insérée directement, déjà expirée à la naissance.
 */
describe("un lien EXPIRÉ est refusé — même motif qu'un jeton inconnu", () => {
  const JETON_EXPIRE = `expire-${uuidv7()}`;

  beforeAll(async () => {
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "verification" (id, identifiant, valeur, expire_le, cree_le, modifie_le)
       VALUES ($1::uuid, $2, $3, now() - interval '1 hour', now() - interval '2 hour', now() - interval '2 hour')`,
      uuidv7(),
      `reset-password:${JETON_EXPIRE}`,
      uuidv7(),
    );
  });

  it("refuse, comme un jeton qui n'a jamais été émis", async () => {
    const issue = await choisirLePremierMotDePasse(
      {
        jeton: JETON_EXPIRE,
        motDePasse: CHOISI,
        confirmation: CHOISI,
      },
      creerAuth(clientApp()),
      clientApp(),
    );
    expect(issue.issue).toBe("refuse");
  });
});
