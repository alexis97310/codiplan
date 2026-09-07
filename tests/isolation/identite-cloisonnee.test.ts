import { afterAll, describe, expect, it } from "vitest";

import { creerAuth } from "@/lib/auth/config";
import { avecDesignationAuth } from "@/lib/auth/lecture-identite";
import { Role } from "@/lib/auth/roles";
import { avecContexteRls } from "@/lib/db/rls";

import {
  ecartsListeDesignation,
  ecartsWithCheckExplicite,
  SQL_POLITIQUES,
  TABLES_DESIGNATION,
  type PolitiqueObservee,
} from "../../scripts/lib/politiques-rls";
import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  CLIENT_A1,
  PORTAIL_A_CLIENT,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * LES IDENTITÉS SONT CLOISONNÉES PAR LA BASE (ticket L1-02c).
 *
 * **Le témoin préalable n'est pas décoratif : il est la première leçon de ce
 * ticket** (§9, 07/09). La première mesure de cette politique était CREUSE et
 * verte — le harnais recrée la base à chaque exécution, la politique posée à la
 * main avait disparu, et l'épreuve prouvait que l'authentification fonctionne
 * SANS politique. *Un résultat qui surprend en bien est un soupçon sur la
 * mesure avant d'être un fait sur le monde.*
 */

/** Sentinelle d'annulation : elle fait retomber la transaction, sans erreur. */
class Annulation extends Error {}

function lirePolitiques(client: {
  $queryRawUnsafe: <T>(sql: string) => Promise<T>;
}): Promise<PolitiqueObservee[]> {
  return client.$queryRawUnsafe<PolitiqueObservee[]>(SQL_POLITIQUES);
}

afterAll(fermerClients);

describe("TÉMOIN PRÉALABLE — la politique est en vigueur, et elle mord", () => {
  it("porte les DEUX drapeaux", async () => {
    const [etat] = await clientOwner().$queryRawUnsafe<
      { active: boolean; forcee: boolean }[]
    >(`SELECT relrowsecurity AS active, relforcerowsecurity AS forcee
         FROM pg_class WHERE relname = 'utilisateur'`);

    // `ENABLE` seul ne concerne pas le propriétaire : ce qui ne se prouve pas
    // par la lecture se prouve par l'attribut, et il se lit en DEUX drapeaux
    // (§9, 31/08).
    expect(etat?.active).toBe(true);
    expect(etat?.forcee).toBe(true);
  });

  it("rend ZÉRO ligne sans aucun contexte", async () => {
    const [vu] = await clientApp().$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM "utilisateur"`,
    );
    expect(Number(vu?.n)).toBe(0);
  });

  it("et le propriétaire, lui, en compte plusieurs — la population existe", async () => {
    const [total] = await clientOwner().$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM "utilisateur"`,
    );
    expect(Number(total?.n)).toBeGreaterThan(5);
  });
});

describe("la forme « DÉSIGNATION » — et sa borne, éprouvée par tentative", () => {
  const designation = avecDesignationAuth(clientApp());

  it("rend la ligne NOMMÉE, et elle seule", async () => {
    const vue = await designation.utilisateur.findFirst({
      where: { email: "portail-a@iso.test" },
    });
    expect(vue?.email).toBe("portail-a@iso.test");
  });

  it("BORNE : nommer une ligne n'en ouvre aucune autre", async () => {
    // La tentative, pas la supposition. Sous la variable qui nomme A, on
    // demande B — nommément, puis par balayage.
    const fuite = await clientApp().$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        "SELECT set_config('app.authentification_email', $1, true)",
        "portail-a@iso.test",
      );
      return tx.$queryRawUnsafe<{ email: string }[]>(
        `SELECT "email" FROM "utilisateur" WHERE "email" LIKE '%@iso.test'`,
      );
    });

    expect(fuite.map((f) => f.email)).toEqual(["portail-a@iso.test"]);
  });

  it("BORNE : une variable VIDE n'ouvre rien", async () => {
    const [vu] = await clientApp().$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        "SELECT set_config('app.authentification_email', '', true)",
      );
      return tx.$queryRawUnsafe<{ n: bigint }[]>(
        `SELECT count(*) AS n FROM "utilisateur"`,
      );
    });
    expect(Number(vu?.n)).toBe(0);
  });

  it("BORNE : la désignation ne SURVIT pas à la transaction", async () => {
    // Mesuré, et c'est la garantie contre le pooler : `set_config(…, false)`
    // persisterait sur la connexion et serait lu par la requête suivante — d'un
    // AUTRE utilisateur. Ce serait pire que le mal qu'on répare.
    await designation.utilisateur.findFirst({
      where: { email: "portail-a@iso.test" },
    });

    const [reste] = await clientApp().$queryRawUnsafe<
      { restante: string | null }[]
    >(
      `SELECT nullif(current_setting('app.authentification_email', true), '') AS restante`,
    );
    expect(reste?.restante).toBeNull();
  });
});

