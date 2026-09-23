import { afterAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { avecContexteApplicatif } from "@/lib/db/client";
import {
  compterSites,
  creerSiteDans,
  equipementsParSite,
  rechercherSites,
} from "@/lib/sites/depot";
import { schemaCreationSite, schemaRechercheSite } from "@/lib/sites/saisie";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  CLIENT_A1,
  PORTAIL_A_CLIENT,
  SITE_A1_S1,
  SITE_A1_S2,
  SITE_A2_S1,
  SITE_B1_S1,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_INTERNE_A,
} from "./setup/fixtures";

/**
 * LA RECHERCHE ET LA PAGINATION DE LA LISTE DES SITES, ÉPROUVÉES SUR LA VRAIE
 * TABLE (AT-07).
 *
 * Même discipline que `tests/isolation/ecran-client.test.ts` et
 * `tests/isolation/ecran-parc.test.ts` : `compterSites` réutilise la MÊME
 * `filtreDeRecherche` que `rechercherSites`, et la pagination (`skip`/`take`)
 * ne fait pas fuir le cloisonnement de forme « parc ».
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

const TOUT = schemaRechercheSite.parse({});

describe("le cloisonnement de la recherche des sites (AT-07)", () => {
  it("compterSites ne compte QUE la société active", async () => {
    const [temoin] = await clientOwner().$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM "site" WHERE societe_id = $1::uuid`,
      SOCIETE_A,
    );
    expect(temoin!.n).toBeGreaterThan(1);

    const vuDeA = await compterSites(INTERNE_A, TOUT, clientApp());
    expect(vuDeA).toBe(temoin!.n);
    const vuDeB = await compterSites(INTERNE_B, TOUT, clientApp());
    expect(vuDeA).not.toBe(vuDeB + vuDeA);
  });

  it("un compte de PORTAIL restreint à un site ne voit que CE site (D10, D22)", async () => {
    const fiches = await rechercherSites(PORTAIL_A1, TOUT, clientApp());
    const ids = fiches.map((f) => f.id);
    expect(ids).toEqual([SITE_A1_S1]);
    expect(ids).not.toContain(SITE_A1_S2);
    expect(ids).not.toContain(SITE_B1_S1);
  });
});

describe("la recherche des sites porte sur le libellé et la commune (colonnes visibles)", () => {
  it("trouve par libellé", async () => {
    const criteres = schemaRechercheSite.parse({ texte: "Site A1-1" });
    const fiches = await rechercherSites(INTERNE_A, criteres, clientApp());
    expect(fiches.map((f) => f.id)).toEqual([SITE_A1_S1]);
  });

  it("un texte qui ne correspond à rien rend une liste vide, jamais une erreur", async () => {
    const criteres = schemaRechercheSite.parse({
      texte: "zzz-aucun-site-ne-porte-ceci",
    });
    expect(await rechercherSites(INTERNE_A, criteres, clientApp())).toEqual([]);
    expect(await compterSites(INTERNE_A, criteres, clientApp())).toBe(0);
  });
});

describe("compterSites compte le total FILTRÉ, jamais le compte de la page", () => {
  it("une page d'une seule ligne ne fait pas bouger le total", async () => {
    const total = await compterSites(INTERNE_A, TOUT, clientApp());
    expect(total).toBeGreaterThan(1);

    const uneSeulePage = schemaRechercheSite.parse({ limite: 1, page: 1 });
    const fiches = await rechercherSites(INTERNE_A, uneSeulePage, clientApp());
    expect(fiches.length).toBe(1);
    expect(await compterSites(INTERNE_A, uneSeulePage, clientApp())).toBe(
      total,
    );
  });

  it("la page 2 rend la ligne SUIVANTE, jamais la même que la page 1", async () => {
    const page1 = await rechercherSites(
      INTERNE_A,
      schemaRechercheSite.parse({ limite: 1, page: 1 }),
      clientApp(),
    );
    const page2 = await rechercherSites(
      INTERNE_A,
      schemaRechercheSite.parse({ limite: 1, page: 2 }),
      clientApp(),
    );
    expect(page1.length).toBe(1);
    expect(page2.length).toBe(1);
    expect(page2[0]!.id).not.toBe(page1[0]!.id);
  });
});

/**
 * LE COMPTE D'ÉQUIPEMENTS, LE MASQUAGE PAR DÉFAUT, ET LA RECHERCHE PAR CLIENT
 * (LISTES-1, 23/09/2026).
 *
 * `SITE_A1_S1` porte `MACHINE_A1` ; `SITE_A2_S1` (client A2) n'en porte
 * aucune — le cas exact que la demande d'Alexis nomme.
 */
