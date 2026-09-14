import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import {
  compterSansCodeExterne,
  rechercherClients,
  sitesParClient,
} from "@/lib/clients/depot";
import { schemaRechercheClient } from "@/lib/clients/saisie";
import { dernieresInterventionsDuClient } from "@/lib/interventions/depot";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  CLIENT_A1,
  CLIENT_A2,
  CLIENT_B1,
  PORTAIL_A_CLIENT,
  PORTAIL_DEUX_SOCIETES,
  SITE_A1_S1,
  SITE_A1_S2,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_INTERNE_A,
} from "./setup/fixtures";

/**
 * LES LECTURES DE L'ÉCRAN CLIENT, ÉPROUVÉES SUR LA VRAIE TABLE (14/09/2026,
 * L1-01 rouvert par R3-12).
 *
 * ## CE QUE CE FICHIER AJOUTE, ET QUE `client.test.ts` NE DONNE PAS
 *
 * `client.test.ts` éprouve la POLITIQUE — l'écriture, l'unicité du code, la
 * fuite que la clause société seule produirait. Ce fichier-ci éprouve les
 * **trois lectures que l'écran a fait naître**, et chacune a son propre mode de
 * défaillance :
 *
 *   1. `compterSansCodeExterne` — un compteur qui ne bougerait pas sous la
 *      politique serait *un chiffre attendu présenté parmi les observations*
 *      (§9, 06/09), et le pire endroit pour l'être : il coiffe le tableau ;
 *   2. `sitesParClient` — une jointure faite pour une colonne d'affichage, donc
 *      le chemin le plus facile à écrire en oubliant qu'il traverse `site`, de
 *      forme « parc » avec son périmètre ;
 *   3. `dernieresInterventionsDuClient` — un `where` sur `client_id` qui
 *      RESSEMBLE à un cloisonnement sans en être un. *Les confondre ferait
 *      croire qu'on peut se passer de l'un ou de l'autre.*
 *
 * ## LE TÉMOIN PRÉCÈDE CHAQUE MESURE
 *
 * *Un résultat qui vous surprend en bien est un soupçon sur la mesure avant
 * d'être un fait sur le monde* (§9, 07/09). Chaque scénario montre donc d'abord,
 * sous le propriétaire, que la ligne qu'on s'attend à NE PAS voir existe bel et
 * bien — sans quoi un zéro ne parlerait de rien.
 */

afterAll(fermerClients);

const INTERNE_A = {
  utilisateurId: UTILISATEUR_INTERNE_A,
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const INTERNE_B = { ...INTERNE_A, societeId: SOCIETE_B };

const PORTAIL_A1 = {
  utilisateurId: PORTAIL_A_CLIENT,
  societeId: SOCIETE_A,
  role: Role.client,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: CLIENT_A1,
};

/**
 * UN COMPTE DE PORTAIL SANS RESTRICTION DE SITES.
 *
 * **Mesuré sur les fixtures le 14/09/2026**, et non supposé : `PORTAIL_A_CLIENT`
 * porte une ligne dans `utilisateur_client_site` qui le borne à `SITE_A1_S1`,
 * quand `PORTAIL_DEUX_SOCIETES` n'en porte aucune et voit donc tous les sites de
 * son client. *Le périmètre ne vient pas du contexte que l'appelant fournit : il
 * est DISPOSÉ par la base depuis les habilitations du compte* (D70), et c'est ce
 * qui rend la paire ci-dessous mesurable.
 */
const PORTAIL_A1_SANS_RESTRICTION = {
  ...PORTAIL_A1,
  utilisateurId: PORTAIL_DEUX_SOCIETES,
};

/** Les critères par défaut : aucune recherche, toutes les fiches. */
const TOUT = schemaRechercheClient.parse({});

/**
 * DEUX FICHES SANS CODE DE RAPPROCHEMENT, POSÉES EXPRÈS — une par société.
 *
 * **Les fixtures n'en portaient aucune** : mesuré, les trois clients du harnais
 * ont tous un `code_externe`, si bien que le compteur rendait zéro partout et
 * que l'égalité « vu de A = attendu de A » aurait été *zéro contre zéro, qui
 * n'est pas un résultat mais une absence de mesure* (§9, 10/09).
 *
 * Elles sont posées sous le PROPRIÉTAIRE — ce sont des données de scénario, pas
 * une écriture à éprouver — et retirées à la fin. *Le harnais ne laisse rien
 * derrière lui : un scénario qui modifie la base durablement fait dépendre les
 * suivants de son ordre d'exécution.*
 */
const SANS_CODE_A = "aaaaaaaa-0000-7000-8000-00000000ec01";
const SANS_CODE_B = "bbbbbbbb-0000-7000-8000-00000000ec02";

beforeAll(async () => {
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "client" ("id", "societe_id", "raison_sociale", "code_externe")
     VALUES ($1::uuid, $2::uuid, 'Sans code A', NULL),
            ($3::uuid, $4::uuid, 'Sans code B', NULL)
     ON CONFLICT ("id") DO NOTHING`,
    SANS_CODE_A,
    SOCIETE_A,
    SANS_CODE_B,
    SOCIETE_B,
  );
});

afterAll(async () => {
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "client" WHERE "id" = ANY(ARRAY[$1::uuid, $2::uuid])`,
    SANS_CODE_A,
    SANS_CODE_B,
  );
});

