import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ouvrirPremierCompte, RefusAmorcage } from "@/lib/auth/amorcage";
import { creerAuth } from "@/lib/auth/config";
import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { Role } from "@/lib/auth/roles";
import { avecSociete } from "@/lib/db/rls";
import { uuidv7 } from "@/lib/db/uuid";

import {
  clientApp,
  clientOwner,
  fermerClients,
  observerSousProprietaire,
} from "./setup/db";
import "./setup/env";

/**
 * LE GESTE D'OUVERTURE DU PREMIER COMPTE — Q1 / D65 (ticket L1-02h).
 *
 * ## Ce qui est éprouvé, et dans quel ordre
 *
 * La branche d'amorçage de `utilisateur_ouverture` est un **CLIQUET** : elle
 * admet l'ouverture d'une identité sans rôle qui administre **tant que la
 * société ne porte aucune habilitation**, et l'acte la referme. Ce qu'il faut
 * mesurer n'est donc pas « deux situations qui se ressemblent » mais **la même
 * société avant et après** : le refus se mesure APRÈS un premier passage
 * réussi, jamais sur une société fabriquée à part.
 *
 * ## Ce qui rend ces mesures lisibles
 *
 * — un **témoin préalable** : la politique est bien en vigueur, les deux
 *   drapeaux, et elle mord (zéro ligne sans contexte). Sans lui, une base
 *   reconstruite entre-temps rendrait un vert qui ne parle de rien (§9, 07/09) ;
 * — les sondes d'insertion passent par du **SQL brut sans `RETURNING`**. Ce
 *   n'est pas un détail de style : Prisma émet `INSERT … RETURNING`, et
 *   PostgreSQL soumet le `RETURNING` à la politique de LECTURE. Une identité
 *   toute neuve n'est désignée par rien : la sonde échouerait sur
 *   `utilisateur_lecture` et **le refus viendrait du voisin**, pas du verrou
 *   visé (§9, 24/08 et 08/09).
 */

afterAll(fermerClients);

/** Une société VIERGE, créée pour ce fichier. Aucune habilitation. */
const SOCIETE_VIERGE = uuidv7();
const CODE_VIERGE = `AMOR-${SOCIETE_VIERGE.slice(0, 8)}`;

/** Une seconde société vierge : les épreuves qui consomment le cliquet. */
const SOCIETE_VIERGE_2 = uuidv7();
const CODE_VIERGE_2 = `AMOR2-${SOCIETE_VIERGE_2.slice(0, 8)}`;

const courriel = (quoi: string): string =>
  `amorcage-${quoi}-${SOCIETE_VIERGE.slice(0, 8)}@example.test`;

