import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { creerAuth } from "@/lib/auth/config";
import { Role } from "@/lib/auth/roles";
import { avecContexteRls } from "@/lib/db/rls";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { MOT_DE_PASSE_EPREUVE } from "./setup/scene";

/**
 * LES CAPTURES DE 9CZ-RETOUCHES-9 — AVANT/APRÈS LE TEXTE CORRIGÉ (même patron
 * que `captures-9cw-tp-s6-second-facteur.spec.ts`).
 *
 * SA PROPRE SCÈNE, préfixée `9cz.` — une identité jetable, forgée en
 * `beforeAll` via le chemin administratif, effacée en `afterAll`, aucune
 * ligne au semis (I9).
 *
 * `enrolement.codes_secours.aide` affirmait « ils ne seront plus affichés »,
 * ce qui est faux dès le premier code refusé (TR-36, 9CW-TP-S6 : les codes
 * restent relus côté serveur tant que la ligne n'est pas confirmée). Seul le
 * TEXTE change — l'étape « clé, QR, codes de secours » de `/enrolement` est
 * la seule capturée.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9CZ ?? "";

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

function urlApplicative(): string {
  const url = new URL(urlAdministration());
  url.username = "codiplan_app";
  url.password = "";
  return url.toString();
}

const identitesCreees: string[] = [];

/** Ouvre une identité `direction` jetable, par le chemin administratif. */
async function nouveauCompte(etiquette: string): Promise<string> {
  const proprietaire = admin();
  let societeId = "";
  try {
    const societe = await proprietaire.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    societeId = societe.id;
  } finally {
    await proprietaire.$disconnect();
  }

  const email = `9cz.${etiquette}@codima.test`;
  const applicatif = new PrismaClient({
    datasources: { db: { url: urlApplicative() } },
  });
  try {
    const authAdmin = creerAuth(applicatif, {
      societeId,
      role: Role.admin_societe,
    });
    const cree = await authAdmin.api.signUpEmail({
      body: { email, password: MOT_DE_PASSE_EPREUVE, name: `9CZ ${etiquette}` },
    });
    identitesCreees.push(cree.user.id);
    await avecContexteRls(
      applicatif,
      { societeId, role: Role.admin_societe },
      (tx) =>
        tx.$executeRawUnsafe(
          `INSERT INTO "utilisateur_societe" ("id","utilisateur_id","societe_id","role")
             VALUES ($1::uuid, $2::uuid, $3::uuid, $4::"Role")`,
          uuidv7(),
          cree.user.id,
          societeId,
          Role.direction,
        ),
    );
  } finally {
    await applicatif.$disconnect();
  }
  return email;
}

test.afterAll(async () => {
  if (identitesCreees.length === 0) return;
  const client = admin();
  try {
    await client.journalAcces.deleteMany({
      where: { utilisateur_id: { in: identitesCreees } },
    });
    await client.utilisateurSociete.deleteMany({
      where: { utilisateur_id: { in: identitesCreees } },
    });
    await client.utilisateur.deleteMany({
      where: { id: { in: identitesCreees } },
    });
  } finally {
    await client.$disconnect();
  }
});

async function seConnecter(page: Page, email: string): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(email);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await page.waitForLoadState("networkidle");
}

for (const largeur of [1280, 375] as const) {
  test.describe(`à ${largeur}px`, () => {
    test(`capture — l'étape clé+QR+codes de secours de /enrolement, à ${largeur}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: largeur, height: 1200 });
      const email = await nouveauCompte(`enrolement-${largeur}`);
      await seConnecter(page, email);
      await expect(page).toHaveURL(/\/enrolement$/);

      await page.fill('input[name="motDePasse"]', MOT_DE_PASSE_EPREUVE);
      await page
        .getByRole("button", { name: fr["enrolement.reveler"] })
        .click();
      await page.waitForLoadState("networkidle");
      await capturer(page, "enrolement-codes-secours-aide", largeur);
    });
  });
}