describe("la forme « RATTACHEMENT » — ce que chacun voit", () => {
  function sous<T>(
    role: Role,
    clientId: string | null,
    travail: (tx: {
      $queryRawUnsafe: <R>(sql: string) => Promise<R>;
    }) => Promise<T>,
  ): Promise<T> {
    return avecContexteRls(
      clientApp(),
      {
        societeId: SOCIETE_A,
        role,
        auteurId:
          clientId === null ? UTILISATEUR_PAR_ROLE[role] : PORTAIL_A_CLIENT,
        clientId,
      },
      (tx) => travail(tx),
    );
  }

  it("un compte INTERNE voit les identités de sa société", async () => {
    const vues = await sous(Role.adv, null, (tx) =>
      tx.$queryRawUnsafe<{ email: string }[]>(
        `SELECT "email" FROM "utilisateur"`,
      ),
    );
    expect(vues.length).toBeGreaterThan(3);
    expect(vues.map((v) => v.email)).toContain("adv@iso.test");
  });

  it("un compte PORTAIL ne voit AUCUN salarié de la société", async () => {
    // Décision d'exploitation du 07/09/2026 : un compte portail n'a rien à
    // connaître du personnel. Même discriminant que partout ailleurs —
    // `app.client_id` —, aucune notion nouvelle.
    const vues = await sous(Role.client, CLIENT_A1, (tx) =>
      tx.$queryRawUnsafe<{ email: string }[]>(
        `SELECT "email" FROM "utilisateur"`,
      ),
    );

    const courriels = vues.map((v) => v.email);
    expect(courriels).not.toContain("adv@iso.test");
    expect(courriels).not.toContain("admin_societe@iso.test");
    expect(courriels).not.toContain("direction@iso.test");
    // Il voit les comptes portail de son client — sa propre habilitation le
    // rattache. Une politique qui rendrait zéro serait cassée, pas fermée.
    expect(courriels.length).toBeGreaterThan(0);
  });

  it("la société B ne voit pas les identités de A", async () => {
    const vues = await avecContexteRls(
      clientApp(),
      { societeId: SOCIETE_B, role: Role.adv, auteurId: null },
      (tx) =>
        tx.$queryRawUnsafe<{ email: string }[]>(
          `SELECT "email" FROM "utilisateur"`,
        ),
    );
    expect(vues.map((v) => v.email)).not.toContain("adv@iso.test");
  });
});