async function creerSocieteVierge(id: string, code: string): Promise<void> {
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "societe" (id, code, raison_sociale, pays, territoire,
       fuseau_horaire, devise_code, taux_horaire_defaut,
       majoration_hors_ouverture_pct, langue, actif)
     VALUES ($1::uuid, $2, $3, 'NC', 'NC', 'Pacific/Noumea', 'XPF',
             0, 0, 'fr', true)`,
    id,
    code,
    `Société vierge ${code}`,
  );
}

beforeAll(async () => {
  await creerSocieteVierge(SOCIETE_VIERGE, CODE_VIERGE);
  await creerSocieteVierge(SOCIETE_VIERGE_2, CODE_VIERGE_2);
});

/**
 * Tente d'insérer une identité SOUS LE RÔLE APPLICATIF, dans un contexte de
 * société sans rôle, en SQL brut et sans `RETURNING`.
 *
 * Rend `true` si la base accepte. C'est la sonde de la branche d'amorçage, et
 * d'elle seule.
 */
async function labaseAccepteUneIdentite(
  societeId: string,
  email: string,
  tx?: { $executeRawUnsafe: (sql: string, ...p: unknown[]) => Promise<number> },
): Promise<boolean> {
  const inserer = async (executeur: {
    $executeRawUnsafe: (sql: string, ...p: unknown[]) => Promise<number>;
  }): Promise<boolean> => {
    try {
      await executeur.$executeRawUnsafe(
        `INSERT INTO "utilisateur" (id, nom, email, modifie_le)
         VALUES ($1::uuid, $2, $3, now())`,
        uuidv7(),
        "sonde",
        email,
      );
      return true;
    } catch {
      return false;
    }
  };

  if (tx !== undefined) {
    return inserer(tx);
  }
  return avecSociete(clientApp(), societeId, (t) =>
    inserer(t as unknown as Parameters<typeof inserer>[0]),
  );
}

describe("témoin préalable — la politique est en vigueur, et elle mord", () => {
  it("les DEUX drapeaux, jamais un seul", async () => {
    const [ligne] = await observerSousProprietaire(
      "les drapeaux RLS sont un attribut du catalogue : le rôle applicatif ne " +
        "peut pas les lire pour ce qu'ils sont, et FORCE ne concerne que le " +
        "propriétaire (§9, 31/08).",
    ).$queryRawUnsafe<{ enable: boolean; force: boolean }[]>(
      `SELECT relrowsecurity AS enable, relforcerowsecurity AS force
         FROM pg_class WHERE relname = 'utilisateur'`,
    );
    expect(ligne?.enable).toBe(true);
    expect(ligne?.force).toBe(true);
  });

  it("sans contexte, le rôle applicatif ne lit aucune identité", async () => {
    const lignes = await clientApp().$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM "utilisateur"`,
    );
    expect(lignes[0]?.n).toBe(0);
    // TÉMOIN : il y a bien des identités à cacher.
    const [reel] = await observerSousProprietaire(
      "le décompte total des identités n'est pas atteignable sous le rôle " +
        "applicatif : c'est précisément ce que la politique retire.",
    ).$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM "utilisateur"`,
    );
    expect(reel?.n).toBeGreaterThan(0);
  });
});

describe("la branche d'amorçage — ce qu'elle ouvre, et ce qu'elle referme", () => {
  it("société VIERGE : la base accepte une identité sans rôle qui administre", async () => {
    expect(
      await labaseAccepteUneIdentite(SOCIETE_VIERGE_2, courriel("sonde-avant")),
    ).toBe(true);
  });

  it("UNE habilitation posée, la MÊME insertion est refusée", async () => {
    // On referme la porte sur la société qu'on vient d'ouvrir — c'est le
    // cliquet qu'on éprouve, pas deux sociétés qui se ressemblent.
    const identite = await clientOwner().$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "utilisateur" WHERE email = $1`,
      courriel("sonde-avant"),
    );
    await avecSociete(clientApp(), SOCIETE_VIERGE_2, (tx) =>
      tx.utilisateurSociete.create({
        data: {
          id: uuidv7(),
          utilisateur_id: identite[0]!.id,
          societe_id: SOCIETE_VIERGE_2,
          role: Role.admin_societe,
        },
      }),
    );

    expect(
      await labaseAccepteUneIdentite(SOCIETE_VIERGE_2, courriel("sonde-apres")),
    ).toBe(false);
  });

  it("JUMEAU — la BRANCHE retirée, la société vierge est refusée à son tour", async () => {
    // Le verrou visé est ici la branche elle-même : on remet la politique dans
    // l'état d'avant Q1 — société active ET rôle qui administre — et l'on
    // regarde si l'ouverture qui vient de PASSER est alors refusée. Sans cette
    // épreuve, rien ne dirait que c'est la branche qui l'a laissée passer.
    const societe = uuidv7();
    await creerSocieteVierge(societe, `AMORJ-${societe.slice(0, 8)}`);

    let passeSansLaBranche = true;
    await clientOwner()
      .$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `DROP POLICY "utilisateur_ouverture" ON "utilisateur"`,
        );
        await tx.$executeRawUnsafe(
          `CREATE POLICY "utilisateur_ouverture" ON "utilisateur"
             FOR INSERT WITH CHECK (
               NULLIF(current_setting('app.societe_id', true), '') IS NOT NULL
               AND "app_peut_administrer_identites"()
             )`,
        );
        await tx.$executeRawUnsafe(`SET LOCAL ROLE codiplan_app`);
        await tx.$executeRawUnsafe(
          "SELECT set_config('app.societe_id', $1, true)",
          societe,
        );
        passeSansLaBranche = await labaseAccepteUneIdentite(
          societe,
          courriel("jumeau-branche"),
          tx as unknown as {
            $executeRawUnsafe: (
              sql: string,
              ...p: unknown[]
            ) => Promise<number>;
          },
        );
        throw new Error("rollback voulu");
      })
      .catch((e: unknown) => {
        if ((e as Error).message !== "rollback voulu") {
          throw e;
        }
      });

    expect(passeSansLaBranche).toBe(false);
    // TÉMOIN : la MÊME société, la branche rendue, accepte.
    expect(
      await labaseAccepteUneIdentite(societe, courriel("temoin-branche")),
    ).toBe(true);
  });

  it("JUMEAU — la fonction du cliquet rendue toujours vraie, l'insertion repasse", async () => {
    // Le verrou VISÉ, et pas un voisin : on ne touche ni à la politique de
    // lecture, ni à `app_peut_administrer_identites()`. La transaction est
    // annulée — le DDL est transactionnel en PostgreSQL, et le verrou revient.
    let repasse = false;
    await clientOwner()
      .$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `CREATE OR REPLACE FUNCTION "app_societe_active_vierge"()
             RETURNS boolean LANGUAGE sql STABLE
             SET search_path = pg_catalog, public
             AS $$ SELECT true $$`,
        );
        // La sonde doit tourner sous le rôle APPLICATIF, sur une autre
        // connexion : elle ne verrait pas le DDL d'une transaction ouverte.
        // On la fait donc voir en validant… ce qu'on ne veut pas. La mesure se
        // fait donc ici, sous le propriétaire, en FORÇANT la soumission aux
        // politiques.
        await tx.$executeRawUnsafe(`SET LOCAL ROLE codiplan_app`);
        await tx.$executeRawUnsafe(
          "SELECT set_config('app.societe_id', $1, true)",
          SOCIETE_VIERGE_2,
        );
        repasse = await labaseAccepteUneIdentite(
          SOCIETE_VIERGE_2,
          courriel("jumeau"),
          tx as unknown as {
            $executeRawUnsafe: (
              sql: string,
              ...p: unknown[]
            ) => Promise<number>;
          },
        );
        throw new Error("rollback voulu");
      })
      .catch((e: unknown) => {
        if ((e as Error).message !== "rollback voulu") {
          throw e;
        }
      });

    expect(repasse).toBe(true);
  });
});

