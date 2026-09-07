import { afterAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { avecContexteRls } from "@/lib/db/rls";

import {
  SQL_COLONNES_PERIMETRE,
  SQL_POLITIQUES,
  ecartsPerimetreNullable,
  type ColonnePerimetre,
  type PolitiqueObservee,
} from "../../scripts/lib/politiques-rls";
import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  CLIENT_A1,
  CLIENT_A2,
  CONTACT_A1_ATELIER,
  CONTACT_A1_COMPTABLE,
  SITE_A1_S1,
  SITE_A1_S2,
  SOCIETE_A,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * LES CONTACTS D'UN CLIENT (ticket L1-03).
 *
 * **Le piège de ce ticket a été nommé AVANT qu'il ne se produise**, par
 * l'exploitation le 07/09/2026 : *un contact sans site est un contact du
 * client ; il ne doit pas disparaître pour un compte portail restreint à
 * certains sites — sinon on perd le comptable en restreignant un atelier.*
 *
 * C'est exactement le genre de faute qui ne casse RIEN de visible : la liste se
 * raccourcit, et personne ne sait ce qui manque. Elle ne se déduit pas toute
 * seule, elle s'éprouve — et le gardien des formes l'exige désormais dès que la
 * colonne de périmètre est nullable.
 */

/** Sentinelle d'annulation : elle fait retomber la transaction, sans erreur. */
class Annulation extends Error {}

function sous<T>(
  role: Role,
  clientId: string | null,
  perimetre: readonly string[],
  travail: (tx: {
    $queryRawUnsafe: <R>(sql: string, ...p: unknown[]) => Promise<R>;
    $executeRawUnsafe: (sql: string, ...p: unknown[]) => Promise<number>;
  }) => Promise<T>,
): Promise<T> {
  return clientApp().$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      "SELECT set_config('app.societe_id',$1,true), set_config('app.role',$2,true)," +
        " set_config('app.client_id',$3,true), set_config('app.perimetre_sites',$4,true)",
      SOCIETE_A,
      role,
      clientId ?? "",
      perimetre.join(","),
    );
    return travail(tx as never);
  });
}

afterAll(fermerClients);

describe("TÉMOIN : les deux contacts existent, et ils diffèrent par leur site", () => {
  it("le propriétaire voit l'un sans site et l'autre sur S2", async () => {
    // Sans ce témoin, « un seul disparaît » serait indistinguable de « il n'y
    // en avait qu'un » (§9, 30/08).
    const vus = await clientOwner().$queryRawUnsafe<
      { id: string; site_id: string | null }[]
    >(
      `SELECT "id", "site_id" FROM "contact" WHERE "client_id" = $1::uuid ORDER BY "nom"`,
      CLIENT_A1,
    );
    expect(vus).toHaveLength(2);
    expect(vus.find((v) => v.id === CONTACT_A1_COMPTABLE)?.site_id).toBeNull();
    expect(vus.find((v) => v.id === CONTACT_A1_ATELIER)?.site_id).toBe(
      SITE_A1_S2,
    );
  });
});

describe("LE COMPTABLE NE DISPARAÎT PAS quand on restreint un atelier", () => {
  it("un compte portail restreint à S1 voit le contact SANS site", async () => {
    const vus = await sous(Role.client, CLIENT_A1, [SITE_A1_S1], (tx) =>
      tx.$queryRawUnsafe<{ id: string }[]>(`SELECT "id" FROM "contact"`),
    );
    expect(vus.map((v) => v.id)).toContain(CONTACT_A1_COMPTABLE);
  });

  it("et il ne voit PAS le contact rattaché à S2, hors de son périmètre", async () => {
    const vus = await sous(Role.client, CLIENT_A1, [SITE_A1_S1], (tx) =>
      tx.$queryRawUnsafe<{ id: string }[]>(`SELECT "id" FROM "contact"`),
    );
    expect(vus.map((v) => v.id)).not.toContain(CONTACT_A1_ATELIER);
    // Exactement un des deux : c'est le couple qui démontre. Deux disparitions
    // seraient la faute ; zéro disparition serait un périmètre inerte.
    expect(vus).toHaveLength(1);
  });

  it("sans restriction de sites, le même compte voit les deux", async () => {
    // La contre-épreuve : le filtre de périmètre mord bien, il n'est pas inerte.
    const vus = await sous(Role.client, CLIENT_A1, [], (tx) =>
      tx.$queryRawUnsafe<{ id: string }[]>(`SELECT "id" FROM "contact"`),
    );
    expect(vus).toHaveLength(2);
  });

  it("un utilisateur interne voit les deux, et ceux des autres clients", async () => {
    const vus = await avecContexteRls(
      clientApp(),
      {
        societeId: SOCIETE_A,
        role: Role.adv,
        auteurId: UTILISATEUR_PAR_ROLE[Role.adv],
      },
      (tx) =>
        tx.$queryRawUnsafe<{ id: string }[]>(`SELECT "id" FROM "contact"`),
    );
    expect(vus.length).toBeGreaterThanOrEqual(2);
  });

  it("un compte portail d'un AUTRE client n'en voit aucun", async () => {
    const vus = await sous(Role.client, CLIENT_A2, [], (tx) =>
      tx.$queryRawUnsafe<{ id: string }[]>(`SELECT "id" FROM "contact"`),
    );
    expect(vus).toHaveLength(0);
  });
});

