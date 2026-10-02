import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { createOTP } from "@better-auth/utils/otp";
import { base32 } from "@better-auth/utils/base32";
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
 * LES CAPTURES DE 9CW-TP-S6-SECOND-FACTEUR (D149) — AVANT/APRÈS LE GESTE, SUR
 * LE CODE LIVRÉ (même patron que `captures-9ct-retouches-5.spec.ts`).
 *
 * SA PROPRE SCÈNE, préfixée `9cw.` — des identités jetables, forgées en
 * `beforeAll`, effacées en `afterAll`, aucune ligne au semis (I9). Les clés
 * et codes affichés sont ceux d'un compte de test jetable : les captures le
 * disent dans le README.
 *
 * AVANT/APRÈS se prend en rejouant ce même fichier deux fois (`git
 * worktree`, une fois sur `d19a9d0` — le dernier commit avant ce lot —, une
 * fois sur le code livré) : avant ce lot, `/enrolement` portait la clé dans
 * l'URL et n'avait ni QR ni déconnexion ; `/connexion/code` n'offrait aucun
 * code de secours.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9CW ?? "";

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

  const email = `9cw.${etiquette}@codima.test`;
  const applicatif = new PrismaClient({
    datasources: { db: { url: urlApplicative() } },
  });
  try {
    const authAdmin = creerAuth(applicatif, {
      societeId,
      role: Role.admin_societe,
    });
    const cree = await authAdmin.api.signUpEmail({
      body: { email, password: MOT_DE_PASSE_EPREUVE, name: `9CW ${etiquette}` },
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

async function codeCourant(cleAffichee: string): Promise<string> {
  const secret = new TextDecoder().decode(
    base32.decode(cleAffichee.replace(/\s+/g, "")),
  );
  return createOTP(secret, { digits: 6, period: 30 }).totp();
}

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
    test(`capture — l'étape mot de passe, la clé+QR+codes, un code faux, à ${largeur}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: largeur, height: 1200 });
      const email = await nouveauCompte(`enrolement-${largeur}`);
      await seConnecter(page, email);
      await expect(page).toHaveURL(/\/enrolement$/);
      await capturer(page, "enrolement-mot-de-passe", largeur);

      await page.fill('input[name="motDePasse"]', MOT_DE_PASSE_EPREUVE);
      await page
        .getByRole("button", { name: fr["enrolement.reveler"] })
        .click();
      await page.waitForLoadState("networkidle");
      await capturer(page, "enrolement-cle-qr-codes", largeur);

      await page.fill('input[name="code"]', "000000");
      await page
        .getByRole("button", { name: fr["enrolement.confirmer"] })
        .click();
      await page.waitForLoadState("networkidle");
      await capturer(page, "enrolement-code-faux", largeur);
    });

    test(`capture — le lien de code de secours à la connexion, à ${largeur}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: largeur, height: 1200 });
      const email = await nouveauCompte(`code-secours-${largeur}`);
      // Un enrôlement complet — jamais capturé pour lui-même ici (déjà fait
      // ci-dessus) — pour atteindre /connexion/code à la connexion suivante.
      await seConnecter(page, email);
      await page.fill('input[name="motDePasse"]', MOT_DE_PASSE_EPREUVE);
      await page
        .getByRole("button", { name: fr["enrolement.reveler"] })
        .click();
      await page.waitForLoadState("networkidle");
      const cle = await page.locator("code").first().innerText();
      await page.fill('input[name="code"]', await codeCourant(cle));
      await page
        .getByRole("button", { name: fr["enrolement.confirmer"] })
        .click();
      await page.waitForLoadState("networkidle");

      await seConnecter(page, email);
      await expect(page).toHaveURL(/\/connexion\/code$/);
      await capturer(page, "connexion-code-secours-lien", largeur);
    });
  });
}
