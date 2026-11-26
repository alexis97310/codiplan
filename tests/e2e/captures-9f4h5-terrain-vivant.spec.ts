import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { cleJour, jourDe, maintenant } from "@/lib/calendar/fuseau";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { creneauLibreDepuis } from "./setup/creneaux";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_TECHNICIEN_EPREUVE, MOT_DE_PASSE_EPREUVE } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9F4H5-TERRAIN-VIVANT, aux deux largeurs exigées par le
 * ticket — fiche avec compteur qui tourne, Ma journée avec « Nouveau »
 * (ADAPTÉ par 9F4H5B-JOURNEE-SANS-MONTANT, point 2 : la pastille « Nouvelle »,
 * tenue par une mémoire locale à l'appareil, a été retirée au profit de la
 * seule pastille serveur), bandeau du compteur. Silencieuses sous `pnpm
 * test:e2e` ordinaire (même
 * interrupteur `CAPTURES_9F4H5` que les autres fichiers `captures-*`) ;
 * `pnpm verify`/`verify:full` ne les déclenchent pas.
 *
 * SA PROPRE SCÈNE, préfixée `9F4H5CAP-`, forgée en `beforeAll`, effacée en
 * `afterAll`, aucune ligne au semis (I9) — UNE PAIRE D'INTERVENTIONS PAR
 * LARGEUR (même convention que `captures-9co-pg-g14a-transmettre.spec.ts`) :
 * démarrer le compteur ou transmettre laisse une trace IRRÉVERSIBLE côté
 * serveur (segment ouvert, statut passé à Affectée) — rejouer le même geste
 * une seconde fois, pour l'autre largeur, sur la MÊME ligne échouerait.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9F4H5 ?? "";

async function capturer(page: Page, nom: string): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({ path: join(DOSSIER, `${nom}.png`), fullPage: true });
}

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

async function ouvrirLaSessionDuTerrain(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/terrain$/);
}

const CLIENT_ID = uuidv7();

const LARGEURS = [1280, 375] as const;

const SITES_COMPTEUR: Record<number, string> = {
  1280: uuidv7(),
  375: uuidv7(),
};
const SITES_NOUVELLE: Record<number, string> = {
  1280: uuidv7(),
  375: uuidv7(),
};
const INTERVENTIONS_COMPTEUR: Record<number, string> = {
  1280: uuidv7(),
  375: uuidv7(),
};
const INTERVENTIONS_NOUVELLE: Record<number, string> = {
  1280: uuidv7(),
  375: uuidv7(),
};