describe("ce que la base tient, et ce qu'elle laisse à l'entrée serveur", () => {
  const inserer = (colonnes: string, valeurs: string) =>
    clientOwner().$executeRawUnsafe(
      `INSERT INTO "contact" ("id","societe_id","client_id",${colonnes})
         VALUES (gen_random_uuid(), '${SOCIETE_A}', '${CLIENT_A1}', ${valeurs})`,
    );

  it("REFUS : un contact rattaché au site d'un AUTRE client", async () => {
    // La clé porte le TRIPLET (société, client, site) : une clé sur la seule
    // société aurait laissé passer, et le contact serait apparu ou disparu
    // selon le périmètre du mauvais compte.
    const [siteAutreClient] = await clientOwner().$queryRawUnsafe<
      { id: string }[]
    >(
      `SELECT "id" FROM "site" WHERE "societe_id" = $1::uuid AND "client_id" <> $2::uuid LIMIT 1`,
      SOCIETE_A,
      CLIENT_A1,
    );
    if (siteAutreClient === undefined) {
      // Témoin : s'il n'existe aucun site d'un autre client, ce scénario ne
      // prouverait rien — mieux vaut le dire que passer au vert.
      expect.unreachable("aucun site d'un autre client dans la société A");
    }
    await expect(
      inserer(
        `"site_id","nom","roles","email"`,
        `'${siteAutreClient.id}', 'Intrus', ARRAY['comptabilite'], 'x@y.test'`,
      ),
    ).rejects.toThrow(/contact_site_du_client_fkey/);
  });

  it("REFUS : aucun rôle", async () => {
    await expect(
      inserer(
        `"nom","roles","email"`,
        `'Sans rôle', ARRAY[]::text[], 'x@y.test'`,
      ),
    ).rejects.toThrow(/contact_roles_non_vides/);
  });

  it("REFUS : un rôle en double", async () => {
    await expect(
      inserer(
        `"nom","roles","email"`,
        `'Doublon', ARRAY['signataire','signataire'], 'x@y.test'`,
      ),
    ).rejects.toThrow(/contact_roles_non_vides/);
  });

  it("REFUS : le canal e-mail sans courriel", async () => {
    // La dépendance entre deux colonnes est TENUE, pas seulement écrite : une
    // préférence dont le sens dépend d'une autre colonne ne voyage pas seule.
    await expect(
      inserer(
        `"nom","roles","canaux"`,
        `'Sans courriel', ARRAY['comptabilite'], ARRAY['email']`,
      ),
    ).rejects.toThrow(/contact_courriel_si_canal_email/);
  });

  it("ACCEPTE plusieurs rôles — le donneur d'ordre est souvent le signataire", async () => {
    // La contre-épreuve des trois refus ci-dessus : sans elle, une contrainte
    // qui refuserait TOUT passerait pour juste.
    let passe = false;
    try {
      await clientOwner().$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `INSERT INTO "contact" ("id","societe_id","client_id","nom","roles","email")
             VALUES (gen_random_uuid(), '${SOCIETE_A}', '${CLIENT_A1}', 'Donneur d''ordre',
                     ARRAY['donneur_ordre','signataire'], 'do@a1.test')`,
        );
        passe = true;
        throw new Annulation();
      });
    } catch (erreur) {
      if (!(erreur instanceof Annulation)) throw erreur;
    }
    expect(passe).toBe(true);
  });
});

/**
 * Le gardien de la branche `IS NULL`, et son jumeau. La forme est MESURÉE dans
 * `pg_policies`, la nullabilité dans `information_schema` — deux sources que le
 * module ne contrôle pas.
 */