describe("le geste complet", () => {
  it("ouvre la première identité, l'habilite, ne laisse aucune session, et trace", async () => {
    const email = courriel("geste");
    const ouverture = await ouvrirPremierCompte(clientApp(), {
      societeId: SOCIETE_VIERGE,
      email,
      nom: "Amorçage CODIMA",
    });

    expect(ouverture.role).toBe(Role.admin_societe);
    // Le jeton est un SEGMENT DE CHEMIN, pas un paramètre de requête — mesuré :
    // `/reset-password/<jeton>?callbackURL=…`. Écrit ici parce qu'un scénario
    // qui chercherait `token=` passerait au vert sur une URL sans jeton.
    expect(ouverture.urlPremierAcces).toMatch(/\/reset-password\/[^/?]{16,}/);

    // D2 — `signUpEmail` OUVRE une session ; le geste la referme.
    expect(ouverture.sessionsRefermees).toBe(1);
    const [sessions] = await observerSousProprietaire(
      "le décompte des sessions d'une identité n'est pas lisible sous le rôle " +
        "applicatif : `session` ne se lit que par son JETON (L1-02d).",
    ).$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM "session" WHERE utilisateur_id = $1::uuid`,
      ouverture.utilisateurId,
    );
    expect(sessions?.n).toBe(0);

    // L'habilitation existe, et c'est elle qui a refermé la porte.
    const habilitations = await avecSociete(clientApp(), SOCIETE_VIERGE, (tx) =>
      tx.utilisateurSociete.findMany({
        where: { societe_id: SOCIETE_VIERGE },
        select: { role: true, utilisateur_id: true },
      }),
    );
    expect(habilitations).toEqual([
      { role: Role.admin_societe, utilisateur_id: ouverture.utilisateurId },
    ]);

    // La trace est un ÉVÉNEMENT D'ACCÈS, jamais une ligne de journal d'audit :
    // une identité n'appartient à aucune société, et `journal_audit` est
    // cloisonné par société et partitionné.
    const [acces] = await observerSousProprietaire(
      "`journal_acces` n'est lisible que sous désignation de l'utilisateur " +
        "(L1-02d) ; on l'observe ici pour ce qu'elle porte, pas pour la lire.",
    ).$queryRawUnsafe<{ evenement: string; detail: string; cible: string }[]>(
      `SELECT evenement::text, detail, societe_id_cible::text AS cible
         FROM "journal_acces" WHERE utilisateur_id = $1::uuid`,
      ouverture.utilisateurId,
    );
    expect(acces?.evenement).toBe("ouverture_identite");
    expect(acces?.cible).toBe(SOCIETE_VIERGE);
    expect(acces?.detail).toContain("amorçage");

    // AUCUNE ligne d'audit métier pour cette identité : le périmètre inversé de
    // D55 ne couvre pas `utilisateur`, et c'est délibéré.
    const [audit] = await observerSousProprietaire(
      "`journal_audit` est en ajout seul et cloisonné : on vérifie ici une " +
        "ABSENCE, ce qu'une lecture applicative ne pourrait pas distinguer " +
        "d'un refus.",
    ).$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM "journal_audit" WHERE "entite" = 'utilisateur'`,
    );
    expect(audit?.n).toBe(0);
  });

  it("le second appel sur la MÊME société est refusé, lisiblement", async () => {
    await expect(
      ouvrirPremierCompte(clientApp(), {
        societeId: SOCIETE_VIERGE,
        email: courriel("second"),
        nom: "Deuxième",
      }),
    ).rejects.toBeInstanceOf(RefusAmorcage);
  });

  it("une société qui n'existe pas est refusée sans rien apprendre d'autre", async () => {
    await expect(
      ouvrirPremierCompte(clientApp(), {
        societeId: uuidv7(),
        email: courriel("fantome"),
        nom: "Fantôme",
      }),
    ).rejects.toBeInstanceOf(RefusAmorcage);
  });
});

