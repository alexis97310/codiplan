import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { type ContexteSession } from "@/lib/auth/contexte";
import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";
import {
  enregistrerAccord,
  marquerDevisEnvoye,
  qualifierSuite,
} from "@/lib/suite-a-donner/depot";

import { urlAdministration, urlApplicative } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9J18-SUITE-A-DONNER-ECRAN (FLX-10) — même recette que
 * `captures-9j08a-portail-bon.spec.ts` (mémoire « captures-avant-apres-e2e ») :
 * sa propre scène jetable, posée dans `beforeAll`, effacée dans `afterAll`,
 * jamais celle de `tests/e2e/setup/scene.ts` — mémoire « e2e-semis-partage-
 * parallele ».
 *
 * **Le 1ᵉʳ décembre 2026** (mardi) — un jour ouvert du calendrier de
 * démonstration de DUCOS (`DEMO-NOUMEA`, `prisma/seed-data.ts` : lundi à
 * samedi, 07:30–11:30 puis 13:00–17:00), et aucun des fériés NC fixes ou
 * mobiles de cette année.
 *
 * **`qualifierSuite`/`marquerDevisEnvoye`/`enregistrerAccord` sont appelées
 * directement**, comme bibliothèque — même geste que `preparerLaScene` de
 * `captures-9j08a-portail-bon.spec.ts` (`inviterClientAuPortail`) : amener
 * une ligne à `a_replanifier` traverse la chaîne des transitions, hors écran
 * de ce ticket (9J18 n'ouvre que la qualification manuelle et la clôture
 * automatique), mais ce sont les mêmes fonctions de production, jamais une
 * ligne posée à la main. **Un accord sans pièce saute directement à
 * `a_replanifier`** (DÉCISION D'ALEXIS du 08/11/2026, 9K05) : `marquerPieceRecue`
 * n'a donc plus lieu sur ce chemin.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9J18 ?? "";

let interventionAQualifierId = "";
let interventionOrigineId = "";
let suiteADonnerId = "";
let nouvelleInterventionId = "";

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
  phase: "avant" | "apres",
): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 1200 });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-${phase}-${largeur}.png`),
    fullPage: true,
  });
}

async function preparerLaScene(): Promise<void> {
  const admin = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const utilisateur = await admin.utilisateur.findFirstOrThrow({
      where: { email: "adv@codima.test" },
      select: { id: true },
    });
    const utilisateurSociete = await admin.utilisateurSociete.findFirstOrThrow({
      where: { utilisateur_id: utilisateur.id },
      select: { societe_id: true },
    });
    const societeId = utilisateurSociete.societe_id;
    const agence = await admin.agence.findFirstOrThrow({
      where: { societe_id: societeId, code: "DUCOS" },
      select: { id: true },
    });
    const site = await admin.site.findFirstOrThrow({
      where: { societe_id: societeId, agence_id: agence.id },
      select: { id: true, client_id: true },
      orderBy: { libelle: "asc" },
    });
    const technicien = await admin.utilisateur.findFirstOrThrow({
      where: { email: "garnier@codima.test" },
      select: { id: true },
    });

    interventionAQualifierId = uuidv7();
    await admin.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "type", "statut", "suite_a_donner", "modifie_le", "cloturee_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif', 'cloturee', $6, now(), now())`,
      interventionAQualifierId,
      societeId,
      site.client_id,
      site.id,
      agence.id,
      "9J18 — compresseur à revoir dans trois mois.",
    );

    interventionOrigineId = uuidv7();
    await admin.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "type", "statut", "suite_a_donner", "duree_estimee_min", "technicien_id", "modifie_le", "cloturee_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif', 'cloturee', $6, 60, $7::uuid, now(), now())`,
      interventionOrigineId,
      societeId,
      site.client_id,
      site.id,
      agence.id,
      "9J18 — pièce à changer, prévoir un second passage.",
      technicien.id,
    );

    const contexte: ContexteSession = {
      utilisateurId: utilisateur.id,
      societeId,
      role: Role.adv,
      secondFacteurValide: true,
      adresseIp: null,
      clientId: null,
    };
    const applicatif = new PrismaClient({
      datasources: { db: { url: urlApplicative() } },
    });
    try {
      suiteADonnerId = await qualifierSuite(
        contexte,
        interventionOrigineId,
        applicatif,
      );
      await marquerDevisEnvoye(contexte, suiteADonnerId, applicatif);
      await enregistrerAccord(
        contexte,
        suiteADonnerId,
        { reponse: "accord_recu" },
        applicatif,
      );
    } finally {
      await applicatif.$disconnect();
    }
  } finally {
    await admin.$disconnect();
  }
}

