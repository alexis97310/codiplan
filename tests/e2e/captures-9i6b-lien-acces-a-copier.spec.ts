import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * LES CAPTURES DE 9I6B-LIEN-ACCES-A-COPIER (D170) — la ligne Équipe avec le
 * bouton « Copier le lien d'accès », puis le message « Lien copié » qui le
 * suit. Même discipline que `captures-9dja-acces-technicien.spec.ts` : rien
 * n'est écrit sur disque sans la variable d'environnement qui nomme le
 * dossier, pour que `pnpm test:e2e` ordinaire n'écrive jamais de fichier.
 *
 * **AUCUN LIEN RÉEL N'EST JAMAIS VISIBLE À L'ÉCRAN AU MOMENT DE LA CAPTURE** —
 * le message de succès (`equipe.acces.lien_copie`) ne porte jamais l'URL ;
 * le repli en lecture seule (`BoutonCopierLien`, état `a_copier_a_la_main`)
 * ne s'affiche que si le presse-papiers est refusé, précisément ce que ce
 * fichier évite en l'accordant avant le clic.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9I6B ?? "";

const NOM_TECHNICIEN = fr["captures9i6b.e2e.nom"];
const COURRIEL_TECHNICIEN = "technicien@9i6bcap.e2e.test";

let societeId = "";
let agenceId = "";
let utilisateurId = "";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  societeId = reperes.societeId;

  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societeId, code: "DUCOS" },
      select: { id: true },
    });
    agenceId = agence.id;

    utilisateurId = uuidv7();
    await client.utilisateur.create({
      data: {
        id: utilisateurId,
        nom: NOM_TECHNICIEN,
        email: COURRIEL_TECHNICIEN,
      },
    });
    await client.utilisateurSociete.create({
      data: {
        id: uuidv7(),
        utilisateur_id: utilisateurId,
        societe_id: societeId,
        role: Role.technicien,
      },
    });
    await client.technicien.create({
      data: {
        id: uuidv7(),
        societe_id: societeId,
        utilisateur_id: utilisateurId,
        agence_id: agenceId,
        actif: true,
        statut_ressource: "salarie",
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  if (utilisateurId === "") return;
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
    await client.technicien.deleteMany({
      where: { utilisateur_id: utilisateurId },
    });
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

function ficheDuTechnicien(page: Page) {
  return page
    .locator("details")
    .filter({ hasText: NOM_TECHNICIEN })
    .filter({ has: page.locator("form") });
}

test("captures — le bouton « Copier le lien d'accès », puis « Lien copié »", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);

  await page.goto("/parametres/equipe");
  const fiche = ficheDuTechnicien(page);
  await expect(fiche).toBeVisible();
  await fiche.locator("summary").click();
  await expect(
    fiche.getByRole("button", {
      name: fr["equipe.acces.copier_lien"],
      exact: true,
    }),
  ).toBeVisible();
  await capturerAuxDeuxLargeurs(page, "equipe-copier-lien-bouton");

  await fiche
    .getByRole("button", { name: fr["equipe.acces.copier_lien"], exact: true })
    .click();
  await expect(fiche.getByText(fr["equipe.acces.lien_copie"])).toBeVisible();
  await capturerAuxDeuxLargeurs(page, "equipe-copier-lien-message");
});
