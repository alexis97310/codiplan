import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { jourDe, jourSuivant, maintenant } from "@/lib/calendar/fuseau";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { cleDeJour } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9CT-RETOUCHES-5 (D141, paragraphe RETOUCHES-5, point 7) —
 * AVANT/APRÈS LE GESTE, SUR LE CODE LIVRÉ (même patron que
 * `captures-9cp-pg-g14b-transmettre-groupe.spec.ts`).
 *
 * SA PROPRE SCÈNE, préfixée `9CTCAP-` — forgée en `beforeAll`, effacée en
 * `afterAll`, aucune ligne au semis (I9). Deux Planifiées complètes
 * (technicien, heure, durée) : une À VENIR, une PASSÉE — seule la date les
 * distingue, pour que la capture prouve le motif `date_passee` et rien
 * d'autre.
 *
 * **« Transmettre toutes les planifiées prêtes » n'est JAMAIS confirmé ici**
 * (ni dans aucun scénario de ce dépôt) : ce bouton agit sur TOUTES les
 * Planifiées prêtes de la société, y compris les données de démonstration du
 * semis — la confirmation RÉELLE polluerait la scène partagée. Seul le
 * dialogue de confirmation, ouvert, est capturé.
 *
 * AVANT/APRÈS se prend en rejouant ce même fichier deux fois (`git
 * worktree`, une fois sur le code d'avant ce lot, une fois sur le code
 * livré) : avant ce lot, la Planifiée PASSÉE comptait parmi les prêtes et
 * n'apparaissait jamais dans les laissées — c'est ce changement que les
 * deux jeux de captures montrent.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9CT ?? "";

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-${largeur}.png`),
    fullPage: true,
  });
}

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const CLIENT_ID = uuidv7();
const SITE_ID = uuidv7();
// UNE PAIRE PAR LARGEUR (même raison que `captures-9cp-pg-g14b-transmettre-groupe.spec.ts`) :
// une capture ne doit jamais dépendre d'une ligne que l'autre largeur a déjà
// regardée sous un état différent.
const PRETE_A_VENIR: Record<number, string> = { 1280: uuidv7(), 375: uuidv7() };
const PASSEE: Record<number, string> = { 1280: uuidv7(), 375: uuidv7() };

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    const aujourdhui = jourDe(maintenant(reperes.fuseau).local);
    // Franchement dans le futur et franchement dans le passé — à l'écart de
    // toute ambiguïté de fuseau à l'heure de la bascule.
    const cleAVenir = cleDeJour(jourSuivant(aujourdhui, 5));
    const cleePassee = cleDeJour(jourSuivant(aujourdhui, -5));

    await client.client.create({
      data: {
        id: CLIENT_ID,
        societe_id: reperes.societeId,
        raison_sociale: "9CTCAP — client",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ID,
        societe_id: reperes.societeId,
        client_id: CLIENT_ID,
        agence_id: agence.id,
        libelle: "9CTCAP — site",
      },
    });
    for (const largeur of [1280, 375] as const) {
      await client.intervention.create({
        data: {
          id: PRETE_A_VENIR[largeur],
          societe_id: reperes.societeId,
          agence_id: agence.id,
          client_id: CLIENT_ID,
          site_id: SITE_ID,
          technicien_id: reperes.technicienDucos,
          type: "curatif",
          priorite: "p3",
          statut: "planifiee",
          date_planifiee: new Date(`${cleAVenir}T00:00:00.000Z`),
          creneau_debut: new Date(`${cleAVenir}T08:00:00.000Z`),
          creneau_fin: new Date(`${cleAVenir}T09:00:00.000Z`),
          duree_estimee_min: 60,
          mode_valorisation: "temps_passe",
          devise_code: "XPF",
          description: "9CTCAP — prête à venir, pour capture",
        },
      });
      await client.intervention.create({
        data: {
          id: PASSEE[largeur],
          societe_id: reperes.societeId,
          agence_id: agence.id,
          client_id: CLIENT_ID,
          site_id: SITE_ID,
          technicien_id: reperes.technicienDucos,
          type: "curatif",
          priorite: "p3",
          statut: "planifiee",
          date_planifiee: new Date(`${cleePassee}T00:00:00.000Z`),
          creneau_debut: new Date(`${cleePassee}T08:00:00.000Z`),
          creneau_fin: new Date(`${cleePassee}T09:00:00.000Z`),
          duree_estimee_min: 60,
          mode_valorisation: "temps_passe",
          devise_code: "XPF",
          description: "9CTCAP — complète mais passée, pour capture",
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
        id: { in: [...Object.values(PRETE_A_VENIR), ...Object.values(PASSEE)] },
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
      await page.setViewportSize({ width: largeur, height: 1200 });
      await ouvrirUneSession(page);
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
      await capturer(page, "confirmation-transmettre-toutes", largeur);
      await dialogue
        .getByRole("button", { name: fr["planning.transmission.revenir"] })
        .click();
    });

    test(`capture — la rangée de commandes et la liste des laissées, à ${largeur}px`, async ({
      page,
    }) => {
      // AUCUNE ASSERTION SUR LA PRÉSENCE DE LA PASSÉE DANS LES LAISSÉES —
      // c'est précisément ce que ce lot change (D141, point 7) : capturer la
      // même requête AVANT et APRÈS doit documenter les deux comportements,
      // jamais imposer celui d'APRÈS au worktree d'AVANT.
      await page.goto("/planning");
      await expect(
        page.getByRole("button", {
          name: new RegExp(
            `^${fr["planning.transmettre_toutes_les_planifiees_pretes"]} `,
          ),
        }),
      ).toBeVisible();
      await capturer(page, "laissees-date-passee", largeur);
    });
  });
}
