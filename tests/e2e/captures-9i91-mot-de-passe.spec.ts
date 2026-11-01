import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { Role } from "@/lib/auth/roles";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * LA CAPTURE DE 9I91 — l'écran « Mon compte » APRÈS un changement de mot de
 * passe abouti, avec son message de confirmation, à 1280 et 375 px. Même
 * discipline que `captures-9i9-mon-compte.spec.ts`, même dossier : rien
 * n'est écrit sur disque sans `CAPTURES_9I9`.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9I9 ?? "";

const NOM_COMPTE = fr["captures9i9.e2e.nom"];
const COURRIEL_COMPTE = "compte.mon-compte@9i91cap.e2e.test";
const MOT_DE_PASSE_INITIAL = "mot-de-passe-9i91cap-initial";
const MOT_DE_PASSE_FINAL = "mot-de-passe-9i91cap-final";

let utilisateurId = "";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.afterAll(async () => {
  if (utilisateurId === "") {
    return;
  }
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "journal_acces" WHERE detail LIKE '%cible:' || $1`,
      utilisateurId,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "journal_acces" WHERE utilisateur_id = $1::uuid`,
      utilisateurId,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "session" WHERE utilisateur_id = $1::uuid`,
      utilisateurId,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "compte" WHERE utilisateur_id = $1::uuid`,
      utilisateurId,
    );
    await client.utilisateurSociete.deleteMany({
      where: { utilisateur_id: utilisateurId },
    });
    await client.utilisateur.deleteMany({ where: { id: utilisateurId } });
  } finally {
    await client.$disconnect();
  }
});

async function capturerAuxDeuxLargeurs(page: Page, nom: string): Promise<void> {
  for (const largeur of [1280, 375] as const) {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    if (DOSSIER === "") continue;
    mkdirSync(DOSSIER, { recursive: true });
    await page.screenshot({
      path: join(DOSSIER, `${nom}-${largeur}.png`),
      fullPage: true,
    });
  }
}

test("capture — « Mon compte » après un changement de mot de passe abouti", async ({
  page,
  browser,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);

  const creation = await page.request.post("/api/equipe/bureau/creer", {
    form: { nom: NOM_COMPTE, courriel: COURRIEL_COMPTE, role: Role.adv },
    maxRedirects: 0,
  });
  expect(creation.status()).toBe(303);

  const client = admin();
  try {
    const identite = await client.utilisateur.findFirstOrThrow({
      where: { email: COURRIEL_COMPTE },
      select: { id: true },
    });
    utilisateurId = identite.id;
  } finally {
    await client.$disconnect();
  }

  const lien = await page.request.post(
    `/api/equipe/bureau/${utilisateurId}/copier-lien`,
  );
  expect(lien.status()).toBe(200);
  const { url: urlPremierAcces } = (await lien.json()) as { url: string };

  const pageCompte = await browser.newPage();
  await pageCompte.goto(urlPremierAcces);
  await pageCompte
    .getByLabel(fr["premier_acces.mot_de_passe"])
    .fill(MOT_DE_PASSE_INITIAL);
  await pageCompte
    .getByLabel(fr["premier_acces.confirmation"])
    .fill(MOT_DE_PASSE_INITIAL);
  await pageCompte
    .getByRole("button", { name: fr["premier_acces.valider"] })
    .click();
  await pageCompte.waitForLoadState("networkidle");

  await pageCompte.getByLabel(fr["connexion.email"]).fill(COURRIEL_COMPTE);
  await pageCompte
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_INITIAL);
  await pageCompte
    .getByRole("button", { name: fr["connexion.valider"] })
    .click();
  await expect(pageCompte).toHaveURL(/\/planning/);

  await pageCompte.goto("/mon-compte");
  await expect(
    pageCompte.getByRole("heading", { name: fr["mon_compte.titre"] }),
  ).toBeVisible();

  await pageCompte
    .getByLabel(fr["mon_compte.mot_de_passe.actuel"], { exact: false })
    .fill(MOT_DE_PASSE_INITIAL);
  await pageCompte
    .getByLabel(fr["mon_compte.mot_de_passe.nouveau"], { exact: false })
    .fill(MOT_DE_PASSE_FINAL);
  await pageCompte
    .getByLabel(fr["mon_compte.mot_de_passe.confirmation"], { exact: false })
    .fill(MOT_DE_PASSE_FINAL);
  await pageCompte
    .getByRole("button", { name: fr["mon_compte.mot_de_passe.valider"] })
    .click();
  await expect(
    pageCompte.getByText(fr["mon_compte.mot_de_passe.abouti"]),
  ).toBeVisible();
  await expect(pageCompte).toHaveURL(/\/mon-compte/);

  await capturerAuxDeuxLargeurs(pageCompte, "9i91-mot-de-passe-abouti");

  await pageCompte.close();
});
