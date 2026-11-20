import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_TECHNICIEN_EPREUVE, MOT_DE_PASSE_EPREUVE } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9L14-FIGE-A-LA-CLOTURE (décision d'Alexis du 10/11/2026, précisant I5) —
 * DE BOUT EN BOUT.
 *
 * Un technicien reste hors réseau pendant que le bureau clôture son
 * intervention ; sa signature, tentée pendant la coupure, part en file —
 * au retour du réseau, elle est refusée et GARDÉE, jamais perdue. Le
 * bureau la retrouve en lecture sur la fiche.
 *
 * SA PROPRE SCÈNE, préfixée `9L14-` — jamais le semis partagé, pour ne pas
 * clôturer une intervention qu'un autre fichier suppose vivante.
 */
test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const CLIENT_9L14 = uuidv7();
const SITE_9L14 = uuidv7();
const INTERVENTION_9L14 = uuidv7();

let societeId: string;
let technicienId: string;

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  societeId = reperes.societeId;
  technicienId = reperes.technicienDucos;
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societeId, code: "DUCOS" },
      select: { id: true },
    });
    await client.client.create({
      data: {
        id: CLIENT_9L14,
        societe_id: societeId,
        raison_sociale: "9L14 client",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9L14,
        societe_id: societeId,
        client_id: CLIENT_9L14,
        agence_id: agence.id,
        libelle: "9L14 site",
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_9L14,
        societe_id: societeId,
        agence_id: agence.id,
        client_id: CLIENT_9L14,
        site_id: SITE_9L14,
        technicien_id: technicienId,
        type: "curatif",
        priorite: "p3",
        duree_estimee_min: 60,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "9L14 — intervention forgée par l'épreuve",
        // DÉJÀ DÉMARRÉE (9L08B) : ce scénario saisit une signature sans
        // démarrer lui-même, ce qui n'est pas ce qu'il éprouve.
        statut: "en_cours",
        date_planifiee: null,
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "notification" WHERE "intervention_id" = $1::uuid`,
      INTERVENTION_9L14,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "saisie_apres_cloture" WHERE "intervention_id" = $1::uuid`,
      INTERVENTION_9L14,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = $1::uuid`,
      INTERVENTION_9L14,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_9L14,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_9L14 } });
    await client.client.deleteMany({ where: { id: CLIENT_9L14 } });
  } finally {
    await client.$disconnect();
  }
});

async function connecterLeTechnicien(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/terrain$/);
}

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9L14-FIGE-A-LA-CLOTURE/captures",
);

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 900 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
  });
}

test("375 — hors réseau pendant que le bureau clôture : la signature revient GARDÉE, pas perdue", async ({
  page,
  context,
}) => {
  await connecterLeTechnicien(page);
  await page.goto(`/terrain/${INTERVENTION_9L14}`);
  await capturer(page, "avant-cloture-terrain", 375);

  await context.setOffline(true);
  await page
    .getByRole("button", { name: fr["terrain.signature.option_absent"] })
    .click();
  await page
    .getByLabel(fr["terrain.signature.motif_libelle"])
    .fill("9L14 client déjà reparti");
  await page.getByLabel(fr["terrain.signature.motif_libelle"]).blur();
  await expect(
    page.getByText(fr["terrain.auto.hors_ligne"]).first(),
  ).toBeVisible();
  await capturer(page, "hors-reseau-saisie-en-file", 375);

  // LE BUREAU CLÔTURE PENDANT LA COUPURE — exactement le cas que ce ticket
  // nomme : le téléphone reste hors réseau pendant que le bureau clôture.
  const bureau = admin();
  try {
    await bureau.$executeRawUnsafe(
      `UPDATE "intervention"
          SET "statut" = 'terminee', "temps_valide_min" = 60,
              "rapport_valide_par" = $1::uuid, "rapport_valide_le" = now()
        WHERE "id" = $2::uuid`,
      technicienId,
      INTERVENTION_9L14,
    );
    await bureau.$executeRawUnsafe(
      `UPDATE "intervention" SET "statut" = 'cloturee', "cloturee_le" = now()
        WHERE "id" = $1::uuid`,
      INTERVENTION_9L14,
    );
  } finally {
    await bureau.$disconnect();
  }

  await context.setOffline(false);
  await page.getByRole("button", { name: /^Envoyer \(\d+\)$/ }).click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: fr["intervention.refus.cloturee_saisie_gardee"] }),
  ).toBeVisible();
  await capturer(page, "apres-retour-reseau-garde", 375);
});

test("1280 — le bureau retrouve la saisie gardée, en lecture, sur la fiche", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto(`/interventions/${INTERVENTION_9L14}?onglet=rapport`);

  await expect(
    page.getByRole("heading", {
      name: fr["intervention.saisies_apres_cloture.titre"],
    }),
  ).toBeVisible();
  await expect(
    page.getByText(fr["intervention.saisies_apres_cloture.type.signature"], {
      exact: true,
    }),
  ).toBeVisible();
  await capturer(page, "bureau-saisies-apres-cloture", 1280);
});
