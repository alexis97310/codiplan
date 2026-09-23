import { afterAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import {
  compterLeParc,
  optionsDeFiltreDuParc,
  rechercherLeParc,
  resumerLeParcFiltre,
} from "@/lib/machines/depot";
import { schemaRechercheParc } from "@/lib/machines/saisie";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  CLIENT_A1,
  CLIENT_A2,
  FAMILLE_A,
  FAMILLE_A_AILLEURS,
  MACHINE_A1,
  MACHINE_A2,
  MACHINE_A3,
  MACHINE_B1,
  PORTAIL_A_CLIENT,
  SITE_A1_S1,
  SITE_A1_S2,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_INTERNE_A,
} from "./setup/fixtures";

/**
 * LA RECHERCHE, LE TOTAL ET LE RÉSUMÉ DU PARC, ÉPROUVÉS SUR LA VRAIE TABLE
 * (AT-07).
 *
 * `parc.test.ts` (unitaire) éprouve `resumerLeParc`, la fonction PURE, sur des
 * lignes fabriquées. Ce fichier-ci éprouve les TROIS LECTURES que la
 * pagination a fait naître, sous la politique de forme « parc » réelle :
 *
 *   1. `rechercherLeParc` — le texte cherche sur des colonnes VISIBLES
 *      (numéro de série, client), et la pagination (`skip`/`take`) est
 *      posée dans le dépôt ;
 *   2. `compterLeParc` — le total FILTRÉ, jamais le compte de la page ;
 *   3. `resumerLeParcFiltre` — le résumé suit la MÊME recherche, jamais la
 *      seule page affichée.
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

const TOUT = schemaRechercheParc.parse({});
const MAINTENANT = new Date("2026-09-17T00:00:00Z");

describe("le cloisonnement de la recherche du parc (AT-07)", () => {
  it("compterLeParc ne compte QUE la société active", async () => {
    const [temoin] = await clientOwner().$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM "machine" WHERE societe_id = $1::uuid`,
      SOCIETE_A,
    );
    expect(temoin!.n).toBeGreaterThan(1);

    const vuDeA = await compterLeParc(INTERNE_A, TOUT, clientApp());
    expect(vuDeA).toBe(temoin!.n);
    // Jamais la somme des deux sociétés — la faute qu'un `count` sans
    // contexte commettrait, et qui se lirait comme un chiffre plausible.
    const vuDeB = await compterLeParc(INTERNE_B, TOUT, clientApp());
    expect(vuDeA).not.toBe(vuDeB + vuDeA);
  });

  it("un compte de PORTAIL ne voit que le parc de SON périmètre (D10, D22)", async () => {
    // TÉMOIN — MACHINE_A2 et MACHINE_A3 sont posées sur SITE_A1_S2, hors du
    // périmètre restreint à SITE_A1_S1 de PORTAIL_A1 ; MACHINE_A1 y est.
    const fiches = await rechercherLeParc(PORTAIL_A1, TOUT, clientApp());
    const ids = fiches.map((f) => f.id);
    expect(ids).toContain(MACHINE_A1);
    expect(ids).not.toContain(MACHINE_A2);
    expect(ids).not.toContain(MACHINE_A3);
    expect(ids).not.toContain(MACHINE_B1);
  });
});

describe("la recherche du parc porte sur des colonnes VISIBLES (AT-07)", () => {
  it("trouve par numéro de série", async () => {
    const criteres = schemaRechercheParc.parse({ texte: "SN-A1" });
    const fiches = await rechercherLeParc(INTERNE_A, criteres, clientApp());
    expect(fiches.map((f) => f.id)).toEqual([MACHINE_A1]);
  });

  it("trouve par raison sociale du client", async () => {
    const criteres = schemaRechercheParc.parse({ texte: "Client A1" });
    const fiches = await rechercherLeParc(INTERNE_A, criteres, clientApp());
    const ids = fiches.map((f) => f.id);
    expect(ids).toContain(MACHINE_A1);
    expect(ids).toContain(MACHINE_A2);
  });

  it("un texte qui ne correspond à rien rend une liste vide, jamais une erreur", async () => {
    const criteres = schemaRechercheParc.parse({
      texte: "zzz-aucune-machine-ne-porte-ceci",
    });
    expect(await rechercherLeParc(INTERNE_A, criteres, clientApp())).toEqual(
      [],
    );
    expect(await compterLeParc(INTERNE_A, criteres, clientApp())).toBe(0);
  });
});

describe("compterLeParc compte le total FILTRÉ, jamais le compte de la page", () => {
  it("une page d'une seule ligne ne fait pas bouger le total", async () => {
    const total = await compterLeParc(INTERNE_A, TOUT, clientApp());
    expect(total).toBeGreaterThan(1);

    const page1 = await rechercherLeParc(
      INTERNE_A,
      schemaRechercheParc.parse({ page: 1 }),
      clientApp(),
    );
    const page2 = await rechercherLeParc(
      INTERNE_A,
      schemaRechercheParc.parse({ page: 2 }),
      clientApp(),
    );
    expect(await compterLeParc(INTERNE_A, TOUT, clientApp())).toBe(total);
    // Deux pages distinctes ne se recouvrent pas — c'est tout l'intérêt de
    // `skip`/`take` posés dans le dépôt plutôt que découpés dans le composant.
    const idsPage1 = new Set(page1.map((f) => f.id));
    for (const fiche of page2) {
      expect(idsPage1.has(fiche.id)).toBe(false);
    }
  });
});

describe("resumerLeParcFiltre suit la MÊME recherche que la liste (AT-07)", () => {
  it("un résumé restreint par le texte ne compte que les fiches qui correspondent", async () => {
    const tout = await resumerLeParcFiltre(
      INTERNE_A,
      TOUT,
      MAINTENANT,
      clientApp(),
    );
    const filtre = await resumerLeParcFiltre(
      INTERNE_A,
      schemaRechercheParc.parse({ texte: "SN-A1" }),
      MAINTENANT,
      clientApp(),
    );
    expect(filtre.total).toBe(1);
    expect(filtre.total).toBeLessThan(tout.total);
  });
});

/**
 * LES TROIS FILTRES COMBINABLES DE LISTES-1 (23/09/2026) — client, site,
 * famille, aux côtés du statut déjà éprouvé plus haut.
 */