describe("le compteur « sans code de rapprochement » (RG-IMP-05, D29)", () => {
  it("ne compte QUE la société active", async () => {
    // TÉMOIN — les deux sociétés portent des clients sans code externe. Sans
    // cela, l'égalité ci-dessous serait vraie sur un référentiel vide, et
    // *zéro contre zéro n'est pas un résultat, c'est une absence de mesure*
    // (§9, 10/09).
    const [temoin] = await clientOwner().$queryRawUnsafe<
      { a: number; b: number }[]
    >(
      `SELECT
         count(*) FILTER (WHERE societe_id = $1::uuid AND code_externe IS NULL)::int AS a,
         count(*) FILTER (WHERE societe_id = $2::uuid AND code_externe IS NULL)::int AS b
       FROM "client"`,
      SOCIETE_A,
      SOCIETE_B,
    );
    expect(temoin!.a).toBeGreaterThan(0);
    expect(temoin!.b).toBeGreaterThan(0);

    const vuDeA = await compterSansCodeExterne(INTERNE_A, TOUT, clientApp());
    const vuDeB = await compterSansCodeExterne(INTERNE_B, TOUT, clientApp());

    expect(vuDeA).toBe(temoin!.a);
    expect(vuDeB).toBe(temoin!.b);
    // Et surtout : jamais la somme. C'est la faute qu'un `count` écrit sans
    // contexte commettrait, et elle se lirait comme un chiffre plausible.
    expect(vuDeA).toBeLessThan(temoin!.a + temoin!.b);
  });

  it("un compte de PORTAIL ne compte que SON client (D10, D22)", async () => {
    // TÉMOIN — la société A porte au moins DEUX clients, dont un qui n'est pas
    // celui du compte. Sans lui, « il n'en compte qu'un » serait vrai sur un
    // référentiel qui n'en contient qu'un.
    const [temoin] = await clientOwner().$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM "client" WHERE societe_id = $1::uuid`,
      SOCIETE_A,
    );
    expect(temoin!.n).toBeGreaterThan(1);

    const fiches = await rechercherClients(PORTAIL_A1, TOUT, clientApp());
    expect(fiches.map((f) => f.id)).toEqual([CLIENT_A1]);

    // LE COMPTEUR SUIT LA MÊME POLITIQUE QUE LE TABLEAU QU'IL COIFFE. C'est
    // tout l'objet de `filtreDeRecherche` : *deux lectures d'un même critère
    // divergent en silence* (§9, 01/09), et ici elles seraient côte à côte.
    const compte = await compterSansCodeExterne(PORTAIL_A1, TOUT, clientApp());
    const attendu = fiches.filter((f) => f.code_externe === null).length;
    expect(compte).toBe(attendu);
  });

  it("LE CAS QUI DOIT RESTER VERT POUR SA PROPRE RAISON : il compte pour de vrai", async () => {
    // *Toutes mes mises en échec faisaient rougir le gardien ; aucune ne
    // vérifiait qu'un vert était mérité* (§9, 11/09). Un compteur câblé sur
    // zéro passerait les deux épreuves ci-dessus dès que les fiches auraient
    // toutes un code. Celle-ci exige qu'il RENDE un nombre non nul et qu'il
    // DIMINUE quand la recherche se restreint.
    const tout = await compterSansCodeExterne(INTERNE_A, TOUT, clientApp());
    expect(tout).toBeGreaterThan(0);

    const introuvable = schemaRechercheClient.parse({
      texte: "zzz-aucune-fiche-ne-porte-ceci",
    });
    expect(
      await compterSansCodeExterne(INTERNE_A, introuvable, clientApp()),
    ).toBe(0);
  });
});

describe("la colonne « lieux d'intervention »", () => {
  it("ne rend que les sites du périmètre du compte", async () => {
    // TÉMOIN — le client A1 porte DEUX sites, et le compte de portail restreint
    // à S1 ne doit en voir qu'un. Le second est celui du même client : *seul le
    // périmètre les sépare, ni la société ni le client ne le font.*
    const [temoin] = await clientOwner().$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM "site" WHERE client_id = $1::uuid`,
      CLIENT_A1,
    );
    expect(temoin!.n).toBeGreaterThan(1);

    // Le compte RESTREINT — une ligne de périmètre sur `SITE_A1_S1`.
    const vus = await sitesParClient(
      PORTAIL_A1,
      [{ id: CLIENT_A1 }],
      clientApp(),
    );
    expect(vus.get(CLIENT_A1)?.nombre).toBe(1);

    // LE CAS QUI DOIT RESTER VERT POUR SA PROPRE RAISON : un compte du MÊME
    // client, SANS ligne de périmètre, voit les deux sites. *Sans lui, une
    // jointure cassée qui rendrait toujours un seul site passerait l'épreuve
    // ci-dessus* (§9, 11/09). La borne vient donc bien du périmètre.
    const complet = await sitesParClient(
      PORTAIL_A1_SANS_RESTRICTION,
      [{ id: CLIENT_A1 }],
      clientApp(),
    );
    expect(complet.get(CLIENT_A1)?.nombre).toBe(temoin!.n);
    expect(SITE_A1_S2).not.toBe(SITE_A1_S1);
  });

  it("un client d'une AUTRE société rend zéro, jamais ses sites", async () => {
    const vus = await sitesParClient(
      INTERNE_A,
      [{ id: CLIENT_B1 }],
      clientApp(),
    );
    // La clé existe — l'écran doit pouvoir écrire « aucun lieu » plutôt que de
    // laisser une case vide —, et elle vaut zéro.
    expect(vus.get(CLIENT_B1)).toEqual({ nombre: 0, communes: [] });
  });

  it("une liste VIDE ne déclenche aucune requête et rend une carte vide", async () => {
    // *Un `IN ()` vide est une requête que PostgreSQL accepte et qui ne sert à
    // rien* : le cas est court-circuité, et l'épreuve le dit plutôt que de le
    // supposer.
    expect((await sitesParClient(INTERNE_A, [], clientApp())).size).toBe(0);
  });
});