describe("l'ÉCRITURE a son expression à elle", () => {
  const email = () => `ouverture-${Date.now()}-${Math.random()}@iso.test`;

  it("un administrateur ouvre une identité, puis l'habilite", async () => {
    // La séquence complète, dans l'ordre où elle se produit : au moment où
    // l'identité est insérée, son habilitation n'existe pas encore — c'est
    // exactement pourquoi l'expression d'écriture ne dérive pas de la lecture.
    const adresse = email();
    const auth = creerAuth(clientApp(), {
      societeId: SOCIETE_A,
      role: Role.admin_societe,
    });

    const cree = await auth.api.signUpEmail({
      body: {
        email: adresse,
        password: "mot-de-passe-de-test-assez-long",
        name: "Ouvert",
      },
    });
    expect(cree).toBeTruthy();

    const relu = await avecDesignationAuth(clientApp()).utilisateur.findFirst({
      where: { email: adresse },
    });
    expect(relu?.email).toBe(adresse);
  });

  it("REFUS : sans le rôle qui administre, l'ouverture est refusée", async () => {
    const adresse = email();
    const auth = creerAuth(clientApp(), {
      societeId: SOCIETE_A,
      role: Role.adv,
    });

    await expect(
      auth.api.signUpEmail({
        body: {
          email: adresse,
          password: "mot-de-passe-de-test-assez-long",
          name: "Refusé",
        },
      }),
    ).rejects.toThrow();
  });

  it("REFUS : sans société active, l'ouverture est refusée", async () => {
    await expect(
      clientApp().$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          "SELECT set_config('app.role', $1, true)",
          Role.admin_societe,
        );
        await tx.$executeRawUnsafe(
          `INSERT INTO "utilisateur" ("id","nom","email","modifie_le")
             VALUES (gen_random_uuid(), 'Sans société', 'sans-societe@iso.test', now())`,
        );
      }),
    ).rejects.toThrow(/row-level security/);
  });

  it("RENDEZ-VOUS : un rôle SANS société active est refusé, et ce n'est pas décidé", async () => {
    // ── CE SCÉNARIO N'EST PAS UNE GARANTIE : C'EST UN RENDEZ-VOUS ──────────
    //
    // Il constate un refus que PERSONNE n'a arbitré. La politique
    // `utilisateur_ouverture` exige une société active ; les trois rôles
    // ÉDITEUR n'en ont aucune, par construction (§22.5 — un salarié de
    // l'éditeur n'a aucun accès par défaut aux données d'un client). La console
    // éditeur du lot 7 devra pourtant ouvrir la PREMIÈRE identité d'une société
    // cliente : il n'y a personne d'autre pour le faire.
    //
    // **Construire ce chemin aujourd'hui figerait la forme du provisionnement
    // avant qu'on en sache la première chose.** Ce qui est mûr, c'est le refus.
    // Sans ce scénario, celui qui écrira la console recevrait un « new row
    // violates row-level security policy » sans jamais savoir que c'était une
    // décision — une EMBUSCADE. Avec lui, il reçoit un rendez-vous.
    //
    // Le jour où ce scénario tombe, le message ci-dessous est ce qu'il faut
    // lire : la branche éditeur n'est pas un oubli, elle est au registre.
    const refus = clientApp().$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        "SELECT set_config('app.role', $1, true)",
        Role.editeur_support,
      );
      await tx.$executeRawUnsafe(
        `INSERT INTO "utilisateur" ("id","nom","email","modifie_le")
           VALUES (gen_random_uuid(), 'Première identité', 'premiere@societe-cliente.test', now())`,
      );
    });

    await expect(
      refus,
      "L'OUVERTURE D'UNE IDENTITÉ PAR UN RÔLE SANS SOCIÉTÉ ACTIVE N'EST PAS " +
        "DÉCIDÉE — voir le registre de `docs/arbitrages.md`, ligne « console " +
        "éditeur ». Si ce scénario tombe, c'est que quelqu'un a ouvert la " +
        "branche éditeur : elle demande un arbitrage, pas une rustine.",
    ).rejects.toThrow(/row-level security/);
  });

  it("et le refus ne tient pas au HASARD d'un rôle : c'est bien l'absence de société", async () => {
    // La contre-épreuve, sans laquelle le scénario ci-dessus prouverait
    // seulement qu'`editeur_support` n'administre pas. Le MÊME rôle éditeur,
    // avec une société posée, est refusé lui aussi — donc les deux conditions
    // mordent, et c'est bien un couple.
    const avecSociete = clientApp().$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        "SELECT set_config('app.societe_id', $1, true), set_config('app.role', $2, true)",
        SOCIETE_A,
        Role.editeur_support,
      );
      await tx.$executeRawUnsafe(
        `INSERT INTO "utilisateur" ("id","nom","email","modifie_le")
           VALUES (gen_random_uuid(), 'Éditeur avec société', 'editeur-societe@iso.test', now())`,
      );
    });
    await expect(avecSociete).rejects.toThrow(/row-level security/);
  });

  it("AUCUNE suppression n'est possible, et c'est une décision", async () => {
    // Sous `FORCE`, un verbe sans politique est refusé pour tout le monde.
    // L'absence est écrite dans la migration plutôt que subie.
    await expect(
      avecContexteRls(
        clientApp(),
        { societeId: SOCIETE_A, role: Role.admin_societe, auteurId: null },
        (tx) =>
          tx.$executeRawUnsafe(
            `DELETE FROM "utilisateur" WHERE "email" = 'adv@iso.test'`,
          ),
      ),
    ).resolves.toBe(0);
  });
});

