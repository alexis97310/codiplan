import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { Role } from "@/lib/auth/roles";

import { urlAdministration } from "./setup/base";
import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * LES CAPTURES DE AA-3-EQUIPE (28/09/2026) — même recette que
 * `captures-9ay-aa1-choix-sites.spec.ts` : rien n'est écrit sans la
 * variable d'environnement qui nomme le dossier, pour que `pnpm test:e2e`
 * ordinaire n'écrive jamais de fichier.
 *
 * SA PROPRE SCÈNE, PRÉFIXÉE `AA3CAP-` — une agence inactive et un
 * technicien déjà rattaché à elle, créés directement en base (le fait
 * antérieur que la décision D134 protège, ici pour un technicien plutôt
 * qu'un site).
 *
 * AVANT/APRÈS se prend en rejouant ce même fichier deux fois — une fois sur
 * le code d'avant le ticket, une fois sur le code livré — jamais en
 * comparant deux fichiers distincts. Aucune assertion ne porte sur le texte
 * de l'option (« (inactive) ») : ce que la CAPTURE montre suffit, et ce
 * fichier n'importe donc rien de `lib/i18n`.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_AA3 ?? "";

const PREFIXE = "AA3CAP-";
const CODE_AGENCE = `${PREFIXE}INACTIVE`;
const COURRIEL_TECHNICIEN = `${PREFIXE.toLowerCase()}technicien@codima.test`;

const AGENCE_ID = randomUUID();
const UTILISATEUR_ID = randomUUID();
const UTILISATEUR_SOCIETE_ID = randomUUID();
const TECHNICIEN_ID = randomUUID();

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

async function nettoyer(client: PrismaClient): Promise<void> {
  await client.technicien.deleteMany({ where: { id: TECHNICIEN_ID } });
  await client.utilisateurSociete.deleteMany({
    where: { id: UTILISATEUR_SOCIETE_ID },
  });
  await client.utilisateur.deleteMany({ where: { id: UTILISATEUR_ID } });
  await client.agence.deleteMany({ where: { id: AGENCE_ID } });
}

test.beforeAll(async () => {
  const client = admin();
  try {
    await nettoyer(client);
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    await client.agence.create({
      data: {
        id: AGENCE_ID,
        societe_id: societe.id,
        code: CODE_AGENCE,
        libelle: CODE_AGENCE,
        territoire: "NC",
        actif: false,
      },
    });
    await client.utilisateur.create({
      data: {
        id: UTILISATEUR_ID,
        nom: `${PREFIXE}Technicien`,
        email: COURRIEL_TECHNICIEN,
        email_verifie: true,
        actif: true,
      },
    });
    await client.utilisateurSociete.create({
      data: {
        id: UTILISATEUR_SOCIETE_ID,
        utilisateur_id: UTILISATEUR_ID,
        societe_id: societe.id,
        role: Role.technicien,
      },
    });
    await client.technicien.create({
      data: {
        id: TECHNICIEN_ID,
        societe_id: societe.id,
        utilisateur_id: UTILISATEUR_ID,
        agence_id: AGENCE_ID,
        actif: true,
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await nettoyer(client);
  } finally {
    await client.$disconnect();
  }
});

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

for (const largeur of [1280, 375] as const) {
  test.describe(`à ${largeur}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 1200 });
      await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
    });

    test(`capture — fiche de modification du technicien rattaché à l'agence inactive, à ${largeur}px`, async ({
      page,
    }) => {
      await page.goto("/parametres/equipe");
      const section = page
        .locator("details")
        .filter({ hasText: `${PREFIXE}Technicien` })
        .filter({ has: page.locator("form") });
      await expect(section).toBeVisible();
      await section.locator("summary").click();
      await expect(section.locator('select[name="agence_id"]')).toBeVisible();
      await capturer(page, "fiche-technicien", largeur);
    });
  });
}
