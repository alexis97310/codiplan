import { createOTP } from "@better-auth/utils/otp";
import { base32 } from "@better-auth/utils/base32";
import { afterAll, describe, expect, it } from "vitest";

import {
  creerAuth,
  DUREE_VERROUILLAGE_SECONDES,
  SEUIL_ECHECS_SECOND_FACTEUR,
  SEUIL_ESCALADE_VERROUILLAGE,
} from "@/lib/auth/config";
import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { confirmerEnrolement, preparerEnrolement } from "@/lib/auth/enrolement";
import { avecDesignationAuth } from "@/lib/auth/lecture-identite";
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
 * LE PLANCHER DU SECOND FACTEUR (D62), ET LA PORTE DE SORTIE QU'IL N'AVAIT PAS.
 *
 * ## Ce que ce fichier éprouve, et pourquoi il existe
 *
 * Trois défauts, une seule cause. La bibliothèque lit une ligne par sa clé de
 * désignation puis **réécrit celle qu'elle vient d'obtenir en la nommant par son
 * `id`** — que l'enveloppe ne reconnaît pas. L'écriture partait donc sans
 * variable, la politique lisait une chaîne vide, et le refus était **silencieux**
 * : zéro ligne, aucune erreur.
 *
 *   1. le défi de second facteur ne se consommait jamais, si bien qu'un compte
 *      enrôlé **ne pouvait plus se connecter du tout** — même avec le bon code ;
 *   2. le code de secours échouait en `409` **après avoir été validé** ;
 *   3. le compteur d'échecs de D62 ne s'incrémentait jamais.
 *
 * ## Ce qu'il exige, et dans les deux sens
 *
 * Chaque garantie porte son **jumeau** (§9, 24/08) : le report retiré, la
 * connexion cesse ; la moitié « appartenance » de la politique retirée, la ligne
 * d'autrui devient atteignable ; le déclencheur retiré, la série de
 * verrouillages ne s'accumule plus.
 *
 * **Et le compteur est mesuré EN ESSAYANT, jamais sous RLS levée** : on présente
 * des codes faux jusqu'à ce que la porte se ferme, et on compte.
 */

const MOT_DE_PASSE = "mot-de-passe-de-test-suffisamment-long";

const auth = creerAuth(clientApp());

afterAll(fermerClients);

/** Ce qu'un compte enrôlé porte, une fois le parcours terminé. */
type CompteEnrole = {
  email: string;
  utilisateurId: string;
  secondFacteurId: string;
  /** Le secret BRUT — la bibliothèque calcule dessus, pas sur sa forme base32. */
  secret: string;
  codesSecours: readonly string[];
};

