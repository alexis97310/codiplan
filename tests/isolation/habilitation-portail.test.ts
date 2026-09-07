import { afterAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { avecContexteRls } from "@/lib/db/rls";

import {
  CLIENT_A1,
  CLIENT_A2,
  PORTAIL_A_CLIENT,
  SITE_A1_S1,
  SITE_A1_S2,
  SITE_B1_S1,
  SOCIETE_A,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";
import { clientApp, clientOwner, fermerClients } from "./setup/db";

/**
 * LA FORME « HABILITATION », ET LA FUITE QU'ELLE FERME (ticket L1-02b).
 *
 * **Ce fichier éprouve une fuite MESURÉE, pas imaginée.** Le 07/09/2026, sous le
 * rôle applicatif et avec le contexte que pose `lib/db/rls.ts`, un compte
 * portail du client A1 : lisait les lignes d'habilitation des comptes du client
 * A2 de la même société ; en tirait par jointure leurs `nom` et `email` ; et
 * énumérait par là les autres clients de la société. Les trois réponses
 * étaient oui.
 *
 * **Tout passe par le CHEMIN DE PRODUCTION.** Les scénarios ci-dessous ne
 * posent pas le contexte eux-mêmes : ils appellent `avecContexteRls`, le seul
 * module qui le pose en exploitation. C'est la leçon de la première moitié de
 * ce ticket — un harnais qui arme lui-même la garantie qu'il éprouve ne prouve
 * rien sur ce que la production arme.
 */

/** Sentinelle d'annulation : elle fait retomber la transaction, sans erreur. */
class Annulation extends Error {}

/** Le contexte d'un compte portail, tel que la production le posera. */
function portail<T>(
  clientId: string,
  auteurId: string,
  travail: (tx: {
    $queryRawUnsafe: <R>(sql: string, ...p: unknown[]) => Promise<R>;
  }) => Promise<T>,
): Promise<T> {
  return avecContexteRls(
    clientApp(),
    { societeId: SOCIETE_A, role: Role.client, auteurId, clientId },
    (tx) => travail(tx),
  );
}

/** Le contexte d'un utilisateur interne : aucun `app.client_id`. */
function interne<T>(
  role: Role,
  travail: (tx: {
    $queryRawUnsafe: <R>(sql: string, ...p: unknown[]) => Promise<R>;
  }) => Promise<T>,
): Promise<T> {
  return avecContexteRls(
    clientApp(),
    { societeId: SOCIETE_A, role, auteurId: UTILISATEUR_PAR_ROLE[role] },
    (tx) => travail(tx),
  );
}

afterAll(fermerClients);

describe("la fuite mesurée le 07/09/2026 est fermée — les trois réponses", () => {
  it("TÉMOIN : le voisin existe, et le propriétaire le voit", async () => {
    // Sans ce témoin, les trois scénarios suivants seraient CREUX : un compte
    // qui ne voit qu'une ligne là où il n'en existe qu'une ne prouve rien
    // (§9, 30/08). Le propriétaire lit hors politiques.
    const voisines = await clientOwner().$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM "utilisateur_client"
        WHERE "societe_id" = $1::uuid AND "client_id" = $2::uuid`,
      SOCIETE_A,
      CLIENT_A2,
    );
    expect(Number(voisines[0]?.n)).toBeGreaterThan(0);
  });

  it("1. il ne lit PLUS les habilitations des comptes d'un autre client", async () => {
    const lignes = await portail(CLIENT_A1, PORTAIL_A_CLIENT, (tx) =>
      tx.$queryRawUnsafe<{ client_id: string; utilisateur_id: string }[]>(
        `SELECT "client_id", "utilisateur_id" FROM "utilisateur_client"`,
      ),
    );

    expect(lignes.length).toBeGreaterThan(0);
    expect(lignes.map((l) => l.client_id)).not.toContain(CLIENT_A2);
    // Et il voit bien la SIENNE : une politique qui rendrait zéro ligne serait
    // « fermée » et cassée, ce qui n'est pas la même chose que fermée.
    expect(lignes.every((l) => l.utilisateur_id === PORTAIL_A_CLIENT)).toBe(
      true,
    );
  });

  it("2. la jointure sur `utilisateur` ne rend plus l'identité du voisin", async () => {
    // `utilisateur` ne porte AUCUNE sécurité au niveau des lignes : ce n'est
    // pas elle qui refuse, c'est `utilisateur_client` qui ne fournit plus le
    // LIEN. La table d'identités reste ouverte au rôle applicatif — c'est un
    // constat, porté au registre, et il n'est pas fermé par ce ticket.
    const identites = await portail(CLIENT_A1, PORTAIL_A_CLIENT, (tx) =>
      tx.$queryRawUnsafe<{ nom: string; email: string }[]>(
        `SELECT "u"."nom", "u"."email"
           FROM "utilisateur_client" "uc"
           JOIN "utilisateur" "u" ON "u"."id" = "uc"."utilisateur_id"`,
      ),
    );

    expect(identites.map((i) => i.email)).not.toContain("portail-a2@iso.test");
    expect(identites.length).toBeGreaterThan(0);
  });

  it("3. il n'énumère plus les autres clients de la société par ce chemin", async () => {
    const clients = await portail(CLIENT_A1, PORTAIL_A_CLIENT, (tx) =>
      tx.$queryRawUnsafe<{ client_id: string }[]>(
        `SELECT DISTINCT "client_id" FROM "utilisateur_client"`,
      ),
    );

    expect(clients.map((c) => c.client_id)).toEqual([CLIENT_A1]);
  });
});

describe("le DISCRIMINANT : ce que la clause ne doit PAS retirer", () => {
  it("un `admin_societe` voit toutes les habilitations de SA société", async () => {
    // C'est la moitié que « `utilisateur_id` = le compte courant » tout court
    // aurait cassée. Sans ce scénario, une clause trop fermée passerait pour
    // juste : elle fermerait la fuite ET l'administration.
    const lignes = await interne(Role.admin_societe, (tx) =>
      tx.$queryRawUnsafe<{ client_id: string }[]>(
        `SELECT DISTINCT "client_id" FROM "utilisateur_client"`,
      ),
    );

    const clients = lignes.map((l) => l.client_id).sort();
    expect(clients).toContain(CLIENT_A1);
    expect(clients).toContain(CLIENT_A2);
  });

  it("et il ne voit rien de la société B", async () => {
    const lignes = await interne(Role.admin_societe, (tx) =>
      tx.$queryRawUnsafe<{ n: bigint }[]>(
        `SELECT count(*) AS n FROM "utilisateur_client" WHERE "societe_id" <> $1::uuid`,
        SOCIETE_A,
      ),
    );
    expect(Number(lignes[0]?.n)).toBe(0);
  });
});

describe("le périmètre est DÉRIVÉ de la table, et il mord", () => {
  it("`app.perimetre_sites` est rempli par le chemin de production", async () => {
    const [vue] = await portail(CLIENT_A1, PORTAIL_A_CLIENT, (tx) =>
      tx.$queryRawUnsafe<{ perimetre: string }[]>(
        `SELECT current_setting('app.perimetre_sites', true) AS perimetre`,
      ),
    );

    // La FORME ne bouge pas : liste d'UUID jointe par des virgules, exactement
    // ce que lisent les politiques. La normalisation change d'où vient la
    // valeur, jamais ce que voient les politiques.
    expect(vue?.perimetre).toBe(SITE_A1_S1);
  });

  it("le compte portail voit S1 et PAS S2, deux sites du MÊME client", async () => {
    // La seule branche que ni le filtre société ni le filtre client ne savent
    // produire — et elle passe par une valeur que la base a calculée.
    const sites = await portail(CLIENT_A1, PORTAIL_A_CLIENT, (tx) =>
      tx.$queryRawUnsafe<{ id: string }[]>(`SELECT "id" FROM "site"`),
    );

    expect(sites.map((s) => s.id)).toEqual([SITE_A1_S1]);
  });

  it("un utilisateur interne n'est pas restreint : il voit les deux", async () => {
    const sites = await interne(Role.adv, (tx) =>
      tx.$queryRawUnsafe<{ id: string }[]>(`SELECT "id" FROM "site"`),
    );

    const vus = sites.map((s) => s.id).sort();
    expect(vus).toContain(SITE_A1_S1);
    expect(vus).toContain(SITE_A1_S2);
  });

  it("un compte portail ne lit que SES entrées de périmètre", async () => {
    const lignes = await portail(CLIENT_A1, PORTAIL_A_CLIENT, (tx) =>
      tx.$queryRawUnsafe<{ site_id: string }[]>(
        `SELECT "site_id" FROM "utilisateur_client_site"`,
      ),
    );
    expect(lignes.map((l) => l.site_id)).toEqual([SITE_A1_S1]);
  });
});

/**
 * LA CLÉ ÉTRANGÈRE, ET SON JUMEAU. Chaque refus est éprouvé en retirant
 * RÉELLEMENT le verrou visé, dans une transaction annulée, et l'assertion NOMME
 * la contrainte (§9, 24/08).
 */
describe("la clé refuse ce que le tableau acceptait", () => {
  const ligneFautive = (siteId: string) =>
    `INSERT INTO "utilisateur_client_site" ("id", "societe_id", "utilisateur_client_id", "site_id")
       VALUES (gen_random_uuid(), '${SOCIETE_A}', 'aaaaaaaa-0000-7000-8000-0000000000f7', '${siteId}')`;

  it("REFUS : un périmètre qui désigne un site INEXISTANT", async () => {
    await expect(
      clientOwner().$executeRawUnsafe(
        ligneFautive("00000000-0000-7000-8000-00000000dead"),
      ),
    ).rejects.toThrow(/utilisateur_client_site_site_fkey/);
  });

  it("REFUS : un périmètre qui désigne le site d'une AUTRE société", async () => {
    // Le cas que le tableau `uuid[]` ne pouvait pas interdire, et le plus grave
    // des deux : un périmètre qui nomme le site d'une autre société ne
    // restreint rien du tout.
    await expect(
      clientOwner().$executeRawUnsafe(ligneFautive(SITE_B1_S1)),
    ).rejects.toThrow(/utilisateur_client_site_site_fkey/);
  });

  it("JUMEAU : la contrainte RETIRÉE, la même écriture PASSE", async () => {
    // Sans ce jumeau, rien ne dirait que le refus vient de la clé visée : il a
    // pu venir d'une contrainte voisine, ce qui était le cas du premier gardien
    // de D49. Le DDL est transactionnel en PostgreSQL : la contrainte revient
    // au `ROLLBACK`, et l'épreuve rejoue à chaque `pnpm verify`.
    let passeSansLaCle = false;

    try {
      await clientOwner().$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `ALTER TABLE "utilisateur_client_site" DROP CONSTRAINT "utilisateur_client_site_site_fkey"`,
        );
        await tx.$executeRawUnsafe(ligneFautive(SITE_B1_S1));
        passeSansLaCle = true;
        throw new Annulation();
      });
    } catch (erreur) {
      if (!(erreur instanceof Annulation)) throw erreur;
    }

    expect(
      passeSansLaCle,
      "l'écriture fautive a échoué MÊME SANS la clé : le refus mesuré plus " +
        "haut ne prouve donc rien sur elle — il vient d'ailleurs.",
    ).toBe(true);
  });

  it("la base est bien revenue en l'état après le jumeau", async () => {
    await expect(
      clientOwner().$executeRawUnsafe(ligneFautive(SITE_B1_S1)),
    ).rejects.toThrow(/utilisateur_client_site_site_fkey/);
  });

  it("REFUS : le même site deux fois dans un périmètre", async () => {
    // Le tableau acceptait `{S1, S1}`. Ce n'est pas une faille, c'est une
    // donnée qui ment sur elle-même — et un décompte de périmètre faux.
    // L'assertion nomme le COUPLE violé plutôt que l'index : c'est ce que
    // PostgreSQL rend sur un 23505, et un refus venu d'ailleurs ne le
    // contiendrait pas.
    await expect(
      clientOwner().$executeRawUnsafe(ligneFautive(SITE_A1_S1)),
    ).rejects.toThrow(/\(utilisateur_client_id, site_id\)/);
  });
});