describe("les trois filtres combinables du parc (LISTES-1)", () => {
  it("filtre par client", async () => {
    const criteres = schemaRechercheParc.parse({ client_id: CLIENT_A1 });
    const fiches = await rechercherLeParc(INTERNE_A, criteres, clientApp());
    const ids = fiches.map((f) => f.id);
    expect(ids).toContain(MACHINE_A1);
    expect(ids).toContain(MACHINE_A2);
    expect(ids).not.toContain(MACHINE_B1);
  });

  it("filtre par site", async () => {
    const criteres = schemaRechercheParc.parse({ site_id: SITE_A1_S1 });
    const fiches = await rechercherLeParc(INTERNE_A, criteres, clientApp());
    const ids = fiches.map((f) => f.id);
    expect(ids).toEqual([MACHINE_A1]);
  });

  it("filtre par famille", async () => {
    const criteres = schemaRechercheParc.parse({ famille_id: FAMILLE_A });
    const fiches = await rechercherLeParc(INTERNE_A, criteres, clientApp());
    const ids = fiches.map((f) => f.id);
    expect(ids).toContain(MACHINE_A1);
    expect(ids).toContain(MACHINE_A2);
    // MACHINE_A3 suit MODELE_A_AILLEURS, d'une AUTRE famille (D93).
    expect(ids).not.toContain(MACHINE_A3);
  });

  it("les trois filtres SE COMBINENT — client ET site ET famille", async () => {
    const criteres = schemaRechercheParc.parse({
      client_id: CLIENT_A1,
      site_id: SITE_A1_S2,
      famille_id: FAMILLE_A_AILLEURS,
    });
    const fiches = await rechercherLeParc(INTERNE_A, criteres, clientApp());
    // MACHINE_A3 est le SEUL exemplaire qui satisfait les trois critères à
    // la fois — MACHINE_A2 est sur le même site mais une autre famille.
    expect(fiches.map((f) => f.id)).toEqual([MACHINE_A3]);
  });

  it("un site d'une AUTRE société ne filtre rien qui existe (aucune fuite)", async () => {
    const criteres = schemaRechercheParc.parse({ client_id: CLIENT_A2 });
    const fiches = await rechercherLeParc(INTERNE_A, criteres, clientApp());
    // CLIENT_A2 n'a aucune machine dans le jeu de fixtures.
    expect(fiches).toEqual([]);
  });
});

/**
 * LES OPTIONS DES TROIS FILTRES — jamais le référentiel entier, et
 * CLOISONNÉES comme le reste (D10, D22, D93).
 */
describe("optionsDeFiltreDuParc (LISTES-1)", () => {
  it("ne propose que les clients, sites et familles qui ont au moins une machine", async () => {
    const options = await optionsDeFiltreDuParc(INTERNE_A, clientApp());
    const clientIds = options.clients.map((c) => c.id);
    expect(clientIds).toContain(CLIENT_A1);
    // CLIENT_A2 n'a aucune machine : il n'a rien à faire dans ce filtre.
    expect(clientIds).not.toContain(CLIENT_A2);
    const familleIds = options.familles.map((f) => f.id);
    expect(familleIds).toContain(FAMILLE_A);
    expect(familleIds).toContain(FAMILLE_A_AILLEURS);
  });

  it("un compte de PORTAIL restreint à UN site n'y voit QUE ce que son périmètre lui montre (D93)", async () => {
    const options = await optionsDeFiltreDuParc(PORTAIL_A1, clientApp());
    // MACHINE_A3 (FAMILLE_A_AILLEURS) vit sur SITE_A1_S2, hors du périmètre
    // du compte portail restreint à SITE_A1_S1 — c'est le jumeau nommé par
    // D93 : « ni la notice, ni son existence, ni un compteur à zéro qui la
    // trahirait ».
    const familleIds = options.familles.map((f) => f.id);
    expect(familleIds).toContain(FAMILLE_A);
    expect(familleIds).not.toContain(FAMILLE_A_AILLEURS);
    const siteIds = options.sites.map((s) => s.id);
    expect(siteIds).toEqual([SITE_A1_S1]);
  });
});
