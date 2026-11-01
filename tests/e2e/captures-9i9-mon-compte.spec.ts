import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { Role } from "@/lib/auth/roles";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { ouvrirLaSessionSensible } from "./setup/session";
import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";

/**
 * LES CAPTURES DE 9I9-MON-COMPTE — l'écran « Mon compte » et le badge aux
 * initiales qui y mène, à 1280 et 375 px. Même discipline que
 * `captures-9i6b-lien-acces-a-copier.spec.ts` : rien n'est écrit sur disque
 * sans la variable d'environnement qui nomme le dossier, pour que
 * `pnpm test:e2e` ordinaire n'écrive jamais de fichier.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9I9 ?? "";

const NOM_COMPTE = fr["captures9i9.e2e.nom"];
const COURRIEL_COMPTE = "compte.mon-compte@9i9cap.e2e.test";
const MOT_DE_PASSE = "mot-de-passe-9i9cap-epreuve";

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

test("captures — le badge aux initiales, puis l'écran « Mon compte »", async ({
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
    .fill(MOT_DE_PASSE);
  await pageCompte
    .getByLabel(fr["premier_acces.confirmation"])
    .fill(MOT_DE_PASSE);
  await pageCompte
    .getByRole("button", { name: fr["premier_acces.valider"] })
    .click();
  await pageCompte.waitForLoadState("networkidle");

  await pageCompte.getByLabel(fr["connexion.email"]).fill(COURRIEL_COMPTE);
  await pageCompte.getByLabel(fr["connexion.mot_de_passe"]).fill(MOT_DE_PASSE);
  await pageCompte
    .getByRole("button", { name: fr["connexion.valider"] })
    .click();
  await expect(pageCompte).toHaveURL(/\/planning/);

  // LE BADGE AUX INITIALES, AU PIED DE LA COLONNE.
  await expect(
    pageCompte.getByRole("link", { name: fr["nav.mon_compte"] }),
  ).toBeVisible();
  await capturerAuxDeuxLargeurs(pageCompte, "mon-compte-badge");

  // `capturerAuxDeuxLargeurs` laisse la fenêtre à 375 px : la colonne (et
  // son badge) en sort sous 901 px (COQUE-375) — la navigation se fait donc
  // par l'URL, jamais par un second clic sur un lien hors d'atteinte.
  await pageCompte.setViewportSize({ width: 1280, height: 1200 });
  await pageCompte.goto("/mon-compte");
  await expect(pageCompte).toHaveURL(/\/mon-compte/);
  await expect(
    pageCompte.getByRole("heading", { name: fr["mon_compte.titre"] }),
  ).toBeVisible();
  await capturerAuxDeuxLargeurs(pageCompte, "mon-compte-ecran");

  await pageCompte.close();
});