describe("les dernières interventions d'un client", () => {
  it("un client d'une AUTRE société rend zéro ligne — la POLITIQUE décide", async () => {
    // **`client_id` est un SUJET, pas un cloisonnement.** Ce scénario le montre
    // en nommant un client de B depuis un contexte de A : si la clause
    // `client_id` était ce qui cloisonne, elle rendrait les interventions de ce
    // client. C'est la politique de forme « parc » qui rend zéro.
    const [temoin] = await clientOwner().$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM "intervention" WHERE client_id = $1::uuid`,
      CLIENT_B1,
    );
    expect(temoin!.n).toBeGreaterThan(0);

    const vues = await dernieresInterventionsDuClient(
      INTERNE_A,
      CLIENT_B1,
      20,
      clientApp(),
    );
    expect(vues).toEqual([]);
  });

  it("LE CAS QUI DOIT RESTER VERT POUR SA PROPRE RAISON : un client de SA société rend ses lignes", async () => {
    // Sans lui, une fonction qui rendrait TOUJOURS zéro passerait l'épreuve
    // ci-dessus — *le succès a-t-il bien la cause que je crois ?* (§9, 11/09).
    const [temoin] = await clientOwner().$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM "intervention" WHERE client_id = $1::uuid`,
      CLIENT_A1,
    );
    expect(temoin!.n).toBeGreaterThan(0);

    const vues = await dernieresInterventionsDuClient(
      INTERNE_A,
      CLIENT_A1,
      20,
      clientApp(),
    );
    expect(vues.length).toBe(temoin!.n);
    expect(vues.every((ligne) => ligne.client_id === CLIENT_A1)).toBe(true);
  });

  it("la BORNE tronque, et elle ne cloisonne pas", async () => {
    // Une borne d'affichage n'est jamais un filtre de sécurité : elle se lit
    // ici comme ce qu'elle est — le nombre de lignes qu'un écran montre.
    const une = await dernieresInterventionsDuClient(
      INTERNE_A,
      CLIENT_A1,
      1,
      clientApp(),
    );
    expect(une.length).toBeLessThanOrEqual(1);
  });

  it("un client qui n'existe NULLE PART rend zéro, sans lever", async () => {
    // Le même refus qu'un client hors périmètre : *les distinguer ferait un
    // oracle* (D35, D50).
    const vues = await dernieresInterventionsDuClient(
      INTERNE_A,
      "aaaaaaaa-0000-7000-8000-00000000beef",
      20,
      clientApp(),
    );
    expect(vues).toEqual([]);
  });

  it("CLIENT_A2 existe et n'est pas A1 — témoin de la fixture", async () => {
    // Témoin de non-vacuité de tout ce fichier : deux clients distincts dans la
    // même société. *Sans deux clients, « il n'en voit qu'un » ne mesure rien.*
    expect(CLIENT_A2).not.toBe(CLIENT_A1);
    const [temoin] = await clientOwner().$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM "client"
        WHERE societe_id = $1::uuid AND id = ANY(ARRAY[$2::uuid, $3::uuid])`,
      SOCIETE_A,
      CLIENT_A1,
      CLIENT_A2,
    );
    expect(temoin!.n).toBe(2);
  });
});
