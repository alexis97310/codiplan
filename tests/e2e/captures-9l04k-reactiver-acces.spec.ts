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
  COMPTE_TECHNICIEN_EPREUVE,
  MOT_DE_PASSE_EPREUVE,
} from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * 9L04K-REACTIVER-ACCES-INTERNE — LES CAPTURES, ET L'ÉPREUVE DE BOUT EN BOUT
 * que « Rétablir l'accès » rouvre vraiment la société.
 *
 * Modèle : `tests/e2e/captures-9l03c-retirer-acces.spec.ts`, son symétrique
 * — même sujet jetable, même discipline (bureau jusqu'au bout, technicien
 * arrêté à la confirmation car `COMPTE_TECHNICIEN_EPREUVE` est une scène
 * PARTAGÉE que ce fichier ne doit jamais réellement toucher).
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9L04K ?? "";

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

const sujetsCrees: string[] = [];

async function creerSujetBureau(
  suffixe: string,
): Promise<{ email: string; utilisateurId: string; nom: string }> {
  const email = `9l04k-bureau-${suffixe}@codima.test`;
  const nom = `9L04K Bureau ${suffixe}`;
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
      body: { email, password: MOT_DE_PASSE_EPREUVE, name: nom },
    });
    sujetsCrees.push(cree.user.id);
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
          Role.adv,
        ),
    );
    return { email, utilisateurId: cree.user.id, nom };
  } finally {
    await applicatif.$disconnect();
  }
}

test.afterAll(async () => {
  if (sujetsCrees.length === 0) return;
  const client = admin();
  try {
    await client.session.deleteMany({
      where: { utilisateur_id: { in: sujetsCrees } },
    });
    await client.journalAcces.deleteMany({
      where: { utilisateur_id: { in: sujetsCrees } },
    });
    await client.utilisateurSociete.deleteMany({
      where: { utilisateur_id: { in: sujetsCrees } },
    });
    await client.utilisateur.deleteMany({
      where: { id: { in: sujetsCrees } },
    });
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
    test(`bureau — retire puis rétablit l'accès jusqu'au bout, à ${largeur}px`, async ({
      page,
      browser,
    }) => {
      const sujet = await creerSujetBureau(String(largeur));

      await page.setViewportSize({ width: largeur, height: 1200 });
      await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);

      // ── LA TUILE D'ÉQUIPE DU TABLEAU DE BORD, AVANT ─────────────────────
      await page.goto("/tableau-de-bord");
      await expect(page.locator('[data-bloc="kpi-acces-a-ouvrir"]')).toBeVisible();
      await capturer(page, "tableau-de-bord-tuile-equipe-avant", largeur);

      // ── LE RETRAIT, PRÉALABLE À CE QUE CE LOT ÉPROUVE ────────────────────
      await page.goto("/parametres/equipe?onglet=bureau");
      let ligne = page.getByRole("row").filter({ hasText: sujet.nom });
      await expect(ligne).toBeVisible();
      await ligne
        .getByRole("button", { name: fr["equipe.retirer_acces"] })
        .click();
      await ligne
        .getByRole("button", { name: fr["equipe.retirer_acces.confirmer"] })
        .click();
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveURL(/motif=equipe\.retrait_acces\.reussi/);

      // ── « RÉTABLIR L'ACCÈS » (9L04K) ────────────────────────────────────
      await page.goto("/parametres/equipe?onglet=bureau");
      ligne = page.getByRole("row").filter({ hasText: sujet.nom });
      await expect(
        ligne.getByText(fr["equipe.acces_retire"]),
      ).toBeVisible();
      const bouton = ligne.getByRole("button", {
        name: fr["equipe.retablir_acces"],
      });
      await expect(bouton).toBeVisible();
      await capturer(page, "equipe-bureau-retablir-acces-avant", largeur);

      await bouton.click();
      await expect(
        ligne.getByText(fr["equipe.retablir_acces.confirmation"]),
      ).toBeVisible();
      await capturer(
        page,
        "equipe-bureau-retablir-acces-confirmation",
        largeur,
      );

      await ligne
        .getByRole("button", { name: fr["equipe.retablir_acces.confirmer"] })
        .click();
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveURL(/motif=equipe\.retablir_acces\.reussi/);
      const ligneApres = page.getByRole("row").filter({ hasText: sujet.nom });
      await expect(
        ligneApres.getByText(fr["equipe.acces_retire"]),
      ).not.toBeVisible();
      await capturer(page, "equipe-bureau-retablir-acces-apres", largeur);

      // ── LE RÉTABLISSEMENT ROUVRE VRAIMENT LA SOCIÉTÉ — une connexion
      // NEUVE réussit (`ouvrirLaSessionSensible` exige elle-même une
      // destination parmi /planning, /terrain, /portail) ────────────────
      const pageSujet = await browser.newPage();
      await ouvrirLaSessionSensible(pageSujet, sujet.email);
      await pageSujet.close();

      // ── LA TUILE D'ÉQUIPE DU TABLEAU DE BORD, APRÈS ─────────────────────
      await page.goto("/tableau-de-bord");
      await expect(page.locator('[data-bloc="kpi-acces-a-ouvrir"]')).toBeVisible();
      await capturer(page, "tableau-de-bord-tuile-equipe-apres", largeur);
    });

    test(`technicien — le bouton « Rétablir l'accès » n'est jamais proposé tant que l'accès est actif, à ${largeur}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: largeur, height: 1200 });
      await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
      await page.goto("/parametres/equipe");

      const ligneTechnicien = page
        .locator("tr:visible, li:visible")
        .filter({ hasText: COMPTE_TECHNICIEN_EPREUVE.split("@")[0] ?? "" });
      await expect(ligneTechnicien.first()).toBeVisible();
      await expect(
        ligneTechnicien
          .first()
          .getByRole("button", { name: fr["equipe.retablir_acces"] }),
      ).not.toBeVisible();
    });
  });
}
