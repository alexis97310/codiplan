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
import {
  COMPTE_ADMIN_SOCIETE_EPREUVE,
  MOT_DE_PASSE_EPREUVE,
} from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * LES CAPTURES DE 9IA-REINITIALISER-SECOND-FACTEUR (point 5) — même recette
 * que `captures-aa3-equipe.spec.ts` : rien n'est écrit sans la variable
 * d'environnement qui nomme le dossier.
 *
 * SA PROPRE IDENTITÉ jetable, préfixée `9ia-capture.`, enrôlée pour de vrai
 * (`ouvrirLaSessionSensible`) afin que le bouton se propose réellement.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9IA ?? "";

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

const EMAIL_SUJET = "9ia-capture@codima.test";
let sujetId = "";

test.beforeAll(async () => {
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

  const applicatif = new PrismaClient({
    datasources: { db: { url: urlApplicative() } },
  });
  try {
    const authAdmin = creerAuth(applicatif, {
      societeId,
      role: Role.admin_societe,
    });
    const cree = await authAdmin.api.signUpEmail({
      body: {
        email: EMAIL_SUJET,
        password: MOT_DE_PASSE_EPREUVE,
        name: "9IA Capture",
      },
    });
    sujetId = cree.user.id;
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
});

test.afterAll(async () => {
  if (sujetId === "") return;
  const client = admin();
  try {
    await client.journalAcces.deleteMany({
      where: { utilisateur_id: sujetId },
    });
    await client.utilisateurSociete.deleteMany({
      where: { utilisateur_id: sujetId },
    });
    await client.utilisateur.deleteMany({ where: { id: sujetId } });
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
    test(`capture — la ligne Équipe et la confirmation, à ${largeur}px`, async ({
      page,
      browser,
    }) => {
      // L'ENRÔLEMENT DU SUJET, UNE FOIS, DANS SA PROPRE PAGE — jamais celle
      // de l'administrateur (même raison que `acces-bureau.spec.ts`).
      const pageSujet = await browser.newPage();
      await ouvrirLaSessionSensible(pageSujet, EMAIL_SUJET);
      await pageSujet.close();

      await page.setViewportSize({ width: largeur, height: 1200 });
      await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
      await page.goto("/parametres/equipe?onglet=bureau");

      const bouton = page.getByRole("button", {
        name: fr["equipe.bureau.second_facteur.reinitialiser"],
      });
      await expect(bouton.first()).toBeVisible();
      await capturer(page, "equipe-bureau-ligne", largeur);

      await bouton.first().click();
      await expect(
        page.getByText(
          fr["equipe.bureau.second_facteur.reinitialiser_confirmation"],
        ),
      ).toBeVisible();
      await capturer(page, "equipe-bureau-confirmation", largeur);
    });
  });
}
