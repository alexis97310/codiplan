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
 * LES CAPTURES DE 9DB-RETOUCHES-10 — AVANT/APRÈS, SUR LE CODE LIVRÉ (même
 * patron que `captures-9cp-pg-g14b-transmettre-groupe.spec.ts`).
 *
 * SA PROPRE SCÈNE, préfixée `9DBCAP —`, forgée en `beforeAll`, effacée en
 * `afterAll`, aucune ligne au semis (I9). « Demain » est calculé par le MÊME
 * oracle que `pg-g14b-transmettre-groupe.spec.ts`.
 *
 * **Le canal de courriel n'est pas configuré dans cet environnement
 * d'épreuve** (`COURRIEL_API_CLE`/`COURRIEL_EXPEDITEUR` absentes) — c'est
 * EXACTEMENT le cas constaté en production le 03/10/2026, et c'est ce que la
 * capture du compte-rendu doit montrer : « L'envoi de courriel n'est pas
 * configuré… », jamais la phrase d'échec générique.
 *
 * **« Transmettre toutes les planifiées prêtes » n'est JAMAIS confirmé ici**
 * (ni dans aucun scénario de ce dépôt) : ce bouton agit sur TOUTES les
 * Planifiées prêtes de la société. Le nombre affiché dans la capture de la
 * confirmation dépend donc de l'état complet de la société au moment de
 * l'exécution — « 1 planifiée prête » n'est garanti que si ce fichier
 * s'exécute SEUL (aucun autre scénario ne doit, au même instant, laisser une
 * Planifiée prête dans cette société) ; sous `fullyParallel`, le nombre peut
 * différer sans que ce soit un défaut (même mise en garde que
 * `captures-9cp-pg-g14b-transmettre-groupe.spec.ts`).
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9DB ?? "";

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
// UNE PAIRE PAR LARGEUR (même raison que `captures-9cp-pg-g14b-transmettre-groupe.spec.ts`) :
// le test qui transmet via « Transmettre demain » consomme sa « prête »,
// qui ne doit donc jamais être celle que l'autre largeur attend encore.
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
        raison_sociale: "9DBCAP — client",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ID,
        societe_id: reperes.societeId,
        client_id: CLIENT_ID,
        agence_id: agence.id,
        libelle: "9DBCAP — site",
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
          description: "9DBCAP — prête, pour capture",
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
          description: "9DBCAP — laissée, pour capture",
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

    test(`capture — compte-rendu après transmission, canal de courriel non configuré, à ${largeur}px`, async ({
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
      await dialogue
        .locator(`input[type="checkbox"][value="${PRETES[largeur]}"]`)
        .check();
      await dialogue
        .getByRole("button", {
          name: fr["planning.transmettre_demain.transmettre_la_selection"],
        })
        .click();
      await page.waitForLoadState("networkidle");

      const bandeau = page.locator("[data-compte-rendu-transmission]");
      await expect(bandeau).toBeVisible();
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
