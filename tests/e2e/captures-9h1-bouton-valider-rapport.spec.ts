import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { COMPTE_RM_EPREUVE, MOT_DE_PASSE_EPREUVE } from "./setup/scene";
import { reperesDeLaScene } from "./setup/reperes";

/**
 * CAPTURES DE L'ONGLET RAPPORT — « Valider le rapport » et son effet
 * (9H1-RAPPORT-VALIDE-AVANT-CLOTURE, point ouvert n° 5 de la passation).
 *
 * `AvantDeCloturer` (onglet Résumé) a déjà ses captures AVANT/APRÈS
 * (`zz-captures-9h1-rapport-valide.spec.ts`) ; ce fichier capture le SEUL
 * écran qui restait : l'onglet Rapport, où le rapport lui-même se lit, AVANT
 * (bouton « Valider le rapport » visible, geste permis) et APRÈS (le bouton a
 * disparu — même régime que « Reprendre ») avoir validé.
 *
 * SA PROPRE SCÈNE, préfixée `9H1BTN-` — UNE intervention PAR largeur (le
 * geste de validation n'est pas réversible à l'écran : rejouer la capture
 * « avant » sur la même ligne après l'avoir validée mentirait).
 */
test.describe.configure({ mode: "serial" });

const CLIENT_9H1BTN = uuidv7();
const SITE_9H1BTN = uuidv7();

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

async function creerLIntervention(
  client: PrismaClient,
  societeId: string,
  agenceId: string,
  technicienId: string,
): Promise<string> {
  const id = uuidv7();
  await client.intervention.create({
    data: {
      id,
      societe_id: societeId,
      client_id: CLIENT_9H1BTN,
      site_id: SITE_9H1BTN,
      agence_id: agenceId,
      technicien_id: technicienId,
      type: "curatif",
      statut: "terminee",
      date_planifiee: new Date("2026-10-20T00:00:00Z"),
      duree_estimee_min: 60,
      commentaire_technicien: fr["terrain.e2e.commentaire"],
    },
  });
  await client.$executeRawUnsafe(
    `INSERT INTO "segment_travail" ("id","societe_id","intervention_id","utilisateur_id","debut","fin","modifie_le")
     VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, now() - interval '90 minutes', now(), now())`,
    societeId,
    id,
    technicienId,
  );
  await client.intervention.update({
    where: { id },
    data: { temps_mesure_min: 90 },
  });
  return id;
}

const interventionParLargeur = new Map<number, string>();

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });

    await client.client.create({
      data: {
        id: CLIENT_9H1BTN,
        societe_id: reperes.societeId,
        raison_sociale: "9H1BTN client",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9H1BTN,
        societe_id: reperes.societeId,
        client_id: CLIENT_9H1BTN,
        agence_id: agence.id,
        libelle: "9H1BTN site",
      },
    });

    for (const largeur of [1280, 375] as const) {
      const id = await creerLIntervention(
        client,
        reperes.societeId,
        agence.id,
        reperes.technicienDucos,
      );
      interventionParLargeur.set(largeur, id);
    }
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = ANY($1::uuid[])`,
      [...interventionParLargeur.values()],
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_9H1BTN,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_9H1BTN } });
    await client.client.deleteMany({ where: { id: CLIENT_9H1BTN } });
  } finally {
    await client.$disconnect();
  }
});

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9H1-RAPPORT-VALIDE-AVANT-CLOTURE/captures",
);

/** EN VIEWPORT, sans `fullPage` : ce qui est visible sans défiler. */
async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
  });
}

for (const largeur of [1280, 375] as const) {
  test(`onglet Rapport, bouton « Valider le rapport » puis sa disparition, à ${largeur}px`, async ({
    page,
  }) => {
    const id = interventionParLargeur.get(largeur);
    if (id === undefined) {
      throw new Error("intervention absente pour cette largeur");
    }

    await page.setViewportSize({ width: largeur, height: 1000 });
    await page.goto("/connexion");
    await page.getByLabel(fr["connexion.email"]).fill(COMPTE_RM_EPREUVE);
    await page
      .getByLabel(fr["connexion.mot_de_passe"])
      .fill(MOT_DE_PASSE_EPREUVE);
    await page.getByRole("button", { name: fr["connexion.valider"] }).click();
    await expect(page).toHaveURL(/\/planning/);

    await page.goto(`/interventions/${id}?onglet=rapport`);
    const boutonValider = page.getByRole("button", {
      name: fr["intervention.action.valider_rapport"],
    });
    await expect(boutonValider).toBeVisible();
    await capturer(page, "rapport-avant-validation", largeur);

    await boutonValider.click();
    await page.goto(`/interventions/${id}?onglet=rapport`);
    await expect(boutonValider).toHaveCount(0);
    await capturer(page, "rapport-apres-validation", largeur);
  });
}