describe("equipementsParSite, le masquage par défaut et la recherche par client (LISTES-1)", () => {
  it("compte les équipements de CHAQUE site, zéro compris", async () => {
    const comptes = await equipementsParSite(
      INTERNE_A,
      [{ id: SITE_A1_S1 }, { id: SITE_A2_S1 }],
      clientApp(),
    );
    expect(comptes.get(SITE_A1_S1)).toBe(1);
    expect(comptes.get(SITE_A2_S1) ?? 0).toBe(0);
  });

  it("un compte de PORTAIL ne compte que ce qu'il a le droit de voir (D10, D22)", async () => {
    // PORTAIL_A1 est restreint à SITE_A1_S1 — un site hors périmètre rend
    // `0`, jamais une fuite d'un compte appartenant à un site qu'il ne peut
    // pas lire.
    const comptes = await equipementsParSite(
      PORTAIL_A1,
      [{ id: SITE_A1_S1 }, { id: SITE_A2_S1 }],
      clientApp(),
    );
    expect(comptes.get(SITE_A1_S1)).toBe(1);
    expect(comptes.get(SITE_A2_S1) ?? 0).toBe(0);
  });

  it("par défaut, un site sans équipement est masqué de la recherche", async () => {
    const parDefaut = schemaRechercheSite.parse({
      inclure_sans_equipement: false,
    });
    const fiches = await rechercherSites(INTERNE_A, parDefaut, clientApp());
    const ids = fiches.map((f) => f.id);
    expect(ids).toContain(SITE_A1_S1);
    expect(ids).not.toContain(SITE_A2_S1);
  });

  it("la case levée réaffiche les sites sans équipement", async () => {
    const tous = schemaRechercheSite.parse({ inclure_sans_equipement: true });
    const fiches = await rechercherSites(INTERNE_A, tous, clientApp());
    const ids = fiches.map((f) => f.id);
    expect(ids).toContain(SITE_A1_S1);
    expect(ids).toContain(SITE_A2_S1);
  });

  it("trouve un site par la raison sociale de son CLIENT", async () => {
    const criteres = schemaRechercheSite.parse({ texte: "Client A1" });
    const fiches = await rechercherSites(INTERNE_A, criteres, clientApp());
    const ids = fiches.map((f) => f.id);
    expect(ids).toContain(SITE_A1_S1);
    expect(ids).toContain(SITE_A1_S2);
    expect(ids).not.toContain(SITE_B1_S1);
  });
});

/**
 * `sous_contrat_seulement` (CONTRAT-SITE-1) — une comparaison DIRECTE sur
 * `site`, et non une clause de relation comme `inclure_sans_equipement`
 * ci-dessus, mais qui doit se COMPOSER avec le même filtre.
 *
 * **Un site POSÉ PAR LE SCÉNARIO, retiré en fin de test** — la leçon de
 * PASTILLES-1 (`tests/isolation/pastilles-habilitations.test.ts`) : un
 * scénario qui compte pose SON site, jamais une fixture partagée que
 * d'autres fichiers pourraient déjà avoir marquée.
 */
describe("sous_contrat_seulement (CONTRAT-SITE-1)", () => {
  it("filtre sur la colonne, et se compose avec les autres critères", async () => {
    // `creerSite`/`modifierSite` n'acceptent pas de `client` : ils passent
    // par le rôle applicatif réel (`DATABASE_URL`), que le harnais
    // d'isolation ne pose pas. `creerSiteDans`, elle, prend la transaction
    // en paramètre — le même chemin que `rechercherSites(…, clientApp())`
    // ci-dessus emprunte déjà pour LIRE.
    const fiche = await avecContexteApplicatif(
      INTERNE_A,
      (tx) =>
        creerSiteDans(
          tx,
          SOCIETE_A,
          schemaCreationSite.parse({
            client_id: CLIENT_A1,
            agence_id: AGENCE_A,
            libelle: "Site CONTRAT-SITE-1 (éprouve le filtre)",
          }),
        ),
      clientApp(),
    );
    // `false` par défaut, sans que la saisie de création l'ait mentionné :
    // c'est le défaut de la colonne en base qui répond, pas un défaut Zod.
    expect(fiche.sous_contrat).toBe(false);
    try {
      await avecContexteApplicatif(
        INTERNE_A,
        (tx) =>
          tx.site.update({
            where: { id: fiche.id },
            data: { sous_contrat: true },
          }),
        clientApp(),
      );

      const filtres = schemaRechercheSite.parse({
        sous_contrat_seulement: true,
      });
      const fiches = await rechercherSites(INTERNE_A, filtres, clientApp());
      const ids = fiches.map((f) => f.id);
      expect(ids).toContain(fiche.id);
      // SITE_A1_S1 n'est PAS sous contrat : le filtre l'écarte, sans quoi il
      // rendrait la liste entière au lieu de filtrer quoi que ce soit.
      expect(ids).not.toContain(SITE_A1_S1);

      const sansFiltre = schemaRechercheSite.parse({});
      const toutes = await rechercherSites(INTERNE_A, sansFiltre, clientApp());
      expect(toutes.map((f) => f.id)).toContain(SITE_A1_S1);
    } finally {
      await avecContexteApplicatif(
        INTERNE_A,
        (tx) => tx.site.delete({ where: { id: fiche.id } }),
        clientApp(),
      );
    }
  });
});
