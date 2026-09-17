import { afterAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import {
  compterLeParc,
  rechercherLeParc,
  resumerLeParcFiltre,
} from "@/lib/machines/depot";
import { schemaRechercheParc } from "@/lib/machines/saisie";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  CLIENT_A1,
  MACHINE_A1,
  MACHINE_A2,
  MACHINE_A3,
  MACHINE_B1,
  PORTAIL_A_CLIENT,
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