describe("le jeton de premier accès", () => {
  it("est à usage unique, et il ouvre réellement le compte", async () => {
    const email = courriel("jeton");
    const societe = uuidv7();
    await creerSocieteVierge(societe, `AMOR3-${societe.slice(0, 8)}`);

    const ouverture = await ouvrirPremierCompte(clientApp(), {
      societeId: societe,
      email,
      nom: "Premier accès",
    });
    const jeton = new URL(
      ouverture.urlPremierAcces,
      "http://amorcage.invalid",
    ).pathname
      .split("/")
      .pop();
    expect(jeton).toBeTruthy();
    expect(jeton!.length).toBeGreaterThan(16);

    // La CONSOMMATION se fait sur l'instance de PRODUCTION — celle qui ne porte
    // aucun canal de remise, et ne peut donc émettre aucun jeton.
    //
    // **L'ÉCHANGE EST OBLIGATOIRE ICI, ET C'EST MESURÉ.** `resetPassword` LIT
    // la ligne de `verification` par son identifiant opaque, puis la SUPPRIME
    // en la nommant par son `id` — et `id` n'est clé de désignation d'aucune de
    // ces tables. Sans échange ouvert, le report de D64 n'a rien à rendre, le
    // `DELETE … RETURNING` rend zéro ligne, et la bibliothèque conclut
    // « Invalid token » : *un message juste sur une cause fausse*. En
    // production, c'est la route `app/api/auth/[...all]` qui ouvre l'échange.
    const production = creerAuth(clientApp());
    await dansUnEchangeAuth(() =>
      production.api.resetPassword({
        body: { newPassword: "MotDePasseChoisi1!", token: jeton! },
      }),
    );

    // Le second usage du même jeton est refusé.
    await expect(
      dansUnEchangeAuth(() =>
        production.api.resetPassword({
          body: { newPassword: "EncoreUnAutre1!", token: jeton! },
        }),
      ),
    ).rejects.toThrow();

    // Et le compte se connecte avec le mot de passe qu'il a choisi.
    const connexion = await dansUnEchangeAuth(() =>
      production.api.signInEmail({
        body: { email, password: "MotDePasseChoisi1!" },
      }),
    );
    expect(connexion.user.email).toBe(email);
  });

  it("l'instance de PRODUCTION ne peut émettre aucun jeton", async () => {
    // C'est ce qui empêche un inconnu de faire émettre un jeton de premier
    // accès pour un compte quelconque : `sendResetPassword` n'est fourni que
    // par le geste d'amorçage, sur SON instance.
    const production = creerAuth(clientApp());
    await expect(
      production.api.requestPasswordReset({
        body: { email: courriel("geste"), redirectTo: "/x" },
      }),
    ).rejects.toThrow();
  });
});
