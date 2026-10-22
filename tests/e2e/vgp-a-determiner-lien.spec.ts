import { randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9G1-CORRECTIFS-AUDIT-URGENTS, point 9 — « FAMILLES À DÉTERMINER » MÈNE
 * DÉSORMAIS À L'ENDROIT OÙ LE RÉGIME SE DÉCIDE.
 *
 * ## Le constat
 *
 * `/vgp/a-determiner` listait les familles sans aucune action ni lien : le
 * sous-titre disait POURQUOI la famille est là, jamais OÙ trancher.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `9G1VGP-`
 *
 * Une seule famille, née « à déterminer » (valeur par défaut de
 * `assujettissement_vgp`, jamais posée explicitement) — créée et supprimée
 * par ce fichier seul.
 */
test.describe.configure({ mode: "serial" });

let familleId: string;

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  const client = admin();
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    const famille = await client.familleMateriel.create({
      data: {
        id: randomUUID(),
        societe_id: societe.id,
        code: `9G1VGP${randomUUID().slice(0, 6)}`,
        libelle: fr["9g1vgp.e2e.famille"],
      },
    });
    familleId = famille.id;
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.familleMateriel.deleteMany({ where: { id: familleId } });
  } finally {
    await client.$disconnect();
  }
});

test("chaque famille à déterminer porte un lien « Décider » vers Paramètres › Référentiel matériel, filtré sur elle", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto("/vgp/a-determiner");

  await expect(page.getByText(fr["9g1vgp.e2e.famille"])).toBeVisible();
  await expect(page.getByText(fr["vgp.indetermines.quoi_faire"])).toBeVisible();

  const ligne = page
    .locator("tr")
    .filter({ hasText: fr["9g1vgp.e2e.famille"] });
  const lien = ligne.getByRole("link", {
    name: fr["vgp.indetermines.decider"],
  });
  await expect(lien).toBeVisible();
  await expect(lien).toHaveAttribute(
    "href",
    `/parametres/materiel?famille=${familleId}#modeles`,
  );

  await lien.click();
  await expect(page).toHaveURL(
    new RegExp(`/parametres/materiel\\?famille=${familleId}`),
  );
});