describe("gardien — la colonne de périmètre nullable exige sa branche", () => {
  const lire = async (): Promise<{
    colonnes: ColonnePerimetre[];
    politiques: PolitiqueObservee[];
  }> => ({
    colonnes: await clientOwner().$queryRawUnsafe<ColonnePerimetre[]>(
      SQL_COLONNES_PERIMETRE,
    ),
    politiques:
      await clientOwner().$queryRawUnsafe<PolitiqueObservee[]>(SQL_POLITIQUES),
  });

  it("n'observe aucun écart", async () => {
    const { colonnes, politiques } = await lire();
    const ecarts = ecartsPerimetreNullable(colonnes, politiques);
    expect(ecarts, ecarts.join("\n")).toEqual([]);
  });

  it("a bien vu que `contact.site_id` est NULLABLE — témoin", async () => {
    const { colonnes } = await lire();
    const site = colonnes.find(
      (c) => c.table === "contact" && c.colonne === "site_id",
    );
    expect(site?.nullable).toBe(true);
    // Et la contre-mesure : celle de `site` ne l'est pas, sinon l'exigence
    // porterait sur tout le monde et ne dirait rien.
    const idDuSite = colonnes.find(
      (c) => c.table === "site" && c.colonne === "id",
    );
    expect(idDuSite?.nullable).toBe(false);
  });

  it("JUMEAU : la branche RETIRÉE en base est nommée", async () => {
    let sousLaFaute:
      | { colonnes: ColonnePerimetre[]; politiques: PolitiqueObservee[] }
      | undefined;
    let sondeVisible = false;

    try {
      await clientOwner().$transaction(async (tx) => {
        // La faute telle qu'elle se commettrait : la clause du parc RECOPIÉE
        // depuis `site`, sans la disjonction — c'est-à-dire en obéissant.
        await tx.$executeRawUnsafe(
          `DROP POLICY "cloisonnement_parc" ON "contact"`,
        );
        await tx.$executeRawUnsafe(
          `CREATE POLICY "cloisonnement_parc" ON "contact"
             USING (
               "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
               AND (NULLIF(current_setting('app.client_id', true), '') IS NULL
                    OR "client_id" = NULLIF(current_setting('app.client_id', true), '')::uuid)
               AND (NULLIF(current_setting('app.perimetre_sites', true), '') IS NULL
                    OR "site_id" = ANY (string_to_array(NULLIF(current_setting('app.perimetre_sites', true), ''), ',')::uuid[]))
             )`,
        );
        sousLaFaute = {
          colonnes: await tx.$queryRawUnsafe<ColonnePerimetre[]>(
            SQL_COLONNES_PERIMETRE,
          ),
          politiques:
            await tx.$queryRawUnsafe<PolitiqueObservee[]>(SQL_POLITIQUES),
        };
        // LA SONDE : la faute a-t-elle réellement eu lieu ? Et surtout — le
        // comptable a-t-il réellement disparu ? C'est le préjudice qu'on
        // mesure, pas seulement le texte de la clause.
        await tx.$executeRawUnsafe(
          "SELECT set_config('app.societe_id',$1,true), set_config('app.client_id',$2,true)," +
            " set_config('app.perimetre_sites',$3,true)",
          SOCIETE_A,
          CLIENT_A1,
          SITE_A1_S1,
        );
        // La sonde nomme la BRANCHE, pas « IS NULL » : la clause en contient
        // déjà deux autres (`NULLIF(...) IS NULL`), et chercher la chaîne large
        // aurait rendu la sonde toujours vraie — creuse dans le sens inverse.
        sondeVisible = sousLaFaute.politiques.some(
          (p) =>
            p.table === "contact" &&
            !/\bsite_id\s+is\s+null\b/i.test(p.lecture ?? ""),
        );
        throw new Annulation();
      });
    } catch (erreur) {
      if (!(erreur instanceof Annulation)) throw erreur;
    }

    expect(sondeVisible, "la politique fautive n'a pas été écrite").toBe(true);

    const ecarts = ecartsPerimetreNullable(
      sousLaFaute?.colonnes ?? [],
      sousLaFaute?.politiques ?? [],
    );
    expect(ecarts.length).toBeGreaterThan(0);
    expect(ecarts.join("\n")).toContain("contact");
    expect(ecarts.join("\n")).toContain("site_id");
    expect(ecarts.join("\n")).toContain("le comptable");
  });

  it("la base est revenue en l'état après le jumeau", async () => {
    const { colonnes, politiques } = await lire();
    expect(ecartsPerimetreNullable(colonnes, politiques)).toEqual([]);
  });

  it("une lecture creuse est un écart, pas un sans-faute", () => {
    expect(ecartsPerimetreNullable([], [])).toHaveLength(1);
  });
});
