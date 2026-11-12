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
 * D226, AU RATTACHEMENT (décision d'Alexis du 10/11/2026,
 * 9L01-COPIE-LIEN-EXCLUSIVITE) — un courriel déjà connu d'une AUTRE société
 * refuse désormais la création d'un compte de bureau ou d'un technicien, par
 * UN SEUL motif neutre (`courriel_connu_ailleurs`). Même doctrine que
 * `captures-9i8d1-reprise-9i8d.spec.ts`, son modèle : rien n'est écrit sur
 * disque sans `CAPTURES_9L01`, pour que `pnpm test:e2e` ordinaire n'écrive
 * jamais de fichier.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9L01 ?? "";

const COURRIEL_BUREAU_AILLEURS = "bureau-ailleurs@9l01.e2e.test";
const COURRIEL_TECHNICIEN_AILLEURS = "technicien-ailleurs@9l01.e2e.test";

let idBureauAilleurs = "";
let idTechnicienAilleurs = "";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

async function supprimerIdentite(id: string): Promise<void> {
  if (id === "") return;
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "journal_acces" WHERE detail LIKE '%cible:' || $1 OR utilisateur_id = $1::uuid`,
      id,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "session" WHERE utilisateur_id = $1::uuid`,
      id,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "compte" WHERE utilisateur_id = $1::uuid`,
      id,
    );
    await client.technicien.deleteMany({ where: { utilisateur_id: id } });
    await client.utilisateurSociete.deleteMany({
      where: { utilisateur_id: id },
    });
    await client.utilisateur.deleteMany({ where: { id } });
  } finally {
    await client.$disconnect();
  }
}

test.afterAll(async () => {
  await supprimerIdentite(idBureauAilleurs);
  await supprimerIdentite(idTechnicienAilleurs);
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

/**
 * LA SOCIÉTÉ « AUTRE » DU SEMIS (`pnpm db:seed`, CLAUDE.md §4) — jamais un
 * identifiant écrit en dur, voir `9i8d1-copie-nouveau-lien-autre-societe.spec.ts`.
 */
async function autreSocieteId(client: PrismaClient): Promise<string> {
  return (
    await client.societe.findFirstOrThrow({
      where: { code: { not: "CODIMA-NC" } },
      select: { id: true },
    })
  ).id;
}

test("prépare un compte de bureau et un technicien, non activés, dans l'AUTRE société", async () => {
  const client = admin();
  try {
    const societeId = await autreSocieteId(client);
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societeId },
      select: { id: true },
    });

    const bureau = await client.utilisateur.create({
      data: {
        id: crypto.randomUUID(),
        nom: "9L01 — Compte de bureau, ailleurs",
        email: COURRIEL_BUREAU_AILLEURS,
      },
    });
    idBureauAilleurs = bureau.id;
    await client.utilisateurSociete.create({
      data: {
        id: crypto.randomUUID(),
        utilisateur_id: bureau.id,
        societe_id: societeId,
        role: Role.adv,
      },
    });

    const technicien = await client.utilisateur.create({
      data: {
        id: crypto.randomUUID(),
        nom: "9L01 — Technicien, ailleurs",
        email: COURRIEL_TECHNICIEN_AILLEURS,
      },
    });
    idTechnicienAilleurs = technicien.id;
    await client.utilisateurSociete.create({
      data: {
        id: crypto.randomUUID(),
        utilisateur_id: technicien.id,
        societe_id: societeId,
        role: Role.technicien,
      },
    });
    await client.technicien.create({
      data: {
        id: crypto.randomUUID(),
        societe_id: societeId,
        utilisateur_id: technicien.id,
        agence_id: agence.id,
        actif: true,
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test("création d'un compte de bureau avec un courriel connu d'une autre société — refus neutre, captures", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await page.goto("/parametres/equipe?onglet=bureau&ajouter=1&type=bureau");

  await page.locator("#ajout-bureau-nom").fill("9L01 — Tentative bureau");
  await page
    .locator("#ajout-bureau-courriel")
    .fill(COURRIEL_BUREAU_AILLEURS);
  await page.locator("#ajout-bureau-role").selectOption(Role.adv);
  await page.getByRole("button", { name: fr["equipe.creer_action"] }).click();

  const bandeau = page.locator(
    '[data-motif="equipe.bureau.refus.courriel_connu_ailleurs"]',
  );
  await expect(bandeau).toBeVisible();
  await expect(bandeau).toHaveText(
    fr["equipe.bureau.refus.courriel_connu_ailleurs"],
  );
  // LE MESSAGE NE RÉVÈLE NI LA SOCIÉTÉ, NI LE RÔLE, NI L'ACTIVATION
  // (décision d'Alexis du 10/11/2026) — ce que le texte NE CONTIENT PAS
  // compte autant que ce qu'il affiche.
  await expect(bandeau).not.toContainText("ADV");
  await expect(bandeau).not.toContainText("activ");

  // RIEN N'A ÉTÉ ÉCRIT POUR LA SOCIÉTÉ ACTIVE — une seconde habilitation
  // aurait fait grossir la liste.
  const client = admin();
  try {
    const habilitations = await client.utilisateurSociete.findMany({
      where: { utilisateur_id: idBureauAilleurs },
    });
    expect(habilitations).toHaveLength(1);
  } finally {
    await client.$disconnect();
  }

  await capturerAuxDeuxLargeurs(page, "equipe-bureau-refus-courriel-ailleurs");
});

test("création d'un technicien avec un courriel connu d'une autre société — refus neutre, captures", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await page.goto(
    "/parametres/equipe?onglet=techniciens&ajouter=1&type=technicien",
  );

  await page.locator("#ajout-technicien-nom").fill("9L01 — Tentative technicien");
  await page
    .locator("#ajout-technicien-email")
    .fill(COURRIEL_TECHNICIEN_AILLEURS);
  await page.locator("#ajout-technicien-statut").selectOption("salarie");
  await page.locator("#ajout-technicien-agence").selectOption({ index: 1 });
  await page.getByRole("button", { name: fr["equipe.creer_action"] }).click();

  const bandeau = page.locator(
    '[data-motif="equipe.refus.courriel_connu_ailleurs"]',
  );
  await expect(bandeau).toBeVisible();
  await expect(bandeau).toHaveText(fr["equipe.refus.courriel_connu_ailleurs"]);

  const client = admin();
  try {
    const rattachements = await client.technicien.findMany({
      where: { utilisateur_id: idTechnicienAilleurs },
    });
    expect(rattachements).toHaveLength(1);
  } finally {
    await client.$disconnect();
  }

  await capturerAuxDeuxLargeurs(
    page,
    "equipe-technicien-refus-courriel-ailleurs",
  );
});
