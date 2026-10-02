import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { chargerCalendrierAgence } from "@/lib/calendar/agence";
import { jourDe, jourSuivant, maintenant } from "@/lib/calendar/fuseau";
import { prochainJourOuvert, type Calendrier } from "@/lib/calendar";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { cleDeJour } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9CP-PG-G14B-TRANSMETTRE-GROUPE (D141, paragraphe 14B) —
 * AVANT/APRÈS LE GESTE, SUR LE CODE LIVRÉ (même patron que
 * `captures-9co-pg-g14a-transmettre.spec.ts`).
 *
 * SA PROPRE SCÈNE, préfixée `PGG14BCAP-` — forgée en `beforeAll`, effacée en
 * `afterAll`, aucune ligne au semis (I9). « Demain » est calculé par le MÊME
 * oracle que `pg-g14b-transmettre-groupe.spec.ts`.
 *
 * **« Transmettre toutes les planifiées prêtes » n'est JAMAIS confirmé ici**
 * (ni dans aucun scénario de ce dépôt) : ce bouton agit sur TOUTES les
 * Planifiées prêtes de la société, y compris les données de démonstration du
 * semis — la confirmation RÉELLE polluerait la scène partagée. Seul le
 * dialogue de confirmation, ouvert, est capturé ; le compte-rendu qui suit
 * une transmission a la MÊME forme que celui de « Transmettre demain »,
 * capturé ci-dessous pour de vrai, et décrit dans le README plutôt que
 * reproduit une seconde fois.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_PGG14B ?? "";

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

const CLIENT_ID = uuidv7();
const SITE_ID = uuidv7();
// UNE PAIRE PAR LARGEUR (même raison que `captures-9co-pg-g14a-transmettre.spec.ts`) :
// le test de la vue « Transmettre demain » TRANSMET sa « prête », qui ne
// doit donc jamais être celle que le test de l'autre largeur attend encore.
const PRETES: Record<number, string> = { 1280: uuidv7(), 375: uuidv7() };
const LAISSEES: Record<number, string> = { 1280: uuidv7(), 375: uuidv7() };