async function ouvrirCompte(etiquette: string): Promise<string> {
  const email = `plancher-${etiquette}-${uuidv7().slice(0, 8)}@iso.test`;
  const cree = await creerAuth(clientApp(), {
    societeId: SOCIETE_A,
    role: Role.admin_societe,
  }).api.signUpEmail({
    body: { email, password: MOT_DE_PASSE, name: `Plancher ${etiquette}` },
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

function cookiesDe(reponse: Response): string {
  return (reponse.headers.getSetCookie?.() ?? [])
    .map((entete) => entete.split(";")[0])
    .join("; ");
}

/** Ouvre un compte et l'enrôle réellement — les deux drapeaux posés en base. */
async function compteEnrole(etiquette: string): Promise<CompteEnrole> {
  const email = await ouvrirCompte(etiquette);
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

  const proprietaire = observerSousProprietaire(
    "le plancher se constate sur la LIGNE : l'identifiant de second_facteur et " +
      "ses compteurs ne sont lisibles par le rôle applicatif que sous une " +
      "désignation, or l'épreuve doit les observer sans en poser une",
  );
  const [ligne] = await proprietaire.$queryRawUnsafe<
    { id: string; utilisateur_id: string }[]
  >(
    `SELECT "sf"."id", "sf"."utilisateur_id"
       FROM "second_facteur" "sf"
       JOIN "utilisateur" "u" ON "u"."id" = "sf"."utilisateur_id"
      WHERE "u"."email" = $1`,
    email,
  );
  return {
    email,
    utilisateurId: ligne!.utilisateur_id,
    secondFacteurId: ligne!.id,
    secret,
    codesSecours: preparation.codesSecours,
  };
}

async function codeCourant(secret: string): Promise<string> {
  return createOTP(secret, { digits: 6, period: 30 }).totp();
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

/** Présente un code dans un échange, comme la route `/api/session/code` le fait. */
async function presenter(entetes: Headers, code: string): Promise<number> {
  const reponse = await dansUnEchangeAuth(() =>
    auth.api.verifyTOTP({
      body: { code },
      headers: entetes,
      asResponse: true,
    }),
  );
  return reponse.status;
}

/** L'état des compteurs, lu sous le propriétaire. */
async function compteurs(utilisateurId: string): Promise<{
  echecs: number;
  verrouilleJusquA: Date | null;
  verrouillages: number;
}> {
  const proprietaire = observerSousProprietaire(
    "les compteurs de second_facteur ne sont pas lisibles sans désignation ; " +
      "l'épreuve doit les observer sans en poser une, sinon elle mesurerait " +
      "sa propre pose plutôt que l'effet du chemin de vérification",
  );
  const [ligne] = await proprietaire.$queryRawUnsafe<
    {
      echecs_verification: number;
      verrouille_jusqu_a: Date | null;
      verrouillages_consecutifs: number;
    }[]
  >(
    `SELECT "echecs_verification", "verrouille_jusqu_a", "verrouillages_consecutifs"
       FROM "second_facteur" WHERE "utilisateur_id" = $1::uuid`,
    utilisateurId,
  );
  return {
    echecs: ligne!.echecs_verification,
    verrouilleJusquA: ligne!.verrouille_jusqu_a,
    verrouillages: ligne!.verrouillages_consecutifs,
  };
}

/** La sentinelle, LUE EN BASE — jamais recopiée en TypeScript. */
async function sentinelle(): Promise<Date> {
  const proprietaire = observerSousProprietaire(
    "la sentinelle est définie par une fonction SQL ; la recopier ici serait " +
      "une seconde source du même fait, et les deux pourraient diverger",
  );
  const [ligne] = await proprietaire.$queryRawUnsafe<{ v: Date }[]>(
    `SELECT "second_facteur_sentinelle_verrouillage"() AS v`,
  );
  return ligne!.v;
}

/** Fait comme si le verrouillage temporaire avait expiré. */
async function faireExpirerLeVerrou(utilisateurId: string): Promise<void> {
  const proprietaire = observerSousProprietaire(
    "l'écoulement de quinze minutes ne se simule pas depuis le rôle applicatif " +
      "— seul le propriétaire peut reculer la date sans passer par le chemin " +
      "de vérification, qui est justement ce que l'épreuve mesure",
  );
  await proprietaire.$executeRawUnsafe(
    `UPDATE "second_facteur" SET "verrouille_jusqu_a" = now() - interval '1 minute'
      WHERE "utilisateur_id" = $1::uuid`,
    utilisateurId,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
describe("LA PORTE DE SORTIE — un compte enrôlé doit pouvoir entrer", () => {
  it("le bon code ouvre une session — c'est ce qui ne marchait pas du tout", async () => {
    const compte = await compteEnrole("totp");
    const entetes = await defi(compte.email);

    const statut = await presenter(entetes, await codeCourant(compte.secret));
    expect(
      statut,
      "un compte enrôlé présente le BON code et n'entre pas : la consommation " +
        "du défi est refusée en silence, et le cliquet interdit de revenir en " +
        "arrière — le compte est enfermé.",
    ).toBe(200);
  });

  it("LE CODE DE SECOURS ouvre une session — il rendait 409 après avoir été validé", async () => {
    const compte = await compteEnrole("secours");
    const entetes = await defi(compte.email);

    const reponse = await dansUnEchangeAuth(() =>
      auth.api.verifyBackupCode({
        body: { code: compte.codesSecours[0] ?? "" },
        headers: entetes,
        asResponse: true,
      }),
    );
    expect(
      reponse.status,
      "le code de secours est validé puis l'écriture qui le consomme est " +
        "refusée : un cliquet qui condamne aussi l'issue de secours n'est pas " +
        "un cliquet, c'est un enfermement.",
    ).toBe(200);
  });

  it("JUMEAU — sans échange ouvert, le report disparaît et le défaut revient", async () => {
    // Le jumeau vise LE verrou en cause : le report, pas la politique. Une
    // route qui oublierait d'ouvrir l'échange retomberait exactement ici.
    const compte = await compteEnrole("jumeau-report");
    const entetes = await defi(compte.email);

    const reponse = await auth.api.verifyTOTP({
      body: { code: await codeCourant(compte.secret) },
      headers: entetes,
      asResponse: true,
    });
    const corps = await reponse.text();
    expect(reponse.status).toBe(401);
    expect(corps).toContain("INVALID_TWO_FACTOR_COOKIE");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("LA COMPOSITION — l'id dit QUELLE ligne, la politique dit à QUI", () => {
  it("un id valide appartenant à un AUTRE compte est refusé", async () => {
    const victime = await compteEnrole("victime");
    const attaquant = await compteEnrole("attaquant");

    // L'attaquant est authentifié : sa propre désignation est posée, et il
    // nomme la ligne d'autrui par un `id` qu'il aurait tiré d'une trace.
    const ecrites = await clientApp().$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        "SELECT set_config('app.authentification_utilisateur_id', $1, true)",
        attaquant.utilisateurId,
      );
      return tx.$executeRawUnsafe(
        `UPDATE "second_facteur" SET "echecs_verification" = 99 WHERE "id" = $1::uuid`,
        victime.secondFacteurId,
      );
    });
    expect(
      ecrites,
      "un `id` rejoué, venu d'un autre compte, a atteint la ligne : la " +
        "composition ne tient pas, et reprendre le facteur d'autrui devient " +
        "possible.",
    ).toBe(0);

    // TÉMOIN DE NON-VACUITÉ : la même écriture SUR SA PROPRE ligne passe.
    const siennes = await clientApp().$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        "SELECT set_config('app.authentification_utilisateur_id', $1, true)",
        attaquant.utilisateurId,
      );
      return tx.$executeRawUnsafe(
        `UPDATE "second_facteur" SET "echecs_verification" = 1 WHERE "id" = $1::uuid`,
        attaquant.secondFacteurId,
      );
    });
    expect(siennes).toBe(1);
  });

  it("JUMEAU — retirez la moitié « appartenance », et la ligne d'autrui s'atteint", async () => {
    const victime = await compteEnrole("jumeau-victime");
    const attaquant = await compteEnrole("jumeau-attaquant");

    const ecrites = await clientOwner()
      .$transaction(async (tx) => {
        // ── LES DEUX MOITIÉS, ET C'EST LA LEÇON DU JUMEAU ────────────────
        //
        // Retirer la seule politique d'UPDATE ne suffit pas, et l'avoir cru a
        // fait tomber ce jumeau la première fois : **PostgreSQL applique les
        // politiques de SELECT au `WHERE` d'un UPDATE.** L'appartenance est
        // donc exigée DEUX fois — une fois pour trouver la ligne, une fois
        // pour l'écrire — et un jumeau qui n'en retire qu'une mesure le refus
        // du voisin plutôt que celui qu'il vise (§9, 24/08).
        //
        // La garantie en sort plus forte qu'annoncé, et c'est écrit ici parce
        // que c'est la mesure qui l'a montré, pas la relecture.
        await tx.$executeRawUnsafe(
          `DROP POLICY "second_facteur_modification" ON "second_facteur"`,
        );
        await tx.$executeRawUnsafe(
          `DROP POLICY "second_facteur_lecture" ON "second_facteur"`,
        );
        // La faute telle qu'un correcteur bien intentionné l'écrirait : « la
        // désignation par id suffit, le where dit déjà quelle ligne ».
        await tx.$executeRawUnsafe(
          `CREATE POLICY "jumeau_sans_appartenance_lecture" ON "second_facteur"
             FOR SELECT USING (true)`,
        );
        await tx.$executeRawUnsafe(
          `CREATE POLICY "jumeau_sans_appartenance" ON "second_facteur"
             FOR UPDATE USING (true) WITH CHECK (true)`,
        );
        await tx.$executeRawUnsafe(`SET LOCAL ROLE "${ROLE_APP}"`);
        await tx.$executeRawUnsafe(
          "SELECT set_config('app.authentification_utilisateur_id', $1, true)",
          attaquant.utilisateurId,
        );
        const n = await tx.$executeRawUnsafe(
          `UPDATE "second_facteur" SET "echecs_verification" = 99 WHERE "id" = $1::uuid`,
          victime.secondFacteurId,
        );
        throw new Annulation(String(n));
      })
      .catch((erreur: unknown) =>
        erreur instanceof Annulation ? Number(erreur.message) : -1,
      );

    // La violation a bien eu lieu : sans ce décompte, le jumeau serait creux.
    expect(ecrites).toBe(1);

    // Et la transaction annulée n'a rien laissé derrière elle.
    const [politiques] = await clientOwner().$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM pg_policies
        WHERE tablename = 'second_facteur'
          AND policyname IN ('second_facteur_modification', 'second_facteur_lecture')`,
    );
    expect(Number(politiques?.n)).toBe(2);
  });

  it("L'ID N'OUVRE PAS LES LECTURES — le report ne vaut que pour les écritures", async () => {
    const victime = await compteEnrole("lecture-victime");
    const lecteur = await compteEnrole("lecture-lecteur");

    const volee = await dansUnEchangeAuth(async () => {
      const client = avecDesignationAuth(clientApp());
      // Le lecteur se désigne d'abord : l'échange retient son compte.
      await client.secondFacteur.findFirst({
        where: { utilisateur_id: lecteur.utilisateurId },
      });
      // Puis il tente de LIRE la ligne d'autrui par son identifiant.
      return client.secondFacteur.findFirst({
        where: { id: victime.secondFacteurId },
      });
    });
    expect(
      volee,
      "une lecture par `id` a rendu une ligne : l'arbitrage du 08/09 dit que " +
        "l'id ouvre les écritures et jamais les lectures.",
    ).toBeNull();

    // TÉMOIN DE NON-VACUITÉ : la ligne de la victime EXISTE et se lit sous SA
    // propre désignation. Sans lui, « null » ne distinguerait pas « masquée »
    // de « inexistante ».
    const sienne = await dansUnEchangeAuth(() =>
      avecDesignationAuth(clientApp()).secondFacteur.findFirst({
        where: { utilisateur_id: victime.utilisateurId },
      }),
    );
    expect(sienne).not.toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("LE COMPTEUR — mesuré EN ESSAYANT, jamais sous RLS levée", () => {
  it("compte les codes faux réellement comparés avant que la porte se ferme", async () => {
    const compte = await compteEnrole("compteur");

    let comparés = 0;
    let statutFermeture = 0;
    // Assez de défis pour dépasser largement le seuil : la boucle doit
    // s'arrêter parce que le SYSTÈME refuse, jamais parce qu'elle s'épuise.
    for (let d = 0; d < SEUIL_ECHECS_SECOND_FACTEUR + 5; d += 1) {
      const entetes = await defi(compte.email);
      let defiEpuise = false;
      for (let i = 0; i < 6 && !defiEpuise; i += 1) {
        const statut = await presenter(entetes, "000000");
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
      "aucun verrouillage n'est jamais survenu : le compteur est inerte, et " +
        "un code à six chiffres se devine.",
    ).toBe(429);
    expect(comparés).toBe(SEUIL_ECHECS_SECOND_FACTEUR);

    const etat = await compteurs(compte.utilisateurId);
    expect(etat.echecs).toBeGreaterThanOrEqual(SEUIL_ECHECS_SECOND_FACTEUR);
    expect(etat.verrouilleJusquA).not.toBeNull();
    expect(etat.verrouillages).toBe(1);

    // La durée est celle qui a été arbitrée, à la seconde de vol près.
    const restant = (etat.verrouilleJusquA!.getTime() - Date.now()) / 1000;
    expect(restant).toBeGreaterThan(DUREE_VERROUILLAGE_SECONDES - 120);
    expect(restant).toBeLessThanOrEqual(DUREE_VERROUILLAGE_SECONDES);
  }, 180000);

  it("CONTRE-ÉPREUVE — le compteur retiré, la faute revient", async () => {
    // LE JUMEAU DU COMPTEUR, et il vise LE verrou en cause. Le compteur ne
    // fonctionne que parce que l'écriture par `id` atteint désormais la ligne.
    // On retire la politique qui l'autorise — la faute telle qu'elle existait
    // avant ce ticket — et on montre que les codes faux ne sont plus jamais
    // comptés, donc jamais bornés.
    //
    // Le DDL est COMMIS, faute de quoi les appels d'authentification, qui
    // ouvrent leurs propres transactions, ne le verraient pas. Il est rendu
    // dans le `finally`, et l'épreuve vérifie ensuite qu'il l'a bien été.
    const compte = await compteEnrole("contre-epreuve");
    let comparés = 0;
    let verrouillé = false;
    try {
      await clientOwner().$executeRawUnsafe(
        `DROP POLICY "second_facteur_modification" ON "second_facteur"`,
      );
      for (let d = 0; d < 5; d += 1) {
        const entetes = await defi(compte.email);
        for (let i = 0; i < 6; i += 1) {
          const statut = await presenter(entetes, "000000");
          if (statut === 401) comparés += 1;
          else if (statut === 429) verrouillé = true;
          else break;
        }
        if (verrouillé) break;
      }
    } finally {
      await clientOwner().$executeRawUnsafe(
        `CREATE POLICY "second_facteur_modification" ON "second_facteur"
           FOR UPDATE
           USING (
             "utilisateur_id" = NULLIF(current_setting('app.authentification_utilisateur_id', true), '')::uuid
             OR "utilisateur_id" = NULLIF(current_setting('app.utilisateur_id', true), '')::uuid
           )
           WITH CHECK (
             "utilisateur_id" = NULLIF(current_setting('app.authentification_utilisateur_id', true), '')::uuid
             OR "utilisateur_id" = NULLIF(current_setting('app.utilisateur_id', true), '')::uuid
           )`,
      );
    }

    // LA VIOLATION A BIEN EU LIEU : des codes ont été comparés, bien au-delà du
    // seuil, et la porte ne s'est jamais fermée.
    expect(comparés).toBeGreaterThan(SEUIL_ECHECS_SECOND_FACTEUR);
    expect(verrouillé).toBe(false);
    expect((await compteurs(compte.utilisateurId)).echecs).toBe(0);

    // Et la politique est bien revenue.
    const [politique] = await clientOwner().$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM pg_policies
        WHERE tablename = 'second_facteur' AND policyname = 'second_facteur_modification'`,
    );
    expect(Number(politique?.n)).toBe(1);
  }, 300000);
});

// ═══════════════════════════════════════════════════════════════════════════
describe("L'ESCALADE — trois verrouillages enchaînés, et la porte cesse de s'ouvrir", () => {
  /** Épuise le budget d'échecs jusqu'au verrouillage suivant. */
  async function jusquAuVerrou(compte: CompteEnrole): Promise<void> {
    for (let d = 0; d < 6; d += 1) {
      const entetes = await defi(compte.email);
      for (let i = 0; i < 6; i += 1) {
        const statut = await presenter(entetes, "000000");
        if (statut !== 401) break;
      }
      const etat = await compteurs(compte.utilisateurId);
      if (
        etat.verrouilleJusquA !== null &&
        etat.verrouilleJusquA > new Date()
      ) {
        return;
      }
    }
    throw new Error("le verrouillage n'est jamais survenu");
  }

  it("la purge d'un verrou expiré ne rompt PAS la série ; une connexion réussie, si", async () => {
    const compte = await compteEnrole("serie");

    await jusquAuVerrou(compte);
    expect((await compteurs(compte.utilisateurId)).verrouillages).toBe(1);

    // Quinze minutes passent. La bibliothèque purge le verrou expiré au
    // prochain essai — et c'est LE point délicat : cette purge écrit
    // exactement la même ligne qu'une remise à zéro après succès.
    await faireExpirerLeVerrou(compte.utilisateurId);
    const entetes = await defi(compte.email);
    expect(await presenter(entetes, "000000")).toBe(401);

    const apresPurge = await compteurs(compte.utilisateurId);
    expect(
      apresPurge.verrouillages,
      "la purge d'un verrou expiré a remis la série à zéro : l'escalade ne se " +
        "déclencherait jamais, et la garantie serait verte sans rien garder.",
    ).toBe(1);

    // Une CONNEXION RÉUSSIE, elle, rompt la série.
    const bon = await defi(compte.email);
    expect(await presenter(bon, await codeCourant(compte.secret))).toBe(200);
    expect((await compteurs(compte.utilisateurId)).verrouillages).toBe(0);
  }, 300000);

  it("au troisième verrouillage enchaîné, la date d'expiration devient la sentinelle", async () => {
    const compte = await compteEnrole("escalade");

    for (let n = 1; n <= SEUIL_ESCALADE_VERROUILLAGE; n += 1) {
      await jusquAuVerrou(compte);
      expect((await compteurs(compte.utilisateurId)).verrouillages).toBe(n);
      if (n < SEUIL_ESCALADE_VERROUILLAGE) {
        await faireExpirerLeVerrou(compte.utilisateurId);
      }
    }

    const etat = await compteurs(compte.utilisateurId);
    expect(etat.verrouillages).toBe(SEUIL_ESCALADE_VERROUILLAGE);
    expect(etat.verrouilleJusquA!.getTime()).toBe(
      (await sentinelle()).getTime(),
    );

    // ET LA PORTE RESTE FERMÉE : le verrouillage n'expire plus de lui-même.
    const entetes = await defi(compte.email);
    expect(await presenter(entetes, await codeCourant(compte.secret))).toBe(
      429,
    );
  }, 420000);

  it("JUMEAU — retirez le déclencheur, et la série ne s'accumule plus", async () => {
    const compte = await compteEnrole("jumeau-escalade");

    const compteur = await clientOwner()
      .$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `DROP TRIGGER "second_facteur_escalade" ON "second_facteur"`,
        );
        await tx.$executeRawUnsafe(`SET LOCAL ROLE "${ROLE_APP}"`);
        await tx.$executeRawUnsafe(
          "SELECT set_config('app.authentification_utilisateur_id', $1, true)",
          compte.utilisateurId,
        );
        // La même écriture que celle que la bibliothèque émet en verrouillant.
        await tx.$executeRawUnsafe(
          `UPDATE "second_facteur"
              SET "verrouille_jusqu_a" = now() + interval '15 minutes'
            WHERE "id" = $1::uuid`,
          compte.secondFacteurId,
        );
        const [ligne] = await tx.$queryRawUnsafe<
          { verrouillages_consecutifs: number }[]
        >(
          `SELECT "verrouillages_consecutifs" FROM "second_facteur" WHERE "id" = $1::uuid`,
          compte.secondFacteurId,
        );
        throw new Annulation(String(ligne!.verrouillages_consecutifs));
      })
      .catch((erreur: unknown) =>
        erreur instanceof Annulation ? Number(erreur.message) : -1,
      );

    // Sans le déclencheur, le verrouillage est posé et n'est PAS compté.
    expect(compteur).toBe(0);

    // Et le déclencheur est bien revenu au ROLLBACK.
    const [present] = await clientOwner().$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM pg_trigger
        WHERE tgname = 'second_facteur_escalade' AND NOT tgisinternal`,
    );
    expect(Number(present?.n)).toBe(1);
  }, 120000);

  it("la colonne n'est PAS à l'appelant — même désigné, il ne la pose pas", async () => {
    const compte = await compteEnrole("colonne");

    await clientApp().$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        "SELECT set_config('app.authentification_utilisateur_id', $1, true)",
        compte.utilisateurId,
      );
      await tx.$executeRawUnsafe(
        `UPDATE "second_facteur" SET "verrouillages_consecutifs" = 0 WHERE "id" = $1::uuid`,
        compte.secondFacteurId,
      );
    });
    // Rien n'a bougé : elle valait déjà zéro. On la porte d'abord à un, par le
    // seul chemin qui le peut, puis on retente.
    await jusquAuVerrou(compte);
    expect((await compteurs(compte.utilisateurId)).verrouillages).toBe(1);

    await clientApp().$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        "SELECT set_config('app.authentification_utilisateur_id', $1, true)",
        compte.utilisateurId,
      );
      await tx.$executeRawUnsafe(
        `UPDATE "second_facteur" SET "verrouillages_consecutifs" = 0 WHERE "id" = $1::uuid`,
        compte.secondFacteurId,
      );
    });
    expect(
      (await compteurs(compte.utilisateurId)).verrouillages,
      "le sujet a remis sa propre série à zéro : le compteur et le " +
        "verrouillage gouvernent l'accès, et D58 les lui refuse.",
    ).toBe(1);
  }, 300000);
});