/**
 * Les jumeaux. Chaque règle est éprouvée sur une faute RÉELLEMENT écrite en
 * base, dans une transaction annulée (§9, 24/08).
 */
describe("jumeaux — les deux gardiens mordent", () => {
  it("`WITH CHECK` retiré d'une politique d'écriture : le gardien la NOMME", async () => {
    let sousLaFaute: PolitiqueObservee[] | undefined;
    let sondeVisible = false;

    try {
      await clientOwner().$transaction(async (tx) => {
        // La faute telle qu'elle se commettrait : une politique `ALL` écrite
        // avec le seul `USING`. PostgreSQL y fait valoir la même expression en
        // écriture, sans que personne l'ait décidé.
        await tx.$executeRawUnsafe(
          `DROP POLICY "cloisonnement_societe" ON "agence"`,
        );
        await tx.$executeRawUnsafe(
          `CREATE POLICY "cloisonnement_societe" ON "agence"
             USING ("societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid)`,
        );
        sousLaFaute = await lirePolitiques(tx);
        sondeVisible = sousLaFaute.some(
          (p) => p.table === "agence" && (p.ecriture ?? null) === null,
        );
        throw new Annulation();
      });
    } catch (erreur) {
      if (!(erreur instanceof Annulation)) throw erreur;
    }

    // La sonde compte autant que l'assertion : c'est elle qui a démasqué les
    // épreuves creuses du 30/08.
    expect(sondeVisible, "la politique fautive n'a pas été écrite").toBe(true);

    const ecarts = ecartsWithCheckExplicite(sousLaFaute ?? []);
    expect(ecarts, ecarts.join("\n")).toHaveLength(1);
    expect(ecarts[0]).toContain("agence");
    expect(ecarts[0]).toContain("décision prise par personne");
  });

  it("la base est revenue en l'état après le jumeau", async () => {
    const apres = await lirePolitiques(clientOwner());
    expect(ecartsWithCheckExplicite(apres)).toEqual([]);
  });

  it("une lecture creuse est un écart, pas un sans-faute", () => {
    expect(ecartsWithCheckExplicite([])).toHaveLength(1);
  });

  it("la liste « désignation » est close des DEUX côtés", () => {
    expect(ecartsListeDesignation()).toEqual([]);

    // L'ADDITION — le geste qui transformerait la borne en porte de service.
    // La liste arbitrée en compte CINQ depuis L1-02d ; c'est l'entrée EN TROP
    // qui doit être nommée, et elle seule.
    const ajoutee = ecartsListeDesignation([...TABLES_DESIGNATION, "client"]);
    expect(ajoutee).toHaveLength(1);
    expect(ajoutee[0]).toContain("porte de service");

    // Le RETRAIT — chaque table arbitrée qui disparaît est nommée, et le
    // décompte suit la liste plutôt qu'un chiffre écrit à la main : baisser
    // l'un sans l'autre serait le plancher qui s'affaisse en silence.
    const videe = ecartsListeDesignation([]);
    expect(videe).toHaveLength(TABLES_DESIGNATION.length);
    expect(videe[0]).toContain("plus se connecter");
  });
});