let demainCle = "";

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });

    const aujourdhui = jourDe(maintenant(reperes.fuseau).local);
    const fenetre = {
      du: jourSuivant(aujourdhui),
      au: jourSuivant(aujourdhui, 16),
    };
    const agences = await client.agence.findMany({
      where: { societe_id: reperes.societeId },
      select: { id: true },
    });
    const calendriers = (
      await Promise.all(
        agences.map((a) =>
          chargerCalendrierAgence(client, {
            societeId: reperes.societeId,
            agenceId: a.id,
            fenetre,
          }),
        ),
      )
    ).filter((c): c is Calendrier => c !== null);
    const demain = prochainJourOuvert(calendriers, fenetre.du);
    demainCle = cleDeJour(demain);

    await client.client.create({
      data: {
        id: CLIENT_ID,
        societe_id: reperes.societeId,
        raison_sociale: "PGG14BCAP — client",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ID,
        societe_id: reperes.societeId,
        client_id: CLIENT_ID,
        agence_id: agence.id,
        libelle: "PGG14BCAP — site",
      },
    });
    for (const largeur of [1280, 375] as const) {
      await client.intervention.create({
        data: {
          id: PRETES[largeur],
          societe_id: reperes.societeId,
          agence_id: agence.id,
          client_id: CLIENT_ID,
          site_id: SITE_ID,
          technicien_id: reperes.technicienDucos,
          type: "curatif",
          priorite: "p3",
          statut: "planifiee",
          date_planifiee: new Date(`${demainCle}T00:00:00.000Z`),
          creneau_debut: new Date(`${demainCle}T08:00:00.000Z`),
          creneau_fin: new Date(`${demainCle}T09:00:00.000Z`),
          duree_estimee_min: 60,
          mode_valorisation: "temps_passe",
          devise_code: "XPF",
          description: "PGG14BCAP — prête, pour capture",
        },
      });
      await client.intervention.create({
        data: {
          id: LAISSEES[largeur],
          societe_id: reperes.societeId,
          agence_id: agence.id,
          client_id: CLIENT_ID,
          site_id: SITE_ID,
          technicien_id: null,
          type: "curatif",
          priorite: "p3",
          statut: "planifiee",
          date_planifiee: new Date(`${demainCle}T00:00:00.000Z`),
          creneau_debut: null,
          creneau_fin: null,
          duree_estimee_min: 60,
          mode_valorisation: "temps_passe",
          devise_code: "XPF",
          description: "PGG14BCAP — laissée, pour capture",
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
    await client.intervention.deleteMany({
      where: {
        id: { in: [...Object.values(PRETES), ...Object.values(LAISSEES)] },
      },
    });
    await client.site.deleteMany({ where: { id: SITE_ID } });
    await client.client.deleteMany({ where: { id: CLIENT_ID } });
  } finally {
    await client.$disconnect();
  }
});

for (const largeur of [1280, 375] as const) {
  test.describe(`à ${largeur}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 1100 });
      await ouvrirUneSession(page);
    });

    test(`capture — en-tête du planning, vue Semaine, avec les deux boutons, à ${largeur}px`, async ({
      page,
    }) => {
      await page.goto("/planning?vue=semaine");
      await expect(
        page.getByRole("button", {
          name: new RegExp(`^${fr["planning.transmettre_demain"]} `),
        }),
      ).toBeVisible();
      await capturer(page, `en-tete-semaine-${largeur}`);
    });

    test(`capture — en-tête du planning, vue Jour, avec les deux boutons, à ${largeur}px`, async ({
      page,
    }) => {
      await page.goto(`/planning?vue=jour&jour=${demainCle}`);
      await expect(
        page.getByRole("button", {
          name: new RegExp(
            `^${fr["planning.transmettre_toutes_les_planifiees_pretes"]} `,
          ),
        }),
      ).toBeVisible();
      await capturer(page, `en-tete-jour-${largeur}`);
    });

    test(`capture — dialogue « Transmettre demain » (case, laissée), puis compte-rendu après transmission, à ${largeur}px`, async ({
      page,
    }) => {
      await page.goto("/planning");
      await page
        .getByRole("button", {
          name: new RegExp(`^${fr["planning.transmettre_demain"]} `),
        })
        .click();
      const dialogue = page.locator("dialog[open]");
      await expect(dialogue).toBeVisible();
      await expect(
        dialogue.locator(`input[type="checkbox"][value="${PRETES[largeur]}"]`),
      ).toBeVisible();
      await expect(
        dialogue.locator(`a[href="/interventions/${LAISSEES[largeur]}"]`),
      ).toBeVisible();
      await capturer(page, `dialogue-transmettre-demain-${largeur}`);

      await dialogue
        .locator(`input[type="checkbox"][value="${PRETES[largeur]}"]`)
        .check();
      await dialogue
        .getByRole("button", {
          name: fr["planning.transmettre_demain.transmettre_la_selection"],
        })
        .click();
      await page.waitForLoadState("networkidle");
      await expect(
        page.locator("[data-compte-rendu-transmission]"),
      ).toBeVisible();
      await capturer(page, `compte-rendu-transmission-${largeur}`);
    });

    test(`capture — confirmation de « Transmettre toutes les planifiées prêtes », JAMAIS confirmée, à ${largeur}px`, async ({
      page,
    }) => {
      await page.goto("/planning");
      const bouton = page.getByRole("button", {
        name: new RegExp(
          `^${fr["planning.transmettre_toutes_les_planifiees_pretes"]} `,
        ),
      });
      await expect(bouton).toBeVisible();
      await bouton.click();
      const dialogue = page.locator("dialog[open]");
      await expect(dialogue).toBeVisible();
      await expect(dialogue.locator("p")).toContainText(
        fr["planning.transmission.confirmer_toutes_prefixe"],
      );
      await capturer(page, `confirmation-transmettre-toutes-${largeur}`);
      await dialogue
        .getByRole("button", { name: fr["planning.transmission.revenir"] })
        .click();
    });
  });
}
