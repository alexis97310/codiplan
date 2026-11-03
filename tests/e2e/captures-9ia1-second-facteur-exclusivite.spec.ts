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
 * LES CAPTURES DE 9IA1-REPRISE-9IA (point 4) — même recette que
 * `captures-9ia-reinitialiser-second-facteur.spec.ts` : rien n'est écrit
 * sans la variable d'environnement qui nomme le dossier.
 *
 * DEUX CIBLES, pour montrer D226 en vis-à-vis sur le MÊME écran : une
 * identité EXCLUSIVE à la société active (enrôlée pour de vrai, le bouton se
 * propose) et une identité AUSSI rattachée à une autre société (second
 * facteur posé par scène accélérée — hors sujet de cette capture — le
 * bouton ne se propose pas).
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9IA1 ?? "";

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

const EMAIL_EXCLUSIF = "9ia1-capture-exclusif@codima.test";
const EMAIL_PARTAGE = "9ia1-capture-partage@codima.test";
let exclusifId = "";
let partageId = "";

test.beforeAll(async () => {
  const proprietaire = admin();
  let societeId = "";
  let autreSocieteId = "";
  try {
    const societe = await proprietaire.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    societeId = societe.id;
    const autreSociete = await proprietaire.societe.findFirstOrThrow({
      where: { code: { not: "CODIMA-NC" } },
      select: { id: true },
    });
    autreSocieteId = autreSociete.id;
  } finally {
    await proprietaire.$disconnect();
  }

  // ── LA CIBLE EXCLUSIVE — enrôlée pour de vrai, le bouton se propose ──────
  const applicatif = new PrismaClient({
    datasources: { db: { url: urlApplicative() } },
  });
  try {
    const authAdmin = creerAuth(applicatif, {
      societeId,
      role: Role.admin_societe,
    });
    const creeExclusif = await authAdmin.api.signUpEmail({
      body: {
        email: EMAIL_EXCLUSIF,
        password: MOT_DE_PASSE_EPREUVE,
        name: "9IA1 Capture Exclusif",
      },
    });
    exclusifId = creeExclusif.user.id;
    await avecContexteRls(
      applicatif,
      { societeId, role: Role.admin_societe },
      (tx) =>
        tx.$executeRawUnsafe(
          `INSERT INTO "utilisateur_societe" ("id","utilisateur_id","societe_id","role")
             VALUES ($1::uuid, $2::uuid, $3::uuid, $4::"Role")`,
          uuidv7(),
          creeExclusif.user.id,
          societeId,
          Role.direction,
        ),
    );

    const creePartage = await authAdmin.api.signUpEmail({
      body: {
        email: EMAIL_PARTAGE,
        password: MOT_DE_PASSE_EPREUVE,
        name: "9IA1 Capture Partagé",
      },
    });
    partageId = creePartage.user.id;
    await avecContexteRls(
      applicatif,
      { societeId, role: Role.admin_societe },
      (tx) =>
        tx.$executeRawUnsafe(
          `INSERT INTO "utilisateur_societe" ("id","utilisateur_id","societe_id","role")
             VALUES ($1::uuid, $2::uuid, $3::uuid, $4::"Role")`,
          uuidv7(),
          creePartage.user.id,
          societeId,
          Role.adv,
        ),
    );
  } finally {
    await applicatif.$disconnect();
  }

  // ── LE RATTACHEMENT DE LA CIBLE PARTAGÉE À L'AUTRE SOCIÉTÉ (D226) ────────
  const clientRattachement = admin();
  try {
    await clientRattachement.utilisateurSociete.create({
      data: {
        id: uuidv7(),
        utilisateur_id: partageId,
        societe_id: autreSocieteId,
        role: Role.adv,
      },
    });
    // SECOND FACTEUR ACTIF, PAR SCÈNE ACCÉLÉRÉE — hors sujet de cette
    // capture, qui montre l'absence du bouton, pas l'enrôlement.
    await clientRattachement.$executeRawUnsafe(
      `INSERT INTO "second_facteur" (id, utilisateur_id, secret, codes_secours, verifie)
       VALUES ($1::uuid, $2::uuid, 'secret-de-capture', 'codes-de-capture', true)`,
      uuidv7(),
      partageId,
    );
    await clientRattachement.$executeRawUnsafe(
      `UPDATE "utilisateur" SET mfa_actif = true WHERE id = $1::uuid`,
      partageId,
    );
  } finally {
    await clientRattachement.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    for (const id of [exclusifId, partageId]) {
      if (id === "") continue;
      await client.journalAcces.deleteMany({ where: { utilisateur_id: id } });
      await client.$executeRawUnsafe(
        `DELETE FROM "second_facteur" WHERE utilisateur_id = $1::uuid`,
        id,
      );
      await client.utilisateurSociete.deleteMany({
        where: { utilisateur_id: id },
      });
      await client.utilisateur.deleteMany({ where: { id } });
    }
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
    path: join(DOSSIER, `9ia1-${nom}-${largeur}.png`),
    fullPage: true,
  });
}

for (const largeur of [1280, 375] as const) {
  test(`capture — exclusivité D226 sur la ligne Équipe, à ${largeur}px`, async ({
    page,
    browser,
  }) => {
    // L'ENRÔLEMENT DE LA CIBLE EXCLUSIVE, DANS SA PROPRE PAGE — jamais celle
    // de l'administrateur (même raison que `acces-bureau.spec.ts`).
    const pageSujet = await browser.newPage();
    await ouvrirLaSessionSensible(pageSujet, EMAIL_EXCLUSIF);
    await pageSujet.close();

    await page.setViewportSize({ width: largeur, height: 1400 });
    await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
    await page.goto("/parametres/equipe?onglet=bureau");

    const ligneExclusive = page.getByRole("row", {
      name: /9IA1 Capture Exclusif/,
    });
    await expect(
      ligneExclusive.getByRole("button", {
        name: fr["equipe.bureau.second_facteur.reinitialiser"],
      }),
    ).toBeVisible();

    const lignePartagee = page.getByRole("row", {
      name: /9IA1 Capture Partagé/,
    });
    await expect(
      lignePartagee.getByRole("button", {
        name: fr["equipe.bureau.second_facteur.reinitialiser"],
      }),
    ).toHaveCount(0);

    await capturer(page, "exclusivite-second-facteur", largeur);
  });
}