async function effacerLaScene(): Promise<void> {
  const admin = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    if (suiteADonnerId !== "") {
      await admin.$executeRawUnsafe(
        `DELETE FROM "suite_a_donner" WHERE "id" = $1::uuid`,
        suiteADonnerId,
      );
    }
    if (nouvelleInterventionId !== "") {
      await admin.$executeRawUnsafe(
        `DELETE FROM "intervention" WHERE "id" = $1::uuid`,
        nouvelleInterventionId,
      );
    }
    for (const id of [interventionAQualifierId, interventionOrigineId]) {
      if (id !== "") {
        await admin.$executeRawUnsafe(
          `DELETE FROM "intervention" WHERE "id" = $1::uuid`,
          id,
        );
      }
    }
  } finally {
    await admin.$disconnect();
  }
}

test.beforeAll(async () => {
  await preparerLaScene();
});

test.afterAll(async () => {
  await effacerLaScene();
});

test("l'onglet montre l'intervention à qualifier et la suite à déplacer (AVANT)", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto("/interventions/suites-a-donner");
  await expect(page).toHaveURL(/\/interventions\/suites-a-donner/);
  await expect(
    page.getByRole("button", { name: fr["suites_a_donner.action.qualifier"] }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: fr["suites_a_donner.action.replanifier"] }),
  ).toBeVisible();
  for (const largeur of [375, 1280] as const) {
    await capturer(page, "onglet", largeur, "avant");
  }
});

test("qualifier une intervention clôturée crée sa suite à donner (APRÈS)", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto("/interventions/suites-a-donner");
  await page
    .getByRole("button", { name: fr["suites_a_donner.action.qualifier"] })
    .click();
  await expect(page).toHaveURL(/\/interventions\/suites-a-donner/);
  await expect(page.getByRole("status")).toContainText(
    fr["suites_a_donner.qualifiee"],
  );
  await expect(
    page.getByRole("button", { name: fr["suites_a_donner.action.qualifier"] }),
  ).toHaveCount(0);
  for (const largeur of [375, 1280] as const) {
    await capturer(page, "onglet", largeur, "apres");
  }
});

test("l'écran de déplacement propose un créneau, pré-sélectionne le technicien d'origine (AVANT/APRÈS)", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto(
    `/interventions/suites-a-donner/${suiteADonnerId}/replanifier`,
  );
  await expect(page).toHaveURL(/\/replanifier$/);
  // FLX-6 : LE TECHNICIEN DE L'INTERVENTION D'ORIGINE EST PRÉ-SÉLECTIONNÉ.
  await expect(
    page.getByLabel(fr["suites_a_donner.replanifier.technicien"]),
  ).toHaveValue(/.+/);
  for (const largeur of [375, 1280] as const) {
    await capturer(page, "deplacer-formulaire", largeur, "avant");
  }

  await page
    .getByLabel(fr["suites_a_donner.replanifier.date"])
    .fill("2026-12-01");
  await page.getByLabel(fr["suites_a_donner.replanifier.duree"]).fill("60");
  await page
    .getByRole("button", {
      name: fr["suites_a_donner.replanifier.voir_creneaux"],
    })
    .click();
  await expect(page).toHaveURL(/date=2026-12-01/);
  await expect(
    page.getByRole("heading", {
      name: fr["suites_a_donner.replanifier.creneaux_titre"],
    }),
  ).toBeVisible();
  for (const largeur of [375, 1280] as const) {
    await capturer(page, "deplacer-creneaux", largeur, "apres");
  }

  await page.locator('input[name="debut_minutes"]').first().check();
  await page
    .getByRole("button", { name: fr["suites_a_donner.replanifier.confirmer"] })
    .click();
  await expect(page).toHaveURL(/\/interventions\/[0-9a-f-]+\?motif=/);
  await expect(
    page.getByText(fr["suites_a_donner.reprise_creee"]),
  ).toBeVisible();
  const match = /\/interventions\/([0-9a-f-]+)\?/.exec(page.url());
  nouvelleInterventionId = match?.[1] ?? "";
  expect(nouvelleInterventionId).not.toBe("");
});