function libelleSiteNouvelle(largeur: number): string {
  return `${fr["terrain9f4h5.e2e.site_nouvelle"]} ${largeur}`;
}

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    const aujourdHui = jourDe(maintenant(reperes.fuseau).local);
    const cle = cleJour(aujourdHui);
    const commun = {
      societe_id: reperes.societeId,
      agence_id: agence.id,
      client_id: CLIENT_ID,
      technicien_id: reperes.technicienDucos,
      type: "curatif" as const,
      priorite: "p3" as const,
      date_planifiee: new Date(`${cle}T00:00:00.000Z`),
      duree_estimee_min: 60,
      mode_valorisation: "temps_passe" as const,
      devise_code: "XPF",
      description: "9F4H5CAP — capture",
    };
    // UNE HEURE PAR LIGNE (9L19, garde `intervention_sans_chevauchement_
    // technicien`) : quatre lignes (compteur + nouvelle, par largeur)
    // partagent le même technicien, le même jour. Ni 20 (9L32A, mesuré un
    // LUNDI : `PLANIFIEE_SEULE`, `affichage-materiel.spec.ts`, réserve
    // 07:00–08:00 de DEMAIN), ni 21, 22 ou 23 (9L31B puis 9L32A : `obstacle`
    // réserve 08:00–10:00 et `AVEC_MACHINE` 10:00–11:00 de DEMAIN —
    // `creneauUtc` bascule le jour local dès l'heure UTC 13) — ces fenêtres
    // ne se réservent que quand `demain` tombe sur MARDI de la scène
    // (aujourd'hui déjà lundi).
    const creneauxParLargeur: Record<number, readonly [number, number]> = {
      1280: [15, 18],
      375: [19, 16],
    };

    await client.client.create({
      data: {
        id: CLIENT_ID,
        societe_id: reperes.societeId,
        raison_sociale: fr["terrain9f4h5.e2e.client"],
        actif: true,
      },
    });
    for (const largeur of LARGEURS) {
      await client.site.createMany({
        data: [
          {
            id: SITES_COMPTEUR[largeur],
            societe_id: reperes.societeId,
            client_id: CLIENT_ID,
            agence_id: agence.id,
            libelle: `${fr["terrain9f4h5.e2e.site_compteur"]} ${largeur}`,
          },
          {
            id: SITES_NOUVELLE[largeur],
            societe_id: reperes.societeId,
            client_id: CLIENT_ID,
            agence_id: agence.id,
            libelle: libelleSiteNouvelle(largeur),
          },
        ],
      });
      const [heureCompteur, heureNouvelle] = creneauxParLargeur[largeur];
      await client.intervention.create({
        data: {
          id: INTERVENTIONS_COMPTEUR[largeur],
          site_id: SITES_COMPTEUR[largeur],
          statut: "affectee",
          ...commun,
          ...(await creneauLibreDepuis(
            client,
            reperes.societeId,
            reperes.technicienDucos,
            new Date(
              `${cle}T${String(heureCompteur).padStart(2, "0")}:00:00.000Z`,
            ),
            60,
          )),
        },
      });
      // PLANIFIEE — invisible du terrain tant qu'elle n'est pas transmise
      // (D141 14C), exactement comme 9DD-PG-G14C-TERRAIN-TRANSMISES.
      await client.intervention.create({
        data: {
          id: INTERVENTIONS_NOUVELLE[largeur],
          site_id: SITES_NOUVELLE[largeur],
          statut: "planifiee",
          ...commun,
          ...(await creneauLibreDepuis(
            client,
            reperes.societeId,
            reperes.technicienDucos,
            new Date(
              `${cle}T${String(heureNouvelle).padStart(2, "0")}:00:00.000Z`,
            ),
            60,
          )),
        },
      });
    }
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    const ids = [
      ...Object.values(INTERVENTIONS_COMPTEUR),
      ...Object.values(INTERVENTIONS_NOUVELLE),
    ];
    await client.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = ANY($1::uuid[])`,
      ids,
    );
    await client.intervention.deleteMany({ where: { id: { in: ids } } });
    await client.site.deleteMany({
      where: {
        id: {
          in: [
            ...Object.values(SITES_COMPTEUR),
            ...Object.values(SITES_NOUVELLE),
          ],
        },
      },
    });
    await client.client.deleteMany({ where: { id: CLIENT_ID } });
  } finally {
    await client.$disconnect();
  }
});

for (const largeur of LARGEURS) {
  test.describe(`à ${largeur}px`, () => {
    test(`capture — fiche avec compteur qui tourne, bandeau sur Ma journée, « Nouveau », à ${largeur}px`, async ({
      page,
      browser,
    }) => {
      await page.setViewportSize({ width: largeur, height: 1100 });
      await ouvrirLaSessionDuTerrain(page);

      // ── LA FICHE, COMPTEUR EN MARCHE (point 1) ──────────────────────────
      await page.goto(`/terrain/${INTERVENTIONS_COMPTEUR[largeur]}`);
      await page
        .getByRole("button", { name: fr["terrain.compteur.demarrer"] })
        .click();
      await expect(
        page.getByRole("button", { name: fr["terrain.compteur.pause"] }),
      ).toBeVisible();
      await page.waitForTimeout(2_000);
      await capturer(page, `fiche-compteur-${largeur}`);

      // ── LE BANDEAU, SUR MA JOURNÉE (point 1) ────────────────────────────
      await page.goto("/terrain");
      await expect(
        page.getByRole("link", {
          name: new RegExp(fr["terrain.compteur.bandeau_prefixe"]),
        }),
      ).toBeVisible();
      await capturer(page, `bandeau-compteur-${largeur}`);

      // UN SEUL COMPTEUR À LA FOIS, PAR PERSONNE (R5-02) — l'arrêter ici
      // libère l'intervention de LA LARGEUR SUIVANTE, qui démarrera le
      // sien sous la MÊME identité (`COMPTE_TECHNICIEN_EPREUVE`).
      await page.goto(`/terrain/${INTERVENTIONS_COMPTEUR[largeur]}`);
      await page
        .getByRole("button", { name: fr["terrain.compteur.pause"] })
        .click();
      await expect(
        page.getByRole("button", { name: fr["terrain.compteur.reprendre"] }),
      ).toBeVisible();

      // ── « NOUVELLE INTERVENTION », SUR MA JOURNÉE (point 3, pastille
      // « Nouveau » serveur depuis 9F4H5B-JOURNEE-SANS-MONTANT) ───────────
      const pageBureau = await browser.newPage();
      await ouvrirUneSession(pageBureau);
      await pageBureau.goto(
        `/interventions/${INTERVENTIONS_NOUVELLE[largeur]}`,
      );
      await pageBureau
        .getByRole("button", { name: fr["intervention.action.transmettre"] })
        .click();
      await pageBureau
        .locator("dialog[open]")
        .getByRole("button", { name: fr["intervention.action.transmettre"] })
        .click();
      await pageBureau.waitForLoadState("networkidle");
      await pageBureau.close();

      await page.goto("/terrain");
      await page.evaluate(() => window.dispatchEvent(new Event("online")));
      const carte = page.locator("li", {
        hasText: libelleSiteNouvelle(largeur),
      });
      await expect(
        carte.getByText(fr["terrain.badge_nouveau"], { exact: true }),
      ).toBeVisible();
      await capturer(page, `ma-journee-nouveau-${largeur}`);
    });
  });
}
